function forcesToString(newElementIDs) {
    return forceHandler.forces.map(f => f.toString(newElementIDs)).join('\n\n');
}
class Force {
    type;
    sceneObjects = [];
}
// Forces which can be drawn as a line between two particles
class PairwiseForce extends Force {
    equals(compareForce) {
        if (!(compareForce instanceof PairwiseForce)) {
            return false;
        }
        return (this.particle === compareForce.particle &&
            this.ref_particle === compareForce.ref_particle);
    }
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
    equals(compareForce) {
        if (!(compareForce instanceof MutualTrap)) {
            return false;
        }
        return (this.particle === compareForce.particle &&
            this.ref_particle === compareForce.ref_particle &&
            this.stiff === compareForce.stiff &&
            this.r0 === compareForce.r0 &&
            this.PBC === compareForce.PBC);
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
class Box extends Force {
    type = "Box";
    center = new THREE.Vector3(0, 0, 0);
    lx = 1;
    ly = 1;
    lz = 1;
    mesh;
    outline;
    setFromParsedJson(parsedjson) {
        for (const param in parsedjson) {
            if (param === "center") {
                const c = parsedjson[param];
                this.center = new THREE.Vector3(c[0], c[1], c[2]);
            }
            else {
                this[param] = parsedjson[param]; // if this file is truly TS
                // if this is actually JS at runtime, use: this[param] = parsedjson[param];
            }
        }
        this.update();
    }
    update() {
        // no-op unless you want animated boxes
    }
    toString() {
        return `{
type = ${this.type}
center = ${this.center.x},${this.center.y},${this.center.z}
lx = ${this.lx}
ly = ${this.ly}
lz = ${this.lz}
}`;
    }
    description() {
        return "Box";
    }
}
// expose globally if aux_readers.js is not a module
window.Box = Box;
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
    equals(compareForce) {
        if (!(compareForce instanceof SkewTrap)) {
            return false;
        }
        return (this.particle === compareForce.particle &&
            this.ref_particle === compareForce.ref_particle &&
            this.stdev === compareForce.stdev &&
            this.shape === compareForce.shape &&
            this.r0 === compareForce.r0 &&
            this.PBC === compareForce.PBC);
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
/**
* String force (oxDNA external force file: type = string).
*
* A constant (or linearly time-varying) force applied to one or more particles.
* The direction can be fixed (dir) or can be interpreted as a centre/origin
* (dir_as_centre=true), in which case each particle is pulled along (dir - pos).
*
* Viewer rendering:
*  - for each targeted particle, draw an arrow centered at the midpoint between
*    the particle position and the arrow tip.
*/
class StringForce extends Force {
    type = "string";
    // oxDNA params
    particles = -1; // -1 (all) or array<BasicElement>
    F0 = 0.0;
    rate = 0.0;
    dir = new THREE.Vector3(0, 0, 1);
    dir_as_centre = false;
    // viewer state
    _arrowGroups = [];
    _color = new THREE.Color(0x00bfff);
    _shaftRadius = 0.15;
    _headRadius = 0.30;
    _headHeight = 2.60;
    _minLen = 1e-6;
    // Optional scaling so forces aren't absurdly long in the viewer.
    // Leave at 1.0 to interpret F directly as length.
    lengthScale = 10.0;
    set(particles, F0 = 0.0, rate = 0.0, dir = new THREE.Vector3(0, 0, 1), dir_as_centre = false) {
        this.particles = particles;
        this.F0 = F0;
        this.rate = rate;
        this.dir = dir.clone().normalize();
        this.dir_as_centre = !!dir_as_centre;
        this.update();
    }
    equals(compareForce) {
        if (!(compareForce instanceof StringForce))
            return false;
        const sameParticles = this.particles === compareForce.particles;
        return (sameParticles &&
            this.F0 === compareForce.F0 &&
            this.rate === compareForce.rate &&
            this.dir_as_centre === compareForce.dir_as_centre &&
            this.dir.equals(compareForce.dir));
    }
    _currentSimStep() {
        // Match the heuristic used for spheres/planes.
        let step = 0;
        try {
            const sys = (typeof systems !== 'undefined' && systems.length > 0)
                ? systems[systems.length - 1]
                : undefined;
            const r = sys?.reader;
            step =
                (Number.isFinite(r?.frameIndex) ? r.frameIndex :
                    Number.isFinite(r?.current) ? r.current :
                        Number.isFinite(r?.frame) ? r.frame : 0);
        }
        catch (_) { }
        if (typeof window !== 'undefined') {
            const w = window;
            if (Number.isFinite(w.currentFrameIndex))
                step = w.currentFrameIndex;
            if (Number.isFinite(w.currentSimTime))
                step = w.currentSimTime;
        }
        return step;
    }
    _getAllParticles() {
        const out = [];
        try {
            elements.forEach((e) => out.push(e));
        }
        catch (_) { }
        return out;
    }
    _strandKey(e) {
        if (!e)
            return undefined;
        return (e.strandId ??
            e.strand_id ??
            e.strand ??
            e.parentStrand?.id ??
            e.parent?.strandId ??
            undefined);
    }
    /**
    * Parse particle selector:
    *  - -1 or "all" => all particles
    *  - array of ids => those ids
    *  - string like "1,2,5-7" => ids; ranges are expanded only if endpoints share a strand key.
    */
    _parseParticleSpec(v) {
        if (v === -1 || v === 'all')
            return -1;
        if (Array.isArray(v)) {
            return v.map((id) => elements.get(id)).filter(Boolean);
        }
        if (typeof v === 'number') {
            const el = elements.get(v);
            if (!el) {
                const err = `Particle ${v} in parsed force file does not exist.`;
                notify(err, 'alert');
                throw err;
            }
            return [el];
        }
        if (typeof v !== 'string') {
            return -1;
        }
        const tokens = v.split(',').map(s => s.trim()).filter(Boolean);
        const ids = [];
        for (const tok of tokens) {
            if (tok.includes('-')) {
                const [aRaw, bRaw] = tok.split('-').map(s => s.trim());
                const a = Number(aRaw);
                const b = Number(bRaw);
                if (!Number.isFinite(a) || !Number.isFinite(b))
                    continue;
                const elA = elements.get(a);
                const elB = elements.get(b);
                if (!elA || !elB) {
                    // fall back: include endpoints only
                    if (elA)
                        ids.push(a);
                    if (elB)
                        ids.push(b);
                    continue;
                }
                const kA = this._strandKey(elA);
                const kB = this._strandKey(elB);
                if (kA !== undefined && kA === kB) {
                    const lo = Math.min(a, b);
                    const hi = Math.max(a, b);
                    for (let x = lo; x <= hi; x++)
                        ids.push(x);
                }
                else {
                    // Not on the same strand (or unknown) -> include endpoints only.
                    ids.push(a, b);
                }
            }
            else {
                const id = Number(tok);
                if (Number.isFinite(id))
                    ids.push(id);
            }
        }
        const uniq = Array.from(new Set(ids));
        return uniq.map(id => elements.get(id)).filter(Boolean);
    }
    setFromParsedJson(parsedjson) {
        for (const param in parsedjson) {
            const v = parsedjson[param];
            if (param === 'particle' || param === 'particles') {
                this.particles = this._parseParticleSpec(v);
            }
            else if (param === 'dir') {
                if (Array.isArray(v) && v.length === 3) {
                    this.dir = new THREE.Vector3(+v[0], +v[1], +v[2]).normalize();
                }
                else if (typeof v === 'string') {
                    const parts = v.split(',').map(Number);
                    if (parts.length >= 3 && parts.every(n => Number.isFinite(n))) {
                        this.dir = new THREE.Vector3(parts[0], parts[1], parts[2]).normalize();
                    }
                }
            }
            else if (param === 'dir_as_centre') {
                this.dir_as_centre = !!v;
            }
            else if (param === 'F0') {
                this.F0 = +v;
            }
            else if (param === 'rate') {
                this.rate = +v;
            }
            else if (param === 'lengthScale') {
                this.lengthScale = +v;
            }
            else {
                this[param] = v;
            }
        }
        this.update();
    }
    _ensureArrowGroup(i) {
        if (this._arrowGroups[i])
            return this._arrowGroups[i];
        // shaft is a unit cylinder along +Y; we'll scale Y to arrow length.
        const shaftGeom = new THREE.CylinderGeometry(this._shaftRadius, this._shaftRadius, 1, 10);
        const headGeom = new THREE.ConeGeometry(this._headRadius, this._headHeight, 12);
        const mat = new THREE.MeshBasicMaterial({ color: this._color, transparent: true, opacity: 0.95 });
        const shaft = new THREE.Mesh(shaftGeom, mat);
        const head = new THREE.Mesh(headGeom, mat);
        head.position.set(0, 0.5 + this._headHeight / 2, 0);
        const g = new THREE.Group();
        g.add(shaft);
        g.add(head);
        this._arrowGroups[i] = g;
        return g;
    }
    /** Update arrow geometry for current frame. */
    update() {
        const step = this._currentSimStep();
        const VISUAL_FORCE_SCALE = 10.0; // <-- THIS is the important knob
        const mag = (this.F0 + this.rate * step);
        const len = Math.max(Math.abs(mag) * VISUAL_FORCE_SCALE, this._minLen);
        const plist = (this.particles === -1)
            ? this._getAllParticles()
            : this.particles;
        for (let i = 0; i < plist.length; i++) {
            const p = plist[i];
            const pos = p.getInstanceParameter3('bbOffsets');
            // direction: fixed dir OR (dir - pos) if dir_as_centre
            const dirVec = this.dir_as_centre
                ? this.dir.clone().sub(pos).normalize()
                : this.dir.clone();
            const tip = pos.clone().add(dirVec.clone().multiplyScalar(len));
            const mid = pos.clone().add(tip).multiplyScalar(0.5);
            const g = this._ensureArrowGroup(i);
            const yAxis = new THREE.Vector3(0, 1, 0);
            const q = new THREE.Quaternion().setFromUnitVectors(yAxis, dirVec);
            g.quaternion.copy(q);
            // scale Y to length; keep X/Z at 1 (geometry already has desired radii)
            g.scale.set(1, len, 1);
            g.position.copy(mid);
        }
    }
    toJSON() {
        const particleData = Array.isArray(this.particles) ? this.particles.map(p => p.id) : this.particles;
        return {
            type: this.type,
            particle: particleData,
            F0: this.F0,
            rate: this.rate,
            dir: [this.dir.x, this.dir.y, this.dir.z],
            ...(this.dir_as_centre ? { dir_as_centre: true } : {}),
            ...(this.lengthScale !== 1.0 ? { lengthScale: this.lengthScale } : {}),
        };
    }
    toString(idMap) {
        const particleRep = Array.isArray(this.particles)
            ? this.particles.map(p => (idMap ? idMap.get(p) : p.id)).join(',')
            : this.particles.toString();
        return `{
    type = ${this.type}
    particle = ${particleRep}
    F0 = ${this.F0}
    rate = ${this.rate}
    dir = ${this.dir.x}, ${this.dir.y}, ${this.dir.z}
    ${this.dir_as_centre ? 'dir_as_centre = true' : ''}
}`;
    }
    description() {
        const target = Array.isArray(this.particles)
            ? `${this.particles.length} particles`
            : (this.particles === -1 ? 'all particles' : `${this.particles}`);
        return `String force (F0=${this.F0}, rate=${this.rate}) on ${target}`;
    }
    /** Expose arrow groups for ForceHandler to add/remove from scene. */
    _getArrowGroups() {
        return this._arrowGroups;
    }
    /** Clear cached viewer geometry (called by ForceHandler when removing forces). */
    _clearViewerObjects() {
        this._arrowGroups = [];
    }
}
class COMForce extends Force {
    type = "com";
    // groups (elements participating in each COM)
    com_list = [];
    ref_list = [];
    // parameters
    stiff = 0.09;
    r0 = 1.2;
    rate = 0.0;
    // for drawing like other traps (two line segments)
    //  - eqDists: from COM toward REF with length r0
    //  - force:   from COM in direction of REF, scaled by |(d - (r0+rate*step)) * stiff / |com_list||
    eqDists = [];
    force = [];
    set(comList, refList, stiff = 0.09, r0 = 1.2, rate = 0.0) {
        this.com_list = comList;
        this.ref_list = refList;
        this.stiff = stiff;
        this.r0 = r0;
        this.rate = rate;
        this.update();
    }
    setFromParsedJson(parsedjson) {
        for (const param in parsedjson) {
            if (param === 'com_list' || param === 'ref_list') {
                const arr = parsedjson[param];
                if (!Array.isArray(arr)) {
                    const err = `Invalid ${param}: expected an array of element IDs`;
                    notify(err, "alert");
                    throw err;
                }
                // map IDs → elements; drop undefineds but error if ends empty
                this[param] = arr
                    .map((id) => elements.get(id))
                    .filter((p) => p !== undefined);
                if (this[param].length === 0) {
                    const err = `${param} is empty or contains invalid IDs`;
                    notify(err, "alert");
                    throw err;
                }
            }
            else {
                this[param] = parsedjson[param];
            }
        }
        this.update();
    }
    avg(list) {
        const v = new THREE.Vector3(0, 0, 0);
        if (!Array.isArray(list) || list.length === 0)
            return v;
        list.forEach(p => v.add(p.getInstanceParameter3("bbOffsets")));
        v.multiplyScalar(1.0 / list.length);
        return v;
    }
    update() {
        // compute COMs from current element positions
        const com = this.avg(this.com_list);
        const ref = this.avg(this.ref_list);
        // direction COM -> REF
        const d = ref.clone().sub(com);
        const dist = d.length();
        const dir = dist > 0 ? d.clone().divideScalar(dist) : new THREE.Vector3(1, 0, 0);
        // viewer step index (falls back to 0 if not wired)
        const step = window?.currentFrameIndex ?? 0;
        const target = this.r0 + this.rate * step;
        // set “equilibrium” segment (visual, length r0)
        this.eqDists = [com.clone(), com.clone().add(dir.clone().multiplyScalar(this.r0))];
        // magnitude matches oxDNA: (|d| - (r0 + rate*step)) * stiff / |com_list|
        const denom = Math.max(this.com_list.length, 1);
        const mag = (dist - target) * this.stiff / denom;
        // force segment (purely for drawing)
        this.force = [com.clone(), com.clone().add(dir.clone().multiplyScalar(Math.abs(mag)))];
    }
    toJSON() {
        return {
            type: this.type,
            com_list: this.com_list.map(p => p.id),
            ref_list: this.ref_list.map(p => p.id),
            stiff: this.stiff,
            r0: this.r0,
            rate: this.rate
        };
    }
    toString(idMap) {
        const ids = (arr) => arr.map(p => idMap ? idMap.get(p) : p.id).join(' ');
        return `{
    type = ${this.type}
    com_list = ${ids(this.com_list)}
    ref_list = ${ids(this.ref_list)}
    stiff = ${this.stiff}
    r0 = ${this.r0}
    rate = ${this.rate}
}`;
    }
    description() {
        return `COM force between groups (${this.com_list.length}) → (${this.ref_list.length})`;
    }
}
// Forces which can be drawn as a plane
class PlaneForce extends Force {
    _mesh;
    _pointOnPlane;
    equals(compareForce) {
        if (!(compareForce instanceof PlaneForce)) {
            return false;
        }
        return (this.particles === compareForce.particles &&
            this.dir === compareForce.dir &&
            this.position === compareForce.position &&
            this.stiff === compareForce.stiff);
    }
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
                    this.dir = new THREE.Vector3(...dirData).normalize();
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
class RepulsionPlaneMoving extends PlaneForce {
    type = 'repulsion_plane_moving';
    ref_particles = []; // adjust BasicElement import/type as in your repo
    setFromParsedJson(parsedjson) {
        for (const param in parsedjson) {
            if (param === 'particle') {
                const v = parsedjson[param];
                if (Array.isArray(v)) {
                    this.particles = v.map((id) => elements.get(id)).filter(Boolean);
                }
                else if (v === -1 || v === 'all') {
                    this.particles = -1;
                }
                else {
                    const el = elements.get(v);
                    if (!el) {
                        const err = `Particle ${v} in parsed force file does not exist.`;
                        notify(err, "alert");
                        throw err;
                    }
                    this.particles = [el];
                }
            }
            else if (param === 'ref_particle') {
                const arr = Array.isArray(parsedjson[param]) ? parsedjson[param]
                    : (typeof parsedjson[param] === 'string' ? parsedjson[param].split(',').map((s) => +s)
                        : [parsedjson[param]]);
                this.ref_particles = arr.map((id) => elements.get(id)).filter(Boolean);
            }
            else if (param === 'dir') {
                const d = parsedjson[param];
                this.dir = new THREE.Vector3(d[0], d[1], d[2]).normalize();
            }
            else {
                this[param] = parsedjson[param];
            }
        }
        this.update();
    }
    _avgRef() {
        const v = new THREE.Vector3(0, 0, 0);
        if (!Array.isArray(this.ref_particles) || this.ref_particles.length === 0)
            return v;
        this.ref_particles.forEach(p => v.add(p.getInstanceParameter3("bbOffsets")));
        v.multiplyScalar(1.0 / this.ref_particles.length);
        return v;
    }
    update() {
        const pbar = this._avgRef();
        this.position = -this.dir.dot(pbar);
        this._pointOnPlane = pbar;
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
class RepulsiveSphere extends Force {
    type = 'sphere';
    // oxDNA fields
    particles; // -1 | list of elements (like PlaneForce)
    stiff;
    r0;
    rate;
    center = new THREE.Vector3(0, 0, 0);
    // viewer state
    currentRadius;
    mesh; // the translucent sphere
    outline; // optional edges outline for clarity
    set(particles, stiff = 10, r0 = 6, rate = 0, center = new THREE.Vector3(0, 0, 0)) {
        this.particles = particles;
        this.stiff = stiff;
        this.r0 = r0;
        this.rate = rate;
        this.center = center;
        this.currentRadius = r0;
        this.update();
    }
    setFromParsedJson(parsedjson) {
        for (const param in parsedjson) {
            if (param === 'particle') {
                const v = parsedjson[param];
                if (Array.isArray(v)) {
                    this.particles = v.map(id => elements.get(id)).filter(p => p !== undefined);
                }
                else if (v === -1 || v === 'all') {
                    this.particles = -1;
                }
                else if (typeof v === 'string' && v.includes('-')) {
                    // optional: expand simple ranges "5-7"
                    const [a, b] = v.split('-').map(Number);
                    const ids = [];
                    for (let k = a; k <= b; k++)
                        ids.push(k);
                    this.particles = ids.map(id => elements.get(id)).filter(p => p !== undefined);
                }
                else if (typeof v === 'number') {
                    const el = elements.get(v);
                    if (!el) {
                        const err = `Particle ${v} in parsed force file does not exist.`;
                        notify(err, "alert");
                        throw (err);
                    }
                    this.particles = [el];
                }
            }
            else if (param === 'center') {
                const c = parsedjson[param];
                this.center = new THREE.Vector3(c[0], c[1], c[2]);
            }
            else {
                this[param] = parsedjson[param];
            }
        }
        this.currentRadius = this.r0;
        this.update();
    }
    // compute current radius from frame index (assumes global current frame/step is accessible)
    update() {
        // If your app exposes a current frame index or MD step, use it here.
        // Many viewers increment on redraw; fall back to r0 if unknown.
        const step = window?.currentFrameIndex ?? 0;
        this.currentRadius = this.r0 + this.rate * step;
    }
    toJSON() {
        const particleData = Array.isArray(this.particles) ? this.particles.map(p => p.id) : this.particles;
        return {
            type: this.type,
            particle: particleData,
            stiff: this.stiff,
            r0: this.r0,
            rate: this.rate,
            center: [this.center.x, this.center.y, this.center.z],
        };
    }
    toString(idMap) {
        const particleRepresentation = Array.isArray(this.particles)
            ? this.particles.map(p => idMap ? idMap.get(p) : p.id).join(", ")
            : this.particles.toString();
        return (`{
        type = ${this.type}
        particle = ${particleRepresentation}
        center = ${this.center.x},${this.center.y},${this.center.z}
        stiff = ${this.stiff}
        rate = ${this.rate}
        r0 = ${this.r0}
}`);
    }
    description() {
        const target = Array.isArray(this.particles) ? `${this.particles.length} particles` : (this.particles === -1 ? "all particles" : `${this.particles}`);
        return `Repulsive sphere @ ${this.center.toArray().map(n => n.toFixed(2)).join(',')} on ${target}`;
    }
}
class RepulsiveEllipsoid extends Force {
    type = 'ellipsoid';
    particles = -1;
    stiff = 10.0;
    rate;
    outerAxes = new THREE.Vector3(6, 6, 6); // r_2
    innerAxes = null; // r_1 (optional)
    center = new THREE.Vector3(0, 0, 0);
    _baseOuterAxes;
    currentScale;
    mesh;
    outline;
    _baseRadius = 1.0;
    constructor() {
        super();
    }
    set(particles, stiff, r2Vec, r1Vec = null, center = new THREE.Vector3(0, 0, 0)) {
        this.particles = particles;
        this.stiff = stiff;
        this.outerAxes = r2Vec.clone();
        this.innerAxes = r1Vec ? r1Vec.clone() : null;
        this.center = center.clone();
    }
    setFromParsedJson(parsedjson) {
        for (const param in parsedjson) {
            const v = parsedjson[param];
            if (param === 'particle') {
                if (Array.isArray(v)) {
                    this.particles = v.map((id) => elements.get(id)).filter((p) => p !== undefined);
                }
                else if (v === -1 || v === 'all') {
                    this.particles = -1;
                }
                else if (typeof v === 'string' && v.includes('-')) {
                    const [a, b] = v.split('-').map(Number);
                    const ids = [];
                    for (let k = a; k <= b; k++)
                        ids.push(k);
                    this.particles = ids.map(id => elements.get(id)).filter(p => p !== undefined);
                }
                else {
                    const el = elements.get(v);
                    if (!el) {
                        const err = `Particle ${v} in parsed force file does not exist.`;
                        notify(err, "alert");
                        throw err;
                    }
                    this.particles = [el];
                }
            }
            else if (param === 'center') {
                const c = Array.isArray(v) ? v : v.split(',').map(Number);
                this.center = new THREE.Vector3(c[0], c[1], c[2]);
            }
            else if (param === 'r_2') {
                const r2 = Array.isArray(v) ? v : v.split(',').map(Number);
                this.outerAxes = new THREE.Vector3(r2[0], r2[1], r2[2]);
            }
            else if (param === 'r_1') {
                const r1 = Array.isArray(v) ? v : v.split(',').map(Number);
                this.innerAxes = new THREE.Vector3(r1[0], r1[1], r1[2]);
            }
            else {
                this[param] = v;
            }
        }
    }
    update() {
        // placeholder: static ellipsoid, no time dependence
    }
    toJSON() {
        const particleData = Array.isArray(this.particles)
            ? this.particles.map(p => p.id)
            : this.particles;
        return {
            type: this.type,
            particle: particleData,
            stiff: this.stiff,
            r_2: [this.outerAxes.x, this.outerAxes.y, this.outerAxes.z],
            ...(this.innerAxes ? { r_1: [this.innerAxes.x, this.innerAxes.y, this.innerAxes.z] } : {}),
            center: [this.center.x, this.center.y, this.center.z],
        };
    }
    toString(idMap) {
        const particleRepresentation = Array.isArray(this.particles)
            ? this.particles.map(p => idMap ? idMap.get(p) : p.id).join(", ")
            : this.particles.toString();
        const innerStr = this.innerAxes
            ? `\n  r_1 = ${this.innerAxes.x},${this.innerAxes.y},${this.innerAxes.z}`
            : "";
        return `{
            type = ${this.type}
            particle = ${particleRepresentation}
            center = ${this.center.x},${this.center.y},${this.center.z}
            stiff = ${this.stiff}
            r_2 = ${this.outerAxes.x},${this.outerAxes.y},${this.outerAxes.z}${innerStr}
        }`;
    }
    description() {
        const target = Array.isArray(this.particles)
            ? `${this.particles.length} particles`
            : (this.particles === -1 ? "all particles" : `${this.particles}`);
        return `Repulsive ellipsoid @ ${this.center
            .toArray()
            .map(n => Number(n).toFixed(2))
            .join(',')} (r2=${this.outerAxes
            .toArray()
            .map(n => Number(n).toFixed(2))
            .join(',')}) on ${target}`;
    }
}
class RepulsiveKeplerPoinsot extends Force {
    type = 'repulsive_kepler_poinsot';
    particles = -1;
    stiff = 10.0;
    rate = 0.0;
    center = new THREE.Vector3(0, 0, 0);
    // Geometry at step 0 (simulation units)
    apex = 1.20;
    base = 0.70;
    base_radius = 0.45;
    // Optional smoothing parameter (not used for drawing, but kept for round-trip)
    kappa = 25.0;
    // Viewer state
    currentScale = 1.0;
    group;
    constructor() {
        super();
    }
    setFromParsedJson(parsedjson) {
        const vec3From = (val, fallback) => {
            if (Array.isArray(val) && val.length >= 3) {
                return new THREE.Vector3(Number(val[0]), Number(val[1]), Number(val[2]));
            }
            if (typeof val === 'string') {
                const parts = val.split(',').map(Number);
                if (parts.length >= 3 && parts.every(n => Number.isFinite(n))) {
                    return new THREE.Vector3(parts[0], parts[1], parts[2]);
                }
            }
            return fallback.clone();
        };
        for (const param in parsedjson) {
            const v = parsedjson[param];
            if (param === 'particle') {
                if (Array.isArray(v)) {
                    this.particles = v
                        .map((id) => elements.get(id))
                        .filter((p) => p !== undefined);
                }
                else if (v === -1 || v === 'all') {
                    this.particles = -1;
                }
                else if (typeof v === 'string' && v.includes('-')) {
                    const [a, b] = v.split('-').map(Number);
                    const ids = [];
                    for (let k = a; k <= b; k++)
                        ids.push(k);
                    this.particles = ids.map(id => elements.get(id)).filter(p => p !== undefined);
                }
                else {
                    const el = elements.get(v);
                    if (!el) {
                        const err = `Particle ${v} in parsed force file does not exist.`;
                        notify(err, "alert");
                        throw err;
                    }
                    this.particles = [el];
                }
            }
            else if (param === 'center' || param === 'centre') {
                this.center = vec3From(v, this.center);
            }
            else if (param === 'stiff') {
                this.stiff = Number(v);
            }
            else if (param === 'rate') {
                this.rate = Number(v);
            }
            else if (param === 'apex') {
                this.apex = Number(v);
            }
            else if (param === 'base') {
                this.base = Number(v);
            }
            else if (param === 'base_radius') {
                this.base_radius = Number(v);
            }
            else if (param === 'kappa') {
                this.kappa = Number(v);
            }
        }
    }
    update() {
        // oxDNA applies growth = 1 + rate * step (see RepulsiveKeplerPoinsot::value()).
        // We mirror the same behavior using the viewer's best-guess current frame/step.
        const step = window?.currentSimTime ?? window?.currentFrameIndex ?? 0;
        const growth = 1.0 + (Number(this.rate) || 0) * Number(step || 0);
        this.currentScale = (Number.isFinite(growth) && growth > 0) ? growth : 0.0;
        console.log("Kepler Step:", step);
    }
    toString(idMap) {
        const particleRepresentation = Array.isArray(this.particles)
            ? this.particles.map(p => idMap ? idMap.get(p) : p.id).join(", ")
            : this.particles.toString();
        return (`{
type = ${this.type}
particle = ${particleRepresentation}
stiff = ${this.stiff}
rate = ${this.rate}
center = ${this.center.toArray().join(',')}
apex = ${this.apex}
base = ${this.base}
base_radius = ${this.base_radius}
kappa = ${this.kappa}
}`);
    }
    description() {
        const target = Array.isArray(this.particles)
            ? `${this.particles.length} particles`
            : (this.particles === -1 ? "all particles" : `${this.particles}`);
        return `Repulsive Kepler–Poinsot star @ ${this.center.toArray().map(n => n.toFixed(2)).join(',')} on ${target}`;
    }
}
class RepulsiveSphereMoving extends Force {
    type = 'repulsive_sphere_moving';
    // oxDNA fields
    particles; // -1 | list of elements (like PlaneForce)
    stiff;
    r0;
    rate;
    origin = new THREE.Vector3(0, 0, 0);
    target = new THREE.Vector3(0, 0, 0);
    moveSteps;
    // viewer state
    currentRadius;
    currentCenter;
    mesh; // the translucent sphere
    outline; // optional edges outline for clarity
    set(particles, stiff = 10, r0 = 6, rate = 0, origin = new THREE.Vector3(0, 0, 0)) {
        this.particles = particles;
        this.stiff = stiff;
        this.r0 = r0;
        this.rate = rate;
        this.origin = origin;
        this.currentRadius = r0;
        this.update();
    }
    setFromParsedJson(parsedjson) {
        for (const param in parsedjson) {
            if (param === 'particle') {
                const v = parsedjson[param];
                if (Array.isArray(v)) {
                    this.particles = v.map(id => elements.get(id)).filter(p => p !== undefined);
                }
                else if (v === -1 || v === 'all') {
                    this.particles = -1;
                }
                else if (typeof v === 'string' && v.includes('-')) {
                    // optional: expand simple ranges "5-7"
                    const [a, b] = v.split('-').map(Number);
                    const ids = [];
                    for (let k = a; k <= b; k++)
                        ids.push(k);
                    this.particles = ids.map(id => elements.get(id)).filter(p => p !== undefined);
                }
                else if (typeof v === 'number') {
                    const el = elements.get(v);
                    if (!el) {
                        const err = `Particle ${v} in parsed force file does not exist.`;
                        notify(err, "alert");
                        throw (err);
                    }
                    this.particles = [el];
                }
            }
            else if (param === 'origin') {
                const c = parsedjson[param];
                this.origin = new THREE.Vector3(c[0], c[1], c[2]);
            }
            else {
                this[param] = parsedjson[param];
            }
        }
        this.currentRadius = this.r0;
        this.update();
    }
    // compute current radius from frame index (assumes global current frame/step is accessible)
    update() {
        // If your app exposes a current frame index or MD step, use it here.
        // Many viewers increment on redraw; fall back to r0 if unknown.
        const step = window?.currentFrameIndex ?? 0;
        this.currentRadius = this.r0 + this.rate * step;
    }
    toJSON() {
        const particleData = Array.isArray(this.particles) ? this.particles.map(p => p.id) : this.particles;
        return {
            type: this.type,
            particle: particleData,
            stiff: this.stiff,
            r0: this.r0,
            rate: this.rate,
            center: [this.origin.x, this.origin.y, this.origin.z],
        };
    }
    toString(idMap) {
        const particleRepresentation = Array.isArray(this.particles)
            ? this.particles.map(p => idMap ? idMap.get(p) : p.id).join(", ")
            : this.particles.toString();
        return (`{
        type = ${this.type}
        particle = ${particleRepresentation}
        center = ${this.origin.x},${this.origin.y},${this.origin.z}
        stiff = ${this.stiff}
        rate = ${this.rate}
        r0 = ${this.r0}
}`);
    }
    description() {
        const target = Array.isArray(this.particles) ? `${this.particles.length} particles` : (this.particles === -1 ? "all particles" : `${this.particles}`);
        return `Repulsive sphere @ ${this.origin.toArray().map(n => n.toFixed(2)).join(',')} on ${target}`;
    }
}
class AFMMovingSphere extends Force {
    // -----------------------
    // type tag for ForceHandler. This MUST match what ForceHandler.knownSphereForces is expecting
    // -----------------------
    type = 'AFMMovingSphere';
    // -----------------------
    // oxDNA / control params
    // -----------------------
    particles = -1; // -1 (all) or array<BasicElement>
    stiff = 10.0;
    r0 = 6.0;
    rate = 0.0;
    r_ext = 1e20;
    // AFM feedback / controller
    dir = new THREE.Vector3(0, 0, 1);
    F_set = 10.0;
    Kp = 0.01;
    max_step = 0.1;
    eps = 1e-3;
    // motion / AFM path
    // ref_position = where tip initially is (z reference)
    // target       = where we try to drive if we are in pure linear mode
    // moveSteps    = interpolation length for the "no scan" path
    ref_position = new THREE.Vector3(0, 0, -60);
    target = new THREE.Vector3(0, 0, -60);
    moveSteps = 0;
    // scan params
    scan_origin_xy = new THREE.Vector2(-100, -100);
    scan_size_xy = new THREE.Vector2(200, 200);
    scan_pixels = new THREE.Vector2(16, 16);
    scan_serpentine = 1;
    pixel_step_guard = 50;
    pixel_settle_steps = 300;
    pixel_sample_steps = 100;
    // -----------------------
    // viewer state
    // -----------------------
    // currentRadius is the draw radius we actually render this frame
    currentRadius = this.r0;
    // center is the sphere's *visualized live* center in 3D
    // initialize directly above first pixel using ref_position.z
    center = new THREE.Vector3(this.scan_origin_xy.x, this.scan_origin_xy.y, this.ref_position.z);
    // initialCenter is kept for interpolation modes (non-scan / linear mode)
    initialCenter = this.center.clone();
    // THREE objects for drawing
    mesh;
    outline;
    // helper for redraw scaling (see force.js drawSpheres/redrawSpheres)
    _baseRadius;
    // ------------------------------------------------------------------
    // set(): override selected physical params but leave scan/motion state alone
    // ------------------------------------------------------------------
    set(particles, stiff = this.stiff, r0 = this.r0, rate = this.rate) {
        if (particles !== undefined) {
            this.particles = particles;
        }
        this.stiff = stiff;
        this.r0 = r0;
        this.rate = rate;
        // sync radius bookkeeping
        this.currentRadius = this.r0;
        this.update();
    }
    // ------------------------------------------------------------------
    // setFromParsedJson(): merge parsed values into existing defaults.
    // Anything not mentioned keeps whatever we already had.
    // Mirrors the JS version in force.js. :contentReference[oaicite:1]{index=1}
    // ------------------------------------------------------------------
    setFromParsedJson(parsedjson) {
        // helper: parse "a,b,c" or [a,b,c] into THREE.Vector3
        const vec3From = (val, fallback) => {
            if (Array.isArray(val) && val.length >= 3) {
                return new THREE.Vector3(Number(val[0]), Number(val[1]), Number(val[2]));
            }
            if (typeof val === 'string') {
                const parts = val.split(',').map(Number);
                if (parts.length >= 3 && parts.every(n => Number.isFinite(n))) {
                    return new THREE.Vector3(parts[0], parts[1], parts[2]);
                }
            }
            return fallback.clone();
        };
        // helper: parse "a,b" or [a,b] into THREE.Vector2
        const vec2From = (val, fallback) => {
            if (Array.isArray(val) && val.length >= 2) {
                return new THREE.Vector2(Number(val[0]), Number(val[1]));
            }
            if (typeof val === 'string') {
                const parts = val.split(',').map(Number);
                if (parts.length >= 2 && parts.every(n => Number.isFinite(n))) {
                    return new THREE.Vector2(parts[0], parts[1]);
                }
            }
            return fallback.clone();
        };
        for (const param in parsedjson) {
            const v = parsedjson[param];
            switch (param) {
                // ---------------- particles handling ----------------
                case 'particle': {
                    if (Array.isArray(v)) {
                        this.particles = v
                            .map((id) => elements.get(id))
                            .filter((p) => p !== undefined);
                    }
                    else if (v === -1 || v === 'all') {
                        this.particles = -1;
                    }
                    else {
                        // allow single id or "a-b" range
                        if (typeof v === 'string' && v.includes('-')) {
                            const [a, b] = v.split('-').map(Number);
                            const ids = [];
                            for (let k = a; k <= b; k++)
                                ids.push(k);
                            this.particles = ids
                                .map(id => elements.get(id))
                                .filter((p) => p !== undefined);
                        }
                        else {
                            const el = elements.get(v);
                            if (!el) {
                                const err = `Particle ${v} in parsed force file does not exist.`;
                                notify(err, "alert");
                                throw err;
                            }
                            this.particles = [el];
                        }
                    }
                    break;
                }
                // ---------------- physical params ----------------
                case 'stiff':
                    this.stiff = Number(v);
                    break;
                case 'r0':
                    this.r0 = Number(v);
                    break;
                case 'rate':
                    this.rate = Number(v);
                    break;
                case 'r_ext':
                    this.r_ext = Number(v);
                    break;
                // ---------------- AFM controller params ----------------
                case 'dir':
                    this.dir = vec3From(v, this.dir);
                    break;
                case 'F_set':
                    this.F_set = Number(v);
                    break;
                case 'Kp':
                    this.Kp = Number(v);
                    break;
                case 'max_step':
                    this.max_step = Number(v);
                    break;
                case 'eps':
                    this.eps = Number(v);
                    break;
                // ---------------- motion / path params ----------------
                // ref_position is where the tip *starts*. Viewer also uses this.z as base height.
                case 'ref_position':
                    this.ref_position = vec3From(v, this.ref_position);
                    break;
                // Historically "origin"/"center" were used as the live tip position.
                // When we parse that, we re-seed center and initialCenter.
                case 'origin':
                case 'ref_center':
                case 'center':
                case 'ref_position_override': {
                    const newStart = vec3From(v, this.center);
                    this.center = newStart.clone();
                    this.initialCenter = newStart.clone();
                    break;
                }
                // target position for interpolation/non-scan mode
                case 'target':
                    this.target = vec3From(v, this.target);
                    break;
                // moveSteps / steps controls how long to interpolate in fallback mode
                case 'steps':
                case 'move_steps':
                case 'moveSteps':
                    this.moveSteps = Number(v) | 0;
                    break;
                // ---------------- scan params ----------------
                case 'scan_origin_xy':
                    this.scan_origin_xy = vec2From(v, this.scan_origin_xy);
                    break;
                case 'scan_size_xy':
                    this.scan_size_xy = vec2From(v, this.scan_size_xy);
                    break;
                case 'scan_pixels':
                    this.scan_pixels = vec2From(v, this.scan_pixels);
                    break;
                case 'scan_serpentine':
                    this.scan_serpentine = Number(v) | 0;
                    break;
                case 'pixel_step_guard':
                    this.pixel_step_guard = Number(v) | 0;
                    break;
                case 'pixel_settle_steps':
                    this.pixel_settle_steps = Number(v) | 0;
                    break;
                case 'pixel_sample_steps':
                    this.pixel_sample_steps = Number(v) | 0;
                    break;
                default:
                    // any extra, stash raw
                    this[param] = v;
                    break;
            }
        }
        // Make sure initialCenter is defined
        if (!this.initialCenter) {
            this.initialCenter = this.center.clone();
        }
        // keep radius in sync with any possibly new r0/rate
        this.currentRadius = this.r0;
        this.update();
    }
    // ------------------------------------------------------------------
    // update(): recompute currentRadius and center based on the current
    // viewer "step". This mirrors AFMMovingSphere.cpp behavior for:
    //   - scan+Kp>0 mode (serpentine raster with row lifts)
    //   - fallback / linear interpolation mode
    // and scales both radius and center w.r.t. step,
    // same way you already do radius. :contentReference[oaicite:2]{index=2}
    // ------------------------------------------------------------------
    update() {
        // 1. figure out "step"
        let step = 0;
        try {
            const sys = (typeof systems !== 'undefined' && systems.length > 0)
                ? systems[systems.length - 1]
                : undefined;
            const r = sys?.reader;
            step =
                (Number.isFinite(r?.frameIndex) ? r.frameIndex :
                    Number.isFinite(r?.current) ? r.current :
                        Number.isFinite(r?.frame) ? r.frame : 0);
        }
        catch (_) { }
        if (typeof window !== 'undefined' && Number.isFinite(window.currentFrameIndex)) {
            step = window.currentFrameIndex;
        }
        // 2. radius growth (C++: r = r0 + rate * step)
        this.currentRadius = this.r0 + this.rate * step;
        // 3. decide: are we scanning?
        const Nx = (this.scan_pixels.x | 0);
        const Ny = (this.scan_pixels.y | 0);
        const scanEnabled = (Nx > 0) &&
            (Ny > 0) &&
            (this.scan_size_xy.x >= 0.0) &&
            (this.scan_size_xy.y >= 0.0);
        if (scanEnabled) {
            // ----------- AFM SCAN PATH RECONSTRUCTION -----------
            // per-pixel timing (guard + settle + sample)
            const guard = this.pixel_step_guard; // e.g. 50
            const settle = this.pixel_settle_steps; // e.g. 300
            const sample = this.pixel_sample_steps; // e.g. 100
            const perPixelTotal = guard + settle + sample; // e.g. 450
            // which pixel index in raster?
            const pixLinear = Math.floor(step / perPixelTotal);
            const maxPix = Math.max(Nx * Ny - 1, 0);
            const clampedPix = Math.min(pixLinear, maxPix);
            // decompose to row/col like _ix,_iy in AFMMovingSphere.cpp
            const iy = Math.floor(clampedPix / Nx);
            const ix = clampedPix % Nx;
            // lateral serpentine mapping (pixel_xy() in C++)
            const x0 = this.scan_origin_xy.x;
            const y0 = this.scan_origin_xy.y;
            const Lx = this.scan_size_xy.x;
            const Ly = this.scan_size_xy.y;
            const dx = (Nx > 1) ? (Lx / (Nx - 1)) : 0.0;
            const dy = (Ny > 1) ? (Ly / (Ny - 1)) : 0.0;
            // serpentine means odd rows are reversed in x
            let jx = ix;
            if ((this.scan_serpentine !== 0) && (iy % 2 === 1)) {
                jx = (Nx - 1) - ix;
            }
            const cx = x0 + jx * dx;
            const cy = y0 + iy * dy;
            // vertical "row lift":
            // C++ does _center_curr += dir * 5.0 whenever ix wraps and iy++
            // We'll accumulate 5.0 * iy along +dir.
            const dirNorm = this.dir.clone();
            const dLen = dirNorm.length();
            if (dLen > 0)
                dirNorm.divideScalar(dLen);
            const baseZ = this.ref_position.z;
            const rowLift = 5.0 * iy;
            const cz = baseZ + rowLift * dirNorm.z;
            this.center.set(cx, cy, cz);
        }
        else {
            // ----------- LINEAR INTERPOLATION MODE -----------
            // "center_for_step" style (C++ when Kp==0 and no scan):
            // t = clamp(step / moveSteps, 0..1)
            const totalSteps = (this.moveSteps | 0);
            let t = 0.0;
            if (totalSteps > 0) {
                t = step / totalSteps;
                if (t < 0.0)
                    t = 0.0;
                if (t > 1.0)
                    t = 1.0;
            }
            const ox = this.ref_position.x;
            const oy = this.ref_position.y;
            const oz = this.ref_position.z;
            const tx = this.target.x;
            const ty = this.target.y;
            const tz = this.target.z;
            const cx = ox + (tx - ox) * t;
            const cy = oy + (ty - oy) * t;
            const cz = oz + (tz - oz) * t;
            this.center.set(cx, cy, cz);
        }
    }
    // ------------------------------------------------------------------
    // toJSON(): used when exporting forces back out
    // ------------------------------------------------------------------
    toJSON() {
        const particleData = Array.isArray(this.particles)
            ? this.particles.map(p => p.id)
            : this.particles;
        return {
            type: this.type,
            particle: particleData,
            stiff: this.stiff,
            r0: this.r0,
            rate: this.rate,
            center: [this.center.x, this.center.y, this.center.z],
            ...(this.target ? { target: [this.target.x, this.target.y, this.target.z] } : {}),
            ...(this.moveSteps ? { move_steps: this.moveSteps } : {})
        };
    }
    // ------------------------------------------------------------------
    // toString(): matches the .force file style in force.js. :contentReference[oaicite:3]{index=3}
    // ------------------------------------------------------------------
    toString(idMap) {
        const particleRepresentation = Array.isArray(this.particles)
            ? this.particles
                .map(p => (idMap ? idMap.get(p) : p.id))
                .join(", ")
            : this.particles.toString();
        const extra = [];
        if (this.target) {
            extra.push(`target = ${this.target.x},${this.target.y},${this.target.z}`);
        }
        if (this.moveSteps) {
            extra.push(`move_steps = ${this.moveSteps}`);
        }
        return `{
            type = ${this.type}
            particle = ${particleRepresentation}
            center = ${this.center.x},${this.center.y},${this.center.z}
            stiff = ${this.stiff}
            rate = ${this.rate}
            r0 = ${this.r0}
            ${extra.join('\n      ')}
        }`;
    }
    // ------------------------------------------------------------------
    // description(): used in UI list
    // ------------------------------------------------------------------
    description() {
        const target = Array.isArray(this.particles)
            ? `${this.particles.length} particles`
            : (this.particles === -1 ? "all particles" : `${this.particles}`);
        return `AFM moving sphere @ ${this.center
            .toArray()
            .map(n => Number(n).toFixed(2))
            .join(',')} on ${target}`;
    }
}
class ForceHandler {
    types = [];
    knownTrapForces = ['mutual_trap', 'skew_trap', 'com']; //these are the forces I know how to draw via lines
    knownPlaneForces = ["repulsion_plane", "attraction_plane", "repulsion_plane_moving"]; //these are the forces I know how to draw via planes
    knownSphereForces = ['sphere', "repulsive_sphere_moving", "AFMMovingSphere", "ellipsoid", "repulsive_kepler_poinsot"]; // NEW: sphere forces drawn as meshes
    knownBoxForces = ["Box"];
    knownStringForces = ["string"]; // NEW: force drawn as arrows
    forceColors = [
        new THREE.Color(0x0000FF),
        new THREE.Color(0xFF0000),
        new THREE.Color(0x00AAAA), // for 'com'
    ];
    planeColors = [
        new THREE.Color(0x00FF00),
        new THREE.Color(0xFF00FF),
    ];
    sphereColors = [
        new THREE.Color(0x00BFFF), // deep sky blue
    ];
    // --- add with the other colors ---
    boxColors = [
        new THREE.Color(0xFFA500), // orange (or whatever)
    ];
    // --- add with other draw caches ---
    boxMeshes = [];
    boxOutlines = [];
    forceLines = [];
    eqDistLines;
    forcePlanes = [];
    sphereMeshes = []; // NEW
    forces = [];
    sceneObjects = [];
    forceTable;
    constructor() { }
    set(forces) {
        this.forces.push(...forces);
        try {
            if (this.sceneObjects.length > 0) {
                this.clearForcesFromScene();
            }
            this.drawTraps();
            this.drawPlanes();
            this.drawSpheres(); // NEW
            this.drawBoxes(); // <-- ADD THIS
            this.drawStrings();
        }
        catch (exceptionVar) {
            forces.forEach(_ => this.forces.pop());
            notify("Adding forces failed! See console for more information.", "alert");
            console.error(exceptionVar);
        }
    }
    removeByElement(elems, removePair = false) {
        // Get traps which contain the element
        const pairwiseForces = this.getTraps();
        let toRemove;
        if (removePair) {
            toRemove = new Set(pairwiseForces.filter(f => elems.includes(f.particle) || elems.includes(f.ref_particle)));
        }
        else {
            toRemove = new Set(pairwiseForces.filter(f => elems.includes(f.particle)));
        }
        if (toRemove.size == 0) {
            return;
        }
        // Remove the offending traps
        this.forces = this.forces.filter(f => !toRemove.has(f));
        listForces();
        this.clearForcesFromScene();
        if (this.forces.length > 0) {
            this.drawTraps();
        }
    }
    removeById(ids) {
        ids.forEach(i => {
            this.forces.splice(i, 1);
        });
        listForces();
        this.clearForcesFromScene();
        if (this.forces.length > 0) {
            this.drawTraps();
        }
    }
    getByElement(elems) {
        return this.getTraps().filter(f => elems.includes(f.particle));
    }
    getTraps() {
        return this.forces.filter(f => this.knownTrapForces.includes(f.type));
    }
    getPlanes() {
        return this.forces.filter(f => this.knownPlaneForces.includes(f.type));
    }
    getSpheres() {
        return this.forces.filter(f => this.knownSphereForces.includes(f.type));
    }
    getBoxes() {
        return this.forces.filter(f => this.knownBoxForces.includes(f.type));
    }
    getStrings() {
        return this.forces.filter(f => this.knownStringForces.includes(f.type));
    }
    clearForcesFromScene() {
        // Remove any old geometry (nothing happens if undefined)
        this.sceneObjects.forEach(o => scene.remove(o));
        render();
    }
    drawTraps() {
        // find out how many different types there are
        const traps = this.getTraps().filter(f => f.type !== 'com');
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
        render();
        //possibly a better way to fire update
        //trajReader.nextConfig = api.observable.wrap(trajReader.nextConfig, this.update);
        //trajReader.previousConfig = api.observable.wrap(trajReader.previousConfig, this.update);    
    }
    drawStrings() {
        const strings = this.getStrings();
        if (strings.length === 0)
            return;
        strings.forEach((f) => {
            if (typeof f._clearViewerObjects === 'function')
                f._clearViewerObjects();
            try {
                this.getStrings().forEach(f => f._clearViewerObjects?.());
            }
            catch (_) { }
            if (typeof f.update === 'function')
                f.update();
            const groups = (typeof f._getArrowGroups === 'function') ? f._getArrowGroups() : [];
            groups.forEach(g => {
                scene.add(g);
                this.sceneObjects.push(g);
            });
        });
        render();
    }
    redrawStrings() {
        const strings = this.getStrings();
        if (strings.length === 0)
            return;
        strings.forEach((f) => {
            if (typeof f.update === 'function')
                f.update();
        });
    }
    drawPlanes() {
        const planes = this.getPlanes();
        planes.forEach(f => {
            const _extent = 512;
            const color = this.planeColors[planes.indexOf(f) % this.planeColors.length];
            // draw a colored canvas with text (unchanged from your code)
            const ccanvas = document.createElement('canvas');
            const ctx = ccanvas.getContext('2d');
            ccanvas.width = _extent;
            ccanvas.height = _extent;
            ctx.fillStyle = '#' + color.getHex().toString(16).padStart(6, '0');
            ctx.fillRect(0, 0, ccanvas.width, ccanvas.height);
            ctx.font = '8px Arial';
            ctx.fillStyle = 'black';
            ctx.textAlign = 'left';
            const info = `${f.type}\nposition: ${f.position}\ndir: ${f.dir.x} ${f.dir.y} ${f.dir.z}`;
            info.split('\n').forEach((line, i, arr) => {
                ctx.fillText(line, ccanvas.width - 70, ccanvas.height - 10 - (arr.length - 1 - i) * 10);
            });
            // Create mesh
            const texture = new THREE.CanvasTexture(ccanvas);
            const geometry = new THREE.PlaneGeometry(_extent, _extent);
            const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
            const plane = new THREE.Mesh(geometry, material);
            // Orient normal (+Z → dir)
            const zAxis = new THREE.Vector3(0, 0, 1);
            const q = new THREE.Quaternion().setFromUnitVectors(zAxis, f.dir.clone().normalize());
            plane.quaternion.copy(q);
            // Position: dir·x + d = 0  ⇒  x = -d * dir
            plane.position.set(-f.position * f.dir.x, -f.position * f.dir.y, -f.position * f.dir.z);
            scene.add(plane);
            f._mesh = plane;
            this.sceneObjects.push(plane);
            this.forcePlanes.push(plane);
        });
    }
    drawBoxes() {
        const boxes = this.getBoxes();
        if (boxes.length === 0)
            return;
        boxes.forEach((f, idx) => {
            // If Box ever becomes time-dependent, keep update semantics consistent:
            if (typeof f.update === "function") {
                f.update();
            }
            // Use unit box geometry and scale it (cleaner than rebuilding geometry every time)
            const geom = new THREE.BoxGeometry(1, 1, 1);
            const color = this.boxColors[idx % this.boxColors.length];
            const mat = new THREE.MeshPhongMaterial({
                transparent: true,
                opacity: 0.20,
                color,
                side: THREE.DoubleSide,
            });
            const mesh = new THREE.Mesh(geom, mat);
            // scale to lx,ly,lz and place at center
            mesh.scale.set(Math.max(f.lx, 1e-6), Math.max(f.ly, 1e-6), Math.max(f.lz, 1e-6));
            mesh.position.copy(f.center);
            // outline
            const edges = new THREE.EdgesGeometry(geom, 1);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color }));
            line.scale.copy(mesh.scale);
            line.position.copy(mesh.position);
            scene.add(mesh);
            scene.add(line);
            // attach to force instance (like spheres)
            f.mesh = mesh;
            f.outline = line;
            this.sceneObjects.push(mesh, line);
            this.boxMeshes.push(mesh);
            this.boxOutlines.push(line);
        });
        render();
    }
    drawSpheres() {
        const sphereForces = this.getSpheres();
        // 12 icosahedral directions (normalized)
        const phi = (1 + Math.sqrt(5)) / 2;
        const dirs = [
            new THREE.Vector3(0, 1, phi), new THREE.Vector3(0, -1, phi),
            new THREE.Vector3(0, 1, -phi), new THREE.Vector3(0, -1, -phi),
            new THREE.Vector3(1, phi, 0), new THREE.Vector3(-1, phi, 0),
            new THREE.Vector3(1, -phi, 0), new THREE.Vector3(-1, -phi, 0),
            new THREE.Vector3(phi, 0, 1), new THREE.Vector3(phi, 0, -1),
            new THREE.Vector3(-phi, 0, 1), new THREE.Vector3(-phi, 0, -1),
        ].map(v => v.normalize());
        const makeStarGroup = (f, color) => {
            const g = new THREE.Group();
            const scale = Math.max(f.currentScale ?? 1.0, 0.0);
            const apex = Math.max(f.apex * scale, 0.0);
            const base = Math.max(f.base * scale, 0.0);
            const h = Math.max(apex - base, 0.0001);
            const r = Math.max(f.base_radius * scale, 0.0001);
            // 5-sided "cone" via CylinderGeometry radialSegments=5
            const geom = new THREE.CylinderGeometry(0.0, r, h, 5, 1, false);
            const mat = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.25, color, side: THREE.DoubleSide });
            dirs.forEach(n => {
                const spike = new THREE.Mesh(geom, mat);
                // CylinderGeometry is aligned with +Y by default. Rotate +Y onto n.
                const yAxis = new THREE.Vector3(0, 1, 0);
                const q = new THREE.Quaternion().setFromUnitVectors(yAxis, n.clone().normalize());
                spike.quaternion.copy(q);
                // Place base plane at "base" along n; spike center is half-height further along n.
                const center = f.center.clone().add(n.clone().multiplyScalar(base + 0.5 * h));
                spike.position.copy(center);
                g.add(spike);
            });
            // outline edges for legibility
            const edges = new THREE.EdgesGeometry(geom, 1);
            const lineMat = new THREE.LineBasicMaterial({ color });
            dirs.forEach(n => {
                const outline = new THREE.LineSegments(edges, lineMat);
                const yAxis = new THREE.Vector3(0, 1, 0);
                const q = new THREE.Quaternion().setFromUnitVectors(yAxis, n.clone().normalize());
                outline.quaternion.copy(q);
                const center = f.center.clone().add(n.clone().multiplyScalar(base + 0.5 * h));
                outline.position.copy(center);
                g.add(outline);
            });
            return g;
        };
        const makeEllipsoid = (f, color) => {
            // Represent as a scaled sphere mesh (axis-aligned ellipsoid)
            const seg = 32;
            const geom = new THREE.SphereGeometry(1.0, seg, seg);
            const mat = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.20, color, side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.copy(f.center);
            mesh.scale.set(Math.max(f.outerAxes.x, 0.0001), Math.max(f.outerAxes.y, 0.0001), Math.max(f.outerAxes.z, 0.0001));
            const edges = new THREE.EdgesGeometry(geom, 1);
            const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color }));
            outline.position.copy(mesh.position);
            outline.scale.copy(mesh.scale);
            return { mesh, outline };
        };
        sphereForces.forEach(fAny => {
            const color = this.sphereColors[sphereForces.indexOf(fAny) % this.sphereColors.length];
            // --- Kepler–Poinsot star ---
            if (fAny.type === 'repulsive_kepler_poinsot') {
                const f = fAny;
                f.update?.();
                // Remove previous group if present
                if (f.group) {
                    scene.remove(f.group);
                    this.sceneObjects = this.sceneObjects.filter(o => o !== f.group);
                }
                const group = makeStarGroup(f, color);
                f.group = group;
                scene.add(group);
                this.sceneObjects.push(group);
                return;
            }
            // --- Ellipsoid (axis-aligned) ---
            if (fAny.type === 'ellipsoid') {
                const f = fAny;
                f.update?.();
                // Remove previous geometry if present
                if (f.mesh)
                    scene.remove(f.mesh);
                if (f.outline)
                    scene.remove(f.outline);
                const { mesh, outline } = makeEllipsoid(f, color);
                scene.add(mesh);
                scene.add(outline);
                f.mesh = mesh;
                f.outline = outline;
                this.sceneObjects.push(mesh, outline);
                this.sphereMeshes.push(mesh);
                return;
            }
            // --- Default: sphere mesh ---
            const f = fAny;
            f.update?.();
            const seg = 32;
            const geom = new THREE.SphereGeometry(Math.max(f.currentRadius, 0.0001), seg, seg);
            const mat = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.25, color, side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.copy(f.center);
            const edges = new THREE.EdgesGeometry(geom, 1);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color }));
            line.position.copy(f.center);
            scene.add(mesh);
            scene.add(line);
            f.mesh = mesh;
            f.outline = line;
            this.sceneObjects.push(mesh, line);
            this.sphereMeshes.push(mesh);
        });
    }
    redrawPlanes() {
        const planes = this.getPlanes();
        planes.forEach(f => {
            if (!f._mesh)
                return;
            f.update?.(); // moving planes recompute position
            const zAxis = new THREE.Vector3(0, 0, 1);
            const q = new THREE.Quaternion().setFromUnitVectors(zAxis, f.dir.clone().normalize());
            f._mesh.quaternion.copy(q);
            f._mesh.position.set(-f.position * f.dir.x, -f.position * f.dir.y, -f.position * f.dir.z);
        });
        render();
    }
    redrawTraps() {
        if (this.forces.length == 0) {
            return;
        }
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
            for (let j = 0; j < v1[i].length; j++) {
                this.forceLines[i].geometry["attributes"]["position"].array[j] = v1[i][j];
            }
            this.forceLines[i].geometry["attributes"]['position'].needsUpdate = true;
        });
        for (let i = 0; i < v2.length; i++) {
            this.eqDistLines.geometry["attributes"]['position'].array[i] = v2[i];
        }
        this.eqDistLines.geometry["attributes"]['position'].needsUpdate = true;
        this.redrawStrings();
        render();
    }
    redrawBoxes() {
        const boxes = this.getBoxes();
        if (boxes.length === 0)
            return;
        boxes.forEach((f) => {
            if (typeof f.update === "function")
                f.update();
            if (!f.mesh)
                return;
            // position
            if (f.center) {
                f.mesh.position.copy(f.center);
                if (f.outline)
                    f.outline.position.copy(f.center);
            }
            // scale (lx, ly, lz)
            const sx = Math.max(f.lx ?? 1, 1e-6);
            const sy = Math.max(f.ly ?? 1, 1e-6);
            const sz = Math.max(f.lz ?? 1, 1e-6);
            f.mesh.scale.set(sx, sy, sz);
            if (f.outline)
                f.outline.scale.set(sx, sy, sz);
        });
        render();
    }
    redrawSpheres() {
        const spheres = this.getSpheres();
        if (spheres.length === 0)
            return;
        spheres.forEach((f) => {
            // keep the same update semantics
            if (typeof f.update === "function") {
                f.update();
            }
            if (!f.mesh)
                return;
            // 1) Update position
            if (f.center) {
                f.mesh.position.copy(f.center);
                if (f.outline)
                    f.outline.position.copy(f.center);
            }
            // 2) Update scale: ellipsoids vs spheres
            if (f.outerAxes instanceof THREE.Vector3) {
                // Ellipsoid: scale each axis separately, using the unit sphere as base
                const base = 1.0;
                const sx = Math.max(f.outerAxes.x, 1e-6) / base;
                const sy = Math.max(f.outerAxes.y, 1e-6) / base;
                const sz = Math.max(f.outerAxes.z, 1e-6) / base;
                f.mesh.scale.set(sx, sy, sz);
                if (f.outline)
                    f.outline.scale.set(sx, sy, sz);
            }
            else {
                // Spheres: same behavior as before, using currentRadius/r0
                const base = Math.max(f._baseRadius || 1, 1e-6);
                const r = Math.max(f.currentRadius ?? f.r0 ?? base, 1e-6);
                const s = r / base;
                f.mesh.scale.set(s, s, s);
                if (f.outline)
                    f.outline.scale.set(s, s, s);
            }
        });
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
// =========================
// NEW: makeSphereFromSelection (optional helper)
// =========================
function makeSphereFromSelection() {
    const stiffness = parseFloat(document.getElementById("txtForceValue").value);
    const r0 = parseFloat(document.getElementById('r0').value);
    const rate = parseFloat(document.getElementById('rate')?.value ?? '0');
    const selection = Array.from(selectedBases);
    // center from selection centroid; fallback (0,0,0) if empty
    let center = new THREE.Vector3(0, 0, 0);
    if (selection.length > 0) {
        const acc = selection.reduce((v, b) => v.add(b.getInstanceParameter3("bbOffsets")), new THREE.Vector3());
        center = acc.multiplyScalar(1 / selection.length);
    }
    const sphere = new RepulsiveSphere();
    sphere.set(selection.length > 0 ? selection : -1, stiffness, r0, rate, center);
    forceHandler.set([sphere]);
}
function makeTrapsFromPairs() {
    let stiffness = parseFloat(document.getElementById("txtForceValue").value);
    let nopairs = !systems.every(sys => sys.checkedForBasepairs);
    if (nopairs) {
        ask("No basepair info found", "Do you want to run an automatic basepair search?", () => { view.longCalculation(findBasepairs, view.basepairMessage, makeTrapsFromPairs); });
    }
    const forces = [];
    elements.forEach(e => {
        // If element is paired and the trap doesn't already exist, add a trap
        if (e.isPaired()) {
            const currForces = forceHandler.getByElement([e]);
            let trap = new MutualTrap();
            trap.set(e, e.pair, stiffness);
            const alreadyExists = currForces.filter(f => f.equals(trap));
            if (alreadyExists.length === 0) {
                forces.push(trap);
            }
        }
    });
    forceHandler.set(forces);
    listForces();
}
