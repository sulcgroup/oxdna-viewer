/// <reference path="./three/index.d.ts" />

class ElementMap extends Map<number, BasicElement>{
    gidCounter: number;

    constructor(){
        super();
        this.gidCounter = 0;
    }

    // Avoid using this unless you really need to set
    // a specific gid.
    set(gid: number, element: BasicElement): this {
        if(this.gidCounter < gid+1){
            this.gidCounter = gid+1;
        }
        return super.set(gid, element);
    }

    /**
     * Add an element, keeping track of
     * global id
     * @param element
     * @returns gid
     */
    push(e: BasicElement): number {
        e.gid = ++this.gidCounter;
        super.set(e.gid, e);
        return e.gid;
    }
    /**
     * Remove element
     * @param gid
     */
    delete(gid: number): boolean {
        // If we delete the last added, we can decrease the gid counter.
        if(this.gidCounter == gid+1){
            this.gidCounter = gid;
        }
        return super.delete(gid);
    }

    getNextId(): number {
        return this.gidCounter;
    }
}

class InstanceCopy {
    type: string;
    gid: number;
    n3gid: number;
    n5gid: number;
    elemType: any;
    system: System;

    instanceParams = new Map([
        ['cmOffsets', 3], ['bbOffsets', 3], ['nsOffsets', 3],
        ['nsRotation', 4], ['conOffsets', 3], ['conRotation', 4],
        ['bbconOffsets', 3], ['bbconRotation', 4], ['bbColors', 3],
        ['scales', 3] ,['nsScales', 3], ['conScales', 3], ['bbconScales', 3],
        ['visibility', 3], ['nsColors', 3], ['bbLabels', 3]
    ]);

    cmOffsets: THREE.Vector3; bbOffsets: THREE.Vector3;
    nsOffsets: THREE.Vector3; nsRotation: THREE.Vector4;
    conOffsets: THREE.Vector3; conRotation: THREE.Vector4;
    bbconOffsets: THREE.Vector3; bbconRotation: THREE.Vector4;
    bbColors: THREE.Vector3; scales: THREE.Vector3;
    nsScales: THREE.Vector3; conScales: THREE.Vector3;
    bbconScales: THREE.Vector3; visibility: THREE.Vector3;
    nsColors: THREE.Vector3; bbLabels: THREE.Vector3;

    constructor(e: BasicElement) {
        this.instanceParams.forEach((size, attr)=>{
            if (size == 3){
                this[attr] = e.getInstanceParameter3(attr);
            } else { // 4
                this[attr] = e.getInstanceParameter4(attr);
            }
        });
        this.type = e.type;
        this.gid = e.gid;
        this.n3gid = e.neighbor3 ? e.neighbor3.gid : -1;
        this.n5gid = e.neighbor5 ? e.neighbor5.gid : -1;
        this.elemType = e.constructor;
        this.system = e.getSystem();
    }

    writeToSystem(sid: number, sys: System) {
        this.instanceParams.forEach((size, attr)=>{
            sys.fillVec(attr, size, sid, this[attr].toArray());
        });
    }
}

// store rendering mode RNA  
var RNA_MODE = false; // By default we do DNA base spacing
// add base index visualistion
let elements: ElementMap = new ElementMap(); //contains references to all BasicElements
//initialize the space
const systems: System[] = [];
var tmpSystems: System[] = [] //used for editing
var sysCount: number = 0;
var strandCount: number = 0;
var selectedBases = new Set<BasicElement>();

var backbones: THREE.Object3D[] = [];
var lut, devs: number[]; //need for Lut coloring

const DNA: number = 0;
const RNA: number = 1;
const AA: number = 2;

//makes for cleaner references down the object hierarcy
//var strands = 'children',
//   monomers = 'children',
//objects = 'children';

const editHistory = new EditHistory();
let clusterCounter = 0 // Cluster counter

//Check if there are files provided in the url (and load them if that is the case)
readFilesFromURLParams();

render();

// Elements store the information about monomers
abstract class BasicElement {
    lid: number;
    gid: number; //location in world - all systems
    sid: number; //in-system ID, only used if in a temporary system
    name: string;
    neighbor3: BasicElement | null;
    neighbor5: BasicElement | null;
    strand: Strand;
    bbnsDist : number;
    type: string; // Base as string
    elementType: number = -1; // 0:A 1:G 2:C 3:T/U OR 1 of 20 amino acids
    clusterId: number;
    dummySys: System;

