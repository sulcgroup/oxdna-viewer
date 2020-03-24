/**
 * Defines a collection of linearly connected BasicElements.  
 * Is extended by NuclicAcidStrand and Peptide.
 * @param strandID - The strand's id within the system
 * @param system - The strand's parent system
 */

abstract class Strand {

    strandID: number; //system location
    system: System;
    pos: THREE.Vector3;
    circular: boolean;
    monomers: BasicElement[] = [];
    label: string;

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

    toJSON() {
        // Specify required attributes
        let json = {
            id: this.strandID,
            monomers: this.monomers
        };
        // Specify optional attributes
        if (this.label) json['label'] = this.label;

        return json;
    };
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