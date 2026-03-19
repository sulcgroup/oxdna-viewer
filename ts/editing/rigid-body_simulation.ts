// RAPIER physics engine is loaded globally via ts/lib/rapier_init.mjs
declare const RAPIER: any;

let rigidClusterSimulator: RigidClusterSimulator;
let standaloneColliderViz: ColliderVisualizer | null = null;

function toggleClusterSim() {
    if (!view.getInputBool("clusterSim")) {
        // Stop immediately — don't wait for the RAF loop.
        if (rigidClusterSimulator) {
            editHistory.add(new RevertableClusterSim(rigidClusterSimulator.getClusters()));
            rigidClusterSimulator.dispose();
            rigidClusterSimulator = null;
            if (view.getInputBool('rbd_showColliders')) {
                const clustered = [...elements.values()].filter(e => e.clusterId >= 0);
                if (clustered.length > 0) standaloneColliderViz = new ColliderVisualizer(clustered);
            }
        }
        return;
    }

    // Discard any existing simulator (handles re-enable without re-checking race).
    if (rigidClusterSimulator) {
        rigidClusterSimulator.dispose();
        rigidClusterSimulator = null;
    }
    if (standaloneColliderViz) { standaloneColliderViz.dispose(); standaloneColliderViz = null; }

    if (typeof RAPIER === 'undefined') {
        notify("Rapier physics engine not ready yet – please try again in a moment.");
        document.getElementById("clusterSim")["checked"] = false;
        return;
    }
    rigidClusterSimulator = new RigidClusterSimulator();
    if (rigidClusterSimulator.getNumberOfClusters() < 2) {
        notify("Please create at least 2 clusters");
        view.toggleWindow("clusteringWindow");
        document.getElementById("clusterSim")["checked"] = false;
        rigidClusterSimulator.dispose();
        rigidClusterSimulator = null;
        return;
    }
    if (view.getInputBool('rbd_showColliders')) {
        rigidClusterSimulator.enableColliderViz();
    }
    rigidClusterSimulator.simulate();
}

/**
 * Single source of truth for collider visualisation state.
 * Called by both toggles so ordering never matters.
 *
 * Sim running:
 *   sphereMode ON              → sphere viz (bounding sphere + conn-point spheres)
 *   showColliders ON           → element viz (one sphere per nucleotide)
 *   sphereMode ON + showColliders ON → sphere viz (sphere mode takes priority)
 *   both OFF                   → no viz
 *
 * Sim not running (standalone):
 *   showColliders ON, sphereMode OFF → element viz (cluster objects unavailable for sphere mode)
 *   otherwise                        → no viz
 */
function syncColliderViz() {
    const sphereMode    = view.getInputBool('rbd_sphereMode');
    const showColliders = view.getInputBool('rbd_showColliders');

    if (rigidClusterSimulator) {
        const wantViz  = sphereMode || showColliders;
        const wantMode = sphereMode ? 'sphere' : 'element';
        const curMode  = rigidClusterSimulator.colliderVizMode();

        if (!wantViz) {
            // Turn off: destroy whatever is active.
            rigidClusterSimulator.disableColliderViz();
        } else if (curMode !== wantMode) {
            // Type mismatch: destroy old, create correct type.
            rigidClusterSimulator.disableColliderViz();
            rigidClusterSimulator.enableColliderViz();
        }
        // curMode === wantMode: correct viz already live, leave it alone.
        render();
        return;
    }

    // No simulation running — standalone element viz only (sphere mode needs Cluster objects).
    if (standaloneColliderViz) { standaloneColliderViz.dispose(); standaloneColliderViz = null; }
    if (showColliders && !sphereMode) {
        const clustered = [...elements.values()].filter(e => e.clusterId >= 0);
        if (clustered.length > 0) standaloneColliderViz = new ColliderVisualizer(clustered);
    }
    render();
}

