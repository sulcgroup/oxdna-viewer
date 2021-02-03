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
    total: number;
    constructor() {
        this.total = 0;
        this.nid = 0;
        this.p1 = [];
        this.p2 = [];
        this.ks = [];
    }
    addEdge(id1: number, id2: number, k: number =1) {
        if (id1 < id2) {
            this.p1.push(id1);
            this.p2.push(id2);
            this.ks.push(k);
            this.total += 1;
        } else if (id2 > id1) {
            this.p1.push(id2);
            this.p2.push(id1);
            this.ks.push(k);
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
                this.total -= 1;
                break;
            }
        }
    };
    clearAll(){
        this.p1 = [];
        this.p2 = [];
        this.ks = [];
        this.total = 0;
    };
}


class Network {
    particles: number[];
    nid: number;
    reducedEdges: Edges;
    masses: number[];

    constructor(nid, selectedMonomers) {
        this.particles = selectedMonomers.map(mon => {return mon.id;})
        this.nid = nid; // Separate Indexing for network objects?
        this.reducedEdges = new Edges();
        this.masses = [];
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

    // Functions above are meant to be more universal

    // Functions below are specific to generating each network
    edgesByCutoff(cutoffValueAngstroms: number){
        this.reducedEdges.clearAll();
        this.selectNetwork();
        let elems: BasicElement[] = Array.from(selectedBases);
        let elemcoords = {
            xI: elems.map(e => e.getPos().x),
            yI: elems.map(e => e.getPos().y),
            zI: elems.map(e => e.getPos().z),
            distance: function(i: number, j: number){
                return Math.sqrt((this.xI[i] - this.xI[j])**2 + (this.yI[i] - this.yI[j])**2 + (this.zI[i] - this.zI[j])**2)
            }
        };

        let simCutoffValue = cutoffValueAngstroms/8.518; //sim unit conversion
        for(let i = 0; i < elemcoords.xI.length; i++){
            for(let j = 1; j < elemcoords.xI.length; j++){
                if(i >= j) continue;
                let dij = elemcoords.distance(i, j);
                if(dij <= simCutoffValue){
                    this.reducedEdges.addEdge(i, j, 1);
                }
            }
        }
    }
    ;
    solveANM(){
        let hessian : number[] = [];
        if(this.reducedEdges.total==0){
            notify("Network must be filled prior to solving ANM");
        } else {
            //Initialize Empty Hessian (3Nx3N)
            for(let i=0; i<3*this.particles.length; i++){
                for(let j=0; j<3*this.particles.length; j++){
                    hessian.push(0);
                }
            }

            //Hessian Calc
            for(let l=0; l<this.reducedEdges.total; l++){
                let i = this.reducedEdges.p1[l], j = this.reducedEdges[l], k = this.reducedEdges[l];
                let ip = api.getElements([this.particles[i]])[0].getPos(); //Particle i Position
                let jp = api.getElements([this.particles[j]])[0].getPos(); //Particle j Position
                let d = ip.distanceTo(jp);
                let d2 = d*d;
                let diff = jp.sub(ip);
                let xy = k * (diff.x * diff.y)/d2;
                let xz = k * (diff.x * diff.z)/d2;
                let yz = k * (diff.y * diff.z)/d2;
                let flatarr = [];
            }

        }
    }

}