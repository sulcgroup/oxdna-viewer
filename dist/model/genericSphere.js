/**
 * Extends BasicElement with amino acid-specific properties such as the larger colormap to account for 20 types.
 * This class is incomplete and only supports visualization right now.  Editing will not work.
 */
class GenericSphere extends BasicElement {
    constructor(id, strand) {
        super(id, strand);
        this.mass = 1.0;
        this.radius = 1.0;
        this.type = 'gs';
    }
    ;
    elemToColor(elem) {
        return GREY;
    }
    calcPositionsFromConfLine(l, colorUpdate) {
        //extract position
        const p = new THREE.Vector3(parseFloat(l[0]), parseFloat(l[1]), parseFloat(l[2]));
        this.calcPositions(p);
    }
    ;
    updateSize(mass, radius) {
        this.mass = mass;
        this.radius = radius;
        let sys = this.getSystem();
        sys.fillVec('nsScales', 3, this.sid, [2 * this.radius, 2 * this.radius, 2 * this.radius]);
        sys.callUpdates(['instanceScale']);
        // sys.nucleoside.geometry["attributes"].instanceColor.needsUpdate = true;
    }
    ;
    calcPositions(p) {
        let sys = this.getSystem();
        if (this.dummySys !== null) {
            sys = this.dummySys;
        }
        let sid = this.sid;
        // compute backbone positions/rotations, or set them all to 0 if there is no neighbor.0
        let sp, spLen, spRotation;
        if (this.n3 && this.n3 != this.strand.end5) {
            let bbLast = this.n3.getInstanceParameter3('bbOffsets');
            sp = p.clone().add(bbLast).divideScalar(2);
            spLen = p.distanceTo(bbLast);
            spRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), sp.clone().sub(p).normalize());
        }
        else {
            sp = new THREE.Vector3();
            spLen = 0;
            spRotation = new THREE.Quaternion(0, 0, 0, 0);
        }
        this.handleCircularStrands(sys, sid, p);
        // determine the mesh color, either from a supplied colormap json or by the strand ID.
        let color = new THREE.Color();
        color = this.strandToColor(this.strand.id);
        let idColor = new THREE.Color();
        idColor.setHex(this.id + 1); //has to be +1 or you can't grab nucleotide 0
        // fill in the instancing matrices
        let scale = this.radius * 2;
        sys.fillVec('cmOffsets', 3, sid, p.toArray());
        sys.fillVec('bbOffsets', 3, sid, p.toArray());
        sys.fillVec('bbRotation', 4, sid, [0, 0, 0, 0]);
        sys.fillVec('nsOffsets', 3, sid, p.toArray());
        sys.fillVec('nsRotation', 4, sid, [0, 0, 0, 0]);
        sys.fillVec('conOffsets', 3, sid, [0, 0, 0]);
        sys.fillVec('conRotation', 4, sid, [0, 0, 0, 0]);
        sys.fillVec('bbconOffsets', 3, sid, sp.toArray());
        sys.fillVec('bbconRotation', 4, sid, [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
        sys.fillVec('scales', 3, sid, [0, 0, 0]);
        sys.fillVec('nsScales', 3, sid, [scale, scale, scale]);
        sys.fillVec('conScales', 3, sid, [0, 0, 0]);
        sys.fillVec('bbconScales', 3, sid, [0, 0, 0]);
        sys.fillVec('bbColors', 3, sid, [color.r, color.g, color.b]);
        sys.fillVec('visibility', 3, sid, [1, 1, 1]);
        color = this.elemToColor(this.type);
        sys.fillVec('nsColors', 3, sid, [color.r, color.g, color.b]);
        sys.fillVec('bbLabels', 3, sid, [idColor.r, idColor.g, idColor.b]);
        // keep track of last backbone for sugar-phosphate positioning
        //bbLast = p.clone();
    }
    calculateNewConfigPositions(l) {
        const sys = this.getSystem();
        let sid = this.sid;
        //extract position
        const p = new THREE.Vector3(parseFloat(l[0]), parseFloat(l[1]), parseFloat(l[2]));
        //calculate new backbone connector position/rotation
        let sp, spLen, spRotation;
        if (this.n3 && this.n3 != this.strand.end5) {
            let bbLast = this.n3.getInstanceParameter3('bbOffsets');
            sp = p.clone().add(bbLast).divideScalar(2);
            spLen = p.distanceTo(bbLast);
            spRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), sp.clone().sub(p).normalize());
        }
        else {
            sp = new THREE.Vector3();
            spLen = 0;
            spRotation = new THREE.Quaternion(0, 0, 0, 0);
        }
        this.handleCircularStrands(sys, sid, p);
        sys.fillVec('cmOffsets', 3, sid, p.toArray());
        sys.fillVec('bbOffsets', 3, sid, p.toArray());
        sys.fillVec('nsOffsets', 3, sid, p.toArray());
        sys.fillVec('bbconOffsets', 3, sid, sp.toArray());
        sys.fillVec('bbconRotation', 4, sid, [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
        sys.fillVec('bbconScales', 3, sid, [0, 0, 0]);
        //bbLast = p.clone();
    }
    ;
    translatePosition(amount) {
        const sys = this.getSystem(), id = (this.sid) * 3;
        sys.bbOffsets[id] += amount.x;
        sys.bbOffsets[id + 1] += amount.y;
        sys.bbOffsets[id + 2] += amount.z;
        sys.nsOffsets[id] += amount.x;
        sys.nsOffsets[id + 1] += amount.y;
        sys.nsOffsets[id + 2] += amount.z;
        sys.bbconOffsets[id] += amount.x;
        sys.bbconOffsets[id + 1] += amount.y;
        sys.bbconOffsets[id + 2] += amount.z;
        sys.cmOffsets[id] += amount.x;
        sys.cmOffsets[id + 1] += amount.y;
        sys.cmOffsets[id + 2] += amount.z;
    }
    updateColor() {
        let sys = this.getSystem(), sid = this.sid;
        if (this.dummySys !== null) {
            sys = this.dummySys;
        }
        let bbColor;
        let aaColor;
        switch (view.coloringMode.get()) {
            case "Strand":
                bbColor = backboneColors[(Math.abs(this.strand.id) + this.getSystem().id) % backboneColors.length];
                aaColor = this.elemToColor(this.type);
                break;
            case "System":
                bbColor = backboneColors[this.getSystem().id % backboneColors.length];
                aaColor = this.elemToColor(this.type);
                break;
            case "Cluster":
                if (!this.clusterId || this.clusterId < 0) {
                    bbColor = new THREE.Color(0xE60A0A);
                    aaColor = bbColor.clone();
                }
                else {
                    bbColor = backboneColors[this.clusterId % backboneColors.length];
                    aaColor = bbColor.clone();
                }
                break;
            case "Overlay":
                bbColor = sys.lutCols[sid];
                aaColor = bbColor.clone();
                break;
            case "Custom":
                if (!this.color) {
                    // Use overlay color if overlay is loaded, otherwise color gray
                    if (lut) {
                        bbColor = sys.lutCols[sid];
                        aaColor = sys.lutCols[sid];
                    }
                    else {
                        bbColor = GREY;
                        aaColor = GREY;
                    }
                }
                else {
                    bbColor = this.color;
                    aaColor = this.color;
                }
                break;
        }
        if (selectedBases.has(this)) {
            bbColor = bbColor.clone().lerp(selectionColor, 0.6).multiplyScalar(2);
            aaColor = aaColor.clone().lerp(selectionColor, 0.6).multiplyScalar(2);
        }
        sys.fillVec('bbColors', 3, sid, [bbColor.r, bbColor.g, bbColor.b]);
        sys.fillVec('nsColors', 3, sid, [aaColor.r, aaColor.g, aaColor.b]);
    }
    toggle() {
        if (selectedBases.has(this)) { //if clicked nucleotide is already selected
            selectedBases.delete(this); //"unselect" nucletide by setting value in selectedBases array at nucleotideID to 0
        }
        else {
            selectedBases.add(this); //"select" nucletide by adding it to the selected base list
        }
        this.updateColor();
    }
    getA1() {
        return new THREE.Vector3(1, 1, 0);
    }
    getA3() {
        return new THREE.Vector3(0, 0, -1);
    }
    extendStrand(len, direction) {
    }
    isAminoAcid() {
        return false;
    }
    ;
    isGS() {
        return true;
    }
    /*
    getTypeNumber() {
        // Will Probably need this for Patchy Particles?
    }
    */
    toJSON() {
        // Get superclass attributes
        let json = super.toJSON();
        json['class'] = 'AA';
        return json;
    }
}
class PatchyParticle extends GenericSphere {
    constructor(id, system) {
        super(id, undefined);
        this.system = system;
        this.mass = 10.0;
        this.type = 'ps';
    }
    elemToColor(elem) {
        return colorFromInt(parseInt(elem));
    }
    getSystem() {
        return this.system;
    }
    getPos() {
        return this.getInstanceParameter3('offsets');
    }
    getInstanceParameter3(name) {
        const a = this.system[name][parseInt(this.type)];
        return new THREE.Vector3(a[this.sid * 3], a[this.sid * 3 + 1], a[this.sid * 3 + 2]);
    }
    //retrieve this element's values in a 4-parameter instance array
    //only rotations
    getInstanceParameter4(name) {
        const a = this.system[name][parseInt(this.type)];
        return new THREE.Vector4(a[this.sid * 4], a[this.sid * 4 + 1], a[this.sid * 4 + 2], a[this.sid * 4 + 3]);
    }
    //poof
    toggleVisibility() {
        let sys = this.getSystem();
        if (this.dummySys !== null) {
            sys = this.dummySys;
        }
        const visibility = this.getInstanceParameter3('visibilities');
        visibility.addScalar(-1);
        sys.fillPatchyVec(parseInt(this.type), 'visibilities', 3, this.sid, [Math.abs(visibility.x), Math.abs(visibility.y), Math.abs(visibility.z)]);
    }
    translatePosition(amount) {
        const sys = this.system;
        const id = (this.sid) * 3;
        const s = parseInt(this.type);
        sys.offsets[s][id] += amount.x;
        sys.offsets[s][id + 1] += amount.y;
        sys.offsets[s][id + 2] += amount.z;
    }
    calcPositionsFromConfLine(l, colorUpdate) {
        //extract position
        let p = new THREE.Vector3(parseFloat(l[0]), parseFloat(l[1]), parseFloat(l[2]));
        //extract orientation vectors
        let a1 = new THREE.Vector3(parseFloat(l[3]), parseFloat(l[4]), parseFloat(l[5])).normalize();
        let a3 = new THREE.Vector3(parseFloat(l[6]), parseFloat(l[7]), parseFloat(l[8])).normalize();
        this.calcPositions(p, a1, a3, colorUpdate);
    }
    ;
    calcPositions(p, a1, a3, _colorUpdate) {
        let sid = this.sid;
        let scale = 1;
        const defaultA1 = new THREE.Vector3(1, 0, 0);
        const defaultA3 = new THREE.Vector3(0, 0, 1);
        const q = rotateVectorsSimultaneously(defaultA1, defaultA3, a1.clone(), a3.clone());
        console.assert(defaultA1.clone().applyQuaternion(q).distanceTo(a1) < 1e-5, "a1 wrong");
        console.assert(defaultA3.clone().applyQuaternion(q).distanceTo(a3) < 1e-5, "a3 wrong");
        // For some reason, we have to rotate the orientations
        // around an axis with inverted y-value...
        q.y *= -1;
        let species = parseInt(this.type);
        this.system.fillPatchyVec(species, 'offsets', 3, sid, p.toArray());
        this.system.fillPatchyVec(species, 'rotations', 4, sid, [q.w, q.z, q.y, q.x]);
        this.system.fillPatchyVec(species, 'visibilities', 3, sid, [1, 1, 1]);
        this.system.fillPatchyVec(species, 'scalings', 3, sid, [scale, scale, scale]);
        let color = this.elemToColor(this.type);
        this.system.fillPatchyVec(species, 'colors', 3, sid, [color.r, color.g, color.b]);
        let idColor = new THREE.Color();
        idColor.setHex(this.id + 1); //has to be +1 or you can't grab nucleotide 0
        this.system.fillPatchyVec(species, 'labels', 3, sid, [idColor.r, idColor.g, idColor.b]);
    }
    updateColor() {
        let color;
        switch (view.coloringMode.get()) {
            case "System":
                color = backboneColors[this.getSystem().id % backboneColors.length];
                break;
            case "Cluster":
                if (!this.clusterId || this.clusterId < 0) {
                    color = new THREE.Color(0xE60A0A);
                }
                else {
                    color = backboneColors[this.clusterId % backboneColors.length];
                }
                break;
            case "Overlay":
                color = this.system.lutCols[this.sid];
                break;
            case "Custom":
                if (!this.color) {
                    // Use overlay color if overlay is loaded, otherwise color gray
                    if (lut) {
                        color = this.system.lutCols[this.sid];
                    }
                    else {
                        color = GREY;
                    }
                }
                else {
                    color = this.color;
                }
                break;
            default:
                color = this.elemToColor(this.type);
                break;
        }
        if (selectedBases.has(this)) {
            color = color.clone().lerp(selectionColor, 0.6).multiplyScalar(2);
        }
        let species = parseInt(this.type);
        this.system.fillPatchyVec(species, 'colors', 3, this.sid, [color.r, color.g, color.b]);
    }
    isPatchyParticle() {
        return true;
    }
}
//https://stackoverflow.com/a/55248720
//https://robokitchen.tumblr.com/post/67060392720/finding-a-quaternion-from-two-pairs-of-vectors
function rotateVectorsSimultaneously(u0, v0, u2, v2) {
    u0.normalize();
    v0.normalize();
    u2.normalize();
    v2.normalize();
    const q2 = new THREE.Quaternion().setFromUnitVectors(u0, u2);
    const v1 = v2.clone().applyQuaternion(q2.clone().conjugate());
    const v0_proj = v0.clone().projectOnPlane(u0);
    const v1_proj = v1.clone().projectOnPlane(u0);
    let angleInPlane = v0_proj.angleTo(v1_proj);
    if (v1_proj.dot(new THREE.Vector3().crossVectors(u0, v0)) < 0) {
        angleInPlane *= -1;
    }
    const q1 = new THREE.Quaternion().setFromAxisAngle(u0, angleInPlane);
    const q = new THREE.Quaternion().multiplyQuaternions(q2, q1);
    return q;
}
