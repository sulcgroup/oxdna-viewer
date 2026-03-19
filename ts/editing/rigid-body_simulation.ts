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
        if (rigidClusterSimulator) {
            rigidClusterSimulator.dispose();
            rigidClusterSimulator = null;
        }
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
// https://rapier.rs/docs/user_guides/javascript/rigid_bodies

/**
 * Rigid-body cluster simulator using gradient descent.
 *
 * Each step accumulates spring and soft contact-repulsion forces into
 * per-cluster (f, tau) vectors, then applies a direct position/rotation
 * displacement proportional to the net force: Δx = dt·F/mass, Δθ = dt·I⁻¹τ.
 * There is no velocity and therefore no momentum to accumulate.
 * Forces decay smoothly to zero as the system approaches equilibrium.
 *
 * Rapier is used only to maintain the collider hierarchy for the optional
 * collider visualisation overlay.
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

    constructor() {
        this.connectionRelaxedLength = view.getInputNumber('rbd_connectionRelaxedLength');
        this.connectionSpringConst   = view.getInputNumber('rbd_connectionSpringConst');
        this.connectionMaxForce      = view.getInputNumber('rbd_connectionMaxForce');
        this.contactRepulsion        = view.getInputNumber('rbd_contactRepulsion');
        this.dt                      = view.getInputNumber('rbd_dt');

        // Zero-gravity world; used only to maintain kinematic colliders for viz.
        this.world = new RAPIER.World({ x: 0.0, y: 0.0, z: 0.0 });
        this.world.timestep = this.dt;

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
     * One gradient-descent step.
     *
     * Forces are accumulated manually into (f, tau) per cluster, then converted
     * to direct position/rotation displacements.  Contact repulsion uses a soft
     * Hookean penalty (F = contactRepulsion · overlap) that is exactly zero when
     * elements don't overlap → forces naturally vanish at equilibrium.
     *
     * world.step() is called afterwards to keep Rapier's kinematic collider
     * positions current for the visualisation overlay.
     */
    public integrate(dt: number) {
        // Allocate per-cluster force/torque accumulators
        const acc = new Map<Cluster, [THREE.Vector3, THREE.Vector3]>();
        this.clusters.forEach(c => acc.set(c, [new THREE.Vector3(), new THREE.Vector3()]));

        this.clusters.forEach((cA, i) => {
            const isSelectedA = [...selectedBases].some(b => cA.getClusterElements().has(b));
            if (isSelectedA) { cA.syncToRapier(); return; }

            const [fA, tauA] = acc.get(cA);

            // Spring / bond forces
            cA.accumulateConnectionForces(fA, tauA);

            // Soft contact repulsion vs every other free cluster (once per pair)
            this.clusters.forEach((cB, j) => {
                if (j <= i) return;
                if ([...selectedBases].some(b => cB.getClusterElements().has(b))) return;
                const [fB, tauB] = acc.get(cB);
                this.accumulateContactRepulsion(cA, cB, fA, tauA, fB, tauB);
            });
        });

        // Apply gradient step: Δpos = dt·F/mass, Δθ = dt·I⁻¹τ
        this.clusters.forEach(c => {
            if ([...selectedBases].some(b => c.getClusterElements().has(b))) return;
            const [f, tau] = acc.get(c);
            c.applyGradientStep(f, tau, dt);
        });

        // Keep Rapier world current for collider visualisation
        this.world.step();

        if (this.viz) this.viz.update();
        if (selectedBases.size > 0 && view.transformMode.enabled()) transformControls.show();
    }

    /**
     * Soft per-element contact repulsion between every overlapping pair from
     * clusters cA and cB.  Force = contactRepulsion · overlap along the
     * element-to-element axis — zero when elements are not overlapping.
     */
    private accumulateContactRepulsion(
        cA: Cluster, cB: Cluster,
        fA: THREE.Vector3, tauA: THREE.Vector3,
        fB: THREE.Vector3, tauB: THREE.Vector3
    ) {
        const posA = cA.getPosition();
        const posB = cB.getPosition();

        // Broad-phase: skip pair when bounding spheres can't overlap
        const clusterDist = posA.distanceTo(posB);
        if (clusterDist > cA.getBoundingRadius() + cB.getBoundingRadius() + 2 * ELEMENT_COLLIDER_RADIUS) {
            return;
        }

        const minDist = 2 * ELEMENT_COLLIDER_RADIUS;

        cA.getElements().forEach(eA => {
            const pA = eA.getPos();
            cB.getElements().forEach(eB => {
                const diff = pA.clone().sub(eB.getPos());
                const dist = diff.length();
                if (dist >= minDist || dist < 1e-8) return;

                const overlap = minDist - dist;
                const dir    = diff.divideScalar(dist); // normalised in place
                const mag    = this.contactRepulsion * overlap;

                const repA = dir.clone().multiplyScalar(mag);
                fA.add(repA);
                tauA.add(pA.clone().sub(posA).cross(repA));

                const repB = dir.clone().negate().multiplyScalar(mag);
                fB.add(repB);
                tauB.add(eB.getPos().clone().sub(posB).cross(repB));
            });
        });
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
        }
    }

    public dispose() {
        this.disableColliderViz();
        this.world.free();
    }
}

