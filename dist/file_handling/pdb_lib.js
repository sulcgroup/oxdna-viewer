// Helper Objects for pdb parsing
class graphData {
    label;
    data;
    xdata;
    datatype; // msf or bfactor
    units; // A_sqr or nm_sqr
    gammaSim; // Spring force constant only used if graphData is generated as a Fit
    cutoff; // Cutoff (A) for edges, only used if graphData is generated as a Fit
    oDatatype; // Stores (original datatype) for the labels on the Fluctuation window (used in UI-> view)
    constructor(l, d, x, dt, u) {
        this.label = l;
        this.data = d;
        this.xdata = x;
        this.datatype = dt;
        this.units = u;
        this.gammaSim = 0;
        this.cutoff = 0;
        this.oDatatype = this.datatype;
    }
    ;
    convertType(format) {
        if (['msf', 'bfactor'].indexOf(format) < 0)
            return; // TODO: Add error throw here and convertUnits
        if (this.datatype == format)
            return; //Already in the right format gang gang
        // Conversion needs to know both formats and direction to do anything useful
        if (this.datatype == 'msf' && format == 'bfactor') {
            this.data = this.data.map(e => e * ((8 * Math.pow(Math.PI, 2)) / 3));
        }
        else if (this.datatype == 'bfactor' && format == 'msf') {
            this.data = this.data.map(e => e * (3 / (8 * Math.pow(Math.PI, 2))));
        }
        this.datatype = format; // assumes successful conversion
    }
    ;
    convertUnits(units) {
        if (['A_sqr', 'nm_sqr'].indexOf(units) < 0)
            return;
        if (this.units == 'A_sqr' && units == "nm_sqr") {
            this.data = this.data.map(e => e / 100);
        }
        else if (this.units == 'nm_sqr' && units == "A_sqr") {
            this.data = this.data.map(e => e * 100);
        }
        this.units = units; // assumes successful conversion
    }
    ;
    toJson() {
        // Easiest to just change the whole graph to the correct output format
        flux.changeType('msf');
        flux.changeUnits('nm_sqr');
        let data = this.data.map(e => { return Math.sqrt(e); });
        return { 'RMSF (nm)': data };
    }
    ;
}
// Members of the Recongized arrays cannot have overlapping Members
const recongizedProteinResidues = ["ALA", "ARG", "ASN", "ASP", "CYS", "CYX", "GLN",
    "GLU", "GLY", "HIS", "HSD", "ILE", "MET", "LEU", "LYS", "PHE", "PRO", "SER",
    "THR", "TRP", "TYR", "VAL", "SEC", "PYL", "ASX", "GLX", "UNK"];
const recongizedDNAResidues = ["DG", "DT", "DA", "DC", "DU", "DI", "DN", "ADE", "THY", "GUA", "CYT"];
const recongizedDNAStrandEnds = ["DG3", "DG5", "DT3", "DT5", "DA3", "DA3", "DC3", "DC5"];
const recongizedRNAResidues = ["A", "C", "G", "I", "U", "TU", "N"];
const recongizedRNAStrandEnds = ["A3", "A5", "C3", "C5", "G3", "G5", "U3", "U5"];
// 3 residue code (in pdb) to single letter type for Amino Acids
let proelem = { "LYS": "K", "CYS": "C", "CYX": "C", "ALA": "A", "THR": "T", "GLU": "E", "GLN": "Q", "SER": "S",
    "ASP": "D", "ASN": "N", "HIS": "H", "HSD": "H", "GLY": "G", "PRO": "P", "ARG": "R", "VAL": "V",
    "ILE": "I", "LEU": "L", "MET": "M", "PHE": "F", "TYR": "Y", "TRP": "W" };
// Residue code (in pdb) to single letter type for Nucleotides
let nucelem = { "DC": "C", "DC3": "C", "DC5": "C", "DG": "G", "DG3": "G", "DG5": "G", "DT": "T", "DT3": "T",
    "DT5": "T", "T": "T", "T3": "T", "T5": "T", "DA": "A", "DA3": "A", "DA5": "A", "U": "U", "U3": "U", "U5": "U",
    "A": "A", "A3": "A", "A5": "A", "G": "G", "G3": "G", "G5": "G", "C": "C", "C3": "C", "C5": "C", "ADE": "A",
    "THY": "T", "CYT": "C", "GUA": "G" };