    constructor(gid: number, strand: Strand) {
        this.gid = gid;
        this.strand = strand;
        this.dummySys = null;
    };

    abstract calculatePositions(l: string[]): void;
    abstract calculateNewConfigPositions(l: string[]): void;
    abstract updateColor(): void;
    //abstract setPosition(newPos: THREE.Vector3): void; 
    abstract getDatFileOutput(): string; 
    abstract extendStrand(len, direction): void;
    abstract translatePosition(amount: THREE.Vector3): void;
    //abstract rotate(quat: THREE.Quaternion): void;

    // highlight/remove highlight the bases we've clicked from the list and modify color
    toggle() {
        if (selectedBases.has(this)) { selectedBases.delete(this); }
        else { selectedBases.add(this); }
        this.updateColor();
    };

    updateSP(num: number): THREE.Object3D {
        return new THREE.Object3D();
    };
    
    getSystem(): System {
        return this.strand.system;
    }

    strandToColor(strandIndex: number) {
        return backboneColors[(Math.abs(strandIndex) + this.getSystem().systemID) % backboneColors.length];
    };

    elemToColor(type: number | string): THREE.Color {
        return new THREE.Color();
    };

    isPaired() {
        return false;
    }

    //retrieve this element's values in a 3-parameter instance array
    //positions, scales, colors
    getInstanceParameter3(name: string) {
        let sys = this.getSystem(),
            sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys
            sid = this.sid;
        }

        const x: number = sys[name][sid * 3],
            y: number = sys[name][sid * 3 + 1],
            z: number = sys[name][sid * 3 + 2];

        return new THREE.Vector3(x, y, z);
    }

    //retrieve this element's values in a 4-parameter instance array
    //only rotations
    getInstanceParameter4(name: string) {
        let sys = this.getSystem(),
            sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys
            sid = this.sid;
        }

        const x: number = sys[name][sid * 4],
            y: number = sys[name][sid * 4 + 1],
            z: number = sys[name][sid * 4 + 2],
            w: number = sys[name][sid * 4 + 3];

        return new THREE.Vector4(x, y, z, w);
    }

    //set this element's parameters in the system's instance arrays
    //doing this is slower than sys.fillVec(), but makes cleaner code sometimes
    setInstanceParameter(name:string, data) {
        let sys = this.getSystem(),
            sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys
            sid = this.sid;
        }
        
        sys.fillVec(name, data.length, sid, data);
    }

    //poof
    toggleVisibility() {
        let sys = this.getSystem(),
            sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys
            sid = this.sid;
        }

        const visibility = this.getInstanceParameter3('visibility');
        visibility.addScalar(-1);

        sys.fillVec('visibility', 3, sid, [Math.abs(visibility.x), Math.abs(visibility.y), Math.abs(visibility.z)]);
    }

    handleCircularStrands(sys, sid, xbb, ybb, zbb) {
        if (this.neighbor5 != null && this.neighbor5.lid < this.lid) { //handle circular strands
            this.strand.circular = true;
            const xbbLast = sys.bbOffsets[this.neighbor5.gid * 3],
            ybbLast = sys.bbOffsets[this.neighbor5.gid * 3 + 1],
            zbbLast = sys.bbOffsets[this.neighbor5.gid * 3 + 2];

            const xsp = (xbb + xbbLast) / 2, 
            ysp = (ybb + ybbLast) / 2,
            zsp = (zbb + zbbLast) / 2;

            const spLen = Math.sqrt(Math.pow(xbb - xbbLast, 2) + Math.pow(ybb - ybbLast, 2) + Math.pow(zbb - zbbLast, 2));

            const spRotation = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0), new THREE.Vector3(xsp - xbb, ysp - ybb, zsp - zbb).normalize()
            );

            const sid5 = this.neighbor5.gid - sys.globalStartId

            sys.fillVec('bbconOffsets', 3, sid5, [xsp, ysp, zsp]);
            sys.fillVec('bbconRotation', 4, sid5, [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
            sys.fillVec('bbconScales', 3, sid5, [1, spLen, 1]);
        }
    }

};

abstract class Nucleotide extends BasicElement {

    pair: Nucleotide | null;

    constructor(gid: number, strand: Strand) {
        super(gid, strand);
    };
    calculatePositions(l: string[]) {
        let sys = this.getSystem(),
            sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys
            sid = this.sid;
        }

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
        