function toggleRbdSphereMode() { syncColliderViz(); }
function toggleColliderViz()    { syncColliderViz(); }

// http://www.cs.cmu.edu/~baraff/sigcourse/notesd1.pdf

// Module-level scratch objects — reused every frame, never allocated in hot path
const _rbdVec  = new THREE.Vector3();
const _rbdQuat = new THREE.Quaternion();

/**
 * Gradient-descent rigid-body cluster simulator.
 *
 * Performance design:
 *  • Worker owns all position state. Positions are sent once at init; thereafter
 *    only selected-cluster positions are sent (sparse update). For the common
 *    no-selection case: zero position data transferred per frame.
 *  • Worker runs K=4 steps per call, returning one composed (netTrans, netQuat)
 *    per cluster → one translateElements + rotateElements per cluster per frame.
 *  • world.step() is skipped when the collider visualiser is inactive.
 *  • No heap allocation on the main thread hot path (scratch objects reused).
 */
class RigidClusterSimulator {
    private clusters: Cluster[] = [];
    private world: any;
    private viz: ColliderVisualizer | SphereClusterColliderVisualizer | null = null;

    private worker: Worker;
    private workerBusy = false;
    private pendingNetTrans: Float32Array | null = null;
    private pendingNetQuat:  Float32Array | null = null;

    // Static topology layout
    private elemOffsets: Int32Array;
    private elemCounts:  Int32Array;
    private connOffsets: Int32Array;
    private connCounts:  Int32Array;
    private totalElems:  number;
    private totalConns:  number;

    constructor() {
        this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
        this.world.timestep = view.getInputNumber('rbd_dt');

        const m = new Map<number, Set<BasicElement>>();
        elements.forEach(e => {
            const c = e.clusterId;
            if (c < 0) return;
            if (!m.has(c)) m.set(c, new Set());
            m.get(c).add(e);
        });
        m.forEach(clusterElements => this.clusters.push(new Cluster(clusterElements, this)));

        const N = this.clusters.length;

        // Compute flat topology layout
        this.elemOffsets = new Int32Array(N);
        this.elemCounts  = new Int32Array(N);
        this.connOffsets = new Int32Array(N);
        this.connCounts  = new Int32Array(N);
        let eo = 0, co = 0;
        this.clusters.forEach((c, i) => {
            this.elemOffsets[i] = eo; this.elemCounts[i] = c.elements.length; eo += c.elements.length;
            this.connOffsets[i] = co; this.connCounts[i] = c.conPoints.length; co += c.conPoints.length;
        });
        this.totalElems = eo;
        this.totalConns = co;

        // Global element index for each element (its position in the flat elemPos array)
        const elemGlobalIdx = new Map<BasicElement, number>();
        let gi = 0;
        this.clusters.forEach(c => c.elements.forEach(e => elemGlobalIdx.set(e, gi++)));

        // connToGlobalIdx[c] = flat elemPos index of the "to" endpoint for connection c
        const connToGlobalIdx = new Int32Array(this.totalConns);
        let ci = 0;
        this.clusters.forEach(c =>
            c.conPoints.forEach(cp => {
                connToGlobalIdx[ci++] = elemGlobalIdx.has(cp.to) ? elemGlobalIdx.get(cp.to) : -1;
            })
        );

        // Static per-cluster properties
        const inertiaMult   = new Float32Array(N);
        const boundingRadii = new Float32Array(N);
        this.clusters.forEach((c, i) => { inertiaMult[i] = c.inertiaMult; boundingRadii[i] = c.boundingRadius; });

        // Pack initial positions — transferred to worker once, never sent again
        const initialElemPos    = new Float32Array(this.totalElems * 3);
        const initialClusterPos = new Float32Array(N * 3);
        const initialConnFrom   = new Float32Array(this.totalConns * 3);
        const initialConnTo     = new Float32Array(this.totalConns * 3);
        let ei2 = 0, ci2 = 0;
        this.clusters.forEach((c, i) => {
            const p = c.position;
            initialClusterPos[i*3] = p.x; initialClusterPos[i*3+1] = p.y; initialClusterPos[i*3+2] = p.z;
            for (const e of c.elements) {
                const ep = e.getPos();
                initialElemPos[ei2*3] = ep.x; initialElemPos[ei2*3+1] = ep.y; initialElemPos[ei2*3+2] = ep.z;
                ei2++;
            }
            for (const cp of c.conPoints) {
                const from = cp.from.getPos(), to = cp.to.getPos();
                initialConnFrom[ci2*3] = from.x; initialConnFrom[ci2*3+1] = from.y; initialConnFrom[ci2*3+2] = from.z;
                initialConnTo[ci2*3]   = to.x;   initialConnTo[ci2*3+1]   = to.y;   initialConnTo[ci2*3+2]   = to.z;
                ci2++;
            }
        });

        this.worker = new Worker('./ts/lib/rbd_worker.js');
        this.worker.onmessage = e => {
            this.pendingNetTrans = e.data.netTrans;
            this.pendingNetQuat  = e.data.netQuat;
            this.workerBusy = false;
        };
        this.worker.onerror = e => {
            console.error('RBD worker error:', e);
            this.workerBusy = false;
        };

        // Init: send topology + initial positions (transferred, never again)
        this.worker.postMessage(
            { type: 'init', N, boundingRadii, inertiaMult, connToGlobalIdx,
              elemOffsets: this.elemOffsets, elemCounts: this.elemCounts,
              connOffsets: this.connOffsets, connCounts: this.connCounts,
              initialElemPos, initialClusterPos, initialConnFrom, initialConnTo },
            [initialElemPos.buffer, initialClusterPos.buffer,
             initialConnFrom.buffer, initialConnTo.buffer]
        );
    }

