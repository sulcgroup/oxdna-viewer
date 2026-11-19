importScripts("../../ts/lib/three.js")
importScripts("../model/basicElement.js")
importScripts("../model/nucleotide.js")
importScripts("../model/aminoAcid.js")
importScripts("../model/DNA.js")
importScripts("../model/RNA.js")
importScripts("../model/strand.js")
importScripts("../model/system.js")
importScripts('./pdb_lib.js');

this.onmessage = function(e) {
    let pdblines = e.data[0];
    let pdbFileInfoIndx = e.data[1];
    let elemIndx = e.data[2];
    let syscount = e.data[3];
    let [initList, dsbonds] = prep_pdb(pdblines);
    let pdata = pdb_step1(pdblines);
    let ret = addPDBToScene(pdata, pdbFileInfoIndx, elemIndx);
    pdblines = undefined;
    pdata = undefined;
    postMessage(ret, undefined);
}
// backboneColors, nucleosideColors, and addPDBToScene are now defined in pdb_lib.ts

function prep_pdb(pdblines: string[]) : [pdbReadingList, [any, number, any, number][]] {

    //Checks for repeated chains, Biological Assemblies etc.
    let chainDivs: number[] = [];
    let modelDivs: number[] = [];
    let firstatom = 0;
    let noatom = false;
    // Other Info for MWCENM
    let dsbonds = [];

    let start = 0;  // sometimes the end of a chain is saved into a different file, ignoring any garbage like that
    if(pdblines[0].substr(0, 3) == "TER"){
        start = 1;
    }

    // Find Chain Termination statements TER and uses
    // added contains_atoms as it is a necessary switch
    let atoms_present= false;
    for(let i = start; i< pdblines.length; i++){
        if(pdblines[i].substr(0, 4) == 'ATOM' && noatom==false){
            firstatom = i; //line number of first atomic coordinate
            noatom = true;
        }
        if(pdblines[i].substr(0, 4) == 'ATOM'){
            atoms_present = true;
        }

        if (pdblines[i].substr(0, 3) === 'TER' && atoms_present){
            chainDivs.push(i);
            atoms_present = false;
        } else if(pdblines[i].substr(0, 6) === 'ENDMDL'){
            modelDivs.push(i);
        } else if(pdblines[i].substr(0, 6) === 'SSBOND'){
            let line = pdblines[i];
            // disulphide bond info: residue 1 chain id, res 1 res num, res2 chain id, res 2 res num
            let dbond = [line.substring(15, 17).trim(), parseInt(line.substring(17, 21).trim()), line.substring(29, 31).trim(), parseInt(line.substring(31, 35).trim())];
            dsbonds.push(dbond);
        } else if(pdblines[i].substr(0, 3) === 'END' && atoms_present){ // sometimes people don't end their chain with a TER statement
            // if (pdblines[i-1].substr(0, 4) == 'ATOM'){ // only if previous line has atom
            chainDivs.push(i);
            atoms_present = false;
            // }
        }
    }

    // If models are present in pdb file, Assumes that repeat chain ids are
    // repeat instances of the 1st chain w/ the same chain identifer
    let bioassemblyassumption = false;
    if (modelDivs.length > 0) bioassemblyassumption = true;


    let nchainids : string[] = []; // Store new chainids
    let finalids : string[] = []; // Final Ids to be Loaded, can be from chains or models
    let finaldivs : number[] = [];

    if(chainDivs.length != 0){ // Assumes normal PDB file with all chains declared
        // check for chaindivs that are too close to one another (<= 2 lines)
        chainDivs = chainDivs.filter(function(a, aid, arr){
            if(aid != 0){
                return a - arr[aid - 1] > 3; // false if less than two lines from previous (ex. [1030, 1032, 100001] -> [1030, 100001])
            } else return true;
        });

        // Look at line above chain termination for chain ID
        let chainids: string[] = [];
        chainDivs.forEach((d, idx, arr) => {
            let chainid = pdblines[d-1].substring(21, 22).trim()
            if (chainid == "" && idx != 0){
                chainid = pdblines[(d-Math.floor((d-arr[idx-1])/2))].substring(21, 22).trim() // halfway through the chain
                chainids.push(chainid)
            } else {
                chainids.push(chainid)
            }
        });


        //Re-Assign Chain Ids based off repeating or not
        let sorted_repeated_chainids: string[] = [];
        chainids.forEach((chain, ind) => {
            if(chainids.indexOf(chain) != ind && bioassemblyassumption) { //Check for repeated and presence of models
                sorted_repeated_chainids.push(chain);
            } else {
                sorted_repeated_chainids.push(chain+"*"); // not a repeat? denoted as A*
            }
        })


        let fullalpha = []
        let lastindex = 1; //
        let alphabet = 'a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z.1.2.3.4.5.6.7.8.9.<.>.?./.!.@.#.$.%.^.&.*.(.)._.-.=.+'.split('.');
        fullalpha = fullalpha.concat(alphabet);
        // supports 2862 chains with the same chain id in the same pdb file
        alphabet.forEach((id, idx, arr) => fullalpha = fullalpha.concat(arr.map(x => {return id+x;})));
        sorted_repeated_chainids.forEach((val, ind) => {
            if(nchainids.indexOf(val) != ind){ //same chain identifier needs to be fixed
                if(val != "" && val.includes("*")){ //unique chain
                    let nval = val;
                    let attmpt_indx = lastindex;
                    while(nchainids.indexOf(nval) != -1 && attmpt_indx < 2862){
                        nval = fullalpha[attmpt_indx] + val;
                        attmpt_indx += 1;
                    }
                    lastindex = attmpt_indx;
                    nchainids.push(nval);
                } else {
                    nchainids.push(val);
                }
            } else {
                nchainids.push(val);
            }
        });

        //important must be set
        finalids = nchainids;
        finaldivs = chainDivs;

    } else if(modelDivs.length != 0){
        // Assumes a malformed PDB with models but no chains, (looking at you Modeller)
        bioassemblyassumption = false;
        let chainids: string[] = [];
        modelDivs.forEach((d, dindx) => { // just need an identifer, needs to be unique though
            chainids.push((dindx+1).toString()+"*") // Assumes all chains are unique since they weren't labeled
        });

        finalids = chainids;
        finaldivs = modelDivs;
    }


    // Stores ID, start line, end line if chain is unique
    // Stores Id, start line, end line, coordinates a if chain is repeated and Quat Rotation for a1
    // tl;dr  unique chains require more calculations while repeated chains can resuse those calculated parameters and shifts them accordingly
    // necessary for loading large things like Virus particles


    let initList =  new pdbReadingList;
    let prevend = firstatom;
    for(let i=0; i<finalids.length; i++){
        if(finalids[i].includes("*")){
            let id = finalids[i].replace('*', ''); // remove asterisk from chain id
            initList.uniqueIDs.push(id)
            initList.uniqueStart.push(prevend)
            initList.uniqueEnd.push(finaldivs[i])
            prevend = finaldivs[i]
        } else {
            initList.repeatIDs.push(finalids[i])
            initList.repeatStart.push(prevend)
            initList.repeatEnd.push(finaldivs[i])
            initList.repeatCoords.push([new THREE.Vector3(0, 0, 0)])
            initList.repeatQuatRots.push(new THREE.Quaternion())
            prevend = finaldivs[i]
        }
    }

    return [initList, dsbonds];
}

