function forcesToString() {
    return forces.map(f => f.toString()).join('\n\n');
}
class Force {
    constructor(parsedjson, system) {
        this.sceneObjects = [];
        this.paramKeys = [];
        for (var param in parsedjson) {
            this[param] = parsedjson[param];
            this.paramKeys.push(param);
        }
        this.system = system;
    }
    toString() {
        return `{\n${this.paramKeys.map(i => { return `${i} = ${this[i]}`; }).join('\n')}\n}`;
    }
}
class MutualTrap extends Force {
    constructor() {
        super(...arguments);
        this.type = 'mutual_trap';
    }
    getParticle() {
        return this.system.getElementBySID(this.particle);
    }
    getRefParticle() {
        return this.system.getElementBySID(this.ref_particle);
    }
    update() {
        const p1 = this.getParticle().getInstanceParameter3("bbOffsets"); // position from which to exert the force.
        const p2 = this.getRefParticle().getInstanceParameter3("bbOffsets"); // position to pull towards.
        let dir = p2.clone().sub(p1).normalize();
        this.equilibrium_distances = [
            p1, p1.clone().add(dir.clone().multiplyScalar(this.r0))
        ];
        //draw force 
        dir = p2.clone().sub(p1);
        let force_v = dir.clone().normalize().multiplyScalar((dir.length() - this.r0) * this.stiff);
        dir.normalize();
        this.force = [
            p1, p1.clone().add(dir.multiplyScalar(force_v.length()))
        ];
    }
}
class ForceHandler {
    constructor(mutual_traps) {
        this.sceneObjects = [];
        this.update = () => {
            let v1 = [];
            let v2 = [];
            this.mutual_traps.forEach(f => {
                f.update();
                v1.push(f.force[0].x, f.force[0].y, f.force[0].z);
                v1.push(f.force[1].x, f.force[1].y, f.force[1].z);
                v2.push(f.equilibrium_distances[0].x, f.equilibrium_distances[0].y, f.equilibrium_distances[0].z);
                v2.push(f.equilibrium_distances[1].x, f.equilibrium_distances[1].y, f.equilibrium_distances[1].z);
            });
            this.force_lines.geometry = new THREE.BufferGeometry();
            this.equilibrium_distances_lines.geometry = new THREE.BufferGeometry();
            this.force_lines.geometry.addAttribute('position', new THREE.Float32BufferAttribute(v1, 3));
            this.equilibrium_distances_lines.geometry.addAttribute('position', new THREE.Float32BufferAttribute(v2, 3));
            render();
        };
        this.mutual_traps = mutual_traps;
        let v1 = [];
        let v2 = [];
        let force_geometry = new THREE.BufferGeometry();
        let equilibrium_distances_geometry = new THREE.BufferGeometry();
        this.mutual_traps.forEach(f => {
            v1.push(f.force[0].x, f.force[0].y, f.force[0].z);
            v1.push(f.force[1].x, f.force[1].y, f.force[1].z);
            v2.push(f.equilibrium_distances[0].x, f.equilibrium_distances[0].y, f.equilibrium_distances[0].z);
            v2.push(f.equilibrium_distances[1].x, f.equilibrium_distances[1].y, f.equilibrium_distances[1].z);
        });
        force_geometry.addAttribute('position', new THREE.Float32BufferAttribute(v1, 3));
        let material = new THREE.LineBasicMaterial({ color: 0x050505 });
        this.force_lines = new THREE.LineSegments(force_geometry, material);
        scene.add(this.force_lines);
        this.sceneObjects.push(this.force_lines);
        equilibrium_distances_geometry.addAttribute('position', new THREE.Float32BufferAttribute(v2, 3));
        material = new THREE.LineBasicMaterial({ color: 0x0000ff, opacity: .5 });
        this.equilibrium_distances_lines = new THREE.LineSegments(equilibrium_distances_geometry, material);
        scene.add(this.equilibrium_distances_lines);
        this.sceneObjects.push(this.equilibrium_distances_lines);
        //possibly a better way to fire update
        //trajReader.nextConfig = api.observable.wrap(trajReader.nextConfig, this.update);
        //trajReader.previousConfig = api.observable.wrap(trajReader.previousConfig, this.update);    
    }
    destruct() {
        scene.remove(this.equilibrium_distances_lines);
        scene.remove(this.force_lines);
    }
}
