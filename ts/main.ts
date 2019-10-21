/// <reference path="./three/index.d.ts" />

// store rendering mode RNA  
var RNA_MODE = false; // By default we do DNA base spacing
// add base index visualistion
const elements: BasicElement[] = []; //contains references to all BasicElements
//initialize the space
const systems: System[] = [];
var sysCount: number = 0;
var strandCount: number = 0;
var nucCount: number = 0;
var selectedBases = new Set<BasicElement>();

var backbones: THREE.Object3D[] = [];
var lut, devs: number[]; //need for Lut coloring

const DNA: number = 0;
const RNA: number = 1;
const AA: number = 2;

//some developers declare a new i in their for loops.  Some don't and reuse this one...is one better than the other?
var i: number;

//makes for cleaner references down the object hierarcy
var strands = 'children',
    monomers = 'children',
    objects = 'children';

const editHistory = new EditHistory();
let clusterCounter = 0 // Cluster counter

//Check if there are files provided in the url (and load them if that is the case)
readFilesFromURLParams();

render();

// elements store the information about position, orientation, ID
class BasicElement extends THREE.Group{
    lid: number;
    gid: number; //location in world - all systems
    pos: THREE.Vector3; //not automatically updated; updated before rotation
    neighbor3: BasicElement | null;
    neighbor5: BasicElement | null;
    pair: number;
    parent: Strand;
    bbnsDist : number;
    elementType: number = -1; // 0:A 1:G 2:C 3:T/U OR 1 of 20 amino acids
    clusterId: number;

    constructor(gid: number, parent: Strand) {
        super();
        this.gid = gid;
        this.parent = parent;
    };

    calculatePositions(l: string) {

    };

    calculateNewConfigPositions(l: string) {

    };

    updateSP(num: number): THREE.Object3D {
        return new THREE.Object3D();
    };

    toggle() {

    };

    strandToColor(strandIndex: number) {
        return backboneColors[(Math.abs(strandIndex) + this.parent.parent.systemID) % backboneColors.length];
    };

    elemToColor(type: number | string): THREE.Color {
        return new THREE.Color();
    };

    getDatFileOutput(): string {
        return "";
    };

    updateColor() {

    };

    setPosition(newPos: THREE.Vector3) {

    }

    translatePosition(amount: THREE.Vector3) {

    }

    rotate(quat: THREE.Quaternion) {

    }

    //retrieve this element's values in a 3-parameter instance array
    //positions, scales, colors
    getInstanceParameter3(name: string) {
        const sys = this.parent.parent,
            sid = this.gid - sys.globalStartId;

        const x: number = sys[name][sid * 3],
            y: number = sys[name][sid * 3 + 1],
            z: number = sys[name][sid * 3 + 2];

        return new THREE.Vector3(x, y, z);
    }

    //retrieve this element's values in a 4-parameter instance array
    //only rotations
    getInstanceParameter4(name: string) {
        const sys = this.parent.parent,
            sid = this.gid - sys.globalStartId;

        const x: number = sys[name][sid * 4],
            y: number = sys[name][sid * 4 + 1],
            z: number = sys[name][sid * 4 + 2],
            w: number = sys[name][sid * 4 + 3];

        return new THREE.Vector4(x, y, z, w);
    }

    //set this element's parameters in the system's instance arrays
    //doing this is slower than sys.fillVec(), but makes cleaner code sometimes
    setInstanceParameter(name:string, data) {
        const sys = this.parent.parent,
            sid = this.gid - sys.globalStartId;
        
        sys.fillVec(name, data.length, sid, data);
    }

    //poof
    toggleVisibility() {
        const sys = this.parent.parent,
            sid = this.gid - sys.globalStartId;

        const visibility = this.getInstanceParameter3('visibility');
        visibility.addScalar(-1);

        sys.fillVec('visibility', 3, sid, [Math.abs(visibility.x), Math.abs(visibility.y), Math.abs(visibility.z)]);
    }

    handleCircularStrands(sys, sid, xbb, ybb, zbb) {
        if (this.neighbor5 != null && this.neighbor5.lid < this.lid) { //handle circular strands
            let xbbLast = sys.bbOffsets[this.neighbor5.gid * 3],
            ybbLast = sys.bbOffsets[this.neighbor5.gid * 3 + 1],
            zbbLast = sys.bbOffsets[this.neighbor5.gid * 3 + 2];            

            let xsp = (xbb + xbbLast) / 2, 
            ysp = (ybb + ybbLast) / 2,
            zsp = (zbb + zbbLast) / 2;

            let spLen = Math.sqrt(Math.pow(xbb - xbbLast, 2) + Math.pow(ybb - ybbLast, 2) + Math.pow(zbb - zbbLast, 2));

            let spRotation = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0), new THREE.Vector3(xsp - xbb, ysp - ybb, zsp - zbb).normalize()
            );

            sys.fillVec('bbconOffsets', 3, sid, [xsp, ysp, zsp]);
            sys.fillVec('bbconRotation', 4, sid, [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
            sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);
        }
    }
};

