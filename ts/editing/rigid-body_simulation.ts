// RAPIER physics engine is loaded globally via ts/lib/rapier_init.mjs
declare const RAPIER: any;

let rigidClusterSimulator: RigidClusterSimulator;

function toggleClusterSim() {
    if (!view.getInputBool("clusterSim")) {
        // simulate()'s RAF loop detects the unchecked state and handles cleanup.
        return;
    }
    if (!rigidClusterSimulator) {
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
    }
    rigidClusterSimulator.simulate();
}

function toggleColliderViz() {
    if (!rigidClusterSimulator) return;
    if (view.getInputBool('rbd_showColliders')) {
        rigidClusterSimulator.enableColliderViz();
    } else {
        rigidClusterSimulator.disableColliderViz();
    }
}

// http://www.cs.cmu.edu/~baraff/sigcourse/notesd1.pdf

/**
 * Gradient-descent rigid-body cluster simulator.
 *
 * The Web Worker runs K gradient-descent steps internally per call, returning
 * one composed (netTrans, netQuat) per cluster. The main thread applies a
 * single translateElements + rotateElements regardless of K — reducing
 * geometry-update work by K× compared to one-step-per-call.
 *
 * Stability: the worker clamps |Δx| ≤ ELEMENT_COLLIDER_RADIUS and
 * |Δθ| ≤ MAX_ANGLE per step, preventing overshooting under large forces.
 */
class RigidClusterSimulator {
    private clusters: Cluster[] = [];
    private world: any;
    private viz: ColliderVisualizer | null = null;

    connectionRelaxedLength: number;
    connectionSpringConst: number;
    connectionMaxForce: number;
    contactRepulsion: number;
    dt: number;

    private worker: Worker;
    private workerBusy = false;
    private pendingNetTrans: Float32Array | null = null;
    private pendingNetQuat:  Float32Array | null = null;

    // Topology offsets (static)
    private elemOffsets: Int32Array;
    private elemCounts:  Int32Array;
    private connOffsets: Int32Array;
    private connCounts:  Int32Array;
    private totalElems:  number;
    private totalConns:  number;

    // Reusable position buffers (returned by worker each step)
    private bufClusterPos: Float32Array | null = null;
    private bufElemPos:    Float32Array | null = null;
    private bufConnFrom:   Float32Array | null = null;
    private bufConnTo:     Float32Array | null = null;

    constructor() {
        this.connectionRelaxedLength = view.getInputNumber('rbd_connectionRelaxedLength');
        this.connectionSpringConst   = view.getInputNumber('rbd_connectionSpringConst');
        this.connectionMaxForce      = view.getInputNumber('rbd_connectionMaxForce');
        this.contactRepulsion        = view.getInputNumber('rbd_contactRepulsion');
        this.dt                      = view.getInputNumber('rbd_dt');

        this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
        this.world.timestep = this.dt;

        // Build clusters
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

        // Global element index map (flat elemPos index for each element)
        const elemGlobalIdx = new Map<BasicElement, number>();
        let gi = 0;
        this.clusters.forEach(c => c.elements.forEach(e => elemGlobalIdx.set(e, gi++)));

        // connToGlobalIdx: flat elemPos index of the "to" endpoint for each connection
        const connToGlobalIdx = new Int32Array(this.totalConns);
        let ci = 0;
        this.clusters.forEach(c => {
            c.conPoints.forEach(cp => {
                connToGlobalIdx[ci++] = elemGlobalIdx.has(cp.to) ? elemGlobalIdx.get(cp.to) : -1;
            });
        });

        // Inertia multiplier per cluster (1 / I_solid, mass=1)
        const inertiaMult    = new Float32Array(N);
        const boundingRadii  = new Float32Array(N);
        this.clusters.forEach((c, i) => {
            inertiaMult[i]   = c.inertiaMult;
            boundingRadii[i] = c.boundingRadius;
        });

        // Start worker
        this.worker = new Worker('./ts/lib/rbd_worker.js');
        this.worker.onmessage = e => {
            this.pendingNetTrans = e.data.netTrans;
            this.pendingNetQuat  = e.data.netQuat;
            this.bufClusterPos   = e.data.clusterPos;
            this.bufElemPos      = e.data.elemPos;
            this.bufConnFrom     = e.data.connFrom;
            this.bufConnTo       = e.data.connTo;
            this.workerBusy = false;
        };

        this.worker.postMessage({
            type: 'init', N,
            boundingRadii, inertiaMult, connToGlobalIdx,
            elemOffsets: this.elemOffsets, elemCounts: this.elemCounts,
            connOffsets: this.connOffsets, connCounts: this.connCounts,
        });
    }

