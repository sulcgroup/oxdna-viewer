/**
 * A simple class meant for easy generation AND deletion of networks
 *
 *
 * Data arrays are constant sized, so new particles added to the scene must be initialized in their own system.
 */
class Edges {
    p1: number[];
    p2: number[];
    ks: number[];
    types: string[];
    eqDist: number[];
    total: number;
    extraParams: any[];
    constructor() {
        this.total = 0;
        this.p1 = [];
        this.p2 = [];
        this.ks = [];
        this.eqDist = [];
        this.types = [];
        this.extraParams = [];
    }
    addEdge(id1: number, id2: number, eqdist:number, type:string, k: number =1, xparams: any[] = []) {
        if (id1 < id2) {
            this.p1.push(id1);
            this.p2.push(id2);
            this.ks.push(k);
            this.types.push(type);
            this.eqDist.push(eqdist);
            this.extraParams.push(xparams);
            this.total += 1;
        } else if (id2 > id1) {
            this.p1.push(id2);
            this.p2.push(id1);
            this.ks.push(k);
            this.eqDist.push(eqdist);
            this.extraParams.push(xparams);
            this.types.push(type);
            this.total += 1;
        }
    }
    ;
    removeEdge(id1: number, id2: number){
        if (id1 == id2) return;
        for(let i = 0; i < this.total; i++){
            if((this.p1[i] == id1 && this.p2[i] == id2) || (this.p1[i] == id2 && this.p2[i] == id1)){
                this.p1.splice(i, 1);
                this.p2.splice(i, 1);
                this.ks.splice(i, 1);
                this.types.splice(i,1);
                this.eqDist.splice(i,1);
                this.extraParams.splice(i, 1);
                this.total -= 1;
                break;
            }
        }
    };
    clearAll(){
        this.p1 = [];
        this.p2 = [];
        this.ks = [];
        this.eqDist = [];
        this.types = [];
        this.extraParams = []
        this.total = 0;
    };
}


class Network {
    //Added to Merge ANM and Network
    // id: number
    system: System;
    INSTANCES: number;
    offsets: Float32Array;
    rotations: Float32Array;
    colors: Float32Array;
    scales: Float32Array;
    visibility: Float32Array;
    //removed children
    geometry: THREE.InstancedBufferGeometry;
    network: THREE.Mesh; // not sure what this does yet
    // network implementation
    particles: number[];
    nid: number;
    reducedEdges: Edges;
    masses: number[];
    types: string[];
    kb : number;
    simFC : number;
    elemcoords;
    networktype: string; //networktype defined in any edge fill call
    fittingReady: boolean; //Tells UI whether this network is ready to be displayed
    onscreen: boolean; // Tells UI whether this network is in the scene or not
    // id is used by the visualizer as it is a system object (sorta)
    // nid is the network identifier only
    constructor(nid, selectedMonomers) {
        this.particles = selectedMonomers.map(mon => {return mon.id;});
        this.initInstances(this.particles.length);
        this.types = selectedMonomers.map(mon => {return mon.type;});
        this.masses = [];
        this.fillMasses(selectedMonomers);
        this.nid = nid; // Separate Indexing for network objects?
        this.reducedEdges = new Edges();
        this.simFC = 0.05709; // gamma_sim
        this.kb = 0.00138064852; //Boltzmann Constant in pN/A
        this.networktype = 'empty';
        this.onscreen = false;
        this.elemcoords = {
            xI: selectedMonomers.map(e => e.getPos().x),
            yI: selectedMonomers.map(e => e.getPos().y),
            zI: selectedMonomers.map(e => e.getPos().z),
            distance: function(i: number, j: number){
                return Math.sqrt((this.xI[i] - this.xI[j])**2 + (this.yI[i] - this.yI[j])**2 + (this.zI[i] - this.zI[j])**2)
            },
            rotation: function(i: number, j: number):THREE.Quaternion{
                return new THREE.Quaternion().setFromUnitVectors(
                    new THREE.Vector3(0, 1, 0), new THREE.Vector3(this.xI[i]-this.xI[j],this.yI[i]-this.yI[j], this.zI[i]-this.zI[j])
                );
            },
            center: function(i: number, j:number){ // midpoint b/t two particles
                return new THREE.Vector3((this.xI[i]-this.xI[j])/2, (this.yI[i]-this.yI[j])/2, (this.zI[i]-this.zI[j])/2);
            }
        };
    }
    ;
    //The below functions are for merging the ANM and Network
    initInstances(nInstances: number) {
        this.INSTANCES = nInstances;
        this.offsets = new Float32Array(this.INSTANCES * 3);
        this.rotations = new Float32Array(this.INSTANCES * 4);
        this.colors = new Float32Array(this.INSTANCES * 3);
        this.scales = new Float32Array(this.INSTANCES * 3);
        this.visibility = new Float32Array(this.INSTANCES * 3);
    }
    ;
    toJson(){
        // We'll write this in a little bit
    }
    ;
    selectNetwork(){
        api.selectElementIDs(this.particles, false);
    }
    ;
    sendtoUI(){
        this.fittingReady = true;
    }
    ;
    fillVec(vecName, unitSize, pos, vals) {
        for (let i = 0; i < unitSize; i++) {
            this[vecName][pos * unitSize + i] = vals[i]
        }
    }
    ;
    fillMasses(mon: BasicElement[]) {
        this.masses =[];
        mon.forEach(t => {
             if(t.type == 'gs'){
                 let g = t as GenericSphere;
                 this.masses.push(g.mass);
             } else {
                 this.masses.push(1);
             }
         })
    }
    ;
    prepVis(){ // Call after filling edges!
        this.geometry = instancedConnector.clone();
        this.geometry.addAttribute( 'instanceOffset', new THREE.InstancedBufferAttribute(this.offsets, 3));
        this.geometry.addAttribute( 'instanceRotation', new THREE.InstancedBufferAttribute(this.rotations, 4));
        this.geometry.addAttribute( 'instanceColor', new THREE.InstancedBufferAttribute(this.colors, 3));
        this.geometry.addAttribute( 'instanceScale', new THREE.InstancedBufferAttribute(this.scales, 3));
        this.geometry.addAttribute( 'instanceVisibility', new THREE.InstancedBufferAttribute(this.visibility, 3 ));

        this.network = new THREE.Mesh(this.geometry, instanceMaterial);
        this.network.frustumCulled = false;
    }
    ;
    toggleVis(){
        if(this.onscreen){ // if shown in canvas
            scene.remove(this.network);
            this.onscreen = false;
            render();
            canvas.focus();
        } else {
            scene.add(this.network);
            this.onscreen = true;
            render();
            canvas.focus();
        }
    }
    // Functions above are meant to be more universal

