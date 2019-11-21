/// <reference path="./three/index.d.ts" />
// store rendering mode RNA  
var RNA_MODE = false; // By default we do DNA base spacing
// add base index visualistion
let elements = []; //contains references to all BasicElements
//initialize the space
const systems = [];
var tmpSystems = []; //used for editing
var sysCount = 0;
var strandCount = 0;
var selectedBases = new Set();
var backbones = [];
var lut, devs; //need for Lut coloring
const DNA = 0;
const RNA = 1;
const AA = 2;
//makes for cleaner references down the object hierarcy
var strands = 'children', monomers = 'children', objects = 'children';
const editHistory = new EditHistory();
let clusterCounter = 0; // Cluster counter
//Check if there are files provided in the url (and load them if that is the case)
readFilesFromURLParams();
render();
// elements store the information about position, orientation, ID
class BasicElement extends THREE.Group {
    constructor(gid, parent) {
        super();
        this.elementType = -1; // 0:A 1:G 2:C 3:T/U OR 1 of 20 amino acids
        this.gid = gid;
        this.parent = parent;
        this.dummySys = null;
    }
    ;
    calculatePositions(l) {
    }
    ;
    calculateNewConfigPositions(l) {
    }
    ;
    updateSP(num) {
        return new THREE.Object3D();
    }
    ;
    toggle() {
    }
    ;
    strandToColor(strandIndex) {
        return backboneColors[(Math.abs(strandIndex) + this.parent.parent.systemID) % backboneColors.length];
    }
    ;
    elemToColor(type) {
        return new THREE.Color();
    }
    ;
    getDatFileOutput() {
        return "";
    }
    ;
    updateColor() {
    }
    ;
    setPosition(newPos) {
    }
    translatePosition(amount) {
    }
    rotate(quat) {
    }
    //retrieve this element's values in a 3-parameter instance array
    //positions, scales, colors
    getInstanceParameter3(name) {
        let sys = this.parent.parent, sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys;
            sid = this.lid;
        }
        const x = sys[name][sid * 3], y = sys[name][sid * 3 + 1], z = sys[name][sid * 3 + 2];
        return new THREE.Vector3(x, y, z);
    }
    //retrieve this element's values in a 4-parameter instance array
    //only rotations
    getInstanceParameter4(name) {
        let sys = this.parent.parent, sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys;
            sid = this.lid;
        }
        const x = sys[name][sid * 4], y = sys[name][sid * 4 + 1], z = sys[name][sid * 4 + 2], w = sys[name][sid * 4 + 3];
        return new THREE.Vector4(x, y, z, w);
    }
    //set this element's parameters in the system's instance arrays
    //doing this is slower than sys.fillVec(), but makes cleaner code sometimes
    setInstanceParameter(name, data) {
        let sys = this.parent.parent, sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys;
            sid = this.lid;
        }
        sys.fillVec(name, data.length, sid, data);
    }
    //poof
    toggleVisibility() {
        let sys = this.parent.parent, sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys;
            sid = this.lid;
        }
        const visibility = this.getInstanceParameter3('visibility');
        visibility.addScalar(-1);
        sys.fillVec('visibility', 3, sid, [Math.abs(visibility.x), Math.abs(visibility.y), Math.abs(visibility.z)]);
    }
    handleCircularStrands(sys, sid, xbb, ybb, zbb) {
        if (this.neighbor5 != null && this.neighbor5.lid < this.lid) { //handle circular strands
            this.parent.circular = true;
            let xbbLast = sys.bbOffsets[this.neighbor5.gid * 3], ybbLast = sys.bbOffsets[this.neighbor5.gid * 3 + 1], zbbLast = sys.bbOffsets[this.neighbor5.gid * 3 + 2];
            let xsp = (xbb + xbbLast) / 2, ysp = (ybb + ybbLast) / 2, zsp = (zbb + zbbLast) / 2;
            let spLen = Math.sqrt(Math.pow(xbb - xbbLast, 2) + Math.pow(ybb - ybbLast, 2) + Math.pow(zbb - zbbLast, 2));
            let spRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(xsp - xbb, ysp - ybb, zsp - zbb).normalize());
            sys.fillVec('bbconOffsets', 3, sid, [xsp, ysp, zsp]);
            sys.fillVec('bbconRotation', 4, sid, [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
            sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);
        }
    }
    extendStrand(len, direction) {
    }
}
;
class Nucleotide extends BasicElement {
    constructor(gid, parent) {
        super(gid, parent);
    }
    ;
    calculatePositions(l) {
        let sys = this.parent.parent, sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys;
            sid = this.lid;
        }
        //extract position
        const x = parseFloat(l[0]), y = parseFloat(l[1]), z = parseFloat(l[2]);
        // extract axis vector a1 (backbone vector) and a3 (stacking vector) 
        const xA1 = parseFloat(l[3]), yA1 = parseFloat(l[4]), zA1 = parseFloat(l[5]), xA3 = parseFloat(l[6]), yA3 = parseFloat(l[7]), zA3 = parseFloat(l[8]);
        // according to base.py a2 is the cross of a1 and a3
        const [xA2, yA2, zA2] = cross(xA1, yA1, zA1, xA3, yA3, zA3);
        // compute backbone position
        let xbb = 0;
        let ybb = 0;
        let zbb = 0;
        const bbpos = this.calcBBPos(x, y, z, xA1, yA1, zA1, xA2, yA2, zA2, xA3, yA3, zA3);
        xbb = bbpos.x;
        ybb = bbpos.y;
        zbb = bbpos.z;
        // compute nucleoside cm
        const xns = x + 0.4 * xA1, yns = y + 0.4 * yA1, zns = z + 0.4 * zA1;
        // compute nucleoside rotation
        const baseRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(xA3, yA3, zA3));
        //compute connector position
        const xCon = (xbb + xns) / 2, yCon = (ybb + yns) / 2, zCon = (zbb + zns) / 2;
        // compute connector rotation
        const rotationCon = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(xCon - xns, yCon - yns, zCon - zns).normalize());
        // compute sugar-phosphate positions/rotations, or set them all to 0 if there is no sugar-phosphate.
        let xsp, ysp, zsp, spLen, spRotation;
        if (this.neighbor3 != null && (this.neighbor3.lid < this.lid || this.dummySys !== null)) {
            xsp = (xbb + xbbLast) / 2,
                ysp = (ybb + ybbLast) / 2,
                zsp = (zbb + zbbLast) / 2;
            spLen = Math.sqrt(Math.pow(xbb - xbbLast, 2) + Math.pow(ybb - ybbLast, 2) + Math.pow(zbb - zbbLast, 2));
            spRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(xsp - xbb, ysp - ybb, zsp - zbb).normalize());
        }
        else {
            xsp = 0,
                ysp = 0,
                zsp = 0;
            spLen = 0;
            spRotation = new THREE.Quaternion(0, 0, 0, 0);
        }
        this.handleCircularStrands(sys, sid, xbb, ybb, zbb);
        // determine the mesh color, either from a supplied colormap json or by the strand ID.
        let color = new THREE.Color;
        color = this.strandToColor(this.parent.strandID);
        let idColor = new THREE.Color();
        idColor.setHex(this.gid + 1); //has to be +1 or you can't grab nucleotide 0
        //fill the instance matrices with data
        this.name = this.gid + ""; //set name (string) to nucleotide's global id
        sys.fillVec('cmOffsets', 3, sid, [x, y, z]);
        sys.fillVec('bbOffsets', 3, sid, [xbb, ybb, zbb]);
        sys.fillVec('nsOffsets', 3, sid, [xns, yns, zns]);
        sys.fillVec('nsOffsets', 3, sid, [xns, yns, zns]);
        sys.fillVec('nsRotation', 4, sid, [baseRotation.w, baseRotation.z, baseRotation.y, baseRotation.x]);
        sys.fillVec('conOffsets', 3, sid, [xCon, yCon, zCon]);
        sys.fillVec('conRotation', 4, sid, [rotationCon.w, rotationCon.z, rotationCon.y, rotationCon.x]);
        sys.fillVec('bbconOffsets', 3, sid, [xsp, ysp, zsp]);
        sys.fillVec('bbconRotation', 4, sid, [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
        sys.fillVec('bbColors', 3, sid, [color.r, color.g, color.b]);
        sys.fillVec('scales', 3, sid, [1, 1, 1]);
        sys.fillVec('nsScales', 3, sid, [0.7, 0.3, 0.7]);
        sys.fillVec('conScales', 3, sid, [1, this.bbnsDist, 1]);
        if (spLen == 0) {
            sys.fillVec('bbconScales', 3, sid, [0, 0, 0]);
        }
        else {
            sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);
        }
        sys.fillVec('visibility', 3, sid, [1, 1, 1]);
        color = this.elemToColor(this.type);
        sys.fillVec('nsColors', 3, sid, [color.r, color.g, color.b]);
        sys.fillVec('bbLabels', 3, sid, [idColor.r, idColor.g, idColor.b]);
        // keep track of last backbone for sugar-phosphate positioning
        xbbLast = xbb;
        ybbLast = ybb;
        zbbLast = zbb;
    }
    ;
    translatePosition(amount) {
        const sys = this.parent.parent, id = (this.gid - sys.globalStartId) * 3;
        sys.bbOffsets[id] += amount.x;
        sys.bbOffsets[id + 1] += amount.y;
        sys.bbOffsets[id + 2] += amount.z;
        sys.nsOffsets[id] += amount.x;
        sys.nsOffsets[id + 1] += amount.y;
        sys.nsOffsets[id + 2] += amount.z;
        sys.conOffsets[id] += amount.x;
        sys.conOffsets[id + 1] += amount.y;
        sys.conOffsets[id + 2] += amount.z;
        sys.bbconOffsets[id] += amount.x;
        sys.bbconOffsets[id + 1] += amount.y;
        sys.bbconOffsets[id + 2] += amount.z;
        sys.cmOffsets[id] += amount.x;
        sys.cmOffsets[id + 1] += amount.y;
        sys.cmOffsets[id + 2] += amount.z;
    }
    //different in DNA and RNA
    calcBBPos(x, y, z, xA1, yA1, zA1, xA2, yA2, zA2, xA3, yA3, zA3) {
        return new THREE.Vector3(x, y, z);
    }
    ;
    calculateNewConfigPositions(l) {
        let sys = this.parent.parent, sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys;
            sid = this.lid;
        }
        //extract position
        const x = parseFloat(l[0]), y = parseFloat(l[1]), z = parseFloat(l[2]);
        // extract axis vector a1 (backbone vector) and a3 (stacking vector) 
        const xA1 = parseFloat(l[3]), yA1 = parseFloat(l[4]), zA1 = parseFloat(l[5]), xA3 = parseFloat(l[6]), yA3 = parseFloat(l[7]), zA3 = parseFloat(l[8]);
        // a2 is perpendicular to a1 and a3
        const [xA2, yA2, zA2] = cross(xA1, yA1, zA1, xA3, yA3, zA3);
        // compute backbone cm
        let xbb = 0;
        let ybb = 0;
        let zbb = 0;
        let bbpos = this.calcBBPos(x, y, z, xA1, yA1, zA1, xA2, yA2, zA2, xA3, yA3, zA3);
        xbb = bbpos.x;
        ybb = bbpos.y;
        zbb = bbpos.z;
        // compute nucleoside cm
        const xns = x + 0.4 * xA1, yns = y + 0.4 * yA1, zns = z + 0.4 * zA1;
        //compute connector position
        const xCon = (xbb + xns) / 2, yCon = (ybb + yns) / 2, zCon = (zbb + zns) / 2;
        //correctly display stacking interactions
        const baseRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(xA3, yA3, zA3));
        // compute connector rotation
        const rotationCon = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(xbb - xns, ybb - yns, zbb - zns).normalize());
        // compute sugar-phosphate positions/rotations, or set them all to 0 if there is no sugar-phosphate.
        let xsp, ysp, zsp, spLen, spRotation;
        if (this.neighbor3 != null && this.neighbor3.lid < this.lid) {
            xsp = (xbb + xbbLast) / 2,
                ysp = (ybb + ybbLast) / 2,
                zsp = (zbb + zbbLast) / 2;
            spLen = Math.sqrt(Math.pow(xbb - xbbLast, 2) + Math.pow(ybb - ybbLast, 2) + Math.pow(zbb - zbbLast, 2));
            spRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(xsp - xbb, ysp - ybb, zsp - zbb).normalize());
        }
        else {
            xsp = 0,
                ysp = 0,
                zsp = 0;
            spLen = 0;
            spRotation = new THREE.Quaternion(0, 0, 0, 0);
        }
        this.handleCircularStrands(sys, sid, xbb, ybb, zbb);
        //update the relevant instancing matrices
        sys.fillVec('cmOffsets', 3, sid, [x, y, z]);
        sys.fillVec('bbOffsets', 3, sid, [xbb, ybb, zbb]);
        sys.fillVec('nsOffsets', 3, sid, [xns, yns, zns]);
        sys.fillVec('nsRotation', 4, sid, [baseRotation.w, baseRotation.z, baseRotation.y, baseRotation.x]);
        sys.fillVec('conOffsets', 3, sid, [xCon, yCon, zCon]);
        sys.fillVec('conRotation', 4, sid, [rotationCon.w, rotationCon.z, rotationCon.y, rotationCon.x]);
        sys.fillVec('bbconOffsets', 3, sid, [xsp, ysp, zsp]);
        sys.fillVec('bbconRotation', 4, sid, [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
        if (spLen == 0) {
            sys.fillVec('bbconScales', 3, sid, [0, 0, 0]);
        }
        else {
            sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);
        }
        // keep track of last backbone for sugar-phosphate positioning
        xbbLast = xbb;
        ybbLast = ybb;
        zbbLast = zbb;
    }
    ;
    updateColor() {
        let sys = this.parent.parent, sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys;
            sid = this.lid;
        }
        let color;
        if (selectedBases.has(this)) {
            color = selectionColor;
        }
        else {
            switch (getColoringMode()) {
                case "Strand":
                    color = backboneColors[(Math.abs(this.parent.strandID) + this.parent.parent.systemID) % backboneColors.length];
                    break;
                case "System":
                    color = backboneColors[this.parent.parent.systemID % backboneColors.length];
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
                    color = sys.lutCols[sid];
                    break;
            }
        }
        sys.fillVec('bbColors', 3, sid, [color.r, color.g, color.b]);
    }
    // highlight/remove highlight the bases we've clicked from the list and modify color
    toggle() {
        if (selectedBases.has(this)) {
            selectedBases.delete(this);
        }
        else {
            selectedBases.add(this);
        }
        this.updateColor();
    }
    ;
    elemToColor(elem) {
        elem = { "A": 0, "G": 1, "C": 2, "T": 3, "U": 3 }[elem];
        if (elem == undefined) {
            return GREY;
        }
        return nucleosideColors[elem];
    }
    ;
    getDatFileOutput() {
        let dat = "";
        let tempVec = this.getInstanceParameter3("cmOffsets"); //nucleotide's center of mass in world
        const x = tempVec.x;
        const y = tempVec.y;
        const z = tempVec.z;
        tempVec = this.getInstanceParameter3("bbOffsets");
        const xbb = tempVec.x;
        const ybb = tempVec.y;
        const zbb = tempVec.z;
        tempVec = this.getInstanceParameter3("nsOffsets"); //nucleotide's nucleoside's world position
        const xns = tempVec.x;
        const yns = tempVec.y;
        const zns = tempVec.z;
        let xA1;
        let yA1;
        let zA1;
        //calculate axis vector a1 (backbone vector) and a3 (stacking vector)
        xA1 = (xns - x) / 0.4;
        yA1 = (yns - y) / 0.4;
        zA1 = (zns - z) / 0.4;
        const a3 = this.getA3(xbb, ybb, zbb, x, y, z, xA1, yA1, zA1);
        const xA3 = a3.x;
        const yA3 = a3.y;
        const zA3 = a3.z;
        dat = x + " " + y + " " + z + " " + xA1 + " " + yA1 + " " + zA1 + " " + xA3 + " " + yA3 +
            " " + zA3 + " 0 0 0 0 0 0" + "\n"; //add all locations to dat file string
        return dat;
    }
    ;
    getA3(xbb, ybb, zbb, x, y, z, xA1, yA1, zA1) {
        return new THREE.Vector3();
    }
    ;
    getA1(xns, yns, zns, x, y, z) {
        let xA1 = (xns - x) / 0.4;
        let yA1 = (yns - y) / 0.4;
        let zA1 = (zns - z) / 0.4;
        return (new THREE.Vector3(xA1, yA1, zA1));
    }
    extendStrand(len, direction) {
    }
}
;
class DNANucleotide extends Nucleotide {
    constructor(gid, parent) {
        super(gid, parent);
        this.elementType = DNA;
        this.bbnsDist = 0.8147053;
    }
    ;
    calcBBPos(x, y, z, xA1, yA1, zA1, xA2, yA2, zA2, xA3, yA3, zA3) {
        const xbb = x - (0.34 * xA1 + 0.3408 * xA2), ybb = y - (0.34 * yA1 + 0.3408 * yA2), zbb = z - (0.34 * zA1 + 0.3408 * zA2);
        return new THREE.Vector3(xbb, ybb, zbb);
    }
    ;
    getA3(xbb, ybb, zbb, x, y, z, xA1, yA1, zA1) {
        let xA2;
        let yA2;
        let zA2;
        xA2 = ((xbb - x) + (0.34 * xA1)) / (-0.3408);
        yA2 = ((ybb - y) + (0.34 * yA1)) / (-0.3408);
        zA2 = ((zbb - z) + (0.34 * zA1)) / (-0.3408);
        const a3 = divAndNeg(cross(xA1, yA1, zA1, xA2, yA2, zA2), dot(xA1, yA1, zA1, xA1, yA1, zA1));
        const xA3 = a3[0];
        let yA3 = a3[1];
        let zA3 = a3[2];
        return new THREE.Vector3(xA3, yA3, zA3);
    }
    ;
    // Uses method from generators.py.  Needs to be relaxed since this is oxDNA1 helix
    extendStrand(len, direction) {
        let rot = 35.9 * Math.PI / 180;
        let rise = 0.3897628551303122;
        const start_pos = this.getInstanceParameter3("cmOffsets");
        const bb_pos = this.getInstanceParameter3("bbOffsets");
        const ns_pos = this.getInstanceParameter3("nsOffsets");
        const old_A1 = this.getA1(ns_pos.x, ns_pos.y, ns_pos.z, start_pos.x, start_pos.y, start_pos.z);
        let dir = this.getA3(bb_pos.x, bb_pos.y, bb_pos.z, start_pos.x, start_pos.y, start_pos.z, old_A1.x, old_A1.y, old_A1.z);
        if (direction == "neighbor5") {
            dir.multiplyScalar(-1);
        }
        let R = new THREE.Matrix4;
        R.makeRotationAxis(dir, rot);
        let rb = new THREE.Vector3(0.6, 0, 0);
        let a1 = old_A1.clone();
        let a3 = dir;
        let out = [];
        for (let i = 0; i < len; i++) {
            a1.applyMatrix4(R);
            rb.add(a3.clone().multiplyScalar(rise)).applyMatrix4(R);
            out.push([rb.x + start_pos.x, rb.y + start_pos.y, rb.z + start_pos.z, a1.x, a1.y, a1.z, a3.x, a3.y, a3.z]);
        }
        return out;
    }
}
;
class RNANucleotide extends Nucleotide {
    constructor(gid, parent) {
        super(gid, parent);
        this.elementType = RNA;
        this.bbnsDist = 0.8246211;
    }
    ;
    calcBBPos(x, y, z, xA1, yA1, zA1, xA2, yA2, zA2, xA3, yA3, zA3) {
        const xbb = x - (0.4 * xA1 + 0.2 * xA3), ybb = y - (0.4 * yA1 + 0.2 * yA3), zbb = z - (0.4 * zA1 + 0.2 * zA3);
        return new THREE.Vector3(xbb, ybb, zbb);
    }
    ;
    getA3(xbb, ybb, zbb, x, y, z, xA1, yA1, zA1) {
        const xA3 = ((xbb - x) + (0.4 * xA1)) / (-0.2);
        const yA3 = ((ybb - y) + (0.4 * yA1)) / (-0.2);
        const zA3 = ((zbb - z) + (0.4 * zA1)) / (-0.2);
        return new THREE.Vector3(xA3, yA3, zA3);
    }
    ;
    // Uses the method from generate_RNA.py found in the oxDNA UTILS directory
    extendStrand(len, direction) {
        const inclination = 15.5 * Math.PI / 180;
        const bp_backbone_distance = 2;
        const diameter = 2.35;
        const base_base_distance = 0.3287;
        const rot = 32.7 * Math.PI / 180;
        const cord = Math.cos(inclination) * bp_backbone_distance;
        const center_to_cord = Math.sqrt(Math.pow(diameter / 2, 2) - Math.pow(cord / 2, 2));
        //We just set the direction the the orientation of the a3 vector
        const start_pos = this.getInstanceParameter3("cmOffsets");
        const bb_pos = this.getInstanceParameter3("bbOffsets");
        const ns_pos = this.getInstanceParameter3("nsOffsets");
        const old_A1 = this.getA1(ns_pos.x, ns_pos.y, ns_pos.z, start_pos.x, start_pos.y, start_pos.z);
        let dir = this.getA3(bb_pos.x, bb_pos.y, bb_pos.z, start_pos.x, start_pos.y, start_pos.z, old_A1.x, old_A1.y, old_A1.z);
        if (direction == "neighbor3") {
            dir.multiplyScalar(-1);
        }
        const dir_norm = Math.sqrt(dir.dot(dir));
        dir.divideScalar(dir_norm);
        const x2 = center_to_cord;
        const y2 = -cord / 2;
        const z2 = (bp_backbone_distance / 2) * Math.sin(inclination);
        const x1 = center_to_cord;
        const y1 = cord / 2;
        const z1 = -(bp_backbone_distance / 2) * Math.sin(inclination);
        let r1 = new THREE.Vector3(x1, y1, z1);
        let r2 = new THREE.Vector3(x2, y2, z2);
        let r1_to_r2 = r2.clone().sub(r1);
        let R = new THREE.Matrix4;
        R.makeRotationAxis(dir, rot);
        let a1;
        let a1proj = new THREE.Vector3;
        let a1projnorm;
        let a3;
        let out = [];
        let RNA_fudge;
        for (let i = 0; i < len; i++) {
            r1.applyMatrix4(R).add(dir.clone().multiplyScalar(base_base_distance));
            r2.applyMatrix4(R).add(dir.clone().multiplyScalar(base_base_distance));
            r1_to_r2 = r2.clone().sub(r1);
            a1 = r1_to_r2.clone().divideScalar(Math.sqrt(r1_to_r2.dot(r1_to_r2)));
            a1proj.set(a1[0], a1[1], 0);
            a1projnorm = Math.sqrt(a1proj.dot(a1proj));
            a1proj.divideScalar(a1projnorm);
            a3 = dir.clone().multiplyScalar(-Math.cos(inclination)).multiplyScalar(-1).add(a1proj.clone().multiplyScalar(Math.sin(inclination)));
            RNA_fudge = a1.clone().multiplyScalar(0.6);
            out.push([r1.x + start_pos.x + RNA_fudge.x, r1.y + start_pos.y + RNA_fudge.y, r1.z + start_pos.z + RNA_fudge.z, a1.x, a1.y, a1.z, a3.x, a3.y, a3.z]); //r1 needs to have a fudge factor from the RNA model added
        }
        return out;
    }
}
;
class AminoAcid extends BasicElement {
    constructor(gid, parent) {
        super(gid, parent);
        this.elementType = AA;
    }
    ;
    elemToColor(elem) {
        elem = { "R": 0, "H": 1, "K": 2, "D": 3, "E": 3, "S": 4, "T": 5, "N": 6, "Q": 7, "C": 8, "U": 9, "G": 10, "P": 11, "A": 12, "V": 13, "I": 14, "L": 15, "M": 16, "F": 17, "Y": 18, "W": 19 }[elem];
        if (elem == undefined)
            return GREY;
        return nucleosideColors[elem];
    }
    ;
    calculatePositions(l) {
        const sys = this.parent.parent, sid = this.gid - sys.globalStartId;
        //extract position
        const x = parseFloat(l[0]), y = parseFloat(l[1]), z = parseFloat(l[2]);
        // compute backbone positions/rotations, or set them all to 0 if there is no neighbor.
        let xsp, ysp, zsp, spLen, spRotation;
        if (this.neighbor3 != null && this.neighbor3.lid < this.lid) {
            xsp = (x + xbbLast) / 2,
                ysp = (y + ybbLast) / 2,
                zsp = (z + zbbLast) / 2;
            spLen = Math.sqrt(Math.pow(x - xbbLast, 2) + Math.pow(y - ybbLast, 2) + Math.pow(z - zbbLast, 2));
            spRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(xsp - x, ysp - y, zsp - z).normalize());
        }
        else {
            xsp = 0,
                ysp = 0,
                zsp = 0;
            spLen = 0;
            spRotation = new THREE.Quaternion(0, 0, 0, 0);
        }
        this.handleCircularStrands(sys, sid, x, y, z);
        // determine the mesh color, either from a supplied colormap json or by the strand ID.
        let color = new THREE.Color();
        color = this.strandToColor(this.parent.strandID);
        let idColor = new THREE.Color();
        idColor.setHex(this.gid + 1); //has to be +1 or you can't grab nucleotide 0
        // fill in the instancing matrices
        this.name = this.gid + ""; //set name (string) to nucleotide's global id
        sys.fillVec('cmOffsets', 3, sid, [x, y, z]);
        sys.fillVec('bbOffsets', 3, sid, [x, y, z]);
        sys.fillVec('bbRotation', 4, sid, [0, 0, 0, 0]);
        sys.fillVec('nsOffsets', 3, sid, [x, y, z]);
        sys.fillVec('nsRotation', 4, sid, [0, 0, 0, 0]);
        sys.fillVec('conOffsets', 3, sid, [0, 0, 0]);
        sys.fillVec('conRotation', 4, sid, [0, 0, 0, 0]);
        sys.fillVec('bbconOffsets', 3, sid, [xsp, ysp, zsp]);
        sys.fillVec('bbconRotation', 4, sid, [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
        sys.fillVec('scales', 3, sid, [0, 0, 0]);
        sys.fillVec('nsScales', 3, sid, [1, 1, 1]);
        sys.fillVec('conScales', 3, sid, [0, 0, 0]);
        if (spLen == 0) {
            sys.fillVec('bbconScales', 3, sid, [0, 0, 0]);
        }
        else {
            sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);
        }
        sys.fillVec('bbColors', 3, sid, [color.r, color.g, color.b]);
        sys.fillVec('visibility', 3, sid, [1, 1, 1]);
        color = this.elemToColor(this.type);
        sys.fillVec('nsColors', 3, sid, [color.r, color.g, color.b]);
        sys.fillVec('bbLabels', 3, sid, [idColor.r, idColor.g, idColor.b]);
        // keep track of last backbone for sugar-phosphate positioning
        xbbLast = x;
        ybbLast = y;
        zbbLast = z;
    }
    ;
    calculateNewConfigPositions(l) {
        const sys = this.parent.parent, sid = this.gid - sys.globalStartId;
        //extract position
        const x = parseFloat(l[0]), y = parseFloat(l[1]), z = parseFloat(l[2]);
        //calculate new backbone connector position/rotation
        let xsp, ysp, zsp, spLen, spRotation;
        if (this.neighbor3 != null && this.neighbor3.lid < this.lid) {
            xsp = (x + xbbLast) / 2,
                ysp = (y + ybbLast) / 2,
                zsp = (z + zbbLast) / 2;
            spLen = Math.sqrt(Math.pow(x - xbbLast, 2) + Math.pow(y - ybbLast, 2) + Math.pow(z - zbbLast, 2));
            spRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(xsp - x, ysp - y, zsp - z).normalize());
        }
        else {
            xsp = 0,
                ysp = 0,
                zsp = 0;
            spLen = 0;
            spRotation = new THREE.Quaternion(0, 0, 0, 0);
        }
        this.handleCircularStrands(sys, sid, x, y, z);
        sys.fillVec('cmOffsets', 3, sid, [x, y, z]);
        sys.fillVec('bbOffsets', 3, sid, [x, y, z]);
        sys.fillVec('nsOffsets', 3, sid, [x, y, z]);
        sys.fillVec('bbconOffsets', 3, sid, [xsp, ysp, zsp]);
        sys.fillVec('bbconRotation', 4, sid, [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
        if (spLen == 0) {
            sys.fillVec('bbconScales', 3, sid, [0, 0, 0]);
        }
        else {
            sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);
        }
        xbbLast = x;
        ybbLast = y;
        zbbLast = z;
    }
    ;
    translatePosition(amount) {
        const sys = this.parent.parent, id = (this.gid - sys.globalStartId) * 3;
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
        let sys = this.parent.parent, sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys;
            sid = this.lid;
        }
        let bbColor;
        let aaColor;
        if (selectedBases.has(this)) {
            bbColor = selectionColor;
        }
        else {
            switch (getColoringMode()) {
                case "Strand":
                    bbColor = backboneColors[(Math.abs(this.parent.strandID) + this.parent.parent.systemID) % backboneColors.length];
                    break;
                case "System":
                    bbColor = backboneColors[this.parent.parent.systemID % backboneColors.length];
                    break;
                case "Cluster":
                    if (!this.clusterId || this.clusterId < 0) {
                        bbColor = new THREE.Color(0xE60A0A);
                    }
                    else {
                        bbColor = backboneColors[this.clusterId % backboneColors.length];
                    }
                    break;
                case "Overlay":
                    bbColor = sys.lutCols[sid];
                    break;
            }
        }
        aaColor = this.elemToColor(this.type);
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
    ;
    getDatFileOutput() {
        let dat = "";
        const tempVec = this.getInstanceParameter3("cmOffsets");
        const x = tempVec.x;
        const y = tempVec.y;
        const z = tempVec.z;
        dat = x + " " + y + " " + z + " 1.0 1.0 0.0 0.0 0.0 -1.0 0.0 0.0 0.0 0.0 0.0 0.0" + "\n"; //add all locations to dat file string
        return dat;
    }
    ;
    extendStrand(len, direction) {
    }
}
;
// strands are made up of elements
// strands have an ID within the system
class Strand extends THREE.Group {
    constructor(id, parent) {
        super();
        this.strandID = id;
        this.parent = parent;
        this.circular = false;
    }
    ;
    addBasicElement(elem) {
        this[monomers].push(elem);
        elem.parent = this;
    }
    ;
    createBasicElement(gid) {
        return new BasicElement(gid, this);
    }
    excludeElements(elements) {
        // detach from parent
        elements.forEach((e) => {
            e.parent = null;
            this.remove(e);
        });
        // create a new list of strand elements  
        let filtered = this[monomers].filter((v, i, arr) => {
            return !elements.includes(v);
        });
        this[monomers] = filtered;
    }
    ;
    getCom() {
        const com = new THREE.Vector3(0, 0, 0);
        for (let i = (this[monomers][0].gid - this.parent.globalStartId) * 3; i <= (this[monomers][this[monomers].length - 1].gid - this.parent.globalStartId) * 3; i += 3) {
            com.add(new THREE.Vector3(this.parent.cmOffsets[i], this.parent.cmOffsets[i + 1], this.parent.cmOffsets[i + 2]));
        }
        return (com.multiplyScalar(1 / this[monomers].length));
    }
    ;
    translateStrand(amount) {
    }
    ;
}
;
class NucleicAcidStrand extends Strand {
    constructor(id, parent) {
        super(id, parent);
    }
    ;
    createBasicElement(gid) {
        if (RNA_MODE)
            return new RNANucleotide(gid, this);
        else
            return new DNANucleotide(gid, this);
    }
    ;
    translateStrand(amount) {
        const s = this.parent;
        for (let i = (this[monomers][0].gid - this.parent.globalStartId) * 3; i <= (this[monomers][this[monomers].length - 1].gid - this.parent.globalStartId) * 3; i += 3) {
            s.bbOffsets[i] += amount.x;
            s.bbOffsets[i + 1] += amount.y;
            s.bbOffsets[i + 2] += amount.z;
            s.nsOffsets[i] += amount.x;
            s.nsOffsets[i + 1] += amount.y;
            s.nsOffsets[i + 2] += amount.z;
            s.conOffsets[i] += amount.x;
            s.conOffsets[i + 1] += amount.y;
            s.conOffsets[i + 2] += amount.z;
            s.bbconOffsets[i] += amount.x;
            s.bbconOffsets[i + 1] += amount.y;
            s.bbconOffsets[i + 2] += amount.z;
            s.cmOffsets[i] += amount.x;
            s.cmOffsets[i + 1] += amount.y;
            s.cmOffsets[i + 2] += amount.z;
        }
        s.callUpdates(['instanceOffset']);
        if (tmpSystems.length > 0) {
            tmpSystems.forEach((s) => {
                s.callUpdates(['instanceOffset']);
            });
        }
    }
}
class Peptide extends Strand {
    constructor(id, parent) {
        super(id, parent);
    }
    ;
    createBasicElement(gid) {
        return new AminoAcid(gid, this);
    }
    ;
    translateStrand(amount) {
        const s = this.parent;
        for (let i = (this.children[0].gid - this.parent.globalStartId) * 3; i <= (this[monomers][this[monomers].length - 1].gid - this.parent.globalStartId) * 3; i += 3) {
            s.nsOffsets[i] += amount.x;
            s.nsOffsets[i + 1] += amount.y;
            s.nsOffsets[i + 2] += amount.z;
            s.bbOffsets[i] += amount.x;
            s.bbOffsets[i + 1] += amount.y;
            s.bbOffsets[i + 2] += amount.z;
            s.bbconOffsets[i] += amount.x;
            s.bbconOffsets[i + 1] += amount.y;
            s.bbconOffsets[i + 2] += amount.z;
            s.cmOffsets[i] += amount.x;
            s.cmOffsets[i + 1] += amount.y;
            s.cmOffsets[i + 2] += amount.z;
        }
        s.callUpdates(['instanceOffset']);
        if (tmpSystems.length > 0) {
            tmpSystems.forEach((s) => {
                s.callUpdates(['instanceOffset']);
            });
        }
    }
    ;
}
// systems are made of strands
// systems can CRUD
class System extends THREE.Group {
    constructor(id, startID) {
        super();
        this.systemID = id;
        this.globalStartId = startID;
        this.lutCols = [];
    }
    ;
    systemLength() {
        let count = 0;
        for (let i = 0; i < this[strands].length; i++) {
            count += this[strands][i][monomers].length;
        }
        return count;
    }
    ;
    initInstances(nInstances) {
        this.INSTANCES = nInstances;
        this.bbOffsets = new Float32Array(this.INSTANCES * 3);
        this.bbRotation = new Float32Array(this.INSTANCES * 4);
        this.nsOffsets = new Float32Array(this.INSTANCES * 3);
        this.nsRotation = new Float32Array(this.INSTANCES * 4);
        this.conOffsets = new Float32Array(this.INSTANCES * 3);
        this.conRotation = new Float32Array(this.INSTANCES * 4);
        this.bbconOffsets = new Float32Array(this.INSTANCES * 3);
        this.bbconRotation = new Float32Array(this.INSTANCES * 4);
        this.bbconScales = new Float32Array(this.INSTANCES * 3);
        this.cmOffsets = new Float32Array(this.INSTANCES * 3);
        this.bbColors = new Float32Array(this.INSTANCES * 3);
        this.nsColors = new Float32Array(this.INSTANCES * 3);
        this.scales = new Float32Array(this.INSTANCES * 3);
        this.nsScales = new Float32Array(this.INSTANCES * 3);
        this.conScales = new Float32Array(this.INSTANCES * 3);
        this.visibility = new Float32Array(this.INSTANCES * 3);
        this.bbLabels = new Float32Array(this.INSTANCES * 3);
    }
    callUpdates(names) {
        names.forEach((name) => {
            this.backbone.geometry["attributes"][name].needsUpdate = true;
            this.nucleoside.geometry["attributes"][name].needsUpdate = true;
            this.connector.geometry["attributes"][name].needsUpdate = true;
            this.bbconnector.geometry["attributes"][name].needsUpdate = true;
            if (name == "instanceScale" || name == "instanceRotation") {
            }
            else {
                this.dummyBackbone.geometry["attributes"][name].needsUpdate = true;
            }
        });
    }
    createStrand(strID) {
        if (strID < 0)
            return new Peptide(strID, this);
        else
            return new NucleicAcidStrand(strID, this);
    }
    ;
    addStrand(strand) {
        this[strands].push(strand);
        strand.parent = this;
    }
    ;
    removeStrand(toRemove) {
        for (let i = 0; i < this[strands].length; i++) {
            let s = this[strands][i];
            if (s.strandID == toRemove) {
                this.remove(s);
                for (let j = 0; j < s[monomers].length; j++) {
                    s.remove(s[monomers][j]);
                    s.removeBasicElement(j);
                }
                scene.remove(s);
                s = null;
            }
            ;
            render();
        }
    }
    ;
    //computes the center of mass of the system
    getCom() {
        const com = new THREE.Vector3(0, 0, 0);
        for (let i = 0; i < this.INSTANCES * 3; i += 3) {
            com.add(new THREE.Vector3(this.cmOffsets[i], this.cmOffsets[i + 1], this.cmOffsets[i + 2]));
        }
        return (com.multiplyScalar(1 / this.INSTANCES));
    }
    ;
    //This is needed to handle strands that have experienced fix_diffusion.  Don't use it.
    strandUnweightedCom() {
        const com = new THREE.Vector3(0, 0, 0);
        let count = 0;
        this[strands].forEach((s) => {
            com.add(s.getCom());
            count += 1;
        });
        return (com.multiplyScalar(1 / count));
    }
    ;
    setDatFile(datFile) {
        this.datFile = datFile;
    }
    ;
    setColorFile(jsonFile) {
        this.colormapFile = jsonFile;
    }
    ;
    translateSystem(amount) {
        for (let i = 0; i < this.INSTANCES * 3; i += 3) {
            this.bbOffsets[i] += amount.x;
            this.bbOffsets[i + 1] += amount.y;
            this.bbOffsets[i + 2] += amount.z;
            this.nsOffsets[i] += amount.x;
            this.nsOffsets[i + 1] += amount.y;
            this.nsOffsets[i + 2] += amount.z;
            this.conOffsets[i] += amount.x;
            this.conOffsets[i + 1] += amount.y;
            this.conOffsets[i + 2] += amount.z;
            this.bbconOffsets[i] += amount.x;
            this.bbconOffsets[i + 1] += amount.y;
            this.bbconOffsets[i + 2] += amount.z;
            this.cmOffsets[i] += amount.x;
            this.cmOffsets[i + 1] += amount.y;
            this.cmOffsets[i + 2] += amount.z;
        }
        this.callUpdates(['instanceOffset']);
        if (tmpSystems.length > 0) {
            tmpSystems.forEach((s) => {
                s.callUpdates(['instanceOffset']);
            });
        }
        render();
    }
    ;
    fillVec(vecName, unitSize, pos, vals) {
        for (let i = 0; i < unitSize; i++) {
            this[vecName][pos * unitSize + i] = vals[i];
        }
    }
    ;
}
;
//toggles display of coloring by json file / structure modeled off of base selector
function coloringChanged() {
    if (getColoringMode() === "Overlay") {
        if (lut) {
            api.showColorbar();
        }
        else {
            notify("Please drag and drop the corresponding .json file.");
            setColoringMode("Strand");
            return;
        }
    }
    else if (lut) {
        api.removeColorbar();
    }
    for (let i = 0; i < elements.length; i++) {
        elements[i].updateColor();
    }
    for (let i = 0; i < systems.length; i++) {
        systems[i].callUpdates(['instanceColor']);
    }
    if (tmpSystems.length > 0) {
        tmpSystems.forEach((s) => {
            s.callUpdates(['instanceColor']);
        });
    }
    render();
}
function getColoringMode() {
    return document.querySelector('input[name="coloring"]:checked')['value'];
}
function setColoringMode(mode) {
    const modes = document.getElementsByName("coloring");
    for (let i = 0; i < modes.length; i++) {
        modes[i].checked = (modes[i].value === mode);
    }
    coloringChanged();
}
;
function cross(a1, a2, a3, b1, b2, b3) {
    return [a2 * b3 - a3 * b2,
        a3 * b1 - a1 * b3,
        a1 * b2 - a2 * b1];
}
function det(mat) {
    return (mat[0][0] * ((mat[1][1] * mat[2][2]) - (mat[1][2] * mat[2][1])) - mat[0][1] * ((mat[1][0] * mat[2][2]) -
        (mat[2][0] * mat[1][2])) + mat[0][2] * ((mat[1][0] * mat[2][1]) - (mat[2][0] * mat[1][1])));
}
function dot(x1, y1, z1, x2, y2, z2) {
    return x1 * x2 + y1 * y2 + z1 * z2;
}
function divAndNeg(mat, divisor) {
    return [-mat[0] / divisor, -mat[1] / divisor, -mat[2] / divisor];
}
