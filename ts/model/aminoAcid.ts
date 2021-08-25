/**
 * Extends BasicElement with amino acid-specific properties such as the larger colormap to account for 20 types.
 * This class is incomplete and only supports visualization right now.  Editing will not work.
 */

class AminoAcid extends BasicElement {
    a1: THREE.Vector3;
    a3: THREE.Vector3;


    constructor(id: number, strand: Strand) {
        super(id, strand);
        this.a1 = new THREE.Vector3();
        this.a3 = new THREE.Vector3();
    };

    getA1() {
        return this.a1;
    }

    getA3() {
        return this.a3;
    }

    setPDBIndices(datasetindx, chainid, pdbresnum){
        this.pdbindices = [datasetindx, chainid, pdbresnum];
    };

    elemToColor(elem: number | string): THREE.Color {
        elem = { "K": 0, "C": 1, "A": 2, "T": 3, "E": 3, "S": 4, "D": 5, "N": 6, "Q": 7, "H": 8, "G": 10, "P": 11, "R": 12, "V": 13, "I": 14, "L": 15, "M": 16, "F": 17, "Y": 18, "W": 19 }[elem];
        if (elem == undefined) return GREY
        return nucleosideColors[elem];
    };

    calcPositionsFromConfLine(l: string[], colorUpdate?: boolean) {
        //extract position
        const p = new THREE.Vector3(
            parseFloat(l[0]),
            parseFloat(l[1]),
            parseFloat(l[2])
        );
        let a1 = new THREE.Vector3(parseFloat(l[3]), parseFloat(l[4]), parseFloat(l[5]));
        let a3 = new THREE.Vector3(parseFloat(l[6]), parseFloat(l[7]), parseFloat(l[8]));
        this.calcPositions(p, a1, a3, colorUpdate);
    }

    calcPositions(p: THREE.Vector3, a1?: THREE.Vector3, a3?: THREE.Vector3, colorUpdate?: boolean) {
        const sys = this.getSystem();
        let sid = this.sid;
        this.a1 = a1.clone();
        this.a3 = a3.clone();
        // compute backbone positions/rotations, or set them all to 0 if there is no neighbor.
        let sp: THREE.Vector3, spLen: number, spRotation: THREE.Quaternion;
        if (this.n3 && this.n3 != this.strand.end5) {
            let bbLast = this.n3.getInstanceParameter3('bbOffsets');
            sp = p.clone().add(bbLast).divideScalar(2);
            spLen = p.distanceTo(bbLast)

            spRotation = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                sp.clone().sub(p).normalize()
            );
        }
        else {
            sp = new THREE.Vector3();
            spLen = 0;
            spRotation = new THREE.Quaternion(0, 0, 0, 0);
        }

        this.handleCircularStrands(sys, sid, p);

        if (colorUpdate) {
            // determine the mesh color, either from a supplied colormap json or by the strand ID.
            const bbColor = this.strandToColor(this.strand.id);
            sys.fillVec('bbColors', 3, sid, [bbColor.r, bbColor.g, bbColor.b]);

            const nsColor = this.elemToColor(this.type);
            sys.fillVec('nsColors', 3, sid, [nsColor.r, nsColor.g, nsColor.b]);

            let idColor = new THREE.Color();
            idColor.setHex(this.id+1); //has to be +1 or you can't grab nucleotide 0
            sys.fillVec('bbLabels', 3, sid, [idColor.r, idColor.g, idColor.b]);
        }

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
        if(spLen == 0) {
            sys.fillVec('bbconScales', 3, sid, [0, 0, 0]);
        } else {
            sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);
        }
        sys.fillVec('visibility', 3, sid, [1,1,1]);
    };

    translatePosition(amount: THREE.Vector3) {
        const sys = this.getSystem(),
            id = (this.sid)*3;

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
            sid = this.sid;
        if (this.dummySys !== null) {
            sys = this.dummySys;
        }
        let bbColor: THREE.Color;
        let aaColor: THREE.Color;

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
            case "Custom":
                if (!this.color) {
                    // Use overlay color if overlay is loaded, otherwise color gray
                    if(lut) {
                        bbColor = sys.lutCols[sid];
                        aaColor = sys.lutCols[sid];
                    } else {
                        bbColor = GREY;
                        aaColor = GREY;
                    }
                } else {
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
    };

    extendStrand(len, direction){

    }

    isAminoAcid() {
        return true;
    }

    getTypeNumber(): number {
        let c = this.type;
        let i = ['X', 'A', 'R', 'N', 'D', 'C', 
                'E', 'Q', 'G', 'H', 'I', 
                'L', 'K', 'M', 'F', 
                'P', 'S', 'T', 'W', 
                'Y', 'V', 'Z'].indexOf(c);
        if (i>=0) {
            return -i;
        } else {
            return parseInt(c);
        }
    }

    toJSON() {
        // Get superclass attributes
        let json = super.toJSON();

        json['class'] = 'AA';
        return json;
    }
};