// Radius of the sphere placed at each element's position (oxDNA units).
const ELEMENT_COLLIDER_RADIUS = 0.5;

class Cluster {
    private conPoints: ClusterConnectionPoint[] = [];
    private clusterElements: Set<BasicElement>;
    private sim: RigidClusterSimulator;

    private body: any; // RAPIER.RigidBody (kinematic)

    private mass: number;
    private momentOfInertia_inv: THREE.Matrix3;
    private boundingRadius: number;

    private position: THREE.Vector3;
    private bodyRotation = new THREE.Quaternion();

    private totalTranslation = new THREE.Vector3();
    private totalRotation    = new THREE.Quaternion();
    private rot_axis: THREE.Vector3;

    constructor(clusterElements: Set<BasicElement>, simulator: RigidClusterSimulator) {
        this.clusterElements = clusterElements;
        this.sim = simulator;
        this.mass = 1;

        // Centre of mass
        this.position = new THREE.Vector3();
        clusterElements.forEach((e) => this.position.add(e.getPos()));
        this.position.divideScalar(clusterElements.size);

        // Bounding radius and solid-sphere moment of inertia
        this.boundingRadius = ELEMENT_COLLIDER_RADIUS;
        clusterElements.forEach((e) => {
            this.boundingRadius = Math.max(this.boundingRadius, e.getPos().distanceTo(this.position));
        });
        const inertia = (2 / 5) * this.mass * this.boundingRadius * this.boundingRadius;
        this.momentOfInertia_inv = new THREE.Matrix3()
            .multiplyScalar(1 / inertia);

        // Kinematic Rapier body — used only to keep collider positions current for viz
        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(this.position.x, this.position.y, this.position.z);
        this.body = simulator.getWorld().createRigidBody(bodyDesc);

        // One sphere collider per element for fine collision representation
        clusterElements.forEach((e) => {
            const localPos = e.getPos().clone().sub(this.position);
            const colliderDesc = RAPIER.ColliderDesc.ball(ELEMENT_COLLIDER_RADIUS)
                .setTranslation(localPos.x, localPos.y, localPos.z)
                .setDensity(0)
                .setRestitution(0)
                .setFriction(0);
            simulator.getWorld().createCollider(colliderDesc, this.body);
        });

        // Spring connection points
        clusterElements.forEach((e) => {
            if (e.n3 && e.n3.clusterId !== e.clusterId) {
                this.conPoints.push(new ClusterConnectionPoint(e, e.n3));
            }
            if (e.n5 && e.n5.clusterId !== e.clusterId) {
                this.conPoints.push(new ClusterConnectionPoint(e, e.n5));
            }
            forceHandler.getTraps().forEach((t: PairwiseForce) => {
                if (t.particle == e) {
                    this.conPoints.push(new ClusterConnectionPoint(e, t.ref_particle));
                }
            });
        });

        this.rot_axis = this.position.clone();
    }

    public getClusterElements(): Set<BasicElement> { return this.clusterElements; }
    public getPosition():        THREE.Vector3      { return this.position.clone(); }
    public getBoundingRadius():  number             { return this.boundingRadius; }
    public getTotalTranslation(): THREE.Vector3     { return this.totalTranslation.clone(); }
    public getTotalRotation():   THREE.Quaternion   { return this.totalRotation.clone(); }
    public getElements():        Set<BasicElement>  { return this.clusterElements; }
    public getRotationAxis():    THREE.Vector3      { return this.rot_axis.clone(); }

    /**
     * Accumulate spring forces into f/tau.
     * Force = k·max(extension, 0) capped at connectionMaxForce.
     * One-sided: zero when the bond is not overstretched.
     */
    public accumulateConnectionForces(f: THREE.Vector3, tau: THREE.Vector3) {
        this.conPoints.forEach((p) => {
            const extension = p.getDist() - this.sim.connectionRelaxedLength;
            if (extension <= 0) return;
            const scalar = Math.min(this.sim.connectionSpringConst * extension, this.sim.connectionMaxForce);
            const dir = p.getToPos().clone().sub(p.getFromPos());
            if (dir.length() < 1e-8) return;
            dir.setLength(scalar);
            f.add(dir);
            tau.add(p.getFromPos().clone().sub(this.position).cross(dir));
        });
    }

