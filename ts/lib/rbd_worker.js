'use strict';
// Web worker: gradient-descent force computation + K-step integration.
//
// Key design decisions:
//  • All position state is maintained here (workElemPos, etc.) and is NEVER
//    round-tripped back to the main thread.  The main thread sends positions
//    only once (init) and then only for selected clusters (sparse updates).
//    For the common no-selection case: zero position data transferred.
//  • The spatial hash is built ONCE per K-step batch, not once per step.
//    Clusters drift ≤ K × MAX_TRANS ≪ CELL_SIZE between steps, so the
//    hash remains valid across all K steps.
//  • All per-step arrays (forces, torques, netTrans, netQuat) are allocated
//    at init and reused — no per-step heap allocation.
//
// Contact modes:
//  • Fine-grained (default): element-by-element pairwise contact between
//    clusters — accurate, O(n_elem²) per cluster pair.
//  • Sphere mode: each cluster is represented as its bounding sphere; torque
//    is captured via small colliders placed at each connection-point endpoint.
//    O(1) + O(n_conn) per cluster pair — much cheaper for large clusters.

const ELEMENT_COLLIDER_RADIUS = 0.5;
const CONN_COLLIDER_RADIUS    = 0.5;
const MIN_DIST  = 2 * ELEMENT_COLLIDER_RADIUS;
const MIN_DIST2 = MIN_DIST * MIN_DIST;
const MAX_TRANS = ELEMENT_COLLIDER_RADIUS; // max translation per step (stability clamp)
const MAX_ANGLE = 0.15;                    // max rotation per step in radians

// How often (in steps) to rebuild the spatial hash inside the K-step loop.
// With K=200 and MAX_TRANS=0.5 a cluster can drift 100 units per batch, far
// exceeding CELL_SIZE, so rebuilding periodically prevents missed collisions.
const HASH_REBUILD_INTERVAL = 10;

// Static topology
let N = 0;
let boundingRadii, elemOffsets, elemCounts, connOffsets, connCounts;
let inertiaMult, connToGlobalIdx;
let CELL_SIZE = 1.0;

// Persistent working arrays — allocated once at init
let workElemPos, workClusterPos, workConnFrom, workConnTo;
let forces, torques, netTrans, netQuat;

