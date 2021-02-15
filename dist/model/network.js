/**
 * A simple class meant for easy generation AND deletion of networks
 *
 *
 * Data arrays are constant sized, so new particles added to the scene must be initialized in their own system.
 */
class Edges {
    constructor() {
        this.total = 0;
        this.p1 = [];
        this.p2 = [];
        this.ks = [];
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
    clearAll() {
        this.p1 = [];
        this.p2 = [];
        this.ks = [];
        this.total = 0;
    }
    ;
}
class Network {
    constructor(nid, selectedMonomers) {
        this.particles = selectedMonomers.map(mon => { return mon.id; });
        this.types = selectedMonomers.map(mon => { return mon.type; });
        this.masses = [];
        this.fillMasses(selectedMonomers);
        this.nid = nid; // Separate Indexing for network objects?
        this.reducedEdges = new Edges();
        this.simFC = 0.05709; // gamma_sim
        this.kb = 0.00138064852; //Boltzmann Constant in pN/A
        this.networktype = 'empty';
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
    sendtoUI() {
        let ul = document.getElementById("readynetlist"); //In fluctuation Window
        let li = document.createElement("li");
        let sp1 = document.createElement("span");
        let sp2 = document.createElement("span");
        sp1.setAttribute('class', 'label');
        sp2.setAttribute('class', 'second-label');
        let name = "Network " + this.nid.toString();
        sp1.appendChild(document.createTextNode(name));
        sp2.appendChild(document.createTextNode(this.networktype));
        li.setAttribute('id', name);
        li.setAttribute('value', String(this.nid));
        li.appendChild(sp1);
        li.appendChild(sp2);
        li.onclick = function () { flux.fitData(li.value); };
        ul.appendChild(li);
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
    // Functions above are meant to be more universal
    // Functions below are specific to generating each network, I call these in specific network wrappers in editing.ts
    edgesByCutoff(cutoffValueAngstroms) {
        this.reducedEdges.clearAll();
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
                    this.reducedEdges.addEdge(i, j, 1);
                }
            }
        }
        // network is ready for solving
        this.networktype = "ANM";
        this.sendtoUI();
    }
    ;
    generateHessian() {
        let hessian = [];
        if (this.reducedEdges.total == 0) {
            notify("Network must be filled prior to solving ANM");
        }
        else {
            //Initialize Empty Hessian (3Nx3N)
            for (let i = 0; i < 3 * this.particles.length; i++) { //3N x
                let tmp = new Array(3 * this.particles.length); //3N
                for (let j = 0; j < 3 * this.particles.length; j++) {
                    tmp[j] = 0;
                }
                hessian.push(tmp);
            }
            //Hessian Calc w/ Masses
            for (let l = 0; l < this.reducedEdges.total; l++) {
                let i = this.reducedEdges.p1[l], j = this.reducedEdges.p2[l], k = this.reducedEdges.ks[l];
                let ip = api.getElements([this.particles[i]])[0].getPos(); //Particle i Position
                let jp = api.getElements([this.particles[j]])[0].getPos(); //Particle j Position
                let mi = this.masses[i];
                let mj = this.masses[j];
                let mij = Math.sqrt(mi * mj); //masses
                let mi2 = mi * mi;
                let mj2 = mj * mj;
                let d = ip.distanceTo(jp); //distances
                let d2 = d * d;
                let diff = jp.sub(ip);
                let diag = diff.clone().multiply(diff).multiplyScalar(k).divideScalar(d2);
                let xy = k * (diff.x * diff.y) / d2;
                let xz = k * (diff.x * diff.z) / d2;
                let yz = k * (diff.y * diff.z) / d2;
                // Couldn't find a more pleasant way to do this
                // Fills 1 element in hij, hji, hii, hjj on each line
                // Verified this returns correct Hessian
                hessian[3 * i][3 * j] -= diag.x / mij;
                hessian[3 * j][3 * i] -= diag.x / mij;
                hessian[3 * i][3 * i] += diag.x / mi2;
                hessian[3 * j][3 * j] += diag.x / mj2;
                hessian[3 * i][3 * j + 1] -= xy / mij;
                hessian[3 * j + 1][3 * i] -= xy / mij;
                hessian[3 * i][3 * i + 1] += xy / mi2;
                hessian[3 * j + 1][3 * j] += xy / mj2;
                hessian[3 * i][3 * j + 2] -= xz / mij;
                hessian[3 * j + 2][3 * i] -= xz / mij;
                hessian[3 * i][3 * i + 2] += xz / mi2;
                hessian[3 * j + 2][3 * j] += xz / mj2;
                hessian[3 * i + 1][3 * j] -= xy / mij;
                hessian[3 * j][3 * i + 1] -= xy / mij;
                hessian[3 * i + 1][3 * i] += xy / mi2;
                hessian[3 * j][3 * j + 1] += xy / mj2;
                //fine
                hessian[3 * i + 1][3 * j + 1] -= diag.y / mij;
                hessian[3 * j + 1][3 * i + 1] -= diag.y / mij;
                hessian[3 * i + 1][3 * i + 1] += diag.y / mi2;
                hessian[3 * j + 1][3 * j + 1] += diag.y / mj2;
                hessian[3 * i + 1][3 * j + 2] -= yz / mij;
                hessian[3 * j + 2][3 * i + 1] -= yz / mij;
                hessian[3 * i + 1][3 * i + 2] += yz / mi2;
                hessian[3 * j + 2][3 * j + 1] += yz / mj2;
                hessian[3 * i + 2][3 * j] -= xz / mij;
                hessian[3 * j][3 * i + 2] -= xz / mij;
                hessian[3 * i + 2][3 * i] += xz / mi2;
                hessian[3 * j][3 * j + 2] += xz / mj2;
                hessian[3 * i + 2][3 * j + 1] -= yz / mij;
                hessian[3 * j + 1][3 * i + 2] -= yz / mij;
                hessian[3 * i + 2][3 * i + 1] += yz / mi2;
                hessian[3 * j + 1][3 * j + 2] += yz / mj2;
                //fine
                hessian[3 * i + 2][3 * j + 2] -= diag.z / mij;
                hessian[3 * j + 2][3 * i + 2] -= diag.z / mij;
                hessian[3 * i + 2][3 * i + 2] += diag.z / mi2;
                hessian[3 * j + 2][3 * j + 2] += diag.z / mj2;
            }
            return hessian;
        }
    }
    ;
    invertHessian(hessian) {
        let r = SVD(hessian, true, true, 1e-10);
        let u = r['orderu'], q = r['q'], v = r['orderv']; //v needs to be transposed
        let vt = v[0].map((_, colIndex) => v.map(row => row[colIndex])); //transpose v
        let tol = 0.000001;
        // Make diagonal of inverse eigenvalues
        let invq = [];
        for (let i = 0; i < 3 * this.particles.length; i++) { //3N x
            let tmp = new Array(3 * this.particles.length); //3N
            for (let j = 0; j < 3 * this.particles.length; j++) {
                tmp[j] = 0;
            }
            invq.push(tmp);
        }
        //make diagonal
        for (let i = 0; i < q.length; i++) {
            let qval = q[i];
            if (qval < tol)
                invq[i][i] = 0;
            else
                invq[i][i] = 1 / qval;
        }
        // multiply
        // helper functions https://stackoverflow.com/questions/27205018/multiply-2-matrices-in-javascript
        function matrixDot(A, B) {
            var result = new Array(A.length).fill(0).map(row => new Array(B[0].length).fill(0));
            return result.map((row, i) => {
                return row.map((val, j) => {
                    return A[i].reduce((sum, elm, k) => sum + (elm * B[k][j]), 0);
                });
            });
        }
        function signflip(x) {
            let newx = [];
            for (let i = 0; i < x.length; i++) {
                let tmp = new Array(x.length);
                for (let j = 0; j < x[0].length; j++) {
                    tmp[j] = 0;
                }
                newx[i] = tmp;
            }
            for (let i = 0; i < x.length; i++) {
                for (let j = 0; j < x[0].length; j++) {
                    newx[i][j] = x[i][j] * -1;
                }
            }
            return newx;
        }
        let fir = matrixDot(signflip(u), invq); // Matches uw exactly from python implementation comparison
        let nf = matrixDot(u, invq);
        let nftry = matrixDot(nf, v);
        let nf2 = matrixDot(nf, vt);
        let nf3 = matrixDot(nf, signflip(v));
        let nf4 = matrixDot(nf, signflip(vt));
        let sec = matrixDot(signflip(vt), fir);
        let thir = matrixDot(vt, fir);
        let four = matrixDot(fir, vt);
        let five = matrixDot(fir, signflip(vt));
        let six = matrixDot(fir, signflip(v));
        let sev = matrixDot(fir, v);
        let eig = matrixDot(v, fir);
        let nin = matrixDot(signflip(v), fir);
        let x = 5;
        // Calculate U q+ V+ (Psuedo-Inverse)
        return sec;
    }
    ;
    getRMSF(inverse, temp) {
        let RMSF = [];
        for (let i = 0; i < inverse.length / 3; i++) { //for each particle
            let r = this.kb * temp * (inverse[3 * i][3 * i] + inverse[3 * i + 1][3 * i + 1] + inverse[3 * i + 2][3 * i + 2]); //A^2
            RMSF.push(r);
        }
        return RMSF;
    }
    ;
}