class Nucleotide extends BasicElement {
    constructor(gid: number, parent: Strand) {
        super(gid, parent);
    };
    calculatePositions(l: string) {

        const sys = this.parent.parent,
            sid = this.gid - sys.globalStartId;

        //extract position
        const x = parseFloat(l[0]),
            y = parseFloat(l[1]),
            z = parseFloat(l[2]);

        // extract axis vector a1 (backbone vector) and a3 (stacking vector) 
        const xA1 = parseFloat(l[3]),
            yA1 = parseFloat(l[4]),
            zA1 = parseFloat(l[5]),
            xA3 = parseFloat(l[6]),
            yA3 = parseFloat(l[7]),
            zA3 = parseFloat(l[8]);

        // according to base.py a2 is the cross of a1 and a3
        const [xA2, yA2, zA2] = cross(xA1, yA1, zA1, xA3, yA3, zA3);
        
        // compute backbone position
        let xbb: number = 0;
        let ybb: number = 0;
        let zbb: number = 0;
        const bbpos: THREE.Vector3 = this.calcBBPos(x, y, z, xA1, yA1, zA1, xA2, yA2, zA2, xA3, yA3, zA3);
        xbb = bbpos.x;
        ybb = bbpos.y;
        zbb = bbpos.z;

        // compute nucleoside cm
        const xns = x + 0.4 * xA1,
            yns = y + 0.4 * yA1,
            zns = z + 0.4 * zA1;

        // compute nucleoside rotation
        const baseRotation = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(xA3, yA3, zA3));

        //compute connector position
        const xCon = (xbb + xns) / 2,
            yCon = (ybb + yns) / 2,
            zCon = (zbb + zns) / 2;

