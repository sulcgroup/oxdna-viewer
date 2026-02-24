// Helper Objects for pdb parsing
class graphData {
    label: string;
    data: number[];
    xdata: number[];
    datatype: string; // msf or bfactor
    units: string; // A_sqr or nm_sqr
    gammaSim: number; // Spring force constant only used if graphData is generated as a Fit
    cutoff: number; // Cutoff (A) for edges, only used if graphData is generated as a Fit
    oDatatype: string; // Stores (original datatype) for the labels on the Fluctuation window (used in UI-> view)
    constructor(l, d, x, dt, u){
        this.label = l;
        this.data = d;
        this.xdata = x;
        this.datatype = dt;
        this.units = u;
        this.gammaSim = 0;
        this.cutoff = 0;
        this.oDatatype = this.datatype;
    };
    convertType(format:string) {
        if(['msf', 'bfactor'].indexOf(format) < 0) return; // TODO: Add error throw here and convertUnits
        if (this.datatype == format) return; //Already in the right format gang gang
        // Conversion needs to know both formats and direction to do anything useful
        if (this.datatype == 'msf' && format == 'bfactor'){
            this.data = this.data.map(e => e * ((8 * Math.pow(Math.PI, 2)) / 3));
        } else if (this.datatype == 'bfactor' && format == 'msf'){
            this.data = this.data.map(e => e * (3 / (8 * Math.pow(Math.PI, 2))));
        }
        this.datatype = format; // assumes successful conversion
    };
    convertUnits(units:string) {
        if(['A_sqr', 'nm_sqr'].indexOf(units) < 0) return;
        if(this.units == 'A_sqr' && units == "nm_sqr"){
            this.data = this.data.map(e => e / 100);
        } else if(this.units == 'nm_sqr' && units == "A_sqr"){
            this.data = this.data.map(e => e * 100);
        }
        this.units = units; // assumes successful conversion
    };
    toJson(){
        // Easiest to just change the whole graph to the correct output format
        flux.changeType('msf');
        flux.changeUnits('nm_sqr');
        let data = this.data.map(e => {return Math.sqrt(e)});
        return {'RMSF (nm)':data};
    };
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
let proelem = {"LYS": "K", "CYS": "C", "CYX": "C", "ALA": "A", "THR": "T", "GLU": "E", "GLN": "Q", "SER": "S",
    "ASP": "D", "ASN": "N", "HIS": "H", "HSD": "H", "GLY": "G", "PRO": "P", "ARG": "R", "VAL": "V",
    "ILE": "I", "LEU": "L", "MET": "M", "PHE": "F", "TYR": "Y", "TRP": "W"};

// Residue code (in pdb) to single letter type for Nucleotides
let nucelem = {"DC": "C", "DC3": "C", "DC5":"C",  "DG": "G", "DG3": "G", "DG5":"G", "DT": "T", "DT3": "T",
    "DT5":"T", "T": "T", "T3": "T", "T5":"T", "DA": "A", "DA3": "A", "DA5":"A", "U": "U", "U3": "U", "U5":"U",
    "A": "A", "A3": "A", "A5":"A", "G": "G", "G3": "G", "G5":"G", "C": "C", "C3": "C", "C5":"C", "ADE": "A",
    "THY": "T", "CYT": "C", "GUA": "G"};

class pdbatom{
    // store most info as strings to make robust against more interestingly formulated PDB files
    indx : string;
    atomType: string;
    altLoc: string;
    resType: string;
    chainID: string;
    chainIndx: number;
    pdbResIdent : string;
    iCode: string;
    x: number;
    y: number;
    z: number;
    occupancy: string;
    tempFactor: string; // make optional?
    element: string | number;
    charge: string | number;
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

class pdbresidue{
    resType: string;
    pdbResIdent: string;
    chainID: string;
    chainIndx: number;
    type: string;
    atoms: pdbatom[];
    constructor(){
        this.resType = "";
        this.chainIndx = -1;
        this.pdbResIdent = "";
        this.chainID = "";
        this.type = "";
        this.atoms = [];
    }
}

class pdbchain{
    chainID: string;
    chainIndx: number;
    residues: pdbresidue[];
    strandtype: string;
    constructor(){
        this.chainIndx = -1;
        this.chainID = "";
        this.residues = [];
        this.strandtype = "";
    }
}

// Stores locations of unique and repeated chains throughout the provided PDB file
class pdbReadingList{
    uniqueIDs: string[]; // unique chain Identifiers
    uniqueStart: number[]; // starting line number of
    uniqueEnd : number[];
    repeatIDs : string[];
    repeatStart: number[];
    repeatEnd: number[];
    repeatCoords : THREE.Vector3[][]; // coordinates for repeated chains
    repeatQuatRots : THREE.Quaternion[]; // Rotation Quaternion for Repeated chain a1/a3 vectors
    constructor(){
        this.uniqueIDs = [];
        this.uniqueStart = [];
        this.uniqueEnd = [];
        this.repeatIDs = [];
        this.repeatStart =[];
        this.repeatEnd = [];
        this.repeatCoords = [];
        this.repeatQuatRots = [];
    }
}

class pdbinfowrapper { //Transfers Necessary Data from readPdbFile to addPDBtoScene
    pdbfilename: string;
    pdbsysinfo: pdbchain[];
    initlist: pdbReadingList;
    disulphideBonds: [any, number, any, number][];
    hydrogenBonds: [[any, number], [any, number]][];


