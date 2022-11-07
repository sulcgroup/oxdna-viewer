function forcesToString() {
    let [newElementIds, ,] = getNewIds();
    return forces.map(f => f.toString(newElementIds)).join('\n\n');
}
class Force {
    constructor() {
        this.sceneObjects = [];
    }
}
// Forces which can be drawn as a line between two particles
class PairwiseForce extends Force {
}
class MutualTrap extends PairwiseForce {
    constructor() {
        super(...arguments);
        this.type = 'mutual_trap';
        this.force = [];
        this.eqDists = [];
    }
    set(particle, ref_particle, stiff = 0.09, r0 = 1.2, PBC = 1) {
        this.particle = particle;
        this.ref_particle = ref_particle;
        this.stiff = stiff;
        this.r0 = r0;
        this.PBC = PBC;
        this.update();
    }
    setFromParsedJson(parsedjson) {
        for (var param in parsedjson) {
            if (['particle', 'ref_particle'].includes(param)) {
                this[param] = elements.get(parsedjson[param]);
            }
            else {
                this[param] = parsedjson[param];
            }
        }
        this.update();
    }
    toJSON() {
        return {
            type: this.type,
            particle: this.particle.id,
            ref_particle: this.ref_particle.id,
            stiff: this.stiff,
            r0: this.r0,
            PBC: this.PBC
        };
    }
    toString(idMap) {
        if (elements.has(this.particle.id) && elements.has(this.ref_particle.id)) {
            return (`{
    type = ${this.type}
    particle = ${idMap ? idMap.get(this.particle) : this.particle.id}
    ref_particle = ${idMap ? idMap.get(this.ref_particle) : this.ref_particle.id}
    stiff = ${this.stiff}
    r0 = ${this.r0}
    PBC = ${this.PBC}
}`);
        }
        else {
            notify(`${this.description()} includes a particle that no longer exists`, 'alert', true);
            return "";
        }
    }
    description() {
        return `Mutual trap pulling ${this.particle.id} towards ${this.ref_particle.id}`;
    }
    update() {
        const p1 = this.particle.getInstanceParameter3("bbOffsets"); // position from which to exert the force.
        const p2 = this.ref_particle.getInstanceParameter3("bbOffsets"); // position to pull towards.
        let dir = p2.clone().sub(p1).normalize();
        this.eqDists = [
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
class SkewTrap extends PairwiseForce {
    constructor() {
        super(...arguments);
        this.type = 'skew_trap';
        this.eqDists = [];
        this.force = [];
    }
    set(particle, ref_particle, stdev = 3.0, shape = -15, r0 = 1.2, PBC = 1) {
        this.particle = particle;
        this.ref_particle = ref_particle;
        this.stdev = stdev;
        this.shape = shape;
        this.r0 = r0;
        this.PBC = PBC;
        this.update();
    }
    setFromParsedJson(parsedjson) {
        for (var param in parsedjson) {
            if (['particle', 'ref_particle'].includes(param)) {
                this[param] = elements.get(parsedjson[param]);
            }
            else {
                this[param] = parsedjson[param];
            }
        }
        this.update();
    }
    toJSON() {
        return {
            type: this.type,
            particle: this.particle.id,
            ref_particle: this.ref_particle.id,
            stdev: this.stdev,
            shape: this.shape,
            r0: this.r0,
            PBC: this.PBC
        };
    }
    toString(idMap) {
        if (elements.has(this.particle.id) && elements.has(this.ref_particle.id)) {
            return (`{
    type = ${this.type}
    particle = ${idMap ? idMap.get(this.particle) : this.particle.id}
    ref_particle = ${idMap ? idMap.get(this.ref_particle) : this.ref_particle.id}
    stdev = ${this.stdev}
    shape = ${this.shape}
    r0 = ${this.r0}
    PBC = ${this.PBC}
}`);
        }
        else {
            notify(`${this.description()} includes a particle that no longer exists`, 'alert', true);
            return "";
        }
    }
    description() {
        return `Skew trap pulling ${this.particle.id} towards ${this.ref_particle.id}`;
    }
    update() {
        const p1 = this.particle.getInstanceParameter3("bbOffsets"); // position from which to exert the force.
        const p2 = this.ref_particle.getInstanceParameter3("bbOffsets"); // position to pull towards.
        let dir = p2.clone().sub(p1).normalize();
        this.eqDists = [
            p1, p1.clone().add(dir.clone().multiplyScalar(this.r0))
        ];
        //draw force 
        dir = p2.clone().sub(p1);
        let force_v = dir.clone().normalize().multiplyScalar((dir.length() - this.r0) * this.stdev);
        dir.normalize();
        this.force = [
            p1, p1.clone().add(dir.multiplyScalar(force_v.length()))
        ];
    }
}
class ForceHandler {
    constructor(forces) {
        this.sceneObjects = [];
        this.forceLines = [];
        this.forceColors = [
            new THREE.Color(0x0000FF),
            new THREE.Color(0xFF0000),
        ];
        this.knownForces = ['mutual_trap', 'skew_trap']; //these are the forces I know how to draw
        this.set(forces);
    }
    set(forces) {
        // Remove any old geometry (nothing happens if undefined)
        scene.remove(this.eqDistLines);
        this.forceLines.forEach(fl => scene.remove(fl));
        // We can only draw pairwise traps so far:
        this.traps = forces.filter(f => this.knownForces.includes(f.type));
        // find out how many different types there are
        this.types = Array.from((new Set(this.traps.map(trap => trap.type))));
        let v1 = [];
        let v2 = [];
        let forceGeoms = [];
        for (let i = 0; i < this.types.length; i++) {
            v1.push([]);
            forceGeoms.push(new THREE.BufferGeometry());
        }
        let eqDistGeom = new THREE.BufferGeometry();
        this.traps.forEach(f => {
            let idx = this.types.findIndex(t => t == f.type);
            v1[idx].push(f.force[0].x, f.force[0].y, f.force[0].z);
            v1[idx].push(f.force[1].x, f.force[1].y, f.force[1].z);
            v2.push(f.eqDists[0].x, f.eqDists[0].y, f.eqDists[0].z);
            v2.push(f.eqDists[1].x, f.eqDists[1].y, f.eqDists[1].z);
        });
        forceGeoms.forEach((g, i) => g.addAttribute('position', new THREE.Float32BufferAttribute(v1[i], 3)));
        let materials = this.types.map((t, i) => new THREE.LineBasicMaterial({ color: this.forceColors[i] }));
        this.forceLines = forceGeoms.map((g, i) => new THREE.LineSegments(g, materials[i]));
        this.forceLines.forEach(fl => {
            scene.add(fl);
            this.sceneObjects.push(fl);
        });
        eqDistGeom.addAttribute('position', new THREE.Float32BufferAttribute(v2, 3));
        materials[0] = new THREE.LineBasicMaterial({ color: 0x0000ff, opacity: .5 });
        this.eqDistLines = new THREE.LineSegments(eqDistGeom, materials[0]);
        scene.add(this.eqDistLines);
        this.sceneObjects.push(this.eqDistLines);
        //possibly a better way to fire update
        //trajReader.nextConfig = api.observable.wrap(trajReader.nextConfig, this.update);
        //trajReader.previousConfig = api.observable.wrap(trajReader.previousConfig, this.update);    
    }
    redraw() {
        let v1 = [];
        let v2 = [];
        for (let i = 0; i < this.types.length; i++) {
            v1.push([]);
        }
        this.traps.forEach(f => {
            f.update();
            let idx = this.types.findIndex(t => t == f.type);
            v1[idx].push(f.force[0].x, f.force[0].y, f.force[0].z);
            v1[idx].push(f.force[1].x, f.force[1].y, f.force[1].z);
            v2.push(f.eqDists[0].x, f.eqDists[0].y, f.eqDists[0].z);
            v2.push(f.eqDists[1].x, f.eqDists[1].y, f.eqDists[1].z);
        });
        this.types.forEach((t, i) => {
            this.forceLines[i].geometry = new THREE.BufferGeometry();
            let a = this.forceLines[i].geometry;
            a.addAttribute('position', new THREE.Float32BufferAttribute(v1[i], 3));
        });
        this.eqDistLines.geometry = new THREE.BufferGeometry();
        this.eqDistLines.geometry.addAttribute('position', new THREE.Float32BufferAttribute(v2, 3));
        render();
    }
}
function makeTrapsFromSelection() {
    let stiffness = parseFloat(document.getElementById("txtForceValue").value);
    let r0 = parseFloat(document.getElementById('r0').value);
    let selection = Array.from(selectedBases);
    // For every other element in selection
    for (let i = 0; i < selection.length; i += 2) {
        // If there is another nucleotide in the pair
        if (selection[i + 1] !== undefined) {
            //create mutual trap data for the 2 nucleotides in a pair - selected simultaneously
            let trapA = new MutualTrap();
            trapA.set(selection[i], selection[i + 1], stiffness, r0);
            forces.push(trapA);
            let trapB = new MutualTrap();
            trapB.set(selection[i + 1], selection[i], stiffness, r0);
            forces.push(trapB);
        }
        else {
            //if there is no 2nd nucleotide in the pair
            notify("The last selected base does not have a pair and thus cannot be included in the Mutual Trap File."); //give error message
        }
    }
    if (!forceHandler) {
        forceHandler = new ForceHandler(forces);
    }
    else {
        forceHandler.set(forces);
    }
}
function makeTrapsFromPairs() {
    let stiffness = parseFloat(document.getElementById("txtForceValue").value);
    let nopairs = true;
    elements.forEach(e => {
        // If element is paired, add a trap
        if (e.isPaired()) {
            let trap = new MutualTrap();
            trap.set(e, e.pair, stiffness);
            forces.push(trap);
            nopairs = false;
        }
    });
    if (nopairs) {
        ask("No basepair info found", "Do you want to run an automatic basepair search?", () => {
            view.longCalculation(findBasepairs, view.basepairMessage, () => {
                makeTrapsFromPairs();
                listForces(); // recall this as we now have pairs
            });
        });
    }
    if (!forceHandler) {
        forceHandler = new ForceHandler(forces);
    }
    else {
        forceHandler.set(forces);
    }
    if (forceHandler)
        forceHandler.redraw();
}
