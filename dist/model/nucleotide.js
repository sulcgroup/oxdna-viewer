/**
 * extends BasicElement with nucleotide properties.  This mostly involves any function that takes orientation into account.
 * This also specifies the visual structure of a nucleotide.
 */
class Nucleotide extends BasicElement {
    constructor(id, strand) {
        super(id, strand);
    }
    ;
    calcPositionsFromConfLine(l, colorUpdate) {
        //extract position
        let p = new THREE.Vector3(parseFloat(l[0]), parseFloat(l[1]), parseFloat(l[2]));
        // extract axis vector a1 (backbone vector) and a3 (stacking vector) 
        let a1 = new THREE.Vector3(parseFloat(l[3]), parseFloat(l[4]), parseFloat(l[5]));
        let a3 = new THREE.Vector3(parseFloat(l[6]), parseFloat(l[7]), parseFloat(l[8]));
        this.calcPositions(p, a1, a3, colorUpdate);
    }
    ;
    calcPositions(p, a1, a3, colorUpdate) {
        let sys = this.getSystem(), sid = this.sid;
        if (this.dummySys !== null) {
            sys = this.dummySys;
        }
        // according to base.py a2 is the cross of a1 and a3
        let a2 = a1.clone().cross(a3);
        // compute backbone position
        let bb = this.calcBBPos(p, a1, a2, a3);
        // compute nucleoside cm
        let ns = new THREE.Vector3(p.x + 0.4 * a1.x, p.y + 0.4 * a1.y, p.z + 0.4 * a1.z);
        // compute nucleoside rotation
        const baseRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), a3);
        //compute connector position
        const con = bb.clone().add(ns).divideScalar(2);
        // compute connector rotation
        const rotationCon = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), con.clone().sub(ns).normalize());
        // compute connector length
        let conLen = this.bbnsDist;
        if (a1.length() == 0 && a2.length() == 0) {
            conLen = 0;
        }
        // compute sugar-phosphate positions/rotations, or set them all to 0 if there is no sugar-phosphate.
        let sp, spLen, spRotation;
        if (this.n3) {
            let bbLast = this.n3.getInstanceParameter3('bbOffsets');
            sp = bb.clone().add(bbLast).divideScalar(2);
            spLen = bb.distanceTo(bbLast);
            //introduce distance based cutoff of the backbone connectors
            if (spLen >= box.x * .9 || spLen >= box.y * .9 || spLen >= box.z * .9)
                spLen = 0;
            spRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), sp.clone().sub(bb).normalize());
        }
        else {
            sp = new THREE.Vector3();
            spLen = 0;
            spRotation = new THREE.Quaternion(0, 0, 0, 0);
        }
        this.handleCircularStrands(sys, sid, bb);
        if (colorUpdate) {
            // determine the mesh color, either from a supplied colormap json or by the strand ID.
            const bbColor = this.strandToColor(this.strand.id);
            sys.fillVec('bbColors', 3, sid, [bbColor.r, bbColor.g, bbColor.b]);
            const nsColor = this.elemToColor(this.type);
            sys.fillVec('nsColors', 3, sid, [nsColor.r, nsColor.g, nsColor.b]);
            let idColor = new THREE.Color();
            idColor.setHex(this.id + 1); //has to be +1 or you can't grab nucleotide 0
            sys.fillVec('bbLabels', 3, sid, [idColor.r, idColor.g, idColor.b]);
        }
        //fill the instance matrices with data
        sys.fillVec('cmOffsets', 3, sid, p.toArray());
        sys.fillVec('bbOffsets', 3, sid, bb.toArray());
        sys.fillVec('nsOffsets', 3, sid, ns.toArray());
        sys.fillVec('nsRotation', 4, sid, [baseRotation.w, baseRotation.z, baseRotation.y, baseRotation.x]);
        sys.fillVec('conOffsets', 3, sid, con.toArray());
        sys.fillVec('conRotation', 4, sid, [rotationCon.w, rotationCon.z, rotationCon.y, rotationCon.x]);
        sys.fillVec('bbconOffsets', 3, sid, sp.toArray());
        sys.fillVec('bbconRotation', 4, sid, [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
        sys.fillVec('scales', 3, sid, [1, 1, 1]);
        sys.fillVec('nsScales', 3, sid, [0.7, 0.3, 0.7]);
        sys.fillVec('conScales', 3, sid, [1, conLen, 1]);
        if (spLen == 0) {
            sys.fillVec('bbconScales', 3, sid, [0, 0, 0]);
        }
        else {
            sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);
        }
        sys.fillVec('visibility', 3, sid, [1, 1, 1]);
    }
    ;
    translatePosition(amount) {
        let sys = this.getSystem();
        let sid = this.sid;
        if (this.dummySys !== null) {
            sys = this.dummySys;
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
    calcBBPos(p, a1, a2, a3) {
        return p.clone();
    }
    ;
    updateColor() {
        let sys = this.getSystem(), sid = this.sid;
        if (this.dummySys !== null) {
            sys = this.dummySys;
        }
        let color;
        switch (view.coloringMode.get()) {
            case "Strand":
                color = backboneColors[(Math.abs(this.strand.id) + this.getSystem().id) % backboneColors.length];
                break;
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
                color = sys.lutCols[sid];
                break;
            case "Custom":
                if (!this.color) {
                    // Use overlay color if overlay is loaded, otherwise color gray
                    if (lut) {
                        color = sys.lutCols[sid];
                    }
                    else {
                        color = GREY;
                    }
                }
                else {
                    color = this.color;
                }
                break;
        }
        if (selectedBases.has(this)) {
            color = color.clone().lerp(selectionColor, 0.6).multiplyScalar(2);
        }
        sys.fillVec('bbColors', 3, sid, [color.r, color.g, color.b]);
    }
    elemToColor(elem) {
        elem = { "A": 0, "G": 1, "C": 2, "T": 3, "U": 3 }[elem];
        if (elem == undefined) {
            return GREY;
        }
        return nucleosideColors[elem];
    }
    ;
    getTypeNumber() {
        let c = this.type;
        if (c == 'U') {
            c = 'T';
        }
        let i = ['A', 'G', 'C', 'T'].indexOf(c);
        if (i >= 0) {
            return i;
        }
        else {
            return parseInt(c);
        }
    }
    findPair() {
        let bestCandidate = null;
        let bestDist = 0.6;
        let thisPos = this.getInstanceParameter3("nsOffsets");
        let sys = this.getSystem();
        let strandCount = sys.strands.length;
        for (let i = 0; i < strandCount; i++) { //for every strand in the System
            let strand = sys.strands[i];
            if (strand.isNucleicAcid()) {
                strand.forEach((e) => {
                    if (this.n3 != e && this.n5 != e &&
                        this.getTypeNumber() != e.getTypeNumber() &&
                        (this.getTypeNumber() + e.getTypeNumber()) % 3 == 0) {
                        //check distance
                        let dist = e.getInstanceParameter3("nsOffsets").distanceTo(thisPos);
                        if (dist < bestDist) {
                            //check orientation
                            let orient = e.getA1().dot(this.getA1());
                            if (orient < -0.85) {
                                bestCandidate = e;
                                bestDist = dist;
                            }
                        }
                    }
                });
            }
        }
        return bestCandidate;
    }
    isPaired() {
        return this.pair ? true : false;
    }
    typeOptions(type) {
        // https://www.megasoftware.net/web_help_7/rh_iupac_single_letter_codes.htm
        const wp = this.weakPyrimindine;
        switch (type) {
            case 'R': return ['A', 'G']; // Purine
            case 'Y': return ['C', wp()]; // Pyrimindine
            case 'M': return ['A', 'C'];
            case 'K': return ['G', wp()];
            case 'S': return ['C', 'G']; // String
            case 'W': return ['A', wp()]; // Weak
            case 'H': return ['A', 'C', wp()]; // Not G
            case 'B': return ['C', 'G', wp()]; // Not A
            case 'V': return ['A', 'C', 'G']; // Not U/T
            case 'D': return ['A', 'G', wp()]; // Not C
            case 'N': return ['A', 'C', 'G', wp()]; // Ambiguous
            default: return [type];
        }
    }
    setType(type) {
        this.type = randomChoice(this.typeOptions(type));
    }
    isType(type) {
        if (type === this.type) {
            return true;
        }
        else {
            // We could skip the previous check and run this directly,
            // but it is quicker to first check for equality since that
            // is the most common.
            return this.typeOptions(type).includes(this.type);
        }
    }
    isNucleotide() {
        return true;
    }
    getA1() {
        const cm = this.getPos();
        const ns = this.getInstanceParameter3("nsOffsets");
        return ns.clone().sub(cm).divideScalar(0.4).normalize();
    }
    toJSON() {
        // Get superclass attributes
        let json = super.toJSON();
        if (this.isPaired())
            json['bp'] = this['pair'].id;
        json['class'] = 'nucleotide';
        return json;
    }
}
;
