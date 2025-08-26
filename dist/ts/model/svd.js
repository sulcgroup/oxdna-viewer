/** SVD procedure as explained in "Singular Value Decomposition and Least Squares Solutions. By G.H. Golub et al."
 *
 * Edited by Jonah Procyk 2/16/21, Major edits to properly sort the eigenvalues and eigenvectors
 *
 * This procedure computes the singular values and complete orthogonal decomposition of a real rectangular matrix A:
 *    A = U * diag(q) * V(t), U(t) * U = V(t) * V = I
 * where the arrays a, u, v, q represent A, U, V, q respectively. The actual parameters corresponding to a, u, v may
 * all be identical unless withu = withv = {true}. In this case, the actual parameters corresponding to u and v must
 * differ. m >= n is assumed (with m = a.length and n = a[0].length)
 *
 *  @param a {Array} Represents the matrix A to be decomposed
 *  @param [withu] {bool} {true} if U is desired {false} otherwise (MUST ALWAYS BE TRUE)
 *  @param [withv] {bool} {true} if U is desired {false} otherwise (MUST ALWAYS BE TRUE)
 *  @param [eps] {Number} A constant used in the test for convergence; should not be smaller than the machine precision
 *                      Hard Coded to be 2 ** -52
 *  [tol] {Number} Hard Coded to be 2e-12
 *
 *  @returns {Object} An object containing THE SORTED VALUES AND VECTORS:
 *    q: A vector holding the singular values of A; they are non-negative but not necessarily ordered in
 *      decreasing sequence
 *    u: Represents the matrix U with orthonormalized columns (if withu is {true} otherwise u is used as
 *      a working storage)
 *    vt: Represents the orthogonal matrix Vt (if withv is {true}, otherwise v is not used)
 *
 */