class pdbatom {
    // store most info as strings to make robust against more interestingly formulated PDB files
    indx;
    atomType;
    altLoc;
    resType;
    chainID;
    chainIndx;
    pdbResIdent;
    iCode;
    x;
    y;
    z;
    occupancy;
    tempFactor; // make optional?
    element;
    charge;
    constructor() {
        this.indx = "";
        this.atomType = "";
        this.altLoc = "";
        this.resType = "";
        this.chainID = "";
        this.chainIndx = -1;
        this.pdbResIdent = "";
        this.iCode = "";
        this.x = 0; // these MUST be numbers
        this.y = 0;
        this.z = 0;
        this.occupancy = "";
        this.tempFactor = "";
        this.element = "";
        this.charge = "";
    }
}
class pdbresidue {
    resType;
    pdbResIdent;
    chainID;
    chainIndx;
    type;
    atoms;
    constructor() {
        this.resType = "";
        this.chainIndx = -1;
        this.pdbResIdent = "";
        this.chainID = "";
        this.type = "";
        this.atoms = [];
    }
}
class pdbchain {
    chainID;
    chainIndx;
    residues;
    strandtype;
    constructor() {
        this.chainIndx = -1;
        this.chainID = "";
        this.residues = [];
        this.strandtype = "";
    }
}
// Stores locations of unique and repeated chains throughout the provided PDB file
class pdbReadingList {
    uniqueIDs; // unique chain Identifiers
    uniqueStart; // starting line number of
    uniqueEnd;
    repeatIDs;
    repeatStart;
    repeatEnd;
    repeatCoords; // coordinates for repeated chains
    repeatQuatRots; // Rotation Quaternion for Repeated chain a1/a3 vectors
    constructor() {
        this.uniqueIDs = [];
        this.uniqueStart = [];
        this.uniqueEnd = [];
        this.repeatIDs = [];
        this.repeatStart = [];
        this.repeatEnd = [];
        this.repeatCoords = [];
        this.repeatQuatRots = [];
    }
}
class pdbinfowrapper {
    pdbfilename;
    pdbsysinfo;
    initlist;
    disulphideBonds;
    hydrogenBonds;
    constructor(pi, chains, initlist) {
        this.pdbfilename = pi;
        this.pdbsysinfo = chains;
        this.initlist = initlist;
        this.disulphideBonds = [];
    }
}
// Atoms left out of the side chain when orienting amino-acid beads (the same set as oat anm_fluctuation_solver)
const SIDE_CHAIN_EXCLUDED_ATOMS = ['N', 'C', 'O', 'OXT', 'H', 'H1', 'H2', 'H3', 'HN'];
const ANGSTROM_PER_SIM_LENGTH = 8.518;
// Vectors shorter than this are treated as zero when building bead frames
const FRAME_ZERO_LENGTH = 1e-9;
/**
 * The atoms of a residue by name. Where a name has alternate locations, keep the one with the highest occupancy
 * (the first one on ties), as oat does, so both programs orient the beads from the same atoms.
 */
