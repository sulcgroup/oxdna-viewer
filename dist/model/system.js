/**
 * A collection of strands that were loaded as a single file.
 * Systems contain all the data arrays that specify the properties of every monomer contained in their strands.
 * Data arrays are constant sized, so new particles added to the scene must be initialized in their own system.
 */
class System {
    id;
    globalStartId; //1st nucleotide's id
    datFile;
    reader; // The FileReader object bound to this system
    colormapFile;
    lutCols;
    strands = [];
    label;
    lines2ele;
    instanceParams = new Map([
        ['cmOffsets', 3], ['bbOffsets', 3], ['nsOffsets', 3],
        //['nsRotation', 4], ['conOffsets', 3], ['conRotation', 4],
        ['nsRotation', 4], ['con1Offsets', 3], ['con1Rotation', 4], ['con2Offsets', 3], ['con2Rotation', 4],
        ['bbconOffsets', 3], ['bbconRotation', 4], ['bbColors', 3],
        //['scales', 3] ,['nsScales', 3], ['conScales', 3], ['bbconScales', 3],
        ['scales', 3], ['cmScales', 3], ['nsScales', 3], ['con1Scales', 3], ['con2Scales', 3], ['bbconScales', 3],
        ['visibility', 3], ['nsColors', 3], ['bbLabels', 3]
    ]);
    //the system contains all the data from a dat file in its instancing arrays
    //the system also owns the actual meshes that get sent to the scene.
    INSTANCES;
    bbOffsets;
    bbRotation;
    nsOffsets;
    nsRotation;
    //conOffsets: Float32Array;
    //conRotation: Float32Array;
    con1Offsets;
    con1Rotation;
    con2Offsets;
    con2Rotation;
    bbconOffsets;
    bbconRotation;
    bbconScales;
    cmOffsets;
    bbColors;
    nsColors;
    scales;
    cmScales;
    nsScales;
    //conScales: Float32Array;
    con1Scales;
    con2Scales;
    visibility;
    bbLabels;
    cmGeometry;
    backboneGeometry;
    nucleosideGeometry;
    //connectorGeometry: THREE.InstancedBufferGeometry;
    connector1Geometry;
    connector2Geometry;
    spGeometry;
    pickingGeometry;
    cm;
    backbone;
    nucleoside;
    //connector: THREE.Mesh;
    connector1;
    connector2;
    bbconnector;
    dummyBackbone;
    checkedForBasepairs = false;
    constructor(id, startID) {
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
        //this.conOffsets = new Float32Array(this.INSTANCES * 3);
        //this.conRotation = new Float32Array(this.INSTANCES * 4);
        this.con1Offsets = new Float32Array(this.INSTANCES * 3);
        this.con1Rotation = new Float32Array(this.INSTANCES * 4);
        this.con2Offsets = new Float32Array(this.INSTANCES * 3);
        this.con2Rotation = new Float32Array(this.INSTANCES * 4);
        this.bbconOffsets = new Float32Array(this.INSTANCES * 3);
        this.bbconRotation = new Float32Array(this.INSTANCES * 4);
        this.bbconScales = new Float32Array(this.INSTANCES * 3);
        this.cmOffsets = new Float32Array(this.INSTANCES * 3);
        this.bbColors = new Float32Array(this.INSTANCES * 3);
        this.nsColors = new Float32Array(this.INSTANCES * 3);
        this.scales = new Float32Array(this.INSTANCES * 3);
        this.cmScales = new Float32Array(this.INSTANCES * 3);
        this.nsScales = new Float32Array(this.INSTANCES * 3);
        //this.conScales = new Float32Array(this.INSTANCES * 3);
        this.con1Scales = new Float32Array(this.INSTANCES * 3);
        this.con2Scales = new Float32Array(this.INSTANCES * 3);
        this.visibility = new Float32Array(this.INSTANCES * 3);
        this.bbLabels = new Float32Array(this.INSTANCES * 3);
    }
    callUpdates(names) {
        names.forEach((name) => {
            this.cm.geometry["attributes"][name].needsUpdate = true;
            this.backbone.geometry["attributes"][name].needsUpdate = true;
            this.nucleoside.geometry["attributes"][name].needsUpdate = true;
            //this.connector.geometry["attributes"][name].needsUpdate = true;
            this.connector1.geometry["attributes"][name].needsUpdate = true;
            this.connector2.geometry["attributes"][name].needsUpdate = true;
            this.bbconnector.geometry["attributes"][name].needsUpdate = true;
            if (name == "instanceScale" || name == "instanceRotation") {
            }
            else {
                this.dummyBackbone.geometry["attributes"][name].needsUpdate = true;
            }
        });
    }
    callAllUpdates() {
        this.callUpdates(['instanceOffset', 'instanceRotation', 'instanceScale', 'instanceColor', 'instanceVisibility']);
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
        updateColoring();
    }
    deselect() {
        this.strands.forEach(s => s.deselect());
        updateColoring();
    }
    /**
     * Return a list of all monomers in the system in 5'-3' order
     */
    getMonomers() {
        return [].concat.apply([], this.strands.map(s => {
            return s.getMonomers();
        }));
    }
    /**
     * Return only the amino acid or generic sphere monomers in the system
     */
    getAAMonomers() {
        return [].concat.apply([], this.strands.map(s => {
            if (s.isPeptide() || s.isGS()) {
                return s.getMonomers();
            }
            else {
                return [];
            }
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
    getNextGenericSphereStrandID() {
        let id = 0;
        let currentIDs = new Set(this.strands.filter(s => s.isGS()).map(s => s.id));
        while (currentIDs.has(id))
            id--;
        return id;
    }
    createStrandTyped(type) {
        if (type === 'DNA' || type === 'RNA')
            return this.addNewNucleicAcidStrand(type);
        else if (type === 'peptide')
            return this.addNewPeptideStrand();
        else if (type === 'gs')
            return this.addNewGenericSphereStrand();
        else {
            notify(`${type} is not a valid monomer type`, "alert");
            throw new Error(`${type} is not a valid monomer type`);
        }
    }
    ;
    addNewNucleicAcidStrand(type) {
        let id = this.getNextNucleicAcidStrandID();
        let strand = new NucleicAcidStrand(id, this);
        strand.kwdata['type'] = type;
        strand.system = this;
        this.strands.push(strand);
        return strand;
    }
    addNewPeptideStrand() {
        let id = this.getNextPeptideStrandID();
        let strand = new Peptide(id, this);
        strand.kwdata['type'] = 'peptide';
        strand.system = this;
        this.strands.push(strand);
        return strand;
    }
    addNewGenericSphereStrand() {
        let id = this.getNextGenericSphereStrandID();
        let strand = new Generic(id, this);
        strand.kwdata['type'] = 'generic';
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
            //this.conOffsets[i] += amount.x;
            //this.conOffsets[i + 1] += amount.y;
            //this.conOffsets[i + 2] += amount.z;
            this.con1Offsets[i] += amount.x;
            this.con1Offsets[i + 1] += amount.y;
            this.con1Offsets[i + 2] += amount.z;
            this.con2Offsets[i] += amount.x;
            this.con2Offsets[i + 1] += amount.y;
            this.con2Offsets[i + 2] += amount.z;
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
    doVisuals(action) {
        action();
        this.callUpdates(['instanceOffset', 'instanceRotation', 'instanceScale', 'instanceColor', 'instanceVisibility']);
        render();
    }
    ;
    fillDefaultColors() {
        this.getMonomers().forEach((e) => {
            e.defaultColor();
        });
    }
    fillVec(vecName, unitSize, pos, vals) {
        for (let i = 0; i < unitSize; i++) {
            this[vecName][pos * unitSize + i] = vals[i];
        }
    }
    ;
    isPatchySystem() {
        return false;
    }
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
class PatchySystem extends System {
    patchyGeometries;
    patchyMeshes;
    pickingMeshes;
    offsets;
    rotations;
    colors;
    scalings;
    visibilities;
    labels;
    ready;
    instanceParams = new Map([
        ['offsets', 3], ['rotations', 4], ['colors', 3],
        ['scalings', 3], ['visibilities', 3], ['labels', 3]
    ]);
    particles;
    species;
    constructor(id, particleFile, patchFile, loroPatchFiles) {
        super(id, 0);
        this.id = id;
        this.particles = [];
    }
    ;
    // These can be undefined, but you do need three arguments when calling this function
    async readPatchFiles(particleFile, patchFile, loroPatchFiles) {
        if (patchFile) {
            this.ready = this.readPatchyFiles(particleFile, patchFile);
        }
        else if (loroPatchFiles) {
            this.ready = this.readLoroFiles(loroPatchFiles);
        }
        else {
            notify("Missing patch information for patchy particle system", "warning", true);
        }
    }
    async readPatchyFiles(particleFile, patchFile) {
        return new Promise(function (resolve, reject) {
            particleFile.text().then(particlesStr => {
                patchFile.text().then(patchesStr => {
                    this.initSpecies(particlesStr, patchesStr).then(resolve(true));
                });
            });
        }.bind(this)); // why do I need this??
    }
    async readLoroFiles(loroPatchFiles) {
        return new Promise(function (resolve, reject) {
            let patchStrMap = new Map();
            loroPatchFiles.forEach(f => f.text().then(s => {
                patchStrMap.set(f.name, s);
                if (patchStrMap.size == loroPatchFiles.length) {
                    this.initLoroSpecies(patchStrMap).then(resolve(true));
                }
            }));
        }.bind(this));
    }
    initSpecies(particlesStr, patchesStr) {
        return new Promise(function (resolve, reject) {
            // Remove whitespace
            particlesStr = particlesStr.replaceAll(' ', '');
            patchesStr = patchesStr.replaceAll(' ', '');
            const getScalar = (name, s) => {
                const m = s.match(new RegExp(`${name}=(-?\\d+)`));
                if (m) {
                    return parseFloat(m[1]);
                }
                return false;
            };
            const getArray = (name, s) => {
                const m = s.match(new RegExp(`${name}=([\\,\\d\\.\\-\\+]+)`));
                if (m) {
                    return m[1].split(',').map((v) => parseFloat(v));
                }
                return false;
            };
            let particles = [];
            let currentParticle;
            for (const line of particlesStr.split('\n')) {
                const particleID = line.match(/particle_(\d+)/);
                if (particleID) {
                    if (currentParticle) {
                        particles.push(currentParticle);
                    }
                    currentParticle = { 'id': parseInt(particleID[1]) };
                }
                const type = getScalar('type', line);
                if (type !== false) {
                    currentParticle['type'] = type;
                }
                const patches = getArray('patches', line);
                if (patches !== false) {
                    currentParticle['patches'] = patches;
                }
            }
            particles.push(currentParticle);
            let patches = new Map();
            let currentId;
            for (const line of patchesStr.split('\n')) {
                const patchID = line.match(/patch_(\d+)/);
                if (patchID) {
                    currentId = parseInt(patchID[1]);
                    patches.set(currentId, {});
                }
                const color = getScalar('color', line);
                if (color !== false) {
                    patches.get(currentId)['color'] = color;
                }
                for (const k of ['position', 'a1', 'a2']) {
                    const a = getArray(k, line);
                    if (a) {
                        const v = new THREE.Vector3().fromArray(a);
                        patches.get(currentId)[k] = v;
                    }
                }
            }
            for (const particle of particles) {
                particle['patches'] = particle['patches'].map(id => patches.get(id));
            }
            this.species = particles;
        }.bind(this));
    }
    initLoroSpecies(patchStrMap) {
        return new Promise(function (resolve, reject) {
            this.particles.map(() => { });
            const types = this.particles.map(p => parseInt(p.type));
            const instanceCounts = [];
            const patchSpecs = [];
            types.forEach((s, i) => {
                patchSpecs[s] = this.particles[i]['patchSpec'];
                if (instanceCounts[s] === undefined) {
                    instanceCounts[s] = 1;
                }
                else {
                    instanceCounts[s]++;
                }
            });
            this.species = [...new Set(types)].map(s => {
                let patchStrs = patchStrMap.get(patchSpecs[s]);
                return {
                    'type': s,
                    'patches': patchStrs.split('\n').map(vs => {
                        let pos = new THREE.Vector3().fromArray(vs.trim().split(/ +/g).map(v => parseFloat(v)));
                        return {
                            'position': pos,
                            'a1': pos.clone().normalize(),
                            'a2': pos.clone().normalize(), // No actual orientation available
                        };
                    })
                };
            });
        }.bind(this));
    }
    isPatchySystem() {
        return true;
    }
    getMonomers() {
        return this.particles;
    }
    systemLength() {
        return this.particles.length;
    }
    ;
    async initPatchyInstances() {
        await this.ready;
        const types = this.particles.map(p => parseInt(p.type));
        const instanceCounts = [];
        types.forEach(s => {
            if (instanceCounts[s] === undefined) {
                instanceCounts[s] = 1;
            }
            else {
                instanceCounts[s]++;
            }
        });
        this.offsets = instanceCounts.map(n => new Float32Array(n * 3));
        this.rotations = instanceCounts.map(n => new Float32Array(n * 4));
        this.colors = instanceCounts.map(n => new Float32Array(n * 3));
        this.scalings = instanceCounts.map(n => new Float32Array(n * 3));
        this.visibilities = instanceCounts.map(n => new Float32Array(n * 3));
        this.labels = instanceCounts.map(n => new Float32Array(n * 3));
    }
    callUpdates(names) {
        names.forEach((name) => {
            this.patchyMeshes.forEach(mesh => {
                mesh.geometry["attributes"][name].needsUpdate = true;
            });
            this.pickingMeshes.forEach(mesh => {
                mesh.geometry["attributes"][name].needsUpdate = true;
            });
        });
    }
    fillPatchyVec(species, vecName, unitSize, pos, vals) {
        for (let i = 0; i < unitSize; i++) {
            this[vecName][species][pos * unitSize + i] = vals[i];
        }
    }
    ;
}
