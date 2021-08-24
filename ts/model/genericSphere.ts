/**
 * Extends BasicElement with amino acid-specific properties such as the larger colormap to account for 20 types.
 * This class is incomplete and only supports visualization right now.  Editing will not work.
 */
class GenericSphere extends BasicElement {
    mass:number;
    constructor(id: number, strand: Strand) {
        super(id, strand);
        this.mass = 1.0;
        this.type = 'gs';
    }
    ;
    elemToColor(elem: number | string) {
        return GREY;
    }
    ;
    calcPositionsFromConfLine(l: string[]) {
        //extract position
        const p = new THREE.Vector3(parseFloat(l[0]), parseFloat(l[1]), parseFloat(l[2]));
        this.calcPositions(p);
    }
    calcPositions(p: THREE.Vector3) { //mass Parameter should be set prior to calling this
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
        let scale;
        if(this.mass > 4){ //More than 4 particles
            scale = 1+this.mass/16;
        } else {
            scale = 1;
        }

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
    ;
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
                    } else {
                        bbColor = GREY;
                    }
                }
                else {
                    bbColor = this.color;
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
        return new THREE.Vector3(1,1,0);
    }

    getA3() {
        return new THREE.Vector3(0,0,-1);
    }

    extendStrand(len, direction) {
    }
    isAminoAcid() {
        return false;
    }
    ;
    isGS(){
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