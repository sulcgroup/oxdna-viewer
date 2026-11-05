/**
 * Fluctuation solver for elastic network models (ANM and ANMT), run as a web worker.
 *
 * The network's potential is the one oxDNA uses for proteins (ANMInteraction / DNANM / DNACT):
 *   springs:             k/2 (r - r0)^2
 *   bending (ANMT only): kb/2 [(r̂_pq·a1_p - a0)^2 + (r̂_qp·a1_q - b0)^2]
 *   torsion (ANMT only): kt/2 [(a1_p·a1_q - c0)^2 + (a3_p·a3_q - d0)^2]
 * with the equilibrium values taken from the current structure. At the reference structure every
 * residual is zero, so the Hessian is exactly sum(k g gᵀ) over the residual gradients g.
 *
 * Degrees of freedom are the particle positions and, for ANMT, an infinitesimal rotation of each
 * particle's a1/a3 frame. The rotations are eliminated with a Schur complement, leaving a 3N x 3N
 * position Hessian S(s) = s·A + C, where A holds the springs and C the bending/torsion terms.
 * The spring scale s is fitted so that the predicted mean square fluctuations match the target
 * (regressing the target on the prediction gives a slope of 1). With no angular terms this is the
 * usual ANM fit and needs a single solve.
 *
 * Inputs and the fitted scale are in oxDNA simulation units; fluctuations are returned in Å^2.
 */

interface FluctuationAngularTerms {
    p: number[];   // lower-index particle of each bonded pair
    q: number[];   // its backbone neighbour
    a1: number[];  // 3N, a1 vector of each particle
    a3: number[];  // 3N, a3 vector of each particle
    kb: number[];  // bending constant of each pair
    kt: number[];  // torsion constant of each pair
}

interface FluctuationRequest {
    coords: number[];     // 3N positions, simulation units
    p1: number[];         // spring endpoints
    p2: number[];
    ks: number[];         // spring constants, simulation units
    angular: FluctuationAngularTerms | null;
    temperature: number;  // K
    target: number[];     // target mean square fluctuations, Å^2
}

interface FluctuationResult {
    msf?: number[];       // fitted mean square fluctuations, Å^2
    scale?: number;       // factor to multiply all spring constants by
    iterations?: number;  // number of linear solves
    error?: string;
}

const FLUCT_SIM_LENGTH = 8.518;  // Å per simulation length unit

/** One residual's gradient, as dof indices and values. Positions are dofs 0..3N-1, rotations 3N.. */
interface FluctGradient { idx: number[]; val: number[]; }

