/**
 * Two simple classes meant for easy generation, viewing, and deletion of networks
 */
class Edges {
    p1; // particle 1 indices, the p1 indices are always lower than p2
    p2; // particle 2 indices
    ks; // spring constants
    types;
    eqDist;
    total; // number of edges
    extraParams; // ANMT backbone edges: [a0, b0, c0, d0] or [a0, b0, c0, d0, kb, kt]
    constructor() {
        this.total = 0;
        this.p1 = [];
        this.p2 = [];
        this.ks = [];
        this.eqDist = [];
        this.types = [];
        this.extraParams = [];
    }
    addEdge(id1, id2, eqdist, type, k = 1, xparams = []) {
        if (id1 == id2)
            return; // Can't Add Edge to Itself
        let ind = this.checkEdge(id1, id2, eqdist);
        if (ind > 0) {
            this.ks[ind] += k; // additive spring constants, I did this for MWCENM hopefully it doesn't bite me later
        }
        else {
            if (id1 < id2) {
                this.p1.push(id1);
                this.p2.push(id2);
            }
            else if (id1 > id2) {
                this.p1.push(id2);
                this.p2.push(id1);
            }
            this.ks.push(k);
            this.types.push(type);
            this.eqDist.push(eqdist);
            this.extraParams.push(xparams);
            this.total += 1;
        }
    }
    ;
    removeEdge(id1, id2) {
        if (id1 == id2)
            return;
        for (let i = 0; i < this.total; i++) {
            if ((this.p1[i] == id1 && this.p2[i] == id2) || (this.p1[i] == id2 && this.p2[i] == id1)) {
                this.p1.splice(i, 1);
                this.p2.splice(i, 1);
                this.ks.splice(i, 1);
                this.types.splice(i, 1);
                this.eqDist.splice(i, 1);
                this.extraParams.splice(i, 1);
                this.total -= 1;
                break;
            }
        }
    }
    ;
    checkEdge(id1, id2, eqdist) {
        let dist = this.eqDist.indexOf(eqdist);
        if (dist > -1) {
            if ((this.p1[dist] == id1 && this.p2[dist] == id2) || (this.p2[dist] == id1 && this.p1[dist] == id2)) {
                return dist;
            }
        }
        else {
            return dist;
        }
    }
    ;
    /**
     * Build a new Edges object containing only the edges whose endpoints are both
     * keys of indexMap, with endpoints renumbered to the mapped values.
     * The map must be order-preserving (monotonic) so that p1 < p2 still holds.
     * @param indexMap old particle index -> new particle index
     */
    subset(indexMap) {
        const out = new Edges();
        for (let i = 0; i < this.total; i++) {
            if (indexMap.has(this.p1[i]) && indexMap.has(this.p2[i])) {
                out.p1.push(indexMap.get(this.p1[i]));
                out.p2.push(indexMap.get(this.p2[i]));
                out.ks.push(this.ks[i]);
                out.types.push(this.types[i]);
                out.eqDist.push(this.eqDist[i]);
                out.extraParams.push(this.extraParams[i].slice());
                out.total += 1;
            }
        }
        return out;
    }
    ;
    clone() {
        const identity = new Map();
        this.p1.concat(this.p2).forEach(i => identity.set(i, i));
        return this.subset(identity);
    }
    ;
    clearAll() {
        this.p1 = [];
        this.p2 = [];
        this.ks = [];
        this.eqDist = [];
        this.types = [];
        this.extraParams = [];
        this.total = 0;
    }
    ;
}
const DEFAULT_BENDING_K = 50; // oxDNA bending_k for ANMT, simulation units
const DEFAULT_TORSION_K = 50; // oxDNA torsion_k for ANMT, simulation units
/**
 * True if a and b are neighbours on the same strand. In ANMT these pairs carry bending and torsion terms.
 */
function isBackbonePair(a, b) {
    return a.n3 === b || a.n5 === b;
}
/**
 * Equilibrium cosines [a0, b0, c0, d0] of the ANMT bending/torsion terms between p and q at the current
 * structure, as oxDNA defines them (DNANMInteraction::_protein_ang_pot), with r̂ pointing from p to q:
 * a0 = r̂·a1_p, b0 = -r̂·a1_q, c0 = a1_p·a1_q, d0 = a3_p·a3_q
 */
