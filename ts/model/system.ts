/**
 * A collection of strands that were loaded as a single file.
 * Systems contain all the data arrays that specify the properties of every monomer contained in their strands.
 * Data arrays are constant sized, so new particles added to the scene must be initialized in their own system.
 */
class System {

    id: number;
    globalStartId: number; //1st nucleotide's id
    datFile;
    colormapFile;
    lutCols: THREE.Color[];
    strands: Strand[] = [];
    label: string;

    instanceParams = new Map([
        ['cmOffsets', 3], ['bbOffsets', 3], ['nsOffsets', 3],
        ['nsRotation', 4], ['conOffsets', 3], ['conRotation', 4],
        ['bbconOffsets', 3], ['bbconRotation', 4], ['bbColors', 3],
        ['scales', 3] ,['nsScales', 3], ['conScales', 3], ['bbconScales', 3],
        ['visibility', 3], ['nsColors', 3], ['bbLabels', 3]
    ]);

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

    checkedForBasepairs = false;

    constructor(id: number, startID: number) {
        this.id = id;
        this.globalStartId = startID;
        this.lutCols = [];
    };

    systemLength(): number {
        let count: number = 0;
        for (let i = 0; i < this.strands.length; i++) {
            count += this.strands[i].getLength();
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
                return s.getMonomers();
            })
        );
    }

    getAAMonomers() {
        return [].concat.apply([],
            this.strands.map(s=>{
                if(s.isPeptide() || s.isGS()) {
                    return s.getMonomers();
                } else {
                    return [];
                }
            })
        );
    }

    getNextPeptideStrandID() {
        let id = -1;
        let currentIDs = new Set(this.strands.filter(s=>s.isPeptide()).map(s=>s.id));
        while(currentIDs.has(id)) id--;
        return id;
    }
    getNextNucleicAcidStrandID() {
        let id = 0;
        let currentIDs = new Set(this.strands.filter(s=>s.isNucleicAcid()).map(s=>s.id));
        while(currentIDs.has(id)) id++;
        return id;
    }
    getNextGenericSphereStrandID() {
        let id = 0;
        let currentIDs = new Set(this.strands.filter(s=>s.isGS()).map(s=>s.id));
        while(currentIDs.has(id)) id--;
        return id;
    }

    createStrand(strID: number): Strand {
        if (strID < 0)
            return new Peptide(strID, this);
        else
            return new NucleicAcidStrand(strID, this);
    };

    createStrandTyped(strID: number, base: string): Strand { // added so trajectory reader can read generic sphere files
        if (strID < 0)
            if(base.includes('gs')) return new Generic(strID, this);
            else return new Peptide(strID, this);
        else
            return new NucleicAcidStrand(strID, this);
    };

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
    addNewGenericSphereStrand() {
        let id = this.getNextGenericSphereStrandID();
        let strand = new Generic(id, this);
        strand.system = this;
        this.strands.push(strand);
        return strand;
    }

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

    doVisuals(action:Function){
        action();
        this.callUpdates(['instanceOffset', 'instanceRotation', 'instanceScale', 'instanceColor', 'instanceVisibility']);
        render();
    };

    fillVec(vecName, unitSize, pos, vals) {
        for (let i = 0; i < unitSize; i++) {
            this[vecName][pos * unitSize + i] = vals[i]
        }
    };

    isPatchySystem() {
        return false;
    }

    toJSON() {
        // Specify required attributes
        let json = {
            id: this.id,
        };
        // Specify optional attributes
        if (this.label) json['label'] = this.label;

        // Add strands last
        json['strands'] = this.strands;

        return json;
    };
};

class PatchySystem extends System {
    patchyGeometries: THREE.InstancedBufferGeometry[];
    patchyMeshes: THREE.Mesh[];
    pickingMeshes: THREE.Mesh[];
    offsets: Float32Array[];
    rotations: Float32Array[];
    colors: Float32Array[];
    scalings: Float32Array[];
    visibilities: Float32Array[];
    labels: Float32Array[];

    instanceParams = new Map([
        ['offsets', 3], ['rotations', 4], ['colors', 3],
        ['scalings', 3], ['visibilities', 3], ['labels', 3]
    ]);

    particles: PatchyParticle[];
    species: {
        type: number,
        patches: any[]
    }[];

