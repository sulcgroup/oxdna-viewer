'use strict';
// Web worker: gradient-descent force computation + integration for RBD simulator.
//
// Runs K gradient-descent steps internally per call so the main thread only
// needs to apply one composed transform (translate + rotate) per cluster per
// worker result, instead of K separate updateElements calls.
//
// Stability: each step clamps |Δx| ≤ MAX_TRANS and |Δθ| ≤ MAX_ANGLE so
// large accumulated forces can't overshoot regardless of system size or dt.

const ELEMENT_COLLIDER_RADIUS = 0.5;
const MIN_DIST  = 2 * ELEMENT_COLLIDER_RADIUS;
const MIN_DIST2 = MIN_DIST * MIN_DIST;
const MAX_TRANS = ELEMENT_COLLIDER_RADIUS;       // max displacement per step (oxDNA units)
const MAX_ANGLE = 0.15;                          // max rotation per step (radians)

// Static topology — sent once at init
let N = 0;
let boundingRadii, elemOffsets, elemCounts, connOffsets, connCounts;
let inertiaMult;        // Float32Array [N]  — 1 / (2/5 * boundingRadius²)
let connToGlobalIdx;    // Int32Array [totalConns] — flat elemPos index for each connTo endpoint
let CELL_SIZE = 1.0;

