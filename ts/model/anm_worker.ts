// helper functions https://stackoverflow.com/questions/27205018/multiply-2-matrices-in-javascript
function matrixDot(A, radim, cadim, B, rbdim, cbdim) {
    // var result = new Array(A.length).fill(0).map(row => new Array(B[0].length).fill(0));
    var result = new Array(radim * cbdim).fill(0);
    return result.map((val, i) => {
        let ix = Math.floor(i / radim);
        let jx = i % radim;
        let sum = 0;
        for (let k = 0; k < rbdim; k++) {
            sum += A[ix * cadim + k] * B[k * cbdim + jx]
        }
        return sum
    })
}
// guess what this function does
let ordervector = function (vec: number[], order: number[]): number[] {
    //let nvec = vec.slice(); // slice is very much deepcopy
    let tmp = 0;
    for (let j = 0; j < vec.length; j++) {
        //nvec[j] = vec[order[j]];
        tmp = vec[j];
        vec[j] = vec[order[j]];
        vec[order[j]] = tmp;
    }
    return vec;
}

let ordervector2 = function(u, start, adim, order){
    let tmp = 0;
    for (let j = start; j < adim+start; j++) {
        tmp = u[j];
        u[j] = u[order[j]];
        u[order[j]] = tmp;
    }
    return u;
} 

