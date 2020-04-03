function makeOutputFiles() {
    let name = document.getElementById("outputFilename").value;
    let top = document.getElementsByName("topDownload");
    let reorganized;
    if (top[0].checked == true) {
        reorganized = makeTopFile(name);
    }
    else if (systems.length > 1 || topologyEdited) {
        notify("You have edited the topology of the scene, a new topology file must be generated");
        return;
    }
    let dat = document.getElementsByName("datDownload");
    if (dat[0].checked == true) {
        makeDatFile(name, reorganized);
    }
}
function makeSTLOutput() {
    const name = document.getElementById("outputSTLFilename").value;
    const include_backbone = document.getElementsByName("includeBackbone")[0].checked;
    const include_nucleoside = document.getElementsByName("includeNucleoside")[0].checked;
    const include_connector = document.getElementsByName("includeConnector")[0].checked;
    const include_bbconnector = document.getElementsByName("includeBBconnector")[0].checked;
    const faces_mul = parseFloat(document.getElementById("facesMul").value);
    const stl_scale = parseFloat(document.getElementById("stlScale").value);
    saveSTL(name, include_backbone, include_nucleoside, include_connector, include_bbconnector, stl_scale, faces_mul);
}
function makeTopFile(name) {
    const top = []; //string of contents of .top file
    let proteinMode = false;
    let peptides = [];
    let nas = [];
    //figure out if there are any proteins in the system
    systems.forEach(system => {
        system.strands.forEach(strand => {
            if (strand.getType() == Peptide.name) {
                proteinMode = true;
                peptides.push(strand);
            }
            else {
                nas.push(strand);
            }
        });
    });
    const newStrandIds = new Map();
    const newElementIds = new Map();
    let totParticles = 0;
    let totStrands = 0;
    //remove any gaps in the particle numbering
    if (!proteinMode) {
        peptides = undefined;
        nas = undefined;
        let totNuc = 0; //total # of elements
        let totNucleic = 0; //total # of strands
        let sidCounter = 1;
        let gidCounter = 0;
        systems.forEach(system => {
            totNucleic += system.strands.length; // Count strands
            system.strands.forEach((strand) => {
                newStrandIds.set(strand, sidCounter++); //Assign new strandID
                totNuc += strand.monomers.length; // Count elements
                strand.monomers.forEach(e => {
                    newElementIds.set(e, gidCounter++); //Assign new elementID
                });
            });
        });
        totParticles = totNuc;
        totStrands = totNucleic;
        top.push(totParticles + " " + totStrands);
    }
    else { //have to rebuild the system to keep all proteins contiguous or else oxDNA will segfault
        let totNuc = 0;
        let totAA = 0;
        let totNucleic = 0;
        let totPeptide = 0;
        let sidCounter = -1;
        let gidCounter = 0;
        peptides.forEach(strand => {
            newStrandIds.set(strand, sidCounter--);
            totPeptide += 1;
            totParticles += strand.monomers.length;
            totAA += strand.monomers.length;
            strand.monomers.forEach(e => {
                newElementIds.set(e, gidCounter++);
            });
        });
        sidCounter = 1;
        nas.forEach(strand => {
            newStrandIds.set(strand, sidCounter++);
            totNucleic += 1;
            totParticles += strand.monomers.length;
            totNuc += strand.monomers.length;
            strand.monomers.forEach(e => {
                newElementIds.set(e, gidCounter++);
            });
        });
        totParticles = totNuc + totAA;
        totStrands = totPeptide + totNucleic;
        top.push(totParticles + " " + totStrands + " " + totNuc + " " + totAA + " " + totNucleic + " " + totPeptide);
    }
    if (totParticles != elements.size) {
        notify(`Length of totNuc (${totParticles}) is not equal to length of elements array (${elements.size})`);
    }
    newElementIds.forEach((_gid, e) => {
        let neighbor3 = e.neighbor3 ? newElementIds.get(e.neighbor3) : -1;
        let neighbor5 = e.neighbor5 ? newElementIds.get(e.neighbor5) : -1;
        top.push([newStrandIds.get(e.strand), e.type, neighbor3, neighbor5, ...e.connections].join(' '));
    });
    makeTextFile(name + ".top", top.join("\n")); //make .top 
    return newElementIds;
}
function makeDatFile(name, altNumbering = undefined) {
    // Get largest absolute coordinate:
    let maxCoord = 0;
    elements.forEach(e => {
        let p = e.getInstanceParameter3("cmOffsets");
        maxCoord = Math.max(maxCoord, Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)));
    });
    let dat = "";
    let box = Math.ceil(3 * maxCoord);
    dat = [
        `t = 0`,
        `b = ${box} ${box} ${box}`,
        `E = 0 0 0\n`
    ].join('\n');
    // get coordinates for all elements, in the correct order
    if (altNumbering) {
        altNumbering.forEach((_gid, e) => {
            dat += e.getDatFileOutput();
        });
    }
    else {
        systems.forEach(system => {
            system.strands.forEach((strand) => {
                strand.monomers.forEach(e => {
                    dat += e.getDatFileOutput();
                });
            });
        });
    }
    makeTextFile(name + ".dat", dat); //make .dat file
}
function writeMutTrapText(base1, base2) {
    return "{\n" + "type = mutual_trap\n" +
        "particle = " + base1 + "\n" +
        "ref_particle = " + base2 + "\n" +
        "stiff = 0.09\n" +
        "r0 = 1.2 \n" +
        "PBC = 1" + "\n}\n\n";
}
function makeMutualTrapFile() {
    let mutTrapText = "";
    for (let x = 0; x < listBases.length; x = x + 2) { //for every selected nucleotide in listBases string
        if (listBases[x + 1] !== undefined) { //if there is another nucleotide in the pair
            mutTrapText = mutTrapText + writeMutTrapText(listBases[x], listBases[x + 1]) + writeMutTrapText(listBases[x + 1], listBases[x]); //create mutual trap data for the 2 nucleotides in a pair - selected simultaneously
        }
        else { //if there is no 2nd nucleotide in the pair
            notify("The last selected base does not have a pair and thus cannot be included in the Mutual Trap File."); //give error message
        }
    }
    makeTextFile("mutTrapFile", mutTrapText); //after addding all mutual trap data, make mutual trap file
}
function makePairTrapFile() {
    let write = () => {
        let mutTrapText = "";
        elements.forEach(e => {
            // If element is paired, add a trap
            if (e.isPaired()) {
                mutTrapText += writeMutTrapText(e.gid, e.pair.gid);
            }
        });
        makeTextFile("pairTrapFile", mutTrapText); //after addding all mutual trap data, make mutual trap file
    };
    // Find out if we have calculated pairs already
    let pairsCalculated = false;
    for (let element of elements) {
        if (element[1].isPaired()) {
            pairsCalculated = true;
            break;
        }
    }
    if (!pairsCalculated) {
        longCalculation(findBasepairs, basepairMessage, write);
    }
    else {
        write();
    }
}
function makeSelectedBasesFile() {
    makeTextFile("baseListFile", listBases.join(" "));
}
function makeSequenceFile() {
    let seqTxts = [];
    systems.forEach((sys) => {
        sys.strands.forEach((strand) => {
            let label = strand.label ? strand.label : `strand_${strand.strandID}`;
            seqTxts.push(`${label}, ${api.getSequence(strand.monomers)}`);
        });
    });
    makeTextFile("sequences.csv", seqTxts.join("\n"));
}
function makeOxViewJsonFile(space) {
    makeTextFile("dump.oxView", JSON.stringify({
        date: new Date(),
        systems: systems
    }, null, space));
}
let textFile;
function makeTextFile(filename, text) {
    let blob = new Blob([text], { type: 'text' });
    var elem = window.document.createElement('a');
    elem.href = window.URL.createObjectURL(blob);
    elem.download = filename;
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
}
;
