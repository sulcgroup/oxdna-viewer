/**
 * A collection of strands that were loaded as a single file.
 * Systems contain all the data arrays that specify the properties of every monomer contained in their strands.
 * Data arrays are constant sized, so new particles added to the scene must be initialized in their own system.
 */
class System {

    systemID: number;
    globalStartId: number; //1st nucleotide's gid
    datFile;
    colormapFile;
    lutCols: THREE.Color[];
    strands: Strand[] = [];
    label: string;

    //the system contains all the data from a dat file in its instancing arrays
    //the system also owns the actual meshes that get sent to the scene.
    INSTANCES: number;
    bbOffsets: Float32Array;
    bbRotation: Float32Array;
    nsOffsets: Float32Array;
    nsRotation: Float32Array;
    conOffsets: Float32Array;
    conRotation: Float32Array;
    bbconOffsets: Float32Array;
    bbconRotation: Float32Array;
    bbconScales: Float32Array;
    cmOffsets: Float32Array;
    bbColors: Float32Array;
    nsColors: Float32Array;
    scales: Float32Array;
    nsScales: Float32Array;
    conScales: Float32Array;
    visibility: Float32Array;

    bbLabels: Float32Array;

    backboneGeometry: THREE.InstancedBufferGeometry;
    nucleosideGeometry: THREE.InstancedBufferGeometry;
    connectorGeometry: THREE.InstancedBufferGeometry;
    spGeometry: THREE.InstancedBufferGeometry;
    pickingGeometry: THREE.InstancedBufferGeometry;

    backbone: THREE.Mesh;
    nucleoside: THREE.Mesh;
    connector: THREE.Mesh;
    bbconnector: THREE.Mesh;
    dummyBackbone: THREE.Mesh;

    constructor(id: number, startID: number) {
        this.systemID = id;
        this.globalStartId = startID;
        this.lutCols = [];
    };

    systemLength(): number {
        let count: number = 0;
        for (let i = 0; i < this.strands.length; i++) {
            count += this.strands[i].monomers.length;
        }
        return count;
    };

    isEmpty(): Boolean {
        return this.strands.length == 0;
    }

    initInstances(nInstances: number) {
        this.INSTANCES = nInstances
        this.bbOffsets = new Float32Array(this.INSTANCES * 3);
        this.bbRotation = new Float32Array(this.INSTANCES * 4);
        this.nsOffsets = new Float32Array(this.INSTANCES * 3);
        this.nsRotation = new Float32Array(this.INSTANCES * 4)
        this.conOffsets = new Float32Array(this.INSTANCES * 3);
        this.conRotation = new Float32Array(this.INSTANCES * 4);
        this.bbconOffsets = new Float32Array(this.INSTANCES * 3);
        this.bbconRotation = new Float32Array(this.INSTANCES * 4);
        this.bbconScales = new Float32Array(this.INSTANCES * 3);
        this.cmOffsets = new Float32Array(this.INSTANCES * 3);
        this.bbColors = new Float32Array(this.INSTANCES * 3);
        this.nsColors = new Float32Array(this.INSTANCES * 3)
        this.scales = new Float32Array(this.INSTANCES * 3);
        this.nsScales = new Float32Array(this.INSTANCES * 3);
        this.conScales = new Float32Array(this.INSTANCES * 3);
        this.visibility = new Float32Array(this.INSTANCES * 3);
        this.bbLabels = new Float32Array(this.INSTANCES * 3);
    }

    callUpdates(names : string[]) {
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

    getElementBySID(sid:number){
        return elements.get(this.globalStartId + sid);
    }

    toggleStrands(){
        this.strands.forEach(strand=>{
            strand.toggleMonomers();
        })
    }

    select() {
        this.strands.forEach(s=>s.select());
    }

    deselect() {
        this.strands.forEach(s=>s.deselect());
    }

    /**
     * Return a list of all monomers in the system
     */
    getMonomers() {
        return [].concat.apply([],
            this.strands.map(s=>{
                return s.monomers;
            })
        );
    }

    createStrand(strID: number): Strand {
        if (strID < 0)
            return new Peptide(strID, this);
        else
            return new NucleicAcidStrand(strID, this);
    };

    addStrand(strand: Strand) {
        if(!this.strands.includes(strand)) {
            this.strands.push(strand);
        }
        strand.system = this;
    };

    /**
     * Remove strand from system
     * @param strand 
     */
    removeStrand(strand: Strand) {
        let i = this.strands.indexOf(strand);
        if (i >= 0) {
            this.strands.splice(i, 1);
        }
        if (this == strand.system) {
            strand.system = null;
        }
    };

    //computes the center of mass of the system
    getCom() {
        const com = new THREE.Vector3(0, 0, 0);
        for (let i = 0; i < this.INSTANCES * 3; i+=3){
            com.add(new THREE.Vector3(this.cmOffsets[i], this.cmOffsets[i+1], this.cmOffsets[i+2]))
        }
        return(com.multiplyScalar(1/this.INSTANCES))
    };

    setDatFile(datFile) { //allows for trajectory function
        this.datFile = datFile;
    };

    setColorFile(jsonFile) {
        this.colormapFile = jsonFile;
    };

    translateSystem(amount: THREE.Vector3) {
        for (let i = 0; i < this.INSTANCES * 3; i+=3){
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
                s.callUpdates(['instanceOffset'])
            })
        }


        render();
    };

    fillVec(vecName, unitSize, pos, vals) {
        for (let i = 0; i < unitSize; i++) {
            this[vecName][pos * unitSize + i] = vals[i]
        }
    };

    toJSON() {
        // Specify required attributes
        let json = {
            id: this.systemID,
        };
        // Specify optional attributes
        if (this.label) json['label'] = this.label;

        // Add strands last
        json['strands'] = this.strands;

        return json;
    };
};