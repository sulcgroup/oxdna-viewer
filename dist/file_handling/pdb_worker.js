importScripts('./pdb_lib.js');
importScripts("../../ts/lib/three.js");
importScripts("../model/basicElement.js");
importScripts("../model/nucleotide.js");
importScripts("../model/aminoAcid.js");
importScripts("../model/DNA.js");
importScripts("../model/RNA.js");
importScripts("../model/strand.js");
importScripts("../model/system.js");
this.onmessage = function (e) {
    let pdblines = e.data[0];
    let pdbFileInfoIndx = e.data[1];
    let elemIndx = e.data[2];
    let syscount = e.data[3];
    let [initList, dsbonds] = prep_pdb(pdblines);
    let pdata = pdb_step1(pdblines);
    let ret = addPDBToScene(pdata, pdbFileInfoIndx, elemIndx, syscount);
    pdblines = undefined;
    pdata = undefined;
    postMessage(ret, undefined);
};
var backboneColors = [
    new THREE.Color(0xfdd291),
    new THREE.Color(0xffb322),
    new THREE.Color(0x437092),
    new THREE.Color(0x6ea4cc),
];
var nucleosideColors = [
    new THREE.Color(0x4747B8),
    new THREE.Color(0xFFFF33),
    //C or A
    new THREE.Color(0x8CFF8C),
    //T/U or T
    new THREE.Color(0xFF3333),
    //E
    new THREE.Color(0x660000),
    //S
    new THREE.Color(0xFF7042),
    //D
    new THREE.Color(0xA00042),
    //N
    new THREE.Color(0xFF7C70),
    //Q
    new THREE.Color(0xFF4C4C),
    //H
    new THREE.Color(0x7070FF),
    //G
    new THREE.Color(0xEBEBEB),
    //P
    new THREE.Color(0x525252),
    //R
    new THREE.Color(0x00007C),
    //V
    new THREE.Color(0x5E005E),
    //I
    new THREE.Color(0x004C00),
    //L
    new THREE.Color(0x455E45),
    //M
    new THREE.Color(0xB8A042),
    //F
    new THREE.Color(0x534C42),
    //Y
    new THREE.Color(0x8C704C),
    //W
    new THREE.Color(0x4F4600),
];
function prep_pdb(pdblines) {
    //Checks for repeated chains, Biological Assemblies etc.
    let chainDivs = [];
    let modelDivs = [];
    let firstatom = 0;
    let noatom = false;
    // Other Info for MWCENM
    let dsbonds = [];
    let start = 0; // sometimes the end of a chain is saved into a different file, ignoring any garbage like that
    if (pdblines[0].substr(0, 3) == "TER") {
        start = 1;
    }
    // Find Chain Termination statements TER and uses
    // added contains_atoms as it is a necessary switch
    let atoms_present = false;
    for (let i = start; i < pdblines.length; i++) {
        if (pdblines[i].substr(0, 4) == 'ATOM' && noatom == false) {
            firstatom = i; //line number of first atomic coordinate
            noatom = true;
        }
        if (pdblines[i].substr(0, 4) == 'ATOM') {
            atoms_present = true;
        }
        if (pdblines[i].substr(0, 3) === 'TER' && atoms_present) {
            chainDivs.push(i);
            atoms_present = false;
        }
        else if (pdblines[i].substr(0, 6) === 'ENDMDL') {
            modelDivs.push(i);
        }
        else if (pdblines[i].substr(0, 6) === 'SSBOND') {
            let line = pdblines[i];
            // disulphide bond info: residue 1 chain id, res 1 res num, res2 chain id, res 2 res num
            let dbond = [line.substring(15, 17).trim(), parseInt(line.substring(17, 21).trim()), line.substring(29, 31).trim(), parseInt(line.substring(31, 35).trim())];
            dsbonds.push(dbond);
        }
        else if (pdblines[i].substr(0, 3) === 'END' && atoms_present) { // sometimes people don't end their chain with a TER statement
            // if (pdblines[i-1].substr(0, 4) == 'ATOM'){ // only if previous line has atom
            chainDivs.push(i);
            atoms_present = false;
            // }
        }
    }
    // If models are present in pdb file, Assumes that repeat chain ids are
    // repeat instances of the 1st chain w/ the same chain identifer
    let bioassemblyassumption = false;
    if (modelDivs.length > 0)
        bioassemblyassumption = true;
    let nchainids = []; // Store new chainids
    let finalids = []; // Final Ids to be Loaded, can be from chains or models
    let finaldivs = [];
    if (chainDivs.length != 0) { // Assumes normal PDB file with all chains declared
        // check for chaindivs that are too close to one another (<= 2 lines)
        chainDivs = chainDivs.filter(function (a, aid, arr) {
            if (aid != 0) {
                return a - arr[aid - 1] > 3; // false if less than two lines from previous (ex. [1030, 1032, 100001] -> [1030, 100001])
            }
            else
                return true;
        });
        // Look at line above chain termination for chain ID
        let chainids = [];
        chainDivs.forEach((d, idx, arr) => {
            let chainid = pdblines[d - 1].substring(21, 22).trim();
            if (chainid == "" && idx != 0) {
                chainid = pdblines[(d - Math.floor((d - arr[idx - 1]) / 2))].substring(21, 22).trim(); // halfway through the chain
                chainids.push(chainid);
            }
            else {
                chainids.push(chainid);
            }
        });
        //Re-Assign Chain Ids based off repeating or not
        let sorted_repeated_chainids = [];
        chainids.forEach((chain, ind) => {
            if (chainids.indexOf(chain) != ind && bioassemblyassumption) { //Check for repeated and presence of models
                sorted_repeated_chainids.push(chain);
            }
            else {
                sorted_repeated_chainids.push(chain + "*"); // not a repeat? denoted as A*
            }
        });
        let fullalpha = [];
        let lastindex = 1; //
        let alphabet = 'a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z.1.2.3.4.5.6.7.8.9.<.>.?./.!.@.#.$.%.^.&.*.(.)._.-.=.+'.split('.');
        fullalpha = fullalpha.concat(alphabet);
        // supports 2862 chains with the same chain id in the same pdb file
        alphabet.forEach((id, idx, arr) => fullalpha = fullalpha.concat(arr.map(x => { return id + x; })));
        sorted_repeated_chainids.forEach((val, ind) => {
            if (nchainids.indexOf(val) != ind) { //same chain identifier needs to be fixed
                if (val != "" && val.includes("*")) { //unique chain
                    let nval = val;
                    let attmpt_indx = lastindex;
                    while (nchainids.indexOf(nval) != -1 && attmpt_indx < 2862) {
                        nval = fullalpha[attmpt_indx] + val;
                        attmpt_indx += 1;
                    }
                    lastindex = attmpt_indx;
                    nchainids.push(nval);
                }
                else {
                    nchainids.push(val);
                }
            }
            else {
                nchainids.push(val);
            }
        });
        //important must be set
        finalids = nchainids;
        finaldivs = chainDivs;
    }
    else if (modelDivs.length != 0) {
        // Assumes a malformed PDB with models but no chains, (looking at you Modeller)
        bioassemblyassumption = false;
        let chainids = [];
        modelDivs.forEach((d, dindx) => {
            chainids.push((dindx + 1).toString() + "*"); // Assumes all chains are unique since they weren't labeled
        });
        finalids = chainids;
        finaldivs = modelDivs;
    }
    // Stores ID, start line, end line if chain is unique
    // Stores Id, start line, end line, coordinates a if chain is repeated and Quat Rotation for a1
    // tl;dr  unique chains require more calculations while repeated chains can resuse those calculated parameters and shifts them accordingly
    // necessary for loading large things like Virus particles
    let initList = new pdbReadingList;
    let prevend = firstatom;
    for (let i = 0; i < finalids.length; i++) {
        if (finalids[i].includes("*")) {
            let id = finalids[i].replace('*', ''); // remove asterisk from chain id
            initList.uniqueIDs.push(id);
            initList.uniqueStart.push(prevend);
            initList.uniqueEnd.push(finaldivs[i]);
            prevend = finaldivs[i];
        }
        else {
            initList.repeatIDs.push(finalids[i]);
            initList.repeatStart.push(prevend);
            initList.repeatEnd.push(finaldivs[i]);
            initList.repeatCoords.push([new THREE.Vector3(0, 0, 0)]);
            initList.repeatQuatRots.push(new THREE.Quaternion());
            prevend = finaldivs[i];
        }
    }
    return [initList, dsbonds];
}
function pdb_step1(pdbLines) {
    let [initList, dsbonds] = prep_pdb(pdbLines);
    let chainSingleton = (initList.uniqueIDs.length + initList.repeatIDs.length) == 1; // Boolean for if only single chain found in the entire pdb file
    // used in loadpdbsection to trigger new chain creation upon nonsequential residue ids
    let uniqatoms = [];
    let uniqresidues = []; // individual residue data parsed from Atomic Info
    let uniqchains = []; // individual chain data parsed from Atomic Info
    // bookkeeping
    let label = "pdb";
    // Search Just the Header for PDB code ex. (1BU4), label used for graph datasets
    for (let i = 0; i < 10; i++) {
        if (pdbLines[i].substr(0, 6) === 'HEADER') {
            let head = pdbLines[i].match(/\S+/g); //header info, search
            head.forEach(i => {
                let si = i.split('');
                if (si.length == 4 && (!isNaN(parseFloat(si[0])) && isFinite(parseFloat(si[0])))) { //PDB IDs are 4 characters 1st character is always an integer checks for that
                    label = i;
                }
            });
        }
    }
    // Called for each unique chain found in the system
    let pdbpositions = [];
    let prevChainId = "";
    let Amino = false;
    let atoms = [];
    let residues = []; // individual residue data parsed from Atomic Info
    let chains = [];
    let na = new pdbatom();
    let nr = new pdbresidue();
    let nc = new pdbchain();
    // helper functions for calculating a1 vector of nucleotide
    function contains(target, pattern) {
        var value = 0;
        pattern.forEach(function (word) {
            value = value + target.includes(word);
        });
        return (value === 1);
    }
    // calculates a1 vector from nucleotide of Amino acid
    let calcA1FromRes = function (firstresidueunique) {
        if (recongizedProteinResidues.indexOf(firstresidueunique.resType) > -1) {
            let scHAcom = new THREE.Vector3; //side chain Heavy atoms Center of Mass
            firstresidueunique.atoms.forEach(a => {
                if (['N', 'C', 'O', 'H', 'CA'].indexOf(a.atomType) == -1) {
                    scHAcom.x += a.x;
                    scHAcom.y += a.y;
                    scHAcom.z += a.z;
                }
            });
            // if null vector (glycine) a1 is 1, 0, 0
            if (scHAcom.lengthSq() == 0)
                scHAcom.x = 1;
            scHAcom.normalize();
            let CA = firstresidueunique.atoms.filter(a => a.atomType == 'CA')[0];
            if (CA) {
                let CApos = new THREE.Vector3(CA.x, CA.y, CA.z);
                return scHAcom.clone().sub(CApos).normalize(); // this is the a1 vector
            }
            else {
                console.log("No CA coordinate found in Repeat Chain");
                return new THREE.Vector3(1, 0, 0);
            }
        }
        else {
            let pairs;
            // Compute a1 Vector
            if (contains(firstresidueunique.resType, ["C", "T", "U"])) {
                pairs = [["N3", "C6"], ["C2", "N1"], ["C4", "C5"]];
            }
            else {
                pairs = [["N1", "C4"], ["C2", "N3"], ["C6", "C5"]];
            }
            let a1 = new THREE.Vector3(0, 0, 0);
            for (let i = 0; i < pairs.length; i++) {
                let p_atom = firstresidueunique.atoms.filter(a => a.atomType == pairs[i][0])[0];
                let q_atom = firstresidueunique.atoms.filter(a => a.atomType == pairs[i][1])[0];
                let diff = new THREE.Vector3(p_atom.x - q_atom.x, p_atom.y - q_atom.y, p_atom.z - q_atom.z);
                a1.add(diff);
            }
            a1.normalize();
            return a1;
        }
    };
    let chainindx = 0;
    let loadpdbsection = function (start, end) {
        pdbpositions = [];
        atoms = [];
        chains = [];
        residues = [];
        prevChainId = "";
        let prevResId = " ";
        let tmpchainID = ""; // Original storage place of chain information
        let rawPrevChainId = ""; // Unaltered Chain Info, used as a second criteria for chain formation, besides just residue numbers
        // residue type has to be correct
        let Amino = recongizedProteinResidues.indexOf(pdbLines[start].substring(17, 20).trim()) >= 0;
        for (let j = start; j < end; j++) {
            if (pdbLines[j].substr(0, 4) === 'ATOM') {
                let pdbLine = pdbLines[j];
                // http://www.wwpdb.org/documentation/file-format-content/format33/sect9.html#ATOM
                na.indx = pdbLine.substring(6, 11).trim();
                na.atomType = pdbLine.substring(12, 16).trim();
                na.altLoc = pdbLine.substring(16, 17).trim();
                na.resType = pdbLine.substring(17, 20).trim();
                let chaincheck = pdbLine.substring(21, 22).trim() != ""; // chain is legit if filled at 21st character
                if (!chaincheck) { // fill missing chain data
                    if (prevChainId == chainindx.toString()) { //check if chainindx is the same. This gets iterated based off criteria below
                        na.chainID = chainindx.toString();
                        tmpchainID = na.chainID;
                    }
                    else {
                        na.chainID = (chainindx + 1).toString();
                        tmpchainID = na.chainID;
                    }
                    let tmp = pdbLine.substring(21, 27); // Location of residue identifer IF file is missing chain data
                    //check for insertion code
                    na.iCode = "";
                    if (isNaN(parseInt(tmp[5]))) {
                        na.iCode = tmp[5];
                        na.pdbResIdent = tmp.slice(0, 5).trim();
                    }
                    else {
                        na.pdbResIdent = tmp.trim();
                    }
                }
                else {
                    let negative = false; // flag that triggers upon finding negative residues
                    let resIdentAddOn = '';
                    tmpchainID = pdbLine.substring(21, 23).trim(); //changed to (21, 22) to (21, 23) to deal with 2 letter identifiers present in some PDB Files
                    if (tmpchainID.includes("-", -1)) {
                        // negative numbered residues, yes they're real, negative sign is taken into the chainID
                        negative = true;
                        tmpchainID = tmpchainID.substring(0, 1);
                    }
                    if (prevChainId.includes('9', -1)) { // number strand identifiers
                        if (isNaN(parseInt(tmpchainID.substr(0, 1))) && isNaN(parseInt(tmpchainID.substr(1, 1)))) {
                            na.chainID = tmpchainID;
                        }
                        else {
                            resIdentAddOn = tmpchainID.substr(1, 1);
                            na.chainID = tmpchainID.substr(0, 1);
                        }
                    }
                    else {
                        if (!isNaN(parseInt(tmpchainID.substr(1, 1)))) {
                            resIdentAddOn = tmpchainID.substr(1, 1);
                            na.chainID = tmpchainID.substr(0, 1);
                        }
                        else {
                            na.chainID = tmpchainID;
                        }
                    }
                    let tmp = pdbLine.substring(23, 29); // Usually the residue number
                    //check for insertion code
                    na.iCode = "";
                    if (isNaN(parseInt(tmp[5]))) { // not a number, most likely an insertion code
                        na.iCode = tmp[5];
                        if (!negative) {
                            na.pdbResIdent = resIdentAddOn + tmp.slice(0, 5).trim();
                        }
                        else {
                            na.pdbResIdent = '-' + resIdentAddOn + tmp.slice(0, 5).trim();
                        }
                    }
                    else {
                        // is a number, most likely no insertion code and misplaced pbd residue number
                        if (!negative) {
                            na.pdbResIdent = resIdentAddOn + tmp.trim();
                        }
                        else {
                            na.pdbResIdent = '-' + resIdentAddOn + tmp.trim();
                        }
                    }
                }
                // Convert From Angstroms to Simulation Units while we're at it
                na.x = parseFloat(pdbLine.substring(30, 38)) / 8.518;
                na.y = parseFloat(pdbLine.substring(38, 46)) / 8.518;
                na.z = parseFloat(pdbLine.substring(46, 54)) / 8.518;
                na.occupancy = pdbLine.substring(54, 60).trim();
                na.tempFactor = pdbLine.substring(60, 66).trim();
                na.element = pdbLine.substring(76, 78).trim();
                na.charge = pdbLine.substring(78, 80).trim();
                if (Amino) {
                    if (na.atomType == "CA")
                        pdbpositions.push(new THREE.Vector3(na.x, na.y, na.z));
                }
                else {
                    if (na.atomType == "N1")
                        pdbpositions.push(new THREE.Vector3(na.x, na.y, na.z));
                }
                //checks if last read atom belongs to a different chain than the one before it, or if the Res Identifer has sudden jump
                if (prevChainId !== na.chainID
                    || (Math.abs(parseInt(na.pdbResIdent) - parseInt(prevResId)) > 1 && !isNaN(parseInt(prevResId)) && rawPrevChainId !== tmpchainID)
                    || (Math.abs(parseInt(na.pdbResIdent) - parseInt(prevResId)) > 1 && chainSingleton)) {
                    //console.log("chain created");
                    chainindx += 1;
                    na.chainIndx = chainindx;
                    nc.chainID = na.chainID;
                    nc.chainIndx = na.chainIndx;
                    // copy is necessary
                    let ncc = {
                        ...nc
                    };
                    chains.push(ncc);
                    //set previous chain id to that of last read atom
                    prevChainId = na.chainID;
                    rawPrevChainId = tmpchainID; // Unaltered Chain Info, used as a second criteria for chain formation, besides just residue numbers
                }
                else { // not a new chain, same chain index
                    na.chainIndx = chainindx;
                }
                //checks if last read atom belongs to a different chain than the one before it
                if (prevResId != na.pdbResIdent) {
                    nr.resType = na.resType;
                    nr.pdbResIdent = na.pdbResIdent;
                    nr.chainID = na.chainID;
                    nr.chainIndx = na.chainIndx;
                    // copy is necessary
                    let nrc = {
                        ...nr
                    };
                    residues.push(nrc);
                    //set previous chain id to that of last read atom
                    prevResId = nrc.pdbResIdent;
                }
                // copy is necessary
                let nac = {
                    ...na
                };
                atoms.push(nac);
            }
        }
        // info
        return [Amino, pdbpositions, atoms, residues, chains];
    };
    let getpdbpositions = function (start, end, Amino) {
        // reads in pdb text and returns the positions b/t start and end linenumbers and the first residues a1 vector
        let pdbpositions = [];
        let atoms = [];
        let firstres = true;
        let prevResId;
        let a1;
        for (let j = start; j < end; j++) {
            if (pdbLines[j].substr(0, 4) === 'ATOM') {
                if (firstres) {
                    let pdbLine = pdbLines[j];
                    na.atomType = pdbLine.substring(12, 16).trim();
                    na.resType = pdbLine.substring(17, 20).trim();
                    let tmp = pdbLine.substring(23, 29); // Usually the residue number
                    //check for insertion code
                    na.iCode = "";
                    if (isNaN(parseInt(tmp[5]))) {
                        na.iCode = tmp[5];
                        na.pdbResIdent = tmp.slice(0, 5).trim();
                    }
                    else {
                        na.pdbResIdent = tmp.trim();
                    }
                    // Convert From Angstroms to Simulation Units while we're at it
                    na.x = parseFloat(pdbLine.substring(30, 38)) / 8.518;
                    na.y = parseFloat(pdbLine.substring(38, 46)) / 8.518;
                    na.z = parseFloat(pdbLine.substring(46, 54)) / 8.518;
                    // residue type has to be correct
                    if (atoms.length == 0)
                        prevResId = na.pdbResIdent;
                    //checks if last read atom belongs to a different Residue than the one before it
                    if (prevResId != na.pdbResIdent) { // will trigger after first residue is read
                        nr.resType = atoms[0].resType;
                        nr.pdbResIdent = atoms[0].pdbResIdent;
                        nr.atoms = atoms;
                        let nrc = {
                            ...nr
                        };
                        a1 = calcA1FromRes(nrc);
                        firstres = false;
                    }
                    else {
                        // copy is necessary
                        let nac = {
                            ...na
                        };
                        atoms.push(nac);
                    }
                }
                // Align via N1 positions for DNA & CA for proteins
                if (!Amino && pdbLines[j].substring(12, 16).trim() == "N1") {
                    let x = parseFloat(pdbLines[j].substring(30, 38)) / 8.518;
                    let y = parseFloat(pdbLines[j].substring(38, 46)) / 8.518;
                    let z = parseFloat(pdbLines[j].substring(46, 54)) / 8.518;
                    pdbpositions.push(new THREE.Vector3(x, y, z));
                }
                else if (Amino && pdbLines[j].substring(12, 16).trim() == "CA") {
                    let x = parseFloat(pdbLines[j].substring(30, 38)) / 8.518;
                    let y = parseFloat(pdbLines[j].substring(38, 46)) / 8.518;
                    let z = parseFloat(pdbLines[j].substring(46, 54)) / 8.518;
                    pdbpositions.push(new THREE.Vector3(x, y, z));
                }
            }
        }
        // nr.atoms = this.atoms; //fill atoms array
        return [pdbpositions, a1];
    };
    // load all Unique Chains
    initList.uniqueIDs.forEach((id, indx) => {
        let alignTO = loadpdbsection(initList.uniqueStart[indx], initList.uniqueEnd[indx]);
        uniqatoms = uniqatoms.concat(alignTO[2]);
        uniqresidues = uniqresidues.concat(alignTO[3]);
        uniqchains = uniqchains.concat(alignTO[4]);
        // deal with repeats of each individual unique chain
        initList.repeatIDs.forEach((rid, rindx) => {
            if (id.includes(rid)) { //Makes sure Chain IDs contain original chain identifier
                let alignME = getpdbpositions(initList.repeatStart[rindx], initList.repeatEnd[rindx], alignTO[0]); // [0] -> pdb positions [1] -> a1 vector of first residue
                let firstresidueunique = uniqresidues[0];
                firstresidueunique.atoms = uniqatoms.filter(atom => atom.chainIndx == firstresidueunique.chainIndx && atom.pdbResIdent == firstresidueunique.pdbResIdent);
                let uniqa1 = calcA1FromRes(firstresidueunique);
                let repeata1 = alignME[1];
                if (alignME[0].length != alignTO[1].length)
                    console.log("PDB Error: Master chain and repeat chain have unequal lengths: " + alignME[0].length.toString() + " " + alignTO[1].length.toString());
                // currently the rotation doesn't work as desired, but is not necessary at this stage
                // b/c protein a1 and a3 are arbitrary (for now), and dna repeat strands don't seem to exist in wild pdbs
                // let alignMEcoord = alignME[0].map(x => {return x.clone()}); //copy our arrays
                let newcoords = alignME[0].map(x => { return x.clone(); }); //copy our arrays
                // let alignTOcoord = alignTO[1].map(x => {return x.clone()});//copy our arrays
                // let uniqueCOM = alignTO[1].reduce((a,b) => a.add(b)).divideScalar(alignTO[1].length);
                // let repeatCOM = alignME.reduce((a,b) => a.add(b)).divideScalar(alignME.length);
                //
                // let aME = alignMEcoord[0].clone().sub(repeatCOM).normalize();
                // let aTO = alignTOcoord[0].clone().sub(uniqueCOM).normalize();
                // console.log(aME.x.toString() + " " + aME.y.toString() + " " + aME.z.toString());
                // console.log(aTO.x.toString() + " " + aTO.y.toString() + " " + aTO.z.toString());
                //Calc quaternion rotation between vectors
                // let rotQuat = new THREE.Quaternion().setFromUnitVectors(uniqa1, repeata1);
                let rotQuat = new THREE.Quaternion().setFromUnitVectors(repeata1, uniqa1);
                // let rotQuat = new THREE.Quaternion().setFromUnitVectors(aME, aTO);
                // let newcoords = alignMEcoord;
                initList.repeatCoords[rindx] = newcoords;
                initList.repeatQuatRots[rindx] = rotQuat;
            }
        });
    });
    // Assigns Atoms to their corresponding Residues
    uniqresidues.forEach((res) => {
        res.atoms = uniqatoms.filter(atom => atom.chainIndx == res.chainIndx && atom.pdbResIdent == res.pdbResIdent);
    });
    // Assigns Residues to their corresponding Chain
    uniqchains.forEach((chain) => {
        chain.residues = uniqresidues.filter(res => res.chainIndx == chain.chainIndx);
    });
    if (uniqchains.length == 0) {
        console.log("No Chains Found in PDB File");
        return;
    }
    if (uniqatoms.length == 0) {
        console.log("No Atoms Found in PDB File");
        return;
    }
    // Rewrite initlist.uniqueIDs to take into account subchains (labeled but no TER statements) found in the PDB file
    // Won't work for repeated copies of subchains (something to look out for in the future)
    initList.uniqueIDs = uniqchains.map(x => { return x.chainID; });
    // These hefty objects are needed to calculate the positions & a1/ a3 of nucleotides and amino acids
    let pdbinfo = new pdbinfowrapper(label, uniqchains, initList);
    pdbinfo.disulphideBonds = dsbonds; // Store Disulphide Bonds
    uniqatoms = undefined;
    uniqchains = undefined;
    uniqresidues = undefined;
    initList = undefined;
    return pdbinfo;
}
function addPDBToScene(pdbinfo, pindx, elementIndx, syscount) {
    // let pindx = pdbFileInfo.indexOf(pdata);
    let elems = [];
    let strandtype = [];
    let strands = pdbinfo.pdbsysinfo;
    let label = pdbinfo.pdbfilename;
    let initlist = pdbinfo.initlist;
    let pdbindices = []; // need to get this info back out
    // Looking back at this the strands as a variable name probably wasn't the most unique choice
    // strands is meant to be the chain object from the PDB Parser passed through the pdbsysinfo of the pdbdata
    // Parses PDB Data and Intializes System, Errors go to the Console
    // Intialize bookkeeping Members for Boolean Checks
    let checker = {
        DNAPresent: false,
        proteinPresent: false,
        RNAPresent: false,
        mutantStrand: false
    };
    //Classify Residue Types
    for (let i = 0; i < initlist.uniqueIDs.length; i++) {
        let strand = strands[i];
        // Reset Bookkeeping Members for each Strand
        for (let key in checker)
            checker[key] = false;
        // Loop over all Residues in each Strand
        strand.residues.forEach(res => {
            // Sort PDB Info and set Flags for System Initialization at Residue Level
            res.resType = res.resType.replace(/[0-9]/g, '');
            //Check if Residue from PDB is in recongized array
            if (recongizedDNAResidues.indexOf(res.resType) > -1 || recongizedDNAStrandEnds.indexOf(res.resType) > -1) {
                // Deal with Special Cases Here
                if (res.resType === 'DN') {
                    console.log("Nucleotide Base type 'DN' (for Generic Nucleic Acid) in PDB File. Replacing with 'DA'");
                    res.resType = 'DA';
                }
                if (res.resType === 'DI') {
                    console.log("Nucleotide Number blank has Residue Type Inosine. This is currently unsupported.");
                    return 1;
                }
                // Sets which Nucleic Acids are Intialized
                res.type = 'dna';
                // Bookkeeping
                checker.DNAPresent = true;
            }
            else if (recongizedProteinResidues.indexOf(res.resType) > -1) {
                // Deal with Special Cases Here
                if (res.resType === 'UNK') {
                    console.log("Amino Acid blank is Unknown, shown in grey");
                    res.resType = undefined;
                }
                // Sets which Residues are Intialized
                res.type = 'pro';
                // Bookkeeping
                checker.proteinPresent = true;
            }
            else if (recongizedRNAResidues.indexOf(res.resType) > -1 || recongizedRNAStrandEnds.indexOf(res.resType) > -1) {
                // Deal with Special Cases Here
                if (res.resType === 'N') {
                    console.log("Nucleotide has Residue Base type 'N' for Generic Nucleic Acid in PDB File, shown in grey");
                    res.resType = undefined;
                }
                if (res.resType === 'I') {
                    console.log("Nucleotide Number blank has Residue Type Inosine. This is currently unsupported.");
                    return 1;
                }
                if (res.resType === 'TU') { // weird case
                    res.resType = 'U';
                }
                // Sets which Nucleic Acids are Intialized
                res.type = 'rna';
                // Bookkeeping
                checker.RNAPresent = true;
            }
            else {
                console.log("Residue type: " + res.resType + " Residue Number: " + res.pdbResIdent + " on chain: " + strand.chainID + " in Provided PDB is Not Supported. " +
                    "It will not be Intialized in the Viewer.");
                res.type = 'unworthy';
            }
        });
        // Corrects wrong identifers for DNA or RNA
        if (checker.DNAPresent && checker.RNAPresent) {
            let restypestmp = strand.residues.map(x => x.resType);
            let Upresent = restypestmp.indexOf('U') > -1; // U is our check on whether its RNA or not
            if (Upresent) { //Assume RNA
                checker.DNAPresent = false;
            }
            else { // Assume DNA
                checker.RNAPresent = false;
            }
        }
        // Check for strands with inconsistent Residue Types
        checker.mutantStrand = checker.proteinPresent ? (checker.DNAPresent || checker.RNAPresent) : (checker.DNAPresent && checker.RNAPresent);
        if (checker.mutantStrand) {
            console.log("Strand " + strand.chainID + " contains more thank one macromolecule type, no thanks"); //lol
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
    //Helper values For Amino Acid Initialization
    let bv1 = new THREE.Vector3(1, 0, 0);
    let bv2 = new THREE.Vector3(0, 1, 0);
    let bv3 = new THREE.Vector3(0, 0, 1);
    let type = "";
    let pdbid = "";
    let a3 = new THREE.Vector3();
    // This Function calculates all necessary info for an Amino Acid in PDB format and writes it to initInfo
    let CalcInfoAA = (res) => {
        //Set Type
        type = proelem[res.resType]; //Set Type Based Off Three Letter Codes
        pdbid = res.pdbResIdent;
        let scHAcom = new THREE.Vector3; //side chain Heavy atoms Center of Mass
        res.atoms.forEach(a => {
            if (['N', 'C', 'O', 'H', 'CA'].indexOf(a.atomType) == -1) {
                scHAcom.x += a.x;
                scHAcom.y += a.y;
                scHAcom.z += a.z;
            }
        });
        // if null vector (glycine) a1 is 1, 0, 0
        if (scHAcom.lengthSq() == 0)
            scHAcom.x = 1;
        scHAcom.normalize();
        let CA = res.atoms.filter(a => a.atomType == 'CA')[0];
        if (CA) {
            let CApos = new THREE.Vector3(CA.x, CA.y, CA.z);
            let CABfactor = 0;
            if (!isNaN(parseFloat(CA.tempFactor))) {
                CABfactor = parseFloat(CA.tempFactor);
            }
            let a1 = scHAcom.clone().sub(CApos).normalize();
            if (a1.dot(bv1) < 0.99) {
                a3 = a1.clone().cross(bv1);
            }
            else if (a1.dot(bv2) < 0.99) {
                a3 = a1.clone().cross(bv2);
            }
            else if (a1.dot(bv3) < 0.99) {
                a3 = a1.clone().cross(bv3);
            }
            return [pdbid, type, CApos.toArray(), a1.toArray(), a3.toArray(), CABfactor];
        }
        else
            return ["NOCA", "NOCA", bv1.toArray(), bv1.toArray(), bv1.toArray(), 0];
    };
    // Helper values/ functions
    let ring_names = ["C2", "C4", "C5", "C6", "N1", "N3"];
    let pairs;
    //Helper Function
    // Stack Overflow<3 Permutator
    const permutator = (inputArr) => {
        let result = [];
        const permute = (arr, m = []) => {
            if (arr.length === 0) {
                result.push(m);
            }
            else {
                for (let i = 0; i < arr.length; i++) {
                    let curr = arr.slice();
                    let next = curr.splice(i, 1);
                    permute(curr.slice(), m.concat(next));
                }
            }
        };
        permute(inputArr);
        return result;
    };
    // This Function calculates all necessary info for a Nuclcleotide in PDB format and writes it to initInfo
    let CalcInfoNC = (res) => {
        // Info we want from PDB
        type = nucelem[res.resType];
        //Residue Number in PDB File
        pdbid = res.pdbResIdent;
        let nuccom = new THREE.Vector3;
        let baseCom = new THREE.Vector3;
        //Calculate Base atoms Center of Mass
        let base_atoms = res.atoms.filter(a => a.atomType.includes("'") || a.atomType.includes("*"));
        baseCom.x = base_atoms.map(a => a.x).reduce((a, b) => a + b);
        baseCom.y = base_atoms.map(a => a.y).reduce((a, b) => a + b);
        baseCom.z = base_atoms.map(a => a.z).reduce((a, b) => a + b);
        baseCom.divideScalar(base_atoms.length);
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
        let Bfactavg = Bfacts.map(a => a).reduce((a, b) => a + b);
        Bfactavg /= res.atoms.length;
        //sum bfactors of ind atoms
        let o4atom = res.atoms.filter(a => a.atomType == "O4'" || a.atomType == "O4*")[0];
        if (o4atom === undefined) {
            console.log("No o4' found for Nucleotide initialization");
            return;
        }
        let o4pos = new THREE.Vector3(o4atom.x, o4atom.y, o4atom.z);
        let parallel_to = o4pos.sub(baseCom);
        //Calculate Center of Mass
        nuccom.x = res.atoms.map(a => a.x).reduce((a, b) => a + b);
        nuccom.y = res.atoms.map(a => a.y).reduce((a, b) => a + b);
        nuccom.z = res.atoms.map(a => a.z).reduce((a, b) => a + b);
        let l = res.atoms.length;
        let pos = nuccom.divideScalar(l);
        // Compute a1 Vector
        let ring_poss = permutator(ring_names);
        let a3 = new THREE.Vector3;
        for (let i = 0; i < ring_poss.length; i++) {
            let types = ring_poss[i];
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
                let nv1 = v1.clone().normalize();
                let nv2 = v2.clone().normalize();
                if (Math.abs(nv1.dot(nv2)) > 0.01) {
                    let tmpa3 = nv1.cross(nv2);
                    tmpa3.normalize();
                    if (tmpa3.dot(parallel_to) < 0) {
                        tmpa3.negate();
                    }
                    a3.add(tmpa3);
                }
            }
        }
        a3.normalize();
        // Compute a1 Vector
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
    // let nextElementId = elementIndx;
    let nextElementId = 0;
    let oldElementId = nextElementId;
    // holds all initialization info for our system, which is passed back to the main thread
    let strandInit = [];
    // let initInfo: [string, string, number[], number[], number[], number][] = [];
    //Make System From the PDB Information
    let sys = new System(0, nextElementId);
    // center of mass
    let com = new THREE.Vector3();
    // Store B-factor Information Here
    let bFactors = [];
    let xdata = [];
    // Loop to Map Out the System
    for (let i = 0; i < (initlist.uniqueIDs.length); i++) {
        let nstrand = strands[i];
        if (nstrand.strandtype == 'pro') {
            let currentStrand = sys.addNewPeptideStrand();
            // currentStrand.system = sys;
            let strandInfo = [];
            strandtype.push("pro");
            for (let j = 0; j < nstrand.residues.length; j++) {
                let aa = currentStrand.createBasicElement(nextElementId);
                aa.sid = nextElementId - oldElementId;
                let info = CalcInfoAA(nstrand.residues[j]);
                if (info[1] != "NOCA") { // If C-Alpha Coordinates found
                    // initInfo.push(info);
                    strandInfo.push(info);
                    bFactors.push(info[5]);
                    xdata.push(aa.sid);
                    com.add(new THREE.Vector3().fromArray(info[2])); //Add position to COM calc
                    // pdbFileInfo Index, chain index, pdbResIdent
                    pdbindices.push([pindx, initlist.uniqueIDs[i], info[0]]);
                    aa.pdbindices = [pindx, initlist.uniqueIDs[i], info[0]];
                    // Amino Acids are intialized from N-terminus to C-terminus
                    // Same as PDB format
                    // Neighbors must be filled for correct initialization
                    aa.n3 = null;
                    aa.n5 = null;
                    if (j != 0) {
                        let prevaa = elems[elems.length - 1]; //Get previous Element
                        aa.n3 = prevaa;
                        prevaa.n5 = aa;
                    }
                    elems.push(aa);
                    nextElementId++;
                }
            }
            strandInit.push(strandInfo);
            if (currentStrand.end3 == undefined) {
                console.log("Strand " + nstrand.chainID + " could not be initialized");
            }
            else {
                currentStrand.updateEnds();
                // Take care of repeats Access by Chain Identifier
                initlist.repeatIDs.forEach((rid, indx) => {
                    let repeatInfo = [];
                    if (nstrand.chainID.includes(rid)) { // Repeat same chain
                        let repeatStrand = sys.addNewPeptideStrand();
                        strandtype.push("pro");
                        currentStrand.getMonomers().forEach((mon, mid) => {
                            // basically just copy the strand we just built using the sotred init info and repeat chain info
                            let repeatAmino = repeatStrand.createBasicElement(nextElementId);
                            repeatAmino.pdbindices = mon.pdbindices;
                            pdbindices.push(repeatAmino.pdbindices);
                            repeatAmino.sid = nextElementId - oldElementId;
                            let rinfo = strandInfo[mid].slice(); // copy originals initialization info
                            let rotquat = initlist.repeatQuatRots[indx];
                            rinfo[3] = new THREE.Vector3().fromArray(rinfo[3]).applyQuaternion(rotquat).toArray(); // Rotate a1
                            rinfo[4] = new THREE.Vector3().fromArray(rinfo[4]).applyQuaternion(rotquat).toArray();
                            rinfo[2] = initlist.repeatCoords[indx][mid];
                            bFactors.push(rinfo[5]); // Assume same B factors
                            xdata.push(repeatAmino.sid);
                            com.add(rinfo[2]);
                            rinfo[2] = rinfo[2].toArray(); // convert to array before adding initinfo
                            repeatInfo.push(rinfo);
                            // initInfo.push(rinfo);
                            repeatAmino.n3 = null;
                            repeatAmino.n5 = null;
                            if (mid != 0) { // not first element of strand
                                let prevaa = elems[elems.length - 1]; //Get previous Element
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
        }
        else if (nstrand.strandtype == 'rna' || nstrand.strandtype == 'dna') {
            let currentStrand = sys.addNewNucleicAcidStrand();
            let strandInfo = [];
            let tmptype = nstrand.strandtype;
            strandtype.push(tmptype);
            //PDB entries typically list from 5' to 3'
            //Neighbors must be filled for correct initialization
            let pdbres3to5 = nstrand.residues.reverse(); // Flipped Order so it reads 3'  to 5'
            for (let j = 0; j < nstrand.residues.length; j++) {
                //For getting center of mass
                try {
                    let info = CalcInfoNC(pdbres3to5[j]);
                    strandInfo.push(info);
                    com.add(new THREE.Vector3().fromArray(info[2])); //Add position to COM calc
                    let nc = currentStrand.createBasicElementTyped(nstrand.strandtype, nextElementId);
                    nc.pdbindices = [pindx, initlist.uniqueIDs[i], info[0]];
                    pdbindices.push(nc.pdbindices);
                    nc.n3 = null;
                    nc.n5 = null;
                    nc.sid = nextElementId - oldElementId;
                    bFactors.push(info[5]);
                    xdata.push(nc.sid);
                    if (j != 0) {
                        let prevnc = elems[elems.length - 1]; //Get previous Element
                        nc.n3 = prevnc;
                        prevnc.n5 = nc;
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
                // Take care of repeats Access by Chain Identifier
                initlist.repeatIDs.forEach((rid, indx) => {
                    let repeatInfo = [];
                    if (nstrand.chainID.includes(rid)) {
                        let repeatStrand = sys.addNewNucleicAcidStrand();
                        strandtype.push(tmptype);
                        currentStrand.getMonomers(true).forEach((mon, mid) => {
                            let repeatNuc = repeatStrand.createBasicElementTyped(nstrand.strandtype, nextElementId);
                            repeatNuc.sid = nextElementId - oldElementId;
                            try {
                                let rinfo = strandInfo[mid].slice(); // copy originals initialization info
                                let rotquat = initlist.repeatQuatRots[indx];
                                rinfo[3] = new THREE.Vector3().fromArray(rinfo[3]).applyQuaternion(rotquat).toArray(); // Rotate a1
                                rinfo[4] = new THREE.Vector3().fromArray(rinfo[4]).applyQuaternion(rotquat).toArray(); // Rotate a3
                                rinfo[2] = initlist.repeatCoords[indx][mid]; // New Position
                                pdbindices.push(repeatNuc.pdbindices);
                                bFactors.push(rinfo[5]); // Assume same B factors
                                xdata.push(repeatNuc.sid);
                                com.add(rinfo[2]);
                                rinfo[2] = rinfo[2].toArray();
                                repeatInfo.push(rinfo);
                                // initInfo.push(rinfo);
                                repeatNuc.n3 = null;
                                repeatNuc.n5 = null;
                                // monomers go 5' to 3'
                                if (mid != 0) {
                                    let prevaa = elems[elems.length - 1]; //Get previous Element
                                    repeatNuc.n3 = prevaa;
                                    prevaa.n5 = repeatNuc;
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
    // center of mass
    com.divideScalar(sys.systemLength());
    //Set box dimensions
    let xpos = strandInit.flat().map((info) => { return info[2][0]; });
    let ypos = strandInit.flat().map((info) => { return info[2][1]; });
    let zpos = strandInit.flat().map((info) => { return info[2][2]; });
    //built in Math.min and Math.max crash the program once xpos, ypos, and zpos reach a high length (N=300000 was my test case)
    let xmax = xpos.reduce((a, b) => { return Math.max(a, b); });
    let xmin = xpos.reduce((a, b) => { return Math.min(a, b); });
    let ymax = ypos.reduce((a, b) => { return Math.max(a, b); });
    let ymin = ypos.reduce((a, b) => { return Math.min(a, b); });
    let zmax = zpos.reduce((a, b) => { return Math.max(a, b); });
    let zmin = zpos.reduce((a, b) => { return Math.min(a, b); });
    let xdim = xmax - xmin;
    let ydim = ymax - ymin;
    let zdim = zmax - zmin;
    if (xdim < 2)
        xdim = 2.5;
    if (ydim < 2)
        ydim = 2.5;
    if (zdim < 2)
        zdim = 2.5;
    xpos = undefined;
    ypos = undefined;
    zpos = undefined;
    sys = undefined;
    ring_names = undefined;
    strands = undefined;
    // label = undefined;
    initlist = undefined;
    return [strandInit, strandtype, com, [label, bFactors, xdata, "bfactor", "A_sqr"], [xdim, ydim, zdim],
        pdbindices, [pdbinfo.pdbfilename, pdbinfo.pdbsysinfo, pdbinfo.initlist, pdbinfo.disulphideBonds]];
}
