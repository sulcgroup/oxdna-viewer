function forcesToString() {
    let [newElementIds, ,] = getNewIds();
    return forces.map(f => f.toString(newElementIds)).join('\n\n');
}
class Force {
    constructor() {
        this.sceneObjects = [];
    }
}
class MutualTrap extends Force {
    constructor() {
        super(...arguments);
        this.type = 'mutual_trap';
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
        return `Trap pulling ${this.particle.id} towards ${this.ref_particle.id}`;
    }
    update() {
        const p1 = this.particle.getInstanceParameter3("bbOffsets"); // position from which to exert the force.
        const p2 = this.ref_particle.getInstanceParameter3("bbOffsets"); // position to pull towards.
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
    constructor(forces) {
        this.sceneObjects = [];
        this.set(forces);
    }
    set(forces) {
        // Remove any old geometry (nothing happens if undefined)
        scene.remove(this.equilibrium_distances_lines);
        scene.remove(this.force_lines);
        // We can only draw mutual traps so far:
        this.mutual_traps = forces.filter(f => f.type == 'mutual_trap');
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
    redraw() {
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
    }
}
function makeTrapsFromSelection() {
    let stiffness = parseFloat(document.getElementById("txtForceValue").value);
    let selection = Array.from(selectedBases);
    // For every other element in selection
    for (let i = 0; i < selection.length; i += 2) {
        // If there is another nucleotide in the pair
        if (selection[i + 1] !== undefined) {
            //create mutual trap data for the 2 nucleotides in a pair - selected simultaneously
            let trapA = new MutualTrap();
            trapA.set(selection[i], selection[i + 1], stiffness);
            forces.push(trapA);
            let trapB = new MutualTrap();
            trapB.set(selection[i + 1], selection[i], stiffness);
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