    public getWorld(): any { return this.world; }
    public getNumberOfClusters(): number { return this.clusters.length; }
    public getClusters(): Cluster[] { return this.clusters; }

    /** Returns the current viz type, or null if none. */
    public colliderVizMode(): 'sphere' | 'element' | null {
        if (!this.viz) return null;
        return this.viz instanceof SphereClusterColliderVisualizer ? 'sphere' : 'element';
    }

    public enableColliderViz() {
        if (this.viz) return;
        if (view.getInputBool('rbd_sphereMode')) {
            this.viz = new SphereClusterColliderVisualizer(this.clusters);
        } else {
            this.viz = new ColliderVisualizer(this.clusters.flatMap(c => c.elements));
        }
    }
    public disableColliderViz() { if (this.viz) { this.viz.dispose(); this.viz = null; } }

    public integrate(dt: number) {
        // Identify selected clusters (O(N), once per frame)
        const selectedClusters = new Set<Cluster>();
        if (selectedBases.size > 0) {
            for (const c of this.clusters) {
                for (const e of c.elements) {
                    if (selectedBases.has(e as any)) { selectedClusters.add(c); break; }
                }
            }
        }

        for (const c of this.clusters) {
            if (selectedClusters.has(c)) c.syncToRapier();
        }

        // Apply net transform from previous worker result (one call per cluster)
        if (this.pendingNetTrans) {
            const nt = this.pendingNetTrans, nq = this.pendingNetQuat;
            this.clusters.forEach((c, i) => {
                if (!selectedClusters.has(c)) c.applyNetTransform(nt, nq, i);
            });
            this.pendingNetTrans = null;
        }

        if (!this.workerBusy) {
            this.postToWorker(selectedClusters, dt);
            this.workerBusy = true;
        }

        // world.step() only needed for the collider visualiser
        if (this.viz) this.world.step();

        if (this.viz) this.viz.update();
        if (selectedBases.size > 0 && view.transformMode.enabled()) transformControls.show();
    }

