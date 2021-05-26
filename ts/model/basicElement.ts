/**
 * The abstract class that all drawn monomers inherit from
 * @param id - The global id of the element.  Also its key in the elements map
 * @param strand - The parent Strand of the monomer
 * @param dummySys - If created during editing, the data arrays for instancing are stored in a dummy system
 */

abstract class BasicElement {
    id: number; //location in world - all systems
    sid: number; //in-system ID, only used if in a temporary system
    label: string;
    n3: BasicElement | null;
    n5: BasicElement | null;
    connections: BasicElement[] = []; // ref all elements it's
    strand: Strand;
    bbnsDist : number;
    type: string; // Base as string
    clusterId: number;
    dummySys: System;
    color: THREE.Color;
    // pdbid: string; //Only Intialized if loaded from a PDB structure

    constructor(id: number, strand: Strand) {
        this.id = id;
        this.strand = strand;
        if (strand && strand.isEmpty()) {
            strand.setFrom(this);
        }
        this.dummySys = null;
    };

    abstract calcPositions(p: THREE.Vector3, a1?: THREE.Vector3, a3?: THREE.Vector3, colorUpdate?: boolean)
    abstract calcPositionsFromConfLine(l: string[], colorUpdate?: boolean): void;
    abstract updateColor(): void;
    //abstract setPosition(newPos: THREE.Vector3): void; 
    abstract getDatFileOutput(): string; 
    abstract extendStrand(len, direction, double): void;
    abstract translatePosition(amount: THREE.Vector3): void;
    //abstract rotate(quat: THREE.Quaternion): void;

    // highlight/remove highlight the bases we've clicked from the list and modify color
    toggle(supressEvent?: boolean) {
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
        this.updateColor();
    }

    updateSP(num: number): THREE.Object3D {
        return new THREE.Object3D();
    };
    
    getSystem(): System {
        return this.strand.system;
    }

    strandToColor(strandIndex: number) {
        return backboneColors[(Math.abs(strandIndex) + this.getSystem().id) % backboneColors.length];
    };

    elemToColor(type: number | string): THREE.Color {
        return new THREE.Color();
    };

    isPaired() {
        return false;
    }

    changeType(type: string) {
        this.type = type;
        // Get the dummy system if it exists, otherwise get the real system
        let sys = this.getSystem();
        if (this.dummySys) {
            sys = this.dummySys
        }
        let newC = this.elemToColor(type);
        sys.fillVec('nsColors', 3, this.sid, [newC.r, newC.g, newC.b])
    }

    //retrieve this element's values in a 3-parameter instance array
    //positions, scales, colors
    getInstanceParameter3(name: string) {
        let sys = this.getSystem(),
            sid = this.sid;
        if (this.dummySys !== null) {
            sys = this.dummySys;
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
            sid = this.sid;
        if (this.dummySys !== null) {
            sys = this.dummySys;
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
        let sys = this.getSystem();
        if (this.dummySys !== null) {
            sys = this.dummySys;
        } 
        sys.fillVec(name, data.length, this.sid, data);
    }

    //poof
    toggleVisibility() {
        let sys = this.getSystem();
        if (this.dummySys !== null) {
            sys = this.dummySys;
        }

        const visibility = this.getInstanceParameter3('visibility');
        visibility.addScalar(-1);

        sys.fillVec('visibility', 3, this.sid, [Math.abs(visibility.x), Math.abs(visibility.y), Math.abs(visibility.z)]);
    }

    handleCircularStrands(sys: System, sid: number, bb: THREE.Vector3) {
        if (this.n5 == this.strand.end5 && this.strand.isCircular()) { //handle circular strands
            const bbLast = new THREE.Vector3(
                sys.bbOffsets[this.n5.id * 3],
                sys.bbOffsets[this.n5.id * 3 + 1],
                sys.bbOffsets[this.n5.id * 3 + 2]
            );

            const sp = bb.clone().add(bbLast).divideScalar(2);
            const spLen = bb.distanceTo(bbLast);

            const spRotation = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                sp.clone().sub(bb).normalize()
            );

            const sid5 = this.n5.sid;

            sys.fillVec('bbconOffsets', 3, sid5, sp.toArray());
            sys.fillVec('bbconRotation', 4, sid5, [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
            sys.fillVec('bbconScales', 3, sid5, [1, spLen, 1]);
        }
    }

    // Get center of mass position
    getPos(): THREE.Vector3 {
        return this.getInstanceParameter3('cmOffsets');
    }

    isAminoAcid() {
        return false;
    }

    isGS() {
        return false;
    }

    toJSON() {
        // Specify required attributes
        let json = {
            id: this.id,
            type: this.type,
            class: 'monomer',
            p: this.getPos().toArray()
        };
        // Specify optional attributes
        if (this.n3) json['n3'] = this.n3.id;
        if (this.n5) json['n5'] = this.n5.id;
        if (this.label) json['label'] = this.label;
        if (this.clusterId) json['cluster'] = this.clusterId;
        if (this.color) json['color'] = this.color.getHex();

        return json;
    }

    getTypeNumber(): number {
        return 0;
    }
};