    constructor(pi, chains, initlist) {
        this.pdbfilename = pi;
        this.pdbsysinfo = chains;
        this.initlist = initlist;
        this.disulphideBonds = [];
    }
}

// This Function calculates all necessary info for an Amino Acid in PDB format and writes it to the system
function FillInfoAA(info: [string, string, number[], number[], number[], number], AM: AminoAcid, CM: THREE.Vector3){
    AM.type = info[1];
    info[2][0] -= CM.x;
    info[2][1] -= CM.y;
    info[2][2] -= CM.z;
    let i2 = new THREE.Vector3().fromArray(info[2])
    let i3 = new THREE.Vector3().fromArray(info[3])
    let i4 = new THREE.Vector3().fromArray(info[4])

    // let center = info[2].map((x, xid)=>{ return x-CM[xid];})
    AM.calcPositions(i2, i3, i4);
}

// This Function calculates all necessary info for a Nuclcleotide in PDB format and writes it to the system
function FillInfoNC(info: [string, string, number[], number[], number[], number], NC: Nucleotide, CM: THREE.Vector3){
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
    new THREE.Color(0xfdd291), //light yellow
    new THREE.Color(0xffb322), //goldenrod
    new THREE.Color(0x437092), //dark blue
    new THREE.Color(0x6ea4cc), //light blue
];

var nucleosideColors = [
    new THREE.Color(0x4747B8), //A or K; Royal Blue
    new THREE.Color(0xFFFF33), //G or C; Medium Yellow
    new THREE.Color(0x8CFF8C), //C or A; Medium green
    new THREE.Color(0xFF3333), //T/U or T; Red
    new THREE.Color(0x660000), //E; Dark Brown
    new THREE.Color(0xFF7042), //S; Medium Orange
    new THREE.Color(0xA00042), //D; Dark Rose
    new THREE.Color(0xFF7C70), //N; Light Salmon
    new THREE.Color(0xFF4C4C), //Q; Dark Salmon
    new THREE.Color(0x7070FF), //H; Medium Blue
    new THREE.Color(0xEBEBEB), //G; light GREY
    new THREE.Color(0x525252), //P; Dark Grey
    new THREE.Color(0x00007C), //R; Dark Blue
    new THREE.Color(0x5E005E), //V; Dark Purple
    new THREE.Color(0x004C00), //I; Dark Green
    new THREE.Color(0x455E45), //L; Olive Green
    new THREE.Color(0xB8A042), //M; Light Brown
    new THREE.Color(0x534C42), //F; Olive Grey
    new THREE.Color(0x8C704C), //Y; Medium Brown
    new THREE.Color(0x4F4600), //W; Olive Brown
];

function addPDBToScene (pdbinfo: pdbinfowrapper, pindx: number, elementIndx: number) {
    let elems = [];
    let strandtype =[];
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
    for (let i: number = 0; i < initlist.uniqueIDs.length; i++) {
        let strand: pdbchain = strands[i];
        for (let key in checker) checker[key] = false;
        strand.residues.forEach(res => {
            res.resType = res.resType.replace(/[0-9]/g, '');

            if (recongizedDNAResidues.indexOf(res.resType) > -1 || recongizedDNAStrandEnds.indexOf(res.resType) > -1) {
                if (res.resType === 'DN') {
                    console.log("Nucleotide Base type 'DN' (for Generic Nucleic Acid) in PDB File. Replacing with 'DA'");
                    res.resType = 'DA';
                }
                if (res.resType === 'DI') {
                    console.log("Nucleotide Number blank has Residue Type Inosine. This is currently unsupported.")
                    return 1;
                }
                res.type = 'dna';
                checker.DNAPresent = true;

            } else if (recongizedProteinResidues.indexOf(res.resType) > -1) {
                if (res.resType === 'UNK') {
                    console.log("Amino Acid blank is Unknown, shown in grey");
                    res.resType = undefined;
                }
                res.type = 'pro';
                checker.proteinPresent = true;

            } else if (recongizedRNAResidues.indexOf(res.resType) > -1 || recongizedRNAStrandEnds.indexOf(res.resType) > -1) {
                if (res.resType === 'N') {
                    console.log("Nucleotide has Residue Base type 'N' for Generic Nucleic Acid in PDB File, shown in grey");
                    res.resType = undefined;
                }
                if (res.resType === 'I') {
                    console.log("Nucleotide Number blank has Residue Type Inosine. This is currently unsupported.")
                    return 1;
                }
                if (res.resType === 'TU'){
                    res.resType = 'U';
                }
                res.type = 'rna';
                checker.RNAPresent = true;

            } else {
                console.log("Residue type: "+res.resType+" Residue Number: "+res.pdbResIdent+ " on chain: " +strand.chainID+" in Provided PDB is Not Supported. " +
                    "It will not be Intialized in the Viewer.");
                res.type = 'unworthy';
            }
        });

        if(checker.DNAPresent && checker.RNAPresent){
            let restypestmp = strand.residues.map(x=>x.resType);
            let Upresent = restypestmp.indexOf('U') > -1
            if(Upresent){
                checker.DNAPresent = false;
            } else {
                checker.RNAPresent = false;
            }
        }

        checker.mutantStrand = checker.proteinPresent ? (checker.DNAPresent || checker.RNAPresent) : (checker.DNAPresent && checker.RNAPresent);

        if (checker.mutantStrand) {
            console.log("Strand " + strand.chainID + " contains more thank one macromolecule type, no thanks");
            strand.strandtype = 'bastard';
        } else {
            if (checker.proteinPresent) strand.strandtype = 'pro';
            if (checker.DNAPresent) strand.strandtype = 'dna';
            if (checker.RNAPresent) strand.strandtype = 'rna';
        }
    }

    let bv1 = new THREE.Vector3(1, 0, 0);
    let bv2 = new THREE.Vector3(0, 1, 0);
    let bv3 = new THREE.Vector3(0, 0, 1);

    let type: string = "";
    let pdbid: string = "";
    let a3 = new THREE.Vector3();

    let CalcInfoAA = (res: pdbresidue): [string, string, number[], number[], number[], number] => {
        type = proelem[res.resType];
        pdbid = res.pdbResIdent;
        let scHAcom = new THREE.Vector3;
        res.atoms.forEach(a => {
            if (['N', 'C', 'O', 'H', 'CA'].indexOf(a.atomType) == -1) {
                scHAcom.x += a.x;
                scHAcom.y += a.y;
                scHAcom.z += a.z;
            }
        })
        if (scHAcom.lengthSq() == 0) scHAcom.x = 1;
        scHAcom.normalize();
        let CA = res.atoms.filter(a => a.atomType == 'CA')[0];
        if(CA) {
            let CApos = new THREE.Vector3(<number>CA.x, <number>CA.y, <number>CA.z);
            let CABfactor = 0;
            if(!isNaN(parseFloat(CA.tempFactor))) {
                CABfactor = parseFloat(CA.tempFactor);
            }
            let a1 = scHAcom.clone().sub(CApos).normalize();
            if (a1.dot(bv1) < 0.99) {
                a3 = a1.clone().cross(bv1);
            } else if (a1.dot(bv2) < 0.99) {
                a3 = a1.clone().cross(bv2);
            } else if (a1.dot(bv3) < 0.99) {
                a3 = a1.clone().cross(bv3);
            }
            return [pdbid, type, CApos.toArray(), a1.toArray(), a3.toArray(), CABfactor];
        } else return ["NOCA", "NOCA", bv1.toArray(), bv1.toArray(), bv1.toArray(), 0]
    }

    let ring_names: string[] = ["C2", "C4", "C5", "C6", "N1", "N3"];
    let pairs: [string, string][];

    function* subsets(array:any[], length:number, start:number=0):Generator<Array<any>> {
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

    let CalcInfoNC = (res: pdbresidue): [string, string, number[], number[], number[], number] => {
        type = nucelem[res.resType];
        pdbid = res.pdbResIdent;
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

        if(nanCheck) return;

        nuccom.x = res.atoms.map(a => a.x).reduce((a, b) => a + b);
        nuccom.y = res.atoms.map(a => a.y).reduce((a, b) => a + b);
        nuccom.z = res.atoms.map(a => a.z).reduce((a, b) => a + b);
        let l = res.atoms.length;
        let pos = nuccom.divideScalar(l);

        let Bfactavg = Bfacts.map(a => a).reduce((a, b) => a+b);
        Bfactavg /= res.atoms.length;

        let c5atom = res.atoms.filter(a => a.atomType == "C5'" || a.atomType == "C5*")[0];
        let c3atom = res.atoms.filter(a => a.atomType == "C3'" || a.atomType == "C3*")[0];
        if(c5atom === undefined || c3atom === undefined){
            console.log("No C5' or C3' found for Nucleotide initialization");
            return;
        }
        let c5pos = new THREE.Vector3(c5atom.x, c5atom.y, c5atom.z);
        let c3pos = new THREE.Vector3(c3atom.x, c3atom.y, c3atom.z);
        let parallel_to = c5pos.sub(c3pos);

        let ring_poss = subsets(ring_names, 3);
        let a3 = new THREE.Vector3;
        for (let types of ring_poss) {
            let p = res.atoms.filter(a => a.atomType == types[0])[0]
            let q = res.atoms.filter(a => a.atomType == types[1])[0]
            let r = res.atoms.filter(a => a.atomType == types[2])[0]
            if(p === undefined || q === undefined || r === undefined){
                if(p===undefined){console.log('Atom ' + types[0] + " not found in residue " + res.pdbResIdent + " in chain " + res.chainID);}
                if(q===undefined){console.log('Atom ' + types[1] + " not found in residue " + res.pdbResIdent + " in chain " + res.chainID);}
                if(r===undefined){console.log('Atom ' + types[0] + " not found in residue " + res.pdbResIdent + " in chain " + res.chainID);}
                break;
            } else {
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
        } else {
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

        return [pdbid, type, pos.toArray(), a1.toArray(), a3.toArray(), Bfactavg]
    }

    let nextElementId = 0;
    let oldElementId = nextElementId;

    let strandInit = [];

    let sys = new System(0, nextElementId);

    let com = new THREE.Vector3();
    let bFactors = [];
    let xdata = [];

    for (let i: number = 0; i < (initlist.uniqueIDs.length); i++) {
        let nstrand = strands[i];

        if (nstrand.strandtype == 'pro') {
            let currentStrand: Peptide = sys.addNewPeptideStrand();
            let strandInfo = [];
            strandtype.push("pro");
            for (let j = 0; j < nstrand.residues.length; j++) {
                let aa = currentStrand.createBasicElement(nextElementId);
                aa.sid = nextElementId - oldElementId;
                let info = CalcInfoAA(nstrand.residues[j]);
                if(info[1] != "NOCA"){
                    strandInfo.push(info);
                    bFactors.push(info[5]);
                    xdata.push(aa.sid);
                    com.add(new THREE.Vector3().fromArray(info[2]));
                    pdbindices.push([pindx, initlist.uniqueIDs[i], info[0]]);
                    aa.pdbindices = [pindx, initlist.uniqueIDs[i], info[0]];
                    aa.n3 = null;
                    aa.n5 = null;
                    if (j != 0) {
                        let prevaa = elems[elems.length-1];
                        aa.n3 = prevaa;
                        prevaa.n5 = aa;
                    }
                    elems.push(aa);
                    nextElementId++;
                }
            }
            strandInit.push(strandInfo);
            if(currentStrand.end3 == undefined){
                console.log("Strand " + nstrand.chainID + " could not be initialized")
            } else {
                currentStrand.updateEnds();
                initlist.repeatIDs.forEach((rid, indx) => {
                    let repeatInfo = [];
                    if (nstrand.chainID.includes(rid)) {
                        let repeatStrand: Peptide = sys.addNewPeptideStrand();
                        strandtype.push("pro");
                        currentStrand.getMonomers().forEach((mon, mid) => {
                            let repeatAmino = repeatStrand.createBasicElement(nextElementId);
                            repeatAmino.pdbindices = (mon as AminoAcid).pdbindices;
                            pdbindices.push(repeatAmino.pdbindices);
                            repeatAmino.sid = nextElementId - oldElementId;
                            let rinfo = strandInfo[mid].slice();
                            let rotquat = initlist.repeatQuatRots[indx];
                            rinfo[3] = new THREE.Vector3().fromArray(rinfo[3]).applyQuaternion(rotquat).toArray()
                            rinfo[4] = new THREE.Vector3().fromArray(rinfo[4]).applyQuaternion(rotquat).toArray()
                            rinfo[2] = initlist.repeatCoords[indx][mid];
                            bFactors.push(rinfo[5])
                            xdata.push(repeatAmino.sid)
                            com.add(rinfo[2])
                            rinfo[2] = rinfo[2].toArray();
                            repeatInfo.push(rinfo)
                            repeatAmino.n3 = null;
                            repeatAmino.n5 = null;
                            if (mid != 0) {
                                let prevaa = elems[elems.length-1];
                                repeatAmino.n3 = prevaa;
                                prevaa.n5 = repeatAmino;
                            }
                            elems.push(repeatAmino);
                            nextElementId++;
                        });
                        repeatStrand.updateEnds();
                        strandInit.push(repeatInfo);
                    }
                });
            }

        } else if (nstrand.strandtype == 'rna' || nstrand.strandtype == 'dna') {
            let type = nstrand.strandtype == 'rna'? 'RNA' : 'DNA';
            let currentStrand: NucleicAcidStrand = sys.addNewNucleicAcidStrand(type);
            let strandInfo = [];
            let tmptype = nstrand.strandtype;
            strandtype.push(tmptype);
            let pdbres3to5 = nstrand.residues.reverse();
            for (let j = 0; j < nstrand.residues.length; j++) {
                try{
                    let info = CalcInfoNC(pdbres3to5[j]);
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
                        let prevnc = elems[elems.length-1];
                        nc.n3 = prevnc;
                        prevnc.n5 = nc;
                    }
                    elems.push(nc);
                    nextElementId++;
                } catch (e) {
                    console.log("Nucleotide could not be initialized");
                }
            }
            strandInit.push(strandInfo);
            if(currentStrand.end3 == undefined){
                console.log("Strand " + nstrand.chainID + " could not be initialized")
            } else {
                currentStrand.updateEnds();
                initlist.repeatIDs.forEach((rid, indx) => {
                    let repeatInfo = [];
                    if(nstrand.chainID.includes(rid)){
                        let repeatStrand: NucleicAcidStrand = sys.addNewNucleicAcidStrand(currentStrand.kwdata['type']);
                        strandtype.push(tmptype);
                        currentStrand.getMonomers(true).forEach((mon, mid) => {
                            let repeatNuc = repeatStrand.createBasicElementTyped(nstrand.strandtype, nextElementId);
                            repeatNuc.sid = nextElementId - oldElementId;
                            try {
                                let rinfo = strandInfo[mid].slice();
                                let rotquat = initlist.repeatQuatRots[indx];
                                rinfo[3] = new THREE.Vector3().fromArray(rinfo[3]).applyQuaternion(rotquat).toArray()
                                rinfo[4] = new THREE.Vector3().fromArray(rinfo[4]).applyQuaternion(rotquat).toArray()
                                rinfo[2] = initlist.repeatCoords[indx][mid];
                                pdbindices.push(repeatNuc.pdbindices);
                                bFactors.push(rinfo[5])
                                xdata.push(repeatNuc.sid)
                                com.add(rinfo[2])
                                rinfo[2] = rinfo[2].toArray();
                                repeatInfo.push(rinfo)
                                repeatNuc.n3 = null;
                                repeatNuc.n5 = null;
                                if (mid != 0) {
                                    let prevaa = elems[elems.length-1];
                                    repeatNuc.n3 = prevaa;
                                    prevaa.n5 = repeatNuc;
                                }
                                elems.push(repeatNuc);
                                nextElementId++;
                            } catch (e) {
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

    let xpos = strandInit.flat().map((info) => {return info[2][0];});
    let ypos = strandInit.flat().map((info) => {return info[2][1];});
    let zpos = strandInit.flat().map((info) => {return info[2][2];});

    let xmax = xpos.reduce((a,b) => {return Math.max(a, b)})
    let xmin = xpos.reduce((a,b) => {return Math.min(a, b)})
    let ymax = ypos.reduce((a,b) => {return Math.max(a, b)})
    let ymin = ypos.reduce((a,b) => {return Math.min(a, b)})
    let zmax = zpos.reduce((a,b) => {return Math.max(a, b)})
    let zmin = zpos.reduce((a,b) => {return Math.min(a, b)})
    let xdim= xmax - xmin;
    let ydim= ymax - ymin;
    let zdim= zmax - zmin;
    if(xdim < 2) xdim = 2.5;
    if(ydim < 2) ydim = 2.5;
    if(zdim < 2) zdim = 2.5;

    xpos = undefined;
    ypos = undefined;
    zpos = undefined;
    sys = undefined;
    ring_names = undefined;
    strands = undefined;
    initlist = undefined;

    return [strandInit, strandtype, com, [label, bFactors, xdata, "bfactor", "A_sqr"], [xdim, ydim, zdim],
        pdbindices, [pdbinfo.pdbfilename, pdbinfo.pdbsysinfo, pdbinfo.initlist, pdbinfo.disulphideBonds]];
}