    /**
     * Apply a gradient-descent displacement step: Δx = dt·F/mass, Δθ = dt·I⁻¹τ.
     * No velocity is stored or carried between frames.
     * Syncs the kinematic Rapier body for the collider visualisation.
     */
    public applyGradientStep(force: THREE.Vector3, torque: THREE.Vector3, dt: number) {
        // Translation
        const deltaP = force.clone().multiplyScalar(dt / this.mass);
        translateElements(this.clusterElements, deltaP);
        this.position.add(deltaP);
        this.totalTranslation.add(deltaP);

        // Rotation
        const angularAcc = torque.clone().applyMatrix3(this.momentOfInertia_inv);
        const deltaAngle = angularAcc.length() * dt;
        if (deltaAngle > 1e-8) {
            const rotAxis = angularAcc.clone().normalize();
            rotateElements(this.clusterElements, rotAxis, deltaAngle, this.position);
            const dq = new THREE.Quaternion().setFromAxisAngle(rotAxis, deltaAngle);
            this.totalRotation.premultiply(dq);
            this.bodyRotation.premultiply(dq);
        }

        this.rot_axis = this.position.clone();

        // Sync kinematic body position for collider viz
        this.body.setNextKinematicTranslation(
            { x: this.position.x, y: this.position.y, z: this.position.z }
        );
        this.body.setNextKinematicRotation(
            { x: this.bodyRotation.x, y: this.bodyRotation.y, z: this.bodyRotation.z, w: this.bodyRotation.w }
        );
    }

    /** Freeze to user's drag position (selected clusters). */
    public syncToRapier() {
        this.position = new THREE.Vector3();
        this.clusterElements.forEach((e) => this.position.add(e.getPos()));
        this.position.divideScalar(this.clusterElements.size);

        this.body.setNextKinematicTranslation(
            { x: this.position.x, y: this.position.y, z: this.position.z }
        );
    }
}

class ClusterConnectionPoint {
    private from: BasicElement;
    private to:   BasicElement;

    constructor(from: BasicElement, to: BasicElement) {
        this.from = from;
        this.to   = to;
    }

    public getFromPos(): THREE.Vector3 { return this.from.getPos().clone(); }
    public getToPos():   THREE.Vector3 { return this.to.getPos().clone();   }
    public getDist():    number        { return this.getFromPos().distanceTo(this.getToPos()); }
}

/**
 * GPU-instanced overlay that renders one transparent sphere per element to
 * visualise the per-element collision bodies.
 */
class ColliderVisualizer {
    private mesh: THREE.Mesh | null = null;
    private offsetBuffer: Float32Array;
    private orderedElements: BasicElement[] = [];

    constructor(clusters: Cluster[]) {
        clusters.forEach(c => c.getElements().forEach(e => this.orderedElements.push(e)));

        const N = this.orderedElements.length;
        if (N === 0) return;

        this.offsetBuffer       = new Float32Array(N * 3);
        const colorBuffer       = new Float32Array(N * 3);
        const rotBuffer         = new Float32Array(N * 4);
        const scaleBuffer       = new Float32Array(N * 3);
        const visBuffer         = new Float32Array(N * 3);

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
            colorBuffer[i*3]   = col.r;
            colorBuffer[i*3+1] = col.g;
            colorBuffer[i*3+2] = col.b;

            rotBuffer[i*4+3] = 1; // identity quaternion

            scaleBuffer[i*3]   = r;
            scaleBuffer[i*3+1] = r;
            scaleBuffer[i*3+2] = r;

            visBuffer[i*3]   = 1;
            visBuffer[i*3+1] = 1;
            visBuffer[i*3+2] = 1;
        });

        const geom = new THREE.InstancedBufferGeometry() as any;
        geom.copy(new THREE.SphereBufferGeometry(1, 8, 6) as any);
        geom.addAttribute('instanceOffset',     new THREE.InstancedBufferAttribute(this.offsetBuffer, 3));
        geom.addAttribute('instanceColor',      new THREE.InstancedBufferAttribute(colorBuffer, 3));
        geom.addAttribute('instanceRotation',   new THREE.InstancedBufferAttribute(rotBuffer, 4));
        geom.addAttribute('instanceScale',      new THREE.InstancedBufferAttribute(scaleBuffer, 3));
        geom.addAttribute('instanceVisibility', new THREE.InstancedBufferAttribute(visBuffer, 3));

        const mat = (instanceMaterial as THREE.MeshLambertMaterial).clone();
        mat.transparent = true;
        mat.opacity     = 0.25;
        mat.depthWrite  = false;
        mat['defines']  = { 'INSTANCED': '' };

        this.mesh = new THREE.Mesh(geom, mat);
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);
    }

    public update() {
        if (!this.mesh) return;
        this.orderedElements.forEach((elem, i) => {
            const pos = elem.getPos();
            this.offsetBuffer[i*3]   = pos.x;
            this.offsetBuffer[i*3+1] = pos.y;
            this.offsetBuffer[i*3+2] = pos.z;
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
