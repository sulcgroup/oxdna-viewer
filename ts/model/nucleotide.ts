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
        let sys = this.getSystem();
        let sid = this.gid - sys.globalStartId;

        if (this.dummySys) {
            sys = this.dummySys
            sid = this.sid;
        }
        //extract position
        let p = new THREE.Vector3(
            parseFloat(l[0]),
            parseFloat(l[1]),
            parseFloat(l[2])
        );

        // extract axis vector a1 (backbone vector) and a3 (stacking vector) 
        let a1 = new THREE.Vector3(
            parseFloat(l[3]),
            parseFloat(l[4]),
            parseFloat(l[5])
        );
        let a3 = new THREE.Vector3(
            parseFloat(l[6]),
            parseFloat(l[7]),
            parseFloat(l[8])
        );
        this.calcPositionsFromVectors(p, a1, a3)
    };

    calcPositionsFromVectors(p: THREE.Vector3, a1: THREE.Vector3, a3: THREE.Vector3) {
        let sys = this.getSystem(),
            sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys
            sid = this.sid;
        }
        // according to base.py a2 is the cross of a1 and a3
        let a2 = a1.clone().cross(a3);
        
        // compute backbone position
        let bb = this.calcBBPos(p, a1, a2, a3);

        // compute nucleoside cm
        let ns = new THREE.Vector3(
            p.x + 0.4 * a1.x,
            p.y + 0.4 * a1.y,
            p.z + 0.4 * a1.z
        )

        // compute nucleoside rotation
        const baseRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0),a3);

        //compute connector position
        const con = bb.clone().add(ns).divideScalar(2);

        // compute connector rotation
        const rotationCon = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            con.clone().sub(ns).normalize());
        
        // compute connector length
        let conLen = this.bbnsDist;
        if (a1.length() == 0 && a2.length() == 0) {
                conLen = 0;
        }

        // compute sugar-phosphate positions/rotations, or set them all to 0 if there is no sugar-phosphate.
        let sp: THREE.Vector3, spLen: number, spRotation;
        if (this.neighbor3 != null && (this.neighbor3.lid < this.lid || this.dummySys !== null)) {
            sp = new THREE.Vector3(
                (bb.x + bbLast.x) / 2,
                (bb.y + bbLast.y) / 2,
                (bb.z + bbLast.z) / 2
            );

            spLen = bb.distanceTo(bbLast);
        
            spRotation = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0), sp.clone().sub(bb).normalize()
            );
        }
        else {
            sp = new THREE.Vector3();
            spLen = 0;
            spRotation = new THREE.Quaternion(0, 0, 0, 0);
        }

        this.handleCircularStrands(sys, sid, bb);

        // determine the mesh color, either from a supplied colormap json or by the strand ID.
        let color = new THREE.Color;
        color = this.strandToColor(this.strand.strandID);

        let idColor = new THREE.Color();
        idColor.setHex(this.gid+1); //has to be +1 or you can't grab nucleotide 0

        //fill the instance matrices with data
        sys.fillVec('cmOffsets', 3, sid, p.toArray());
        sys.fillVec('bbOffsets', 3, sid, bb.toArray());
        sys.fillVec('nsOffsets', 3, sid, ns.toArray());
        sys.fillVec('nsOffsets', 3, sid, ns.toArray());
        sys.fillVec('nsRotation', 4, sid, [baseRotation.w, baseRotation.z, baseRotation.y, baseRotation.x]);
        sys.fillVec('conOffsets', 3, sid, con.toArray());
        sys.fillVec('conRotation', 4, sid, [rotationCon.w, rotationCon.z, rotationCon.y, rotationCon.x]);
        sys.fillVec('bbconOffsets', 3, sid, sp.toArray());
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
        bbLast = bb;
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
    calcBBPos(p: THREE.Vector3, a1: THREE.Vector3, a2: THREE.Vector3, a3: THREE.Vector3): THREE.Vector3 {
        return p.clone();
    };

    calculateNewConfigPositions(l: string[]) {
        let sys = this.getSystem(),
            sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys
            sid = this.sid;
        }

        //extract position
        const p = new THREE.Vector3(
            parseFloat(l[0]),
            parseFloat(l[1]),
            parseFloat(l[2])
        );

        // extract axis vector a1 (backbone vector) and a3 (stacking vector)
        const a1 = new THREE.Vector3(
            parseFloat(l[3]),
            parseFloat(l[4]),
            parseFloat(l[5])
        );
        const a3 = new THREE.Vector3(
            parseFloat(l[6]),
            parseFloat(l[7]),
            parseFloat(l[8])
        );

        // a2 is perpendicular to a1 and a3
        const a2 = a1.clone().cross(a3);

        // compute backbone cm
        const bb = this.calcBBPos(p, a1, a2, a3);

        // compute nucleoside cm
        const ns = new THREE.Vector3(
            p.x + 0.4 * a1.x,
            p.y + 0.4 * a1.y,
            p.z + 0.4 * a1.z
        );

        //compute connector position
        const con = bb.clone().add(ns).divideScalar(2);

        //correctly display stacking interactions
        const baseRotation = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), a3);

        // compute connector rotation
        const rotationCon = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            bb.clone().sub(ns).normalize());

        // compute sugar-phosphate positions/rotations, or set them all to 0 if there is no sugar-phosphate.
        let sp: THREE.Vector3, spLen:number, spRotation: THREE.Quaternion;
        if (this.neighbor3 != null && this.neighbor3.lid < this.lid) {
            sp = bb.clone().add(bbLast).divideScalar(2);
            spLen = bb.distanceTo(bbLast);
        
            spRotation = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                sp.clone().sub(bb).normalize()
            );
        }
        else {
            sp = new THREE.Vector3()
            spLen = 0;
            spRotation = new THREE.Quaternion(0, 0, 0, 0);
        }

        this.handleCircularStrands(sys, sid, bb);

        //update the relevant instancing matrices
        sys.fillVec('cmOffsets', 3, sid, p.toArray());
        sys.fillVec('bbOffsets', 3, sid, bb.toArray());
        sys.fillVec('nsOffsets', 3, sid, ns.toArray());
        sys.fillVec('nsRotation', 4, sid, [baseRotation.w, baseRotation.z, baseRotation.y, baseRotation.x]);
        sys.fillVec('conOffsets', 3, sid, con.toArray());
        sys.fillVec('conRotation', 4, sid, [rotationCon.w, rotationCon.z, rotationCon.y, rotationCon.x]);
        sys.fillVec('bbconOffsets', 3, sid, sp.toArray());
        sys.fillVec('bbconRotation', 4, sid, [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
        if(spLen == 0) {
            sys.fillVec('bbconScales', 3, sid, [0, 0, 0]);
        } else {
            sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);
        }


        // keep track of last backbone for sugar-phosphate positioning
        bbLast = bb.clone();
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
        let tempVec = this.getPos(); //nucleotide's center of mass in world
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
        const a3: THREE.Vector3 = this.getA3();
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

    getA1 () {
        const cm = this.getPos();
        const ns = this.getInstanceParameter3("nsOffsets");
        return ns.clone().sub(cm).divideScalar(0.4);
    }

    abstract getA2(): THREE.Vector3;
    abstract getA3(): THREE.Vector3;

    abstract extendStrand(len, direction, double);

    toJSON() {
        // Get superclass attributes
        let json = super.toJSON();

        if (this.isPaired()) json['bp'] = this['pair'].gid;
        json['class'] = 'nucleotide';
        return json;
    }
};