self.onmessage = function(e) {
    const msg = e.data;

    // ── Init ─────────────────────────────────────────────────────────────────
    if (msg.type === 'init') {
        N              = msg.N;
        boundingRadii  = msg.boundingRadii;
        elemOffsets    = msg.elemOffsets;
        elemCounts     = msg.elemCounts;
        connOffsets    = msg.connOffsets;
        connCounts     = msg.connCounts;
        inertiaMult    = msg.inertiaMult;
        connToGlobalIdx = msg.connToGlobalIdx;

        let maxBR = 0;
        for (let i = 0; i < N; i++) maxBR = Math.max(maxBR, boundingRadii[i]);
        CELL_SIZE = maxBR * 2 + MIN_DIST;

        // Initialise working position state from transferred buffers
        workElemPos    = msg.initialElemPos;    // Float32Array — transferred ownership
        workClusterPos = msg.initialClusterPos;
        workConnFrom   = msg.initialConnFrom;
        workConnTo     = msg.initialConnTo;

        // Allocate reusable per-step scratch arrays
        forces   = new Float32Array(N * 3);
        torques  = new Float32Array(N * 3);
        netTrans = new Float32Array(N * 3);
        netQuat  = new Float32Array(N * 4);
        return;
    }

    if (msg.type !== 'step') return;

    const { selectedMask, selClusterIdx, selClusterPos,
            selElemPositions, selConnFromPositions, params } = msg;
    const { contactRepulsion, springK, relaxed, maxForce,
            electrostaticStrength, screeningLength, dt, stepsPerCall, sphereMode } = params;
    const K = stepsPerCall | 0 || 4;

    // ── Sparse position update for selected clusters ──────────────────────────
    if (selClusterIdx && selClusterIdx.length > 0) {
        let sei = 0, sci = 0;
        for (let k = 0; k < selClusterIdx.length; k++) {
            const i = selClusterIdx[k];
            workClusterPos[i*3]   = selClusterPos[k*3];
            workClusterPos[i*3+1] = selClusterPos[k*3+1];
            workClusterPos[i*3+2] = selClusterPos[k*3+2];

            const eOff = elemOffsets[i] * 3, eCnt = elemCounts[i] * 3;
            for (let ia = 0; ia < eCnt; ia++) workElemPos[eOff + ia] = selElemPositions[sei++];

            const cOff = connOffsets[i] * 3, cCnt = connCounts[i] * 3;
            for (let ia = 0; ia < cCnt; ia++) workConnFrom[cOff + ia] = selConnFromPositions[sci++];
        }
        // Refresh connTo endpoints that point into updated elements
        const nConns = connToGlobalIdx.length;
        for (let c = 0; c < nConns; c++) {
            const gi = connToGlobalIdx[c];
            if (gi < 0) continue;
            workConnTo[c*3]   = workElemPos[gi*3];
            workConnTo[c*3+1] = workElemPos[gi*3+1];
            workConnTo[c*3+2] = workElemPos[gi*3+2];
        }
    }

    // Spatial hash — rebuilt inside the K-loop every HASH_REBUILD_INTERVAL steps.
    const grid = new Map();
    const invCell = 1.0 / CELL_SIZE;

    // Reset net-transform accumulators
    netTrans.fill(0);
    netQuat.fill(0);
    for (let i = 0; i < N; i++) netQuat[i*4+3] = 1.0;

    // Fine-grained contact distance scales with bond length so longer-bond
    // simulations maintain proportionally larger separation zones.
    const dynMin  = relaxed / 3.0;   // normalised: relaxed=3 → dynMin=MIN_DIST=1.0
    const dynMin2 = dynMin * dynMin;

    // ── K gradient-descent steps ──────────────────────────────────────────────
    for (let step = 0; step < K; step++) {
        // Rebuild spatial hash every HASH_REBUILD_INTERVAL steps so that
        // clusters which have drifted into new cells are found by their
        // actual neighbors (prevents tunneling for large K).
        if (step % HASH_REBUILD_INTERVAL === 0) {
            grid.clear();
            for (let i = 0; i < N; i++) {
                if (selectedMask[i]) continue;
                const key = cellKey(
                    Math.floor(workClusterPos[i*3]   * invCell),
                    Math.floor(workClusterPos[i*3+1] * invCell),
                    Math.floor(workClusterPos[i*3+2] * invCell)
                );
                let cell = grid.get(key);
                if (!cell) { cell = []; grid.set(key, cell); }
                cell.push(i);
            }
        }

        forces.fill(0);
        torques.fill(0);

        // Force accumulation
        for (let i = 0; i < N; i++) {
            if (selectedMask[i]) continue;
            const i3  = i * 3;
            const cxi = workClusterPos[i3], cyi = workClusterPos[i3+1], czi = workClusterPos[i3+2];

            // Spring forces
            const csEnd = connOffsets[i] + connCounts[i];
            for (let c = connOffsets[i]; c < csEnd; c++) {
                const c3  = c * 3;
                const fx0 = workConnFrom[c3],   fy0 = workConnFrom[c3+1], fz0 = workConnFrom[c3+2];
                const dx  = workConnTo[c3]-fx0, dy  = workConnTo[c3+1]-fy0, dz = workConnTo[c3+2]-fz0;
                const d2  = dx*dx + dy*dy + dz*dz;
                if (d2 < 1e-16) continue;
                const dist = Math.sqrt(d2);
                const ext  = dist - relaxed;
                if (Math.abs(ext) < 1e-8) continue;
                const s = Math.sign(ext) * Math.min(springK * Math.abs(ext), maxForce) / dist;
                const ffx = dx*s, ffy = dy*s, ffz = dz*s;
                forces[i3]   += ffx; forces[i3+1] += ffy; forces[i3+2] += ffz;
                const rx = fx0-cxi, ry = fy0-cyi, rz = fz0-czi;
                torques[i3]   += ry*ffz - rz*ffy;
                torques[i3+1] += rz*ffx - rx*ffz;
                torques[i3+2] += rx*ffy - ry*ffx;
            }

            // Contact repulsion via spatial hash
            const gcx = Math.floor(cxi * invCell);
            const gcy = Math.floor(cyi * invCell);
            const gcz = Math.floor(czi * invCell);

            if (sphereMode) {
                // ── Sphere mode ───────────────────────────────────────────────
                // Broad phase: bounding sphere vs bounding sphere.
                // Torque captured via connection-point colliders (CONN_COLLIDER_RADIUS
                // spheres at each cross-cluster bond endpoint, off-center from COM).
                const Ri = boundingRadii[i];
                const cStart_i = connOffsets[i], cEnd_i = cStart_i + connCounts[i];
                for (let ddx = -1; ddx <= 1; ddx++) {
                    for (let ddy = -1; ddy <= 1; ddy++) {
                        for (let ddz = -1; ddz <= 1; ddz++) {
                            const neighbors = grid.get(cellKey(gcx+ddx, gcy+ddy, gcz+ddz));
                            if (!neighbors) continue;
                            for (let ni = 0; ni < neighbors.length; ni++) {
                                const j = neighbors[ni];
                                if (j <= i) continue;
                                const j3  = j * 3;
                                const cxj = workClusterPos[j3], cyj = workClusterPos[j3+1], czj = workClusterPos[j3+2];
                                const Rj  = boundingRadii[j];
                                const cStart_j = connOffsets[j], cEnd_j = cStart_j + connCounts[j];

                                // Bounding sphere vs bounding sphere.
                                // Force is scaled by combined element count so the collective
                                // repulsion matches what N×N element pairs would produce in
                                // fine-grained mode, preventing over-compression.
                                const bsdx = cxi-cxj, bsdy = cyi-cyj, bsdz = czi-czj;
                                const bsd2 = bsdx*bsdx + bsdy*bsdy + bsdz*bsdz;
                                const sumR = (Ri + Rj) * 0.5;
                                if (bsd2 < sumR*sumR && bsd2 > 1e-16) {
                                    const bsDist = Math.sqrt(bsd2);
                                    const mag = contactRepulsion * (sumR - bsDist) / bsDist;
                                    const ffx = bsdx*mag, ffy = bsdy*mag, ffz = bsdz*mag;
                                    forces[i3]   += ffx; forces[i3+1] += ffy; forces[i3+2] += ffz;
                                    forces[j3]   -= ffx; forces[j3+1] -= ffy; forces[j3+2] -= ffz;
                                }

                                // Connection-point colliders of i vs bounding sphere of j
                                //    Force on i acts at the (off-center) conn point → torque on i.
                                //    Reaction on j acts through j's center → no torque on j.
                                const thresh_ij  = CONN_COLLIDER_RADIUS + Rj;
                                const thresh_ij2 = thresh_ij * thresh_ij;
                                for (let c = cStart_i; c < cEnd_i; c++) {
                                    const c3 = c * 3;
                                    const px = workConnFrom[c3], py = workConnFrom[c3+1], pz = workConnFrom[c3+2];
                                    const dpx = px-cxj, dpy = py-cyj, dpz = pz-czj;
                                    const dp2 = dpx*dpx + dpy*dpy + dpz*dpz;
                                    if (dp2 >= thresh_ij2 || dp2 < 1e-16) continue;
                                    const dist = Math.sqrt(dp2);
                                    const mag  = contactRepulsion * (thresh_ij - dist) / dist;
                                    const ffx = dpx*mag, ffy = dpy*mag, ffz = dpz*mag;
                                    forces[i3]   += ffx; forces[i3+1] += ffy; forces[i3+2] += ffz;
                                    const rx = px-cxi, ry = py-cyi, rz = pz-czi;
                                    torques[i3]   += ry*ffz - rz*ffy;
                                    torques[i3+1] += rz*ffx - rx*ffz;
                                    torques[i3+2] += rx*ffy - ry*ffx;
                                    forces[j3]   -= ffx; forces[j3+1] -= ffy; forces[j3+2] -= ffz;
                                }

                                // Connection-point colliders of j vs bounding sphere of i
                                //    Force on j acts at the (off-center) conn point → torque on j.
                                //    Reaction on i acts through i's center → no torque on i.
                                const thresh_ji  = CONN_COLLIDER_RADIUS + Ri;
                                const thresh_ji2 = thresh_ji * thresh_ji;
                                for (let c = cStart_j; c < cEnd_j; c++) {
                                    const c3 = c * 3;
                                    const px = workConnFrom[c3], py = workConnFrom[c3+1], pz = workConnFrom[c3+2];
                                    const dpx = px-cxi, dpy = py-cyi, dpz = pz-czi;
                                    const dp2 = dpx*dpx + dpy*dpy + dpz*dpz;
                                    if (dp2 >= thresh_ji2 || dp2 < 1e-16) continue;
                                    const dist = Math.sqrt(dp2);
                                    const mag  = contactRepulsion * (thresh_ji - dist) / dist;
                                    const ffx = dpx*mag, ffy = dpy*mag, ffz = dpz*mag;
                                    forces[j3]   += ffx; forces[j3+1] += ffy; forces[j3+2] += ffz;
                                    const rx = px-cxj, ry = py-cyj, rz = pz-czj;
                                    torques[j3]   += ry*ffz - rz*ffy;
                                    torques[j3+1] += rz*ffx - rx*ffz;
                                    torques[j3+2] += rx*ffy - ry*ffx;
                                    forces[i3]   -= ffx; forces[i3+1] -= ffy; forces[i3+2] -= ffz;
                                }
                            }
                        }
                    }
                }
            } else {
                // ── Fine-grained mode ─────────────────────────────────────────
                // Element-by-element pairwise contact within bounding-sphere broad phase.
                const eStartI = elemOffsets[i] * 3, eEndI = eStartI + elemCounts[i] * 3;
                for (let ddx = -1; ddx <= 1; ddx++) {
                    for (let ddy = -1; ddy <= 1; ddy++) {
                        for (let ddz = -1; ddz <= 1; ddz++) {
                            const neighbors = grid.get(cellKey(gcx+ddx, gcy+ddy, gcz+ddz));
                            if (!neighbors) continue;
                            for (let ni = 0; ni < neighbors.length; ni++) {
                                const j = neighbors[ni];
                                if (j <= i) continue;
                                const j3  = j * 3;
                                const cxj = workClusterPos[j3], cyj = workClusterPos[j3+1], czj = workClusterPos[j3+2];
                                const cdx = cxi-cxj, cdy2 = cyi-cyj, cdz2 = czi-czj;
                                const mcd = boundingRadii[i] + boundingRadii[j] + MIN_DIST;
                                if (cdx*cdx + cdy2*cdy2 + cdz2*cdz2 > mcd*mcd) continue;

                                const eStartJ = elemOffsets[j]*3, eEndJ = eStartJ + elemCounts[j]*3;
                                for (let ia = eStartI; ia < eEndI; ia += 3) {
                                    const ax = workElemPos[ia], ay = workElemPos[ia+1], az = workElemPos[ia+2];
                                    for (let ib = eStartJ; ib < eEndJ; ib += 3) {
                                        const dx = ax-workElemPos[ib], dy = ay-workElemPos[ib+1], dz = az-workElemPos[ib+2];
                                        const d2 = dx*dx + dy*dy + dz*dz;
                                        if (d2 >= dynMin2 || d2 < 1e-16) continue;
                                        const dist = Math.sqrt(d2);
                                        const mag  = contactRepulsion * (dynMin - dist) / dist;
                                        const ffx = dx*mag, ffy = dy*mag, ffz = dz*mag;
                                        forces[i3]   += ffx; forces[i3+1] += ffy; forces[i3+2] += ffz;
                                        const rAx = ax-cxi, rAy = ay-cyi, rAz = az-czi;
                                        torques[i3]   += rAy*ffz - rAz*ffy;
                                        torques[i3+1] += rAz*ffx - rAx*ffz;
                                        torques[i3+2] += rAx*ffy - rAy*ffx;
                                        forces[j3]   -= ffx; forces[j3+1] -= ffy; forces[j3+2] -= ffz;
                                        const rBx = workElemPos[ib]-cxj, rBy = workElemPos[ib+1]-cyj, rBz = workElemPos[ib+2]-czj;
                                        torques[j3]   -= rBy*ffz - rBz*ffy;
                                        torques[j3+1] -= rBz*ffx - rBx*ffz;
                                        torques[j3+2] -= rBx*ffy - rBy*ffx;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Electrostatic (Yukawa) repulsion between cluster centers — O(N²), N small
        if (electrostaticStrength > 0) {
            const invLambda = 1.0 / screeningLength;
            for (let i = 0; i < N; i++) {
                if (selectedMask[i]) continue;
                const i3 = i * 3;
                const cxi = workClusterPos[i3], cyi = workClusterPos[i3+1], czi = workClusterPos[i3+2];
                for (let j = i + 1; j < N; j++) {
                    const j3 = j * 3;
                    const dx = cxi - workClusterPos[j3];
                    const dy = cyi - workClusterPos[j3+1];
                    const dz = czi - workClusterPos[j3+2];
                    const r2 = dx*dx + dy*dy + dz*dz;
                    if (r2 < 1e-8) continue;
                    const r    = Math.sqrt(r2);
                    const invR = 1.0 / r;
                    // Yukawa force magnitude: A * exp(-r/λ) * (1/r² + 1/(r·λ))
                    const mag  = electrostaticStrength * Math.exp(-r * invLambda) * invR * (invR + invLambda);
                    const ffx  = dx * invR * mag, ffy = dy * invR * mag, ffz = dz * invR * mag;
                    forces[i3]   += ffx; forces[i3+1] += ffy; forces[i3+2] += ffz;
                    if (!selectedMask[j]) {
                        forces[j3]   -= ffx; forces[j3+1] -= ffy; forces[j3+2] -= ffz;
                    }
                }
            }
        }

        // Apply gradient step with stability clamping
        for (let i = 0; i < N; i++) {
            if (selectedMask[i]) continue;
            const i3 = i * 3;

            // Translation — clamp |Δx| ≤ MAX_TRANS
            const fx = forces[i3], fy = forces[i3+1], fz = forces[i3+2];
            const fMag = Math.sqrt(fx*fx + fy*fy + fz*fz);
            const tScale = (fMag * dt > MAX_TRANS) ? MAX_TRANS / (fMag * dt) : 1.0;
            const dx = fx*dt*tScale, dy = fy*dt*tScale, dz = fz*dt*tScale;

            netTrans[i3] += dx; netTrans[i3+1] += dy; netTrans[i3+2] += dz;
            workClusterPos[i3] += dx; workClusterPos[i3+1] += dy; workClusterPos[i3+2] += dz;

            const eStart = elemOffsets[i]*3, eEnd = eStart + elemCounts[i]*3;
            for (let ia = eStart; ia < eEnd; ia += 3) {
                workElemPos[ia] += dx; workElemPos[ia+1] += dy; workElemPos[ia+2] += dz;
            }
            const cStart = connOffsets[i], cEnd = cStart + connCounts[i];
            for (let c = cStart; c < cEnd; c++) {
                workConnFrom[c*3] += dx; workConnFrom[c*3+1] += dy; workConnFrom[c*3+2] += dz;
            }

            // Rotation — clamp |Δθ| ≤ MAX_ANGLE  (Rodrigues)
            const im   = inertiaMult[i];
            const aax  = torques[i3]*im, aay = torques[i3+1]*im, aaz = torques[i3+2]*im;
            const aaMag = Math.sqrt(aax*aax + aay*aay + aaz*aaz);
            const deltaAngle = Math.min(aaMag * dt, MAX_ANGLE);
            if (deltaAngle > 1e-8) {
                const inv  = 1.0 / aaMag;
                const ax = aax*inv, ay = aay*inv, az = aaz*inv;
                const cxi = workClusterPos[i3], cyi = workClusterPos[i3+1], czi = workClusterPos[i3+2];
                const cosT = Math.cos(deltaAngle), sinT = Math.sin(deltaAngle), omt = 1.0 - cosT;

                for (let ia = eStart; ia < eEnd; ia += 3) {
                    const rx = workElemPos[ia]-cxi, ry = workElemPos[ia+1]-cyi, rz = workElemPos[ia+2]-czi;
                    const dot = ax*rx + ay*ry + az*rz;
                    const cx2 = ay*rz-az*ry, cy2 = az*rx-ax*rz, cz2 = ax*ry-ay*rx;
                    workElemPos[ia]   = cxi + rx*cosT + cx2*sinT + ax*dot*omt;
                    workElemPos[ia+1] = cyi + ry*cosT + cy2*sinT + ay*dot*omt;
                    workElemPos[ia+2] = czi + rz*cosT + cz2*sinT + az*dot*omt;
                }
                for (let c = cStart; c < cEnd; c++) {
                    const rx = workConnFrom[c*3]-cxi, ry = workConnFrom[c*3+1]-cyi, rz = workConnFrom[c*3+2]-czi;
                    const dot = ax*rx + ay*ry + az*rz;
                    const cx2 = ay*rz-az*ry, cy2 = az*rx-ax*rz, cz2 = ax*ry-ay*rx;
                    workConnFrom[c*3]   = cxi + rx*cosT + cx2*sinT + ax*dot*omt;
                    workConnFrom[c*3+1] = cyi + ry*cosT + cy2*sinT + ay*dot*omt;
                    workConnFrom[c*3+2] = czi + rz*cosT + cz2*sinT + az*dot*omt;
                }

                // Compose net rotation quaternion: q_step * q_accumulated
                const sh = Math.sin(deltaAngle*0.5), ch = Math.cos(deltaAngle*0.5);
                const qx = ax*sh, qy = ay*sh, qz = az*sh, qw = ch;
                const ox = netQuat[i*4], oy = netQuat[i*4+1], oz = netQuat[i*4+2], ow = netQuat[i*4+3];
                netQuat[i*4]   = qw*ox + qx*ow + qy*oz - qz*oy;
                netQuat[i*4+1] = qw*oy - qx*oz + qy*ow + qz*ox;
                netQuat[i*4+2] = qw*oz + qx*oy - qy*ox + qz*ow;
                netQuat[i*4+3] = qw*ow - qx*ox - qy*oy - qz*oz;
            }
        }

        // ── Depenetration pass (fine-grained mode only) ───────────────────────
        // Soft contact forces alone can be overwhelmed by spring attraction,
        // allowing elements to tunnel through.  This pass directly projects
        // overlapping element pairs apart (position-based constraint), which
        // guarantees separation regardless of spring force magnitude.
        if (!sphereMode) {
            for (let i = 0; i < N; i++) {
                if (selectedMask[i]) continue;
                const i3 = i * 3;
                // Re-read i's position each outer iteration — it may have been
                // updated by a previous i-j depenetration within this pass.
                const cxi_d = workClusterPos[i3], cyi_d = workClusterPos[i3+1], czi_d = workClusterPos[i3+2];
                const gcx_d = Math.floor(cxi_d * invCell);
                const gcy_d = Math.floor(cyi_d * invCell);
                const gcz_d = Math.floor(czi_d * invCell);
                const eStartI = elemOffsets[i] * 3, eEndI = eStartI + elemCounts[i] * 3;

                for (let ddx = -1; ddx <= 1; ddx++) {
                    for (let ddy = -1; ddy <= 1; ddy++) {
                        for (let ddz = -1; ddz <= 1; ddz++) {
                            const neighbors = grid.get(cellKey(gcx_d+ddx, gcy_d+ddy, gcz_d+ddz));
                            if (!neighbors) continue;
                            for (let ni = 0; ni < neighbors.length; ni++) {
                                const j = neighbors[ni];
                                if (j <= i) continue;
                                const j3 = j * 3;

                                // Broad phase: bounding spheres
                                const cxi_c = workClusterPos[i3],   cyi_c = workClusterPos[i3+1],   czi_c = workClusterPos[i3+2];
                                const cxj_c = workClusterPos[j3],   cyj_c = workClusterPos[j3+1],   czj_c = workClusterPos[j3+2];
                                const bcdx = cxi_c-cxj_c, bcdy = cyi_c-cyj_c, bcdz = czi_c-czj_c;
                                const mcd = boundingRadii[i] + boundingRadii[j] + MIN_DIST;
                                if (bcdx*bcdx + bcdy*bcdy + bcdz*bcdz > mcd*mcd) continue;

                                const eStartJ = elemOffsets[j]*3, eEndJ = eStartJ + elemCounts[j]*3;

                                // Accumulate overlap correction vector for this cluster pair.
                                // Each overlapping element pair contributes a push along the
                                // separation axis scaled by the penetration depth.
                                let depx = 0, depy = 0, depz = 0, nDep = 0;
                                for (let ia = eStartI; ia < eEndI; ia += 3) {
                                    const ax = workElemPos[ia], ay = workElemPos[ia+1], az = workElemPos[ia+2];
                                    for (let ib = eStartJ; ib < eEndJ; ib += 3) {
                                        const dx = ax-workElemPos[ib], dy = ay-workElemPos[ib+1], dz = az-workElemPos[ib+2];
                                        const d2 = dx*dx + dy*dy + dz*dz;
                                        if (d2 >= MIN_DIST2 || d2 < 1e-16) continue;
                                        const dist = Math.sqrt(d2);
                                        const ov = (MIN_DIST - dist) / dist; // overlap / dist
                                        depx += dx*ov; depy += dy*ov; depz += dz*ov;
                                        nDep++;
                                    }
                                }
                                if (nDep === 0) continue;

                                // Split the correction equally between the two clusters.
                                // Clamp each half to MAX_TRANS to stay numerically stable.
                                let ipx = depx*0.5, ipy = depy*0.5, ipz = depz*0.5;
                                const iMag = Math.sqrt(ipx*ipx + ipy*ipy + ipz*ipz);
                                if (iMag > MAX_TRANS) { const s = MAX_TRANS/iMag; ipx*=s; ipy*=s; ipz*=s; }

                                let jpx = -depx*0.5, jpy = -depy*0.5, jpz = -depz*0.5;
                                const jMag = Math.sqrt(jpx*jpx + jpy*jpy + jpz*jpz);
                                if (jMag > MAX_TRANS) { const s = MAX_TRANS/jMag; jpx*=s; jpy*=s; jpz*=s; }

                                // Apply to cluster i
                                workClusterPos[i3]   += ipx; workClusterPos[i3+1] += ipy; workClusterPos[i3+2] += ipz;
                                for (let ia = eStartI; ia < eEndI; ia += 3) {
                                    workElemPos[ia]   += ipx; workElemPos[ia+1] += ipy; workElemPos[ia+2] += ipz;
                                }
                                const cSi = connOffsets[i], cEi = cSi + connCounts[i];
                                for (let c = cSi; c < cEi; c++) {
                                    workConnFrom[c*3] += ipx; workConnFrom[c*3+1] += ipy; workConnFrom[c*3+2] += ipz;
                                }
                                netTrans[i3] += ipx; netTrans[i3+1] += ipy; netTrans[i3+2] += ipz;

                                // Apply to cluster j (skip if user-selected)
                                if (!selectedMask[j]) {
                                    workClusterPos[j3]   += jpx; workClusterPos[j3+1] += jpy; workClusterPos[j3+2] += jpz;
                                    for (let ia = eStartJ; ia < eEndJ; ia += 3) {
                                        workElemPos[ia]   += jpx; workElemPos[ia+1] += jpy; workElemPos[ia+2] += jpz;
                                    }
                                    const cSj = connOffsets[j], cEj = cSj + connCounts[j];
                                    for (let c = cSj; c < cEj; c++) {
                                        workConnFrom[c*3] += jpx; workConnFrom[c*3+1] += jpy; workConnFrom[c*3+2] += jpz;
                                    }
                                    netTrans[j3] += jpx; netTrans[j3+1] += jpy; netTrans[j3+2] += jpz;
                                }
                            }
                        }
                    }
                }
            }
        }

        // Refresh connTo from updated element positions so the next step's
        // spring forces use current target positions, not positions from the
        // start of the batch.
        const nConns = connToGlobalIdx.length;
        for (let c = 0; c < nConns; c++) {
            const gi = connToGlobalIdx[c];
            if (gi < 0) continue;
            workConnTo[c*3]   = workElemPos[gi*3];
            workConnTo[c*3+1] = workElemPos[gi*3+1];
            workConnTo[c*3+2] = workElemPos[gi*3+2];
        }
    }

    // Return net transforms — copied (not transferred) so worker reuses the buffers
    self.postMessage({ netTrans, netQuat });
};

function cellKey(cx, cy, cz) {
    // String key avoids the 32-bit integer overflow that would collapse cz
    // into only 2 usable bits when using bitwise OR with large multipliers.
    return cx + ',' + cy + ',' + cz;
}
