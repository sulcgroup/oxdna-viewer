/**
 * A simple class meant for easy generation AND deletion of networks
 * As proof of concept, the network
 *
 * Data arrays are constant sized, so new particles added to the scene must be initialized in their own system.
 */
class Edges {
    constructor() {
        this.total = 0;
    }
    addEdge(id1, id2, k = 1) {
        if (id1 < id2) {
            this.p1.push(id1);
            this.p2.push(id2);
            this.ks.push(k);
            this.total += 1;
        }
        else if (id2 > id1) {
            this.p1.push(id2);
            this.p2.push(id1);
            this.ks.push(k);
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
                this.total -= 1;
                break;
            }
        }
    }
    ;
}
class Network {
    constructor(nid, selectedMonomers) {
        this.particles = selectedMonomers.map(mon => { return mon.id; });
        this.nid = nid; // Separate Indexing for network objects?
        this.reducedEdges = new Edges();
        this.masses = [];
    }
    ;
    toJson() {
        // We'll write this in a little bit
    }
    ;
    selectNetwork() {
        api.selectElementIDs(this.particles, false);
    }
    ;
    // Functions above are meant to be more universal
    // Functions below are specific to generating each network
    edgesByCutoff(cutoffValueAngstroms) {
        this.selectNetwork();
        let elems = Array.from(selectedBases);
        let elemcoords = {
            xI: elems.map(e => e.getPos().x),
            yI: elems.map(e => e.getPos().y),
            zI: elems.map(e => e.getPos().z),
            distance: function (i, j) {
                return Math.sqrt((this.xI[i] - this.xI[j]) ** 2 + (this.yI[i] - this.yI[j]) ** 2 + (this.zI[i] - this.zI[j]) ** 2);
            }
        };
        let simCutoffValue = cutoffValueAngstroms / 8.518; //sim unit conversion
        for (let i = 0; i < elemcoords.xI.length; i++) {
            for (let j = 1; j < elemcoords.xI.length; j++) {
                if (i >= j)
                    continue;
                let dij = elemcoords.distance(i, j);
                if (dij <= simCutoffValue) {
                    this.reducedEdges.addEdge(i, j);
                }
            }
        }
    }
}
