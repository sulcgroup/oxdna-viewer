let rigidClusterSimulator;
let standaloneColliderViz = null;
function toggleClusterSim() {
    if (!view.getInputBool("clusterSim")) {
        // Stop immediately — don't wait for the RAF loop.
        if (rigidClusterSimulator) {
            editHistory.add(new RevertableClusterSim(rigidClusterSimulator.getClusters()));
            rigidClusterSimulator.dispose();
            rigidClusterSimulator = null;
            if (view.getInputBool('rbd_showColliders')) {
                const clustered = [...elements.values()].filter(e => e.clusterId >= 0);
                if (clustered.length > 0)
                    standaloneColliderViz = new ColliderVisualizer(clustered);
            }
        }
        return;
    }
    // Discard any existing simulator (handles re-enable without re-checking race).
    if (rigidClusterSimulator) {
        rigidClusterSimulator.dispose();
        rigidClusterSimulator = null;
    }
    if (standaloneColliderViz) {
        standaloneColliderViz.dispose();
        standaloneColliderViz = null;
    }
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
function toggleColliderViz() {
    if (rigidClusterSimulator) {
        if (view.getInputBool('rbd_showColliders')) {
            rigidClusterSimulator.enableColliderViz();
        }
        else {
            rigidClusterSimulator.disableColliderViz();
        }
        return;
    }
    // No simulation running — standalone viz
    if (view.getInputBool('rbd_showColliders')) {
        if (!standaloneColliderViz) {
            const clustered = [...elements.values()].filter(e => e.clusterId >= 0);
            if (clustered.length > 0)
                standaloneColliderViz = new ColliderVisualizer(clustered);
        }
    }
    else {
        if (standaloneColliderViz) {
            standaloneColliderViz.dispose();
            standaloneColliderViz = null;
        }
    }
    render();
}
// http://www.cs.cmu.edu/~baraff/sigcourse/notesd1.pdf
// Module-level scratch objects — reused every frame, never allocated in hot path
const _rbdVec = new THREE.Vector3();
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
    clusters = [];
    world;
    viz = null;
    worker;
    workerBusy = false;
    pendingNetTrans = null;
    pendingNetQuat = null;
    // Static topology layout
    elemOffsets;
    elemCounts;
    connOffsets;
    connCounts;
    totalElems;
    totalConns;
    constructor() {
        this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
        this.world.timestep = view.getInputNumber('rbd_dt');
        const m = new Map();
        elements.forEach(e => {
            const c = e.clusterId;
            if (c < 0)
                return;
            if (!m.has(c))
                m.set(c, new Set());
            m.get(c).add(e);
        });
        m.forEach(clusterElements => this.clusters.push(new Cluster(clusterElements, this)));
        const N = this.clusters.length;
        // Compute flat topology layout
        this.elemOffsets = new Int32Array(N);
        this.elemCounts = new Int32Array(N);
        this.connOffsets = new Int32Array(N);
        this.connCounts = new Int32Array(N);
        let eo = 0, co = 0;
        this.clusters.forEach((c, i) => {
            this.elemOffsets[i] = eo;
            this.elemCounts[i] = c.elements.length;
            eo += c.elements.length;
            this.connOffsets[i] = co;
            this.connCounts[i] = c.conPoints.length;
            co += c.conPoints.length;
        });
        this.totalElems = eo;
        this.totalConns = co;
        // Global element index for each element (its position in the flat elemPos array)
        const elemGlobalIdx = new Map();
        let gi = 0;
        this.clusters.forEach(c => c.elements.forEach(e => elemGlobalIdx.set(e, gi++)));
        // connToGlobalIdx[c] = flat elemPos index of the "to" endpoint for connection c
        const connToGlobalIdx = new Int32Array(this.totalConns);
        let ci = 0;
        this.clusters.forEach(c => c.conPoints.forEach(cp => {
            connToGlobalIdx[ci++] = elemGlobalIdx.has(cp.to) ? elemGlobalIdx.get(cp.to) : -1;
        }));
        // Static per-cluster properties
        const inertiaMult = new Float32Array(N);
        const boundingRadii = new Float32Array(N);
        this.clusters.forEach((c, i) => { inertiaMult[i] = c.inertiaMult; boundingRadii[i] = c.boundingRadius; });
        // Pack initial positions — transferred to worker once, never sent again
        const initialElemPos = new Float32Array(this.totalElems * 3);
        const initialClusterPos = new Float32Array(N * 3);
        const initialConnFrom = new Float32Array(this.totalConns * 3);
        const initialConnTo = new Float32Array(this.totalConns * 3);
        let ei2 = 0, ci2 = 0;
        this.clusters.forEach((c, i) => {
            const p = c.position;
            initialClusterPos[i * 3] = p.x;
            initialClusterPos[i * 3 + 1] = p.y;
            initialClusterPos[i * 3 + 2] = p.z;
            for (const e of c.elements) {
                const ep = e.getPos();
                initialElemPos[ei2 * 3] = ep.x;
                initialElemPos[ei2 * 3 + 1] = ep.y;
                initialElemPos[ei2 * 3 + 2] = ep.z;
                ei2++;
            }
            for (const cp of c.conPoints) {
                const from = cp.from.getPos(), to = cp.to.getPos();
                initialConnFrom[ci2 * 3] = from.x;
                initialConnFrom[ci2 * 3 + 1] = from.y;
                initialConnFrom[ci2 * 3 + 2] = from.z;
                initialConnTo[ci2 * 3] = to.x;
                initialConnTo[ci2 * 3 + 1] = to.y;
                initialConnTo[ci2 * 3 + 2] = to.z;
                ci2++;
            }
        });
        this.worker = new Worker('./ts/lib/rbd_worker.js');
        this.worker.onmessage = e => {
            this.pendingNetTrans = e.data.netTrans;
            this.pendingNetQuat = e.data.netQuat;
            this.workerBusy = false;
        };
        this.worker.onerror = e => {
            console.error('RBD worker error:', e);
            this.workerBusy = false;
        };
        // Init: send topology + initial positions (transferred, never again)
        this.worker.postMessage({ type: 'init', N, boundingRadii, inertiaMult, connToGlobalIdx,
            elemOffsets: this.elemOffsets, elemCounts: this.elemCounts,
            connOffsets: this.connOffsets, connCounts: this.connCounts,
            initialElemPos, initialClusterPos, initialConnFrom, initialConnTo }, [initialElemPos.buffer, initialClusterPos.buffer,
            initialConnFrom.buffer, initialConnTo.buffer]);
    }
    getWorld() { return this.world; }
    getNumberOfClusters() { return this.clusters.length; }
    getClusters() { return this.clusters; }
    enableColliderViz() { if (!this.viz)
        this.viz = new ColliderVisualizer(this.clusters.flatMap(c => c.elements)); }
    disableColliderViz() { if (this.viz) {
        this.viz.dispose();
        this.viz = null;
    } }
    integrate(dt) {
        // Identify selected clusters (O(N), once per frame)
        const selectedClusters = new Set();
        if (selectedBases.size > 0) {
            for (const c of this.clusters) {
                for (const e of c.elements) {
                    if (selectedBases.has(e)) {
                        selectedClusters.add(c);
                        break;
                    }
                }
            }
        }
        for (const c of this.clusters) {
            if (selectedClusters.has(c))
                c.syncToRapier();
        }
        // Apply net transform from previous worker result (one call per cluster)
        if (this.pendingNetTrans) {
            const nt = this.pendingNetTrans, nq = this.pendingNetQuat;
            this.clusters.forEach((c, i) => {
                if (!selectedClusters.has(c))
                    c.applyNetTransform(nt, nq, i);
            });
            this.pendingNetTrans = null;
        }
        if (!this.workerBusy) {
            this.postToWorker(selectedClusters, dt);
            this.workerBusy = true;
        }
        // world.step() only needed for the collider visualiser
        if (this.viz)
            this.world.step();
        if (this.viz)
            this.viz.update();
        if (selectedBases.size > 0 && view.transformMode.enabled())
            transformControls.show();
    }
    /**
     * For the common no-selection case: sends only params + empty selectedMask —
     * zero position data, zero Float32Array allocation for element positions.
     * For selected clusters: sends a sparse position update (only those clusters).
     */
    postToWorker(selectedClusters, dt) {
        const N = this.clusters.length;
        const selectedMask = new Uint8Array(N); // cheap; N bytes
        const params = {
            contactRepulsion: view.getInputNumber('rbd_contactRepulsion'),
            springK: view.getInputNumber('rbd_connectionSpringConst'),
            relaxed: view.getInputNumber('rbd_connectionRelaxedLength'),
            maxForce: view.getInputNumber('rbd_connectionMaxForce'),
            dt: view.getInputNumber('rbd_dt'),
            stepsPerCall: 4
        };
        if (selectedClusters.size === 0) {
            // Common case: no allocation, no position data
            this.worker.postMessage({ type: 'step', selectedMask, params });
            return;
        }
        // Sparse update: pack positions for selected clusters only
        const selIndices = [];
        this.clusters.forEach((c, i) => { if (selectedClusters.has(c)) {
            selectedMask[i] = 1;
            selIndices.push(i);
        } });
        let selElems = 0, selConns = 0;
        for (const si of selIndices) {
            selElems += this.elemCounts[si];
            selConns += this.connCounts[si];
        }
        const selClusterIdx = new Int32Array(selIndices);
        const selClusterPos = new Float32Array(selIndices.length * 3);
        const selElemPositions = new Float32Array(selElems * 3);
        const selConnFromPositions = new Float32Array(selConns * 3);
        let ei = 0, ci = 0;
        selIndices.forEach((si, k) => {
            const c = this.clusters[si];
            const p = c.position;
            selClusterPos[k * 3] = p.x;
            selClusterPos[k * 3 + 1] = p.y;
            selClusterPos[k * 3 + 2] = p.z;
            for (const e of c.elements) {
                const ep = e.getPos();
                selElemPositions[ei * 3] = ep.x;
                selElemPositions[ei * 3 + 1] = ep.y;
                selElemPositions[ei * 3 + 2] = ep.z;
                ei++;
            }
            for (const cp of c.conPoints) {
                const from = cp.from.getPos();
                selConnFromPositions[ci * 3] = from.x;
                selConnFromPositions[ci * 3 + 1] = from.y;
                selConnFromPositions[ci * 3 + 2] = from.z;
                ci++;
            }
        });
        this.worker.postMessage({ type: 'step', selectedMask, selClusterIdx, selClusterPos,
            selElemPositions, selConnFromPositions, params }, [selClusterPos.buffer, selElemPositions.buffer, selConnFromPositions.buffer]);
    }
    simulate() {
        this.integrate(view.getInputNumber('rbd_dt'));
        if (forceHandler.forces.length > 0)
            forceHandler.redrawTraps();
        // Continue only while this instance is still the active simulator.
        if (rigidClusterSimulator === this) {
            requestAnimationFrame(this.simulate.bind(this));
        }
    }
    dispose() {
        this.disableColliderViz();
        this.world.free();
        this.worker.terminate();
    }
}
const ELEMENT_COLLIDER_RADIUS = 0.5;
class Cluster {
    elements;
    conPoints = [];
    position;
    boundingRadius;
    inertiaMult;
    elementSet;
    sim;
    body;
    bodyRotation = new THREE.Quaternion();
    totalTranslation = new THREE.Vector3();
    totalRotation = new THREE.Quaternion();
    rot_axis;
    constructor(clusterElements, simulator) {
        this.elementSet = clusterElements;
        this.elements = [...clusterElements];
        this.sim = simulator;
        this.position = new THREE.Vector3();
        for (const e of this.elements)
            this.position.add(e.getPos());
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
            simulator.getWorld().createCollider(RAPIER.ColliderDesc.ball(ELEMENT_COLLIDER_RADIUS)
                .setTranslation(lp.x, lp.y, lp.z)
                .setDensity(0).setRestitution(0).setFriction(0), this.body);
        }
        for (const e of this.elements) {
            if (e.n3 && e.n3.clusterId !== e.clusterId)
                this.conPoints.push(new ClusterConnectionPoint(e, e.n3));
            if (e.n5 && e.n5.clusterId !== e.clusterId)
                this.conPoints.push(new ClusterConnectionPoint(e, e.n5));
            forceHandler.getTraps().forEach((t) => {
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
    applyNetTransform(netTrans, netQuat, i) {
        const tx = netTrans[i * 3], ty = netTrans[i * 3 + 1], tz = netTrans[i * 3 + 2];
        translateElements(this.elementSet, _rbdVec.set(tx, ty, tz));
        this.position.x += tx;
        this.position.y += ty;
        this.position.z += tz;
        this.totalTranslation.x += tx;
        this.totalTranslation.y += ty;
        this.totalTranslation.z += tz;
        const qx = netQuat[i * 4], qy = netQuat[i * 4 + 1], qz = netQuat[i * 4 + 2], qw = netQuat[i * 4 + 3];
        const sinHalf = Math.sqrt(qx * qx + qy * qy + qz * qz);
        if (sinHalf > 1e-8) {
            const inv = 1 / sinHalf;
            const angle = 2 * Math.atan2(sinHalf, qw);
            rotateElements(this.elementSet, _rbdVec.set(qx * inv, qy * inv, qz * inv), angle, this.position);
            _rbdQuat.set(qx, qy, qz, qw);
            this.totalRotation.premultiply(_rbdQuat);
            this.bodyRotation.premultiply(_rbdQuat);
        }
        this.rot_axis = this.position.clone();
        this.body.setNextKinematicTranslation({ x: this.position.x, y: this.position.y, z: this.position.z });
        this.body.setNextKinematicRotation({ x: this.bodyRotation.x, y: this.bodyRotation.y, z: this.bodyRotation.z, w: this.bodyRotation.w });
    }
    syncToRapier() {
        this.position.set(0, 0, 0);
        for (const e of this.elements)
            this.position.add(e.getPos());
        this.position.divideScalar(this.elements.length);
        this.body.setNextKinematicTranslation({ x: this.position.x, y: this.position.y, z: this.position.z });
    }
    getClusterElements() { return this.elementSet; }
    getPosition() { return this.position.clone(); }
    getBoundingRadius() { return this.boundingRadius; }
    getTotalTranslation() { return this.totalTranslation.clone(); }
    getTotalRotation() { return this.totalRotation.clone(); }
    getElements() { return this.elements; }
    getRotationAxis() { return this.rot_axis.clone(); }
}
class ClusterConnectionPoint {
    from;
    to;
    constructor(from, to) { this.from = from; this.to = to; }
}
class ColliderVisualizer {
    mesh = null;
    offsetBuffer;
    orderedElements = [];
    constructor(elems) {
        this.orderedElements = elems;
        const N = this.orderedElements.length;
        if (N === 0)
            return;
        this.offsetBuffer = new Float32Array(N * 3);
        const colorBuffer = new Float32Array(N * 3);
        const rotBuffer = new Float32Array(N * 4);
        const scaleBuffer = new Float32Array(N * 3);
        const visBuffer = new Float32Array(N * 3);
        const r = ELEMENT_COLLIDER_RADIUS;
        this.orderedElements.forEach((elem, i) => {
            const pos = elem.getPos();
            this.offsetBuffer[i * 3] = pos.x;
            this.offsetBuffer[i * 3 + 1] = pos.y;
            this.offsetBuffer[i * 3 + 2] = pos.z;
            const col = colorFromInt(elem.clusterId);
            colorBuffer[i * 3] = col.r;
            colorBuffer[i * 3 + 1] = col.g;
            colorBuffer[i * 3 + 2] = col.b;
            rotBuffer[i * 4 + 3] = 1;
            scaleBuffer[i * 3] = scaleBuffer[i * 3 + 1] = scaleBuffer[i * 3 + 2] = r;
            visBuffer[i * 3] = visBuffer[i * 3 + 1] = visBuffer[i * 3 + 2] = 1;
        });
        const geom = new THREE.InstancedBufferGeometry();
        geom.copy(new THREE.SphereBufferGeometry(1, 8, 6));
        geom.addAttribute('instanceOffset', new THREE.InstancedBufferAttribute(this.offsetBuffer, 3));
        geom.addAttribute('instanceColor', new THREE.InstancedBufferAttribute(colorBuffer, 3));
        geom.addAttribute('instanceRotation', new THREE.InstancedBufferAttribute(rotBuffer, 4));
        geom.addAttribute('instanceScale', new THREE.InstancedBufferAttribute(scaleBuffer, 3));
        geom.addAttribute('instanceVisibility', new THREE.InstancedBufferAttribute(visBuffer, 3));
        const mat = instanceMaterial.clone();
        mat.transparent = true;
        mat.opacity = 0.25;
        mat.depthWrite = false;
        mat['defines'] = { 'INSTANCED': '' };
        this.mesh = new THREE.Mesh(geom, mat);
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);
    }
    update() {
        if (!this.mesh)
            return;
        const buf = this.offsetBuffer;
        this.orderedElements.forEach((elem, i) => {
            const pos = elem.getPos();
            buf[i * 3] = pos.x;
            buf[i * 3 + 1] = pos.y;
            buf[i * 3 + 2] = pos.z;
        });
        this.mesh.geometry['attributes']['instanceOffset'].needsUpdate = true;
    }
    dispose() {
        if (!this.mesh)
            return;
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.mesh = null;
    }
}