    /**
     * For the common no-selection case: sends only params + empty selectedMask —
     * zero position data, zero Float32Array allocation for element positions.
     * For selected clusters: sends a sparse position update (only those clusters).
     */
    private postToWorker(selectedClusters: Set<Cluster>, dt: number) {
        const N = this.clusters.length;
        const selectedMask = new Uint8Array(N); // cheap; N bytes

        const params = {
            contactRepulsion:      view.getInputNumber('rbd_contactRepulsion'),
            springK:               view.getInputNumber('rbd_connectionSpringConst'),
            relaxed:               view.getInputNumber('rbd_connectionRelaxedLength'),
            maxForce:              view.getInputNumber('rbd_connectionMaxForce'),
            electrostaticStrength: view.getInputNumber('rbd_electrostaticStrength'),
            screeningLength:       view.getInputNumber('rbd_screeningLength'),
            dt:                    view.getInputNumber('rbd_dt'),
            stepsPerCall: 4,
            sphereMode:            view.getInputBool('rbd_sphereMode'),
        };

        if (selectedClusters.size === 0) {
            // Common case: no allocation, no position data
            this.worker.postMessage({ type: 'step', selectedMask, params });
            return;
        }

        // Sparse update: pack positions for selected clusters only
        const selIndices: number[] = [];
        this.clusters.forEach((c, i) => { if (selectedClusters.has(c)) { selectedMask[i] = 1; selIndices.push(i); } });

        let selElems = 0, selConns = 0;
        for (const si of selIndices) { selElems += this.elemCounts[si]; selConns += this.connCounts[si]; }

        const selClusterIdx       = new Int32Array(selIndices);
        const selClusterPos       = new Float32Array(selIndices.length * 3);
        const selElemPositions    = new Float32Array(selElems * 3);
        const selConnFromPositions = new Float32Array(selConns * 3);

        let ei = 0, ci = 0;
        selIndices.forEach((si, k) => {
            const c = this.clusters[si];
            const p = c.position;
            selClusterPos[k*3] = p.x; selClusterPos[k*3+1] = p.y; selClusterPos[k*3+2] = p.z;
            for (const e of c.elements) {
                const ep = e.getPos();
                selElemPositions[ei*3] = ep.x; selElemPositions[ei*3+1] = ep.y; selElemPositions[ei*3+2] = ep.z;
                ei++;
            }
            for (const cp of c.conPoints) {
                const from = cp.from.getPos();
                selConnFromPositions[ci*3] = from.x; selConnFromPositions[ci*3+1] = from.y; selConnFromPositions[ci*3+2] = from.z;
                ci++;
            }
        });

        this.worker.postMessage(
            { type: 'step', selectedMask, selClusterIdx, selClusterPos,
              selElemPositions, selConnFromPositions, params },
            [selClusterPos.buffer, selElemPositions.buffer, selConnFromPositions.buffer]
        );
    }

    public simulate() {
        this.integrate(view.getInputNumber('rbd_dt'));
        if (forceHandler.forces.length > 0) forceHandler.redrawTraps();
        // Continue only while this instance is still the active simulator.
        if (rigidClusterSimulator === this) {
            requestAnimationFrame(this.simulate.bind(this));
        }
    }

    public dispose() {
        this.disableColliderViz();
        this.world.free();
        this.worker.terminate();
    }
}

const ELEMENT_COLLIDER_RADIUS = 0.5;

class Cluster {
    public elements:       BasicElement[];
    public conPoints:      ClusterConnectionPoint[] = [];
    public position:       THREE.Vector3;
    public boundingRadius: number;
    public inertiaMult:    number;

    private elementSet:    Set<BasicElement>;
    private sim:           RigidClusterSimulator;
    private body:          any;
    private bodyRotation   = new THREE.Quaternion();

    private totalTranslation = new THREE.Vector3();
    private totalRotation    = new THREE.Quaternion();
    private rot_axis:         THREE.Vector3;

