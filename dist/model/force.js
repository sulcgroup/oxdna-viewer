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
    clearDrawn() {
        this.sceneObjects.forEach(o => {
            scene.remove(o);
        });
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
    draw() {
        const p1 = this.getParticle().getInstanceParameter3("bbOffsets"); // position from which to exert the force.
        const p2 = this.getRefParticle().getInstanceParameter3("bbOffsets"); // position to pull towards.
        let dir = p2.clone().sub(p1).normalize();
        //draw equilibrium distance 
        let equilibrium_distance = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
            p1, p1.clone().add(dir.clone().multiplyScalar(this.r0))
        ]), new THREE.LineBasicMaterial({
            color: 0x0000ff //, //linewidth: stiff
        }));
        equilibrium_distance.name = `mutual_trap_distance ${this.particle}->${this.ref_particle}`;
        scene.add(equilibrium_distance);
        this.sceneObjects.push(equilibrium_distance);
        //draw force 
        dir = p2.clone().sub(p1);
        let force_v = dir.clone().normalize().multiplyScalar((dir.length() - this.r0) * this.stiff);
        dir.normalize();
        let force = new THREE.ArrowHelper(dir, p1, force_v.length(), 0xC0C0C0, .3);
        force.name = `mutual_trap_force ${this.particle}->${this.ref_particle}`;
        scene.add(force);
        this.sceneObjects.push(force);
    }
}
