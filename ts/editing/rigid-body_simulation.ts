// Global variable for simulator
let rigidClusterSimulator: RigidClusterSimulator;

/**
 * Start rigid-body simulator if it's not already running
 */
function toggleClusterSim() {
    if (!view.getInputBool("clusterSim")) {
        rigidClusterSimulator = null;
        return;
    }
    if (!rigidClusterSimulator) {
        rigidClusterSimulator = new RigidClusterSimulator();
        if (rigidClusterSimulator.getNumberOfClusters() < 2) {
            notify("Please create at least 2 clusters");
            view.toggleWindow("clusteringWindow");
            document.getElementById("clusterSim")["checked"] = false;
            rigidClusterSimulator = null;
            return;
        }
    }
    rigidClusterSimulator.simulate();
}

// http://www.cs.cmu.edu/~baraff/sigcourse/notesd1.pdf
// https://www.toptal.com/game/video-game-physics-part-i-an-introduction-to-rigid-body-dynamics

/**
 *  Put spring forces on the backbone connections that connect the clusters, 
 *  as well as a repulsive force at the centre of each cluster, then simulate
 *  the system with rigid-body dynamics.
 */
class RigidClusterSimulator {
    private clusters: Cluster[] = [];
    clusterRepulsionConst: number; // = 1000;
    connectionRelaxedLength: number; // = 3;
    connectionSpringConst: number; // = 10;
    friction: number; // = 0.25;
    dt: number; // = 0.1;

    constructor() {
        // load settings from view:
        this.clusterRepulsionConst = view.getInputNumber('rbd_clusterRepulsionConst');
        this.connectionRelaxedLength = view.getInputNumber('rbd_connectionRelaxedLength');
        this.connectionSpringConst = view.getInputNumber('rbd_connectionSpringConst');
        this.friction = view.getInputNumber('rbd_friction');
        this.dt = view.getInputNumber('rbd_dt');

        // Create Cluster objects for each cluster label among the elements
        let m = new Map();
        elements.forEach((e) => {
            let c = e.clusterId;
            if (c < 0) {
                return // Ignore cluster noise
            }
            if (!m.has(c)) {
                m.set(c, new Set());
            }
            m.get(c).add(e);
        });
        m.forEach((clusterElements) => {
            this.clusters.push(new Cluster(clusterElements, this));
        });
    };

    public getNumberOfClusters(): number {
        return this.clusters.length;
    }

    /**
     * Simulate one timestep (of length dt)
     * @param dt Timestep length
     */
    public integrate(dt:number) {
        this.clusters.forEach((c) => {
            let intersect = new Set([...selectedBases].filter(i => c.getClusterElements().has(i)));
            if(intersect.size != 0)  return; // don't touch the cluster if it is selected
            // Calculate spring forces between inter-cluster backbone bonds
            c.computeConnectionForces();

            // Calculate simple linear repulsion between clusters
            // If distance is less than sum of radii, push apart.
            this.clusters.forEach((other) => {
                if (c !== other) {
                    let f = c.getPosition().sub(other.getPosition());
                    let dist = f.length();
                    let scalar = Math.max(
                        this.clusterRepulsionConst * (
                            1 - (dist / (c.getRadius() + other.getRadius()))
                        ), 0)
                    f.setLength(scalar);
                    c.addForce(f);
                }    
            });
        });

        // Integrate for each cluster
        this.clusters.forEach((c) => {
            c.integrate(dt);
        });

        // Update transform controls, if neccessary
        if (selectedBases.size > 0 && view.transformMode.enabled()) {
            transformControls.show();
        }
    };

    /**
     * Start simulation and run while checkbox is checked
     */
    public simulate() {
        this.integrate(this.dt);
        if(forceHandler) forceHandler.redraw();
        let shouldContinue = document.getElementById("clusterSim")["checked"];
        if (shouldContinue) {
            requestAnimationFrame(this.simulate.bind(this));
        } else {
            editHistory.add(new RevertableClusterSim(this.clusters));
            console.log("Added simulation result to edit history")
        }
        
    };

}

class Cluster {
    private conPoints: ClusterConnectionPoint[] = [];
    private clusterElements: Set<BasicElement>;
    private sim: RigidClusterSimulator;
    
    private radius: number;
    private mass: number;
    private momentOfInertia_inv: THREE.Matrix3;

    private force: THREE.Vector3;  
    private torque: THREE.Vector3;
    private linearVelocity = new THREE.Vector3(); // v
    private angularVelocity = new THREE.Vector3(); // ω,  Direction is rot axis, magnitude is rot velocity
    private position: THREE.Vector3; // x

    private totalTranslation = new THREE.Vector3();
    private totalRotation = new THREE.Quaternion();
    private rot_axis: THREE.Vector3;

