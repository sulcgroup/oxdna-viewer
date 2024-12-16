function forcesToString(newElementIDs) {
    return forceHandler.forces.map(f => f.toString(newElementIDs)).join('\n\n');
}
class Force {
    type;
    sceneObjects = [];
}
// Forces which can be drawn as a line between two particles
class PairwiseForce extends Force {
}
class MutualTrap extends PairwiseForce {
    type = 'mutual_trap';
    particle; // the particle on which to exert the force.
    ref_particle; // particle to pull towards. Please note that this particle will not feel any force (the name mutual trap is thus misleading).
    stiff; // stiffness of the trap.
    r0; // equilibrium distance of the trap.
    PBC;
    force = [];
    eqDists = [];
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
                if (this[param] === undefined) {
                    const err = `Particle ${parsedjson[param]} in parsed force file does not exist.`;
                    notify(err, "alert");
                    throw (err);
                }
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
        // length and direction of line segement 
        dir = p2.clone().sub(p1);
        let force_v = dir.clone().normalize().multiplyScalar((dir.length() - this.r0) * this.stiff);
        dir.normalize();
        this.force = [
            p1, p1.clone().add(dir.multiplyScalar(force_v.length()))
        ];
    }
}
class SkewTrap extends PairwiseForce {
    type = 'skew_trap';
    particle; // the particle on which to exert the force.
    ref_particle; // particle to pull towards. Please note that this particle will not feel any force (the name mutual trap is thus misleading).
    stdev; // width of the trap potential
    shape; // skew of the trap potential
    r0; // equilibrium distance of the trap.
    PBC;
    eqDists = [];
    force = [];
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
// Forces which can be drawn as a plane
class PlaneForce extends Force {
    set(particles, stiff = 0.09, position = 0, dir = new THREE.Vector3(0, 0, 1)) {
        this.particles = particles;
        this.stiff = stiff;
        this.dir = dir;
        this.position = position;
        this.update();
    }
    setFromParsedJson(parsedjson) {
        for (var param in parsedjson) {
            if (param === 'particle') {
                const particleData = parsedjson[param];
                if (Array.isArray(particleData)) {
                    this.particles = particleData.map(id => elements.get(id)).filter(p => p !== undefined);
                }
                else if (particleData === -1) {
                    this.particles = -1;
                }
                else {
                    const singleParticle = elements.get(particleData);
                    if (singleParticle === undefined) {
                        const err = `Particle ${particleData} in parsed force file does not exist.`;
                        notify(err, "alert");
                        throw (err);
                    }
                    this.particles = [singleParticle];
                }
            }
            else if (param === "dir") {
                const dirData = parsedjson[param];
                if (Array.isArray(dirData) && dirData.length === 3 && dirData.every(num => typeof num === 'number')) {
                    this.dir = new THREE.Vector3(...dirData);
                }
                else {
                    const err = `Invalid dir format: ${dirData}`;
                    notify(err, "alert");
                    throw (err);
                }
            }
            else {
                this[param] = parsedjson[param];
            }
        }
        this.update();
    }
    toJSON() {
        let particleData;
        particleData = Array.isArray(this.particles) ? this.particles.map(p => p.id) : this.particles;
        return {
            type: this.type,
            particle: particleData,
            stiff: this.stiff,
            dir: this.dir,
            position: this.position
        };
    }
    toString(idMap) {
        let particleRepresentation;
        if (Array.isArray(this.particles)) {
            particleRepresentation = this.particles.map(p => idMap ? idMap.get(p) : p.id).join(", ");
        }
        else {
            particleRepresentation = this.particles.toString();
        }
        return (`{
    type = ${this.type}
    particle = ${particleRepresentation}
    stiff = ${this.stiff}
    dir = ${this.dir}
    position = ${this.position}
}`);
    }
    description() {
        if (this.particles === -1) {
            return "Plane trap pulling particle all particles towards itself";
        }
        else {
            let particleRepresentation;
            if (Array.isArray(this.particles)) {
                particleRepresentation = this.particles.map(p => p.id).join(", ");
            }
            else {
                particleRepresentation = this.particles.toString();
            }
            return `Plane trap pulling particles ${particleRepresentation} towards itself`;
        }
    }
    update() {
        // plane position and orientation are persistent, so no need to update
    }
}
class RepulsionPlane extends PlaneForce {
    type = 'repulsion_plane';
    particles = -1; // Can be an array of particles or -1 (all)
    stiff; // stiffness of the harmonic repulsion potential.
    dir;
    position;
}
class AttractionPlane extends PlaneForce {
    type = 'attraction_plane';
    particles = -1; // Can be an array of particles or -1 (all)
    stiff; // stiffness of the harmonic repulsion potential and strength of the attractive force
    dir;
    position;
}
class ForceHandler {
    types;
    knownTrapForces = ['mutual_trap', 'skew_trap']; //these are the forces I know how to draw via lines
    knownPlaneForces = ["repulsion_plane", "attraction_plane"]; //these are the forces I know how to draw via planes
    forceColors = [
        new THREE.Color(0x0000FF),
        new THREE.Color(0xFF0000),
    ];
    planeColors = [
        new THREE.Color(0x00FF00),
        new THREE.Color(0xFF00FF),
    ];
    forceLines = [];
    eqDistLines;
    forcePlanes = [];
    forces = [];
    sceneObjects = [];
    forceTable;
    constructor() { }
    set(forces) {
        this.forces.push(...forces);
        this.drawTraps();
        this.drawPlanes();
    }
    getTraps() {
        return this.forces.filter(f => this.knownTrapForces.includes(f.type));
    }
    getPlanes() {
        return this.forces.filter(f => this.knownPlaneForces.includes(f.type));
    }
    clearForcesFromScene() {
        // Remove any old geometry (nothing happens if undefined)
        this.sceneObjects.forEach(o => scene.remove(o));
        render();
    }
    drawTraps() {
        // find out how many different types there are
        const traps = this.getTraps();
        this.types = Array.from((new Set(traps.map(trap => trap.type))));
        let v1 = [];
        let v2 = [];
        let forceGeoms = [];
        for (let i = 0; i < this.types.length; i++) {
            v1.push([]);
            forceGeoms.push(new THREE.BufferGeometry());
        }
        let eqDistGeom = new THREE.BufferGeometry();
        traps.forEach(f => {
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
    drawPlanes() {
        const planes = this.getPlanes();
        planes.forEach(f => {
            let _extent = 512;
            let _color = this.planeColors[planes.indexOf(f) % this.planeColors.length];
            //  draw text on plane
            let ccanvas = document.createElement('canvas');
            let context = ccanvas.getContext('2d');
            ccanvas.width = _extent;
            ccanvas.height = _extent;
            context.fillStyle = '#' + _color.getHex().toString(16).padStart(6, '0');
            context.fillRect(0, 0, ccanvas.width, ccanvas.height);
            // text on plane
            context.font = '8px Arial';
            context.fillStyle = 'black'; // Text color
            context.textAlign = 'left'; // Align text to the right
            let _text = f.type + "\nposition: " + f.position + "\ndir: " + f.dir.x + " " + f.dir.y + " " + f.dir.z;
            // Split the text into lines and draw each line separately
            let lines = _text.split('\n');
            for (let i = 0; i < lines.length; i++) {
                context.fillText(lines[i], ccanvas.width - 70, ccanvas.height - 10 - (lines.length - 1 - i) * 10);
            }
            // Create plane from canvas
            let texture = new THREE.CanvasTexture(ccanvas);
            let geometry = new THREE.PlaneGeometry(_extent, _extent);
            let material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.5 // Set the desired opacity (0.0 to 1.0)
            });
            let plane = new THREE.Mesh(geometry, material);
            plane.lookAt(f.dir.clone());
            plane.position.set(-f.position * f.dir.x, -f.position * f.dir.y, -f.position * f.dir.z);
            scene.add(plane);
            this.sceneObjects.push(plane);
            this.forcePlanes.push(plane);
        });
    }
    redrawTraps() {
        let v1 = [];
        let v2 = [];
        for (let i = 0; i < this.types.length; i++) {
            v1.push([]);
        }
        this.getTraps().forEach(f => {
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
    const forces = [];
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
    forceHandler.set(forces);
}
function makeTrapsFromPairs() {
    let stiffness = parseFloat(document.getElementById("txtForceValue").value);
    let nopairs = true;
    const forces = [];
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
    forceHandler.set(forces);
    if (forceHandler.forces.length > 0)
        forceHandler.redrawTraps();
}
