'use strict';
// Web worker: computes per-cluster forces and torques for the RBD gradient-
// descent simulator.  Runs entirely off the main thread so the UI stays
// responsive even for large, dense systems.

const ELEMENT_COLLIDER_RADIUS = 0.5;
const MIN_DIST  = 2 * ELEMENT_COLLIDER_RADIUS;
const MIN_DIST2 = MIN_DIST * MIN_DIST;

// Static topology — sent once at init, never changes during a simulation run.
let N = 0;
let boundingRadii, elemOffsets, elemCounts, connOffsets, connCounts;

self.onmessage = function(e) {
    const msg = e.data;

    // ── Initialisation ────────────────────────────────────────────────────────
    if (msg.type === 'init') {
        N             = msg.N;
        boundingRadii = msg.boundingRadii;
        elemOffsets   = msg.elemOffsets;
        elemCounts    = msg.elemCounts;
        connOffsets   = msg.connOffsets;
        connCounts    = msg.connCounts;
        return;
    }

    // ── Per-step force computation ────────────────────────────────────────────
    if (msg.type === 'step') {
        const { clusterPos, elemPos, connFrom, connTo, selectedMask, params } = msg;
        const { contactRepulsion, springK, relaxed, maxForce } = params;

        const forces  = new Float32Array(N * 3);
        const torques = new Float32Array(N * 3);

        for (let i = 0; i < N; i++) {
            if (selectedMask[i]) continue;

            const cxi = clusterPos[i*3], cyi = clusterPos[i*3+1], czi = clusterPos[i*3+2];

            // ── Spring / bond forces ──────────────────────────────────────────
            const cStart = connOffsets[i], cEnd = cStart + connCounts[i];
            for (let c = cStart; c < cEnd; c++) {
                const c3 = c * 3;
                const fx0 = connFrom[c3],   fy0 = connFrom[c3+1], fz0 = connFrom[c3+2];
                const dx  = connTo[c3]-fx0, dy  = connTo[c3+1]-fy0, dz = connTo[c3+2]-fz0;
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                const ext  = dist - relaxed;
                if (ext <= 0 || dist < 1e-8) continue;
                const s = Math.min(springK * ext, maxForce) / dist;
                const ffx = dx*s, ffy = dy*s, ffz = dz*s;
                forces[i*3]   += ffx; forces[i*3+1] += ffy; forces[i*3+2] += ffz;
                const rx = fx0-cxi, ry = fy0-cyi, rz = fz0-czi;
                torques[i*3]   += ry*ffz - rz*ffy;
                torques[i*3+1] += rz*ffx - rx*ffz;
                torques[i*3+2] += rx*ffy - ry*ffx;
            }

            // ── Contact repulsion (upper-triangle pairs only) ─────────────────
            const eStartI = elemOffsets[i] * 3;
            const eEndI   = eStartI + elemCounts[i] * 3;

            for (let j = i + 1; j < N; j++) {
                if (selectedMask[j]) continue;

                // Broad-phase bounding-sphere cull
                const j3 = j * 3;
                const cdx = cxi - clusterPos[j3], cdy = cyi - clusterPos[j3+1], cdz = czi - clusterPos[j3+2];
                const mcd = boundingRadii[i] + boundingRadii[j] + MIN_DIST;
                if (cdx*cdx + cdy*cdy + cdz*cdz > mcd*mcd) continue;

                const cxj = clusterPos[j3], cyj = clusterPos[j3+1], czj = clusterPos[j3+2];
                const eStartJ = elemOffsets[j] * 3;
                const eEndJ   = eStartJ + elemCounts[j] * 3;

                for (let ia = eStartI; ia < eEndI; ia += 3) {
                    const ax = elemPos[ia], ay = elemPos[ia+1], az = elemPos[ia+2];
                    for (let ib = eStartJ; ib < eEndJ; ib += 3) {
                        const dx = ax - elemPos[ib];
                        const dy = ay - elemPos[ib+1];
                        const dz = az - elemPos[ib+2];
                        const d2 = dx*dx + dy*dy + dz*dz;
                        if (d2 >= MIN_DIST2 || d2 < 1e-16) continue;

                        const dist = Math.sqrt(d2);
                        const mag  = contactRepulsion * (MIN_DIST - dist) / dist;
                        const ffx = dx*mag, ffy = dy*mag, ffz = dz*mag;

                        forces[i*3]   += ffx; forces[i*3+1] += ffy; forces[i*3+2] += ffz;
                        const rAx = ax-cxi, rAy = ay-cyi, rAz = az-czi;
                        torques[i*3]   += rAy*ffz - rAz*ffy;
                        torques[i*3+1] += rAz*ffx - rAx*ffz;
                        torques[i*3+2] += rAx*ffy - rAy*ffx;

                        forces[j3]   -= ffx; forces[j3+1] -= ffy; forces[j3+2] -= ffz;
                        const rBx = elemPos[ib]-cxj, rBy = elemPos[ib+1]-cyj, rBz = elemPos[ib+2]-czj;
                        torques[j3]   += rBy*(-ffz) - rBz*(-ffy);
                        torques[j3+1] += rBz*(-ffx) - rBx*(-ffz);
                        torques[j3+2] += rBx*(-ffy) - rBy*(-ffx);
                    }
                }
            }
        }

        // Transfer ownership of result buffers — zero-copy back to main thread
        self.postMessage({ forces, torques }, [forces.buffer, torques.buffer]);
    }
};