function angularCosines(p, q) {
    const u = q.getPos().clone().sub(p.getPos()).normalize();
    const clamp = (x) => Math.max(-1, Math.min(1, x));
    return [u.dot(p.getA1()), -u.dot(q.getA1()), p.getA1().dot(q.getA1()), p.getA3().dot(q.getA3())].map(clamp);
}
class Network {
    nid; // network id number as these are stored separate to actual systems
    system;
    INSTANCES;
    offsets;
    rotations;
    colors;
    scales;
    visibility;
    //removed children
    geometry;
    network; // not sure what this does yet
    // network implementation
    particles;
    reducedEdges;
    masses;
    types;
    kb;
    simFC;
    elemcoords;
    networktype; //networktype defined in any edge fill call
    fittingReady; //Tells UI whether this network is ready to be displayed
    onscreen; // Tells UI whether this network is in the scene or not
    hydrogenbondinginfo;
    cutoff; // keeps track of current cutoff value used to fill edges of network
    center;
    // id is used by the visualizer as it is a system object (sorta)
    // nid is the network identifier only
    constructor(nid, selectedMonomers) {
        this.particles = selectedMonomers;
        this.types = this.particles.map(s => { return s.type; });
        this.masses = [];
        this.fillMasses(this.particles);
        this.nid = nid; // Separate Indexing for network objects
        this.reducedEdges = new Edges(); // Holds all info about connections
        this.simFC = 0.05709; // gamma_sim
        this.kb = 0.00138064852; //Boltzmann Constant in pN/A
        this.networktype = 'empty';
        this.onscreen = false; // parameter for viewing the networks
        this.cutoff = 0;
        this.fittingReady = false;
        this.elemcoords = {
            xI: [],
            yI: [],
            zI: [],
            distance: function (i, j) {
                // return this.coords[i].distanceTo(this.coords[j]);
                return Math.sqrt((this.xI[i] - this.xI[j]) ** 2 + (this.yI[i] - this.yI[j]) ** 2 + (this.zI[i] - this.zI[j]) ** 2);
            },
            rotation: function (i, j) {
                return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), //this.coords[i].clone().sub(this.coords[j]).normalize()
                new THREE.Vector3(this.xI[i] - this.xI[j], this.yI[i] - this.yI[j], this.zI[i] - this.zI[j]).normalize());
            },
            center: function (i, j) {
                // return this.coords[i].clone().add(this.coords[j]).divideScalar(2);
                return new THREE.Vector3((this.xI[i] + this.xI[j]) / 2, (this.yI[i] + this.yI[j]) / 2, (this.zI[i] + this.zI[j]) / 2);
            },
            diff: function (i, j) {
                return new THREE.Vector3((this.xI[j] - this.xI[i]), (this.yI[j] - this.yI[i]), (this.zI[j] - this.zI[i]));
            }
        };
        this.refreshCoords();
        this.center = function (i, j) {
            return this.particles[i].getPos().clone().add(this.particles[j].getPos()).divideScalar(2);
        };
        flux.prepJSONButton(this);
    }
    ;
    //The below functions are for merging the ANM and Network
    initInstances(nInstances) {
        this.INSTANCES = nInstances;
        this.offsets = new Float32Array(this.INSTANCES * 3);
        this.rotations = new Float32Array(this.INSTANCES * 4);
        this.colors = new Float32Array(this.INSTANCES * 3);
        this.scales = new Float32Array(this.INSTANCES * 3);
        this.visibility = new Float32Array(this.INSTANCES * 3);
    }
    ;
    callUpdates(names) {
        names.forEach((name) => {
            this.network.geometry["attributes"][name].needsUpdate = true;
            // this.backbone.geometry["attributes"][name].needsUpdate = true;
            // this.nucleoside.geometry["attributes"][name].needsUpdate = true;
            // this.connector.geometry["attributes"][name].needsUpdate = true;
            // this.bbconnector.geometry["attributes"][name].needsUpdate = true;
            // if (name == "instanceScale" || name == "instanceRotation") {
            // }
            // else {
            //     this.dummyBackbone.geometry["attributes"][name].needsUpdate = true;
            // }
        });
    }
    ;
    toJson() {
        let coords = this.elemcoords.xI.map((x, xid) => [x * 8.518, this.elemcoords.yI[xid] * 8.518, this.elemcoords.zI[xid] * 8.518]);
        // let connections = this.reducedEdges.p1.map((x, xid) => [x, this.reducedEdges.p2[xid], this.reducedEdges.ks[xid],]);
        let simMasses = this.masses.slice();
        return { "simMasses": simMasses, "coordinates": coords };
    }
    ;
    selectNetwork() {
        api.selectElements(this.particles, false);
    }
    ;
    copyNetwork(targetNid) {
        // copies this network info to network specified by targetNid
        // (particles are matched by their index in each network)
        const newNet = networks[targetNid];
        newNet.networktype = this.networktype;
        newNet.cutoff = this.cutoff;
        newNet.rebuild(newNet.particles, this.reducedEdges.clone());
    }
    ;
    /**
     * Describe the part of this network that lies within refs, so that it can
     * later be rebuilt on a different set of elements with networkFromTemplate.
     * @param refs Reference list of elements; template members index into it
     * @returns the template, or undefined if no particle of this network is in refs
     */
    templateFor(refs) {
        const refIndex = new Map();
        refs.forEach((e, i) => refIndex.set(e, i));
        const members = [];
        const indexMap = new Map(); // network index -> template member index
        this.particles.forEach((p, i) => {
            if (refIndex.has(p)) {
                indexMap.set(i, members.length);
                members.push(refIndex.get(p));
            }
        });
        if (members.length == 0)
            return undefined;
        return {
            members: members,
            edges: this.reducedEdges.subset(indexMap),
            networktype: this.networktype,
            cutoff: this.cutoff,
            onscreen: this.onscreen,
        };
    }
    ;
    /**
     * Replace the particles and edges of this network and rebuild everything derived from them.
     * Takes ownership of edges.
     */
    rebuild(particles, edges) {
        const wasOnscreen = this.onscreen;
        if (wasOnscreen)
            this.toggleVis();
        this.clearConnections();
        this.particles = particles;
        this.types = particles.map(p => p.type);
        this.fillMasses(particles);
        this.refreshCoords();
        this.reducedEdges = edges;
        if (edges.total != 0) {
            this.initInstances(edges.total);
            this.fillConnections();
            this.initEdges();
            this.prepVis();
            this.sendtoUI();
            if (wasOnscreen)
                this.toggleVis();
        }
        else {
            if (this.fittingReady && flux.fluxWindowOpen)
                view.removeNetworkData(this.nid);
            this.fittingReady = false;
        }
    }
    ;
    refreshCoords() {
        this.elemcoords.xI = this.particles.map(e => e.getPos().x);
        this.elemcoords.yI = this.particles.map(e => e.getPos().y);
        this.elemcoords.zI = this.particles.map(e => e.getPos().z);
    }
    ;
    sendtoUI() {
        this.fittingReady = true;
        let name = "Network " + (this.nid + 1).toString();
        if (flux.fluxWindowOpen) {
            let exists = !!document.getElementById(name);
            if (!exists) {
                view.addNetworkData(this.nid);
            }
        }
    }
    ;
    fillVec(vecName, unitSize, pos, vals) {
        for (let i = 0; i < unitSize; i++) {
            this[vecName][pos * unitSize + i] = vals[i];
        }
    }
    ;
    getVec(vecName, unitSize, pos) {
        let vec = [];
        for (let i = 0; i < unitSize; i++) {
            vec.push(this[vecName][pos * unitSize + i]);
        }
        if (unitSize == 3) {
            return new THREE.Vector3(vec[0], vec[1], vec[2]);
        }
        else if (unitSize == 4) {
            return new THREE.Vector4(vec[0], vec[1], vec[2], vec[3]);
        }
        else {
            return vec;
        }
    }
    ;
    fillMasses(mon) {
        this.masses = [];
        mon.forEach(t => {
            if (t.type == 'gs') {
                let g = t;
                this.masses.push(g.mass);
            }
            else {
                this.masses.push(1);
            }
        });
    }
    ;
    prepVis() {
        this.geometry = instancedConnector.clone();
        this.geometry.addAttribute('instanceOffset', new THREE.InstancedBufferAttribute(this.offsets, 3));
        this.geometry.addAttribute('instanceRotation', new THREE.InstancedBufferAttribute(this.rotations, 4));
        this.geometry.addAttribute('instanceColor', new THREE.InstancedBufferAttribute(this.colors, 3));
        this.geometry.addAttribute('instanceScale', new THREE.InstancedBufferAttribute(this.scales, 3));
        this.geometry.addAttribute('instanceVisibility', new THREE.InstancedBufferAttribute(this.visibility, 3));
        this.network = new THREE.Mesh(this.geometry, instanceMaterial);
        this.network.frustumCulled = false;
    }
    ;
    toggleVis() {
        if (this.onscreen) { // if shown in canvas
            scene.remove(this.network);
            this.onscreen = false;
            render();
            canvas.focus();
        }
        else {
            scene.add(this.network);
            this.onscreen = true;
            render();
            canvas.focus();
        }
    }
    ;
    initEdges() {
        //init general color
        const col = backboneColors[this.nid % backboneColors.length];
        // fill vectors for all edges in network
        for (let t = 0; t < this.reducedEdges.total; t++) {
            this.initEdge(t, col);
        }
    }
    ;
    reCalculateRotations() {
        for (let t = 0; t < this.reducedEdges.total; t++) {
            let i = this.reducedEdges.p1[t];
            let j = this.reducedEdges.p2[t];
            let newRot = this.elemcoords.rotation(i, j);
            this.fillVec('rotations', 4, t, [newRot.w, newRot.z, newRot.y, newRot.x]);
        }
        this.callUpdates(["instanceRotation"]);
    }
    ;
    updatePositions() {
        this.refreshCoords();
        //update all connection positions by finding midpoint of new locations
        for (let t = 0; t < this.reducedEdges.total; t++) {
            let i = this.reducedEdges.p1[t];
            let j = this.reducedEdges.p2[t];
            let pos = this.center(i, j).toArray();
            let dij = this.elemcoords.distance(i, j);
            this.fillVec('offsets', 3, t, [pos[0], pos[1], pos[2]]);
            this.fillVec('scales', 3, t, [1, dij, 1]);
        }
        this.callUpdates(["instanceOffset", "instanceScale"]);
    }
    ;
    recalculateVis() {
        this.updatePositions();
        this.reCalculateRotations();
    }
    ;
    // This has never worked for single particles being rotated...
    // Apply a rotation to all particles
    updateRotations(q) {
        for (let t = 0; t < this.reducedEdges.total; t++) {
            let currRot = this.getVec('rotations', 4, t);
            let newRot = glsl2three(currRot);
            newRot.multiply(q);
            this.fillVec('rotations', 4, t, [newRot.w, newRot.z, newRot.y, newRot.x]);
        }
        this.callUpdates(["instanceOffset", "instanceRotation"]);
    }
    ;
    initEdge(t, col) {
        // fill vectors for single edge in network
        let i = this.reducedEdges.p1[t];
        let j = this.reducedEdges.p2[t];
        let pos = this.center(i, j);
        // the ot
        let rot = this.elemcoords.rotation(i, j);
        let dij = this.elemcoords.distance(i, j);
        this.fillVec('offsets', 3, t, [pos.x, pos.y, pos.z]);
        this.fillVec('rotations', 4, t, [rot.w, rot.z, rot.y, rot.x]);
        this.fillVec('colors', 3, t, [col.r, col.g, col.b]);
        this.fillVec('scales', 3, t, [1, dij, 1]);
        this.fillVec('visibility', 3, t, [1, 1, 1]);
    }
    ;
    // Functions above are meant to be more universal
    // Functions below are specific to generating each network, I call these in specific network wrappers in editing.ts
    edgesByCutoff(cutoffValueAngstroms) {
        this.fillCutoffEdges(cutoffValueAngstroms);
        this.networktype = "ANM";
        this.finishEdges();
    }
    ;
    /**
     * ANM by cutoff, plus bending and torsion terms between backbone neighbours.
     */
    edgesANMT(cutoffValueAngstroms, kb = DEFAULT_BENDING_K, kt = DEFAULT_TORSION_K) {
        this.fillCutoffEdges(cutoffValueAngstroms);
        this.setTorsion(kb, kt);
        this.networktype = "ANMT";
        this.finishEdges();
    }
    ;
    fillCutoffEdges(cutoffValueAngstroms) {
        this.cutoff = cutoffValueAngstroms;
        this.reducedEdges.clearAll();
        this.clearConnections();
        this.selectNetwork();
        this.refreshCoords();
        //let elems: BasicElement[] = Array.from(selectedBases);
        // go through coordinates and assign connections if 2 particles
        // are less than the cutoff value apart
        let simCutoffValue = cutoffValueAngstroms / 8.518; //sim unit conversion
        for (let i = 0; i < this.elemcoords.xI.length; i++) {
            for (let j = 1; j < this.elemcoords.xI.length; j++) {
                if (i >= j)
                    continue;
                let dij = this.elemcoords.distance(i, j);
                if (dij <= simCutoffValue) {
                    this.reducedEdges.addEdge(i, j, dij, 's', 1);
                }
            }
        }
    }
    ;
    /**
     * Network is ready for solving and visualization
     */
    finishEdges() {
        if (this.reducedEdges.total != 0) {
            this.initInstances(this.reducedEdges.total);
            this.fillConnections();
            this.initEdges();
            this.prepVis();
            this.sendtoUI();
        }
    }
    ;
    /**
     * True if the network has ANMT bending/torsion parameters.
     */
    isTorsional() {
        return this.reducedEdges.extraParams.some(x => x.length >= 4);
    }
    ;
    /**
     * Give every edge between backbone neighbours ANMT parameters: the equilibrium cosines (kept if the edge
     * already has them, e.g. from a .par file) and the bending and torsion constants. Other edges get none.
     */
    setTorsion(kb, kt) {
        const e = this.reducedEdges;
        for (let i = 0; i < e.total; i++) {
            const p = this.particles[e.p1[i]], q = this.particles[e.p2[i]];
            if (isBackbonePair(p, q)) {
                const cosines = e.extraParams[i].length >= 4 ? e.extraParams[i].slice(0, 4) : angularCosines(p, q);
                e.extraParams[i] = cosines.concat([kb, kt]);
            }
            else {
                e.extraParams[i] = [];
            }
        }
        if (this.networktype == "ANM")
            this.networktype = "ANMT";
    }
    ;
    /**
     * Remove all ANMT bending/torsion parameters, leaving a plain spring network.
     */
    clearTorsion() {
        this.reducedEdges.extraParams = this.reducedEdges.extraParams.map(() => []);
        if (this.networktype == "ANMT")
            this.networktype = "ANM";
    }
    ;
    /**
     * The network in the form the fluctuation solver (anm_worker) takes.
     * @param torsion bending and torsion constants for ANMT, or null for a plain ANM
     */
    fluctuationRequest(temperature, target, torsion) {
        this.refreshCoords();
        const e = this.reducedEdges;
        const coords = [];
        this.particles.forEach(p => coords.push(...p.getPos().toArray()));
        let angular = null;
        if (torsion) {
            const pairs = e.p1.map((p, i) => [p, e.p2[i]]).filter(([p, q]) => isBackbonePair(this.particles[p], this.particles[q]));
            const a1 = [], a3 = [];
            this.particles.forEach(p => { a1.push(...p.getA1().toArray()); a3.push(...p.getA3().toArray()); });
            angular = {
                p: pairs.map(x => x[0]), q: pairs.map(x => x[1]), a1, a3,
                kb: pairs.map(() => torsion.kb), kt: pairs.map(() => torsion.kt),
            };
        }
        return { coords, p1: e.p1.slice(), p2: e.p2.slice(), ks: e.ks.slice(), angular, temperature, target };
    }
    ;
    /*
     * MWCENM (mixed, weighted coarse-grained elastic network model) was never completed, so it has been
     * removed from the Assign Edges menu. Known problems if anyone picks it up again:
     * - it only works on proteins loaded from a PDB, and the check for that never triggers (pdbindices is
     *   undefined rather than throwing), so other proteins crash it
     * - hydrogen bonds need a Chimera FindHBond .hb file; without one hydrogenBonds is undefined and it throws
     * - salt bridges compare PDB atom distances in Å with 4/8.518 (sim units), so they never form
     * - non-polar contacts use Cα–Cα < 4 Å because the side-chain atom check is commented out, so they
     *   almost never form
     * - it calls notify() for every bond it adds
     */
    /*
    edgesMWCENM(){
        this.reducedEdges.clearAll();
        this.clearConnections();
        this.selectNetwork();
        let pdbindices;
        try{
            pdbindices = this.particles.map(e => {return (e as AminoAcid).pdbindices});
        } catch (e) {
            notify("PDB Info could not be found. Make sure only AminoAcids are selected and they have been loaded from a PDB file.");
            return;
        }
        let uniqdatasets = new Set<number>(pdbindices.map((a) => {return a[0]}));
        // let uniqstrands = new Set<Strand>(this.particles.map(x => {return x.strand}));
        // let uniqchains = new Set<any>(pdbindices.map((a) => {return a[1]}));
        this.addBackboneConnections(100);
        this.addHydrogenBonds(uniqdatasets, pdbindices);
        this.addDisulphideBonds(uniqdatasets, pdbindices);
        this.addNonpolarBonds();
        this.addSaltBridges(7);

        // network is ready for solving and visualization
        this.networktype = "MWCENM";
        this.finishEdges();
    }
    ;
    addHydrogenBonds(uniqdatasets, pdbindices){
        [...uniqdatasets].forEach(ud => {
            let hbonds = pdbFileInfo[ud].hydrogenBonds;
            // let chains = pdbFileInfo[ud].pdbsysinfo;

            let p1, p2; // will be refences to corresponding particles
            let p1found, p2found; // bools
            let hbondk = 100; // strength of h bond
            hbonds.forEach((hb, hid) => {
                p1found = false;
                p2found = false;
                pdbindices.forEach((pi, pindx) => {
                    if (pi[0] == ud && pi[1] == hb[0][0] && pi[2] == hb[0][1]) {
                        p1 = this.particles[pindx];
                        p1found = true;
                    }
                    if (pi[0] == ud && pi[1] == hb[1][0] && pi[2] == hb[1][1]) {
                        p2 = this.particles[pindx];
                        p2found = true;
                    }
                })
                if (p1found && p2found) {
                    let p1indx = this.particles.indexOf(p1);
                    let p2indx = this.particles.indexOf(p2);
                    notify("hbond " + p1indx.toString() + " " + p2indx.toString());
                    this.reducedEdges.addEdge(p1indx, p2indx, this.elemcoords.distance(p1indx, p2indx), 's', hbondk);
                } else {
                    notify("Hydrogen Bond could not be parsed from pdb info " + hid.toString());
                    return;
                }

            })
        })
    }
    ;
    addNonpolarBonds(){
        let nonpolark = 1.0;

        let np = 12;

        // checks for atoms within 4 residues of one another on two amino acids
        // let nonpolarcheck = function(res1, res2){ // looks for pairs of atoms from different residues within 4 Angstroms
        //
        //     let pi = (res1 as AminoAcid).pdbindices; // location of pdb information
        //     let pdbres1 = pdbFileInfo[pi[0]].pdbsysinfo.filter(chns => {if(chns.chainID == pi[1]) return true;})[0].residues.filter(res => {if (parseInt(res.pdbResIdent) == pi[2]){ return true;} })[0];
        //     let res1atoms = pdbres1.atoms.filter(atom => {if(['CA', 'N', 'H', 'C', 'O'].indexOf(atom.atomType) == -1) return true;}); // sidechain atoms for res1 by filtering out main chain
        //
        //     let ni = (res2 as AminoAcid).pdbindices; // location of pdb information
        //     let pdbres2 = pdbFileInfo[ni[0]].pdbsysinfo.filter(chns => {if(chns.chainID == ni[1]) return true;})[0].residues.filter(res => {if (parseInt(res.pdbResIdent) == ni[2]){ return true;} })[0];
        //     let res2atoms = pdbres2.atoms.filter(atom => {if(['CA', 'N', 'H', 'C', 'O'].indexOf(atom.atomType) == -1) return true;}); // sidechain atoms for res2
        //
        //     let pdbdist = function(atom1, atom2){
        //         return Math.sqrt(Math.pow(atom1.x - atom2.x,2) + Math.pow(atom1.y - atom2.y, 2) + Math.pow(atom1.z - atom2.z, 2));
        //     }
        //
        //     let makenonbonded=false;
        //
        //     res1atoms.forEach(pa => {
        //         res2atoms.forEach(na => {
        //             if(pdbdist(pa, na) < 4){ // 4 A is the cutoff used in the original MWCENM paper
        //                 makenonbonded=true;
        //             }
        //         })
        //     })
        //
        //     return makenonbonded;
        // }

        for(let i =0; i<this.particles.length; i++){
            for(let j=0; j<this.particles.length; j++){
                if(i>=j) continue;
                if(this.elemcoords.distance(i,j) < 4/8.518){ // 4 A is the cutoff used in the original MWCENM paper
                    if(this.particles[i].n3 != this.particles[j] && this.particles[i].n5 != this.particles[j]) {
                        notify("nonpolar Bond " + i.toString() + " " + j.toString());
                        this.reducedEdges.addEdge(i, j, this.elemcoords.distance(i, j), 's', nonpolark);
                    }
                }
            }
        }
    }
    ;
    addSaltBridges(pH=7){ // Assuming pH 7 though other options may later be added
        let saltbridgek = 10;
        let catres;
        let anres;
        let catatoms;
        let anatoms;
        if(pH == 7){
            catres = ["D", "E"]; // aspartic acid and glutamic acid
            catatoms = {"D":["OD1", "OD2"], "E": ["OE1", "AE1", "OE2", "AE2"]}; // Which atoms might hold the charge
            anres = ["K", "H", "R"]; // Lysine, histidine and Arginine
            anatoms = {"H":["ND1", "AD1"], "K":["NZ"], "R":["NH1", "NH2"]}; // Which atoms might hold the charge
        } else {
            notify("No pH besides 7 currently supported");
        }

        let posresidues = this.particles.filter(x => {if(catres.indexOf(x.type) != -1) return true}); // all particles in network that are positive
        let negresidues = this.particles.filter(x => {if(anres.indexOf(x.type) != -1) return true});  // all particles in network that are negative


        let saltbridgecheck = function(posres, negres){

            let pi = (posres as AminoAcid).pdbindices; // location of pdb information
            let pospdbres = pdbFileInfo[pi[0]].pdbsysinfo.filter(chns => {if(chns.chainID == pi[1]) return true;})[0].residues.filter(res => {if (parseInt(res.pdbResIdent) == pi[2]){ return true;} })[0];
            let posatoms = pospdbres.atoms.filter(atom => {if(catatoms[posres.type].indexOf(atom.atomType) != -1) return true;});

            let ni = (negres as AminoAcid).pdbindices; // location of pdb information
            let negpdbres = pdbFileInfo[ni[0]].pdbsysinfo.filter(chns => {if(chns.chainID == ni[1]) return true;})[0].residues.filter(res => {if (parseInt(res.pdbResIdent) == ni[2]){ return true;} })[0];
            let negatoms = negpdbres.atoms.filter(atom => {if(anatoms[negres.type].indexOf(atom.atomType) != -1) return true;});

            let pdbdist = function(atom1, atom2){
                return Math.sqrt(Math.pow(atom1.x - atom2.x,2) + Math.pow(atom1.y - atom2.y, 2) + Math.pow(atom1.z - atom2.z, 2))
            }

            let makesaltbridge=false;
            posatoms.forEach(pa => {
                negatoms.forEach(na => {
                    if(pdbdist(pa, na) < 4/8.518){ // 4 A is the cutoff used in the original MWCENM paper
                        makesaltbridge=true;
                    }
                })
            })

            return makesaltbridge;
        }

        // Checks all combinations of paired residues for
        posresidues.forEach(pr => {
            negresidues.forEach(nr => {
                if(saltbridgecheck(pr, nr)){
                    let pindx = this.particles.indexOf(pr);
                    let nindx = this.particles.indexOf(nr);
                    notify("salt b " + pindx.toString() + pr.type + " " + nindx.toString() + nr.type);
                    this.reducedEdges.addEdge(pindx, nindx, this.elemcoords.distance(pindx, nindx), 's',  saltbridgek);
                }
            })
        })

    }
    ;
    addDisulphideBonds(uniqdatasets, pdbindices) {
        [...uniqdatasets].forEach(ud => {
            let dsbonds = pdbFileInfo[ud].disulphideBonds;

            let p1, p2;
            let p1found, p2found;
            let k = 100; // strength of disulfide bond

            if(dsbonds.length != 0) {
                dsbonds.forEach((db) => {
                    p1found = false;
                    p2found = false;
                    pdbindices.forEach((pi, pindx) => {
                        if (pi[0] == ud && pi[1] == db[0] && pi[2] == db[1]) {
                            p1 = this.particles[pindx];
                            p1found = true;
                        } else if (pi[0] == ud && pi[1] == db[2] && pi[2] == db[3]) {
                            p2 = this.particles[pindx];
                            p2found = true;
                        }
                    })
                    if (p1found && p2found) {
                        let p1indx = this.particles.indexOf(p1); // edges filled by particles position in the particles array of network
                        let p2indx = this.particles.indexOf(p2);
                        this.reducedEdges.addEdge(p1indx, p2indx, this.elemcoords.distance(p1indx, p2indx), 's', k);
                    } else {
                        notify("Disulphide Bond could not be parsed from pdb info");
                        return;
                    }

                })
            }
        })
    }
    ;
    addBackboneConnections(kb: number) {
        // adds every particles n3 connection if n3 is in the particles array
        let covalentk = kb;

        for(let i =0; i<this.particles.length; i++) {
            let p = this.particles[i];
            if (p.n3 != null) {
                let qind = this.particles.indexOf(p.n3);
                if (qind != -1) {
                    notify("backbone Bond " + i.toString() + " " + qind.toString());
                    let dis = this.elemcoords.distance(i, qind);
                    if(dis < 1){ // removes any obviously incorrect backbone bonds
                        this.reducedEdges.addEdge(qind, i, this.elemcoords.distance(i, qind), 's', covalentk);
                    }
                }
            }
        }
    }
    ;
    */
    generateHessian() {
        // let hessian : number[][] = [];
        if (this.reducedEdges.total == 0) {
            notify("Network must be filled prior to solving ANM");
        }
        else {
            //Initialize Empty Hessian (3Nx3N)
            let hessian = new Array(3 * this.particles.length * 3 * this.particles.length);
            //Hessian Calc w/ Masses
            for (let l = 0; l < this.reducedEdges.total; l++) {
                let i = this.reducedEdges.p1[l], j = this.reducedEdges.p2[l], k = this.reducedEdges.ks[l], adim = 3 * this.particles.length;
                let mi = this.masses[i];
                let mj = this.masses[j];
                let mij = Math.sqrt(mi * mj); //masses
                let d = this.elemcoords.distance(i, j); //distances
                let d2 = d * d;
                let diff = this.elemcoords.diff(i, j);
                let diag = diff.clone().multiply(diff).multiplyScalar(k).divideScalar(d2);
                let xy = k * (diff.x * diff.y) / d2;
                let xz = k * (diff.x * diff.z) / d2;
                let yz = k * (diff.y * diff.z) / d2;
                // Couldn't find a more pleasant way to do this
                // Fills 1 element in hij, hji, hii, hjj on each line
                // Verified this returns correct Hessian
                hessian[3 * i * adim + 3 * j] -= diag[0] / mij;
                hessian[3 * j * adim + 3 * i] -= diag[0] / mij;
                hessian[3 * i * adim + 3 * i] += diag[0] / mi;
                hessian[3 * j * adim + 3 * j] += diag[0] / mj;
                hessian[3 * i * adim + 3 * j + 1] -= xy / mij;
                hessian[(3 * j + 1) * adim + 3 * i] -= xy / mij;
                hessian[3 * i * adim + 3 * i + 1] += xy / mi;
                hessian[3 * j * adim + 3 * j + 1] += xy / mj;
                hessian[3 * i * adim + 3 * j + 2] -= xz / mij;
                hessian[(3 * j + 2) * adim + 3 * i] -= xz / mij;
                hessian[3 * i * adim + 3 * i + 2] += xz / mi;
                hessian[3 * j * adim + 3 * j + 2] += xz / mj;
                hessian[(3 * i + 1) * adim + 3 * j] -= xy / mij;
                hessian[3 * j * adim + 3 * i + 1] -= xy / mij;
                hessian[(3 * i + 1) * adim + 3 * i] += xy / mi;
                hessian[3 * j * adim + 3 * j + 1] += xy / mj;
                //fine
                hessian[(3 * i + 1) * adim + 3 * j + 1] -= diag[1] / mij;
                hessian[(3 * j + 1) * adim + 3 * i + 1] -= diag[1] / mij;
                hessian[(3 * i + 1) * adim + 3 * i + 1] += diag[1] / mi;
                hessian[(3 * j + 1) * adim + 3 * j + 1] += diag[1] / mj;
                hessian[(3 * i + 1) * adim + 3 * j + 2] -= yz / mij;
                hessian[(3 * j + 2) * adim + 3 * i + 1] -= yz / mij;
                hessian[(3 * i + 1) * adim + 3 * i + 2] += yz / mi;
                hessian[(3 * j + 2) * adim + 3 * j + 1] += yz / mj;
                hessian[(3 * i + 2) * adim + 3 * j] -= xz / mij;
                hessian[3 * j * adim + 3 * i + 2] -= xz / mij;
                hessian[(3 * i + 2) * adim + 3 * i] += xz / mi;
                hessian[3 * j * adim + 3 * j + 2] += xz / mj;
                hessian[(3 * i + 2) * adim + 3 * j + 1] -= yz / mij;
                hessian[(3 * j + 1) * adim + 3 * i + 2] -= yz / mij;
                hessian[(3 * i + 2) * adim + 3 * i + 1] += yz / mi;
                hessian[(3 * j + 1) * adim + 3 * j + 2] += yz / mj;
                //fine
                hessian[(3 * i + 2) * adim + 3 * j + 2] -= diag[2] / mij;
                hessian[(3 * j + 2) * adim + 3 * i + 2] -= diag[2] / mij;
                hessian[(3 * i + 2) * adim + 3 * i + 2] += diag[2] / mi;
                hessian[(3 * j + 2) * adim + 3 * j + 2] += diag[2] / mj;
            }
            return hessian;
        }
    }
    ;
    // adim is just the size of one dimension of the hessian (always 3*N)
    invertHessian(hessian, adim) {
        let r = SVD(hessian, adim, true, true, 1e-10);
        let u = r['orderu'], q = r['q'], vt = r['ordervt']; //v needs to be transposed
        let tol = 0.000001;
        // Make diagonal of inverse eigenvalues
        let invq = new Array(3 * this.particles.length * 3 * this.particles.length).fill(0);
        //make diagonal
        for (let i = 0; i < q.length; i++) {
            let qval = q[i];
            if (qval < tol)
                invq[i * 3 * q.length + i] = 0;
            else
                invq[i * 3 * q.length + i] = 1 / qval;
        }
        // helper functions https://stackoverflow.com/questions/27205018/multiply-2-matrices-in-javascript
        function matrixDot(A, radim, cadim, B, rbdim, cbdim) {
            // var result = new Array(A.length).fill(0).map(row => new Array(B[0].length).fill(0));
            var result = new Array(radim * cbdim).fill(0);
            return result.map((val, i) => {
                let ix = Math.floor(i / radim);
                let jx = i % radim;
                let sum = 0;
                for (let k = 0; k < rbdim; k++) {
                    sum += A[ix * cadim + k] * B[k * cbdim + jx];
                }
                return sum;
            });
        }
        // multiply
        let nf = matrixDot(u, 3 * q.length, 3 * q.length, invq, 3 * q.length, 3 * q.length); //  U*q
        // Calculate U q+ V+ (Psuedo-Inverse)
        return matrixDot(nf, 3 * q.length, 3 * q.length, vt, 3 * q.length, 3 * q.length); // U*q*Vt
    }
    ;
    getMSF(inverse, temp) {
        let MSF = [];
        for (let i = 0; i < inverse.length / 3; i++) { //for each particle
            let m = this.kb * temp * (inverse[3 * i * inverse.length + 3 * i] + inverse[(3 * i + 1) * inverse.length + 3 * i + 1] + inverse[(3 * i + 2) * inverse.length + 3 * i + 2]); //A^2
            MSF.push(m);
        }
        return MSF;
    }
    ;
    fillConnections() {
        if (this.reducedEdges.total != 0) {
            this.particles.forEach(p => p.connections = []); // Empty whatever connections were there, assumes particles only belong to one network
            this.reducedEdges.p1.forEach((one, idx) => {
                let ptwo = this.particles[this.reducedEdges.p2[idx]];
                this.particles[one].connections.push(ptwo);
            });
        }
    }
    ;
    clearConnections() {
        this.particles.forEach(p => p.connections = []); // Empty whatever connections were there, assumes particles only belong to one network
    }
    ;
}
/**
 * Templates for every network with at least one particle in refs.
 * A partial selection of a network that contains none of its edges is skipped.
 * Returns an empty array (the common case) if none of refs belong to a network.
 */
