/**
 * A collection of strands that were loaded as a single file.
 * Systems contain all the data arrays that specify the properties of every monomer contained in their strands.
 * Data arrays are constant sized, so new particles added to the scene must be initialized in their own system.
 */
class System {
    constructor(id, startID) {
        this.strands = [];
        this.id = id;
        this.globalStartId = startID;
        this.lutCols = [];
    }
    ;
    systemLength() {
        let count = 0;
        for (let i = 0; i < this.strands.length; i++) {
            count += this.strands[i].getLength();
        }
        return count;
    }
    ;
    isEmpty() {
        return this.strands.length == 0;
    }
    initInstances(nInstances) {
        this.INSTANCES = nInstances;
        this.bbOffsets = new Float32Array(this.INSTANCES * 3);
        this.bbRotation = new Float32Array(this.INSTANCES * 4);
        this.nsOffsets = new Float32Array(this.INSTANCES * 3);
        this.nsRotation = new Float32Array(this.INSTANCES * 4);
        this.conOffsets = new Float32Array(this.INSTANCES * 3);
        this.conRotation = new Float32Array(this.INSTANCES * 4);
        this.bbconOffsets = new Float32Array(this.INSTANCES * 3);
        this.bbconRotation = new Float32Array(this.INSTANCES * 4);
        this.bbconScales = new Float32Array(this.INSTANCES * 3);
        this.cmOffsets = new Float32Array(this.INSTANCES * 3);
        this.bbColors = new Float32Array(this.INSTANCES * 3);
        this.nsColors = new Float32Array(this.INSTANCES * 3);
        this.scales = new Float32Array(this.INSTANCES * 3);
        this.nsScales = new Float32Array(this.INSTANCES * 3);
        this.conScales = new Float32Array(this.INSTANCES * 3);
        this.visibility = new Float32Array(this.INSTANCES * 3);
        this.bbLabels = new Float32Array(this.INSTANCES * 3);
    }
    callUpdates(names) {
        names.forEach((name) => {
            this.backbone.geometry["attributes"][name].needsUpdate = true;
            this.nucleoside.geometry["attributes"][name].needsUpdate = true;
            this.connector.geometry["attributes"][name].needsUpdate = true;
            this.bbconnector.geometry["attributes"][name].needsUpdate = true;
            if (name == "instanceScale" || name == "instanceRotation") {
            }
            else {
                this.dummyBackbone.geometry["attributes"][name].needsUpdate = true;
            }
        });
    }
    getElementBySID(sid) {
        return elements.get(this.globalStartId + sid);
    }
    toggleStrands() {
        this.strands.forEach(strand => {
            strand.toggleMonomers();
        });
    }
    select() {
        this.strands.forEach(s => s.select());
    }
    deselect() {
        this.strands.forEach(s => s.deselect());
    }
    /**
     * Return a list of all monomers in the system
     */
    getMonomers() {
        return [].concat.apply([], this.strands.map(s => {
            return s.getMonomers();
        }));
    }
    getNextPeptideStrandID() {
        let id = -1;
        let currentIDs = new Set(this.strands.filter(s => s.isPeptide()).map(s => s.id));
        while (currentIDs.has(id))
            id--;
        return id;
    }
    getNextNucleicAcidStrandID() {
        let id = 0;
        let currentIDs = new Set(this.strands.filter(s => s.isNucleicAcid()).map(s => s.id));
        while (currentIDs.has(id))
            id++;
        return id;
    }
    createStrand(strID) {
        if (strID < 0)
            return new Peptide(strID, this);
        else
            return new NucleicAcidStrand(strID, this);
    }
    ;
    addNewNucleicAcidStrand() {
        let id = this.getNextNucleicAcidStrandID();
        let strand = new NucleicAcidStrand(id, this);
        strand.system = this;
        this.strands.push(strand);
        return strand;
    }
    addNewPeptideStrand() {
        let id = this.getNextPeptideStrandID();
        let strand = new Peptide(id, this);
        strand.system = this;
        this.strands.push(strand);
        return strand;
    }
    addStrand(strand) {
        if (!this.strands.includes(strand)) {
            this.strands.push(strand);
        }
        strand.system = this;
    }
    ;
    /**
     * Remove strand from system
     * @param strand
     */
    removeStrand(strand) {
        let i = this.strands.indexOf(strand);
        if (i >= 0) {
            this.strands.splice(i, 1);
        }
        if (this == strand.system) {
            strand.system = null;
        }
    }
    ;
    //computes the center of mass of the system
    getCom() {
        const com = new THREE.Vector3(0, 0, 0);
        for (let i = 0; i < this.INSTANCES * 3; i += 3) {
            com.add(new THREE.Vector3(this.cmOffsets[i], this.cmOffsets[i + 1], this.cmOffsets[i + 2]));
        }
        return (com.multiplyScalar(1 / this.INSTANCES));
    }
    ;
    setDatFile(datFile) {
        this.datFile = datFile;
    }
    ;
    setColorFile(jsonFile) {
        this.colormapFile = jsonFile;
    }
    ;
    translateSystem(amount) {
        for (let i = 0; i < this.INSTANCES * 3; i += 3) {
            this.bbOffsets[i] += amount.x;
            this.bbOffsets[i + 1] += amount.y;
            this.bbOffsets[i + 2] += amount.z;
            this.nsOffsets[i] += amount.x;
            this.nsOffsets[i + 1] += amount.y;
            this.nsOffsets[i + 2] += amount.z;
            this.conOffsets[i] += amount.x;
            this.conOffsets[i + 1] += amount.y;
            this.conOffsets[i + 2] += amount.z;
            this.bbconOffsets[i] += amount.x;
            this.bbconOffsets[i + 1] += amount.y;
            this.bbconOffsets[i + 2] += amount.z;
            this.cmOffsets[i] += amount.x;
            this.cmOffsets[i + 1] += amount.y;
            this.cmOffsets[i + 2] += amount.z;
        }
        this.callUpdates(['instanceOffset']);
        if (tmpSystems.length > 0) {
            tmpSystems.forEach((s) => {
                s.callUpdates(['instanceOffset']);
            });
        }
        render();
    }
    ;
    fillVec(vecName, unitSize, pos, vals) {
        for (let i = 0; i < unitSize; i++) {
            this[vecName][pos * unitSize + i] = vals[i];
        }
    }
    ;
    toJSON() {
        // Specify required attributes
        let json = {
            id: this.id,
        };
        // Specify optional attributes
        if (this.label)
            json['label'] = this.label;
        // Add strands last
        json['strands'] = this.strands;
        return json;
    }
    ;
}
;