function SVD2(a: number[], adim, withu: boolean, withv: boolean, eps: number) {
    // Define default parameters
    withu = withu !== undefined ? withu : true
    withv = withv !== undefined ? withv : true
    // eps = eps || Math.pow(2, -52)
    eps = Math.pow(2, -52);
    // let tol = 1e-64 / eps
    let tol = 2e-12;

    // dimensions (square matrix)
    let dim = adim
    //accessing a matrix a[i][j] = a[i*adim + j]

    // throw error if a is not defined
    if (!a) {
        throw new TypeError('Matrix a is not defined')
    }

    // Householder's reduction to bidiagonal form
    // let dims = a.dimensions();
    // const n = dims['rows']
    // const m = dims['columns']
    const n = adim
    const m = adim

    if (m < n) {
        throw new TypeError('Invalid matrix: m < n')
    }

    let i, j, k, l, l1, c, f, g, h, s, x, y, z

    g = 0
    x = 0
    const e = []

    // const u = []
    // const v = []

    const mOrN = (withu === false) ? m : n

    let u = new Array(m * mOrN).fill(0); // first index m[i*m+j]
    let v = new Array(n * n).fill(0); // first index n [i *n + j]
    // Initialize q
    const q = new Array(n).fill(0)

    // // Initialize u
    // for (i = 0; i < m; i++) {
    //     u[i] = new Array(mOrN).fill(0)
    // }
    //
    // // Initialize v
    // for (i = 0; i < n; i++) {
    //     v[i] = new Array(n).fill(0)
    // }


    console.log('Copy array a in u');
    // Copy array a in u
    for (i = 0; i < m; i++) {
        for (j = 0; j < n; j++) {
            u[i * m + j] = a[i * adim + j]
        }
    }

    for (i = 0; i < n; i++) {
        e[i] = g
        s = 0
        l = i + 1
        for (j = i; j < m; j++) {
            s += Math.pow(u[j * m + i], 2)
        }
        if (s < tol) {
            g = 0
        } else {
            f = u[i * m + i]
            g = f < 0 ? Math.sqrt(s) : -Math.sqrt(s)
            h = f * g - s
            u[i * m + i] = f - g
            for (j = l; j < n; j++) {
                s = 0
                for (k = i; k < m; k++) {
                    s += u[k * m + i] * u[k * m + j]
                }
                f = s / h
                for (k = i; k < m; k++) {
                    u[k * m + j] = u[k * m + j] + f * u[k * m + i]
                }
            }
        }
        q[i] = g
        s = 0
        for (j = l; j < n; j++) {
            s += Math.pow(u[i * m + j], 2)
        }
        if (s < tol) {
            g = 0
        } else {
            f = u[i * m + i + 1]
            g = f < 0 ? Math.sqrt(s) : -Math.sqrt(s)
            h = f * g - s
            u[i * m + i + 1] = f - g
            for (j = l; j < n; j++) {
                e[j] = u[i * m + j] / h
            }
            for (j = l; j < m; j++) {
                s = 0
                for (k = l; k < n; k++) {
                    s += u[j * m + k] * u[i * m + k]
                }
                for (k = l; k < n; k++) {
                    u[j * m + k] = u[j * m + k] + s * e[k]
                }
            }
        }
        y = Math.abs(q[i]) + Math.abs(e[i])
        if (y > x) {
            x = y
        }
    }
    console.log('Accumulation of right-hand transformations');
    // Accumulation of right-hand transformations
    if (withv) {
        for (i = n - 1; i >= 0; i--) {
            if (g !== 0) {
                h = u[i * m + i + 1] * g
                for (j = l; j < n; j++) {
                    v[j * n + i] = u[i * m + j] / h
                }
                for (j = l; j < n; j++) {
                    s = 0
                    for (k = l; k < n; k++) {
                        s += u[i * m + k] * v[k * n + j]
                    }
                    for (k = l; k < n; k++) {
                        v[k * n + j] = v[k * n + j] + s * v[k * n + i]
                    }
                }
            }
            for (j = l; j < n; j++) {
                v[i * n + j] = 0
                v[j * n + i] = 0
            }
            v[i * n + i] = 1
            g = e[i]
            l = i
        }
    }
    // Accumulation of left-hand transformations
    console.log('Accumulation of left-hand transformations');
    for (i = n; i < m; i++) {
        for (j = n; j < m; j++) {
            u[i * m + j] = 0
        }
        u[i * m + i] = 1
    }

    if (withu) {
        for (i = n - 1; i >= 0; i--) {
            l = i + 1
            g = q[i]
            for (j = l; j < mOrN; j++) {
                u[i * m + j] = 0
            }
            if (g !== 0) {
                h = u[i * m + i] * g
                for (j = l; j < mOrN; j++) {
                    s = 0
                    for (k = l; k < m; k++) {
                        s += u[k * m + i] * u[k * m + j]
                    }
                    f = s / h
                    for (k = i; k < m; k++) {
                        u[k * m + j] = u[k * m + j] + f * u[k * m + i]
                    }
                }
                for (j = i; j < m; j++) {
                    u[j * m + i] = u[j * m + i] / g
                }
            } else {
                for (j = i; j < m; j++) {
                    u[j * m + i] = 0
                }
            }
            u[i * m + i] = u[i * m + i] + 1
        }
    }

    // Diagonalization of the bidiagonal form
    console.log('Diagonalization of the bidiagonal form');
    eps = eps * x;
    let testConvergence=undefined;
    for (k = n - 1; k >= 0; k--) {
        for (let iteration = 0; iteration < 50; iteration++) {
            // test-f-splitting
            testConvergence = false
            for (l = k; l >= 0; l--) {
                if (Math.abs(e[l]) <= eps) {
                    testConvergence = true;
                    break;
                }
                if (Math.abs(q[l - 1]) <= eps) {
                    break;
                }
            }

            if (!testConvergence) { // cancellation of e[l] if l>0
                c = 0
                s = 1
                l1 = l - 1
                for (i = l; i < k + 1; i++) {
                    f = s * e[i];
                    e[i] = c * e[i];
                    if (Math.abs(f) <= eps) {
                        break // goto test-f-convergence
                    }
                    g = q[i];
                    q[i] = Math.sqrt(f * f + g * g);
                    h = q[i];
                    c = g / h;
                    s = -f / h;
                    if (withu) {
                        for (j = 0; j < m; j++) {
                            y = u[j * m + l1];
                            z = u[j * m + i];
                            u[j * m + l1] = y * c + (z * s);
                            u[j * m + i] = -y * s + (z * c);
                        }
                    }
                }
            }

            // test f convergence
            z = q[k];
            if (l === k) { // convergence
                if (z < 0) {
                    // q[k] is made non-negative
                    q[k] = -z;
                    if (withv) {
                        for (j = 0; j < n; j++) {
                            v[j * n + k] = -v[j * n + k];
                        }
                    }
                }
                break; // break out of iteration loop and move on to next k value
            }

            // Shift from bottom 2x2 minor
            x = q[l];
            y = q[k - 1];
            g = e[k - 1];
            h = e[k];
            f = ((y - z) * (y + z) + (g - h) * (g + h)) / (2 * h * y);
            g = Math.sqrt(f * f + 1);
            f = ((x - z) * (x + z) + h * (y / (f < 0 ? (f - g) : (f + g)) - h)) / x;

            // Next QR transformation
            c = 1;
            s = 1;
            for (i = l + 1; i < k + 1; i++) {
                g = e[i];
                y = q[i];
                h = s * g;
                g = c * g;
                z = Math.sqrt(f * f + h * h);
                e[i - 1] = z;
                c = f / z;
                s = h / z;
                f = x * c + g * s;
                g = -x * s + g * c;
                h = y * s;
                y = y * c;
                if (withv) {
                    for (j = 0; j < n; j++) {
                        x = v[j * n + i - 1];
                        z = v[j * n + i];
                        v[j * n + i - 1] = x * c + z * s;
                        v[j * n + i] = -x * s + z * c;
                    }
                }
                z = Math.sqrt(f * f + h * h);
                q[i - 1] = z;
                c = f / z;
                s = h / z;
                f = c * g + s * y;
                x = -s * g + c * y;
                if (withu) {
                    for (j = 0; j < m; j++) {
                        y = u[j * m + i - 1];
                        z = u[j * m + i];
                        u[j * m + i - 1] = y * c + z * s;
                        u[j * m + i] = -y * s + z * c;
                    }
                }
            }
            e[l] = 0;
            e[k] = f;
            q[k] = x;
        }
    }
    console.log('More stuff');
    // Must replace zeroes by unique identifier that will be set to 0 later
    // why? so sorting the vectors using indexOf doesn't return the same element multiple times
    while (q.indexOf(0) != -1) {
        let ind = q.indexOf(0);
        q[ind] = (q.length - ind) * 10 ** -15;
    }

    
    // Some values of q are zero, Replacing with values that will be below tolerance but unique for full sorting

    // To return in order by singular value,
    // you have to resort u and vt's individual vectors and the vector order of the matrix

    //Transpose v
    let vt = v.map((val, idx, arr) => {
        let [i, j] = [Math.floor(idx / adim), idx % adim]
        return arr[j * adim + i]
    });v = null; // free memory

    // let vt = v[0].map((_, colIndex) => v.map(row => row[colIndex])); //transpose v

    //let key: number[] = q.slice();
    let order = q.map(x => q.indexOf(x)); // get index order to apply same sorting to u and v
    console.log("order");
    // let ordervt = JSON.parse(JSON.stringify(vt)); //deepcopy
    // let orderu = JSON.parse(JSON.stringify(u)); //deepcopy

    //lets reorder
    let orderu = [];
    let ordervt = [];
    //working but bad
    for (i = 0; i < order.length; i++) {
        orderu.push(... ordervector(u.slice(order[i] * adim, (order[i] + 1) * adim), order)); //replace new array in correct order
        ordervt.push(... ordervector(vt.slice(order[i] * adim, (order[i] + 1) * adim), order));
    }

    // Number below eps should be zero
    for (i = 0; i < n; i++) {
        if (q[i] < eps) q[i] = 0;
    }
    //console.log(orderu);
    //console.log(ordervt);
    return { orderu, q, ordervt }
}