    constructor(clusterElements: Set<BasicElement>, simulator: RigidClusterSimulator) {
        this.elementSet = clusterElements;
        this.elements   = [...clusterElements];
        this.sim        = simulator;

        this.position = new THREE.Vector3();
        for (const e of this.elements) this.position.add(e.getPos());
        this.position.divideScalar(this.elements.length);

        this.boundingRadius = ELEMENT_COLLIDER_RADIUS;
        for (const e of this.elements) {
            this.boundingRadius = Math.max(this.boundingRadius, e.getPos().distanceTo(this.position));
        }
        this.inertiaMult = 1 / ((2 / 5) * this.boundingRadius * this.boundingRadius);

        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(this.position.x, this.position.y, this.position.z);
        this.body = simulator.getWorld().createRigidBody(bodyDesc);

        for (const e of this.elements) {
            const lp = e.getPos().clone().sub(this.position);
            simulator.getWorld().createCollider(
                RAPIER.ColliderDesc.ball(ELEMENT_COLLIDER_RADIUS)
                    .setTranslation(lp.x, lp.y, lp.z)
                    .setDensity(0).setRestitution(0).setFriction(0),
                this.body
            );
        }

        for (const e of this.elements) {
            if (e.n3 && e.n3.clusterId !== e.clusterId)
                this.conPoints.push(new ClusterConnectionPoint(e, e.n3));
            if (e.n5 && e.n5.clusterId !== e.clusterId)
                this.conPoints.push(new ClusterConnectionPoint(e, e.n5));
            forceHandler.getTraps().forEach((t: PairwiseForce) => {
                if (t.particle === e)
                    this.conPoints.push(new ClusterConnectionPoint(e, t.ref_particle));
            });
        }

        this.rot_axis = this.position.clone();
    }

    /**
     * Apply the K-step net transform returned by the worker.
     * One translateElements + one rotateElements call regardless of K.
     * Uses module-level scratch objects — no heap allocation.
     */
    public applyNetTransform(netTrans: Float32Array, netQuat: Float32Array, i: number) {
        const tx = netTrans[i*3], ty = netTrans[i*3+1], tz = netTrans[i*3+2];

        translateElements(this.elementSet, _rbdVec.set(tx, ty, tz));
        this.position.x += tx; this.position.y += ty; this.position.z += tz;
        this.totalTranslation.x += tx; this.totalTranslation.y += ty; this.totalTranslation.z += tz;

        const qx = netQuat[i*4], qy = netQuat[i*4+1], qz = netQuat[i*4+2], qw = netQuat[i*4+3];
        const sinHalf = Math.sqrt(qx*qx + qy*qy + qz*qz);
        if (sinHalf > 1e-8) {
            const inv   = 1 / sinHalf;
            const angle = 2 * Math.atan2(sinHalf, qw);
            rotateElements(this.elementSet, _rbdVec.set(qx*inv, qy*inv, qz*inv), angle, this.position);
            _rbdQuat.set(qx, qy, qz, qw);
            this.totalRotation.premultiply(_rbdQuat);
            this.bodyRotation.premultiply(_rbdQuat);
        }

        this.rot_axis = this.position.clone();
        this.body.setNextKinematicTranslation({ x: this.position.x, y: this.position.y, z: this.position.z });
        this.body.setNextKinematicRotation({ x: this.bodyRotation.x, y: this.bodyRotation.y, z: this.bodyRotation.z, w: this.bodyRotation.w });
    }

    public syncToRapier() {
        this.position.set(0, 0, 0);
        for (const e of this.elements) this.position.add(e.getPos());
        this.position.divideScalar(this.elements.length);
        this.body.setNextKinematicTranslation({ x: this.position.x, y: this.position.y, z: this.position.z });
    }