    public getWorld(): any { return this.world; }
    public getNumberOfClusters(): number { return this.clusters.length; }

    public enableColliderViz()  { if (!this.viz) this.viz = new ColliderVisualizer(this.clusters); }
    public disableColliderViz() { if (this.viz) { this.viz.dispose(); this.viz = null; } }

    public integrate(dt: number) {
        // Identify selected clusters (O(N · |selectedBases|), done once per step)
        const selectedClusters = new Set<Cluster>();
        if (selectedBases.size > 0) {
            for (const c of this.clusters) {
                for (const e of c.elements) {
                    if (selectedBases.has(e as any)) { selectedClusters.add(c); break; }
                }
            }
        }

        // Sync selected clusters to user-drag position
        for (const c of this.clusters) {
            if (selectedClusters.has(c)) c.syncToRapier();
        }

        // Apply net transform computed by worker over K steps —
        // one translateElements + rotateElements per cluster regardless of K
        if (this.pendingNetTrans) {
            const nt = this.pendingNetTrans, nq = this.pendingNetQuat;
            this.clusters.forEach((c, i) => {
                if (!selectedClusters.has(c)) c.applyNetTransform(nt, nq, i);
            });
            this.pendingNetTrans = null;
        }

        // Post current positions to worker (non-blocking)
        if (!this.workerBusy) {
            this.postToWorker(selectedClusters, dt);
            this.workerBusy = true;
        }

        this.world.step();
        if (this.viz) this.viz.update();
        if (selectedBases.size > 0 && view.transformMode.enabled()) transformControls.show();
    }

    private postToWorker(selectedClusters: Set<Cluster>, dt: number) {
        const N = this.clusters.length;
        const clusterPos   = this.bufClusterPos ?? new Float32Array(N * 3);
        const elemPos      = this.bufElemPos    ?? new Float32Array(this.totalElems * 3);
        const connFrom     = this.bufConnFrom   ?? new Float32Array(this.totalConns * 3);
        const connTo       = this.bufConnTo     ?? new Float32Array(this.totalConns * 3);
        const selectedMask = new Uint8Array(N);

        let ei = 0, ci = 0;
        this.clusters.forEach((c, i) => {
            const p = c.position;
            clusterPos[i*3] = p.x; clusterPos[i*3+1] = p.y; clusterPos[i*3+2] = p.z;
            if (selectedClusters.has(c)) selectedMask[i] = 1;

            for (const e of c.elements) {
                const ep = e.getPos();
                elemPos[ei*3] = ep.x; elemPos[ei*3+1] = ep.y; elemPos[ei*3+2] = ep.z;
                ei++;
            }
            for (const cp of c.conPoints) {
                const from = cp.from.getPos(), to = cp.to.getPos();
                connFrom[ci*3] = from.x; connFrom[ci*3+1] = from.y; connFrom[ci*3+2] = from.z;
                connTo[ci*3]   = to.x;   connTo[ci*3+1]   = to.y;   connTo[ci*3+2]   = to.z;
                ci++;
            }
        });

        this.worker.postMessage(
            { type: 'step', clusterPos, elemPos, connFrom, connTo, selectedMask,
              params: { contactRepulsion: this.contactRepulsion,
                        springK:       this.connectionSpringConst,
                        relaxed:       this.connectionRelaxedLength,
                        maxForce:      this.connectionMaxForce,
                        dt, stepsPerCall: 4 } },
            [clusterPos.buffer, elemPos.buffer, connFrom.buffer, connTo.buffer]
        );
    }

