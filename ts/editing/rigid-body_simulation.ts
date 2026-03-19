// RAPIER physics engine is loaded globally via ts/lib/rapier_init.mjs
// (a <script type="module"> in index.html that stores the initialized module in window.RAPIER)
declare const RAPIER: any;

// Global simulator instance
let rigidClusterSimulator: RigidClusterSimulator;

/**
 * Start rigid-body simulator if it's not already running.
 * Requires RAPIER to be initialized (see rapier_init.mjs).
 */
function toggleClusterSim() {
    if (!view.getInputBool("clusterSim")) {
        // simulate()'s RAF loop detects the unchecked state, saves to edit
        // history, and calls dispose() itself — don't double-dispose here.
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

/** Toggle the collider sphere overlay; safe to call while the sim is running. */
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
 * Force computation (O(N²·M²) contact loop + spring forces) runs in a Web
 * Worker so the main thread is never blocked — the UI and renderer stay
 * responsive regardless of system size.
 *
 * The main thread only applies one-frame-old forces (imperceptible latency)
 * and handles Three.js geometry updates (translateElements / rotateElements).
 */
class RigidClusterSimulator {
    private clusters: Cluster[] = [];
    private world: any; // RAPIER.World
    private viz: ColliderVisualizer | null = null;

    connectionRelaxedLength: number;
    connectionSpringConst: number;
    connectionMaxForce: number;
    contactRepulsion: number;
    dt: number;

    // Web Worker for off-thread force computation
    private worker: Worker;
    private workerBusy = false;
    private pendingForces:  Float32Array | null = null;
    private pendingTorques: Float32Array | null = null;

    // Static topology layout sent to worker at init
    private elemOffsets: Int32Array;
    private elemCounts:  Int32Array;
    private connOffsets: Int32Array;
    private connCounts:  Int32Array;
    private totalElems:  number;
    private totalConns:  number;

    constructor() {
        this.connectionRelaxedLength = view.getInputNumber('rbd_connectionRelaxedLength');
        this.connectionSpringConst   = view.getInputNumber('rbd_connectionSpringConst');
        this.connectionMaxForce      = view.getInputNumber('rbd_connectionMaxForce');
        this.contactRepulsion        = view.getInputNumber('rbd_contactRepulsion');
        this.dt                      = view.getInputNumber('rbd_dt');

        // Zero-gravity world; used only to maintain kinematic colliders for viz.
        this.world = new RAPIER.World({ x: 0.0, y: 0.0, z: 0.0 });
        this.world.timestep = this.dt;

        // Build clusters
        const m = new Map<number, Set<BasicElement>>();
        elements.forEach((e) => {
            const c = e.clusterId;
            if (c < 0) return;
            if (!m.has(c)) m.set(c, new Set());
            m.get(c).add(e);
        });
        m.forEach((clusterElements) => {
            this.clusters.push(new Cluster(clusterElements, this));
        });

        // Compute topology offsets for worker
        const N = this.clusters.length;
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

        // Start worker and send static topology (once)
        this.worker = new Worker('./ts/lib/rbd_worker.js');
        this.worker.onmessage = (e) => {
            this.pendingForces  = e.data.forces;
            this.pendingTorques = e.data.torques;
            this.workerBusy = false;
        };
        const boundingRadii = new Float32Array(this.clusters.map(c => c.boundingRadius));
        this.worker.postMessage({
            type: 'init', N,
            boundingRadii,
            elemOffsets: this.elemOffsets, elemCounts: this.elemCounts,
            connOffsets: this.connOffsets, connCounts: this.connCounts,
        });
    }

    public getWorld(): any { return this.world; }
    public getNumberOfClusters(): number { return this.clusters.length; }

    public enableColliderViz() {
        if (this.viz) return;
        this.viz = new ColliderVisualizer(this.clusters);
    }

    public disableColliderViz() {
        if (!this.viz) return;
        this.viz.dispose();
        this.viz = null;
    }

    /**
     * One simulation step:
     *   1. Apply forces computed by the worker last frame.
     *   2. Post current positions to the worker for next frame (non-blocking).
     *
     * The worker runs in a separate thread, so step 2 never blocks the UI.
     * Forces are one animation frame old — imperceptible for this use case.
     */
    public integrate(dt: number) {
        // Pre-compute selected clusters (O(N·|selectedBases|), done once)
        const selectedClusters = new Set<Cluster>();
        if (selectedBases.size > 0) {
            for (const c of this.clusters) {
                for (const e of c.elements) {
                    if (selectedBases.has(e as any)) { selectedClusters.add(c); break; }
                }
            }
        }

        // Sync selected clusters to wherever the user dragged them
        for (const c of this.clusters) {
            if (selectedClusters.has(c)) c.syncToRapier();
        }

        // Apply forces from the previous worker result
        if (this.pendingForces) {
            const pf = this.pendingForces, pt = this.pendingTorques;
            this.clusters.forEach((c, i) => {
                if (selectedClusters.has(c)) return;
                c.accF.set( pf[i*3],  pf[i*3+1],  pf[i*3+2]);
                c.accTau.set(pt[i*3], pt[i*3+1],  pt[i*3+2]);
                c.applyGradientStep(dt);
            });
        }

        // Post current positions to worker for next frame — returns immediately
        if (!this.workerBusy) {
            this.postToWorker(selectedClusters);
            this.workerBusy = true;
        }

        this.world.step();
        if (this.viz) this.viz.update();
        if (selectedBases.size > 0 && view.transformMode.enabled()) transformControls.show();
    }

    /** Pack current cluster/element/connection positions and dispatch to worker. */
    private postToWorker(selectedClusters: Set<Cluster>) {
        const N = this.clusters.length;
        const clusterPos   = new Float32Array(N * 3);
        const elemPos      = new Float32Array(this.totalElems * 3);
        const connFrom     = new Float32Array(this.totalConns * 3);
        const connTo       = new Float32Array(this.totalConns * 3);
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
                        springK:  this.connectionSpringConst,
                        relaxed:  this.connectionRelaxedLength,
                        maxForce: this.connectionMaxForce } },
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
    // Public for direct access from RigidClusterSimulator
    public elements:   BasicElement[];
    public conPoints:  ClusterConnectionPoint[] = [];
    public position:   THREE.Vector3;
    public boundingRadius: number;

    // Pre-allocated force/torque accumulators (set from worker result each frame)
    public accF   = new THREE.Vector3();
    public accTau = new THREE.Vector3();

    private elementSet: Set<BasicElement>;  // required by translateElements / rotateElements
    private sim: RigidClusterSimulator;
    private body: any; // RAPIER.RigidBody (kinematic)
    private inertiaMult: number; // 1 / (I_solid) so we can avoid THREE.Matrix3 in hot path
    private bodyRotation = new THREE.Quaternion();

    private totalTranslation = new THREE.Vector3();
    private totalRotation    = new THREE.Quaternion();
    private rot_axis: THREE.Vector3;

    constructor(clusterElements: Set<BasicElement>, simulator: RigidClusterSimulator) {
        this.elementSet = clusterElements;
        this.elements   = [...clusterElements];
        this.sim = simulator;

        // Centre of mass
        this.position = new THREE.Vector3();
        for (const e of this.elements) this.position.add(e.getPos());
        this.position.divideScalar(this.elements.length);

        // Bounding radius; solid-sphere moment of inertia (mass = 1)
        this.boundingRadius = ELEMENT_COLLIDER_RADIUS;
        for (const e of this.elements) {
            this.boundingRadius = Math.max(this.boundingRadius, e.getPos().distanceTo(this.position));
        }
        this.inertiaMult = 1 / ((2 / 5) * this.boundingRadius * this.boundingRadius);

        // Kinematic Rapier body — collider positions only, used for viz
        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(this.position.x, this.position.y, this.position.z);
        this.body = simulator.getWorld().createRigidBody(bodyDesc);

        for (const e of this.elements) {
            const localPos = e.getPos().clone().sub(this.position);
            simulator.getWorld().createCollider(
                RAPIER.ColliderDesc.ball(ELEMENT_COLLIDER_RADIUS)
                    .setTranslation(localPos.x, localPos.y, localPos.z)
                    .setDensity(0).setRestitution(0).setFriction(0),
                this.body
            );
        }

        // Spring connection points
        for (const e of this.elements) {
            if (e.n3 && e.n3.clusterId !== e.clusterId)
                this.conPoints.push(new ClusterConnectionPoint(e, e.n3));
            if (e.n5 && e.n5.clusterId !== e.clusterId)
                this.conPoints.push(new ClusterConnectionPoint(e, e.n5));
            forceHandler.getTraps().forEach((t: PairwiseForce) => {
                if (t.particle == e)
                    this.conPoints.push(new ClusterConnectionPoint(e, t.ref_particle));
            });
        }

        this.rot_axis = this.position.clone();
    }

    /**
     * Apply a gradient-descent step using the forces already written into
     * accF / accTau (set by the simulator from the worker result).
     * Δx = dt·F  (mass=1),  Δθ = dt·I⁻¹·τ
     */
    public applyGradientStep(dt: number) {
        const f = this.accF, tau = this.accTau;

        // Translation — raw scalar to avoid Vector3 allocation
        const dpx = f.x * dt, dpy = f.y * dt, dpz = f.z * dt;
        translateElements(this.elementSet, new THREE.Vector3(dpx, dpy, dpz));
        this.position.x += dpx; this.position.y += dpy; this.position.z += dpz;
        this.totalTranslation.x += dpx; this.totalTranslation.y += dpy; this.totalTranslation.z += dpz;

        // Rotation — inertiaMult is a scalar (isotropic solid-sphere inertia)
        const im = this.inertiaMult;
        const aax = tau.x * im * dt, aay = tau.y * im * dt, aaz = tau.z * im * dt;
        const deltaAngle = Math.sqrt(aax*aax + aay*aay + aaz*aaz);
        if (deltaAngle > 1e-8) {
            const inv = 1 / deltaAngle;
            const rotAxis = new THREE.Vector3(aax*inv, aay*inv, aaz*inv);
            rotateElements(this.elementSet, rotAxis, deltaAngle, this.position);
            const dq = new THREE.Quaternion().setFromAxisAngle(rotAxis, deltaAngle);
            this.totalRotation.premultiply(dq);
            this.bodyRotation.premultiply(dq);
        }

        this.rot_axis = this.position.clone();

        // Sync kinematic Rapier body for collider viz
        this.body.setNextKinematicTranslation(
            { x: this.position.x, y: this.position.y, z: this.position.z }
        );
        this.body.setNextKinematicRotation(
            { x: this.bodyRotation.x, y: this.bodyRotation.y,
              z: this.bodyRotation.z, w: this.bodyRotation.w }
        );
    }

    /** Follow user's drag: recompute COM from current element positions. */
    public syncToRapier() {
        this.position.set(0, 0, 0);
        for (const e of this.elements) this.position.add(e.getPos());
        this.position.divideScalar(this.elements.length);
        this.body.setNextKinematicTranslation(
            { x: this.position.x, y: this.position.y, z: this.position.z }
        );
    }

    // Accessors required by RevertableClusterSim
    public getClusterElements(): Set<BasicElement> { return this.elementSet; }
    public getPosition():        THREE.Vector3      { return this.position.clone(); }
    public getBoundingRadius():  number             { return this.boundingRadius; }
    public getTotalTranslation(): THREE.Vector3     { return this.totalTranslation.clone(); }
    public getTotalRotation():   THREE.Quaternion   { return this.totalRotation.clone(); }
    public getElements():        BasicElement[]     { return this.elements; }
    public getRotationAxis():    THREE.Vector3      { return this.rot_axis.clone(); }
}

class ClusterConnectionPoint {
    public from: BasicElement;
    public to:   BasicElement;
    constructor(from: BasicElement, to: BasicElement) { this.from = from; this.to = to; }
}

/**
 * GPU-instanced overlay — one transparent sphere per element showing
 * the per-element collision bodies.
 */
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