    public getClusterElements(): Set<BasicElement>  { return this.elementSet; }
    public getPosition():        THREE.Vector3       { return this.position.clone(); }
    public getBoundingRadius():  number              { return this.boundingRadius; }
    public getTotalTranslation(): THREE.Vector3      { return this.totalTranslation.clone(); }
    public getTotalRotation():   THREE.Quaternion    { return this.totalRotation.clone(); }
    public getElements():        BasicElement[]      { return this.elements; }
    public getRotationAxis():    THREE.Vector3       { return this.rot_axis.clone(); }
}

class ClusterConnectionPoint {
    public from: BasicElement;
    public to:   BasicElement;
    constructor(from: BasicElement, to: BasicElement) { this.from = from; this.to = to; }
}

const CONN_COLLIDER_RADIUS = 0.5;

/**
 * Visualizes the sphere-mode colliders: one bounding sphere per cluster
 * plus one small sphere at each connection-point endpoint.
 */
class SphereClusterColliderVisualizer {
    private mesh: THREE.Mesh | null = null;
    private offsetBuffer: Float32Array;
    private clusters: Cluster[];
    private clusterCount: number;

    constructor(clusters: Cluster[]) {
        this.clusters = clusters;
        this.clusterCount = clusters.length;
        const nConns = clusters.reduce((s, c) => s + c.conPoints.length, 0);
        const N = this.clusterCount + nConns;
        if (N === 0) return;

        this.offsetBuffer = new Float32Array(N * 3);
        const colorBuffer  = new Float32Array(N * 3);
        const rotBuffer    = new Float32Array(N * 4);
        const scaleBuffer  = new Float32Array(N * 3);
        const visBuffer    = new Float32Array(N * 3);

        let idx = 0;
        for (const c of clusters) {
            const p = c.position;
            this.offsetBuffer[idx*3]   = p.x;
            this.offsetBuffer[idx*3+1] = p.y;
            this.offsetBuffer[idx*3+2] = p.z;
            const col = colorFromInt(c.elements[0].clusterId);
            colorBuffer[idx*3] = col.r; colorBuffer[idx*3+1] = col.g; colorBuffer[idx*3+2] = col.b;
            rotBuffer[idx*4+3] = 1;
            scaleBuffer[idx*3] = scaleBuffer[idx*3+1] = scaleBuffer[idx*3+2] = c.boundingRadius;
            visBuffer[idx*3]   = visBuffer[idx*3+1]   = visBuffer[idx*3+2]   = 1;
            idx++;
        }
        for (const c of clusters) {
            const col = colorFromInt(c.elements[0].clusterId);
            for (const cp of c.conPoints) {
                const p = cp.from.getPos();
                this.offsetBuffer[idx*3]   = p.x;
                this.offsetBuffer[idx*3+1] = p.y;
                this.offsetBuffer[idx*3+2] = p.z;
                colorBuffer[idx*3] = col.r; colorBuffer[idx*3+1] = col.g; colorBuffer[idx*3+2] = col.b;
                rotBuffer[idx*4+3] = 1;
                scaleBuffer[idx*3] = scaleBuffer[idx*3+1] = scaleBuffer[idx*3+2] = CONN_COLLIDER_RADIUS;
                visBuffer[idx*3]   = visBuffer[idx*3+1]   = visBuffer[idx*3+2]   = 1;
                idx++;
            }
        }

        const geom = new THREE.InstancedBufferGeometry() as any;
        geom.copy(new THREE.SphereBufferGeometry(1, 8, 6) as any);
        geom.addAttribute('instanceOffset',     new THREE.InstancedBufferAttribute(this.offsetBuffer, 3));
        geom.addAttribute('instanceColor',      new THREE.InstancedBufferAttribute(colorBuffer, 3));
        geom.addAttribute('instanceRotation',   new THREE.InstancedBufferAttribute(rotBuffer, 4));
        geom.addAttribute('instanceScale',      new THREE.InstancedBufferAttribute(scaleBuffer, 3));
        geom.addAttribute('instanceVisibility', new THREE.InstancedBufferAttribute(visBuffer, 3));

        const mat = (instanceMaterial as THREE.MeshLambertMaterial).clone();
        mat.transparent = true; mat.opacity = 0.25; mat.depthWrite = false;
        mat['defines'] = { 'INSTANCED': '' };

        this.mesh = new THREE.Mesh(geom, mat);
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);
    }

    public update() {
        if (!this.mesh) return;
        const buf = this.offsetBuffer;
        let idx = 0;
        for (const c of this.clusters) {
            const p = c.position;
            buf[idx*3] = p.x; buf[idx*3+1] = p.y; buf[idx*3+2] = p.z;
            idx++;
        }
        for (const c of this.clusters) {
            for (const cp of c.conPoints) {
                const p = cp.from.getPos();
                buf[idx*3] = p.x; buf[idx*3+1] = p.y; buf[idx*3+2] = p.z;
                idx++;
            }
        }
        this.mesh.geometry['attributes']['instanceOffset'].needsUpdate = true;
    }

    public dispose() {
        if (!this.mesh) return;
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
        this.mesh = null;
    }
}