function captureNetworkTemplates(refs) {
    if (networks.length == 0)
        return [];
    const templates = [];
    networks.forEach(n => {
        const t = n.templateFor(refs);
        if (t && (t.edges.total > 0 || n.reducedEdges.total == 0))
            templates.push(t);
    });
    return templates;
}
/**
 * Create and register a new network from a template.
 * @param t template to build from
 * @param refs elements the template members index into
 */
function networkFromTemplate(t, refs) {
    const net = new Network(networks.length, t.members.map(i => refs[i]));
    net.networktype = t.networktype;
    net.cutoff = t.cutoff;
    insertNetwork(net);
    net.rebuild(net.particles, t.edges.clone());
    if (t.onscreen && net.reducedEdges.total != 0)
        net.toggleVis();
    return net;
}
/**
 * Renumber networks so that nid matches the index in the networks array,
 * and redraw the network lists in the UI to match.
 */
function refreshNetworkUI() {
    networks.forEach((n, i) => n.nid = i);
    const selectList = document.getElementById("networks");
    if (selectList)
        selectList.innerHTML = "";
    networks.forEach((n, i) => view.addNetwork(i));
    if (flux.fluxWindowOpen) {
        const readyList = document.getElementById("readynetlist");
        if (readyList)
            readyList.innerHTML = "";
        networks.forEach((n, i) => { if (n.fittingReady)
            view.addNetworkData(i); });
    }
}
/**
 * Add a network to the networks array at the given position and select it.
 */
function insertNetwork(net, index = networks.length) {
    networks.splice(Math.min(index, networks.length), 0, net);
    refreshNetworkUI();
    selectednetwork = net.nid;
}
/**
 * Remove a network from the scene, the networks array and the UI.
 */
function removeNetwork(net) {
    const index = networks.indexOf(net);
    if (index < 0)
        return;
    if (net.onscreen)
        net.toggleVis();
    net.clearConnections();
    networks.splice(index, 1);
    refreshNetworkUI();
    if (selectednetwork == index) {
        selectednetwork = networks.length > 0 ? networks.length - 1 : -1;
    }
    else if (selectednetwork > index) {
        selectednetwork -= 1;
    }
}
/**
 * Remove deleted particles (and their edges) from all networks.
 * Networks left without particles are removed entirely.
 */
function pruneNetworks(deleted) {
    networks.slice().forEach(net => {
        if (!net.particles.some(p => deleted.has(p)))
            return;
        const survivors = net.particles.filter(p => !deleted.has(p));
        if (survivors.length == 0) {
            removeNetwork(net);
        }
        else {
            // survivors keep network order, so the template members are just 0..n-1
            net.rebuild(survivors, net.templateFor(survivors).edges);
        }
    });
}