    /**
     * Create a rigid-body cluster from the given set of elements
     * @param clusterElements Set of BasicElements making up the cluster
     */
    constructor(clusterElements: Set<BasicElement>, simulator: RigidClusterSimulator) {
        this.clusterElements = clusterElements;
        this.sim = simulator;
        this.mass = 25;

        this.calculateCenter();

        this.radius = 0;
        clusterElements.forEach((e) => {
            let p = e.getPos();
            this.radius = Math.max(this.radius, p.distanceTo(this.position));
        });

        // http://scienceworld.wolfram.com/physics/MomentofInertiaSphere.html
        this.momentOfInertia_inv = new THREE.Matrix3(); // Identity matrix
        this.momentOfInertia_inv.multiplyScalar(
            5 / (2 * this.mass * Math.pow(this.radius, 2)));


        let traps = forces.filter(f=>f instanceof PairwiseForce);
        clusterElements.forEach((e) => {
            // Pull toghether inter-cluster backbone bonds
            if (e.n3 && e.n3.clusterId !== e.clusterId) {
                this.conPoints.push(new ClusterConnectionPoint(e, e.n3));
            }
            if (e.n5 && e.n5.clusterId !== e.clusterId) {
                this.conPoints.push(new ClusterConnectionPoint(e, e.n5));
            }
            // Pull together inter-cluster traps
            traps.forEach((t: PairwiseForce)=>{
                if (t.particle == e) {
                    this.conPoints.push(new ClusterConnectionPoint(e, t.ref_particle));
                }
            });
        });

        // Initialize forces
        this.force = new THREE.Vector3();
        this.torque = new THREE.Vector3();
    };

    /**
     * Set cluster position to the center of mass of it's elements
     */
    private calculateCenter() {
        this.position = new THREE.Vector3();
        this.clusterElements.forEach((e) => {
            this.position.add(e.getPos());
        });
        this.position.divideScalar(this.clusterElements.size);
    }

    public getClusterElements(): Set<BasicElement> {
        return this.clusterElements;
    }

    public getPosition(): THREE.Vector3 {
        return this.position.clone();
    }

    public getRadius(): number {
        return this.radius;
    }

    public getTotalTranslation(): THREE.Vector3 {
        return this.totalTranslation.clone();
    }

    public getTotalRotation(): THREE.Quaternion {
        return this.totalRotation.clone();
    }

    public getElements(): Set<BasicElement> {
        return this.clusterElements;
    }

    public getRotationAxis(): THREE.Vector3 {
        return this.rot_axis.clone();
    }

    /**
     * Calculate spring forces between inter-cluster backbone bonds
     */
    public computeConnectionForces() {
        this.conPoints.forEach((p) => {
            let scalar = this.sim.connectionSpringConst * (
                p.getDist() - this.sim.connectionRelaxedLength
            );
            let f = p.getToPos().clone().sub(p.getFromPos());
            f.setLength(scalar);
            this.addForce(f, p.getFromPos()); 
        });
    };

    /**
     * Integrate one time-step and update cluster position and orientation
     * depending on the forces that act upon it.
     * @param dt Timestep length
     */
    public integrate(dt: number) {
        // Position needs to be updated if the cluster is dragged manually
        if (view.transformMode.enabled()) {
            this.calculateCenter();
        }

        // Calculate translation
        let linearMomentum = this.force.clone().divideScalar(this.mass);
        this.linearVelocity.add(linearMomentum.clone().multiplyScalar(dt));
        this.linearVelocity.multiplyScalar(1-this.sim.friction);
        let deltaP = this.linearVelocity.clone().multiplyScalar(dt);
        this.position.add(deltaP);

        //rotation axis for undos
        this.rot_axis = this.position.clone();

        // Calculate rotation
        let angularMomentum = this.torque.clone().applyMatrix3(this.momentOfInertia_inv);
        this.angularVelocity.add(angularMomentum.clone().multiplyScalar(dt));
        this.angularVelocity.multiplyScalar(1-this.sim.friction);
        let deltaO = this.angularVelocity.clone().multiplyScalar(dt);

        // Perform transformations
        translateElements(this.clusterElements, deltaP);
        let rotAngle = deltaO.length();
        let rotAxis = deltaO.normalize();
        rotateElements(this.clusterElements, rotAxis, rotAngle, this.position);

        this.totalTranslation.add(deltaP);

        let tempQ = new THREE.Quaternion();
        tempQ.setFromAxisAngle(rotAxis, rotAngle);
        this.totalRotation.premultiply(tempQ);

        // Clear forces
        this.force = new THREE.Vector3();
        this.torque = new THREE.Vector3();
    };

    /**
     * Apply a force to the cluster, optionally at a given point to add torque
     * @param f Force to apply
     * @param r (optional) position at which to apply f (applied at centre-of-mass if not given)
     */
    public addForce(f: THREE.Vector3, r?: THREE.Vector3) {
        this.force.add(f);

        if (r) {
            // Calculate torque
            let t = (r.clone().sub(this.position)).cross(f);
            // Add to local torque
            this.torque.add(t);
        }
    };
}

/**
 * Cluster helper class, defines a connection between clusters
 */
class ClusterConnectionPoint {
    private from: BasicElement; // Local cluster
    private to: BasicElement; // Other cluster

    constructor(from: BasicElement, to: BasicElement) {
        this.from = from;
        this.to = to;
    };

    public getFromPos(): THREE.Vector3 {
        return this.from.getPos().clone();
    }

    public getToPos(): THREE.Vector3 {
        return this.to.getPos().clone();
    }

    public getDist(): number {
        return this.getFromPos().distanceTo(this.getToPos());
    }
}