function residueAtomsByName(res) {
    const occupancy = (a) => {
        const o = parseFloat(a.occupancy);
        return isNaN(o) ? 1 : o;
    };
    const byName = new Map();
    res.atoms.forEach(a => {
        const current = byName.get(a.atomType);
        if (current === undefined || occupancy(a) > occupancy(current))
            byName.set(a.atomType, a);
    });
    return byName;
}
const atomPosition = (a) => new THREE.Vector3(a.x, a.y, a.z);
// Unit vector along the part of v perpendicular to the unit vector ref, or undefined if v is (nearly) parallel to ref
function perpendicularUnit(v, ref) {
    const p = v.clone().addScaledVector(ref, -v.dot(ref));
    if (p.length() < 1e-3 * Math.max(v.length(), 1e-12))
        return undefined;
    return p.normalize();
}
// A unit vector perpendicular to v. Last resort only: it depends on how the structure is oriented.
function anyPerpendicular(v) {
    const abs = [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)];
    const axis = new THREE.Vector3();
    axis.setComponent(abs.indexOf(Math.min(...abs)), 1);
    return v.clone().cross(axis).normalize();
}
/**
 * Orientation of the amino-acid beads of one chain, used by the ANMT bending and torsion potentials.
 * Both vectors are defined by the residue and its chain neighbours, so the ANMT parameters do not depend on how the
 * structure is oriented in the input file. This is the same definition as oat anm_fluctuation_solver (orientation_vectors).
 *
 * a1 points from the C-alpha to the centre of the residue's atoms other than the backbone N, C and O (C-alpha included).
 * If that is zero (glycine) it points to the ideal C-beta position, computed from the backbone N, CA and C, or, if they
 * are missing, along the normal to the plane of the C-alpha and its two neighbours.
 * a3 points along the chain (N to C of the residue, or from the previous to the next C-alpha), made perpendicular to a1.
 *
 * @param residues The residues of the chain, in order from the N to the C terminus. Every one must have a CA atom.
 * @returns The C-alpha position and the orthonormal a1/a3 of each residue
 */
function aminoAcidFrames(residues) {
    const atoms = residues.map(residueAtomsByName);
    const cas = atoms.map(byName => atomPosition(byName.get('CA')));
    let arbitrary = 0;
    const frames = atoms.map((byName, r) => {
        const ca = cas[r];
        const prev = r > 0 ? cas[r - 1] : undefined;
        const next = r < cas.length - 1 ? cas[r + 1] : undefined;
        const n = byName.get('N'), c = byName.get('C');
        // in Angstrom, the units of the ideal C-beta coefficients below (pdbatom positions are in simulation units)
        const nToCa = n && ca.clone().sub(atomPosition(n)).multiplyScalar(ANGSTROM_PER_SIM_LENGTH);
        const caToC = c && atomPosition(c).sub(ca).multiplyScalar(ANGSTROM_PER_SIM_LENGTH);
        // a1: towards the side chain
        const sideChain = Array.from(byName.entries()).filter(([name]) => !SIDE_CHAIN_EXCLUDED_ATOMS.includes(name));
        let a1 = new THREE.Vector3();
        sideChain.forEach(([, a]) => a1.add(atomPosition(a)));
        a1.divideScalar(sideChain.length).sub(ca);
        if (a1.length() < FRAME_ZERO_LENGTH) {
            if (nToCa && caToC) {
                // ideal C-beta position relative to the C-alpha (the coefficients of trRosetta/AlphaFold)
                a1 = nToCa.clone().cross(caToC).multiplyScalar(-0.58273431)
                    .addScaledVector(nToCa, 0.56802827)
                    .addScaledVector(caToC, -0.54067466);
            }
            else if (prev && next) {
                a1 = next.clone().sub(ca).cross(prev.clone().sub(ca));
            }
        }
        if (a1.length() < FRAME_ZERO_LENGTH) {
            const bond = next ? next.clone().sub(ca) : prev ? ca.clone().sub(prev) : new THREE.Vector3(0, 0, 1);
            a1 = anyPerpendicular(bond);
            arbitrary++;
        }
        a1.normalize();
        // a3: along the chain, perpendicular to a1
        const candidates = [];
        if (nToCa && caToC)
            candidates.push(caToC.clone().add(nToCa));
        if (prev && next)
            candidates.push(next.clone().sub(prev));
        if (next)
            candidates.push(next.clone().sub(ca));
        if (prev)
            candidates.push(ca.clone().sub(prev));
        let a3;
        for (const v of candidates) {
            a3 = perpendicularUnit(v, a1);
            if (a3)
                break;
        }
        if (!a3) {
            a3 = anyPerpendicular(a1);
            arbitrary++;
        }
        return { ca, a1, a3 };
    });
    if (arbitrary > 0) {
        console.log(`${arbitrary} amino-acid orientation vectors could not be defined from the structure (missing backbone atoms and chain neighbours) and were chosen arbitrarily`);
    }
    return frames;
}
/**
 * The rotation that best superimposes the points `from` onto the points `to` (least squares, after centring both),
 * by Horn's quaternion method. Used to orient repeated copies of a chain like the chain they copy.
 */
