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
        elem = { "R": 0, "H": 1, "K": 2, "D": 3, "E": 3, "S": 4, "T": 5, "N": 6, "Q": 7, "C": 8, "U": 9, "G": 10, "P": 11, "A": 12, "V": 13, "I": 14, "L": 15, "M": 16, "F": 17, "Y": 18, "W": 19 }[elem];
        if (elem == undefined)
            return GREY;
        return nucleosideColors[elem];
    }
    ;
    calculatePositions(l) {
        const sys = this.getSystem(), sid = this.gid - sys.globalStartId;
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
        color = this.strandToColor(this.strand.strandID);
        let idColor = new THREE.Color();
        idColor.setHex(this.gid + 1); //has to be +1 or you can't grab nucleotide 0
        // fill in the instancing matrices
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
        const sys = this.getSystem(), sid = this.gid - sys.globalStartId;
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
    toJSON() {
        // Get superclass attributes
        let json = super.toJSON();
        json['class'] = 'AA';
        return json;
    }
}
;
