function forcesToString(newElementIDs) {
    return forceHandler.forces.map(f=>f.toString(newElementIDs)).join('\n\n');
}

abstract class Force {   
    type: string;
    sceneObjects: THREE.Object3D[] = [];

    abstract setFromParsedJson(parsedjson): void;
    abstract update(): void;
    abstract toString(idMap?: Map<BasicElement, number>): string;
    abstract description(): string;
}

// Forces which can be drawn as a line between two particles
abstract class PairwiseForce extends Force {
    abstract particle: BasicElement;
    abstract ref_particle: BasicElement;
    abstract force: THREE.Vector3[];
    abstract eqDists: THREE.Vector3[];

    equals(compareForce:PairwiseForce) {
            if (!(compareForce instanceof PairwiseForce) ) { return false }
            return(
                    this.particle === compareForce.particle &&
                    this.ref_particle === compareForce.ref_particle
            )
    }
}

class MutualTrap extends PairwiseForce {
    type = 'mutual_trap'
    particle: BasicElement; // the particle on which to exert the force.
    ref_particle: BasicElement; // particle to pull towards. Please note that this particle will not feel any force (the name mutual trap is thus misleading).
    stiff: number; // stiffness of the trap.
    r0: number; // equilibrium distance of the trap.
    PBC: number;
    force = [];
    eqDists = [];

    set(particle: BasicElement, ref_particle: BasicElement,
            stiff=0.09, r0=1.2, PBC=1)
    {
            this.particle = particle;
            this.ref_particle = ref_particle;
            this.stiff = stiff;
            this.r0 = r0;
            this.PBC = PBC;
            this.update()
    }

    equals(compareForce: MutualTrap): boolean {
            if (!(compareForce instanceof MutualTrap) ) { return false }
            return(
                    this.particle === compareForce.particle &&
                    this.ref_particle === compareForce.ref_particle &&
                    this.stiff === compareForce.stiff &&
                    this.r0 === compareForce.r0 &&
                    this.PBC === compareForce.PBC
            )
    }