this.onmessage = function(e) {
    let elemcoords = {
        // coords: this.particles.map(e => e.getPos()),
        xI: e.data[0],
        yI: e.data[1],
        zI: e.data[2],
        distance: function (i: number, j: number) {
            // return this.coords[i].distanceTo(this.coords[j]);
            return Math.sqrt((this.xI[i] - this.xI[j]) ** 2 + (this.yI[i] - this.yI[j]) ** 2 + (this.zI[i] - this.zI[j]) ** 2)
        },
        center: function (i: number, j: number) { // midpoint b/t two particles
            // return this.coords[i].clone().add(this.coords[j]).divideScalar(2);
            return [(this.xI[i] + this.xI[j]) / 2, (this.yI[i] + this.yI[j]) / 2, (this.zI[i] + this.zI[j]) / 2];
        },
        diff: function (i: number, j: number) { // returns j - i
            return [(this.xI[j] - this.xI[i]), (this.yI[j] - this.yI[i]), (this.zI[j] - this.zI[i])];
        }
    };


    //generate hessian
    //Initialize Empty Hessian (3Nx3N)
    let hessian: number[] = new Array(3 * elemcoords.xI.length * 3 * elemcoords.xI.length).fill(0);
    let reducedEdges = {
        p1: e.data[3],
        p2: e.data[4],
        ks: e.data[5],
    }
    let masses = e.data[6];
    let kb = 0.00138064852;
    let temp = e.data[7]
    let adim = 3*elemcoords.xI.length;

    //Hessian Calc w/ Masses
    for (let l = 0; l < reducedEdges.p1.length; l++) {
        let i = reducedEdges.p1[l], j = reducedEdges.p2[l], k = reducedEdges.ks[l];
        let mi = masses[i];
        let mj = masses[j];
        let mij = Math.sqrt(mi * mj); //masses
        let d = elemcoords.distance(i, j); //distances
        let d2 = d * d;
        let diff = elemcoords.diff(i, j);
        // let diag = diff.clone().multiply(diff).multiplyScalar(k).divideScalar(d2);
        let diag = diff.map((val, idx)=>{return val*val*k/d2;})
        let xy = k * (diff[0] * diff[1]) / d2;
        let xz = k * (diff[0] * diff[2]) / d2;
        let yz = k * (diff[1] * diff[2]) / d2;


        // Couldn't find a more pleasant way to do this
        // Fills 1 element in hij, hji, hii, hjj on each line
        // Verified this returns correct Hessian
        hessian[3*i*adim + 3*j] -= diag[0]/mij;
        hessian[3*j*adim + 3*i] -= diag[0]/mij;

        hessian[3*i*adim + 3*i] += diag[0]/mi;
        hessian[3*j*adim + 3*j] += diag[0]/mj;

        hessian[3*i*adim + 3*j + 1] -= xy/mij;
        hessian[(3*j+1)*adim + 3*i] -= xy/mij;

        hessian[3*i*adim + 3*i + 1] += xy/mi;
        hessian[3*j*adim + 3*j + 1] += xy/mj;

        hessian[3*i*adim + 3*j + 2] -= xz/mij;
        hessian[(3*j+2)*adim + 3*i] -= xz/mij;

        hessian[3*i*adim + 3*i+2] += xz/mi;
        hessian[3*j*adim + 3*j+2] += xz/mj;

        hessian[(3*i+1)*adim + 3*j] -= xy/mij;
        hessian[3*j*adim + 3*i+1] -= xy/mij;

        hessian[(3*i+1)*adim + 3*i] += xy/mi;
        hessian[3*j*adim + 3*j+1] += xy/mj;

        //fine
        hessian[(3*i+1)*adim + 3*j+1] -= diag[1]/mij;
        hessian[(3*j+1)*adim + 3*i+1] -= diag[1]/mij;

        hessian[(3*i+1)*adim + 3*i+1] += diag[1]/mi;
        hessian[(3*j+1)*adim + 3*j+1] += diag[1]/mj;

        hessian[(3*i+1)*adim + 3*j+2] -= yz/mij;
        hessian[(3*j+2)*adim + 3*i+1] -= yz/mij;

        hessian[(3*i+1)*adim + 3*i+2] += yz/mi;
        hessian[(3*j+2)*adim + 3*j+1] += yz/mj;

        hessian[(3*i+2)*adim + 3*j] -= xz/mij;
        hessian[3*j*adim + 3*i+2] -= xz/mij;

        hessian[(3*i+2)*adim + 3*i] += xz/mi;
        hessian[3*j*adim+ 3*j+2] += xz/mj;

        hessian[(3*i+2)*adim + 3*j+1] -= yz/mij;
        hessian[(3*j+1)*adim + 3*i+2] -= yz/mij;

        hessian[(3*i+2)*adim + 3*i+1] += yz/mi;
        hessian[(3*j+1)*adim + 3*j+2] += yz/mj;

        //fine
        hessian[(3*i+2)*adim + 3*j+2] -= diag[2]/mij;
        hessian[(3*j+2)*adim + 3*i+2] -= diag[2]/mij;

        hessian[(3*i+2)*adim + 3*i+2] += diag[2]/mi;
        hessian[(3*j+2)*adim + 3*j+2] += diag[2]/mj;
    }
    console.log("hessian");


    console.log("started SVD");
    let r = SVD2(hessian, adim, true, true, 1e-10);
    console.log("finished SVD");
    let u = r['orderu'], q = r['q'], vt=r['ordervt']; //v needs to be transposed

    let tol = 0.000001;

    // Make diagonal of inverse eigenvalues
    // let invq: number[][]= [];
    // for(let i=0; i<3*this.particles.length; i++){ //3N x
    //     let tmp = new Array(3*this.particles.length) //3N
    //     for(let j=0; j<3*this.particles.length; j++){
    //         tmp[j] = 0;
    //     }
    //     invq.push(tmp);
    // }

    // Make diagonal of inverse eigenvalues
    let invq = new Array(hessian.length).fill(0);
    hessian = null;
    //let invq = new Array(q.length).fill(0);
    //make diagonal
    for(let i = 0; i < q.length; i++){
        let qval = q[i];
        if(qval < tol) invq[i*q.length + i] = 0;
        else invq[i* q.length + i] = 1/qval;
    }



    // multiply
    let nf = matrixDot(u, q.length, q.length, invq, q.length, q.length); //  U*q

    console.log("calculating inverse");
    // Calculate U q+ V+ (Psuedo-Inverse)
    let inverse = matrixDot(nf, q.length, q.length, vt, q.length, q.length); // U*q*Vt

    let RMSF = [];
    for(let i = 0; i < q.length/3; i++){ //for each particle
        let r = kb * temp * (inverse[3*i*q.length + 3*i] + inverse[(3*i+1)*q.length + 3*i+1] + inverse[(3*i+2)*q.length + 3*i+2]); //A^2
        RMSF.push(r);
    }
    postMessage(RMSF, undefined);
}