        // compute connector length
        let conLen = this.bbnsDist
        if ([xA1, yA1, zA1, xA3, yA3, zA3].every(x => x == 0)){
                conLen = 0;
        }

        // compute sugar-phosphate positions/rotations, or set them all to 0 if there is no sugar-phosphate.
        let xsp, ysp, zsp, spLen, spRotation;
        if (this.neighbor3 != null && (this.neighbor3.lid < this.lid || this.dummySys !== null)) {
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
        color = this.strandToColor(this.strand.strandID);

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
        sys.fillVec('conScales', 3, sid, [1, conLen, 1]);
        if(spLen == 0) {
            sys.fillVec('bbconScales', 3, sid, [0, 0, 0]);
        } else {
            sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);
        }
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
        let sys = this.getSystem(),
            sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys
            sid = this.sid;
        }

        sys.bbOffsets[sid * 3] += amount.x;
        sys.bbOffsets[sid * 3 + 1] += amount.y;
        sys.bbOffsets[sid * 3 + 2] += amount.z;

        sys.nsOffsets[sid * 3] += amount.x;
        sys.nsOffsets[sid * 3 + 1] += amount.y;
        sys.nsOffsets[sid * 3 + 2] += amount.z;

        sys.conOffsets[sid * 3] += amount.x;
        sys.conOffsets[sid * 3 + 1] += amount.y;
        sys.conOffsets[sid * 3 + 2] += amount.z;

        sys.bbconOffsets[sid * 3] += amount.x;
        sys.bbconOffsets[sid * 3 + 1] += amount.y;
        sys.bbconOffsets[sid * 3 + 2] += amount.z;

        sys.cmOffsets[sid * 3] += amount.x;
        sys.cmOffsets[sid * 3 + 1] += amount.y;
        sys.cmOffsets[sid * 3 + 2] += amount.z;
    }

    //different in DNA and RNA
    calcBBPos(x: number, y: number, z: number, xA1: number, yA1: number, zA1: number, xA2: number, yA2: number, zA2: number, xA3: number, yA3: number, zA3: number): THREE.Vector3 {
        return new THREE.Vector3(x, y, z);
    };

    calculateNewConfigPositions(l: string[]) {
        let sys = this.getSystem(),
            sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys
            sid = this.sid;
        }

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
        if(spLen == 0) {
            sys.fillVec('bbconScales', 3, sid, [0, 0, 0]);
        } else {
            sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);
        }


        // keep track of last backbone for sugar-phosphate positioning
        xbbLast = xbb;
        ybbLast = ybb;
        zbbLast = zbb;

    };

    updateColor() {
        let sys = this.getSystem(),
            sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys
            sid = this.sid;
        }
        let color: THREE.Color;
        if (selectedBases.has(this)) {
            color = selectionColor;
        } else {
            switch (getColoringMode()) {
                case "Strand": color = backboneColors[(Math.abs(this.strand.strandID) + this.getSystem().systemID) % backboneColors.length]; break;
                case "System": color = backboneColors[this.getSystem().systemID % backboneColors.length]; break;
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

    select() {
        selectedBases.add(this);
        this.updateColor();
    }

    deselect() {
        selectedBases.delete(this);
        this.updateColor()
    }

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

    getTypeNumber(): number {
        let c = this.type;
        if (c == 'U') {c = 'T';}
        let i = ['A', 'G', 'C', 'T'].indexOf(c);
        if (i>=0) {
            return i;
        } else {
            return parseInt(c);
        }
    }

    abstract getComplementaryType();

    changeType(type: string) {
        this.type = type;
        let sys = this.getSystem();
        let newC = this.elemToColor(type);
        sys.fillVec('nsColors', 3, this.gid - sys.globalStartId, [newC.r, newC.g, newC.b])
    }

    findPair(): Nucleotide {
        let bestCandidate = null;
        let bestDist = 0.6;
        let thisPos = this.getInstanceParameter3("nsOffsets");
        let sys = this.getSystem();
        
        let strandCount = sys.strands.length;
        for (let i = 0; i < strandCount; i++){  //for every strand in the System
            let strand = sys.strands[i];
            let nucCount = strand.monomers.length;
            for (let j = 0; j < nucCount; j++) { // for every nucleotide on the Strand
                let e = <Nucleotide> strand.monomers[j];
                if (this.neighbor3 != e && this.neighbor5 != e &&
                    this.getTypeNumber() != e.getTypeNumber() &&
                    (this.getTypeNumber() + e.getTypeNumber()) % 3 == 0
                ) {
                    let dist = e.getInstanceParameter3("nsOffsets").distanceTo(thisPos);
                    if (dist < bestDist) {
                        bestCandidate = e;
                        bestDist = dist;
                    }
                }
            }
        }
        return bestCandidate;
    }

    isPaired() {
        return this.pair? true : false;
    }

    getA3(xbb: number, ybb: number, zbb: number, x: number, y: number, z: number, xA1: number, yA1: number, zA1: number): THREE.Vector3 {
        return new THREE.Vector3();
    };
    getA1 (xns, yns, zns, x, y, z) {
        let xA1 = (xns - x) / 0.4;
        let yA1 = (yns - y) / 0.4;
        let zA1 = (zns - z) / 0.4;

        return(new THREE.Vector3(xA1, yA1, zA1))
    }

    extendStrand(len, direction){
    }
};

class DNANucleotide extends Nucleotide {
    constructor(gid: number, strand: Strand) {
        super(gid, strand);
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

    // Uses method from generators.py.  Needs to be relaxed since this is oxDNA1 helix
    extendStrand(len: number, direction:string) {
        let rot = 35.9*Math.PI/180
        let rise = 0.3897628551303122
        
        const start_pos = this.getInstanceParameter3("cmOffsets");
        const bb_pos = this.getInstanceParameter3("bbOffsets");
        const ns_pos = this.getInstanceParameter3("nsOffsets");
        const old_A1 = this.getA1(ns_pos.x, ns_pos.y, ns_pos.z, start_pos.x, start_pos.y, start_pos.z)
        let dir = this.getA3(bb_pos.x, bb_pos.y, bb_pos.z, start_pos.x, start_pos.y, start_pos.z, old_A1.x, old_A1.y, old_A1.z);
        if (direction == "neighbor5") {
            dir.multiplyScalar(-1);
        }
        let R = new THREE.Matrix4;
        R.makeRotationAxis(dir, rot)
        let rb = new THREE.Vector3(0.6, 0, 0)
        let a1 = old_A1.clone()
        let a3 = dir;
        let out = [];

        for (let i = 0; i < len; i++) {
            a1.applyMatrix4(R);
            rb.add(a3.clone().multiplyScalar(rise)).applyMatrix4(R);
            out.push([rb.x+start_pos.x, rb.y+start_pos.y, rb.z+start_pos.z, a1.x, a1.y, a1.z, a3.x, a3.y, a3.z]);
        }

        return out
    }

    getComplementaryType(): string {
        var map = {A:'T',G:'C',C:'G', T:'A'}
        return map[this.type];
    }
};

class RNANucleotide extends Nucleotide {
    constructor(gid: number, strand: Strand) {
        super(gid, strand);
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

    // Uses the method from generate_RNA.py found in the oxDNA UTILS directory
    extendStrand(len: number, direction:string) {
        const inclination = 15.5*Math.PI/180;
        const bp_backbone_distance = 2;
        const diameter = 2.35;
        const base_base_distance = 0.3287;
        const rot = 32.7*Math.PI/180;
        const cord = Math.cos(inclination) * bp_backbone_distance;
        const center_to_cord = Math.sqrt(Math.pow(diameter/2, 2) - Math.pow(cord/2, 2));
        
        //We just set the direction the the orientation of the a3 vector
        const start_pos = this.getInstanceParameter3("cmOffsets");
        const bb_pos = this.getInstanceParameter3("bbOffsets");
        const ns_pos = this.getInstanceParameter3("nsOffsets");
        const old_A1 = this.getA1(ns_pos.x, ns_pos.y, ns_pos.z, start_pos.x, start_pos.y, start_pos.z)
        let dir = this.getA3(bb_pos.x, bb_pos.y, bb_pos.z, start_pos.x, start_pos.y, start_pos.z, old_A1.x, old_A1.y, old_A1.z);
        if (direction == "neighbor5") {
            dir.multiplyScalar(-1);
        }
        const dir_norm = Math.sqrt(dir.dot(dir));
        dir.divideScalar(dir_norm);
        const x2 = center_to_cord;
        const y2 = -cord/2;
        const z2 = (bp_backbone_distance/2) * Math.sin(inclination);
        const x1 = center_to_cord;
        const y1 = cord/2;
        const z1 = -(bp_backbone_distance/2) * Math.sin(inclination);
        let r1 = new THREE.Vector3(x1, y1, z1);
        let r2 = new THREE.Vector3(x2, y2, z2);
        let r1_to_r2 = r2.clone().sub(r1);
        let R = new THREE.Matrix4;
        R.makeRotationAxis(dir, rot);
        let a1: THREE.Vector3;
        let a1proj = new THREE.Vector3;
        let a1projnorm: number;
        let a3: THREE.Vector3;
        let out = [];
        let RNA_fudge: THREE.Vector3;

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
            out.push([r1.x+start_pos.x+RNA_fudge.x, r1.y+start_pos.y+RNA_fudge.y, r1.z+start_pos.z+RNA_fudge.z, a1.x, a1.y, a1.z, a3.x, a3.y, a3.z]) //r1 needs to have a fudge factor from the RNA model added
            }

        return out;
    }

    getComplementaryType(): string {
        var map = {A:'U',G:'C',C:'G', U:'A'}
        return map[this.type];
    }
};
class AminoAcid extends BasicElement {
    constructor(gid: number, strand: Strand) {
        super(gid, strand);
        this.elementType = AA;
    };

    elemToColor(elem: number | string): THREE.Color {
        elem = { "R": 0, "H": 1, "K": 2, "D": 3, "E": 3, "S": 4, "T": 5, "N": 6, "Q": 7, "C": 8, "U": 9, "G": 10, "P": 11, "A": 12, "V": 13, "I": 14, "L": 15, "M": 16, "F": 17, "Y": 18, "W": 19 }[elem];
        if (elem == undefined) return GREY
        return nucleosideColors[elem];
    };

    calculatePositions(l: string[]) {
        const sys = this.getSystem(),
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
        color = this.strandToColor(this.strand.strandID);
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
        if(spLen == 0) {
            sys.fillVec('bbconScales', 3, sid, [0, 0, 0]);
        } else {
            sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);
        }
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
    calculateNewConfigPositions(l: string[]) {
        const sys = this.getSystem(),
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
        if(spLen == 0) {
            sys.fillVec('bbconScales', 3, sid, [0, 0, 0]);
        } else {
            sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);
        }
        
        xbbLast = x;
        ybbLast = y;
        zbbLast = z;
    };

    translatePosition(amount: THREE.Vector3) {
        const sys = this.getSystem(),
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
        let sys = this.getSystem(),
            sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys
            sid = this.sid;
        }
        let bbColor: THREE.Color;
        let aaColor: THREE.Color;
        if (selectedBases.has(this)) {
            bbColor = selectionColor;
            aaColor = selectionColor;
        } else {
            switch (getColoringMode()) {
                case "Strand": 
                    bbColor = backboneColors[(Math.abs(this.strand.strandID) + this.getSystem().systemID) % backboneColors.length]; 
                    aaColor = this.elemToColor(this.type);
                    break;
                case "System": 
                    bbColor = backboneColors[this.getSystem().systemID % backboneColors.length]; 
                    aaColor = this.elemToColor(this.type);
                    break;
                case "Cluster":
                    if(!this.clusterId || this.clusterId < 0) {
                        bbColor = new THREE.Color(0xE60A0A);
                        aaColor = bbColor.clone();
                    } else {
                        bbColor = backboneColors[this.clusterId % backboneColors.length];
                        aaColor = bbColor.clone();
                    } 
                    break;
                case "Overlay": 
                    bbColor = sys.lutCols[sid]; 
                    aaColor = bbColor.clone()
                    break;
            }
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
    };

    getDatFileOutput(): string {
        let dat: string = "";
        const tempVec = this.getInstanceParameter3("cmOffsets");
        const x: number = tempVec.x;
        const y: number = tempVec.y;
        const z: number = tempVec.z;
        dat = x + " " + y + " " + z + " 1.0 1.0 0.0 0.0 0.0 -1.0 0.0 0.0 0.0 0.0 0.0 0.0" + "\n"; //add all locations to dat file string
        return dat;
    };

    extendStrand(len, direction){

    }
};

// strands are made up of elements
// strands have an ID within the system
abstract class Strand {

    strandID: number; //system location
    system: System;
    pos: THREE.Vector3;
    circular: boolean;
    monomers: BasicElement[] = [];

    constructor(id: number, system: System) {
        this.strandID = id;
        this.system = system;
        this.circular = false;
    };

    addBasicElement(elem: BasicElement) {
        this.monomers.push(elem);
        elem.strand = this;
    };

    createBasicElement(gid: number): BasicElement {
        throw "Cannot create a basic element, need to be a nucleotide, amino acid, etc.";
    }

    excludeElements(elements: BasicElement[]) {
        // detach from strand
        elements.forEach(e => {
            e.strand = null;
        });
        // create a new list of strand elements  
        this.monomers = this.monomers.filter(e => {
            return !elements.includes(e);
        });
    };

    toggleMonomers() {
        this.monomers.forEach(e=>e.toggle());
    }

    isEmpty(): Boolean {
        return this.monomers.length == 0;
    }

    getCom() {
        const com = new THREE.Vector3(0, 0, 0);
        const l = this.monomers.length;
        const cmOffs = this.system.cmOffsets;
        for (
            let i = ((this.monomers[0] as BasicElement).gid - this.system.globalStartId) * 3; 
            i <= ((this.monomers[l-1] as BasicElement).gid - this.system.globalStartId) * 3;
            i+=3)
        {
            com.add(new THREE.Vector3(cmOffs[i], cmOffs[i+1], cmOffs[i+2]));
        }
        return(com.multiplyScalar(1/l))
    };

    abstract translateStrand(amount: THREE.Vector3): void;
};

class NucleicAcidStrand extends Strand {
    constructor(id: number, system: System) {
        super(id, system);
    };

    createBasicElement(gid: number) {
        if (RNA_MODE)
            return new RNANucleotide(gid, this);
        else
            return new DNANucleotide(gid, this);
    };

    translateStrand(amount: THREE.Vector3) {
        const s = this.system;
        for (
            let i = ((this.monomers[0] as Nucleotide).gid - s.globalStartId) * 3;
            i <= ((this.monomers[this.monomers.length-1] as Nucleotide).gid - s.globalStartId) * 3;
            i+=3)
        {
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
        s.callUpdates(['instanceOffset'])
        if (tmpSystems.length > 0) {
            tmpSystems.forEach((s) => {
                s.callUpdates(['instanceOffset'])
            })
        }
    }
}
class Peptide extends Strand {
    constructor(id: number, system: System) {
        super(id, system);
    };

    createBasicElement(gid: number) {
        return new AminoAcid(gid, this);
    };

    translateStrand(amount: THREE.Vector3) {
        const s = this.system;
        for (
            let i = ((this.monomers[0] as AminoAcid).gid - s.globalStartId) * 3;
            i <= ((this.monomers[this.monomers.length-1] as AminoAcid).gid - s.globalStartId) * 3;
            i+=3)
        {

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
        s.callUpdates(['instanceOffset'])
        if (tmpSystems.length > 0) {
            tmpSystems.forEach((s) => {
                s.callUpdates(['instanceOffset'])
            })
        }
    };
}


// systems are made of strands
// systems can CRUD
class System {

    systemID: number;
    globalStartId: number; //1st nucleotide's gid
    datFile;
    colormapFile;
    lutCols: THREE.Color[];
    strands: Strand[] = [];

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

    backboneGeometry: THREE.InstancedBufferGeometry;
    nucleosideGeometry: THREE.InstancedBufferGeometry;
    connectorGeometry: THREE.InstancedBufferGeometry;
    spGeometry: THREE.InstancedBufferGeometry;
    pickingGeometry: THREE.InstancedBufferGeometry;

    backbone: THREE.Mesh;
    nucleoside: THREE.Mesh;
    connector: THREE.Mesh;
    bbconnector: THREE.Mesh;
    dummyBackbone: THREE.Mesh;

    constructor(id: number, startID: number) {
        this.systemID = id;
        this.globalStartId = startID;
        this.lutCols = [];
    };

    systemLength(): number {
        let count: number = 0;
        for (let i = 0; i < this.strands.length; i++) {
            count += this.strands[i].monomers.length;
        }
        return count;
    };

    isEmpty(): Boolean {
        return this.strands.length == 0;
    }

    initInstances(nInstances: number) {
        this.INSTANCES = nInstances
        this.bbOffsets = new Float32Array(this.INSTANCES * 3);
        this.bbRotation = new Float32Array(this.INSTANCES * 4);
        this.nsOffsets = new Float32Array(this.INSTANCES * 3);
        this.nsRotation = new Float32Array(this.INSTANCES * 4)
        this.conOffsets = new Float32Array(this.INSTANCES * 3);
        this.conRotation = new Float32Array(this.INSTANCES * 4);
        this.bbconOffsets = new Float32Array(this.INSTANCES * 3);
        this.bbconRotation = new Float32Array(this.INSTANCES * 4);
        this.bbconScales = new Float32Array(this.INSTANCES * 3);
        this.cmOffsets = new Float32Array(this.INSTANCES * 3);
        this.bbColors = new Float32Array(this.INSTANCES * 3);
        this.nsColors = new Float32Array(this.INSTANCES * 3)
        this.scales = new Float32Array(this.INSTANCES * 3);
        this.nsScales = new Float32Array(this.INSTANCES * 3);
        this.conScales = new Float32Array(this.INSTANCES * 3);
        this.visibility = new Float32Array(this.INSTANCES * 3);
        this.bbLabels = new Float32Array(this.INSTANCES * 3);
    }

    callUpdates(names : string[]) {
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

    toggleStrands(){
        this.strands.forEach(strand=>{
            strand.toggleMonomers();
        })
    }

    createStrand(strID: number): Strand {
        if (strID < 0)
            return new Peptide(strID, this);
        else
            return new NucleicAcidStrand(strID, this);
    };

    addStrand(strand: Strand) {
        if(!this.strands.includes(strand)) {
            this.strands.push(strand);
        }
        strand.system = this;
    };

    /**
     * Remove strand from system
     * @param strand 
     */
    removeStrand(strand: Strand) {
        let i = this.strands.indexOf(strand);
        if (i >= 0) {
            this.strands.splice(i, 1);
        }
        if (this == strand.system) {
            strand.system = null;
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
        this.strands.forEach((s: Strand) => {
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
        this.callUpdates(['instanceOffset']);
        if (tmpSystems.length > 0) {
            tmpSystems.forEach((s) => {
                s.callUpdates(['instanceOffset'])
            })
        }


        render();
    };

    fillVec(vecName, unitSize, pos, vals) {
        for (let i = 0; i < unitSize; i++) {
            this[vecName][pos * unitSize + i] = vals[i]
        }
    };
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

    elements.forEach(e => e.updateColor());
    systems.forEach(s => s.callUpdates(['instanceColor']));

    if (tmpSystems.length > 0) {
        tmpSystems.forEach(s => s.callUpdates(['instanceColor']));
    }
    render();
}

function getColoringMode(): string {
    return document.querySelector('input[name="coloring"]:checked')['value'];
}

function setColoringMode(mode: string) {
    const modes = <NodeListOf<HTMLInputElement>>document.getElementsByName("coloring");
    for (let i = 0; i < modes.length; i++) {
        modes[i].checked = (modes[i].value === mode);
    }
    coloringChanged();
};

function findBasepairs() {
    elements.forEach(e => {
        if (e instanceof Nucleotide) {
            if(!e.pair) {
                e.pair = e.findPair();
                if(e.pair) {
                    e.pair.pair = e;
                }
            }
        }
    });
};

function cross(a1, a2, a3, b1, b2, b3) { //calculate cross product of 2 THREE.Vectors but takes coordinates as (x,y,z,x1,y1,z1)
    return [a2 * b3 - a3 * b2,
    a3 * b1 - a1 * b3,
    a1 * b2 - a2 * b1];
}

function det(mat:number[][]){ //calculate and return matrix's determinant
	return (mat[0][0] * ((mat[1][1]*mat[2][2]) - (mat[1][2]*mat[2][1]))  - mat[0][1] * ((mat[1][0]*mat[2][2]) -
		(mat[2][0]*mat[1][2])) + mat[0][2] * ((mat[1][0]*mat[2][1]) - (mat[2][0]*mat[1][1])));
}

function dot(x1:number,y1:number,z1:number,x2:number,y2:number,z2:number){ //calculate and return dot product of matrix given by list of vector positions
	return x1*x2 + y1*y2 + z1*z2;
}
function divAndNeg(mat:number[],divisor:number){ //divide a matrix by divisor; negate matrix
	return [-mat[0]/divisor, -mat[1]/divisor, -mat[2]/divisor];
}