class ColliderVisualizer {
    private mesh: THREE.Mesh | null = null;
    private offsetBuffer: Float32Array;
    private orderedElements: BasicElement[] = [];

    constructor(elems: BasicElement[]) {
        this.orderedElements = elems;

        const N = this.orderedElements.length;
        if (N === 0) return;

        this.offsetBuffer = new Float32Array(N * 3);
        const colorBuffer = new Float32Array(N * 3);
        const rotBuffer   = new Float32Array(N * 4);
        const scaleBuffer = new Float32Array(N * 3);
        const visBuffer   = new Float32Array(N * 3);
        const r = ELEMENT_COLLIDER_RADIUS;

        this.orderedElements.forEach((elem, i) => {
            const pos = elem.getPos();
            this.offsetBuffer[i*3]   = pos.x;
            this.offsetBuffer[i*3+1] = pos.y;
            this.offsetBuffer[i*3+2] = pos.z;
            const col = colorFromInt(elem.clusterId);
            colorBuffer[i*3] = col.r; colorBuffer[i*3+1] = col.g; colorBuffer[i*3+2] = col.b;
            rotBuffer[i*4+3] = 1;
            scaleBuffer[i*3] = scaleBuffer[i*3+1] = scaleBuffer[i*3+2] = r;
            visBuffer[i*3]   = visBuffer[i*3+1]   = visBuffer[i*3+2]   = 1;
        });

        const geom = new THREE.InstancedBufferGeometry() as any;
        geom.copy(new THREE.SphereBufferGeometry(1, 8, 6) as any);
        geom.addAttribute('instanceOffset',     new THREE.InstancedBufferAttribute(this.offsetBuffer, 3));
        geom.addAttribute('instanceColor',      new THREE.InstancedBufferAttribute(colorBuffer, 3));
        geom.addAttribute('instanceRotation',   new THREE.InstancedBufferAttribute(rotBuffer, 4));
        geom.addAttribute('instanceScale',      new THREE.InstancedBufferAttribute(scaleBuffer, 3));
        geom.addAttribute('instanceVisibility', new THREE.InstancedBufferAttribute(visBuffer, 3));

        const mat = (instanceMaterial as THREE.MeshLambertMaterial).clone();
        mat.transparent = true; mat.opacity = 0.25; mat.depthWrite = false;
        mat['defines'] = { 'INSTANCED': '' };

        this.mesh = new THREE.Mesh(geom, mat);
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);
    }

    public update() {
        if (!this.mesh) return;
        const buf = this.offsetBuffer;
        this.orderedElements.forEach((elem, i) => {
            const pos = elem.getPos();
            buf[i*3] = pos.x; buf[i*3+1] = pos.y; buf[i*3+2] = pos.z;
        });
        this.mesh.geometry['attributes']['instanceOffset'].needsUpdate = true;
    }

    public dispose() {
        if (!this.mesh) return;
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
        this.mesh = null;
    }
}
