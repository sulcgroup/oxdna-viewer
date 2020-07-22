/**
 * Defines a collection of linearly connected BasicElements.  
 * Is extended by NuclicAcidStrand and Peptide.
 * @param strandID - The strand's id within the system
 * @param system - The strand's parent system
 */

abstract class Strand {

    id: number; //system location
    system: System;
    pos: THREE.Vector3;
    label: string;
    end3: BasicElement;
    end5: BasicElement;


    constructor(id: number, system: System) {
        this.id = id;
        this.system = system;
    };

    isCircular() {
        return this.end3.n3 != null && this.end3.n3 == this.end5;
    }

    createBasicElement(id?: number): BasicElement {
        throw "Cannot create a basic element, need to be a nucleotide, amino acid, etc.";
    }

    getSequence() {
        return this.map(e=>e.type).join('');
    }

    getLength() {
        let e = this.end3;
        let i = 0;
        while(e) {
            e = e.n5;
            i++;
            if(e === this.end3) break;
        }
        return i;
    }

    updateEnds() {
        let start = this.end3;
        while(this.end3.n3 && this.end3.n3 != this.end5) {
            this.end3 = this.end3.n3;
            // Avoid infinite loop on circular strand
            if (this.end3 == start) {
                this.end5 = this.end3.n3;
                return;
            }
        };
        start = this.end5;
        while(this.end5.n5  && this.end3.n5 != this.end3) {
            this.end5 = this.end5.n5;
            // Avoid infinite loop on circular strand
            if (this.end5 == start) {
                this.end3 = this.end5.n5;
                return;
            }
        };
    }

    /**
     * Return a list of all monomers in strand, in 5' to 3' order
     * @param reverse If set to true, return list in 3' to 5' order instead
     */
    getMonomers(reverse?:boolean): BasicElement[] {
        return this.map(e=>e, reverse);
    }

    /**
     * Performs the specified action for each element in an array.
     * @param callbackfn A function that accepts up to two arguments
     * @param reverse Iterate in 3' to 5' direction, instead of the default 5' to 3'
     * @param condition If provided, only continue looping while condition is true
     */
    forEach(callbackfn: (value: BasicElement, index: number)=>void, reverse?:boolean, condition?: (value: BasicElement, index: number)=>boolean) {
        const start = reverse ? this.end3 : this.end5;
        let e = start;
        let i = 0;
        while(e && (!condition || condition(e,i))) {
            callbackfn(e, i);
            e = reverse ? e.n5 : e.n3;
            i++;
            if(e === start) break;
        }
    }

    /**
     * Calls a defined callback function on each monomer of the strand, and returns an array that contains the results
     * @param callbackfn A function that accepts up to two arguments
     * @param reverse Iterate in 3' to 5' direction, instead of the default 5' to 3'
     */
    map(callbackfn: (value: BasicElement, index: number)=>void, reverse?:boolean) {
        let list = [];
        this.forEach((e,i)=>{list.push(callbackfn(e, i))}, reverse);
        return list;
    }

    /**
     * Returns the monomers of the strand that meet the condition specified in a callback function.
     * @param callbackfn — A function that accepts up to two arguments, returning a boolean
     * @param reverse Retur filtered list in 3' to 5' direction, instead of the default 5' to 3'
     */
    filter(callbackfn: (value: BasicElement, index: number)=>boolean, reverse?:boolean) {
        let list = [];
        this.forEach((e,i)=>{
            if(callbackfn(e,i)){
                list.push(e);
            }
        }, reverse);
        return list;
    }

    toggleMonomers() {
        this.forEach(e=>e.toggle());
    }

    select() {
        this.forEach(e=>e.select());
    }

    deselect() {
        this.forEach(e=>e.deselect());
    }

    isEmpty(): Boolean {
        //console.assert(this.end3 ? true : !this.end5, "Stand incorrectly empty");
        return !this.end3 && !this.end5;
    }

    getPos() {
        let com = new THREE.Vector3();
        let length = 0;
        this.forEach(e=>{
            com.add(e.getPos());
            length ++;
        })
        return com.divideScalar(length);
    };

    abstract translateStrand(amount: THREE.Vector3): void;

    isPeptide(): boolean{
        return false;
    }

    isNucleicAcid(): boolean {
        return false;
    }

    toJSON() {
        // Specify required attributes
        let json = {
            id: this.id,
            monomers: this.getMonomers(),
            end3: this.end3,
            end5: this.end5
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

    createBasicElement(id?: number) {
        if (RNA_MODE)
            return new RNANucleotide(id, this);
        else
            return new DNANucleotide(id, this);
    };

    translateStrand(amount: THREE.Vector3) {
        const s = this.system;
        const monomers = this.getMonomers();
        for (
            let i = ((monomers[0] as Nucleotide).id - s.globalStartId) * 3;
            i <= ((monomers[monomers.length-1] as Nucleotide).id - s.globalStartId) * 3;
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
    isNucleicAcid(): boolean {
        return true;
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

    createBasicElement(id?: number) {
        return new AminoAcid(id, this);
    };

    translateStrand(amount: THREE.Vector3) {
        const s = this.system;
        const monomers = this.getMonomers();
        for (
            let i = ((monomers[0] as AminoAcid).id - s.globalStartId) * 3;
            i <= ((monomers[monomers.length-1] as AminoAcid).id - s.globalStartId) * 3;
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

    isPeptide(): boolean{
        return true;
    }

    toJSON() {
        // Get superclass attributes
        let json = super.toJSON();
        json['class'] = 'Peptide';
        return json;
    };
}