    public simulate() {
        this.integrate(this.dt);
        if (forceHandler.forces.length > 0) forceHandler.redrawTraps();

        const shouldContinue = document.getElementById("clusterSim")["checked"];
        if (shouldContinue) {
            requestAnimationFrame(this.simulate.bind(this));
        } else {
            editHistory.add(new RevertableClusterSim(this.clusters));
            console.log("Added simulation result to edit history");
            this.dispose();
            rigidClusterSimulator = null;
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
    public elements:      BasicElement[];
    public conPoints:     ClusterConnectionPoint[] = [];
    public position:      THREE.Vector3;
    public boundingRadius: number;
    public inertiaMult:   number; // 1 / (2/5 * r²), mass=1

    private elementSet:   Set<BasicElement>;
    private sim:          RigidClusterSimulator;
    private body:         any;
    private bodyRotation  = new THREE.Quaternion();

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
     * Apply the net transform returned by the worker (K steps composed into one).
     * One translateElements + one rotateElements call regardless of K.
     */
    public applyNetTransform(netTrans: Float32Array, netQuat: Float32Array, i: number) {
        const tx = netTrans[i*3], ty = netTrans[i*3+1], tz = netTrans[i*3+2];

        // Net translation
        translateElements(this.elementSet, new THREE.Vector3(tx, ty, tz));
        this.position.x += tx; this.position.y += ty; this.position.z += tz;
        this.totalTranslation.x += tx; this.totalTranslation.y += ty; this.totalTranslation.z += tz;

        // Net rotation — extract axis/angle from composed quaternion
        const qx = netQuat[i*4], qy = netQuat[i*4+1], qz = netQuat[i*4+2], qw = netQuat[i*4+3];
        const sinHalf = Math.sqrt(qx*qx + qy*qy + qz*qz);
        if (sinHalf > 1e-8) {
            const angle = 2 * Math.atan2(sinHalf, qw);
            const inv   = 1 / sinHalf;
            const axis  = new THREE.Vector3(qx*inv, qy*inv, qz*inv);
            rotateElements(this.elementSet, axis, angle, this.position);
            const dq = new THREE.Quaternion(qx, qy, qz, qw);
            this.totalRotation.premultiply(dq);
            this.bodyRotation.premultiply(dq);
        }

        this.rot_axis = this.position.clone();

        this.body.setNextKinematicTranslation(
            { x: this.position.x, y: this.position.y, z: this.position.z }
        );
        this.body.setNextKinematicRotation(
            { x: this.bodyRotation.x, y: this.bodyRotation.y,
              z: this.bodyRotation.z, w: this.bodyRotation.w }
        );
    }

    public syncToRapier() {
        this.position.set(0, 0, 0);
        for (const e of this.elements) this.position.add(e.getPos());
        this.position.divideScalar(this.elements.length);
        this.body.setNextKinematicTranslation(
            { x: this.position.x, y: this.position.y, z: this.position.z }
        );
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

class ColliderVisualizer {
    private mesh: THREE.Mesh | null = null;
    private offsetBuffer: Float32Array;
    private orderedElements: BasicElement[] = [];

    constructor(clusters: Cluster[]) {
        for (const c of clusters) for (const e of c.elements) this.orderedElements.push(e);

        const N = this.orderedElements.length;
        if (N === 0) return;

        this.offsetBuffer = new Float32Array(N * 3);
        const colorBuffer = new Float32Array(N * 3);
        const rotBuffer   = new Float32Array(N * 4);
        const scaleBuffer = new Float32Array(N * 3);
        const visBuffer   = new Float32Array(N * 3);

        const r = ELEMENT_COLLIDER_RADIUS;
        let prevId = -1, clusterIdx = 0;

        this.orderedElements.forEach((elem, i) => {
            const cid = elem.clusterId;
            if (cid !== prevId) { clusterIdx = cid; prevId = cid; }
            const pos = elem.getPos();
            this.offsetBuffer[i*3]   = pos.x;
            this.offsetBuffer[i*3+1] = pos.y;
            this.offsetBuffer[i*3+2] = pos.z;
            const col = colorFromInt(clusterIdx);
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