// Persistent working position arrays — allocated once, never GC'd
let workElemPos    = null;
let workClusterPos = null;
let workConnFrom   = null;
let workConnTo     = null;

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
        return;
    }

    if (msg.type !== 'step') return;

    const { clusterPos, elemPos, connFrom, connTo, selectedMask, params } = msg;
    const { contactRepulsion, springK, relaxed, maxForce, dt, stepsPerCall } = params;
    const K = stepsPerCall | 0 || 4;

    // Copy incoming positions into persistent working arrays
    if (!workElemPos || workElemPos.length !== elemPos.length) {
        workElemPos    = new Float32Array(elemPos.length);
        workClusterPos = new Float32Array(clusterPos.length);
        workConnFrom   = new Float32Array(connFrom.length);
        workConnTo     = new Float32Array(connTo.length);
    }
    workElemPos.set(elemPos);
    workClusterPos.set(clusterPos);
    workConnFrom.set(connFrom);
    workConnTo.set(connTo);

    // Per-cluster net transforms (accumulated over K steps)
    const netTrans = new Float32Array(N * 3);
    const netQuat  = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) netQuat[i*4+3] = 1.0; // identity quaternion

    // Temporary force/torque arrays — reused each step
    const forces  = new Float32Array(N * 3);
    const torques = new Float32Array(N * 3);

    const invCell = 1.0 / CELL_SIZE;

    for (let step = 0; step < K; step++) {
        forces.fill(0);
        torques.fill(0);

        // ── Build spatial hash ────────────────────────────────────────────────
        const grid = new Map();
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

        // ── Force accumulation ────────────────────────────────────────────────
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
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                const ext  = dist - relaxed;
                if (ext <= 0 || dist < 1e-8) continue;
                const s = Math.min(springK * ext, maxForce) / dist;
                const ffx = dx*s, ffy = dy*s, ffz = dz*s;
                forces[i3]   += ffx; forces[i3+1] += ffy; forces[i3+2] += ffz;
                const rx = fx0-cxi, ry = fy0-cyi, rz = fz0-czi;
                torques[i3]   += ry*ffz - rz*ffy;
                torques[i3+1] += rz*ffx - rx*ffz;
                torques[i3+2] += rx*ffy - ry*ffx;
            }

            // Contact repulsion — spatial hash neighbour lookup
            const gcx = Math.floor(cxi * invCell);
            const gcy = Math.floor(cyi * invCell);
            const gcz = Math.floor(czi * invCell);
            const eStartI = elemOffsets[i] * 3;
            const eEndI   = eStartI + elemCounts[i] * 3;

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

                            const eStartJ = elemOffsets[j] * 3;
                            const eEndJ   = eStartJ + elemCounts[j] * 3;

                            for (let ia = eStartI; ia < eEndI; ia += 3) {
                                const ax = workElemPos[ia], ay = workElemPos[ia+1], az = workElemPos[ia+2];
                                for (let ib = eStartJ; ib < eEndJ; ib += 3) {
                                    const dx = ax - workElemPos[ib];
                                    const dy = ay - workElemPos[ib+1];
                                    const dz = az - workElemPos[ib+2];
                                    const d2 = dx*dx + dy*dy + dz*dz;
                                    if (d2 >= MIN_DIST2 || d2 < 1e-16) continue;
                                    const dist = Math.sqrt(d2);
                                    const mag  = contactRepulsion * (MIN_DIST - dist) / dist;
                                    const ffx = dx*mag, ffy = dy*mag, ffz = dz*mag;
                                    forces[i3]   += ffx; forces[i3+1] += ffy; forces[i3+2] += ffz;
                                    const rAx = ax-cxi, rAy = ay-cyi, rAz = az-czi;
                                    torques[i3]   += rAy*ffz - rAz*ffy;
                                    torques[i3+1] += rAz*ffx - rAx*ffz;
                                    torques[i3+2] += rAx*ffy - rAy*ffx;
                                    forces[j3]   -= ffx; forces[j3+1] -= ffy; forces[j3+2] -= ffz;
                                    const rBx = workElemPos[ib]-cxj, rBy = workElemPos[ib+1]-cyj, rBz = workElemPos[ib+2]-czj;
                                    torques[j3]   += rBy*(-ffz) - rBz*(-ffy);
                                    torques[j3+1] += rBz*(-ffx) - rBx*(-ffz);
                                    torques[j3+2] += rBx*(-ffy) - rBy*(-ffx);
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── Apply gradient step to working positions ──────────────────────────
        for (let i = 0; i < N; i++) {
            if (selectedMask[i]) continue;

            const i3 = i * 3;

            // Translation — clamp so |Δx| ≤ MAX_TRANS
            const fx = forces[i3], fy = forces[i3+1], fz = forces[i3+2];
            const fMag = Math.sqrt(fx*fx + fy*fy + fz*fz);
            const rawTrans = fMag * dt;
            const tScale   = rawTrans > MAX_TRANS ? MAX_TRANS / rawTrans : 1.0;
            const dx = fx * dt * tScale, dy = fy * dt * tScale, dz = fz * dt * tScale;

            netTrans[i3] += dx; netTrans[i3+1] += dy; netTrans[i3+2] += dz;
            workClusterPos[i3] += dx; workClusterPos[i3+1] += dy; workClusterPos[i3+2] += dz;

            const eStart = elemOffsets[i] * 3, eEnd = eStart + elemCounts[i] * 3;
            for (let ia = eStart; ia < eEnd; ia += 3) {
                workElemPos[ia] += dx; workElemPos[ia+1] += dy; workElemPos[ia+2] += dz;
            }
            const csEnd2 = connOffsets[i] + connCounts[i];
            for (let c = connOffsets[i]; c < csEnd2; c++) {
                workConnFrom[c*3] += dx; workConnFrom[c*3+1] += dy; workConnFrom[c*3+2] += dz;
            }

            // Rotation — clamp so |Δθ| ≤ MAX_ANGLE
            const im   = inertiaMult[i];
            const taux = torques[i3], tauy = torques[i3+1], tauz = torques[i3+2];
            const aax  = taux * im, aay = tauy * im, aaz = tauz * im;
            const aaMag = Math.sqrt(aax*aax + aay*aay + aaz*aaz);
            const deltaAngle = Math.min(aaMag * dt, MAX_ANGLE);

            if (deltaAngle > 1e-8) {
                const inv   = 1.0 / aaMag;
                const ax = aax*inv, ay = aay*inv, az = aaz*inv;
                const cxi = workClusterPos[i3], cyi = workClusterPos[i3+1], czi = workClusterPos[i3+2];
                const cosT = Math.cos(deltaAngle), sinT = Math.sin(deltaAngle), omt = 1.0 - cosT;

                // Rodrigues rotation for all elements in cluster i
                for (let ia = eStart; ia < eEnd; ia += 3) {
                    const rx = workElemPos[ia]-cxi, ry = workElemPos[ia+1]-cyi, rz = workElemPos[ia+2]-czi;
                    const dot = ax*rx + ay*ry + az*rz;
                    const cx2 = ay*rz - az*ry, cy2 = az*rx - ax*rz, cz2 = ax*ry - ay*rx;
                    workElemPos[ia]   = cxi + rx*cosT + cx2*sinT + ax*dot*omt;
                    workElemPos[ia+1] = cyi + ry*cosT + cy2*sinT + ay*dot*omt;
                    workElemPos[ia+2] = czi + rz*cosT + cz2*sinT + az*dot*omt;
                }

                // Same for connFrom endpoints belonging to cluster i
                for (let c = connOffsets[i]; c < csEnd2; c++) {
                    const rx = workConnFrom[c*3]-cxi, ry = workConnFrom[c*3+1]-cyi, rz = workConnFrom[c*3+2]-czi;
                    const dot = ax*rx + ay*ry + az*rz;
                    const cx2 = ay*rz - az*ry, cy2 = az*rx - ax*rz, cz2 = ax*ry - ay*rx;
                    workConnFrom[c*3]   = cxi + rx*cosT + cx2*sinT + ax*dot*omt;
                    workConnFrom[c*3+1] = cyi + ry*cosT + cy2*sinT + ay*dot*omt;
                    workConnFrom[c*3+2] = czi + rz*cosT + cz2*sinT + az*dot*omt;
                }

                // Compose net quaternion: q_new * q_accumulated
                const sh = Math.sin(deltaAngle * 0.5), ch = Math.cos(deltaAngle * 0.5);
                const qx = ax*sh, qy = ay*sh, qz = az*sh, qw = ch;
                const ox = netQuat[i*4], oy = netQuat[i*4+1], oz = netQuat[i*4+2], ow = netQuat[i*4+3];
                netQuat[i*4]   = qw*ox + qx*ow + qy*oz - qz*oy;
                netQuat[i*4+1] = qw*oy - qx*oz + qy*ow + qz*ox;
                netQuat[i*4+2] = qw*oz + qx*oy - qy*ox + qz*ow;
                netQuat[i*4+3] = qw*ow - qx*ox - qy*oy - qz*oz;
            }
        }

        // Update connTo positions from the now-updated workElemPos
        const totalConns = connToGlobalIdx.length;
        for (let c = 0; c < totalConns; c++) {
            const gi = connToGlobalIdx[c];
            if (gi < 0) continue; // to-element not in simulation
            const gi3 = gi * 3, c3 = c * 3;
            workConnTo[c3]   = workElemPos[gi3];
            workConnTo[c3+1] = workElemPos[gi3+1];
            workConnTo[c3+2] = workElemPos[gi3+2];
        }
    }

    // Return net transforms + recycle position input buffers (zero-copy)
    self.postMessage(
        { netTrans, netQuat, clusterPos, elemPos, connFrom, connTo },
        [netTrans.buffer, netQuat.buffer,
         clusterPos.buffer, elemPos.buffer, connFrom.buffer, connTo.buffer]
    );
};

// Bit-packed integer cell key — avoids string allocation in the hot build loop.
// Covers ±16383 cells per axis (sufficient for any realistic simulation volume).
function cellKey(cx, cy, cz) {
    return ((cx & 0x7FFF)) | ((cy & 0x7FFF) * 32768) | ((cz & 0x7FFF) * 1073741824);
}