function fluctCross(a: number[], b: number[]): number[] {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function fluctDot(a: number[], b: number[]): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function fluctVec(arr: number[], i: number): number[] {
    return [arr[3 * i], arr[3 * i + 1], arr[3 * i + 2]];
}

function fluctGradient(blocks: [number, number[]][]): FluctGradient {
    const g: FluctGradient = { idx: [], val: [] };
    blocks.forEach(([dof, v]) => {
        for (let d = 0; d < 3; d++) {
            g.idx.push(dof + d);
            g.val.push(v[d]);
        }
    });
    return g;
}

/** Residual gradients of the bending and torsion terms of one bonded pair, with their stiffness. */
function fluctAngularGradients(req: FluctuationRequest, t: number, thetaDof: Map<number, number>): [FluctGradient, number][] {
    const ang = req.angular;
    const p = ang.p[t], q = ang.q[t];
    const r = fluctVec(req.coords, q).map((x, d) => x - req.coords[3 * p + d]);
    const dist = Math.sqrt(fluctDot(r, r));
    const u = r.map(x => x / dist);
    const a1 = fluctVec(ang.a1, p), b1 = fluctVec(ang.a1, q);
    const a3 = fluctVec(ang.a3, p), b3 = fluctVec(ang.a3, q);
    // derivative of r̂·v with respect to the position of q: (v - (r̂·v) r̂) / |r|
    const perp = (v: number[]) => { const c = fluctDot(u, v); return v.map((x, d) => (x - c * u[d]) / dist); };
    const neg = (v: number[]) => v.map(x => -x);
    const xp = 3 * p, xq = 3 * q, tp = thetaDof.get(p), tq = thetaDof.get(q);
    const pa1 = perp(a1), pb1 = perp(b1);
    return [
        // r̂_pq·a1_p
        [fluctGradient([[xq, pa1], [xp, neg(pa1)], [tp, fluctCross(a1, u)]]), ang.kb[t]],
        // r̂_qp·a1_q
        [fluctGradient([[xq, neg(pb1)], [xp, pb1], [tq, fluctCross(u, b1)]]), ang.kb[t]],
        // a1_p·a1_q
        [fluctGradient([[tp, fluctCross(a1, b1)], [tq, fluctCross(b1, a1)]]), ang.kt[t]],
        // a3_p·a3_q
        [fluctGradient([[tp, fluctCross(a3, b3)], [tq, fluctCross(b3, a3)]]), ang.kt[t]],
    ];
}

/** Symmetric banded matrix (lower half stored) with an in-place Cholesky factorisation. */
class FluctBandMatrix {
    n: number;
    bw: number;
    data: Float64Array;

    constructor(n: number, bw: number) {
        this.n = n;
        this.bw = bw;
        this.data = new Float64Array(n * (bw + 1));
    }

    private at(i: number, j: number): number {  // j <= i, i - j <= bw
        return i * (this.bw + 1) + j - i + this.bw;
    }

    add(i: number, j: number, v: number) {
        if (j > i) [i, j] = [j, i];
        this.data[this.at(i, j)] += v;
    }

    get(i: number, j: number): number {
        return this.data[this.at(i, j)];
    }

    maxDiagonal(): number {
        let m = 0;
        for (let i = 0; i < this.n; i++) m = Math.max(m, this.get(i, i));
        return m;
    }

    cholesky(): boolean {
        for (let i = 0; i < this.n; i++) {
            for (let j = Math.max(0, i - this.bw); j <= i; j++) {
                let sum = this.data[this.at(i, j)];
                for (let k = Math.max(0, i - this.bw); k < j; k++) {
                    sum -= this.data[this.at(i, k)] * this.data[this.at(j, k)];
                }
                if (i == j) {
                    if (sum <= 0) return false;
                    this.data[this.at(i, i)] = Math.sqrt(sum);
                } else {
                    this.data[this.at(i, j)] = sum / this.data[this.at(j, j)];
                }
            }
        }
        return true;
    }

    /** Solves (L Lᵀ) x = b in place, after cholesky(). */
    solve(b: Float64Array) {
        for (let i = 0; i < this.n; i++) {
            let sum = b[i];
            for (let k = Math.max(0, i - this.bw); k < i; k++) sum -= this.data[this.at(i, k)] * b[k];
            b[i] = sum / this.data[this.at(i, i)];
        }
        for (let i = this.n - 1; i >= 0; i--) {
            let sum = b[i];
            for (let k = i + 1; k <= Math.min(this.n - 1, i + this.bw); k++) sum -= this.data[this.at(k, i)] * b[k];
            b[i] = sum / this.data[this.at(i, i)];
        }
    }
}

/** Orders the particles with rotational dofs along their chains, so that the rotation block is banded. */
function fluctThetaOrder(ang: FluctuationAngularTerms): number[] {
    const neighbours = new Map<number, number[]>();
    const link = (a: number, b: number) => {
        if (!neighbours.has(a)) neighbours.set(a, []);
        neighbours.get(a).push(b);
    };
    ang.p.forEach((p, t) => { link(p, ang.q[t]); link(ang.q[t], p); });
    const order: number[] = [];
    const seen = new Set<number>();
    const walk = (start: number) => {
        const stack = [start];
        while (stack.length > 0) {
            const v = stack.pop();
            if (seen.has(v)) continue;
            seen.add(v);
            order.push(v);
            neighbours.get(v).forEach(w => { if (!seen.has(w)) stack.push(w); });
        }
    };
    // start from chain ends first, then whatever is left (rings)
    const particles = Array.from(neighbours.keys()).sort((a, b) => a - b);
    particles.forEach(v => { if (neighbours.get(v).length < 2) walk(v); });
    particles.forEach(v => walk(v));
    return order;
}

/**
 * Bending/torsion contribution to the position Hessian, with the rotations eliminated:
 * C = Bxx - Bxθ Bθθ⁻¹ Bθx. Returned as a dense 3N x 3N matrix (row-major).
 */
function fluctAngularHessian(req: FluctuationRequest, n: number): Float64Array {
    const ang = req.angular;
    const order = fluctThetaOrder(ang);
    const thetaDof = new Map<number, number>();  // particle -> first rotational dof (offset by n)
    order.forEach((v, k) => thetaDof.set(v, n + 3 * k));
    const m = 3 * order.length;

    let bw = 2;
    ang.p.forEach((p, t) => { bw = Math.max(bw, Math.abs(thetaDof.get(p) - thetaDof.get(ang.q[t])) + 2); });
    const btt = new FluctBandMatrix(m, Math.min(bw, m - 1));
    const bxx = new Float64Array(n * n);
    const bxt: Map<number, number>[] = Array.from({ length: n }, () => new Map<number, number>());

    for (let t = 0; t < ang.p.length; t++) {
        fluctAngularGradients(req, t, thetaDof).forEach(([g, k]) => {
            if (k == 0) return;
            for (let a = 0; a < g.idx.length; a++) {
                for (let b = 0; b < g.idx.length; b++) {
                    const i = g.idx[a], j = g.idx[b], v = k * g.val[a] * g.val[b];
                    if (i < n && j < n) bxx[i * n + j] += v;
                    else if (i < n) bxt[i].set(j - n, (bxt[i].get(j - n) ?? 0) + v);
                    else if (j < n) continue;  // the transposed block is implied
                    else if (j <= i) btt.add(i - n, j - n, v);
                }
            }
        });
    }

    // Rotations that no term restrains have zero rows in both Bθθ and Bθx, so a tiny diagonal
    // shift leaves the Schur complement unchanged while making Bθθ invertible.
    const shift = 1e-10 * Math.max(btt.maxDiagonal(), 1e-30);
    for (let i = 0; i < m; i++) btt.add(i, i, shift);
    if (!btt.cholesky()) throw new Error("Bending/torsion Hessian is not positive definite");

    const rows = Array.from({ length: n }, (_, i) => i).filter(i => bxt[i].size > 0);
    const col = new Float64Array(m);
    rows.forEach(c => {
        col.fill(0);
        bxt[c].forEach((v, t) => { col[t] = v; });
        btt.solve(col);
        rows.forEach(r => {
            let sum = 0;
            bxt[r].forEach((v, t) => { sum += v * col[t]; });
            bxx[r * n + c] -= sum;
        });
    });
    return bxx;
}

/** Rigid-body modes of each connected component of the network, orthonormal, in position space. */
function fluctRigidModes(req: FluctuationRequest, N: number): { particles: number[], vec: Float64Array }[] {
    const parent = Array.from({ length: N }, (_, i) => i);
    const find = (i: number): number => { while (parent[i] != i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const union = (a: number, b: number) => { parent[find(a)] = find(b); };
    req.p1.forEach((p, l) => union(p, req.p2[l]));
    if (req.angular) req.angular.p.forEach((p, t) => union(p, req.angular.q[t]));

    const components = new Map<number, number[]>();
    for (let i = 0; i < N; i++) {
        const root = find(i);
        if (!components.has(root)) components.set(root, []);
        components.get(root).push(i);
    }

    const modes: { particles: number[], vec: Float64Array }[] = [];
    components.forEach(particles => {
        const size = particles.length;
        const com = [0, 1, 2].map(d => particles.reduce((s, i) => s + req.coords[3 * i + d], 0) / size);
        const scale = Math.sqrt(size) * Math.max(1, ...particles.map(i =>
            Math.hypot(...[0, 1, 2].map(d => req.coords[3 * i + d] - com[d]))));
        const basis: Float64Array[] = [];
        for (let mode = 0; mode < 6; mode++) {
            const v = new Float64Array(3 * size);
            particles.forEach((i, k) => {
                if (mode < 3) v[3 * k + mode] = 1;
                else {
                    const axis = [0, 0, 0];
                    axis[mode - 3] = 1;
                    const rel = [0, 1, 2].map(d => req.coords[3 * i + d] - com[d]);
                    fluctCross(axis, rel).forEach((x, d) => { v[3 * k + d] = x; });
                }
            });
            basis.forEach(b => {
                let c = 0;
                for (let k = 0; k < v.length; k++) c += v[k] * b[k];
                for (let k = 0; k < v.length; k++) v[k] -= c * b[k];
            });
            let norm = 0;
            for (let k = 0; k < v.length; k++) norm += v[k] * v[k];
            norm = Math.sqrt(norm);
            if (norm < 1e-8 * scale) continue;  // e.g. rotation about the axis of a straight component
            for (let k = 0; k < v.length; k++) v[k] /= norm;
            basis.push(v);
        }
        basis.forEach(vec => modes.push({ particles, vec }));
    });
    return modes;
}

/**
 * Diagonal of the inverse of a symmetric positive definite matrix (row-major, upper half used).
 * The matrix is overwritten. Returns null if it isn't positive definite.
 */
function fluctInverseDiagonal(mat: Float64Array, n: number): Float64Array {
    let maxDiag = 0;
    for (let i = 0; i < n; i++) maxDiag = Math.max(maxDiag, mat[i * n + i]);

    // right-looking Cholesky, mat = UᵀU with U stored in the upper triangle
    for (let k = 0; k < n; k++) {
        const pivot = mat[k * n + k];
        if (!(pivot > 1e-12 * maxDiag)) return null;
        const ukk = Math.sqrt(pivot);
        const rowK = k * n;
        mat[rowK + k] = ukk;
        for (let j = k + 1; j < n; j++) mat[rowK + j] /= ukk;
        for (let i = k + 1; i < n; i++) {
            const uki = mat[rowK + i];
            if (uki == 0) continue;
            const rowI = i * n;
            for (let j = i; j < n; j++) mat[rowI + j] -= uki * mat[rowK + j];
        }
    }

    // rows of W = L⁻¹ (L = Uᵀ); diag(mat⁻¹)_j = sum_i W_ij²
    const diag = new Float64Array(n);
    const w = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        w[i] = 1 / mat[i * n + i];
        diag[i] += w[i] * w[i];
        for (let j = i - 1; j >= 0; j--) {
            const rowJ = j * n;
            let sum = 0;
            for (let k = j + 1; k <= i; k++) sum += w[k] * mat[rowJ + k];
            w[j] = -sum / mat[rowJ + j];
            diag[j] += w[j] * w[j];
        }
    }
    return diag;
}

/** Mean square fluctuations (Å^2) of the network with all springs multiplied by `scale`. */
function fluctMsf(req: FluctuationRequest, scale: number, angularHessian: Float64Array,
                  modes: { particles: number[], vec: Float64Array }[]): number[] {
    const N = req.coords.length / 3, n = 3 * N;
    const mat = angularHessian ? angularHessian.slice() : new Float64Array(n * n);

    for (let l = 0; l < req.p1.length; l++) {
        const i = req.p1[l], j = req.p2[l], k = scale * req.ks[l];
        const r = fluctVec(req.coords, j).map((x, d) => x - req.coords[3 * i + d]);
        const r2 = fluctDot(r, r);
        for (let a = 0; a < 3; a++) {
            for (let b = 0; b < 3; b++) {
                const v = k * r[a] * r[b] / r2;
                mat[(3 * i + a) * n + 3 * i + b] += v;
                mat[(3 * j + a) * n + 3 * j + b] += v;
                mat[(3 * i + a) * n + 3 * j + b] -= v;
                mat[(3 * j + a) * n + 3 * i + b] -= v;
            }
        }
    }

    // Lift the rigid-body zero modes with a penalty c·vvᵀ, and subtract their 1/c afterwards.
    let c = 0;
    for (let i = 0; i < n; i++) c += mat[i * n + i];
    c = c > 0 ? c / n : 1;
    modes.forEach(({ particles, vec }) => {
        particles.forEach((pi, a) => {
            for (let da = 0; da < 3; da++) {
                const row = (3 * pi + da) * n, va = c * vec[3 * a + da];
                if (va == 0) continue;
                particles.forEach((pj, b) => {
                    for (let db = 0; db < 3; db++) mat[row + 3 * pj + db] += va * vec[3 * b + db];
                });
            }
        });
    });

    const diag = fluctInverseDiagonal(mat, n);
    if (diag === null) {
        throw new Error("The network is underconstrained: some particles can move without stretching any spring. " +
            "Increase the cutoff, or use ANMT to restrain the backbone.");
    }
    modes.forEach(({ particles, vec }) => {
        particles.forEach((pi, a) => {
            for (let d = 0; d < 3; d++) diag[3 * pi + d] -= vec[3 * a + d] ** 2 / c;
        });
    });

    const kT = req.temperature / 3000;  // simulation energy units
    const msf: number[] = [];
    for (let i = 0; i < N; i++) {
        msf.push(kT * (diag[3 * i] + diag[3 * i + 1] + diag[3 * i + 2]) * FLUCT_SIM_LENGTH ** 2);
    }
    return msf;
}

/** Slope of the least-squares line target = m·msf (no intercept). */
function fluctSlope(msf: number[], target: number[]): number {
    let xy = 0, xx = 0;
    msf.forEach((x, i) => { xy += x * target[i]; xx += x * x; });
    return xy / xx;
}

function solveFluctuations(req: FluctuationRequest): FluctuationResult {
    const N = req.coords.length / 3;
    const hasAngular = req.angular !== null && req.angular.p.length > 0;
    const angularHessian = hasAngular ? fluctAngularHessian(req, 3 * N) : null;
    const modes = fluctRigidModes(req, N);

    let u0 = 0;  // log of the spring scale
    let msf0 = fluctMsf(req, 1, angularHessian, modes);
    let g0 = Math.log(fluctSlope(msf0, req.target));
    if (!isFinite(g0)) throw new Error("Could not fit the network to the target data");

    if (!hasAngular) {
        // msf is exactly proportional to 1/scale
        const scale = Math.exp(-g0);
        return { msf: msf0.map(x => x / scale), scale, iterations: 1 };
    }

    // ANMT: solve log(slope(log scale)) = 0, which increases with the scale (secant with bracketing)
    let u1 = u0 - g0;
    let lo: [number, number] = null, hi: [number, number] = null;  // [u, g] with g < 0 and g > 0
    const bracket = (u: number, g: number) => {
        if (g < 0 && (lo === null || u > lo[0])) lo = [u, g];
        if (g > 0 && (hi === null || u < hi[0])) hi = [u, g];
    };
    bracket(u0, g0);
    for (let it = 2; it <= 40; it++) {
        if (u1 < Math.log(1e-8)) {
            throw new Error("The bending and torsion terms alone are stiffer than the target fluctuations. " +
                "Lower the bending and torsion constants.");
        }
        if (u1 > Math.log(1e8)) throw new Error("Could not fit the network to the target data");
        const msf1 = fluctMsf(req, Math.exp(u1), angularHessian, modes);
        const g1 = Math.log(fluctSlope(msf1, req.target));
        if (!isFinite(g1)) throw new Error("Could not fit the network to the target data");
        if (Math.abs(g1) < 1e-5) return { msf: msf1, scale: Math.exp(u1), iterations: it };
        bracket(u1, g1);

        let next = g1 != g0 ? u1 - g1 * (u1 - u0) / (g1 - g0) : u1 - g1;
        if (lo !== null && hi !== null) {
            if (!(next > lo[0] && next < hi[0])) next = (lo[0] + hi[0]) / 2;
        } else {
            next = Math.max(u1 - 5, Math.min(u1 + 5, next));  // don't jump more than e^5 at once
        }
        [u0, g0, u1] = [u1, g1, next];
    }
    throw new Error("Fitting did not converge");
}

if (typeof self !== 'undefined' && typeof window === 'undefined') {
    self.onmessage = (e: MessageEvent<FluctuationRequest>) => {
        let result: FluctuationResult;
        try {
            result = solveFluctuations(e.data);
        } catch (err) {
            result = { error: err instanceof Error ? err.message : String(err) };
        }
        postMessage(result, undefined);
    };
}
