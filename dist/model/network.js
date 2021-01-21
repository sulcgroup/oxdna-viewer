/**
 * A simple class meant for easy generation AND deletion of networks
 * As proof of concept, the network
 * 
 * Data arrays are constant sized, so new particles added to the scene must be initialized in their own system.
 */
class Network {
    constructor(id, startID, selectedMonomers) {
        this.particles = selectedMonomers.map(mon => {return mon.id;})
        this.nid = id; // Separate Indexing for network objects?
        this.edges = {
            p1: [],
            p2: [],
            ks: []
            total: 0,
            addEdge: function(id1, id2, k=1) {
                if (id1 == id2) return;
                if (id1 < id2) {
                    this.p1.push(id1);
                    this.p2.push(id2);
                    this.ks.push(k);
                    this.total += 1;
                } else {
                    this.p1.push(id2);
                    this.p2.push(id1);
                    this.ks.push(k);
                    this.total += 1;
                }
            },
            removeEdge: function(id1, id2) {
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
            }
        };
        this.reducedEdges = this.edges.constructor()
        this.masses = [];

    }
    ;
    toJson(){
        // We'll write this in a little bit
    }
    ;
    selectNetwork(){
        edit.selectElementIDs(this.particles, false);
    }
    ;

    // Functions above are meant to be more universal

    // Functions below are specific to generating each network
    edgesByCutoff(cutoffValueAngstroms){
        this.selectNetwork();
        let elems = Array.from(selectedBases);
        let elemcoords = {
            xI: elems.map(e => e.getPos().x),
            yI: elems.map(e => e.getPos().y),
            zI: elems.map(e => e.getPos().z),
            distance: function(i, j){
                return Math.sqrt((this.xI[i] - this.xI[j])**2 + (this.yI[i] - this.yI[j])**2 + (this.zI[i] - this.zI[j])**2)
            }
        };

        let simCutoffValue = cutoffValueAngstroms/8.518;
        for(let i = 0; i < length(elemcoords); i++){
            for(let j = 1; j < length(elemcoords); j++){
                if(i >= j) continue;
                let dij = elemcoords.distance(i, j);
                if(dij <= simCutoffValue){
                    this.reducedEdges.addEdge(i, j);
                }
            }
        }

    }

}
;