    constructor(id: number, particleFile?: File, patchFile?: File, loroPatchFiles?: File[],
        callback?: (any)=>void
    ) {
        super(id, 0);
        this.id = id;
        this.particles = [];

        if (patchFile) {
            particleFile.text().then(particlesStr => {
                patchFile.text().then(patchesStr => {
                    callback(()=>{
                        this.initSpecies(particlesStr, patchesStr);
                    });
                });
            });
        } else if (loroPatchFiles) {
            let patchStrMap = new Map();
            loroPatchFiles.forEach(f=>f.text().then(s=>{
                patchStrMap.set(f.name, s);
                if (patchStrMap.size == loroPatchFiles.length) {
                    callback(()=>{
                        // All files loaded
                        this.initLoroSpecies(patchStrMap);
                    });
                }
            }));
        } else {
            notify("Missing patch information for patchy particle system", "warning", true);

            // This is a really ugly hack to fix a race condition
            new Promise(resolve => setTimeout(resolve, 1000)).then(()=>callback(()=>{}));
        }
    };

    initLoroSpecies(patchStrMap: Map<string, string>) {
        this.particles.map(()=>{});
        const types = this.particles.map(p=>parseInt(p.type));
        const instanceCounts = [];
        const patchSpecs = []
        types.forEach((s,i)=>{
            patchSpecs[s] = this.particles[i]['patchSpec'];
            if (instanceCounts[s] === undefined) {
                instanceCounts[s] = 1;
            } else {
                instanceCounts[s]++;
            }
        });
        this.species = [...new Set(types)].map(s=>{
            let patchStrs = patchStrMap.get(patchSpecs[s]);
            return {
                'type': s,
                'patches': patchStrs.split('\n').map(vs=>{
                    let pos = new THREE.Vector3().fromArray(
                        vs.trim().split(/ +/g).map(v=>parseFloat(v))
                    );
                    return {
                        'position': pos,
                        'a1': pos.clone().normalize(),
                        'a2': pos.clone().normalize(), // No actual orientation available
                    }
                })
            }
        });
        console.log(this.species.length)
    }

    initSpecies(particlesStr: string, patchesStr: string) {
        // Remove whitespace
        particlesStr = particlesStr.replaceAll(' ', '');
        patchesStr = patchesStr.replaceAll(' ', '');

        const getScalar = (name: string, s: string) => {
            const m = s.match(new RegExp(`${name}=(-?\\d+)`));
            if (m) {
                return parseFloat(m[1]);
            }
            return false
        }
        const getArray = (name, s) => {
            const m = s.match(new RegExp(`${name}=([\\,\\d\\.\\-\\+]+)`));
            if (m) {
                return m[1].split(',').map((v: string)=>parseFloat(v));
            }
            return false
        }
        let particles = [];
        let currentParticle;
        for (const line of particlesStr.split('\n')) {
            const particleID = line.match(/particle_(\d+)/)
            if (particleID) {
                if (currentParticle) {
                    particles.push(currentParticle);
                }
                currentParticle = {'id': parseInt(particleID[1])}
            }
            const type = getScalar('type', line);
            if (type !== false) {
                currentParticle['type'] = type
            }
            const patches = getArray('patches', line);
            if (patches !== false) {
                currentParticle['patches'] = patches;
            }
        }
        particles.push(currentParticle);

        let patches = new Map();

        let currentId: number;
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
            particle['patches'] = particle['patches'].map(id=>patches.get(id));
        }

        this.species = particles;
    }

    isPatchySystem() {
        return true;
    }

    getMonomers() {
        return this.particles;
    }

    systemLength(): number {
        return this.particles.length;
    };

    initPatchyInstances() {
        const types = this.particles.map(p=>parseInt(p.type));
        const instanceCounts = [];
        types.forEach(s=>{
            if (instanceCounts[s] === undefined) {
                instanceCounts[s] = 1
            } else {
                instanceCounts[s]++;
            }
        });
        this.offsets = instanceCounts.map(n=>new Float32Array(n * 3));
        this.rotations = instanceCounts.map(n=>new Float32Array(n * 4));
        this.colors = instanceCounts.map(n=>new Float32Array(n * 3));
        this.scalings = instanceCounts.map(n=>new Float32Array(n * 3));
        this.visibilities = instanceCounts.map(n=>new Float32Array(n * 3));
        this.labels = instanceCounts.map(n=>new Float32Array(n * 3));
    }

    callUpdates(names : string[]) {
        names.forEach((name) => {
            this.patchyMeshes.forEach(mesh=>{
                mesh.geometry["attributes"][name].needsUpdate = true;
            });
            this.pickingMeshes.forEach(mesh=>{
                mesh.geometry["attributes"][name].needsUpdate = true;
            });
        });
    }
    fillPatchyVec(species: number, vecName: string, unitSize: number, pos: number, vals: number[]) {
        for (let i = 0; i < unitSize; i++) {
            this[vecName][species][pos * unitSize + i] = vals[i]
        }
    };
}