        // compute connector rotation
        const rotationCon = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), 
            new THREE.Vector3(xCon - xns, yCon - yns, zCon - zns).normalize());               

        // compute sugar-phosphate positions/rotations, or set them all to 0 if there is no sugar-phosphate.
        let xsp, ysp, zsp, spLen, spRotation;
        if (this.neighbor3 != null && this.neighbor3.lid < this.lid) {
            xsp = (xbb + xbbLast) / 2, 
            ysp = (ybb + ybbLast) / 2,
            zsp = (zbb + zbbLast) / 2;

            spLen = Math.sqrt(Math.pow(xbb - xbbLast, 2) + Math.pow(ybb - ybbLast, 2) + Math.pow(zbb - zbbLast, 2));
        
            spRotation = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0), new THREE.Vector3(xsp - xbb, ysp - ybb, zsp - zbb).normalize()
            );
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
        idColor.setHex(this.gid+1); //has to be +1 or you can't grab nucleotide 0
    

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
        sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);
        sys.fillVec('visibility', 3, sid, [1,1,1]);

        color = this.elemToColor(this.type);
        sys.fillVec('nsColors', 3, sid, [color.r, color.g, color.b]);

        sys.fillVec('bbLabels', 3, sid, [idColor.r, idColor.g, idColor.b]);

        // keep track of last backbone for sugar-phosphate positioning
        xbbLast = xbb;
        ybbLast = ybb;
        zbbLast = zbb;
    };

    translatePosition(amount: THREE.Vector3) {
        const sys = this.parent.parent,
            id = (this.gid - sys.globalStartId)*3;

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
    calcBBPos(x: number, y: number, z: number, xA1: number, yA1: number, zA1: number, xA2: number, yA2: number, zA2: number, xA3: number, yA3: number, zA3: number): THREE.Vector3 {
        return new THREE.Vector3(x, y, z);
    };

    calculateNewConfigPositions(l: string) {
        const sys = this.parent.parent,
            sid = this.gid - sys.globalStartId;

        //extract position
        const x = parseFloat(l[0]),
            y = parseFloat(l[1]),
            z = parseFloat(l[2]);

        // extract axis vector a1 (backbone vector) and a3 (stacking vector) 
        const xA1 = parseFloat(l[3]),
            yA1 = parseFloat(l[4]),
            zA1 = parseFloat(l[5]),
            xA3 = parseFloat(l[6]),
            yA3 = parseFloat(l[7]),
            zA3 = parseFloat(l[8]);

        // a2 is perpendicular to a1 and a3
        const [xA2, yA2, zA2] = cross(xA1, yA1, zA1, xA3, yA3, zA3);
        // compute backbone cm
        let xbb: number = 0;
        let ybb: number = 0;
        let zbb: number = 0;
        let bbpos: THREE.Vector3 = this.calcBBPos(x, y, z, xA1, yA1, zA1, xA2, yA2, zA2, xA3, yA3, zA3);
        xbb = bbpos.x;
        ybb = bbpos.y;
        zbb = bbpos.z;

        // compute nucleoside cm
        const xns = x + 0.4 * xA1,
            yns = y + 0.4 * yA1,
            zns = z + 0.4 * zA1;

        //compute connector position
        const xCon = (xbb + xns) / 2,
            yCon = (ybb + yns) / 2,
            zCon = (zbb + zns) / 2;

        //correctly display stacking interactions
        const baseRotation = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(xA3, yA3, zA3));

        // compute connector rotation
        const rotationCon = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), 
            new THREE.Vector3(xbb - xns, ybb - yns, zbb - zns).normalize());

        // compute sugar-phosphate positions/rotations, or set them all to 0 if there is no sugar-phosphate.
        let xsp, ysp, zsp, spLen, spRotation;
        if (this.neighbor3 != null && this.neighbor3.lid < this.lid) {
            xsp = (xbb + xbbLast) / 2, 
            ysp = (ybb + ybbLast) / 2,
            zsp = (zbb + zbbLast) / 2;

            spLen = Math.sqrt(Math.pow(xbb - xbbLast, 2) + Math.pow(ybb - ybbLast, 2) + Math.pow(zbb - zbbLast, 2));
        
            spRotation = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(xsp - xbb, ysp - ybb, zsp - zbb).normalize());
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
        sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);


        // keep track of last backbone for sugar-phosphate positioning
        xbbLast = xbb;
        ybbLast = ybb;
        zbbLast = zbb;

    };

    updateColor() {
        const sys = this.parent.parent,
            sid = this.gid - sys.globalStartId;
        let color: THREE.Color;
        if (selectedBases.has(this)) {
            color = selectionColor;
        } else {
            switch (getColoringMode()) {
                case "Strand": color = backboneColors[(Math.abs(this.parent.strandID) + this.parent.parent.systemID) % backboneColors.length]; break;
                case "System": color = backboneColors[this.parent.parent.systemID % backboneColors.length]; break;
                case "Cluster":
                    if(!this.clusterId || this.clusterId < 0) {
                        color = new THREE.Color(0xE60A0A)
                    } else {
                        color = backboneColors[this.clusterId % backboneColors.length];
                    } break;
                case "Overlay": color = sys.lutCols[sid]; break;
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
    };

    elemToColor(elem: number | string): THREE.Color {
        elem = { "A": 0, "G": 1, "C": 2, "T": 3, "U": 3 }[elem];
        if (elem ==undefined){
            return GREY
        }
        return nucleosideColors[elem];
    };

    getDatFileOutput(): string {
        let dat: string = "";
        let tempVec = this.getInstanceParameter3("cmOffsets"); //nucleotide's center of mass in world
        const x: number = tempVec.x;
        const y: number = tempVec.y;
        const z: number = tempVec.z;
        tempVec = this.getInstanceParameter3("bbOffsets");
        const xbb: number = tempVec.x;
        const ybb: number = tempVec.y;
        const zbb: number = tempVec.z;
        tempVec = this.getInstanceParameter3("nsOffsets"); //nucleotide's nucleoside's world position
        const xns: number = tempVec.x;
        const yns: number = tempVec.y;
        const zns: number = tempVec.z;
        let xA1: number;
        let yA1: number;
        let zA1: number;
        //calculate axis vector a1 (backbone vector) and a3 (stacking vector)
        xA1 = (xns - x) / 0.4;
        yA1 = (yns - y) / 0.4;
        zA1 = (zns - z) / 0.4;
        const a3: THREE.Vector3 = this.getA3(xbb, ybb, zbb, x, y, z, xA1, yA1, zA1);
        const xA3: number = a3.x;
        const yA3: number = a3.y;
        const zA3: number = a3.z;
        dat = x + " " + y + " " + z + " " + xA1 + " " + yA1 + " " + zA1 + " " + xA3 + " " + yA3 +
            " " + zA3 + " 0 0 0 0 0 0" + "\n"; //add all locations to dat file string
        return dat;
    };
    getA3(xbb: number, ybb: number, zbb: number, x: number, y: number, z: number, xA1: number, yA1: number, zA1: number): THREE.Vector3 {
        return new THREE.Vector3();
    };
};

class DNANucleotide extends Nucleotide {
    constructor(gid: number, parent: Strand) {
        super(gid, parent);
        this.elementType = DNA;
        this.bbnsDist = 0.8147053;
    };
    calcBBPos(x: number, y: number, z: number, xA1: number, yA1: number, zA1: number, xA2: number, yA2: number, zA2: number, xA3: number, yA3: number, zA3: number): THREE.Vector3 {
        const xbb = x - (0.34 * xA1 + 0.3408 * xA2),
            ybb = y - (0.34 * yA1 + 0.3408 * yA2),
            zbb = z - (0.34 * zA1 + 0.3408 * zA2);
        return new THREE.Vector3(xbb, ybb, zbb);
    };
    getA3(xbb: number, ybb: number, zbb: number, x: number, y: number, z: number, xA1: number, yA1: number, zA1: number): THREE.Vector3 {
        let xA2: number;
        let yA2: number;
        let zA2: number;
        xA2 = ((xbb - x) + (0.34 * xA1)) / (-0.3408);
        yA2 = ((ybb - y) + (0.34 * yA1)) / (-0.3408);
        zA2 = ((zbb - z) + (0.34 * zA1)) / (-0.3408);

        const a3: number[] = divAndNeg(cross(xA1, yA1, zA1, xA2, yA2, zA2), dot(xA1, yA1, zA1, xA1, yA1, zA1));
        const xA3 = a3[0]; let yA3 = a3[1]; let zA3 = a3[2];
        return new THREE.Vector3(xA3, yA3, zA3);
    };
};

class RNANucleotide extends Nucleotide {
    constructor(gid: number, parent: Strand) {
        super(gid, parent);
        this.elementType = RNA;
        this.bbnsDist = 0.8246211;

    };

    calcBBPos(x: number, y: number, z: number, xA1: number, yA1: number, zA1: number, xA2: number, yA2: number, zA2: number, xA3: number, yA3: number, zA3: number): THREE.Vector3 {
        const xbb = x - (0.4 * xA1 + 0.2 * xA3),
            ybb = y - (0.4 * yA1 + 0.2 * yA3),
            zbb = z - (0.4 * zA1 + 0.2 * zA3);
        return new THREE.Vector3(xbb, ybb, zbb);
    };

    getA3(xbb: number, ybb: number, zbb: number, x: number, y: number, z: number, xA1: number, yA1: number, zA1: number): THREE.Vector3 {
        const xA3 = ((xbb - x) + (0.4 * xA1)) / (-0.2);
        const yA3 = ((ybb - y) + (0.4 * yA1)) / (-0.2);
        const zA3 = ((zbb - z) + (0.4 * zA1)) / (-0.2);
        return new THREE.Vector3(xA3, yA3, zA3);
    };
};
class AminoAcid extends BasicElement {
    constructor(gid: number, parent: Strand) {
        super(gid, parent);
        this.elementType = AA;
    };

    elemToColor(elem: number | string): THREE.Color {
        elem = { "R": 0, "H": 1, "K": 2, "D": 3, "E": 3, "S": 4, "T": 5, "N": 6, "Q": 7, "C": 8, "U": 9, "G": 10, "P": 11, "A": 12, "V": 13, "I": 14, "L": 15, "M": 16, "F": 17, "Y": 18, "W": 19 }[elem];
        if (elem == undefined) return GREY
        return nucleosideColors[elem];
    };

    calculatePositions(l: string) {
        const sys = this.parent.parent,
        sid = this.gid - sys.globalStartId;

        //extract position
        const x = parseFloat(l[0]),
            y = parseFloat(l[1]),
            z = parseFloat(l[2]);

        // compute backbone positions/rotations, or set them all to 0 if there is no neighbor.
        let xsp, ysp, zsp, spLen, spRotation;
        if (this.neighbor3 != null && this.neighbor3.lid < this.lid) {
            xsp = (x + xbbLast) / 2,
                ysp = (y + ybbLast) / 2,
                zsp = (z + zbbLast) / 2;

            spLen = Math.sqrt(Math.pow(x - xbbLast, 2) + Math.pow(y - ybbLast, 2) + Math.pow(z - zbbLast, 2));

            spRotation = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0), new THREE.Vector3(xsp - x, ysp - y, zsp - z).normalize()
            );
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
        idColor.setHex(this.gid+1); //has to be +1 or you can't grab nucleotide 0

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
        sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);      
        sys.fillVec('bbColors', 3, sid, [color.r, color.g, color.b]);
        sys.fillVec('visibility', 3, sid, [1,1,1]);

        color = this.elemToColor(this.type);
        sys.fillVec('nsColors', 3, sid, [color.r, color.g, color.b]);
        
        sys.fillVec('bbLabels', 3, sid, [idColor.r, idColor.g, idColor.b]);

        // keep track of last backbone for sugar-phosphate positioning
        xbbLast = x;
        ybbLast = y;
        zbbLast = z;
    };
    calculateNewConfigPositions(l: string) {
        const sys = this.parent.parent,
        sid = this.gid - sys.globalStartId;

        //extract position
        const x = parseFloat(l[0]),
            y = parseFloat(l[1]),
            z = parseFloat(l[2]);

        //calculate new backbone connector position/rotation
        let xsp, ysp, zsp, spLen, spRotation;
        if (this.neighbor3 != null && this.neighbor3.lid < this.lid) {
            xsp = (x + xbbLast) / 2,
                ysp = (y + ybbLast) / 2,
                zsp = (z + zbbLast) / 2;

            spLen = Math.sqrt(Math.pow(x - xbbLast, 2) + Math.pow(y - ybbLast, 2) + Math.pow(z - zbbLast, 2));

            spRotation = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0), new THREE.Vector3(xsp - x, ysp - y, zsp - z).normalize()
            );
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
        sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);  
        
        xbbLast = x;
        ybbLast = y;
        zbbLast = z;
    };

    translatePosition(amount: THREE.Vector3) {
        const sys = this.parent.parent,
            id = (this.gid - sys.globalStartId)*3;

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
        const sys = this.parent.parent,
            sid = this.gid - sys.globalStartId;
        let bbColor: THREE.Color;
        let aaColor: THREE.Color;
        if (selectedBases.has(this)) {
            bbColor = selectionColor;
        } else {
            switch (getColoringMode()) {
                case "Strand": bbColor = backboneColors[(Math.abs(this.parent.strandID) + this.parent.parent.systemID) % backboneColors.length]; break;
                case "System": bbColor = backboneColors[this.parent.parent.systemID % backboneColors.length]; break;
                case "Cluster":
                    if(!this.clusterId || this.clusterId < 0) {
                        bbColor = new THREE.Color(0xE60A0A)
                    } else {
                        bbColor = backboneColors[this.clusterId % backboneColors.length];
                    } break;
                case "Overlay": bbColor = sys.lutCols[sid]; break;
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
    };

    getDatFileOutput(): string {
        let dat: string = "";
        const tempVec = this.getInstanceParameter3("cmOffsets");
        const x: number = tempVec.x;
        const y: number = tempVec.y;
        const z: number = tempVec.z;
        dat = x + " " + y + " " + z + "1.0 1.0 0.0 0.0 0.0 -1.0 0.0 0.0 0.0 0.0 0.0 0.0" + "\n"; //add all locations to dat file string
        return dat;
    };
};

// strands are made up of elements
// strands have an ID within the system
class Strand extends THREE.Group {

    strandID: number; //system location
    parent: System;
    pos: THREE.Vector3;

    constructor(id: number, parent: System) {
        super();
        this.strandID = id;
        this.parent = parent;
    };

    //POINT OF CONCERN FOR LATER: NEED TO SOMEHOW ADD THIS TO ARRAYS
    //DO WE JUST MAKE ALL NEW THINGS IN THEIR OWN SYSTEM??
    //AND THEN HAVE SOME COMPLICATED STUFF TO MAKE THEM BEHAVE?
    addBasicElement(elem: BasicElement) {
        this[monomers].push(elem);
        elem.parent = this;
    };

    createBasicElement(gid: number): BasicElement {
        return new BasicElement(gid, this);
    }

    removeBasicElement(toRemove: number) {
        for (let i = 0; i < this[monomers].length; i++) {
            let n = this[monomers][i];
            if (n.gid == toRemove) { //changed from local to global id
                scene.remove(n);
                n = null;
            }
        }
    };

    excludeElements(elements: BasicElement[]) {
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
    };

    getCom() {
        const com = new THREE.Vector3(0, 0, 0);
        for (let i = ((this[monomers][0] as BasicElement).gid - this.parent.globalStartId) * 3; i <= ((this[monomers][this[monomers].length-1] as BasicElement).gid - this.parent.globalStartId) * 3; i+=3){
            com.add(new THREE.Vector3(this.parent.cmOffsets[i], this.parent.cmOffsets[i+1], this.parent.cmOffsets[i+2]));
        }
        return(com.multiplyScalar(1/this[monomers].length))
    };

    translateStrand(amount: THREE.Vector3) {

    };
};

class NucleicAcidStrand extends Strand {
    constructor(id: number, parent: System) {
        super(id, parent);
    };

    createBasicElement(gid: number) {
        if (RNA_MODE)
            return new RNANucleotide(gid, this);
        else
            return new DNANucleotide(gid, this);
    };

    translateStrand(amount: THREE.Vector3) {
        const s = this.parent;
        for (let i = ((this[monomers][0] as Nucleotide).gid - this.parent.globalStartId) * 3; i <= ((this[monomers][this[monomers].length-1] as Nucleotide).gid - this.parent.globalStartId) * 3; i+=3){
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
        s.backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
        s.nucleoside.geometry["attributes"].instanceOffset.needsUpdate = true;
        s.connector.geometry["attributes"].instanceOffset.needsUpdate = true;
        s.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
        s.dummyBackbone.geometry["attributes"].instanceOffset.needsUpdate = true;
    }
}
class Peptide extends Strand {
    constructor(id: number, parent: System) {
        super(id, parent);
    };

    createBasicElement(gid: number) {
        return new AminoAcid(gid, this);
    };

    translateStrand(amount: THREE.Vector3) {
        const s = this.parent;
        for (let i = ((this.children[0] as AminoAcid).gid - this.parent.globalStartId) * 3; i <= ((this[monomers][this[monomers].length-1] as AminoAcid).gid - this.parent.globalStartId) * 3; i+=3){

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
        s.nucleoside.geometry["attributes"].instanceOffset.needsUpdate = true;
        s.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
        s.dummyBackbone.geometry["attributes"].instanceOffset.needsUpdate = true;
    };
}


// systems are made of strands
// systems can CRUD
class System extends THREE.Group {

    systemID: number;
    globalStartId: number; //1st nucleotide's gid
    datFile;
    colormapFile;
    lutCols: THREE.Color[];

    //the system contains all the data from a dat file in its instancing arrays
    //the system also owns the actual meshes that get sent to the scene.
    INSTANCES: number;
    bbOffsets: Float32Array;
    bbRotation: Float32Array;
    nsOffsets: Float32Array;
    nsRotation: Float32Array;
    conOffsets: Float32Array;
    conRotation: Float32Array;
    bbconOffsets: Float32Array;
    bbconRotation: Float32Array;
    bbconScales: Float32Array;
    cmOffsets: Float32Array;
    bbColors: Float32Array;
    nsColors: Float32Array;
    scales: Float32Array;
    nsScales: Float32Array;
    conScales: Float32Array;
    visibility: Float32Array;

    bbLabels: Float32Array;

    backbone: THREE.Mesh;
    nucleoside: THREE.Mesh;
    connector: THREE.Mesh;
    bbconnector: THREE.Mesh;
    dummyBackbone: THREE.Mesh;

    constructor(id, startID) {
        super();
        this.systemID = id;
        this.globalStartId = startID;
        this.lutCols = [];
    };

    systemLength(): number {
        let count: number = 0;
        for (let i = 0; i < this[strands].length; i++) {
            count += this[strands][i][monomers].length;
        }
        return count;
    };

    createStrand(strID: number): Strand {
        if (strID < 0)
            return new Peptide(strID, this);
        else
            return new NucleicAcidStrand(strID, this);
    };

    addStrand(strand: Strand) {
        this[strands].push(strand);
        strand.parent = this;
    };

    removeStrand(toRemove: number) {
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
            };

            render();
        }
    };

    //computes the center of mass of the system
    getCom() {
        const com = new THREE.Vector3(0, 0, 0);
        for (let i = 0; i < this.INSTANCES * 3; i+=3){
            com.add(new THREE.Vector3(this.cmOffsets[i], this.cmOffsets[i+1], this.cmOffsets[i+2]))
        }
        return(com.multiplyScalar(1/this.INSTANCES))
    };

    //This is needed to handle strands that have experienced fix_diffusion.  Don't use it.
    strandUnweightedCom() {
        const com = new THREE.Vector3(0, 0, 0);
        let count = 0;
        this[strands].forEach((s: Strand) => {
            com.add(s.getCom())
            count += 1;
        });
    return(com.multiplyScalar(1/count))
    };

    setDatFile(datFile) { //allows for trajectory function
        this.datFile = datFile;
    };

    setColorFile(jsonFile) {
        this.colormapFile = jsonFile;
    };

    translateSystem(amount: THREE.Vector3) {
        for (let i = 0; i < this.INSTANCES * 3; i+=3){
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
        this.backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
        this.nucleoside.geometry["attributes"].instanceOffset.needsUpdate = true;
        this.connector.geometry["attributes"].instanceOffset.needsUpdate = true;
        this.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
        this.dummyBackbone.geometry["attributes"].instanceOffset.needsUpdate = true;

        render();
    };

    fillVec(vecName, unitSize, pos, vals) {
        for (i = 0; i < unitSize; i++) {
            this[vecName][pos * unitSize + i] = vals[i]
        }
    };
};

function nextConfig() {
    if (nextReader.readyState == 1) { //0: nothing loaded 1: working 2: done
        return;
    }
    getNewConfig(1);
};

function previousConfig() {
    if (previousPreviousReader.readyState == 1) {
        return;
    }
    getNewConfig(-1);
};

function notify(message: string) {
    const noticeboard = document.getElementById('noticeboard');

    // Remove any identical notifications from the board
    for (let notification of noticeboard.children) {
        if (notification.innerHTML === message) {
            noticeboard.removeChild(notification);
        }
    }

    // Create a new notification
    const notification = document.createElement('div');
    notification.className = "notification";
    notification.innerHTML = message;

    // Add it to the board and remove it on mouseover
    // or after 5 seconds
    const remove = function() {
        try {noticeboard.removeChild(notification);}
        catch (e) {} // Notification already removed
    }
    notification.onmouseover = remove;
    noticeboard.appendChild(notification);
    setTimeout(remove, 5000);
}

function toggleModal(id) {
    let modal = document.getElementById(id);
    modal.classList.toggle("show-modal");
}

function toggleOptions(id) {
    let opt = document.getElementById(id);
    opt.hidden = !opt.hidden;
}

function colorOptions() {
    const opt: HTMLElement = document.getElementById("colorOptionContent");
    if (!opt.hidden) {
        opt.innerHTML = "";  //Clear content
        const addButton = document.createElement('button');
        addButton.innerText = "Add Color";
        // Append new color to the end of the color list and reset colors
        addButton.onclick = function () {
            backboneColors.push(new THREE.Color(0x0000ff));
            colorOptions();
        }

        //modifies the backboneColors array
        for (let i = 0; i < backboneColors.length; i++) {
            let m = backboneColors[i];
            let c = document.createElement('input');
            c.type = 'color';
            c.value = "#" + m.getHexString();
            c.onchange = function () {
                backboneColors[i] = new THREE.Color(c.value);
                colorOptions();
            }
            
            //deletes color on right click
            c.oncontextmenu = function (event) {
                event.preventDefault();
                backboneColors.splice(i, 1);
                colorOptions();
                return false;
            }
            opt.appendChild(c);
        }
        opt.appendChild(addButton);

        //actually update things in the scene
        for (let i=0; i<elements.length; i++) {
            if (!selectedBases.has(elements[i]))
                elements[i].updateColor();
        }
        for (let i = 0; i < systems.length; i++){
            systems[i].backbone.geometry["attributes"].instanceColor.needsUpdate = true;
            systems[i].connector.geometry["attributes"].instanceColor.needsUpdate = true;
            systems[i].bbconnector.geometry["attributes"].instanceColor.needsUpdate = true;
        }
        render();
    }
};

function createVideo() {
    // Get canvas
    const canvas = <HTMLCanvasElement>document.getElementById("threeCanvas");

    // Get options:
    const format = (<HTMLInputElement>document.querySelector('input[name="videoFormat"]:checked')).value;
    const framerate = (<HTMLInputElement>document.getElementById("videoFramerate")).value;
    const videoType = <HTMLInputElement>document.getElementById("videoType");

    // Set up movie capturer
    const capturer = new CCapture({
        format: format,
        framerate: framerate,
        name: videoType.value,
        verbose: true,
        display: true,
        workersPath: 'ts/lib/'
    });

    const button = <HTMLInputElement>document.getElementById("videoStartStop");
    button.innerText = "Stop";
    button.onclick = function () {
        capturer.stop();
        capturer.save();
    }
    try {
        switch (videoType.value) {
            case "trajectory":
                createTrajectoryVideo(canvas, capturer);
                break;
            case "lemniscate":
                let duration = (<HTMLInputElement>document.getElementById("videoDuration")).value;
                createLemniscateVideo(
                    canvas, capturer,
                    <number><unknown>framerate,
                    <number><unknown>duration
                );
                break;
        }
    } catch (e) {
        notify("Failed to capture video: \n" + e);
        capturer.stop();
    }
};

function createTrajectoryVideo(canvas, capturer) {
    // Listen for configuration loaded events
    function _load(e) {
        e.preventDefault(); // cancel default actions
        capturer.capture(canvas);
        nextConfig();
    };

    // Listen for last configuration event
    function _done(e) {
        document.removeEventListener('nextConfigLoaded', _load);
        document.removeEventListener('finalConfig', _done);
        capturer.stop();
        capturer.save();
        button.innerText = "Start";
        button.onclick = createVideo;
        return;
    };

    // Overload stop button so that we don't forget to remove listeners
    const button = <HTMLInputElement>document.getElementById("videoStartStop");
    button.onclick = _done;

    document.addEventListener('nextConfigLoaded', _load);
    document.addEventListener('finalConfig', _done);

    // Start capturing
    capturer.start();
    nextConfig();
};

function createLemniscateVideo(canvas, capturer, framerate:number, duration:number) {
    // Setup timing
    let tMax = 2 * Math.PI;
    let nFrames = duration * framerate;
    let dt = tMax / nFrames;

    // Preserve camera distance from origin:
    const d = Origin.distanceTo(camera.position);

    capturer.start();

    // Overload stop button so that we don't forget to remove listeners
    const button = <HTMLInputElement>document.getElementById("videoStartStop");
    button.onclick = function () { tMax = 0; };

    // Move camera and capture frames
    // This is not a for-loop since we need to use
    // requestAnimationFrame recursively.
    let t = 0;
    var animate = function () {
        if (t >= tMax) {
            capturer.stop();
            capturer.save();
            button.innerText = "Start";
            button.onclick = createVideo;
            return;
        }
        requestAnimationFrame(animate);
        camera.position.set(
            d * Math.cos(t),
            d * Math.sin(t) * Math.cos(t),
            d * Math.sqrt(Math.pow(Math.sin(t), 4))
        );
        camera.lookAt(Origin);
        t += dt;
        render();
        capturer.capture(canvas);
    }
    animate();
};

//toggles display of coloring by json file / structure modeled off of base selector
function coloringChanged() {
    if (getColoringMode() === "Overlay") {
        if (lut) {
            api.showColorbar();
        } else {
            notify("Please drag and drop the corresponding .json file.");
            setColoringMode("Strand");
            return;
        }
    } else if (lut) {
        api.removeColorbar();
    }

    for (let i = 0; i < elements.length; i++) {
        elements[i].updateColor();
    }
    for (let i = 0; i < systems.length; i++) {
        systems[i].backbone.geometry["attributes"].instanceColor.needsUpdate = true;
        systems[i].connector.geometry["attributes"].instanceColor.needsUpdate = true;
        systems[i].bbconnector.geometry["attributes"].instanceColor.needsUpdate = true;
    }
    render();
};

function toggleBackground() {
    if (scene.background == WHITE) {
        scene.background = BLACK;
        render();
    }
    else {
        scene.background = WHITE;
        render();
    }
};

function setFog(near?: number, far?: number) {
    near = near | parseFloat((<HTMLInputElement>document.getElementById("fogNear")).value);
    far = near | parseFloat((<HTMLInputElement>document.getElementById("fogFar")).value);
    scene.fog = new THREE.Fog(scene.background, near, far);
    render();
}

function toggleFog(near?: number, far?: number) {
    if (scene.fog == null) {
        setFog(near, far);
    }
    else {
        scene.fog = null;
    }
    render();
}

function cross(a1, a2, a3, b1, b2, b3) { //calculate cross product of 2 THREE.Vectors but takes coordinates as (x,y,z,x1,y1,z1)
    return [a2 * b3 - a3 * b2,
    a3 * b1 - a1 * b3,
    a1 * b2 - a2 * b1];
}

function toggleSideNav(button: HTMLInputElement) {
    let hidden = "show";
    let visible = "hide";
    let content = document.getElementById("sidenavContent");
    if (button.innerText.toLowerCase() == hidden) {
        content.style.display = "block";
        button.innerHTML = visible;
    } else {
        content.style.display = "none";
        button.innerHTML = hidden;
    }
}

function getColoringMode(): string {
    return document.querySelector('input[name="coloring"]:checked')['value'];
};

function setColoringMode(mode: string) {
    const modes = <NodeListOf<HTMLInputElement>>document.getElementsByName("coloring");
    for (let i = 0; i < modes.length; i++) {
        modes[i].checked = (modes[i].value === mode);
    }
    coloringChanged();
};

/**
 * Add all selected elements to a new cluster
 */
function selectionToCluster() {
    if(selectedBases.size > 0) {
        clusterCounter++;
        selectedBases.forEach(element => {
            element.clusterId = clusterCounter;
        });
    } else {
        notify("First make a selection of elements you want to include in the cluster");
    }
}

/**
 * Clear clusters and reset the cluster counter
 */
function clearClusters() {
    clusterCounter = 0 // Cluster counter
    elements.forEach(element => {
        delete element.clusterId;
    });
}

/**
 * Calculate DBSCAN clusters using parameters from input
 */
function calculateClusters() {
    const minPts = parseFloat((<HTMLInputElement>document.getElementById("minPts")).value);
    const epsilon = parseFloat((<HTMLInputElement>document.getElementById("epsilon")).value);

    document.getElementById("clusterOptions").hidden = true;
    // Set wait cursor and request an animation frame to make sure
    // that it gets changed before starting dbscan:
    renderer.domElement.style.cursor = "wait";

    requestAnimationFrame(() => requestAnimationFrame(function(){
        dbscan(minPts, epsilon);
        renderer.domElement.style.cursor = "auto"; // Change cursor back
        setColoringMode("Cluster");
    }))
}

/**
 * Calculate DBSCAN clusters using custom parameters
 */
// Algorithm and comments from:
// https://en.wikipedia.org/wiki/DBSCAN#Algorithm
function dbscan(minPts: number, eps: number) {
    const nElements = elements.length;
    clearClusters(); // Remove any previous clusters and reset counter
    const noise = -1; // Label for noise
    const getPos = (element: BasicElement) => {
        return element.getInstanceParameter3("cmOffsets");
    }
    const findNeigbours = (p: BasicElement, eps: number) => {
        const neigbours: BasicElement[] = [];
        for (let i=0; i<nElements; i++) {
            let q: BasicElement = elements[i];
            if (p != q) {
                let dist = getPos(p).distanceTo(getPos(q));
                if (dist < eps) {
                   neigbours.push(q);
                }
            }
        }
        return neigbours;
    }
    for (let i=0; i<nElements; i++) {
        let p: BasicElement = elements[i];
        if (typeof p.clusterId !== 'undefined') {
            continue; // Previously processed in inner loop
        }
        // Find neigbours of p:
        let neigbours: BasicElement[] = findNeigbours(p, eps);
        if (neigbours.length < minPts) { // Density check
            p.clusterId = noise // Label as noise
            continue;
        }
        clusterCounter++; // Next cluster id
        p.clusterId = clusterCounter; // Label initial point
        for (let j=0; j<neigbours.length; j++) { // Process every seed point
            let q: BasicElement = neigbours[j];
            if ((typeof q.clusterId !== 'undefined') && // Previously processed
                (q.clusterId !== noise) // If noise, change it to border point
            ) {
                continue;
            }
            q.clusterId = clusterCounter; // Label neigbour
            // Find neigbours of q:
            let metaNeighbors: BasicElement[] = findNeigbours(q, eps);
            if (metaNeighbors.length >= minPts) { // Density check
                // Add new neigbours to seed set
                neigbours = neigbours.concat(metaNeighbors);
            }
        }
    }
}