function superpositionRotation(from, to) {
    const centre = (pts) => pts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(pts.length);
    const cf = centre(from), ct = centre(to);
    // s[a][b] = sum of (from - cf)_a (to - ct)_b
    const s = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    from.forEach((p, i) => {
        const f = p.clone().sub(cf).toArray(), t = to[i].clone().sub(ct).toArray();
        for (let a = 0; a < 3; a++)
            for (let b = 0; b < 3; b++)
                s[a][b] += f[a] * t[b];
    });
    const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = s;
    const m = [
        [xx + yy + zz, yz - zy, zx - xz, xy - yx],
        [yz - zy, xx - yy - zz, xy + yx, zx + xz],
        [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
        [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
    ];
    // Jacobi eigendecomposition of the symmetric 4x4 matrix; the eigenvector of the largest eigenvalue is (w, x, y, z)
    const v = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
    for (let sweep = 0; sweep < 50; sweep++) {
        let off = 0;
        for (let p = 0; p < 4; p++)
            for (let q = p + 1; q < 4; q++)
                off += m[p][q] * m[p][q];
        if (off < 1e-30)
            break;
        for (let p = 0; p < 4; p++)
            for (let q = p + 1; q < 4; q++) {
                if (m[p][q] === 0)
                    continue;
                const theta = (m[q][q] - m[p][p]) / (2 * m[p][q]);
                const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
                const c = 1 / Math.sqrt(t * t + 1), sn = t * c;
                for (let k = 0; k < 4; k++) {
                    const mkp = m[k][p], mkq = m[k][q];
                    m[k][p] = c * mkp - sn * mkq;
                    m[k][q] = sn * mkp + c * mkq;
                }
                for (let k = 0; k < 4; k++) {
                    const mpk = m[p][k], mqk = m[q][k];
                    m[p][k] = c * mpk - sn * mqk;
                    m[q][k] = sn * mpk + c * mqk;
                }
                for (let k = 0; k < 4; k++) {
                    const vkp = v[k][p], vkq = v[k][q];
                    v[k][p] = c * vkp - sn * vkq;
                    v[k][q] = sn * vkp + c * vkq;
                }
            }
    }
    let best = 0;
    for (let k = 1; k < 4; k++)
        if (m[k][k] > m[best][best])
            best = k;
    return new THREE.Quaternion(v[1][best], v[2][best], v[3][best], v[0][best]).normalize();
}
// This Function calculates all necessary info for an Amino Acid in PDB format and writes it to the system
function FillInfoAA(info, AM, CM) {
    AM.type = info[1];
    info[2][0] -= CM.x;
    info[2][1] -= CM.y;
    info[2][2] -= CM.z;
    let i2 = new THREE.Vector3().fromArray(info[2]);
    let i3 = new THREE.Vector3().fromArray(info[3]);
    let i4 = new THREE.Vector3().fromArray(info[4]);
    // let center = info[2].map((x, xid)=>{ return x-CM[xid];})
    AM.calcPositions(i2, i3, i4);
}
// This Function calculates all necessary info for a Nuclcleotide in PDB format and writes it to the system
function FillInfoNC(info, NC, CM) {
    NC.type = info[1];
    info[2][0] -= CM.x;
    info[2][1] -= CM.y;
    info[2][2] -= CM.z;
    let i2 = new THREE.Vector3().fromArray(info[2]);
    let i3 = new THREE.Vector3().fromArray(info[3]);
    let i4 = new THREE.Vector3().fromArray(info[4]);
    NC.calcPositions(i2, i3, i4);
}
// Colors used when drawing PDB structures (shared by pdb_worker and mmcif_worker)
var backboneColors = [
    new THREE.Color(0xfdd291),
    new THREE.Color(0xffb322),
    new THREE.Color(0x437092),
    new THREE.Color(0x6ea4cc), //light blue
];
var nucleosideColors = [
    new THREE.Color(0x4747B8),
    new THREE.Color(0xFFFF33),
    new THREE.Color(0x8CFF8C),
    new THREE.Color(0xFF3333),
    new THREE.Color(0x660000),
    new THREE.Color(0xFF7042),
    new THREE.Color(0xA00042),
    new THREE.Color(0xFF7C70),
    new THREE.Color(0xFF4C4C),
    new THREE.Color(0x7070FF),
    new THREE.Color(0xEBEBEB),
    new THREE.Color(0x525252),
    new THREE.Color(0x00007C),
    new THREE.Color(0x5E005E),
    new THREE.Color(0x004C00),
    new THREE.Color(0x455E45),
    new THREE.Color(0xB8A042),
    new THREE.Color(0x534C42),
    new THREE.Color(0x8C704C),
    new THREE.Color(0x4F4600), //W; Olive Brown
];
function addPDBToScene(pdbinfo, pindx, elementIndx) {
    let elems = [];
    let strandtype = [];
    let strands = pdbinfo.pdbsysinfo;
    let label = pdbinfo.pdbfilename;
    let initlist = pdbinfo.initlist;
    let pdbindices = [];
    let checker = {
        DNAPresent: false,
        proteinPresent: false,
        RNAPresent: false,
        mutantStrand: false
    };
    //Classify Residue Types
    for (let i = 0; i < initlist.uniqueIDs.length; i++) {
        let strand = strands[i];
        for (let key in checker)
            checker[key] = false;
        strand.residues.forEach(res => {
            res.resType = res.resType.replace(/[0-9]/g, '');
            if (recongizedDNAResidues.indexOf(res.resType) > -1 || recongizedDNAStrandEnds.indexOf(res.resType) > -1) {
                if (res.resType === 'DN') {
                    console.log("Nucleotide Base type 'DN' (for Generic Nucleic Acid) in PDB File. Replacing with 'DA'");
                    res.resType = 'DA';
                }
                if (res.resType === 'DI') {
                    console.log("Nucleotide Number blank has Residue Type Inosine. This is currently unsupported.");
                    return 1;
                }
                res.type = 'dna';
                checker.DNAPresent = true;
            }
            else if (recongizedProteinResidues.indexOf(res.resType) > -1) {
                if (res.resType === 'UNK') {
                    console.log("Amino Acid blank is Unknown, shown in grey");
                    res.resType = undefined;
                }
                res.type = 'pro';
                checker.proteinPresent = true;
            }
            else if (recongizedRNAResidues.indexOf(res.resType) > -1 || recongizedRNAStrandEnds.indexOf(res.resType) > -1) {
                if (res.resType === 'N') {
                    console.log("Nucleotide has Residue Base type 'N' for Generic Nucleic Acid in PDB File, shown in grey");
                    res.resType = undefined;
                }
                if (res.resType === 'I') {
                    console.log("Nucleotide Number blank has Residue Type Inosine. This is currently unsupported.");
                    return 1;
                }
                if (res.resType === 'TU') {
                    res.resType = 'U';
                }
                res.type = 'rna';
                checker.RNAPresent = true;
            }
            else {
                console.log("Residue type: " + res.resType + " Residue Number: " + res.pdbResIdent + " on chain: " + strand.chainID + " in Provided PDB is Not Supported. " +
                    "It will not be Intialized in the Viewer.");
                res.type = 'unworthy';
            }
        });
        if (checker.DNAPresent && checker.RNAPresent) {
            let restypestmp = strand.residues.map(x => x.resType);
            let Upresent = restypestmp.indexOf('U') > -1;
            if (Upresent) {
                checker.DNAPresent = false;
            }
            else {
                checker.RNAPresent = false;
            }
        }
        checker.mutantStrand = checker.proteinPresent ? (checker.DNAPresent || checker.RNAPresent) : (checker.DNAPresent && checker.RNAPresent);
        if (checker.mutantStrand) {
            console.log("Strand " + strand.chainID + " contains more thank one macromolecule type, no thanks");
            strand.strandtype = 'bastard';
        }
        else {
            if (checker.proteinPresent)
                strand.strandtype = 'pro';
            if (checker.DNAPresent)
                strand.strandtype = 'dna';
            if (checker.RNAPresent)
                strand.strandtype = 'rna';
        }
    }
    // Amino acids are placed on their C-alpha, oriented by aminoAcidFrames
    const CalcInfoAA = (res, frame) => {
        const bFactor = parseFloat(residueAtomsByName(res).get('CA').tempFactor);
        return [res.pdbResIdent, proelem[res.resType], frame.ca.toArray(), frame.a1.toArray(), frame.a3.toArray(), isNaN(bFactor) ? 0 : bFactor];
    };
    let ring_names = ["C2", "C4", "C5", "C6", "N1", "N3"];
    let pairs;
    function* subsets(array, length, start = 0) {
        if (start >= array.length || length < 1) {
            yield new Array();
        }
        else {
            while (start <= array.length - length) {
                let first = array[start];
                for (let subset of subsets(array, length - 1, start + 1)) {
                    subset.push(first);
                    yield subset;
                }
                ++start;
            }
        }
    }
    let CalcInfoNC = (res) => {
        const type = nucelem[res.resType];
        const pdbid = res.pdbResIdent;
        let nuccom = new THREE.Vector3;
        let sugarCom = new THREE.Vector3;
        let sugarAtoms = res.atoms.filter(a => a.atomType.includes("'") || a.atomType.includes("*"));
        sugarCom.x = sugarAtoms.map(a => a.x).reduce((a, b) => a + b);
        sugarCom.y = sugarAtoms.map(a => a.y).reduce((a, b) => a + b);
        sugarCom.z = sugarAtoms.map(a => a.z).reduce((a, b) => a + b);
        sugarCom.divideScalar(sugarAtoms.length);
        let nanCheck = false;
        let Bfacts = res.atoms.map(a => {
            let b = parseFloat(a.tempFactor);
            if (isNaN(b)) {
                console.log("Bfactors contain NaN value, check formatting of provided PDB file");
                nanCheck = true;
                return;
            }
            return b;
        });
        if (nanCheck)
            return;
        nuccom.x = res.atoms.map(a => a.x).reduce((a, b) => a + b);
        nuccom.y = res.atoms.map(a => a.y).reduce((a, b) => a + b);
        nuccom.z = res.atoms.map(a => a.z).reduce((a, b) => a + b);
        let l = res.atoms.length;
        let pos = nuccom.divideScalar(l);
        let Bfactavg = Bfacts.map(a => a).reduce((a, b) => a + b);
        Bfactavg /= res.atoms.length;
        let c5atom = res.atoms.filter(a => a.atomType == "C5'" || a.atomType == "C5*")[0];
        let c3atom = res.atoms.filter(a => a.atomType == "C3'" || a.atomType == "C3*")[0];
        if (c5atom === undefined || c3atom === undefined) {
            console.log("No C5' or C3' found for Nucleotide initialization");
            return;
        }
        let c5pos = new THREE.Vector3(c5atom.x, c5atom.y, c5atom.z);
        let c3pos = new THREE.Vector3(c3atom.x, c3atom.y, c3atom.z);
        let parallel_to = c5pos.sub(c3pos);
        let ring_poss = subsets(ring_names, 3);
        let a3 = new THREE.Vector3;
        for (let types of ring_poss) {
            let p = res.atoms.filter(a => a.atomType == types[0])[0];
            let q = res.atoms.filter(a => a.atomType == types[1])[0];
            let r = res.atoms.filter(a => a.atomType == types[2])[0];
            if (p === undefined || q === undefined || r === undefined) {
                if (p === undefined) {
                    console.log('Atom ' + types[0] + " not found in residue " + res.pdbResIdent + " in chain " + res.chainID);
                }
                if (q === undefined) {
                    console.log('Atom ' + types[1] + " not found in residue " + res.pdbResIdent + " in chain " + res.chainID);
                }
                if (r === undefined) {
                    console.log('Atom ' + types[0] + " not found in residue " + res.pdbResIdent + " in chain " + res.chainID);
                }
                break;
            }
            else {
                let v1 = new THREE.Vector3;
                let v2 = new THREE.Vector3;
                v1.x = p.x - q.x;
                v1.y = p.y - q.y;
                v1.z = p.z - q.z;
                v2.x = p.x - r.x;
                v2.y = p.y - r.y;
                v2.z = p.z - r.z;
                v1.normalize();
                v2.normalize();
                if (Math.abs(v1.dot(v2)) > 0.01) {
                    let tmpa3 = v1.cross(v2);
                    tmpa3.normalize();
                    if (tmpa3.dot(parallel_to) < 0) {
                        tmpa3.negate();
                    }
                    a3.add(tmpa3);
                }
            }
        }
        a3.normalize();
        if (["C", "T", "U"].indexOf(type) > -1) {
            pairs = [["N3", "C6"], ["C2", "N1"], ["C4", "C5"]];
        }
        else {
            pairs = [["N1", "C4"], ["C2", "N3"], ["C6", "C5"]];
        }
        let a1 = new THREE.Vector3(0, 0, 0);
        for (let i = 0; i < pairs.length; i++) {
            let p_atom = res.atoms.filter(a => a.atomType == pairs[i][0])[0];
            let q_atom = res.atoms.filter(a => a.atomType == pairs[i][1])[0];
            let diff = new THREE.Vector3(p_atom.x - q_atom.x, p_atom.y - q_atom.y, p_atom.z - q_atom.z);
            a1.add(diff);
        }
        a1.normalize();
        return [pdbid, type, pos.toArray(), a1.toArray(), a3.toArray(), Bfactavg];
    };
    let nextElementId = 0;
    let oldElementId = nextElementId;
    let strandInit = [];
    let sys = new System(0, nextElementId);
    let com = new THREE.Vector3();
    let bFactors = [];
    let xdata = [];
    for (let i = 0; i < (initlist.uniqueIDs.length); i++) {
        let nstrand = strands[i];
        if (nstrand.strandtype == 'pro') {
            let currentStrand = sys.addNewPeptideStrand();
            let strandInfo = [];
            strandtype.push("pro");
            // residues without a C-alpha can't be placed and are left out
            const caResidues = nstrand.residues.filter(res => res.atoms.some(a => a.atomType == 'CA'));
            const frames = aminoAcidFrames(caResidues);
            for (let j = 0; j < caResidues.length; j++) {
                const aa = currentStrand.createBasicElement(nextElementId);
                aa.sid = nextElementId - oldElementId;
                const info = CalcInfoAA(caResidues[j], frames[j]);
                strandInfo.push(info);
                bFactors.push(info[5]);
                xdata.push(aa.sid);
                com.add(new THREE.Vector3().fromArray(info[2]));
                pdbindices.push([pindx, initlist.uniqueIDs[i], info[0]]);
                aa.pdbindices = [pindx, initlist.uniqueIDs[i], info[0]];
                aa.n3 = null;
                aa.n5 = null;
                if (j != 0) {
                    const prevaa = elems[elems.length - 1];
                    aa.n5 = prevaa;
                    prevaa.n3 = aa;
                }
                elems.push(aa);
                nextElementId++;
            }
            strandInit.push(strandInfo);
            if (currentStrand.end3 == undefined) {
                console.log("Strand " + nstrand.chainID + " could not be initialized");
            }
            else {
                currentStrand.updateEnds();
                initlist.repeatIDs.forEach((rid, indx) => {
                    let repeatInfo = [];
                    if (nstrand.chainID.includes(rid)) {
                        let repeatStrand = sys.addNewPeptideStrand();
                        strandtype.push("pro");
                        currentStrand.getMonomers().forEach((mon, mid) => {
                            let repeatAmino = repeatStrand.createBasicElement(nextElementId);
                            repeatAmino.pdbindices = mon.pdbindices;
                            pdbindices.push(repeatAmino.pdbindices);
                            repeatAmino.sid = nextElementId - oldElementId;
                            let rinfo = strandInfo[mid].slice();
                            let rotquat = initlist.repeatQuatRots[indx];
                            rinfo[3] = new THREE.Vector3().fromArray(rinfo[3]).applyQuaternion(rotquat).toArray();
                            rinfo[4] = new THREE.Vector3().fromArray(rinfo[4]).applyQuaternion(rotquat).toArray();
                            rinfo[2] = initlist.repeatCoords[indx][mid];
                            bFactors.push(rinfo[5]);
                            xdata.push(repeatAmino.sid);
                            com.add(rinfo[2]);
                            rinfo[2] = rinfo[2].toArray();
                            repeatInfo.push(rinfo);
                            repeatAmino.n3 = null;
                            repeatAmino.n5 = null;
                            if (mid != 0) {
                                let prevaa = elems[elems.length - 1];
                                repeatAmino.n5 = prevaa;
                                prevaa.n3 = repeatAmino;
                            }
                            elems.push(repeatAmino);
                            nextElementId++;
                        });
                        repeatStrand.updateEnds();
                        strandInit.push(repeatInfo);
                    }
                });
            }
        }
        else if (nstrand.strandtype == 'rna' || nstrand.strandtype == 'dna') {
            let type = nstrand.strandtype == 'rna' ? 'RNA' : 'DNA';
            let currentStrand = sys.addNewNucleicAcidStrand(type);
            let strandInfo = [];
            let tmptype = nstrand.strandtype;
            strandtype.push(tmptype);
            let pdbres5to3 = nstrand.residues;
            for (let j = 0; j < nstrand.residues.length; j++) {
                try {
                    let info = CalcInfoNC(pdbres5to3[j]);
                    if (info === undefined)
                        continue; // partial residue (e.g. only backbone atoms resolved)
                    strandInfo.push(info);
                    com.add(new THREE.Vector3().fromArray(info[2]));
                    let nc = currentStrand.createBasicElementTyped(nstrand.strandtype, nextElementId);
                    nc.pdbindices = [pindx, initlist.uniqueIDs[i], info[0]];
                    pdbindices.push(nc.pdbindices);
                    nc.n3 = null;
                    nc.n5 = null;
                    nc.sid = nextElementId - oldElementId;
                    bFactors.push(info[5]);
                    xdata.push(nc.sid);
                    if (j != 0) {
                        let prevnc = elems[elems.length - 1];
                        nc.n5 = prevnc;
                        prevnc.n3 = nc;
                    }
                    elems.push(nc);
                    nextElementId++;
                }
                catch (e) {
                    console.log("Nucleotide could not be initialized");
                }
            }
            strandInit.push(strandInfo);
            if (currentStrand.end3 == undefined) {
                console.log("Strand " + nstrand.chainID + " could not be initialized");
            }
            else {
                currentStrand.updateEnds();
                initlist.repeatIDs.forEach((rid, indx) => {
                    let repeatInfo = [];
                    if (nstrand.chainID.includes(rid)) {
                        let repeatStrand = sys.addNewNucleicAcidStrand(currentStrand.kwdata['type']);
                        strandtype.push(tmptype);
                        currentStrand.getMonomers(true).forEach((mon, mid) => {
                            let repeatNuc = repeatStrand.createBasicElementTyped(nstrand.strandtype, nextElementId);
                            repeatNuc.sid = nextElementId - oldElementId;
                            try {
                                let rinfo = strandInfo[mid].slice();
                                let rotquat = initlist.repeatQuatRots[indx];
                                rinfo[3] = new THREE.Vector3().fromArray(rinfo[3]).applyQuaternion(rotquat).toArray();
                                rinfo[4] = new THREE.Vector3().fromArray(rinfo[4]).applyQuaternion(rotquat).toArray();
                                rinfo[2] = initlist.repeatCoords[indx][mid];
                                pdbindices.push(repeatNuc.pdbindices);
                                bFactors.push(rinfo[5]);
                                xdata.push(repeatNuc.sid);
                                com.add(rinfo[2]);
                                rinfo[2] = rinfo[2].toArray();
                                repeatInfo.push(rinfo);
                                repeatNuc.n3 = null;
                                repeatNuc.n5 = null;
                                if (mid != 0) {
                                    let prevaa = elems[elems.length - 1];
                                    repeatNuc.n5 = prevaa;
                                    prevaa.n3 = repeatNuc;
                                }
                                elems.push(repeatNuc);
                                nextElementId++;
                            }
                            catch (e) {
                                console.log("Nucleotide could not be initialized");
                            }
                        });
                        repeatStrand.updateEnds();
                        strandInit.push(repeatInfo);
                    }
                });
            }
        }
    }
    com.divideScalar(sys.systemLength());
    return [strandInit, strandtype, com, [label, bFactors, xdata, "bfactor", "A_sqr"],
        pdbindices, [pdbinfo.pdbfilename, pdbinfo.pdbsysinfo, pdbinfo.initlist, pdbinfo.disulphideBonds]];
}
