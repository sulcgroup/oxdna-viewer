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

    addMonomer(elem: BasicElement) {
        this.monomers.push(elem);
        elem.strand = this;
    };

    createBasicElement(gid?: number): BasicElement {
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

    get3prime(): Nucleotide {
        let start = this.monomers[0];
        let i = start;
        // Rewind until to 3' end or back to start (if circular)
        while (i.neighbor3) {
            if (i.neighbor3 === start) {
                // Back to start, circular
                this.circular = true;
                return start as Nucleotide;
            }
            i = i.neighbor3;
        }
        return i as Nucleotide;
    }

    get5prime(): Nucleotide {
        let start = this.monomers[this.monomers.length];
        let i = start;
        // Rewind until to 5' end or back to start (if circular)
        while (i.neighbor5) {
            if (i.neighbor5 === start) {
                // Back to start, circular
                this.circular = true;
                return start as Nucleotide;
            }
            i = i.neighbor5;
        }
        return i as Nucleotide;
    }

    getOrderedMonomers(): Nucleotide[] {
        let ordered = [];
        let start = this.get3prime();
        let i = start;
        while(i) {
            ordered.push(i);
            i = i.neighbor5 as Nucleotide;
            if(i === start) {
                break;
            }
        }
        console.assert(ordered.length == this.monomers.length);
        return ordered;
    }

    toggleMonomers() {
        this.monomers.forEach(e=>e.toggle());
    }

    select() {
        this.monomers.forEach(e=>e.select());
    }

    deselect() {
        this.monomers.forEach(e=>e.deselect());
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

    //this is so dirty...
    getType() {
        return (this as any).__proto__.constructor.name
    }
};

class NucleicAcidStrand extends Strand {
    constructor(id: number, system: System) {
        super(id, system);
    };

    createBasicElement(gid?: number) {
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
    toJSON() {
        // Get superclass attributes
        let json = super.toJSON();
        json['class'] = 'NucleicAcidStrand';
        return json;
    };
}
class Peptide extends Strand {
    constructor(id: number, system: System) {
        super(id, system);
    };

    createBasicElement(gid?: number) {
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
    toJSON() {
        // Get superclass attributes
        let json = super.toJSON();
        json['class'] = 'Peptide';
        return json;
    };
}