    // Functions below are specific to generating each network, I call these in specific network wrappers in editing.ts
    initEdges(){ // Fills vectors for edges from Par File
        //init general color
        const col = backboneColors[this.nid % backboneColors.length+1];
        // fill vectors for all edges in network
        for(let t = 0; t < this.reducedEdges.total; t++){
            let i = this.reducedEdges.p1[t];
            let j = this.reducedEdges.p2[t];
            let pos = this.elemcoords.center(i, j);
            let rot = this.elemcoords.rotation(i, j);
            let dij = this.elemcoords.distance(i, j);
            this.fillVec('offsets', 3, this.nid, [pos.x, pos.y, pos.z]);
            this.fillVec('rotations', 4, this.nid,[rot.w, rot.z, rot.y, rot.x]);
            this.fillVec('colors', 3, this.nid, [col.r, col.g, col.b]);
            this.fillVec('scales', 3, this.nid, [1, dij, 1]);
            this.fillVec('visibility', 3, this.nid, [1, 1, 1]);
        }
    }
    ;

    edgesByCutoff(cutoffValueAngstroms: number){
        this.reducedEdges.clearAll();
        this.selectNetwork();
        let elems: BasicElement[] = Array.from(selectedBases);
        if(elems.length > 2000){
            notify("Large Networks (n>2000) cannot be solved here. Please use the Python scripts provided at URMOM");
            return;
        }

        //init general color
        const col = backboneColors[this.nid % backboneColors.length+1];

        let simCutoffValue = cutoffValueAngstroms/8.518; //sim unit conversion
        for(let i = 0; i < this.elemcoords.xI.length; i++){
            for(let j = 1; j < this.elemcoords.xI.length; j++){
                if(i >= j) continue;
                let dij = this.elemcoords.distance(i, j);
                if(dij <= simCutoffValue){
                    this.reducedEdges.addEdge(i, j, dij, 's', 1);
                    //get network ready for viewing
                    let pos = this.elemcoords.center(i, j);
                    let rot = this.elemcoords.rotation(i, j);
                    this.fillVec('offsets', 3, this.nid, [pos.x, pos.y, pos.z]);
                    this.fillVec('rotations', 4, this.nid,[rot.w, rot.z, rot.y, rot.x]);
                    this.fillVec('colors', 3, this.nid, [col.r, col.g, col.b]);
                    this.fillVec('scales', 3, this.nid, [1, dij, 1]);
                    this.fillVec('visibility', 3, this.nid, [1, 1, 1]);
                }
            }
        }

        // network is ready for solving
        this.networktype = "ANM";
        if(this.reducedEdges.total != 0) {
            this.prepVis();
            this.sendtoUI();
        }
    }
    ;
    generateHessian(): number[][] {
        let hessian : number[][] = [];
        if(this.reducedEdges.total==0){
            notify("Network must be filled prior to solving ANM");
        } else {
            //Initialize Empty Hessian (3Nx3N)
            let tmp = new Array(3*this.particles.length) //3N
            for(let i=0; i<3*this.particles.length; i++){ //3N x
                hessian.push(tmp);
                for(let j=0; j<3*this.particles.length; j++){
                    hessian[i][j] = 0;
                }
            }

            //Hessian Calc w/ Masses
            for(let l=0; l<this.reducedEdges.total; l++){
                let i = this.reducedEdges.p1[l], j = this.reducedEdges.p2[l], k = this.reducedEdges.ks[l];
                let ip = api.getElements([this.particles[i]])[0].getPos(); //Particle i Position
                let jp = api.getElements([this.particles[j]])[0].getPos(); //Particle j Position
                let mi = this.masses[i];
                let mj = this.masses[j];
                let mij = Math.sqrt(mi*mj); //masses
                let mi2 = mi*mi;
                let mj2 = mj*mj;
                let d = ip.distanceTo(jp); //distances
                let d2 = d*d;
                let diff = jp.sub(ip);
                let diag = diff.clone().multiply(diff).multiplyScalar(k).divideScalar(d2);
                let xy = k * (diff.x * diff.y)/d2;
                let xz = k * (diff.x * diff.z)/d2;
                let yz = k * (diff.y * diff.z)/d2;
                // Couldn't find a more pleasant way to do this
                // Fills 1 element in hij, hji, hii, hjj on each line
                // Verified this returns correct Hessian
                hessian[3*i][3*j] -= diag.x/mij;
                hessian[3*j][3*i] -= diag.x/mij;

                hessian[3*i][3*i] += diag.x/mi2;
                hessian[3*j][3*j] += diag.x/mj2;

                hessian[3*i][3*j+1] -= xy/mij;
                hessian[3*j+1][3*i] -= xy/mij;

                hessian[3*i][3*i+1] += xy/mi2;
                hessian[3*j+1][3*j] += xy/mj2;

                hessian[3*i][3*j+2] -= xz/mij;
                hessian[3*j+2][3*i] -= xz/mij;

                hessian[3*i][3*i+2] += xz/mi2;
                hessian[3*j+2][3*j] += xz/mj2;

                hessian[3*i+1][3*j] -= xy/mij;
                hessian[3*j][3*i+1] -= xy/mij;

                hessian[3*i+1][3*i] += xy/mi2;
                hessian[3*j][3*j+1] += xy/mj2;

                //fine
                hessian[3*i+1][3*j+1] -= diag.y/mij;
                hessian[3*j+1][3*i+1] -= diag.y/mij;

                hessian[3*i+1][3*i+1] += diag.y/mi2;
                hessian[3*j+1][3*j+1] += diag.y/mj2;

                hessian[3*i+1][3*j+2] -= yz/mij;
                hessian[3*j+2][3*i+1] -= yz/mij;

                hessian[3*i+1][3*i+2] += yz/mi2;
                hessian[3*j+2][3*j+1] += yz/mj2;

                hessian[3*i+2][3*j] -= xz/mij;
                hessian[3*j][3*i+2] -= xz/mij;

                hessian[3*i+2][3*i] += xz/mi2;
                hessian[3*j][3*j+2] += xz/mj2;

                hessian[3*i+2][3*j+1] -= yz/mij;
                hessian[3*j+1][3*i+2] -= yz/mij;

                hessian[3*i+2][3*i+1] += yz/mi2;
                hessian[3*j+1][3*j+2] += yz/mj2;

                //fine
                hessian[3*i+2][3*j+2] -= diag.z/mij;
                hessian[3*j+2][3*i+2] -= diag.z/mij;

                hessian[3*i+2][3*i+2] += diag.z/mi2;
                hessian[3*j+2][3*j+2] += diag.z/mj2;
            }
        return hessian;

        }
    }
    ;
    invertHessian(hessian: number[][]): number[][]{
        let r = SVD(hessian, true, true, 1e-10);
        let u = r['orderu'], q = r['q'], vt=r['ordervt']; //v needs to be transposed

        let tol = 0.000001;

        // Make diagonal of inverse eigenvalues
        let invq: number[][]= [];
        for(let i=0; i<3*this.particles.length; i++){ //3N x
            let tmp = new Array(3*this.particles.length) //3N
            for(let j=0; j<3*this.particles.length; j++){
                tmp[j] = 0;
            }
            invq.push(tmp);
        }

        //make diagonal
        for(let i = 0; i < q.length; i++){
            let qval = q[i];
            if(qval < tol) invq[i][i] = 0;
            else invq[i][i] = 1/qval;
        }

        // helper functions https://stackoverflow.com/questions/27205018/multiply-2-matrices-in-javascript
        function matrixDot (A, B) {
            var result = new Array(A.length).fill(0).map(row => new Array(B[0].length).fill(0));

            return result.map((row, i) => {
                return row.map((val, j) => {
                    return A[i].reduce((sum, elm, k) => sum + (elm*B[k][j]) ,0)
                })
            })
        }

        // multiply
        let nf = matrixDot(u, invq); //  U*q

        // Calculate U q+ V+ (Psuedo-Inverse)
        return matrixDot(nf, vt); // U*q*Vt
    }
    ;
    getRMSF(inverse : number[][], temp: number): number[] { //Root Mean Square Fluctuaction in A^2
        let RMSF = [];
        for(let i = 0; i < inverse.length/3; i++){ //for each particle
            let r = this.kb * temp * (inverse[3*i][3*i] + inverse[3*i+1][3*i+1] + inverse[3*i+2][3*i+2]); //A^2
            RMSF.push(r);
        }
        return RMSF;
    }
    ;

}