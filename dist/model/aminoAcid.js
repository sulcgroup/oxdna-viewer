/**
 * Extends BasicElement with amino acid-specific properties such as the larger colormap to account for 20 types.
 * This class is incomplete and only supports visualization right now.  Editing will not work.
 */
class AminoAcid extends BasicElement {
    constructor(gid, strand) {
        super(gid, strand);
        this.elementType = AA;
    }
    ;
    elemToColor(elem) {
        elem = { "K": 0, "C": 1, "A": 2, "T": 3, "E": 3, "S": 4, "D": 5, "N": 6, "Q": 7, "H": 8, "G": 10, "P": 11, "R": 12, "V": 13, "I": 14, "L": 15, "M": 16, "F": 17, "Y": 18, "W": 19 }[elem];
        if (elem == undefined)
            return GREY;
        return nucleosideColors[elem];
    }
    ;
    calcPositionsFromConfLine(l) {
        //extract position
        const p = new THREE.Vector3(parseFloat(l[0]), parseFloat(l[1]), parseFloat(l[2]));
        this.calcPositions(p);
    }
    calcPositions(p) {
        const sys = this.getSystem(), sid = this.gid - sys.globalStartId;
        // compute backbone positions/rotations, or set them all to 0 if there is no neighbor.
        let sp, spLen, spRotation;
        if (this.neighbor3 && this.neighbor3.lid < this.lid) {
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
        color = this.strandToColor(this.strand.strandID);
        let idColor = new THREE.Color();
        idColor.setHex(this.gid + 1); //has to be +1 or you can't grab nucleotide 0
        // fill in the instancing matrices
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
        bbLast = p.clone();
    }
    ;
    calculateNewConfigPositions(l) {
        const sys = this.getSystem(), sid = this.gid - sys.globalStartId;
        //extract position
        const p = new THREE.Vector3(parseFloat(l[0]), parseFloat(l[1]), parseFloat(l[2]));
        //calculate new backbone connector position/rotation
        let sp, spLen, spRotation;
        if (this.neighbor3 != null && this.neighbor3.lid < this.lid) {
            sp = new THREE.Vector3((p.x + xbbLast) / 2, (p.y + ybbLast) / 2, (p.z + zbbLast) / 2);
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
        if (spLen == 0) {
            sys.fillVec('bbconScales', 3, sid, [0, 0, 0]);
        }
        else {
            sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);
        }
        bbLast = p.clone();
    }
    ;
    translatePosition(amount) {
        const sys = this.getSystem(), id = (this.gid - sys.globalStartId) * 3;
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
        let sys = this.getSystem(), sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys;
            sid = this.sid;
        }
        let bbColor;
        let aaColor;
        if (selectedBases.has(this)) {
            bbColor = selectionColor;
            aaColor = selectionColor;
        }
        else {
            switch (view.coloringMode.get()) {
                case "Strand":
                    bbColor = backboneColors[(Math.abs(this.strand.strandID) + this.getSystem().systemID) % backboneColors.length];
                    aaColor = this.elemToColor(this.type);
                    break;
                case "System":
                    bbColor = backboneColors[this.getSystem().systemID % backboneColors.length];
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
    }
    ;
    getDatFileOutput() {
        let dat = "";
        const tempVec = this.getPos();
        const x = tempVec.x;
        const y = tempVec.y;
        const z = tempVec.z;
        dat = x + " " + y + " " + z + " 1.0 1.0 0.0 0.0 0.0 -1.0 0.0 0.0 0.0 0.0 0.0 0.0" + "\n"; //add all locations to dat file string
        return dat;
    }
    ;
    extendStrand(len, direction) {
    }
    isAminoAcid() {
        return true;
    }
    getTypeNumber() {
        let c = this.type;
        let i = ['X', 'A', 'R', 'N', 'D', 'C',
            'E', 'Q', 'G', 'H', 'I',
            'L', 'K', 'M', 'F',
            'P', 'S', 'T', 'W',
            'Y', 'V', 'Z'].indexOf(c);
        if (i >= 0) {
            return -i;
        }
        else {
            return parseInt(c);
        }
    }
    toJSON() {
        // Get superclass attributes
        let json = super.toJSON();
        json['class'] = 'AA';
        return json;
    }
}
;