function pdb_step1(pdbLines: string[]): pdbinfowrapper{
    let [initList, dsbonds] = prep_pdb(pdbLines);
    let chainSingleton = (initList.uniqueIDs.length + initList.repeatIDs.length) == 1;  // Boolean for if only single chain found in the entire pdb file
    // used in loadpdbsection to trigger new chain creation upon nonsequential residue ids
    let uniqatoms : pdbatom[] = [];
    let uniqresidues : pdbresidue[] = []; // individual residue data parsed from Atomic Info
    let uniqchains : pdbchain[] = []; // individual chain data parsed from Atomic Info

    // bookkeeping
    let label = "pdb";

    // Search Just the Header for PDB code ex. (1BU4), label used for graph datasets
    for(let i = 0; i < 10; i++) {
        if (pdbLines[i].substr(0, 6) === 'HEADER') {
            let head = pdbLines[i].match(/\S+/g); //header info, search
            head.forEach(i => {
                let si = i.split('');
                if (si.length == 4 && (!isNaN(parseFloat(si[0])) && isFinite(parseFloat(si[0])))) { //PDB IDs are 4 characters 1st character is always an integer checks for that
                    label = i;
                }
            })
        }
    }

    // Called for each unique chain found in the system
    let pdbpositions = [];
    let prevChainId = "";
    let Amino: boolean = false;
    let atoms : pdbatom[] = [];
    let residues : pdbresidue[] = []; // individual residue data parsed from Atomic Info
    let chains : pdbchain[] = [];
    let na = new pdbatom();
    let nr = new pdbresidue();
    let nc = new pdbchain();

    let chainindx = 0;
    let loadpdbsection = function(start, end): [boolean, THREE.Vector3[], pdbatom[], pdbresidue[], pdbchain[]] {
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

        for(let j = start; j < end; j++){
            if (pdbLines[j].substr(0, 4) === 'ATOM') {
                let pdbLine = pdbLines[j];
                // http://www.wwpdb.org/documentation/file-format-content/format33/sect9.html#ATOM
                na.indx = pdbLine.substring(6, 11).trim();
                na.atomType = pdbLine.substring(12, 16).trim();
                na.altLoc = pdbLine.substring(16, 17).trim();
                na.resType = pdbLine.substring(17, 20).trim();

                let chaincheck = pdbLine.substring(21, 22).trim() != ""; // chain is legit if filled at 21st character
                if(!chaincheck){ // fill missing chain data
                    if(prevChainId == chainindx.toString()){ //check if chainindx is the same. This gets iterated based off criteria below
                        na.chainID = chainindx.toString();
                        tmpchainID = na.chainID;
                    }
                    else{
                        na.chainID = (chainindx+1).toString();
                        tmpchainID = na.chainID;
                    }

                    let tmp = pdbLine.substring(21, 27); // Location of residue identifer IF file is missing chain data
                    //check for insertion code
                    na.iCode = "";
                    if(isNaN(parseInt(tmp[5]))){
                        na.iCode = tmp[5];
                        na.pdbResIdent = tmp.slice(0, 5).trim()
                    } else {
                        na.pdbResIdent = tmp.trim();
                    }

                } else {
                    let negative = false; // flag that triggers upon finding negative residues
                    let resIdentAddOn = '';
                    tmpchainID = pdbLine.substring(21, 23).trim(); //changed to (21, 22) to (21, 23) to deal with 2 letter identifiers present in some PDB Files
                    if(tmpchainID.includes("-", -1)){
                        // negative numbered residues, yes they're real, negative sign is taken into the chainID
                        negative = true;
                        tmpchainID = tmpchainID.substring(0, 1);
                    }


                    if(prevChainId.includes('9', -1)){ // number strand identifiers
                        if(isNaN(parseInt(tmpchainID.substr(0, 1))) && isNaN(parseInt(tmpchainID.substr(1, 1)))) {
                            na.chainID = tmpchainID
                        } else {
                            resIdentAddOn = tmpchainID.substr(1, 1);
                            na.chainID = tmpchainID.substr(0, 1);
                        }
                    } else {
                        if(!isNaN(parseInt(tmpchainID.substr(1, 1)))){
                            resIdentAddOn = tmpchainID.substr(1, 1);
                            na.chainID = tmpchainID.substr(0, 1);
                        } else {
                            na.chainID = tmpchainID
                        }
                    }

                    let tmp = pdbLine.substring(23, 29); // Usually the residue number
                    //check for insertion code
                    na.iCode = "";
                    if(isNaN(parseInt(tmp[5]))){ // not a number, most likely an insertion code
                        na.iCode = tmp[5];
                        if(!negative){
                            na.pdbResIdent = resIdentAddOn+tmp.slice(0, 5).trim()
                        } else {
                            na.pdbResIdent = '-'+resIdentAddOn+tmp.slice(0, 5).trim()
                        }

                    } else {
                        // is a number, most likely no insertion code and misplaced pbd residue number
                        if(!negative){
                            na.pdbResIdent = resIdentAddOn+tmp.trim();
                        } else {
                            na.pdbResIdent = '-'+resIdentAddOn+tmp.trim();
                        }
                    }
                }

                // Convert From Angstroms to Simulation Units while we're at it
                na.x = parseFloat(pdbLine.substring(30, 38))/ 8.518;
                na.y = parseFloat(pdbLine.substring(38, 46))/ 8.518;
                na.z = parseFloat(pdbLine.substring(46, 54))/ 8.518;
                na.occupancy = pdbLine.substring(54, 60).trim();
                na.tempFactor = pdbLine.substring(60, 66).trim();
                na.element = pdbLine.substring(76, 78).trim();
                na.charge = pdbLine.substring(78, 80).trim();

                if(Amino){
                    if(na.atomType == "CA") pdbpositions.push(new THREE.Vector3(na.x, na.y, na.z));
                } else {
                    if(na.atomType == "N1") pdbpositions.push(new THREE.Vector3(na.x, na.y, na.z));
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
                } else { // not a new chain, same chain index
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
                    residues.push(nrc)
                    //set previous chain id to that of last read atom
                    prevResId = nrc.pdbResIdent;
                }

                // copy is necessary
                let nac: pdbatom = {
                    ...na
                };
                atoms.push(nac);
            }
        }
        // info
        return [Amino, pdbpositions, atoms, residues, chains];
    }

    // positions of the atoms used to align a repeated chain to its unique chain (CA for proteins, N1 for nucleic acids)
    const getpdbpositions = function(start: number, end: number, Amino: boolean): THREE.Vector3[] {
        const pdbpositions: THREE.Vector3[] = [];
        for (let j = start; j < end; j++) {
            if (pdbLines[j].substr(0, 4) !== 'ATOM') continue;
            const atomType = pdbLines[j].substring(12, 16).trim();
            if ((Amino && atomType == "CA") || (!Amino && atomType == "N1")) {
                // Convert From Angstroms to Simulation Units
                pdbpositions.push(new THREE.Vector3(
                    parseFloat(pdbLines[j].substring(30, 38)) / 8.518,
                    parseFloat(pdbLines[j].substring(38, 46)) / 8.518,
                    parseFloat(pdbLines[j].substring(46, 54)) / 8.518));
            }
        }
        return pdbpositions;
    }

    // load all Unique Chains
    initList.uniqueIDs.forEach((id, indx) => {
        let alignTO = loadpdbsection(initList.uniqueStart[indx], initList.uniqueEnd[indx]);
        uniqatoms = uniqatoms.concat(alignTO[2]);
        uniqresidues = uniqresidues.concat(alignTO[3]);
        uniqchains = uniqchains.concat(alignTO[4]);

        // deal with repeats of each individual unique chain
        initList.repeatIDs.forEach((rid, rindx) => {
            if(id.includes(rid)){ //Makes sure Chain IDs contain original chain identifier
                const alignME = getpdbpositions(initList.repeatStart[rindx], initList.repeatEnd[rindx], alignTO[0]);

                if(alignME.length != alignTO[1].length) console.log("PDB Error: Master chain and repeat chain have unequal lengths: "+alignME.length.toString()+" "+alignTO[1].length.toString());
                const newcoords = alignME.map(x => {return x.clone()}); //copy our arrays
                // The repeat is a rigid copy of the unique chain: orient its a1/a3 by the rotation that superimposes
                // the unique chain's alignment atoms (CA or N1) onto the repeat's
                const rotQuat = alignME.length == alignTO[1].length && alignME.length >= 3 ?
                    superpositionRotation(alignTO[1], alignME) : new THREE.Quaternion();
                initList.repeatCoords[rindx] = newcoords;
                initList.repeatQuatRots[rindx] = rotQuat;
            }
        })
    })

    // Assigns Atoms to their corresponding Residues
    uniqresidues.forEach((res: pdbresidue) => {
        res.atoms = uniqatoms.filter(atom => atom.chainIndx == res.chainIndx && atom.pdbResIdent ==  res.pdbResIdent)
    });

    // Assigns Residues to their corresponding Chain
    uniqchains.forEach((chain: pdbchain) => {
        chain.residues = uniqresidues.filter(res => res.chainIndx == chain.chainIndx)
    });

    if (uniqchains.length == 0){
        console.log("No Chains Found in PDB File");
        return;
    }
    if (uniqatoms.length == 0){
        console.log("No Atoms Found in PDB File");
        return;
    }

    // Rewrite initlist.uniqueIDs to take into account subchains (labeled but no TER statements) found in the PDB file
    // Won't work for repeated copies of subchains (something to look out for in the future)
    initList.uniqueIDs = uniqchains.map(x => {return x.chainID});

    // These hefty objects are needed to calculate the positions & a1/ a3 of nucleotides and amino acids
    let pdbinfo = new pdbinfowrapper(label, uniqchains, initList);
    pdbinfo.disulphideBonds = dsbonds; // Store Disulphide Bonds

    uniqatoms = undefined;
    uniqchains = undefined;
    uniqresidues = undefined;
    initList = undefined;

    return pdbinfo
}
// addPDBToScene has been moved to pdb_lib.ts and is available via importScripts('./pdb_lib.js')
