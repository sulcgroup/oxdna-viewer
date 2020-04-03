/**
 * Defines a collection of linearly connected BasicElements.
 * Is extended by NuclicAcidStrand and Peptide.
 * @param strandID - The strand's id within the system
 * @param system - The strand's parent system
 */
class Strand {
    constructor(id, system) {
        this.monomers = [];
        this.strandID = id;
        this.system = system;
        this.circular = false;
    }
    ;
    addBasicElement(elem) {
        this.monomers.push(elem);
        elem.strand = this;
    }
    ;
    createBasicElement(gid) {
        throw "Cannot create a basic element, need to be a nucleotide, amino acid, etc.";
    }
    excludeElements(elements) {
        // detach from strand
        elements.forEach(e => {
            e.strand = null;
        });
        // create a new list of strand elements  
        this.monomers = this.monomers.filter(e => {
            return !elements.includes(e);
        });
    }
    ;
    toggleMonomers() {
        this.monomers.forEach(e => e.toggle());
    }
    isEmpty() {
        return this.monomers.length == 0;
    }
    getCom() {
        const com = new THREE.Vector3(0, 0, 0);
        const l = this.monomers.length;
        const cmOffs = this.system.cmOffsets;
        for (let i = (this.monomers[0].gid - this.system.globalStartId) * 3; i <= (this.monomers[l - 1].gid - this.system.globalStartId) * 3; i += 3) {
            com.add(new THREE.Vector3(cmOffs[i], cmOffs[i + 1], cmOffs[i + 2]));
        }
        return (com.multiplyScalar(1 / l));
    }
    ;
    toJSON() {
        // Specify required attributes
        let json = {
            id: this.strandID,
            monomers: this.monomers
        };
        // Specify optional attributes
        if (this.label)
            json['label'] = this.label;
        return json;
    }
    ;
    //this is so dirty...
    getType() {
        return this.__proto__.constructor.name;
    }
}
;
class NucleicAcidStrand extends Strand {
    constructor(id, system) {
        super(id, system);
    }
    ;
    createBasicElement(gid) {
        if (RNA_MODE)
            return new RNANucleotide(gid, this);
        else
            return new DNANucleotide(gid, this);
    }
    ;
    translateStrand(amount) {
        const s = this.system;
        for (let i = (this.monomers[0].gid - s.globalStartId) * 3; i <= (this.monomers[this.monomers.length - 1].gid - s.globalStartId) * 3; i += 3) {
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
        s.callUpdates(['instanceOffset']);
        if (tmpSystems.length > 0) {
            tmpSystems.forEach((s) => {
                s.callUpdates(['instanceOffset']);
            });
        }
    }
}
class Peptide extends Strand {
    constructor(id, system) {
        super(id, system);
    }
    ;
    createBasicElement(gid) {
        return new AminoAcid(gid, this);
    }
    ;
    translateStrand(amount) {
        const s = this.system;
        for (let i = (this.monomers[0].gid - s.globalStartId) * 3; i <= (this.monomers[this.monomers.length - 1].gid - s.globalStartId) * 3; i += 3) {
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
        s.callUpdates(['instanceOffset']);
        if (tmpSystems.length > 0) {
            tmpSystems.forEach((s) => {
                s.callUpdates(['instanceOffset']);
            });
        }
    }
    ;
}
