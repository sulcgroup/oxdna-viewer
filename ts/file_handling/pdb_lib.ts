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
    AM.calcPositions(i2, i3, i4, true);
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
    NC.calcPositions(i2, i3, i4, true);
}