    setFromParsedJson(parsedjson) {
            for (var param in parsedjson) {
                    if (['particle', 'ref_particle'].includes(param)) {
                            this[param] = elements.get(parsedjson[param]);
                            if (this[param] === undefined) {
                                    const err = `Particle ${parsedjson[param]} in parsed force file does not exist.`;
                                    notify(err, "alert");
                                    throw(err);
                            }
                    } else {
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
            }
    }

    toString(idMap?: Map<BasicElement, number>): string {
            if (elements.has(this.particle.id) && elements.has(this.ref_particle.id)) {
                    return (
`{
    type = ${this.type}
    particle = ${idMap ? idMap.get(this.particle) : this.particle.id}
    ref_particle = ${idMap ? idMap.get(this.ref_particle) : this.ref_particle.id}
    stiff = ${this.stiff}
    r0 = ${this.r0}
    PBC = ${this.PBC}
}`
                    )
            } else {
                    notify(`${this.description()} includes a particle that no longer exists`, 'alert', true);
                    return "";
            }
    }

    description(): string {
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
            let force_v = dir.clone().normalize().multiplyScalar(
                    (dir.length() - this.r0 )* this.stiff
            );
            dir.normalize();
            this.force = [
                    p1, p1.clone().add(dir.multiplyScalar(force_v.length()))
            ];
    }
}

class Box extends Force {
type = "Box";

center: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
lx: number = 1;
ly: number = 1;
lz: number = 1;

mesh?: THREE.Mesh;
outline?: THREE.LineSegments;

setFromParsedJson(parsedjson: any) {
    for (const param in parsedjson) {
        if (param === "center") {
            const c = parsedjson[param];
            this.center = new THREE.Vector3(c[0], c[1], c[2]);
        } else {
            (this as any)[param] = parsedjson[param]; // if this file is truly TS
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
(window as any).Box = Box;

class SkewTrap extends PairwiseForce {
    type = 'skew_trap'
    particle: BasicElement; // the particle on which to exert the force.
    ref_particle: BasicElement; // particle to pull towards. Please note that this particle will not feel any force (the name mutual trap is thus misleading).
    stdev: number; // width of the trap potential
    shape: number; // skew of the trap potential
    r0: number; // equilibrium distance of the trap.
    PBC: number;

    eqDists = [];
    force = [];

    set(particle: BasicElement, ref_particle: BasicElement,
            stdev=3.0, shape=-15, r0=1.2, PBC=1) // defaults for SMCC
    {
            this.particle = particle;
            this.ref_particle = ref_particle;
            this.stdev = stdev;
            this.shape = shape;
            this.r0 = r0;
            this.PBC = PBC;
            this.update()
    }

    equals(compareForce: SkewTrap): boolean {
            if (!(compareForce instanceof SkewTrap) ) { return false }
            return(
                    this.particle === compareForce.particle &&
                    this.ref_particle === compareForce.ref_particle &&
                    this.stdev === compareForce.stdev &&
                    this.shape === compareForce.shape &&
                    this.r0 === compareForce.r0 &&
                    this.PBC === compareForce.PBC
            )
    }

    setFromParsedJson(parsedjson) {
            for (var param in parsedjson) {
                    if (['particle', 'ref_particle'].includes(param)) {
                            this[param] = elements.get(parsedjson[param]);
                    } else {
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
            }
    }

    toString(idMap?: Map<BasicElement, number>): string {
            if (elements.has(this.particle.id) && elements.has(this.ref_particle.id)) {
                    return (
`{
    type = ${this.type}
    particle = ${idMap ? idMap.get(this.particle) : this.particle.id}
    ref_particle = ${idMap ? idMap.get(this.ref_particle) : this.ref_particle.id}
    stdev = ${this.stdev}
    shape = ${this.shape}
    r0 = ${this.r0}
    PBC = ${this.PBC}
}`
                    )
            } else {
                    notify(`${this.description()} includes a particle that no longer exists`, 'alert', true);
                    return "";
            }
    }

    description(): string {
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
            let force_v = dir.clone().normalize().multiplyScalar(
                    (dir.length() - this.r0 )* this.stdev
            );
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
particles: BasicElement[] | number = -1; // -1 (all) or array<BasicElement>
F0: number = 0.0;
rate: number = 0.0;
dir: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
dir_as_centre: boolean = false;

// viewer state
private _arrowGroups: THREE.Group[] = [];
private _color: THREE.Color = new THREE.Color(0x00bfff);
private _shaftRadius = 0.15;
private _headRadius = 0.30;
private _headHeight = 2.60;
private _minLen = 1e-6;

// Optional scaling so forces aren't absurdly long in the viewer.
// Leave at 1.0 to interpret F directly as length.
lengthScale: number = 10.0;

set(
    particles: BasicElement[] | number,
    F0 = 0.0,
    rate = 0.0,
    dir = new THREE.Vector3(0, 0, 1),
    dir_as_centre = false,
) {
    this.particles = particles;
    this.F0 = F0;
    this.rate = rate;
    this.dir = dir.clone().normalize();
    this.dir_as_centre = !!dir_as_centre;
    this.update();
}

equals(compareForce: StringForce): boolean {
    if (!(compareForce instanceof StringForce)) return false;
    const sameParticles = this.particles === compareForce.particles;
    return (
        sameParticles &&
        this.F0 === compareForce.F0 &&
        this.rate === compareForce.rate &&
        this.dir_as_centre === compareForce.dir_as_centre &&
        this.dir.equals(compareForce.dir)
    );
}

private _currentSimStep(): number {
    // Match the heuristic used for spheres/planes.
    let step = 0;
    try {
        const sys = (typeof systems !== 'undefined' && (systems as any[]).length > 0)
            ? (systems as any[])[(systems as any[]).length - 1]
            : undefined;
        const r = sys?.reader;
        step =
            (Number.isFinite(r?.confIndex) ? r.confIndex :
            Number.isFinite(r?.frameIndex) ? r.frameIndex :
            Number.isFinite(r?.current)    ? r.current    :
            Number.isFinite(r?.frame)      ? r.frame      : 0);
    } catch (_) {}

    if (typeof window !== 'undefined') {
        const w: any = window as any;
        if (Number.isFinite(w.currentFrameIndex)) step = w.currentFrameIndex;
        if (Number.isFinite(w.currentSimTime)) step = w.currentSimTime;
    }
    return step;
}

private _getAllParticles(): BasicElement[] {
    const out: BasicElement[] = [];
    try {
        elements.forEach((e: BasicElement) => out.push(e));
    } catch (_) {}
    return out;
}

private _strandKey(e: any): any {
    if (!e) return undefined;
    return (
        e.strandId ??
        e.strand_id ??
        e.strand ??
        e.parentStrand?.id ??
        e.parent?.strandId ??
        undefined
    );
}

/**
* Parse particle selector:
*  - -1 or "all" => all particles
*  - array of ids => those ids
*  - string like "1,2,5-7" => ids; ranges are expanded only if endpoints share a strand key.
*/
private _parseParticleSpec(v: any): BasicElement[] | number {
    if (v === -1 || v === 'all') return -1;
    if (Array.isArray(v)) {
        return v.map((id: any) => elements.get(id)).filter(Boolean);
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
    const ids: number[] = [];
    for (const tok of tokens) {
        if (tok.includes('-')) {
            const [aRaw, bRaw] = tok.split('-').map(s => s.trim());
            const a = Number(aRaw);
            const b = Number(bRaw);
            if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
            const elA = elements.get(a);
            const elB = elements.get(b);
            if (!elA || !elB) {
                // fall back: include endpoints only
                if (elA) ids.push(a);
                if (elB) ids.push(b);
                continue;
            }
            const kA = this._strandKey(elA);
            const kB = this._strandKey(elB);
            if (kA !== undefined && kA === kB) {
                const lo = Math.min(a, b);
                const hi = Math.max(a, b);
                for (let x = lo; x <= hi; x++) ids.push(x);
            } else {
                // Not on the same strand (or unknown) -> include endpoints only.
                ids.push(a, b);
            }
        } else {
            const id = Number(tok);
            if (Number.isFinite(id)) ids.push(id);
        }
    }
    const uniq = Array.from(new Set(ids));
    return uniq.map(id => elements.get(id)).filter(Boolean);
}

setFromParsedJson(parsedjson: any): void {
    for (const param in parsedjson) {
        const v = parsedjson[param];
        if (param === 'particle' || param === 'particles') {
            this.particles = this._parseParticleSpec(v);
        } else if (param === 'dir') {
            if (Array.isArray(v) && v.length === 3) {
                this.dir = new THREE.Vector3(+v[0], +v[1], +v[2]).normalize();
            } else if (typeof v === 'string') {
                const parts = v.split(',').map(Number);
                if (parts.length >= 3 && parts.every(n => Number.isFinite(n))) {
                    this.dir = new THREE.Vector3(parts[0], parts[1], parts[2]).normalize();
                }
            }
        } else if (param === 'dir_as_centre') {
            this.dir_as_centre = !!v;
        } else if (param === 'F0') {
            this.F0 = +v;
        } else if (param === 'rate') {
            this.rate = +v;
        } else if (param === 'lengthScale') {
            this.lengthScale = +v;
        } else {
            (this as any)[param] = v;
        }
    }
    this.update();
}

private _ensureArrowGroup(i: number): THREE.Group {
    if (this._arrowGroups[i]) return this._arrowGroups[i];

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
update(): void {
    const step = this._currentSimStep();
    const VISUAL_FORCE_SCALE = 10.0;   // <-- THIS is the important knob
    const mag = (this.F0 + this.rate * step);
    const len = Math.max(Math.abs(mag) * VISUAL_FORCE_SCALE, this._minLen);
    

    const plist: BasicElement[] =
        (this.particles === -1)
            ? this._getAllParticles()
            : (this.particles as BasicElement[]);

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

toJSON(): any {
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

toString(idMap?: Map<BasicElement, number>): string {
    const particleRep =
        Array.isArray(this.particles)
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

description(): string {
    const target =
        Array.isArray(this.particles)
            ? `${this.particles.length} particles`
            : (this.particles === -1 ? 'all particles' : `${this.particles}`);
    return `String force (F0=${this.F0}, rate=${this.rate}) on ${target}`;
}

/** Expose arrow groups for ForceHandler to add/remove from scene. */
_getArrowGroups(): THREE.Group[] {
    return this._arrowGroups;
}

/** Clear cached viewer geometry (called by ForceHandler when removing forces). */
_clearViewerObjects(): void {
    this._arrowGroups = [];
}
}

class COMForce extends Force {
    type = "com";

    // groups (elements participating in each COM)
    com_list: BasicElement[] = [];
    ref_list: BasicElement[] = [];

    // parameters
    stiff: number = 0.09;
    r0: number = 1.2;
    rate: number = 0.0;

    // for drawing like other traps (two line segments)
    //  - eqDists: from COM toward REF with length r0
    //  - force:   from COM in direction of REF, scaled by |(d - (r0+rate*step)) * stiff / |com_list||
    eqDists: THREE.Vector3[] = [];
    force: THREE.Vector3[] = [];

    set(comList: BasicElement[], refList: BasicElement[], stiff = 0.09, r0 = 1.2, rate = 0.0) {
            this.com_list = comList;
            this.ref_list = refList;
            this.stiff = stiff;
            this.r0 = r0;
            this.rate = rate;
            this.update();
    }

    setFromParsedJson(parsedjson: any) {
            for (const param in parsedjson) {
                    if (param === 'com_list' || param === 'ref_list') {
                            const arr = parsedjson[param];
                            if (!Array.isArray(arr)) {
                                    const err = `Invalid ${param}: expected an array of element IDs`;
                                    notify(err, "alert");
                                    throw err;
                            }
                            // map IDs → elements; drop undefineds but error if ends empty
                            (this as any)[param] = arr
                                    .map((id: number) => elements.get(id))
                                    .filter((p: BasicElement | undefined) => p !== undefined);

                            if ((this as any)[param].length === 0) {
                                    const err = `${param} is empty or contains invalid IDs`;
                                    notify(err, "alert");
                                    throw err;
                            }
                    } else {
                            (this as any)[param] = parsedjson[param];
                    }
            }
            this.update();
    }

    private avg(list: BasicElement[]): THREE.Vector3 {
            const v = new THREE.Vector3(0, 0, 0);
            if (!Array.isArray(list) || list.length === 0) return v;
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
            const step: number = (window as any)?.currentFrameIndex ?? 0;
            const target = this.r0 + this.rate * step;

            // set “equilibrium” segment (visual, length r0)
            this.eqDists = [ com.clone(), com.clone().add(dir.clone().multiplyScalar(this.r0)) ];

            // magnitude matches oxDNA: (|d| - (r0 + rate*step)) * stiff / |com_list|
            const denom = Math.max(this.com_list.length, 1);
            const mag = (dist - target) * this.stiff / denom;

            // force segment (purely for drawing)
            this.force = [ com.clone(), com.clone().add(dir.clone().multiplyScalar(Math.abs(mag))) ];
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

    toString(idMap?: Map<BasicElement, number>): string {
            const ids = (arr: BasicElement[]) =>
                    arr.map(p => idMap ? idMap.get(p) : p.id).join(' ');
            return `{
    type = ${this.type}
    com_list = ${ids(this.com_list)}
    ref_list = ${ids(this.ref_list)}
    stiff = ${this.stiff}
    r0 = ${this.r0}
    rate = ${this.rate}
}`;
    }

    description(): string {
            return `COM force between groups (${this.com_list.length}) → (${this.ref_list.length})`;
    }
}

// Forces which can be drawn as a plane
abstract class PlaneForce extends Force {
    abstract particles: BasicElement[] | number;
    abstract dir: THREE.Vector3;
    abstract position: number;
    abstract stiff: number;

    public _mesh?: THREE.Mesh;
    public _pointOnPlane?: THREE.Vector3;

    equals(compareForce:PairwiseForce) {
            if (!(compareForce instanceof PlaneForce) ) { return false }
            return(
                    this.particles === compareForce.particles &&
                    this.dir === compareForce.dir &&
                    this.position === compareForce.position &&
                    this.stiff === compareForce.stiff
            )
    }

    set(particles: BasicElement[] | number, stiff=0.09, position=0, dir=new THREE.Vector3(0,0,1)) {
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
                            } else if (particleData === -1) {
                                    this.particles = -1;
                            } else {
                                    const singleParticle = elements.get(particleData);
                                    if (singleParticle === undefined) {
                                            const err = `Particle ${particleData} in parsed force file does not exist.`;
                                            notify(err, "alert");
                                            throw(err);
                                    }
                                    this.particles = [singleParticle];
                            }
                    } else if (param === "dir") {
                            const dirData = parsedjson[param];
                            if (Array.isArray(dirData) && dirData.length === 3 && dirData.every(num => typeof num === 'number')) {
                                    this.dir = new THREE.Vector3(...dirData).normalize();
                            } else {
                                    const err = `Invalid dir format: ${dirData}`;
                                    notify(err, "alert");
                                    throw(err);
                            }
                    } else {
                            this[param] = parsedjson[param];
                    }
            }
            this.update();
    }

    toJSON() {
            let particleData: number | number[];
            particleData = Array.isArray(this.particles) ? this.particles.map(p => p.id) : this.particles;
            return {
                    type: this.type,
                    particle: particleData,
                    stiff: this.stiff,
                    dir: this.dir,
                    position: this.position
            };
    }

    toString(idMap?: Map<BasicElement, number>): string {
            let particleRepresentation: string;
            if (Array.isArray(this.particles)) {
                    particleRepresentation = this.particles.map(p => idMap ? idMap.get(p) : p.id).join(", ");
            } else {
                    particleRepresentation = this.particles.toString();
            }
            return (
`{
    type = ${this.type}
    particle = ${particleRepresentation}
    stiff = ${this.stiff}
    dir = ${this.dir}
    position = ${this.position}
}`
            );
    }

    description(): string {
            if (this.particles === -1) {
                    return "Plane trap pulling particle all particles towards itself";
            } else {
                    let particleRepresentation: string;
                    if (Array.isArray(this.particles)) {
                            particleRepresentation = this.particles.map(p => p.id).join(", ");
                    } else {
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
    public override type = 'repulsion_plane_moving';
    public ref_particles: BasicElement[] = [];   // adjust BasicElement import/type as in your repo

    public override setFromParsedJson(parsedjson: any) {
        for (const param in parsedjson) {
            if (param === 'particle') {
                const v = parsedjson[param];
                if (Array.isArray(v)) {
                    this.particles = v.map((id: number) => elements.get(id)).filter(Boolean);
                } else if (v === -1 || v === 'all') {
                    this.particles = -1;
                } else {
                    const el = elements.get(v);
                    if (!el) { const err = `Particle ${v} in parsed force file does not exist.`; notify(err, "alert"); throw err; }
                    this.particles = [el];
                }
            } else if (param === 'ref_particle') {
                const arr = Array.isArray(parsedjson[param]) ? parsedjson[param]
                                    : (typeof parsedjson[param] === 'string' ? parsedjson[param].split(',').map((s: string) => +s)
                                        : [parsedjson[param]]);
                this.ref_particles = arr.map((id: number) => elements.get(id)).filter(Boolean);
            } else if (param === 'dir') {
                const d = parsedjson[param];
                this.dir = new THREE.Vector3(d[0], d[1], d[2]).normalize();
            } else {
                (this as any)[param] = parsedjson[param];
            }
        }
        this.update();
    }

    private _avgRef(): THREE.Vector3 {
        const v = new THREE.Vector3(0, 0, 0);
        if (!Array.isArray(this.ref_particles) || this.ref_particles.length === 0) return v;
        this.ref_particles.forEach(p => v.add(p.getInstanceParameter3("bbOffsets")));
        v.multiplyScalar(1.0 / this.ref_particles.length);
        return v;
    }

    public override update(): void {
        const pbar = this._avgRef();
        this.position = - this.dir.dot(pbar);
        this._pointOnPlane = pbar;
    }
}  
class RepulsionPlane extends PlaneForce {
    type = 'repulsion_plane';
    particles: BasicElement[] | number = -1; // Can be an array of particles or -1 (all)
    stiff: number; // stiffness of the harmonic repulsion potential.
    dir: THREE.Vector3;
    position: number;
    
}

class AttractionPlane extends PlaneForce {
    type = 'attraction_plane';
    particles: BasicElement[] | number = -1; // Can be an array of particles or -1 (all)
    stiff: number; // stiffness of the harmonic repulsion potential and strength of the attractive force
    dir: THREE.Vector3;
    position: number;
}

class RepulsiveSphere extends Force {
    type = 'sphere';

    // oxDNA fields
    particles: BasicElement[] | number;   // -1 | list of elements (like PlaneForce)
    stiff: number;
    r0: number;
    rate: number;
    center: THREE.Vector3 = new THREE.Vector3(0,0,0);

    // viewer state
    currentRadius: number;
    mesh: THREE.Mesh;           // the translucent sphere
    outline?: THREE.LineSegments; // optional edges outline for clarity

    set(particles: BasicElement[] | number, stiff=10, r0=6, rate=0, center=new THREE.Vector3(0,0,0)) {
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
                } else if (v === -1 || v === 'all') {
                    this.particles = -1;
                } else if (typeof v === 'string' && v.includes('-')) {
                    // optional: expand simple ranges "5-7"
                    const [a,b] = v.split('-').map(Number);
                    const ids = [];
                    for (let k=a; k<=b; k++) ids.push(k);
                    this.particles = ids.map(id => elements.get(id)).filter(p => p !== undefined);
                } else if (typeof v === 'number') {
                    const el = elements.get(v);
                    if (!el) { const err = `Particle ${v} in parsed force file does not exist.`; notify(err, "alert"); throw(err); }
                    this.particles = [el];
                }
            } else if (param === 'center') {
                const c = parsedjson[param];
                this.center = new THREE.Vector3(c[0], c[1], c[2]);
            } else {
                (this as any)[param] = parsedjson[param];
            }
        }
        this.currentRadius = this.r0;
        this.update();
    }

    // compute current radius from frame index (assumes global current frame/step is accessible)
    update() {
        // If your app exposes a current frame index or MD step, use it here.
        // Many viewers increment on redraw; fall back to r0 if unknown.
        const step = (window as any)?.currentFrameIndex ?? 0;
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

    toString(idMap?: Map<BasicElement, number>): string {
        const particleRepresentation = Array.isArray(this.particles)
            ? this.particles.map(p => idMap ? idMap.get(p) : p.id).join(", ")
            : this.particles.toString();
        return (
`{
        type = ${this.type}
        particle = ${particleRepresentation}
        center = ${this.center.x},${this.center.y},${this.center.z}
        stiff = ${this.stiff}
        rate = ${this.rate}
        r0 = ${this.r0}
}`
        );
    }

    description(): string {
        const target = Array.isArray(this.particles) ? `${this.particles.length} particles` : (this.particles === -1 ? "all particles" : `${this.particles}`);
        return `Repulsive sphere @ ${this.center.toArray().map(n=>n.toFixed(2)).join(',')} on ${target}`;
    }
}

class RepulsiveEllipsoid extends Force {
    type: string = 'ellipsoid';

    particles: number | BasicElement[] = -1;
    stiff: number = 10.0;
    rate: number;
    outerAxes: THREE.Vector3 = new THREE.Vector3(6, 6, 6);  // r_2
    innerAxes: THREE.Vector3 | null = null;                 // r_1 (optional)
    center: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
    _baseOuterAxes: THREE.Vector3;
    currentScale: number;

    mesh?: THREE.Mesh;
    outline?: THREE.LineSegments;
    _baseRadius: number = 1.0;

    constructor() {
        super();
    }

    set(
        particles: number | BasicElement[],
        stiff: number,
        r2Vec: THREE.Vector3,
        r1Vec: THREE.Vector3 | null = null,
        center: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
    ): void {
        this.particles = particles;
        this.stiff = stiff;
        this.outerAxes = r2Vec.clone();
        this.innerAxes = r1Vec ? r1Vec.clone() : null;
        this.center = center.clone();
    }

    setFromParsedJson(parsedjson: any): void {
        for (const param in parsedjson) {
            const v = parsedjson[param];

            if (param === 'particle') {
                if (Array.isArray(v)) {
                    this.particles = v.map((id: number) => elements.get(id)).filter((p: BasicElement | undefined) => p !== undefined) as BasicElement[];
                } else if (v === -1 || v === 'all') {
                    this.particles = -1;
                } else if (typeof v === 'string' && v.includes('-')) {
                    const [a, b] = v.split('-').map(Number);
                    const ids: number[] = [];
                    for (let k = a; k <= b; k++) ids.push(k);
                    this.particles = ids.map(id => elements.get(id)).filter(p => p !== undefined) as BasicElement[];
                } else {
                    const el = elements.get(v);
                    if (!el) {
                        const err = `Particle ${v} in parsed force file does not exist.`;
                        notify(err, "alert");
                        throw err;
                    }
                    this.particles = [el];
                }
            } else if (param === 'center') {
                const c = Array.isArray(v) ? v : (v as string).split(',').map(Number);
                this.center = new THREE.Vector3(c[0], c[1], c[2]);
            } else if (param === 'r_2') {
                const r2 = Array.isArray(v) ? v : (v as string).split(',').map(Number);
                this.outerAxes = new THREE.Vector3(r2[0], r2[1], r2[2]);
            } else if (param === 'r_1') {
                const r1 = Array.isArray(v) ? v : (v as string).split(',').map(Number);
                this.innerAxes = new THREE.Vector3(r1[0], r1[1], r1[2]);
            } else {
                (this as any)[param] = v;
            }
        }
    }

    update(): void {
        // placeholder: static ellipsoid, no time dependence
    }

    toJSON(): any {
        const particleData =
            Array.isArray(this.particles)
                ? this.particles.map(p => (p as BasicElement).id)
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

    toString(idMap?: Map<BasicElement, number>): string {
        const particleRepresentation =
            Array.isArray(this.particles)
                ? this.particles.map(p => idMap ? idMap.get(p as BasicElement) : (p as BasicElement).id).join(", ")
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

    description(): string {
        const target =
            Array.isArray(this.particles)
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
    type: string = 'repulsive_kepler_poinsot';

    particles: number | BasicElement[] = -1;
    stiff: number = 10.0;
    rate: number = 0.0;

    center: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

    // Geometry at step 0 (simulation units)
    apex: number = 1.20;
    base: number = 0.70;
    base_radius: number = 0.45;

    // Optional smoothing parameter (not used for drawing, but kept for round-trip)
    kappa: number = 25.0;

    // Viewer state
    currentScale: number = 1.0;
    group?: THREE.Group;

    constructor() {
        super();
    }

    setFromParsedJson(parsedjson: any): void {
        const vec3From = (val: any, fallback: THREE.Vector3): THREE.Vector3 => {
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
                        .map((id: number) => elements.get(id))
                        .filter((p: BasicElement | undefined) => p !== undefined) as BasicElement[];
                } else if (v === -1 || v === 'all') {
                    this.particles = -1;
                } else if (typeof v === 'string' && v.includes('-')) {
                    const [a, b] = v.split('-').map(Number);
                    const ids: number[] = [];
                    for (let k = a; k <= b; k++) ids.push(k);
                    this.particles = ids.map(id => elements.get(id)).filter(p => p !== undefined) as BasicElement[];
                } else {
                    const el = elements.get(v);
                    if (!el) {
                        const err = `Particle ${v} in parsed force file does not exist.`;
                        notify(err, "alert");
                        throw err;
                    }
                    this.particles = [el];
                }
            } else if (param === 'center' || param === 'centre') {
                this.center = vec3From(v, this.center);
            } else if (param === 'stiff') {
                this.stiff = Number(v);
            } else if (param === 'rate') {
                this.rate = Number(v);
            } else if (param === 'apex') {
                this.apex = Number(v);
            } else if (param === 'base') {
                this.base = Number(v);
            } else if (param === 'base_radius') {
                this.base_radius = Number(v);
            } else if (param === 'kappa') {
                this.kappa = Number(v);
            }
        }
    }

    update(): void {
        // oxDNA applies growth = 1 + rate * step (see RepulsiveKeplerPoinsot::value()).
        // We mirror the same behavior using the viewer's best-guess current frame/step.
        const step = (window as any)?.currentSimTime ?? (window as any)?.currentFrameIndex ?? 0;
        const growth = 1.0 + (Number(this.rate) || 0) * Number(step || 0);
        this.currentScale = (Number.isFinite(growth) && growth > 0) ? growth : 0.0;
        console.log("Kepler Step:", step);
    }

    toString(idMap?: Map<BasicElement, number>): string {
        const particleRepresentation =
            Array.isArray(this.particles)
                ? this.particles.map(p => idMap ? idMap.get(p as BasicElement) : (p as BasicElement).id).join(", ")
                : this.particles.toString();

        return (
`{
type = ${this.type}
particle = ${particleRepresentation}
stiff = ${this.stiff}
rate = ${this.rate}
center = ${this.center.toArray().join(',')}
apex = ${this.apex}
base = ${this.base}
base_radius = ${this.base_radius}
kappa = ${this.kappa}
}`
        );
    }

    description(): string {
        const target = Array.isArray(this.particles)
            ? `${this.particles.length} particles`
            : (this.particles === -1 ? "all particles" : `${this.particles}`);
        return `Repulsive Kepler–Poinsot star @ ${this.center.toArray().map(n=>n.toFixed(2)).join(',')} on ${target}`;
    }
}



class RepulsiveSphereMoving extends Force {
    type = 'repulsive_sphere_moving';

    // oxDNA fields
    particles: BasicElement[] | number;   // -1 | list of elements (like PlaneForce)
    stiff: number;
    r0: number;
    rate: number;
    origin: THREE.Vector3 = new THREE.Vector3(0,0,0);
    target: THREE.Vector3 = new THREE.Vector3(0,0,0);
    moveSteps: number;

    // viewer state
    currentRadius: number;
    currentCenter: number;
    mesh: THREE.Mesh;           // the translucent sphere
    outline?: THREE.LineSegments; // optional edges outline for clarity

    set(particles: BasicElement[] | number, stiff=10, r0=6, rate=0, origin=new THREE.Vector3(0,0,0)) {
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
                } else if (v === -1 || v === 'all') {
                    this.particles = -1;
                } else if (typeof v === 'string' && v.includes('-')) {
                    // optional: expand simple ranges "5-7"
                    const [a,b] = v.split('-').map(Number);
                    const ids = [];
                    for (let k=a; k<=b; k++) ids.push(k);
                    this.particles = ids.map(id => elements.get(id)).filter(p => p !== undefined);
                } else if (typeof v === 'number') {
                    const el = elements.get(v);
                    if (!el) { const err = `Particle ${v} in parsed force file does not exist.`; notify(err, "alert"); throw(err); }
                    this.particles = [el];
                }
            } else if (param === 'origin') {
                const c = parsedjson[param];
                this.origin = new THREE.Vector3(c[0], c[1], c[2]);
            } else {
                (this as any)[param] = parsedjson[param];
            }
        }
        this.currentRadius = this.r0;
        this.update();
    }

    // compute current radius from frame index (assumes global current frame/step is accessible)
    update() {
        // If your app exposes a current frame index or MD step, use it here.
        // Many viewers increment on redraw; fall back to r0 if unknown.
        const step = (window as any)?.currentFrameIndex ?? 0;
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

    toString(idMap?: Map<BasicElement, number>): string {
        const particleRepresentation = Array.isArray(this.particles)
            ? this.particles.map(p => idMap ? idMap.get(p) : p.id).join(", ")
            : this.particles.toString();
        return (
`{
        type = ${this.type}
        particle = ${particleRepresentation}
        center = ${this.origin.x},${this.origin.y},${this.origin.z}
        stiff = ${this.stiff}
        rate = ${this.rate}
        r0 = ${this.r0}
}`
        );
    }

    description(): string {
        const target = Array.isArray(this.particles) ? `${this.particles.length} particles` : (this.particles === -1 ? "all particles" : `${this.particles}`);
        return `Repulsive sphere @ ${this.origin.toArray().map(n=>n.toFixed(2)).join(',')} on ${target}`;
    }
}

class AFMMovingSphere extends Force {
    // -----------------------
    // type tag for ForceHandler. This MUST match what ForceHandler.knownSphereForces is expecting
    // -----------------------
    public type = 'AFMMovingSphere';

    // -----------------------
    // oxDNA / control params
    // -----------------------
    public particles: BasicElement[] | number = -1; // -1 (all) or array<BasicElement>
    public stiff: number           = 10.0;
    public r0: number              = 6.0;
    public rate: number            = 0.0;
    public r_ext: number           = 1e20;

    // AFM feedback / controller
    public dir: THREE.Vector3      = new THREE.Vector3(0, 0, 1);
    public F_set: number           = 10.0;
    public Kp: number              = 0.01;
    public max_step: number        = 0.1;
    public eps: number             = 1e-3;

    // motion / AFM path
    // ref_position = where tip initially is (z reference)
    // target       = where we try to drive if we are in pure linear mode
    // moveSteps    = interpolation length for the "no scan" path
    public ref_position: THREE.Vector3 = new THREE.Vector3(0, 0, -60);
    public target:       THREE.Vector3 = new THREE.Vector3(0, 0, -60);
    public moveSteps:    number        = 0;

    // scan params
    public scan_origin_xy:     THREE.Vector2 = new THREE.Vector2(-100, -100);
    public scan_size_xy:       THREE.Vector2 = new THREE.Vector2(200, 200);
    public scan_pixels:        THREE.Vector2 = new THREE.Vector2(16, 16);
    public scan_serpentine:    number        = 1;

    public pixel_step_guard:   number        = 50;
    public pixel_settle_steps: number        = 300;
    public pixel_sample_steps: number        = 100;

    // -----------------------
    // viewer state
    // -----------------------
    // currentRadius is the draw radius we actually render this frame
    public currentRadius: number = this.r0;

    // center is the sphere's *visualized live* center in 3D
    // initialize directly above first pixel using ref_position.z
    public center: THREE.Vector3 = new THREE.Vector3(
        this.scan_origin_xy.x,
        this.scan_origin_xy.y,
        this.ref_position.z
    );

    // initialCenter is kept for interpolation modes (non-scan / linear mode)
    public initialCenter: THREE.Vector3 = this.center.clone();

    // THREE objects for drawing
    public mesh?: THREE.Mesh;
    public outline?: THREE.LineSegments;

    // helper for redraw scaling (see force.js drawSpheres/redrawSpheres)
    public _baseRadius?: number;

    // ------------------------------------------------------------------
    // set(): override selected physical params but leave scan/motion state alone
    // ------------------------------------------------------------------
    public set(
        particles?: BasicElement[] | number,
        stiff: number = this.stiff,
        r0: number = this.r0,
        rate: number = this.rate
    ) {
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
    public setFromParsedJson(parsedjson: any): void {

        // helper: parse "a,b,c" or [a,b,c] into THREE.Vector3
        const vec3From = (val: any, fallback: THREE.Vector3): THREE.Vector3 => {
            if (Array.isArray(val) && val.length >= 3) {
                return new THREE.Vector3(
                    Number(val[0]),
                    Number(val[1]),
                    Number(val[2])
                );
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
        const vec2From = (val: any, fallback: THREE.Vector2): THREE.Vector2 => {
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
                            .map((id: number) => elements.get(id))
                            .filter((p: BasicElement | undefined) => p !== undefined);
                    } else if (v === -1 || v === 'all') {
                        this.particles = -1;
                    } else {
                        // allow single id or "a-b" range
                        if (typeof v === 'string' && v.includes('-')) {
                            const [a, b] = v.split('-').map(Number);
                            const ids: number[] = [];
                            for (let k = a; k <= b; k++) ids.push(k);
                            this.particles = ids
                                .map(id => elements.get(id))
                                .filter((p: BasicElement | undefined) => p !== undefined);
                        } else {
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
                    (this as any)[param] = v;
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
    public update(): void {
        // 1. figure out "step"
        let step = 0;
        try {
            const sys = (typeof systems !== 'undefined' && systems.length > 0)
                ? systems[systems.length - 1]
                : undefined;
            const r = (sys as any)?.reader;
            step =
                (Number.isFinite(r?.confIndex) ? r.confIndex :
                Number.isFinite(r?.frameIndex) ? r.frameIndex :
                Number.isFinite(r?.current)    ? r.current    :
                Number.isFinite(r?.frame)      ? r.frame      : 0);
        } catch (_) {}

        if (typeof window !== 'undefined' && Number.isFinite((window as any).currentFrameIndex)) {
            step = (window as any).currentFrameIndex;
        }

        // 2. radius growth (C++: r = r0 + rate * step)
        this.currentRadius = this.r0 + this.rate * step;

        // 3. decide: are we scanning?
        const Nx = (this.scan_pixels.x | 0);
        const Ny = (this.scan_pixels.y | 0);
        const scanEnabled =
            (Nx > 0) &&
            (Ny > 0) &&
            (this.scan_size_xy.x >= 0.0) &&
            (this.scan_size_xy.y >= 0.0);

        if (scanEnabled) {
            // ----------- AFM SCAN PATH RECONSTRUCTION -----------
            // per-pixel timing (guard + settle + sample)
            const guard  = this.pixel_step_guard;     // e.g. 50
            const settle = this.pixel_settle_steps;   // e.g. 300
            const sample = this.pixel_sample_steps;   // e.g. 100
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
            if (dLen > 0) dirNorm.divideScalar(dLen);

            const baseZ = this.ref_position.z;
            const rowLift = 5.0 * iy;
            const cz = baseZ + rowLift * dirNorm.z;

            this.center.set(cx, cy, cz);

        } else {
            // ----------- LINEAR INTERPOLATION MODE -----------
            // "center_for_step" style (C++ when Kp==0 and no scan):
            // t = clamp(step / moveSteps, 0..1)
            const totalSteps = (this.moveSteps | 0);
            let t = 0.0;
            if (totalSteps > 0) {
                t = step / totalSteps;
                if (t < 0.0) t = 0.0;
                if (t > 1.0) t = 1.0;
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
    public toJSON() {
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
    public toString(idMap?: Map<BasicElement, number>): string {
        const particleRepresentation =
            Array.isArray(this.particles)
                ? this.particles
                        .map(p => (idMap ? idMap.get(p)! : p.id))
                        .join(", ")
                : this.particles.toString();

        const extra: string[] = [];
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
    public description(): string {
        const target =
            Array.isArray(this.particles)
                ? `${this.particles.length} particles`
                : (this.particles === -1 ? "all particles" : `${this.particles}`);
        return `AFM moving sphere @ ${this.center
            .toArray()
            .map(n => Number(n).toFixed(2))
            .join(',')} on ${target}`;
    }
}


class ForceHandler{
    types: string[] = [];
    knownTrapForces: string[] = ['mutual_trap', 'skew_trap', 'com']; //these are the forces I know how to draw via lines
    knownPlaneForces: string[] = ["repulsion_plane", "attraction_plane", "repulsion_plane_moving"]; //these are the forces I know how to draw via planes
    knownSphereForces: string[] = ['sphere', "repulsive_sphere_moving", "AFMMovingSphere", "ellipsoid", "repulsive_kepler_poinsot"]; // NEW: sphere forces drawn as meshes
    knownBoxForces: string[] = ["Box"];
    knownStringForces: string[] = ["string"]; // NEW: force drawn as arrows

    forceColors: THREE.Color[] = [
            new THREE.Color(0x0000FF),
            new THREE.Color(0xFF0000),
            new THREE.Color(0x00AAAA), // for 'com'
        ];
    planeColors: THREE.Color[] = [ //add more if you implement more forces
            new THREE.Color(0x00FF00),
            new THREE.Color(0xFF00FF),
    ];

    sphereColors: THREE.Color[] = [
            new THREE.Color(0x00BFFF), // deep sky blue
            ];

    // --- add with the other colors ---
    boxColors: THREE.Color[] = [
        new THREE.Color(0xFFA500), // orange (or whatever)
    ];

    // --- add with other draw caches ---
    boxMeshes: THREE.Mesh[] = [];
    boxOutlines: THREE.LineSegments[] = [];

    forceLines: THREE.LineSegments[] = [];
    eqDistLines: THREE.LineSegments;

    forcePlanes: THREE.Mesh[] = [];
    sphereMeshes: THREE.Mesh[] = []; // NEW

    forces: Force[] = []
    sceneObjects: THREE.Object3D[] = [];
    forceTable: string[][]

    constructor() { }

    set(forces: Force[]) {
            this.forces.push(...forces)
            try {
                    if (this.sceneObjects.length > 0) { this.clearForcesFromScene() }
                    this.drawTraps();
                    this.drawPlanes();
                    this.drawSpheres(); // NEW
                    this.drawBoxes(); // <-- ADD THIS
                    this.drawStrings();
            }
            catch (exceptionVar) {
                    forces.forEach(_ => this.forces.pop())
                    notify("Adding forces failed! See console for more information.", "alert")
                    console.error(exceptionVar)
            }
    }

    removeByElement(elems: BasicElement[], removePair:boolean=false) {
            // Get traps which contain the element
            const pairwiseForces = this.getTraps()
            let toRemove:Set<Force>
            if (removePair){ toRemove = new Set(pairwiseForces.filter(f => elems.includes(f.particle) || elems.includes(f.ref_particle))) }
            else {toRemove = new Set(pairwiseForces.filter(f => elems.includes(f.particle)))}
            if (toRemove.size == 0) { return }

            // Remove the offending traps
            this.forces = this.forces.filter(f => !toRemove.has(f))
            listForces()
            this.clearForcesFromScene()
            if (this.forces.length > 0) { this.drawTraps() }
    }

    removeById(ids: number[]){
            ids.forEach(i => {
                    this.forces.splice(i, 1)
            });
            listForces()
            this.clearForcesFromScene()
            if (this.forces.length > 0) { this.drawTraps() }
    }

    getByElement(elems: BasicElement[]) {
            return this.getTraps().filter(f => elems.includes(f.particle))
    }

    getTraps() {
            return <PairwiseForce[]>this.forces.filter(f => this.knownTrapForces.includes(f.type));
    }

    getPlanes() {
            return <PlaneForce[]>this.forces.filter(f => this.knownPlaneForces.includes(f.type));
    }

    getSpheres() {
            return <RepulsiveSphere[]>this.forces.filter(f => this.knownSphereForces.includes(f.type));
    }

    getBoxes(){
            return <Box[]>this.forces.filter(f => this.knownBoxForces.includes(f.type));
    }

    getStrings() {
        return <StringForce[]>this.forces.filter(f => this.knownStringForces.includes(f.type));
    }    

    clearForcesFromScene() {
            // Remove any old geometry (nothing happens if undefined)
            this.sceneObjects.forEach(o => scene.remove(o))
            render()
    }

    drawTraps() {
            // find out how many different types there are
            const traps = this.getTraps().filter(f => f.type !== 'com');
            this.types = Array.from((new Set(traps.map(trap=>trap.type))));
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
                    v1[idx].push(f.force[0].x,f.force[0].y,f.force[0].z );
                    v1[idx].push(f.force[1].x,f.force[1].y,f.force[1].z );
                    v2.push(f.eqDists[0].x,f.eqDists[0].y,f.eqDists[0].z );
                    v2.push(f.eqDists[1].x,f.eqDists[1].y,f.eqDists[1].z );
            });

            forceGeoms.forEach((g, i) => g.addAttribute('position', new THREE.Float32BufferAttribute(v1[i], 3)));
            let materials = this.types.map((t, i) => new THREE.LineBasicMaterial({color: this.forceColors[i]}));
            this.forceLines = <THREE.LineSegments[]>forceGeoms.map((g, i) => new THREE.LineSegments(g, materials[i]));
            this.forceLines.forEach(fl => {
                    scene.add(fl);
                    this.sceneObjects.push(fl);
            });
            
            eqDistGeom.addAttribute('position', new THREE.Float32BufferAttribute(v2, 3));
            materials[0] = new THREE.LineBasicMaterial({color: 0x0000ff, opacity:.5});
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
        if (strings.length === 0) return;
    
        strings.forEach((f: any) => {
            if (typeof f._clearViewerObjects === 'function') f._clearViewerObjects();
            try {
                this.getStrings().forEach(f => (f as any)._clearViewerObjects?.());
            } catch (_) {}
            if (typeof f.update === 'function') f.update();
    
            const groups: THREE.Group[] =
                (typeof f._getArrowGroups === 'function') ? f._getArrowGroups() : [];
    
            groups.forEach(g => {
                scene.add(g);
                this.sceneObjects.push(g);
            });
        });
        render();
    }
    
    redrawStrings(): void {
        const strings = this.getStrings();
        if (strings.length === 0) return;
    
        strings.forEach((f: any) => {
            if (typeof f.update === 'function') f.update();
        });
    }    

    drawPlanes() {
            const planes = this.getPlanes();
            planes.forEach(f => {
                const _extent = 512;
                const color = this.planeColors[planes.indexOf(f) % this.planeColors.length];
        
                // draw a colored canvas with text (unchanged from your code)
                const ccanvas = document.createElement('canvas');
                const ctx = ccanvas.getContext('2d')!;
                ccanvas.width = _extent; ccanvas.height = _extent;
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
        drawBoxes(): void {
            const boxes = this.getBoxes();
            if (boxes.length === 0) return;
        
            boxes.forEach((f, idx) => {
                // If Box ever becomes time-dependent, keep update semantics consistent:
                if (typeof (f as any).update === "function") {
                    (f as any).update();
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
                mesh.scale.set(
                    Math.max(f.lx, 1e-6),
                    Math.max(f.ly, 1e-6),
                    Math.max(f.lz, 1e-6),
                );
                mesh.position.copy(f.center);
        
                // outline
                const edges = new THREE.EdgesGeometry(geom, 1);
                const line = new THREE.LineSegments(
                    edges,
                    new THREE.LineBasicMaterial({ color })
                );
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
                new THREE.Vector3(0,  1,  phi), new THREE.Vector3(0, -1,  phi),
                new THREE.Vector3(0,  1, -phi), new THREE.Vector3(0, -1, -phi),
                new THREE.Vector3( 1,  phi, 0), new THREE.Vector3(-1,  phi, 0),
                new THREE.Vector3( 1, -phi, 0), new THREE.Vector3(-1, -phi, 0),
                new THREE.Vector3( phi, 0,  1), new THREE.Vector3( phi, 0, -1),
                new THREE.Vector3(-phi, 0,  1), new THREE.Vector3(-phi, 0, -1),
            ].map(v => v.normalize());

            const makeStarGroup = (f: RepulsiveKeplerPoinsot, color: THREE.Color): THREE.Group => {
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

            const makeEllipsoid = (f: RepulsiveEllipsoid, color: THREE.Color): {mesh: THREE.Mesh, outline: THREE.LineSegments} => {
                // Represent as a scaled sphere mesh (axis-aligned ellipsoid)
                const seg = 32;
                const geom = new THREE.SphereGeometry(1.0, seg, seg);
                const mat = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.20, color, side: THREE.DoubleSide });
                const mesh = new THREE.Mesh(geom, mat);
                mesh.position.copy(f.center);
                mesh.scale.set(
                    Math.max(f.outerAxes.x, 0.0001),
                    Math.max(f.outerAxes.y, 0.0001),
                    Math.max(f.outerAxes.z, 0.0001),
                );

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
                    const f = fAny as any as RepulsiveKeplerPoinsot;
                    (f.update as any)?.();

                    // Remove previous group if present
                    if ((f as any).group) {
                        scene.remove((f as any).group);
                        this.sceneObjects = this.sceneObjects.filter(o => o !== (f as any).group);
                    }

                    const group = makeStarGroup(f, color);
                    (f as any).group = group;

                    scene.add(group);
                    this.sceneObjects.push(group);
                    return;
                }

                // --- Ellipsoid (axis-aligned) ---
                if (fAny.type === 'ellipsoid') {
                    const f = fAny as any as RepulsiveEllipsoid;
                    (f.update as any)?.();

                    // Remove previous geometry if present
                    if ((f as any).mesh) scene.remove((f as any).mesh);
                    if ((f as any).outline) scene.remove((f as any).outline);

                    const { mesh, outline } = makeEllipsoid(f, color);
                    scene.add(mesh);
                    scene.add(outline);

                    (f as any).mesh = mesh;
                    (f as any).outline = outline;

                    this.sceneObjects.push(mesh, outline);
                    this.sphereMeshes.push(mesh);
                    return;
                }

                // --- Default: sphere mesh ---
                const f = fAny as any as RepulsiveSphere;
                (f.update as any)?.();

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
            if (!f._mesh) return;
            (f.update as any)?.(); // moving planes recompute position
    
            const zAxis = new THREE.Vector3(0, 0, 1);
            const q = new THREE.Quaternion().setFromUnitVectors(zAxis, f.dir.clone().normalize());
            f._mesh.quaternion.copy(q);
    
            f._mesh.position.set(-f.position * f.dir.x, -f.position * f.dir.y, -f.position * f.dir.z);
    });
    render();
    }
    redrawTraps() {
            if (this.forces.length == 0) { return }

            let v1:number[][] = [];
            let v2:number[] = [];

            for (let i = 0; i < this.types.length; i++) {
                    v1.push([]);
            }

            this.getTraps().forEach( f=>{
                    f.update();
                    let idx = this.types.findIndex(t => t == f.type);
                    v1[idx].push(f.force[0].x,f.force[0].y,f.force[0].z);
                    v1[idx].push(f.force[1].x,f.force[1].y,f.force[1].z);
                    v2.push(f.eqDists[0].x,f.eqDists[0].y,f.eqDists[0].z);
                    v2.push(f.eqDists[1].x,f.eqDists[1].y,f.eqDists[1].z);
            });
            this.types.forEach((t, i) => {
                    for (let j = 0; j < v1[i].length; j++) {
                            this.forceLines[i].geometry["attributes"]["position"].array[j] = v1[i][j]
                    }
                    this.forceLines[i].geometry["attributes"]['position'].needsUpdate = true;
            });
            
            for (let i = 0; i < v2.length; i++) {
                    this.eqDistLines.geometry["attributes"]['position'].array[i] = v2[i]
            }
            this.eqDistLines.geometry["attributes"]['position'].needsUpdate = true;
            this.redrawStrings();
            render()
    }
    redrawBoxes(): void {
        const boxes = this.getBoxes();
        if (boxes.length === 0) return;
    
        boxes.forEach((f: any) => {
            if (typeof f.update === "function") f.update();
            if (!f.mesh) return;
    
            // position
            if (f.center) {
                f.mesh.position.copy(f.center);
                if (f.outline) f.outline.position.copy(f.center);
            }
    
            // scale (lx, ly, lz)
            const sx = Math.max(f.lx ?? 1, 1e-6);
            const sy = Math.max(f.ly ?? 1, 1e-6);
            const sz = Math.max(f.lz ?? 1, 1e-6);
    
            f.mesh.scale.set(sx, sy, sz);
            if (f.outline) f.outline.scale.set(sx, sy, sz);
        });
    
        render();
    }    
    redrawSpheres(): void {
        const spheres = this.getSpheres();
        if (spheres.length === 0) return;

        spheres.forEach((f: any) => {
            // keep the same update semantics
            if (typeof f.update === "function") {
                f.update();
            }
            if (!f.mesh) return;

            // 1) Update position
            if (f.center) {
                f.mesh.position.copy(f.center);
                if (f.outline) f.outline.position.copy(f.center);
            }

            // 2) Update scale: ellipsoids vs spheres
            if (f.outerAxes instanceof THREE.Vector3) {
                // Ellipsoid: scale each axis separately, using the unit sphere as base
                const base = 1.0;
                const sx = Math.max(f.outerAxes.x, 1e-6) / base;
                const sy = Math.max(f.outerAxes.y, 1e-6) / base;
                const sz = Math.max(f.outerAxes.z, 1e-6) / base;

                f.mesh.scale.set(sx, sy, sz);
                if (f.outline) f.outline.scale.set(sx, sy, sz);
            } else {
                // Spheres: same behavior as before, using currentRadius/r0
                const base = Math.max(f._baseRadius || 1, 1e-6);
                const r = Math.max(f.currentRadius ?? f.r0 ?? base, 1e-6);
                const s = r / base;

                f.mesh.scale.set(s, s, s);
                if (f.outline) f.outline.scale.set(s, s, s);
            }
        });

        render();
    }

        
}

function makeTrapsFromSelection() {
    let stiffness = parseFloat((document.getElementById("txtForceValue") as HTMLInputElement).value);
    let r0 = parseFloat((document.getElementById('r0')as HTMLInputElement).value);
    let selection = Array.from(selectedBases);
    const forces: PairwiseForce[] = []
    // For every other element in selection
    for (let i = 0; i < selection.length; i+=2) {
            // If there is another nucleotide in the pair
            if (selection[i+1] !== undefined) {
                    //create mutual trap data for the 2 nucleotides in a pair - selected simultaneously
                    let trapA = new MutualTrap();
                    trapA.set(selection[i], selection[i + 1],stiffness,r0);
                    forces.push(trapA);

                    let trapB = new MutualTrap();
                    trapB.set(selection[i + 1], selection[i],stiffness,r0);
                    forces.push(trapB);
            } else { 
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
    const stiffness = parseFloat((document.getElementById("txtForceValue") as HTMLInputElement).value);
    const r0 = parseFloat((document.getElementById('r0') as HTMLInputElement).value);
    const rate = parseFloat((document.getElementById('rate') as HTMLInputElement)?.value ?? '0');
    const selection = Array.from(selectedBases) as BasicElement[];

    // center from selection centroid; fallback (0,0,0) if empty
    let center = new THREE.Vector3(0, 0, 0);
    if (selection.length > 0) {
    const acc = selection.reduce(
            (v, b) => v.add(b.getInstanceParameter3("bbOffsets")),
            new THREE.Vector3()
    );
    center = acc.multiplyScalar(1 / selection.length);
    }

    const sphere = new RepulsiveSphere();
    sphere.set(selection.length > 0 ? selection : -1, stiffness, r0, rate, center);
    forceHandler.set([sphere]);
}

function makeTrapsFromPairs() {
    let stiffness = parseFloat((document.getElementById("txtForceValue") as HTMLInputElement).value);
    let nopairs = !systems.every(sys => sys.checkedForBasepairs);
    if (nopairs) {
            ask("No basepair info found", "Do you want to run an automatic basepair search?",
            ()=>{view.longCalculation(findBasepairs, view.basepairMessage, makeTrapsFromPairs)})
    }

    const forces: PairwiseForce[] = []
    elements.forEach(e=>{
            // If element is paired and the trap doesn't already exist, add a trap
            if (e.isPaired()) {
                    const currForces = forceHandler.getByElement([e]);
                    let trap = new MutualTrap();
                    trap.set(e, (e as Nucleotide).pair, stiffness);
                    const alreadyExists = currForces.filter(f => f.equals(trap));
                    if (alreadyExists.length === 0) { forces.push(trap); }
            }
    });
    forceHandler.set(forces);
    listForces()
}