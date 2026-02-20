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

class StringForce extends Force {
constructor() {
  super();
  this.type = 'string';

  // oxDNA params
  this.particles = -1;          // -1 (all) or array<BasicElement>
  this.F0 = 0.0;
  this.rate = 0.0;
  this.dir = new THREE.Vector3(0, 0, 1); // auto-normalized
  this.dir_as_centre = false;

  // viewer params
  this.lengthScale = 10.0; // optional visual scaling only

  // viewer state (one arrow per particle)
  this._arrowGroups = [];
  this._color = new THREE.Color(0x00bfff);
  this._shaftRadius = 0.05;
  this._headRadius = 0.30;
  this._headHeight = 0.50;
  this._minLen = 1e-6;
}

set(particles, F0 = 0.0, rate = 0.0, dir = new THREE.Vector3(0, 0, 1), dir_as_centre = false) {
  this.particles = particles;
  this.F0 = +F0;
  this.rate = +rate;
  this.dir = dir.clone().normalize();
  this.dir_as_centre = !!dir_as_centre;
  this.update();
}

equals(compareForce) {
  if (!(compareForce instanceof StringForce)) return false;
  const sameParticles = this.particles === compareForce.particles;
  return sameParticles &&
    this.F0 === compareForce.F0 &&
    this.rate === compareForce.rate &&
    this.dir_as_centre === compareForce.dir_as_centre &&
    this.dir.equals(compareForce.dir);
}

_currentSimStep() {
  // Mirror the heuristic used for spheres/planes.
  let step = 0;
  try {
    const sys = (typeof systems !== 'undefined' && systems.length > 0) ? systems[systems.length - 1] : undefined;
    const r = sys?.reader;
    step =
      (Number.isFinite(r?.confIndex) ? r.confIndex :
       Number.isFinite(r?.frameIndex) ? r.frameIndex :
       Number.isFinite(r?.current)    ? r.current    :
       Number.isFinite(r?.frame)      ? r.frame      : 0);
  } catch (_) {}

  if (typeof window !== 'undefined') {
    if (Number.isFinite(window.currentFrameIndex)) step = window.currentFrameIndex;
    if (Number.isFinite(window.currentSimTime)) step = window.currentSimTime;
  }
  return step;
}

_getAllParticles() {
  const out = [];
  try { elements.forEach(e => out.push(e)); } catch (_) {}
  return out;
}

_strandKey(e) {
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

// Parse particle selector:
//  - -1 or "all" => all particles
//  - array of ids => those ids
//  - string like "1,2,5-7" => ids; ranges expanded only if endpoints share a strand key.
_parseParticleSpec(v) {
  if (v === -1 || v === 'all') return -1;
  if (Array.isArray(v)) {
    return v.map(id => elements.get(id)).filter(Boolean);
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
  if (typeof v !== 'string') return -1;

  const tokens = v.split(',').map(s => s.trim()).filter(Boolean);
  const ids = [];
  for (const tok of tokens) {
    if (tok.includes('-')) {
      const [aRaw, bRaw] = tok.split('-').map(s => s.trim());
      const a = Number(aRaw);
      const b = Number(bRaw);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;

      const elA = elements.get(a);
      const elB = elements.get(b);
      if (!elA || !elB) {
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

setFromParsedJson(parsedjson) {
  for (const param in parsedjson) {
    const v = parsedjson[param];
    if (param === 'particle' || param === 'particles') {
      this.particles = this._parseParticleSpec(v);
    } else if (param === 'dir') {
      if (Array.isArray(v) && v.length >= 3) {
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
      this[param] = v;
    }
  }
  this.update();
}

_ensureArrowGroup(i) {
  if (this._arrowGroups[i]) return this._arrowGroups[i];

  // shaft is unit height along +Y; we'll scale Y to arrow length
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

// Update arrow geometry for current frame
update() {
  const step = this._currentSimStep();
  const VISUAL_FORCE_SCALE = 1000.0;   // <-- THIS is the important knob
  const mag = (this.F0 + this.rate * step);
  const len = 1; //Math.max(Math.abs(mag) * VISUAL_FORCE_SCALE, this._minLen);

  const plist = (this.particles === -1) ? this._getAllParticles() : this.particles;

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
  const particleRep =
    Array.isArray(this.particles)
      ? this.particles.map(p => (idMap ? idMap.get(p) : p.id)).join(',')
      : this.particles.toString();

  return (`{
  type = ${this.type}
  particle = ${particleRep}
  F0 = ${this.F0}
  rate = ${this.rate}
  dir = ${this.dir.x}, ${this.dir.y}, ${this.dir.z}
  ${this.dir_as_centre ? 'dir_as_centre = true' : ''}
}`);
}

description() {
  const target = Array.isArray(this.particles)
    ? `${this.particles.length} particles`
    : (this.particles === -1 ? 'all particles' : `${this.particles}`);
  return `String force (F0=${this.F0}, rate=${this.rate}) on ${target}`;
}

_getArrowGroups() {
  return this._arrowGroups;
}

_clearViewerObjects() {
  this._arrowGroups = [];
}
}

class COMForce extends Force {
  type = "com";
  // arrays of BasicElement (nucleotides) for each group
  com_list = [];
  ref_list = [];
  stiff = 0.09;
  r0 = 1.2;
  rate = 0.0;

  // for drawing like other traps
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

  equals(compareForce) {
    if (!(compareForce instanceof COMForce)) return false;
    // shallow compare by element identity + params
    const sameA = this.com_list.length === compareForce.com_list.length &&
                  this.com_list.every((e, i) => e === compareForce.com_list[i]);
    const sameB = this.ref_list.length === compareForce.ref_list.length &&
                  this.ref_list.every((e, i) => e === compareForce.ref_list[i]);
    return sameA && sameB &&
           this.stiff === compareForce.stiff &&
           this.r0 === compareForce.r0 &&
           this.rate === compareForce.rate;
  }

  setFromParsedJson(parsedjson) {
    for (const param in parsedjson) {
      if (param === 'com_list' || param === 'ref_list') {
        const arr = parsedjson[param];
        if (!Array.isArray(arr)) {
          const err = `Invalid ${param} (expected array of element ids)`;
          notify(err, "alert"); throw err;
        }
        this[param] = arr.map(id => elements.get(id)).filter(p => p !== undefined);
        if (this[param].length === 0) {
          const err = `${param} is empty or contains invalid ids`;
          notify(err, "alert"); throw err;
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
      com_list: this.com_list.map(p => p.id),
      ref_list: this.ref_list.map(p => p.id),
      stiff: this.stiff,
      r0: this.r0,
      rate: this.rate
    };
  }

  toString(idMap) {
    const ids = a => a.map(p => idMap ? idMap.get(p) : p.id).join(' ');
    return (`{
    type = ${this.type}
    com_list = ${ids(this.com_list)}
    ref_list = ${ids(this.ref_list)}
    stiff = ${this.stiff}
    r0 = ${this.r0}
    rate = ${this.rate}
}`);
  }

  description() {
    return `COM force between groups (${this.com_list.length}) → (${this.ref_list.length})`;
  }

  update() {
    // compute group COMs from current positions (viewer uses bbOffsets the same
    // way other forces do for positions) :contentReference[oaicite:8]{index=8}
    const com = this._avg(this.com_list);
    const ref = this._avg(this.ref_list);

    // visualize the equilibrium segment from COM toward ref with length r0
    let dir = ref.clone().sub(com);
    const dist = dir.length();
    if (dist > 0) dir.normalize();

    this.eqDists = [
      com,
      com.clone().add(dir.clone().multiplyScalar(this.r0))
    ];

    // match the backend magnitude: (|d| - (r0 + rate*step)) * stiff / |com_list|
    // We don’t have discrete “step” here; the viewer’s timebase is frame-like.
    // You already expose a per-redraw time via window.currentSimTime (used by the sphere); reuse it. :contentReference[oaicite:9]{index=9}
    const stepsPerFrame = (typeof window !== "undefined" && window.currentSimTime !== undefined)
      ? window.currentSimTime : 0;

    const target = this.r0 + this.rate * stepsPerFrame;
    const mag = (dist - target) * this.stiff / Math.max(this.com_list.length, 1);

    this.force = [
      com,
      com.clone().add(dir.clone().multiplyScalar(Math.abs(mag)))
    ];
  }

  _avg(list) {
    // average of THREE.Vector3 positions for a set of elements
    const v = new THREE.Vector3(0, 0, 0);
    if (!Array.isArray(list) || list.length === 0) return v;
    list.forEach(p => v.add(p.getInstanceParameter3("bbOffsets")));
    v.multiplyScalar(1.0 / list.length);
    return v;
  }
}
// Forces which can be drawn as a plane
class PlaneForce extends Force {
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
                  // this.dir = new THREE.Vector3(...dirData);
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

class Box extends Force {
constructor() {
  super();
  this.type = 'Box';

  // oxDNA params
  this.center = new THREE.Vector3(0, 0, 0);
  this.lx = 1;
  this.ly = 1;
  this.lz = 1;

  // viewer state
  this.mesh = undefined;       // THREE.Mesh
  this.outline = undefined;    // THREE.LineSegments (optional, for edges)
}

set(center=new THREE.Vector3(0,0,0), lx, ly, lz) {
  this.center = center;
  this.lx = lx;
  this.ly = ly;
  this.lz = lz;
  this.update();
}

setFromParsedJson(parsedjson) {
  for (const param in parsedjson) {
    if (param === 'center') {
      const c = parsedjson[param];
      this.center = new THREE.Vector3(c[0], c[1], c[2]);
    } else {
      this[param] = parsedjson[param];
    }
  }
  this.update();
}

update() {
    // Determine a notion of "step"
    let step = 0;
    try {
      const sys = (typeof systems !== 'undefined' && systems.length > 0) ? systems[systems.length - 1] : undefined;
      const r = sys?.reader;
      step =
        (Number.isFinite(r?.confIndex) ? r.confIndex :
         Number.isFinite(r?.frameIndex) ? r.frameIndex :
         Number.isFinite(r?.current)    ? r.current    :
         Number.isFinite(r?.frame)      ? r.frame      : 0);
    } catch (_) {}
  }

  toJSON() {
    return {
      type: this.type,
      center: [this.center.x, this.center.y, this.center.z],
      lx: this.lx,
      ly: this.ly,
      lz: this.lz,
    };
  }

  toString(idMap) {
    return (`{
    type = ${this.type}
    center = ${this.center.x},${this.center.y},${this.center.z}
    lx = ${this.lx}
    ly = ${this.ly}
    lz = ${this.lz}
    ${extra.join('\n  ')}
  }`);
  }

description() {
  return `Box`;
}
}

class RepulsionPlaneMoving extends PlaneForce {
  type = 'repulsion_plane_moving';
  // inherit: particles, stiff, dir, position
  ref_particles = [];   // array<BasicElement>

  setFromParsedJson(parsedjson) {
    for (const param in parsedjson) {
      if (param === 'particle') {
        const v = parsedjson[param];
        if (Array.isArray(v)) this.particles = v.map(id => elements.get(id)).filter(Boolean);
        else if (v === -1) this.particles = -1;
        else this.particles = [elements.get(v)];
      } else if (param === 'ref_particle') {
        const arr = Array.isArray(parsedjson[param]) ? parsedjson[param]
                  : (typeof parsedjson[param] === 'string' ? parsedjson[param].split(',').map(s => +s)
                     : [parsedjson[param]]);
        this.ref_particles = arr.map(id => elements.get(id)).filter(Boolean);
      } else if (param === 'dir') {
        const d = parsedjson[param];
        this.dir = new THREE.Vector3(d[0], d[1], d[2]).normalize();
      } else {
        this[param] = parsedjson[param];
      }
    }
    this.update();
  }

  _avgRef() {
    const v = new THREE.Vector3(0,0,0);
    if (this.ref_particles.length === 0) return v;
    this.ref_particles.forEach(p => v.add(p.getInstanceParameter3("bbOffsets")));
    v.multiplyScalar(1.0 / this.ref_particles.length);
    return v;
  }

  update() {
    // recompute plane offset d = -dir·p̄ and store both d and a point on plane
    const pbar = this._avgRef();
    this.position = - this.dir.dot(pbar);
    this._pointOnPlane = pbar; // useful for debugging / labels
  }
}
class RepulsiveSphere extends Force {
  constructor() {
    super();
    this.type = 'sphere';

    // oxDNA params
    this.particles = -1;         // -1 (all) or array<BasicElement>
    this.stiff = 10.0;           // harmonic stiffness (for display only; sim uses it)
    this.r0 = 6.0;               // initial radius
    this.rate = 0.0;             // growth per frame/step (viewer: per redraw tick)
    this.center = new THREE.Vector3(0, 0, 0);
    this.target = null;
    this.moveSteps = 0;
    this._startCenter = null;

    // viewer state
    this.currentRadius = this.r0;
    this.mesh = undefined;       // THREE.Mesh
    this.outline = undefined;    // THREE.LineSegments (optional, for edges)
  }

  set(particles, stiff = 10, r0 = 6, rate = 0, center = new THREE.Vector3(0,0,0)) {
    this.particles = particles;
    this.stiff = stiff;
    this.r0 = r0;
    this.rate = rate;
    this.center = center;
    this.currentRadius = r0;
    this.initialCenter = center.clone();
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
        } else {
          // allow single id or a "a-b" range string
          if (typeof v === 'string' && v.includes('-')) {
            const [a, b] = v.split('-').map(Number);
            const ids = [];
            for (let k = a; k <= b; k++) ids.push(k);
            this.particles = ids.map(id => elements.get(id)).filter(p => p !== undefined);
          } else {
            const el = elements.get(v);
            if (el === undefined) {
              const err = `Particle ${v} in parsed force file does not exist.`;
              notify(err, "alert");
              throw err;
            }
            this.particles = [el];
          }
        }
      } else if (param === 'center') {
        const c = parsedjson[param];
        this.center = new THREE.Vector3(c[0], c[1], c[2]);
        this.initialCenter = this.center.clone();
      } else if (param === 'target') {
          const t = parsedjson[param];
          this.target = new THREE.Vector3(t[0], t[1], t[2]);
      } else if (param === 'move_steps') {
      this.moveSteps = parsedjson[param] | 0;
      } else {
        this[param] = parsedjson[param];
      }
    }
    this.currentRadius = this.r0;
    this.update();
  }

  update() {
      // Determine a notion of "step"
      let step = 0;
      try {
        const sys = (typeof systems !== 'undefined' && systems.length > 0) ? systems[systems.length - 1] : undefined;
        const r = sys?.reader;
        step =
          (Number.isFinite(r?.confIndex) ? r.confIndex :
           Number.isFinite(r?.frameIndex) ? r.frameIndex :
           Number.isFinite(r?.current)    ? r.current    :
           Number.isFinite(r?.frame)      ? r.frame      : 0);
      } catch (_) {}

      if (typeof window !== 'undefined' && Number.isFinite(window.currentFrameIndex)) {
        step = window.currentFrameIndex;
      }

      // Viewer uses this as a time-like scalar; keep your existing radius growth
      const stepsPerFrame = (typeof window !== "undefined" && window.currentSimTime !== undefined)
        ? window.currentSimTime : step;

      // Grow/shrink radius
      this.currentRadius = this.r0 + this.rate * stepsPerFrame;
      console.log("frame: ", stepsPerFrame, "; radius = ", this.currentRadius, "; center = ", this.center)
      // const dx = (this.target.x - this.initialCenter.x)/this.moveSteps
      // const dy = (this.target.y - this.initialCenter.y)/this.moveSteps
      // const dz = (this.target.z - this.initialCenter.z)/this.moveSteps

      // this.center.x = this.initialCenter.x + dx*stepsPerFrame
      // this.center.y = this.initialCenter.y + dy*stepsPerFrame
      // this.center.z = this.initialCenter.z + dz*stepsPerFrame

      // // console.log("Start Center:", this.initialCenter, "; Center:", this.center);
      // // console.log(dx, dy, dz)

      // console.log(`frame ${step}: center=(${this.center.x.toFixed(3)}, ${this.center.y.toFixed(3)}, ${this.center.z.toFixed(3)})`);

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
        ...(this.target ? { target: [this.target.x, this.target.y, this.target.z] } : {}),
        ...(this.moveSteps ? { move_steps: this.moveSteps } : {})
      };
    }

    toString(idMap) {
      const particleRepresentation =
        Array.isArray(this.particles)
          ? this.particles.map(p => idMap ? idMap.get(p) : p.id).join(", ")
          : this.particles.toString();

      const extra = [];
      if (this.target) extra.push(`target = ${this.target.x},${this.target.y},${this.target.z}`);
      if (this.moveSteps) extra.push(`move_steps = ${this.moveSteps}`);

      return (`{
      type = ${this.type}
      particle = ${particleRepresentation}
      center = ${this.center.x},${this.center.y},${this.center.z}
      stiff = ${this.stiff}
      rate = ${this.rate}
      r0 = ${this.r0}
      ${extra.join('\n  ')}
    }`);
    }

  description() {
    const target =
      Array.isArray(this.particles)
        ? `${this.particles.length} particles`
        : (this.particles === -1 ? "all particles" : `${this.particles}`);
    return `Repulsive sphere @ ${this.center.toArray().map(n => Number(n).toFixed(2)).join(',')} on ${target}`;
  }
}


  class RepulsiveKeplerPoinsot extends Force {
    constructor() {
      super();
      this.type = 'repulsive_kepler_poinsot';
      this.particles = -1;
      this.stiff = 10.0;
      this.rate = 0.0;
      this.center = new THREE.Vector3(0, 0, 0);
      this.apex = 1.20;
      this.base = 0.70;
      this.base_radius = 0.45;
      this.kappa = 25.0;
      this.currentScale = 1.0;
      this.group = undefined;
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
            this.particles = v.map((id) => elements.get(id)).filter((p) => p !== undefined);
          } else if (v === -1 || v === 'all') {
            this.particles = -1;
          } else if (typeof v === 'string' && v.includes('-')) {
            const [a, b] = v.split('-').map(Number);
            const ids = [];
            for (let k = a; k <= b; k++)
              ids.push(k);
            this.particles = ids.map((id) => elements.get(id)).filter((p) => p !== undefined);
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
    update() {
      // oxDNA applies growth = 1 + rate * step (see RepulsiveKeplerPoinsot::value()).
      // Mirror the same behavior using the viewer's best-guess current frame/step.
      const step = (window?.currentSimTime ?? window?.currentFrameIndex ?? 0);
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
      const target = Array.isArray(this.particles) ? `${this.particles.length} particles` : (this.particles === -1 ? "all particles" : `${this.particles}`);
      return `Repulsive Kepler–Poinsot star @ ${this.center.toArray().map(n => n.toFixed(2)).join(',')} on ${target}`;
    }
  }



class RepulsiveSphereMoving extends Force {
constructor() {
  super();
  this.type = 'repulsive_sphere_moving';

  // oxDNA params
  this.particles = -1;         // -1 (all) or array<BasicElement>
  this.stiff = 10.0;           // harmonic stiffness (for display only; sim uses it)
  this.r0 = 6.0;               // initial radius
  this.rate = 0.0;             // growth per frame/step (viewer: per redraw tick)
  this.r_ext = 1e20;
  this.origin = new THREE.Vector3(0, 0, 0);
  this.target = new THREE.Vector3(0, 0, 0);
  this.moveSteps = 0;

  // viewer state
  this.currentRadius = this.r0;
  this.currentCenter = this.origin;
  // this.center.copy(this.currentCenter);
  this.center = this.currentCenter.clone()
  this.mesh = undefined;       // THREE.Mesh
  this.outline = undefined;    // THREE.LineSegments (optional, for edges)
}

set(particles, stiff = 10, r0 = 6, rate = 0, origin = new THREE.Vector3(0,0,0)) {
  this.particles = particles;
  this.stiff = stiff;
  this.r0 = r0;
  this.rate = rate;
  this.currentRadius = r0;
  this.currentCenter = origin;
  this.center.copy(this.currentCenter);
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
      } else {
        // allow single id or a "a-b" range string
        if (typeof v === 'string' && v.includes('-')) {
          const [a, b] = v.split('-').map(Number);
          const ids = [];
          for (let k = a; k <= b; k++) ids.push(k);
          this.particles = ids.map(id => elements.get(id)).filter(p => p !== undefined);
        } else {
          const el = elements.get(v);
          if (el === undefined) {
            const err = `Particle ${v} in parsed force file does not exist.`;
            notify(err, "alert");
            throw err;
          }
          this.particles = [el];
        }
      }
    } else if (param === 'origin') {
      const c = parsedjson[param];
      this.center = new THREE.Vector3(c[0], c[1], c[2]);
      this.initialCenter = this.center.clone();
    } else if (param === 'target') {
        const t = parsedjson[param];
        this.target = new THREE.Vector3(t[0], t[1], t[2]);
    } else if (param === 'steps') {
    this.moveSteps = parsedjson[param] | 0;
    } else {
      this[param] = parsedjson[param];
    }
  }
  this.currentRadius = this.r0;
  this.update();
}

update() {
    // Determine a notion of "step"
    let step = 0;
    try {
      const sys = (typeof systems !== 'undefined' && systems.length > 0) ? systems[systems.length - 1] : undefined;
      const r = sys?.reader;
      step =
        (Number.isFinite(r?.confIndex) ? r.confIndex :
          Number.isFinite(r?.frameIndex) ? r.frameIndex :
          Number.isFinite(r?.current)    ? r.current    :
          Number.isFinite(r?.frame)      ? r.frame      : 0);
    } catch (_) {}

    if (typeof window !== 'undefined' && Number.isFinite(window.currentFrameIndex)) {
      step = window.currentFrameIndex;
    }
    // Viewer uses this as a time-like scalar; keep your existing radius growth
    const stepsPerFrame = (typeof window !== "undefined" && window.currentSimTime !== undefined)
      ? window.currentSimTime : step;
    // console.log(stepsPerFrame)

    // Grow/shrink radius
    this.currentRadius = this.r0 + this.rate * stepsPerFrame;

    const dx = (this.target.x - this.initialCenter.x)/this.moveSteps
    const dy = (this.target.y - this.initialCenter.y)/this.moveSteps
    const dz = (this.target.z - this.initialCenter.z)/this.moveSteps

    this.center.x = this.initialCenter.x + dx*stepsPerFrame
    this.center.y = this.initialCenter.y + dy*stepsPerFrame
    this.center.z = this.initialCenter.z + dz*stepsPerFrame

    console.log("Start Center:", this.initialCenter, "; Center:", this.center);
    // console.log(dx, dy, dz)

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
      ...(this.target ? { target: [this.target.x, this.target.y, this.target.z] } : {}),
      ...(this.moveSteps ? { move_steps: this.moveSteps } : {})
    };
  }

  toString(idMap) {
    const particleRepresentation =
      Array.isArray(this.particles)
        ? this.particles.map(p => idMap ? idMap.get(p) : p.id).join(", ")
        : this.particles.toString();

    const extra = [];
    if (this.target) extra.push(`target = ${this.target.x},${this.target.y},${this.target.z}`);
    if (this.moveSteps) extra.push(`move_steps = ${this.moveSteps}`);

    return (`{
    type = ${this.type}
    particle = ${particleRepresentation}
    center = ${this.center.x},${this.center.y},${this.center.z}
    stiff = ${this.stiff}
    rate = ${this.rate}
    r0 = ${this.r0}
    ${extra.join('\n  ')}
  }`);
  }

description() {
  const target =
    Array.isArray(this.particles)
      ? `${this.particles.length} particles`
      : (this.particles === -1 ? "all particles" : `${this.particles}`);
  return `Repulsive sphere @ ${this.center.toArray().map(n => Number(n).toFixed(2)).join(',')} on ${target}`;
}
}
class RepulsiveEllipsoid extends Force {
constructor() {
  super();
  // match external force file: type = ellipse
  this.type = 'ellipsoid';
  console.log("REPULSIVE ELLIPSE")
  // oxDNA-style parameters (visual only here)
  this.particles = -1;        // -1 (all) or array<BasicElement>
  this.stiff = 10.0;
  this.rate = 0.0;            // NEW: growth rate (same semantics as sphere: Rc = 1 + rate * step)
  this.outerAxes = new THREE.Vector3(6, 6, 6);  // corresponds to r_2 at step 0
  this.innerAxes = null;                        // optional r_1
  this.center = new THREE.Vector3(0, 0, 0);

  // viewer state
  this.mesh = undefined;
  this.outline = undefined;
  this._baseRadius = 1.0;   // unit sphere we will anisotropically scale

  // keep initial axes separate so we can scale with time
  this._baseOuterAxes = this.outerAxes.clone();
  this.currentScale = 1.0;   // Rc(t) = 1 + rate * step
}

set(particles, stiff, r2Vec, r1Vec = null, center = new THREE.Vector3(0, 0, 0), rate = 0.0) {
  this.particles = particles;
  this.stiff = stiff;
  this.outerAxes = r2Vec.clone();
  this._baseOuterAxes = this.outerAxes.clone();
  this.innerAxes = r1Vec ? r1Vec.clone() : null;
  this.center = center.clone();
  this.rate = rate;
  this.currentScale = 1.0;
}

setFromParsedJson(parsedjson) {
  for (const param in parsedjson) {
    const v = parsedjson[param];

    if (param === 'particle') {
      // Same logic as RepulsiveSphere
      if (Array.isArray(v)) {
        this.particles = v.map(id => elements.get(id)).filter(p => p !== undefined);
      } else if (v === -1 || v === 'all') {
        this.particles = -1;
      } else if (typeof v === 'string' && v.includes('-')) {
        const [a, b] = v.split('-').map(Number);
        const ids = [];
        for (let k = a; k <= b; k++) ids.push(k);
        this.particles = ids.map(id => elements.get(id)).filter(p => p !== undefined);
      } else {
        const el = elements.get(v);
        if (el === undefined) {
          const err = `Particle ${v} in parsed force file does not exist.`;
          notify(err, "alert");
          throw err;
        }
        this.particles = [el];
      }
    } else if (param === 'center') {
      // center = x,y,z OR [x,y,z]
      const c = Array.isArray(v) ? v : v.split(',').map(Number);
      this.center = new THREE.Vector3(c[0], c[1], c[2]);
    } else if (param === 'r_2') {
      const r2 = Array.isArray(v) ? v : v.split(',').map(Number);
      this.outerAxes = new THREE.Vector3(r2[0], r2[1], r2[2]);
      this._baseOuterAxes = this.outerAxes.clone();
    } else if (param === 'r_1') {
      const r1 = Array.isArray(v) ? v : v.split(',').map(Number);
      this.innerAxes = new THREE.Vector3(r1[0], r1[1], r1[2]);
    } else if (param === 'rate') {
      this.rate = +v;
    } else {
      // stiff or any other scalar
      this[param] = v;
    }
  }
}

update() {
  // Mirror the "step" logic used for sphere / moving sphere
  let step = 0;
  try {
    const sys = (typeof systems !== 'undefined' && systems.length > 0)
      ? systems[systems.length - 1]
      : undefined;
    const r = sys?.reader;
    step =
      (Number.isFinite(r?.confIndex) ? r.confIndex :
       Number.isFinite(r?.frameIndex) ? r.frameIndex :
       Number.isFinite(r?.current)    ? r.current    :
       Number.isFinite(r?.frame)      ? r.frame      : 0);
  } catch (_) {}

  if (typeof window !== 'undefined' && Number.isFinite(window.currentFrameIndex)) {
    step = window.currentFrameIndex;
  }
  if (typeof window !== 'undefined' && Number.isFinite(window.currentSimTime)) {
    step = window.currentSimTime;
  }

  // Backend uses Rc = 1 + rate * step
  this.currentScale = 1.0 + this.rate * step;
  if (!Number.isFinite(this.currentScale) || this.currentScale <= 0.0) {
    this.currentScale = 1.0;
  }

  console.log(this.currentScale)

}

toJSON() {
  const particleData = Array.isArray(this.particles)
    ? this.particles.map(p => p.id)
    : this.particles;

    return {
      type: this.type,
      particle: particleData,
      stiff: this.stiff,
      rate: this.rate,
      r_2: [this.outerAxes.x, this.outerAxes.y, this.outerAxes.z],
      ...(this.innerAxes ? { r_1: [this.innerAxes.x, this.innerAxes.y, this.innerAxes.z] } : {}),
      center: [this.center.x, this.center.y, this.center.z],
    };  
}

toString(idMap) {
  const particleRepresentation =
    Array.isArray(this.particles)
      ? this.particles.map(p => idMap ? idMap.get(p) : p.id).join(", ")
      : this.particles.toString();

  const innerStr = this.innerAxes
    ? `\n  r_1 = ${this.innerAxes.x},${this.innerAxes.y},${this.innerAxes.z}`
    : "";

  return (`{
    type = ${this.type}
    particle = ${particleRepresentation}
    center = ${this.center.x},${this.center.y},${this.center.z}
    stiff = ${this.stiff}
    rate = ${this.rate}
    r_2 = ${this.outerAxes.x},${this.outerAxes.y},${this.outerAxes.z}${innerStr}
  }`);

}

description() {
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
class AFMMovingSphere extends Force {
constructor() {
  super();
  this.type = 'AFMMovingSphere';

  // ---- physical / controller params (defaults) ----
  this.particles = -1;
  this.stiff = 5.0;
  this.r0 = 5.0;
  this.rate = 0.0;
  this.r_ext = 2.0;

  this.dir = new THREE.Vector3(0, 0, 1);   // approach direction
  this.F_set = 1.0;
  this.Kp = 0.01;
  this.max_step = 0.1;
  this.eps = 1e-3;
  this.log_every = 0;

  // ---- motion / nominal tip ref positions ----
  // ref_position == origin of the tip at the start of scan
  // target is used only for simple linear travel mode
  this.ref_position = new THREE.Vector3(-10, 0, -10);
  this.target       = new THREE.Vector3(-10, 0, -10);
  this.moveSteps    = 0;

  // ---- scan params ----
  // These will be filled from forces_3.txt
  this.scan_origin_xy     = new THREE.Vector2(-60, -60);
  this.scan_size_xy       = new THREE.Vector2(128, 128);
  this.scan_pixels        = new THREE.Vector2(64, 64); // (Nx, Ny)
  this.scan_serpentine    = 1;
  this.pixel_step_guard   = 200;
  this.pixel_settle_steps = 2000;
  this.pixel_sample_steps = 1000;
  this.scanEnabled        = true; // will confirm below

  // ---- viewer state ----
  this.currentRadius = this.r0;

  // live sphere center in viewer coords
  this.center = new THREE.Vector3(
    this.scan_origin_xy.x,
    this.scan_origin_xy.y,
    this.ref_position.z
  );

  // initial center for non-scan interpolation mode
  this.initialCenter = this.center.clone();

  // rendering handles
  this.mesh = undefined;
  this.outline = undefined;
}

// helper to parse vec2 "a,b" or [a,b]
_vec2From(val, fallback) {
  if (Array.isArray(val) && val.length >= 2) {
    return new THREE.Vector2(+val[0], +val[1]);
  }
  if (typeof val === "string") {
    const parts = val.split(",").map(Number);
    if (parts.length >= 2 && parts.every(n => Number.isFinite(n))) {
      return new THREE.Vector2(parts[0], parts[1]);
    }
  }
  return fallback.clone();
}

// helper to parse vec3 "a,b,c" or [a,b,c]
_vec3From(val, fallback) {
  if (Array.isArray(val) && val.length >= 3) {
    return new THREE.Vector3(+val[0], +val[1], +val[2]);
  }
  if (typeof val === "string") {
    const parts = val.split(",").map(Number);
    if (parts.length >= 3 && parts.every(n => Number.isFinite(n))) {
      return new THREE.Vector3(parts[0], parts[1], parts[2]);
    }
  }
  return fallback.clone();
}

// Merge parsed JSON (viewer-side parse of forces_3.txt) into this object.
// Anything not provided keeps its current value.
setFromParsedJson(parsedjson) {

  for (const key in parsedjson) {
    const v = parsedjson[key];

    switch (key) {
      case "particle":
      case "particles": {
        if (Array.isArray(v)) {
          this.particles = v.map(id => elements.get(id)).filter(Boolean);
        } else if (v === -1 || v === "all") {
          this.particles = -1;
        } else if (typeof v === "string" && v.includes("-")) {
          const [a,b] = v.split("-").map(Number);
          const ids = [];
          for (let k=a; k<=b; k++) ids.push(k);
          this.particles = ids.map(id => elements.get(id)).filter(Boolean);
        } else {
          const el = elements.get(v);
          if (!el) {
            const err = `Particle ${v} in parsed force file does not exist.`;
            notify(err, "alert");
            throw err;
          }
          this.particles = [el];
        }
        break;
      }

      // physical / controller params
      case "stiff":        this.stiff        = +v; break;
      case "r0":           this.r0           = +v; break;
      case "rate":         this.rate         = +v; break;
      case "r_ext":        this.r_ext        = +v; break;
      case "F_set":        this.F_set        = +v; break;
      case "Kp":           this.Kp           = +v; break;
      case "max_step":     this.max_step     = +v; break;
      case "eps":          this.eps          = +v; break;
      case "log_every":    this.log_every    = +v; break;
      case "dir":          this.dir          = this._vec3From(v, this.dir); break;

      // motion endpoints
      case "ref_position":
        this.ref_position = this._vec3From(v, this.ref_position);
        break;
      case "target":
        this.target = this._vec3From(v, this.target);
        break;
      case "move_steps":
      case "moveSteps":
      case "steps":
        this.moveSteps = (v|0);
        break;

      // scan geometry/time
      case "scan_origin_xy":
        this.scan_origin_xy = this._vec2From(v, this.scan_origin_xy);
        break;
      case "scan_size_xy":
        this.scan_size_xy   = this._vec2From(v, this.scan_size_xy);
        break;
      case "scan_pixels":
        // could be "64,64" or [64,64]
        this.scan_pixels    = this._vec2From(v, this.scan_pixels);
        break;
      case "scan_serpentine":
        this.scan_serpentine = (v|0);
        break;

      case "pixel_step_guard":
        this.pixel_step_guard = (v|0);
        break;
      case "pixel_settle_steps":
        this.pixel_settle_steps = (v|0);
        break;
      case "pixel_sample_steps":
        this.pixel_sample_steps = (v|0);
        break;

      default:
        // keep anything extra just in case (e.g. save_csv)
        this[key] = v;
        break;
    }
  }

  // mark scan enabled only if Nx,Ny are sensible
  const Nx = this.scan_pixels.x | 0;
  const Ny = this.scan_pixels.y | 0;
  this.scanEnabled =
    Nx > 0 && Ny > 0 &&
    this.scan_size_xy.x >= 0 && this.scan_size_xy.y >= 0;

  // initialize center/initialCenter consistently with new params
  this.center = new THREE.Vector3(
    this.scan_origin_xy.x,
    this.scan_origin_xy.y,
    this.ref_position.z
  );
  this.initialCenter = this.center.clone();

  // radius cache
  this.currentRadius = this.r0;

  this.update();
}

// utility: figure out "sim step" using the same heuristic you already use elsewhere
_currentSimStep() {
  let step = 0;
  try {
    const sys = (typeof systems !== "undefined" && systems.length > 0)
      ? systems[systems.length - 1]
      : undefined;
    const r = sys?.reader;
    step =
      (Number.isFinite(r?.confIndex) ? r.confIndex :
       Number.isFinite(r?.frameIndex) ? r.frameIndex :
       Number.isFinite(r?.current)    ? r.current    :
       Number.isFinite(r?.frame)      ? r.frame      : 0);
  } catch (_) {}
  if (typeof window !== "undefined" && Number.isFinite(window.currentFrameIndex)) {
    step = window.currentFrameIndex;
  }
  // If you store a sim time separately (substeps per frame), prefer that
  if (typeof window !== "undefined" && Number.isFinite(window.currentSimTime)) {
    step = window.currentSimTime;
  }
  return step;
}

update() {
  const step = this._currentSimStep();

  // radius growth: r = r0 + rate * step  (matches backend radius = _r0 + _rate*step)
  this.currentRadius = this.r0 + this.rate * step;

  // if we have scan parameters -> reconstruct scan path
  if (this.scanEnabled) {
    const Nx = this.scan_pixels.x | 0;
    const Ny = this.scan_pixels.y | 0;

    const guard  = this.pixel_step_guard;
    const settle = this.pixel_settle_steps;
    const sample = this.pixel_sample_steps;
    const perPix = guard + settle + sample; // matches _guard+_settle+_sample in C++ :contentReference[oaicite:8]{index=8}

    // which pixel (linear index 0..Nx*Ny-1) are we in at this step?
    const pixLinear = Math.floor(step / perPix);
    const maxPix    = Math.max(Nx * Ny - 1, 0);
    const pixClamped = Math.min(pixLinear, maxPix);

    // convert to (ix, iy) raster coordinates
    const iy = Math.floor(pixClamped / Nx);
    const ix = pixClamped % Nx;

    // serpentine: alternate x direction each row
    let scan_ix = ix;
    if (this.scan_serpentine && (iy % 2 === 1)) {
      scan_ix = (Nx - 1) - ix;
    }

    // lateral mapping to [x0 .. x0+Lx], [y0 .. y0+Ly]
    const x0 = this.scan_origin_xy.x;
    const y0 = this.scan_origin_xy.y;
    const Lx = this.scan_size_xy.x;
    const Ly = this.scan_size_xy.y;

    const dx = (Nx > 1) ? (Lx / (Nx - 1)) : 0.0;
    const dy = (Ny > 1) ? (Ly / (Ny - 1)) : 0.0;

    const cx = x0 + scan_ix * dx;
    const cy = y0 + iy      * dy;

    // now approximate Z:
    // - base is ref_position.z
    // - every new row, real code bumps tip: _center_curr += _dir * 5.0 once per row transition :contentReference[oaicite:9]{index=9}
    //   We'll approximate that as 5 * iy along +dir.
    //
    // - within a pixel, there are phases:
    //   [0, guard)   : after lateral jump, tip is still high
    //   [guard, guard+settle): controller is moving down toward contact
    //   [guard+settle, guard+settle+sample): we are "in contact"
    //
    // We fake this by blending between a "highZ" and "touchZ".

    // normalize dir
    const dirNorm = this.dir.clone();
    const dlen = dirNorm.length();
    if (dlen > 0) dirNorm.divideScalar(dlen);

    // base height if we never approached the surface
    const baseZ = this.ref_position.z + (5.0 * iy * dirNorm.z);

    const kInPixel = step % perPix;
    const highFrac = (kInPixel < guard) ? 1.0 :
                     (kInPixel < guard + settle)
                       ? 1.0 - (kInPixel-guard)/Math.max(settle,1)
                       : 0.0;

    // "touchZ": push a little further along -dirNorm (downwards if dir is +z)
    // we don't know actual controller result (_center_curr with Kp),
    // but visually we just need to show it's lower during sampling.
    const approachDist = 2.0; // tunable visualization only
    const touchZ = baseZ + (-approachDist * dirNorm.z);

    const cz = highFrac * baseZ + (1.0 - highFrac) * touchZ;

    // update live center for rendering
    this.center.set(cx, cy, cz);
    console.log("Center: ", this.center)

  } else {
    // fallback: no scan, just linear interpolation ref_position -> target over moveSteps
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

    this.center.set(
      ox + (tx - ox) * t,
      oy + (ty - oy) * t,
      oz + (tz - oz) * t
    );
  }

  // after computing .center and .currentRadius, the renderer / drawSpheres()
  // will position the THREE.Mesh at this.center and scale by this.currentRadius.
}

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
    r_ext: this.r_ext,
    dir: [this.dir.x, this.dir.y, this.dir.z],
    F_set: this.F_set,
    Kp: this.Kp,
    max_step: this.max_step,
    eps: this.eps,
    ref_position: [this.ref_position.x, this.ref_position.y, this.ref_position.z],
    target: [this.target.x, this.target.y, this.target.z],
    move_steps: this.moveSteps,
    scan_origin_xy: [this.scan_origin_xy.x, this.scan_origin_xy.y],
    scan_size_xy: [this.scan_size_xy.x, this.scan_size_xy.y],
    scan_pixels: [this.scan_pixels.x, this.scan_pixels.y],
    scan_serpentine: this.scan_serpentine,
    pixel_step_guard: this.pixel_step_guard,
    pixel_settle_steps: this.pixel_settle_steps,
    pixel_sample_steps: this.pixel_sample_steps,
    center: [this.center.x, this.center.y, this.center.z],
  };
}

toString(idMap) {
  const particleRepresentation =
    Array.isArray(this.particles)
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
  const target =
    Array.isArray(this.particles)
      ? `${this.particles.length} particles`
      : (this.particles === -1 ? "all particles" : `${this.particles}`);

  return `AFMMovingSphere tip @ ${this.center
    .toArray()
    .map(n => Number(n).toFixed(2))
    .join(',')} on ${target}`;
}
}



class ForceHandler {
  types = [];
  knownTrapForces = ['mutual_trap', 'skew_trap', 'com']; //these are the forces I know how to draw via lines
  knownPlaneForces = ["repulsion_plane", "attraction_plane", "repulsion_plane_moving"]; //these are the forces I know how to draw via planes
  // inside class ForceHandler
  knownSphereForces = ['sphere', "repulsive_sphere_moving", "AFMMovingSphere", "ellipsoid", "repulsive_kepler_poinsot"];         // NEW
  knownBoxForces = ['Box'];
  knownStringForces = ['string'];

  forceColors = [
      new THREE.Color(0x0000FF),
      new THREE.Color(0xFF0000),
  ];
  planeColors = [
      new THREE.Color(0x00FF00),
      new THREE.Color(0xFF00FF),
  ];
  sphereColors = [ new THREE.Color(0x00BFFF) ];
  sphereMeshes = [];                       // optional bookkeeping

  // --- add with the other colors ---
  boxColors = [
      new THREE.Color(0xFFA500), // orange (or whatever)
  ];
  boxMeshes = [];
  boxOutlines = [];

  forceLines = [];
  eqDistLines;
  forcePlanes = [];
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
        this.drawSpheres();          // NEW
        this.drawBoxes();   // NEW
        this.drawStrings(); // NEW
      } catch (exceptionVar) {
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

  getStrings() {
    return this.forces.filter(f => this.knownStringForces.includes(f.type));
  }
  clearForcesFromScene() {
    this.sceneObjects.forEach(o => scene.remove(o));
    this.sceneObjects = [];
    this.forceLines = [];
    this.forcePlanes = [];
    this.sphereMeshes = [];
    try {
      this.getStrings().forEach(f => f._clearViewerObjects?.());
    } catch (_) {}
    // boxes are stored in f.mesh/f.outline; we just re-create next draw
    render();
  }    
  drawTraps() {
      // find out how many different types there are
      const traps = this.getTraps()

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
      // let materials = this.types.map((t, i) => new THREE.LineBasicMaterial({ color: this.forceColors[i] }));
      let materials = this.types.map((t, i) => {
          const opts = { color: this.forceColors[i] };
          if (t === 'com') opts.linewidth = 5;   // make CoM force line thicker
          return new THREE.LineBasicMaterial(opts);
      });
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
      this.drawCOM();
  }
  drawCOM() {
      const comForces = this.forces.filter(f => f.type === 'com');
      if (comForces.length === 0) return;

      comForces.forEach(f => {
        f.update();

        // 1) Get true endpoints: COM(ref_list) -> COM(com_list)
        const ref = f._avg(f.ref_list);
        const com = f._avg(f.com_list);

        const p0  = ref;                 // start at REF COM
        const p1  = com;                 // end at COM of target list
        const dir = p1.clone().sub(p0);
        const len = Math.max(dir.length(), 1e-6);
        const mid = p0.clone().add(p1).multiplyScalar(0.5);

        // 2) Create once, as UNIT height; we’ll scale Y to 'len'
        if (!f._comMesh) {
          const geom = new THREE.CylinderGeometry(0.12, 0.12, 1, 12);
          const mat  = new THREE.MeshBasicMaterial({ color: 0x1a088c });
          f._comMesh = new THREE.Mesh(geom, mat);
          scene.add(f._comMesh);
          this.sceneObjects.push(f._comMesh);
        }

        // 3) Orient cylinder's +Y axis to 'dir'
        const yAxis = new THREE.Vector3(0, 1, 0);
        const q = new THREE.Quaternion().setFromUnitVectors(yAxis, dir.clone().normalize());
        f._comMesh.quaternion.copy(q);

        // 4) Scale & position to span COM(ref) -> COM(com)
        f._comMesh.scale.set(1, len, 1);
        f._comMesh.position.copy(mid);
      });
    }

    redrawCOM() {
      const comForces = this.forces.filter(f => f.type === 'com');
      comForces.forEach(f => {
        f.update();

        const ref = f._avg(f.ref_list);
        const com = f._avg(f.com_list);

        const p0  = ref;
        const p1  = com;
        const dir = p1.clone().sub(p0);
        const len = Math.max(dir.length(), 1e-6);
        const mid = p0.clone().add(p1).multiplyScalar(0.5);

        if (!f._comMesh) return;

        const yAxis = new THREE.Vector3(0, 1, 0);
        const q = new THREE.Quaternion().setFromUnitVectors(yAxis, dir.clone().normalize());

        f._comMesh.quaternion.copy(q);
        f._comMesh.scale.set(1, len, 1);
        f._comMesh.position.copy(mid);
      });
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
          const texture = new THREE.CanvasTexture(ccanvas);
          const geometry = new THREE.PlaneGeometry(_extent, _extent);
          const material = new THREE.MeshBasicMaterial({
              map: texture,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.5 // Set the desired opacity (0.0 to 1.0)
          });
          const plane = new THREE.Mesh(geometry, material);
          const zAxis = new THREE.Vector3(0,0,1);
          const q = new THREE.Quaternion().setFromUnitVectors(zAxis, f.dir.clone().normalize());
          plane.quaternion.copy(q);
          plane.position.set(-f.position * f.dir.x, -f.position * f.dir.y, -f.position * f.dir.z);

          // plane.lookAt(f.dir.clone());
          // plane.position.set(-f.position * f.dir.x, -f.position * f.dir.y, -f.position * f.dir.z);
          scene.add(plane);
          f._mesh = plane;
          this.sceneObjects.push(plane);
          this.forcePlanes.push(plane);
      });
  }
  redrawPlanes() {
      const planes = this.getPlanes();
      planes.forEach(f => {
        if (!f._mesh) return;
        f.update?.(); // moving planes recompute position

          // Compute actual 3D position of the plane
          const px = -f.position * f.dir.x;
          const py = -f.position * f.dir.y;
          const pz = -f.position * f.dir.z;

          console.log(
          `[${f.type}] d=${f.position.toFixed(3)}  dir=(${f.dir.x.toFixed(2)},${f.dir.y.toFixed(2)},${f.dir.z.toFixed(2)})  point=(${px.toFixed(3)},${py.toFixed(3)},${pz.toFixed(3)})`
          );
        // Re-orient in case dir changes (cheap)
        const zAxis = new THREE.Vector3(0,0,1);
        const q = new THREE.Quaternion().setFromUnitVectors(zAxis, f.dir.clone().normalize());
        f._mesh.quaternion.copy(q);

        // Reposition
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
      render();
      this.redrawSpheres();
      this.redrawCOM();
      this.redrawPlanes();
      this.redrawBoxes();  // NEW
      this.redrawStrings(); // NEW
  }
  getBoxes() {
    return this.forces.filter(f => this.knownBoxForces.includes(f.type));
  }
    drawBoxes() {
      const boxes = this.getBoxes();
      if (boxes.length === 0) return;
    
      // optional: a small palette; reuse sphereColors if you want
      const colors = [
        new THREE.Color(0xffa500),
        new THREE.Color(0x00ffff),
        new THREE.Color(0xff00ff),
        new THREE.Color(0x00ff00),
      ];
    
      boxes.forEach((f, i) => {
        // If a Box has an update() (for moving boxes), call it once before draw
        if (typeof f.update === "function") f.update();
    
        // 1) Create a unit box, then scale to (lx, ly, lz)
        // BoxGeometry is centered at origin by default — perfect for "center"
        const geom = new THREE.BoxGeometry(1, 1, 1);
    
        const color = colors[i % colors.length];
        const mat = new THREE.MeshPhongMaterial({
          transparent: true,
          opacity: 0.15,
          color,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
    
        const mesh = new THREE.Mesh(geom, mat);
    
        // 2) Outline (edges)
        const edges = new THREE.EdgesGeometry(geom);
        const outline = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color })
        );
    
        // 3) Initial pose
        const c = (f.center instanceof THREE.Vector3) ? f.center : new THREE.Vector3(0, 0, 0);
        mesh.position.copy(c);
        outline.position.copy(c);
    
        const sx = Math.max(Number(f.lx ?? 1), 1e-6);
        const sy = Math.max(Number(f.ly ?? 1), 1e-6);
        const sz = Math.max(Number(f.lz ?? 1), 1e-6);
    
        // Since geometry is unit box (1,1,1), scale == side lengths
        mesh.scale.set(sx, sy, sz);
        outline.scale.set(sx, sy, sz);
    
        // 4) Add to scene
        scene.add(mesh);
        scene.add(outline);
    
        // 5) Store handles on the force (same pattern as spheres)
        f.mesh = mesh;
        f.outline = outline;
    
        this.sceneObjects.push(mesh, outline);
      });
    
      render();
    }
  
  redrawBoxes() {
    const boxes = this.getBoxes();
    if (boxes.length === 0) return;
  
    boxes.forEach(f => {
      if (typeof f.update === "function") f.update();
      if (!f.mesh) return;
  
      const c = (f.center instanceof THREE.Vector3) ? f.center : new THREE.Vector3(0, 0, 0);
  
      // 1) Position
      f.mesh.position.copy(c);
      if (f.outline) f.outline.position.copy(c);
  
      // 2) Scale (side lengths)
      const sx = Math.max(Number(f.lx ?? 1), 1e-6);
      const sy = Math.max(Number(f.ly ?? 1), 1e-6);
      const sz = Math.max(Number(f.lz ?? 1), 1e-6);
  
      f.mesh.scale.set(sx, sy, sz);
      if (f.outline) f.outline.scale.set(sx, sy, sz);
    });
  
    render();
  }    


  drawStrings() {
    const strings = this.getStrings();
    if (strings.length === 0) return;

    strings.forEach(f => {
      // Clear any cached arrow groups to avoid duplicates
      if (typeof f._clearViewerObjects === 'function') f._clearViewerObjects();
      if (typeof f.update === 'function') f.update();

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
    if (strings.length === 0) return;

    strings.forEach(f => {
      if (typeof f.update === 'function') f.update();
    });
  }
  getSpheres() {
      return this.forces.filter(f => this.knownSphereForces.includes(f.type));
    }
    drawSpheres() {
      const spheres = this.getSpheres();

      // 12 icosahedral directions (normalized) for Kepler–Poinsot-style star
      const phi = (1 + Math.sqrt(5)) / 2;
      const _kp_dirs = [
        new THREE.Vector3(0,  1,  phi), new THREE.Vector3(0, -1,  phi),
        new THREE.Vector3(0,  1, -phi), new THREE.Vector3(0, -1, -phi),
        new THREE.Vector3( 1,  phi, 0), new THREE.Vector3(-1,  phi, 0),
        new THREE.Vector3( 1, -phi, 0), new THREE.Vector3(-1, -phi, 0),
        new THREE.Vector3( phi, 0,  1), new THREE.Vector3( phi, 0, -1),
        new THREE.Vector3(-phi, 0,  1), new THREE.Vector3(-phi, 0, -1),
      ].map(v => v.normalize());

      const _makeStarGroup = (f, color) => {
        const g = new THREE.Group();

        const scale = Math.max((typeof f.currentScale === "number" ? f.currentScale : 1.0), 0.0);
        const apex = Math.max((f.apex ?? 1.2) * scale, 0.0);
        const base = Math.max((f.base ?? 0.7) * scale, 0.0);
        const h = Math.max(apex - base, 1e-6);
        const r = Math.max((f.base_radius ?? 0.45) * scale, 1e-6);

        const geom = new THREE.CylinderGeometry(0.0, r, h, 5, 1, false);
        const mat = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.25, color, side: THREE.DoubleSide });

        const edges = new THREE.EdgesGeometry(geom);
        const lineMat = new THREE.LineBasicMaterial({ color });

        _kp_dirs.forEach(n => {
          const spike = new THREE.Mesh(geom, mat);
          const yAxis = new THREE.Vector3(0, 1, 0);
          spike.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(yAxis, n.clone()));
          const c = (f.center ?? new THREE.Vector3(0,0,0)).clone().add(n.clone().multiplyScalar(base + 0.5 * h));
          spike.position.copy(c);
          g.add(spike);

          const outline = new THREE.LineSegments(edges, lineMat);
          outline.quaternion.copy(spike.quaternion);
          outline.position.copy(c);
          g.add(outline);
        });

        return g;
      };

    
      spheres.forEach(f => {
        if (typeof f.update === "function") f.update();

        // --- Kepler–Poinsot star repulsor ---
        if (f.type === "repulsive_kepler_poinsot") {
          const color = this.sphereColors[spheres.indexOf(f) % this.sphereColors.length];
          if (f.group) {
            scene.remove(f.group);
            this.sceneObjects = this.sceneObjects.filter(o => o !== f.group);
          }
          f.group = _makeStarGroup(f, color);
          scene.add(f.group);
          this.sceneObjects.push(f.group);
          return;
        }

    
        const baseRadius = 1.0;
        const seg = 100;
        const geom = new THREE.SphereGeometry(baseRadius, seg, seg);
        const color = this.sphereColors[spheres.indexOf(f) % this.sphereColors.length];
        const mat = new THREE.MeshPhongMaterial({
          transparent: true,
          opacity: 1,
          color,
          side: THREE.DoubleSide
        });
    
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(f.center ?? new THREE.Vector3(0, 0, 0));
    
        const edges = new THREE.EdgesGeometry(geom);
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color })
        );
        line.position.copy(mesh.position);
    
        if (f.outerAxes instanceof THREE.Vector3) {
          // Ellipsoid initial scale: base semi-axes (currentScale assumed 1 at start)
          const sx = Math.max(f.outerAxes.x, 1e-6);
          const sy = Math.max(f.outerAxes.y, 1e-6);
          const sz = Math.max(f.outerAxes.z, 1e-6);
          mesh.scale.set(sx, sy, sz);
          line.scale.set(sx, sy, sz);
          f._baseOuterAxes = f.outerAxes.clone();
        } else {
          // Sphere initial scale: just radius
          const r = Math.max(f.currentRadius ?? f.r0 ?? 1.0, 1e-6);
          mesh.scale.set(r, r, r);
          line.scale.set(r, r, r);
        }
    
        scene.add(mesh);
        scene.add(line);
    
        f.mesh = mesh;
        f.outline = line;
    
        this.sceneObjects.push(mesh, line);
        this.sphereMeshes.push(mesh);
      });
    }      

    redrawSpheres() {
      const spheres = this.getSpheres();

      // 12 icosahedral directions (normalized) for Kepler–Poinsot-style star
      const phi = (1 + Math.sqrt(5)) / 2;
      const _kp_dirs = [
        new THREE.Vector3(0,  1,  phi), new THREE.Vector3(0, -1,  phi),
        new THREE.Vector3(0,  1, -phi), new THREE.Vector3(0, -1, -phi),
        new THREE.Vector3( 1,  phi, 0), new THREE.Vector3(-1,  phi, 0),
        new THREE.Vector3( 1, -phi, 0), new THREE.Vector3(-1, -phi, 0),
        new THREE.Vector3( phi, 0,  1), new THREE.Vector3( phi, 0, -1),
        new THREE.Vector3(-phi, 0,  1), new THREE.Vector3(-phi, 0, -1),
      ].map(v => v.normalize());

      const _makeStarGroup = (f, color) => {
        const g = new THREE.Group();

        const scale = Math.max((typeof f.currentScale === "number" ? f.currentScale : 1.0), 0.0);
        const apex = Math.max((f.apex ?? 1.2) * scale, 0.0);
        const base = Math.max((f.base ?? 0.7) * scale, 0.0);
        const h = Math.max(apex - base, 1e-6);
        const r = Math.max((f.base_radius ?? 0.45) * scale, 1e-6);

        const geom = new THREE.CylinderGeometry(0.0, r, h, 5, 1, false);
        const mat = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.25, color, side: THREE.DoubleSide });

        const edges = new THREE.EdgesGeometry(geom);
        const lineMat = new THREE.LineBasicMaterial({ color });

        _kp_dirs.forEach(n => {
          const spike = new THREE.Mesh(geom, mat);
          const yAxis = new THREE.Vector3(0, 1, 0);
          spike.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(yAxis, n.clone()));
          const c = (f.center ?? new THREE.Vector3(0,0,0)).clone().add(n.clone().multiplyScalar(base + 0.5 * h));
          spike.position.copy(c);
          g.add(spike);

          const outline = new THREE.LineSegments(edges, lineMat);
          outline.quaternion.copy(spike.quaternion);
          outline.position.copy(c);
          g.add(outline);
        });

        return g;
      };

      if (spheres.length === 0) return;
    
      spheres.forEach(f => {
        if (typeof f.update === "function") f.update();
        
        // --- Kepler–Poinsot star repulsor ---
        if (f.type === "repulsive_kepler_poinsot") {
          if (f.group) {
            // re-center (spikes are positioned relative to f.center at creation)
            // simplest: rebuild group if center changed
            const color = this.sphereColors[spheres.indexOf(f) % this.sphereColors.length];
            scene.remove(f.group);
            this.sceneObjects = this.sceneObjects.filter(o => o !== f.group);
            f.group = _makeStarGroup(f, color);
            scene.add(f.group);
            this.sceneObjects.push(f.group);
          }
          return;
        }
if (!f.mesh) return;
    
        // 1) Update position
        if (f.center) {
          f.mesh.position.copy(f.center);
          if (f.outline) f.outline.position.copy(f.center);
        }
    
        // 2) Update scale
        if (f.outerAxes instanceof THREE.Vector3) {
          // -------- ELLIPSOID --------
          // We treat the geometry as a unit sphere and scale by (semi-axes * currentScale)
          const scaleFactor = (typeof f.currentScale === "number" && Number.isFinite(f.currentScale))
            ? f.currentScale
            : 1.0;
    
          const sx = Math.max((f._baseOuterAxes?.x ?? f.outerAxes.x) * scaleFactor, 1e-6);
          const sy = Math.max((f._baseOuterAxes?.y ?? f.outerAxes.y) * scaleFactor, 1e-6);
          const sz = Math.max((f._baseOuterAxes?.z ?? f.outerAxes.z) * scaleFactor, 1e-6);
    
          f.mesh.scale.set(sx, sy, sz);
          if (f.outline) f.outline.scale.set(sx, sy, sz);
        } else {
          // -------- SPHERE / MOVING SPHERE / AFM --------
          // Geometry is unit sphere; scale directly by radius
          const r = Math.max(f.currentRadius ?? f.r0 ?? 1.0, 1e-6);
          f.mesh.scale.set(r, r, r);
          if (f.outline) f.outline.scale.set(r, r, r);
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