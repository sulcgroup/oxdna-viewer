/**
 * extends BasicElement with nucleotide properties.  This mostly involves any function that takes orientation into account.
 * This also specifies the visual structure of a nucleotide.
 */

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
            switch (view.coloringMode.get()) {
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
        // Get the dummy system if it exists, otherwise get the real system
        let sys = this.getSystem();
        let sid = this.gid - sys.globalStartId
        if (this.dummySys) {
            sys = this.dummySys
            sid = this.sid;
        }
        let newC = this.elemToColor(type);
        sys.fillVec('nsColors', 3, sid, [newC.r, newC.g, newC.b])
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

    extendStrand(len, direction, double){
    }

    toJSON() {
        // Get superclass attributes
        let json = super.toJSON();

        if (this.isPaired()) json['bp'] = this['pair'].gid;
        json['class'] = 'nucleotide';
        return json;
    }
};