// Also i have edited everything to be 1D arrays for better storage
const SVD = (a, adim, withu, withv, eps) => {
    // Define default parameters
    withu = withu !== undefined ? withu : true;
    withv = withv !== undefined ? withv : true;
    // eps = eps || Math.pow(2, -52)
    eps = Math.pow(2, -52);
    // let tol = 1e-64 / eps
    let tol = 2e-12;
    //accessing a matrix a[i][j] = a[i*adim + j]
    // throw error if a is not defined
    if (!a) {
        throw new TypeError('Matrix a is not defined');
    }
    // Householder's reduction to bidiagonal form
    // let dims = a.dimensions();
    // const n = dims['rows']
    // const m = dims['columns']
    const n = adim;
    const m = adim;
    if (m < n) {
        throw new TypeError('Invalid matrix: m < n');
    }
    let i, j, k, l, l1, c, f, g, h, s, x, y, z;
    g = 0;
    x = 0;
    const e = [];
    // const u = []
    // const v = []
    const mOrN = (withu === false) ? m : n;
    let u = new Array(m * mOrN).fill(0); // first index m[i*m+j]
    let v = new Array(n * n).fill(0); // first index n [i *n + j]
    // Initialize q
    const q = new Array(n).fill(0);
    // // Initialize u
    // for (i = 0; i < m; i++) {
    //     u[i] = new Array(mOrN).fill(0)
    // }
    //
    // // Initialize v
    // for (i = 0; i < n; i++) {
    //     v[i] = new Array(n).fill(0)
    // }
    // Copy array a in u
    for (i = 0; i < m; i++) {
        for (j = 0; j < n; j++) {
            u[i * m + j] = a[i * adim + j];
        }
    }
    for (i = 0; i < n; i++) {
        e[i] = g;
        s = 0;
        l = i + 1;
        for (j = i; j < m; j++) {
            s += Math.pow(u[j * m + i], 2);
        }
        if (s < tol) {
            g = 0;
        }
        else {
            f = u[i * m + i];
            g = f < 0 ? Math.sqrt(s) : -Math.sqrt(s);
            h = f * g - s;
            u[i * m + i] = f - g;
            for (j = l; j < n; j++) {
                s = 0;
                for (k = i; k < m; k++) {
                    s += u[k * m + i] * u[k * m + j];
                }
                f = s / h;
                for (k = i; k < m; k++) {
                    u[k * m + j] = u[k * m + j] + f * u[k * m + i];
                }
            }
        }
        q[i] = g;
        s = 0;
        for (j = l; j < n; j++) {
            s += Math.pow(u[i * m + j], 2);
        }
        if (s < tol) {
            g = 0;
        }
        else {
            f = u[i * m + i + 1];
            g = f < 0 ? Math.sqrt(s) : -Math.sqrt(s);
            h = f * g - s;
            u[i * m + i + 1] = f - g;
            for (j = l; j < n; j++) {
                e[j] = u[i * m + j] / h;
            }
            for (j = l; j < m; j++) {
                s = 0;
                for (k = l; k < n; k++) {
                    s += u[j * m + k] * u[i * m + k];
                }
                for (k = l; k < n; k++) {
                    u[j * m + k] = u[j * m + k] + s * e[k];
                }
            }
        }
        y = Math.abs(q[i]) + Math.abs(e[i]);
        if (y > x) {
            x = y;
        }
    }
    // Accumulation of right-hand transformations
    if (withv) {
        for (i = n - 1; i >= 0; i--) {
            if (g !== 0) {
                h = u[i * m + i + 1] * g;
                for (j = l; j < n; j++) {
                    v[j * n + i] = u[i * m + j] / h;
                }
                for (j = l; j < n; j++) {
                    s = 0;
                    for (k = l; k < n; k++) {
                        s += u[i * m + k] * v[k * n + j];
                    }
                    for (k = l; k < n; k++) {
                        v[k * n + j] = v[k * n + j] + s * v[k * n + i];
                    }
                }
            }
            for (j = l; j < n; j++) {
                v[i * n + j] = 0;
                v[j * n + i] = 0;
            }
            v[i * n + i] = 1;
            g = e[i];
            l = i;
        }
    }
    // Accumulation of left-hand transformations
    for (i = n; i < m; i++) {
        for (j = n; j < m; j++) {
            u[i * m + j] = 0;
        }
        u[i * m + i] = 1;
    }
    if (withu) {
        for (i = n - 1; i >= 0; i--) {
            l = i + 1;
            g = q[i];
            for (j = l; j < mOrN; j++) {
                u[i * m + j] = 0;
            }
            if (g !== 0) {
                h = u[i * m + i] * g;
                for (j = l; j < mOrN; j++) {
                    s = 0;
                    for (k = l; k < m; k++) {
                        s += u[k * m + i] * u[k * m + j];
                    }
                    f = s / h;
                    for (k = i; k < m; k++) {
                        u[k * m + j] = u[k * m + j] + f * u[k * m + i];
                    }
                }
                for (j = i; j < m; j++) {
                    u[j * m + i] = u[j * m + i] / g;
                }
            }
            else {
                for (j = i; j < m; j++) {
                    u[j * m + i] = 0;
                }
            }
            u[i * m + i] = u[i * m + i] + 1;
        }
    }
    // Diagonalization of the bidiagonal form
    eps = eps * x;
    let testConvergence;
    for (k = n - 1; k >= 0; k--) {
        for (let iteration = 0; iteration < 50; iteration++) {
            // test-f-splitting
            testConvergence = false;
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
                c = 0;
                s = 1;
                l1 = l - 1;
                for (i = l; i < k + 1; i++) {
                    f = s * e[i];
                    e[i] = c * e[i];
                    if (Math.abs(f) <= eps) {
                        break; // goto test-f-convergence
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
    // Must replace zeroes by unique identifier that will be set to 0 later
    // why? so sorting the vectors using indexOf doesn't return the same element multiple times
    while (q.indexOf(0) != -1) {
        let ind = q.indexOf(0);
        q[ind] = (q.length - ind) * 10 ** -15;
    }
    let key = q.slice();
    // Some values of q are zero, Replacing with values that will be below tolerance but unique for full sorting
    // To return in order by singular value,
    // you have to resort u and vt's individual vectors and the vector order of the matrix
    let vt = v[0].map((_, colIndex) => v.map(row => row[colIndex])); //transpose v
    let order = q.map(x => key.indexOf(x)); // get index order to apply same sorting to u and v
    let ordervt = JSON.parse(JSON.stringify(vt)); //deepcopy
    let orderu = JSON.parse(JSON.stringify(u)); //deepcopy
    // guess what this function does
    let ordervector = function (vec, order) {
        let nvec = vec.slice(); //shallow copy
        for (let j = 0; j < vec.length; j++) {
            nvec[j] = vec[order[j]];
        }
        return nvec;
    };
    //lets reorder
    for (i = 0; i < order.length; i++) {
        orderu[i] = JSON.parse(JSON.stringify(ordervector(u[order[i]], order))); //replace new array in correct order
        ordervt[i] = JSON.parse(JSON.stringify(ordervector(vt[order[i]], order))); //replace new array in correct order
    }
    // Number below eps should be zero
    for (i = 0; i < n; i++) {
        if (q[i] < eps)
            q[i] = 0;
    }
    return { orderu, q, ordervt };
};
// const SVD_gpu = (a: number[], adim: number, withu: boolean, withv: boolean, eps: number) => {
// const SVD_gpu = gpu.createKernel(net: Network, adim: number, withu: boolean, withv: boolean, eps: number) => {
//
//     let N = net.particles.length
//     let hess = new Float64Array(3*N*3*N).fill(0.) // 3N x 3N
//
//
//     // Define default parameters
//     withu = withu !== undefined ? withu : true
//     withv = withv !== undefined ? withv : true
//     // eps = eps || Math.pow(2, -52)
//     eps = Math.pow(2, -52);
//     // let tol = 1e-64 / eps
//     let tol = 2e-12;
//
//     // dimensions (square matrix)
//     let dim = adim
//     //accessing a matrix a[i][j] = a[i*adim + j]
//
//     // throw error if a is not defined
//     if (!a) {
//         throw new TypeError('Matrix a is not defined')
//     }
//
//     // Householder's reduction to bidiagonal form
//     // let dims = a.dimensions();
//     // const n = dims['rows']
//     // const m = dims['columns']
//     const n = adim
//     const m = adim
//
//     if (m < n) {
//         throw new TypeError('Invalid matrix: m < n')
//     }
//
//     let i, j, k, l, l1, c, f, g, h, s, x, y, z
//
//     g = 0
//     x = 0
//     const e = []
//
//     const u = []
//     const v = []
//
//     const mOrN = (withu === false) ? m : n
//
//     // Initialize u
//     for (i = 0; i < m; i++) {
//         u[i] = new Array(mOrN).fill(0)
//     }
//
//     // Initialize v
//     for (i = 0; i < n; i++) {
//         v[i] = new Array(n).fill(0)
//     }
//
//     // Initialize q
//     const q = new Array(n).fill(0)
//
//     // Copy array a in u
//     for (i = 0; i < m; i++) {
//         for (j = 0; j < n; j++) {
//             u[i][j] = a[i][j]
//         }
//     }
//
//     for (i = 0; i < n; i++) {
//         e[i] = g
//         s = 0
//         l = i + 1
//         for (j = i; j < m; j++) {
//             s += Math.pow(u[j][i], 2)
//         }
//         if (s < tol) {
//             g = 0
//         } else {
//             f = u[i][i]
//             g = f < 0 ? Math.sqrt(s) : -Math.sqrt(s)
//             h = f * g - s
//             u[i][i] = f - g
//             for (j = l; j < n; j++) {
//                 s = 0
//                 for (k = i; k < m; k++) {
//                     s += u[k][i] * u[k][j]
//                 }
//                 f = s / h
//                 for (k = i; k < m; k++) {
//                     u[k][j] = u[k][j] + f * u[k][i]
//                 }
//             }
//         }
//         q[i] = g
//         s = 0
//         for (j = l; j < n; j++) {
//             s += Math.pow(u[i *adim +j], 2)
//         }
//         if (s < tol) {
//             g = 0
//         } else {
//             f = u[i][i + 1]
//             g = f < 0 ? Math.sqrt(s) : -Math.sqrt(s)
//             h = f * g - s
//             u[i][i + 1] = f - g
//             for (j = l; j < n; j++) {
//                 e[j] = u[i *adim +j] / h
//             }
//             for (j = l; j < m; j++) {
//                 s = 0
//                 for (k = l; k < n; k++) {
//                     s += u[j][k] * u[i][k]
//                 }
//                 for (k = l; k < n; k++) {
//                     u[j][k] = u[j][k] + s * e[k]
//                 }
//             }
//         }
//         y = Math.abs(q[i]) + Math.abs(e[i])
//         if (y > x) {
//             x = y
//         }
//     }
//
//     // Accumulation of right-hand transformations
//     if (withv) {
//         for (i = n - 1; i >= 0; i--) {
//             if (g !== 0) {
//                 h = u[i][i + 1] * g
//                 for (j = l; j < n; j++) {
//                     v[j][i] = u[i *adim +j] / h
//                 }
//                 for (j = l; j < n; j++) {
//                     s = 0
//                     for (k = l; k < n; k++) {
//                         s += u[i][k] * v[k][j]
//                     }
//                     for (k = l; k < n; k++) {
//                         v[k][j] = v[k][j] + s * v[k][i]
//                     }
//                 }
//             }
//             for (j = l; j < n; j++) {
//                 v[i *adim +j] = 0
//                 v[j][i] = 0
//             }
//             v[i][i] = 1
//             g = e[i]
//             l = i
//         }
//     }
//     // Accumulation of left-hand transformations
//
//     for (i = n; i < m; i++) {
//         for (j = n; j < m; j++) {
//             u[i *adim +j] = 0
//         }
//         u[i][i] = 1
//     }
//
//     if (withu) {
//         for (i = n - 1; i >= 0; i--) {
//             l = i + 1
//             g = q[i]
//             for (j = l; j < mOrN; j++) {
//                 u[i *adim +j] = 0
//             }
//             if (g !== 0) {
//                 h = u[i][i] * g
//                 for (j = l; j < mOrN; j++) {
//                     s = 0
//                     for (k = l; k < m; k++) {
//                         s += u[k][i] * u[k][j]
//                     }
//                     f = s / h
//                     for (k = i; k < m; k++) {
//                         u[k][j] = u[k][j] + f * u[k][i]
//                     }
//                 }
//                 for (j = i; j < m; j++) {
//                     u[j][i] = u[j][i] / g
//                 }
//             } else {
//                 for (j = i; j < m; j++) {
//                     u[j][i] = 0
//                 }
//             }
//             u[i][i] = u[i][i] + 1
//         }
//     }
//
//     // Diagonalization of the bidiagonal form
//     eps = eps * x
//     let testConvergence
//     for (k = n - 1; k >= 0; k--) {
//         for (let iteration = 0; iteration < 50; iteration++) {
//             // test-f-splitting
//             testConvergence = false
//             for (l = k; l >= 0; l--) {
//                 if (Math.abs(e[l]) <= eps) {
//                     testConvergence = true
//                     break
//                 }
//                 if (Math.abs(q[l - 1]) <= eps) {
//                     break
//                 }
//             }
//
//             if (!testConvergence) { // cancellation of e[l] if l>0
//                 c = 0
//                 s = 1
//                 l1 = l - 1
//                 for (i = l; i < k + 1; i++) {
//                     f = s * e[i]
//                     e[i] = c * e[i]
//                     if (Math.abs(f) <= eps) {
//                         break // goto test-f-convergence
//                     }
//                     g = q[i]
//                     q[i] = Math.sqrt(f * f + g * g)
//                     h = q[i]
//                     c = g / h
//                     s = -f / h
//                     if (withu) {
//                         for (j = 0; j < m; j++) {
//                             y = u[j][l1]
//                             z = u[j][i]
//                             u[j][l1] = y * c + (z * s)
//                             u[j][i] = -y * s + (z * c)
//                         }
//                     }
//                 }
//             }
//
//             // test f convergence
//             z = q[k]
//             if (l === k) { // convergence
//                 if (z < 0) {
//                     // q[k] is made non-negative
//                     q[k] = -z
//                     if (withv) {
//                         for (j = 0; j < n; j++) {
//                             v[j][k] = -v[j][k]
//                         }
//                     }
//                 }
//                 break // break out of iteration loop and move on to next k value
//             }
//
//             // Shift from bottom 2x2 minor
//             x = q[l]
//             y = q[k - 1]
//             g = e[k - 1]
//             h = e[k]
//             f = ((y - z) * (y + z) + (g - h) * (g + h)) / (2 * h * y)
//             g = Math.sqrt(f * f + 1)
//             f = ((x - z) * (x + z) + h * (y / (f < 0 ? (f - g) : (f + g)) - h)) / x
//
//             // Next QR transformation
//             c = 1
//             s = 1
//             for (i = l + 1; i < k + 1; i++) {
//                 g = e[i]
//                 y = q[i]
//                 h = s * g
//                 g = c * g
//                 z = Math.sqrt(f * f + h * h)
//                 e[i - 1] = z
//                 c = f / z
//                 s = h / z
//                 f = x * c + g * s
//                 g = -x * s + g * c
//                 h = y * s
//                 y = y * c
//                 if (withv) {
//                     for (j = 0; j < n; j++) {
//                         x = v[j][i - 1]
//                         z = v[j][i]
//                         v[j][i - 1] = x * c + z * s
//                         v[j][i] = -x * s + z * c
//                     }
//                 }
//                 z = Math.sqrt(f * f + h * h)
//                 q[i - 1] = z
//                 c = f / z
//                 s = h / z
//                 f = c * g + s * y
//                 x = -s * g + c * y
//                 if (withu) {
//                     for (j = 0; j < m; j++) {
//                         y = u[j][i - 1]
//                         z = u[j][i]
//                         u[j][i - 1] = y * c + z * s
//                         u[j][i] = -y * s + z * c
//                     }
//                 }
//             }
//             e[l] = 0
//             e[k] = f
//             q[k] = x
//         }
//     }
//     // Must replace zeroes by unique identifier that will be set to 0 later
//     // why? so sorting the vectors using indexOf doesn't return the same element multiple times
//     while (q.indexOf(0) != -1) {
//         let ind = q.indexOf(0);
//         q[ind] = (q.length - ind) * 10 ** -15;
//     }
//
//     let key: number[] = q.slice();
//     // Some values of q are zero, Replacing with values that will be below tolerance but unique for full sorting
//
//     // To return in order by singular value,
//     // you have to resort u and vt's individual vectors and the vector order of the matrix
//
//     let vt = v[0].map((_, colIndex) => v.map(row => row[colIndex])); //transpose v
//
//     let order = q.map(x => key.indexOf(x)); // get index order to apply same sorting to u and v
//     let ordervt = JSON.parse(JSON.stringify(vt)); //deepcopy
//     let orderu = JSON.parse(JSON.stringify(u)); //deepcopy
//
//     // guess what this function does
//     let ordervector = function (vec: number[], order: number[]): number[] {
//         let nvec = vec.slice() //shallow copy
//         for (let j = 0; j < vec.length; j++) {
//             nvec[j] = vec[order[j]];
//         }
//         return nvec;
//     }
//
//     //lets reorder
//     for (i = 0; i < order.length; i++) {
//         orderu[i] = JSON.parse(JSON.stringify(ordervector(u[order[i]], order))); //replace new array in correct order
//         ordervt[i] = JSON.parse(JSON.stringify(ordervector(vt[order[i]], order))); //replace new array in correct order
//     }
//
//     // Number below eps should be zero
//     for (i = 0; i < n; i++) {
//         if (q[i] < eps) q[i] = 0;
//     }
//     let morderu = Matrix.create(orderu)
//     let mq = Matrix.create(q)
//     let mordervt = Matrix.create(ordervt)
//
//     return {morderu, q, mordervt}
// }
