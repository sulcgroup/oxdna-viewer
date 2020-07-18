function makeOutputFiles() {
    let name = view.getInputValue("outputFilename");
    let top = view.getInputBool("topDownload");
    let reorganized, counts;
    if (top) {
        let { a, b, file_name, file } = makeTopFile(name);
        reorganized = a;
        counts = b;
        makeTextFile(file_name, file);
    }
    else if (systems.length > 1 || topologyEdited) {
        notify("You have edited the topology of the scene, a new topology file must be generated", "warning");
        return;
    }
    let dat = view.getInputBool("datDownload");
    if (dat) {
        let { file_name, file } = makeDatFile(name, reorganized);
        makeTextFile(file_name, file);
    }
    if (ANMs.length > 0) {
        let { file_name, file } = makeParFile(name, reorganized, counts);
        makeTextFile(file_name, file);
    }
}
function makeArrayBuffer(buffer, filename) {
    var link = document.createElement('a');
    link.style.display = 'none';
    document.body.appendChild(link); // Firefox workaround, see #6594 threejs
    let blob = new Blob([buffer], { type: 'application/octet-stream' });
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}
function make3dOutput() {
    const name = view.getInputValue("3dExportFilename");
    const fileFormat = view.getInputValue("3dExportFormat");
    const include_backbone = view.getInputBool("includeBackbone");
    const include_nucleoside = view.getInputBool("includeNucleoside");
    const include_connector = view.getInputBool("includeConnector");
    const include_bbconnector = view.getInputBool("includeBBconnector");
    const flattenHierarchy = view.getInputBool("3dExportFlat");
    const faces_mul = view.getInputNumber("3dExportFacesMul");
    const stl_scale = view.getInputNumber("3dExportScale");
    if (fileFormat === 'stl') {
        saveSTL(name, include_backbone, include_nucleoside, include_connector, include_bbconnector, stl_scale, faces_mul);
    }
    else if (fileFormat === 'gltf' || fileFormat === 'glb') {
        let binary = fileFormat === 'glb';
        let objects = exportGLTF(systems, include_backbone, include_nucleoside, include_connector, include_bbconnector, stl_scale, faces_mul, flattenHierarchy);
        var exporter = new GLTFExporter();
        var options = { 'forceIndices': true, 'binary': binary };
        // Parse the input and generate the glTF output
        exporter.parse(objects, function (result) {
            if (result instanceof ArrayBuffer) {
                makeArrayBuffer(result, name + '.glb');
            }
            else {
                var output = JSON.stringify(result);
                makeTextFile(name + '.gltf', output);
            }
        }, options);
    }
    else {
        notify(`Unknown file format: ${fileFormat}`, "alert");
    }
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
    let firstLine;
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
                strand.getOrderedMonomers().forEach(e => {
                    newElementIds.set(e, gidCounter++); //Assign new elementID
                });
            });
        });
        totParticles = totNuc;
        totStrands = totNucleic;
        firstLine = [totParticles, totStrands];
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
        firstLine = [totParticles, totStrands, totNuc, totAA, totNucleic];
    }
    top.push(firstLine.join(" "));
    if (totParticles != elements.size) {
        notify(`Length of totNuc (${totParticles}) is not equal to length of elements array (${elements.size})`);
    }
    newElementIds.forEach((_gid, e) => {
        let neighbor3 = e.neighbor3 ? newElementIds.get(e.neighbor3) : -1;
        let neighbor5 = e.neighbor5 ? newElementIds.get(e.neighbor5) : -1;
        let cons = [];
        if (proteinMode) {
            for (let i = 0; i < e.connections.length; i++) {
                let c = e.connections[i];
                if (newElementIds.get(c.p2) > newElementIds.get(e) && newElementIds.get(c.p2) != neighbor5) {
                    cons.push(newElementIds.get(c.p2));
                }
            }
        }
        top.push([newStrandIds.get(e.strand), e.type, neighbor3, neighbor5, ...cons].join(' '));
    });
    //makeTextFile(name+".top", top.join("\n")); //make .top 
    //this is absolute abuse of ES6 and I feel a little bad about it
    return { a: newElementIds, b: firstLine, file_name: name + ".top", file: top.join("\n") };
}
function makeDatFile(name, altNumbering = undefined) {
    // Get largest absolute coordinate:
    let maxCoord = 0;
    elements.forEach(e => {
        let p = e.getPos();
        maxCoord = Math.max(maxCoord, Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)));
    });
    let dat = "";
    let box = Math.ceil(6 * maxCoord);
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
    return { file_name: name + ".dat", file: dat }; //make .dat file
}
function makeParFile(name, altNumbering, counts) {
    const par = [];
    par.push(counts[3]);
    ANMs.forEach((anm) => {
        //ANMs can be huge so we need to use a traditional for loop here
        const l = anm.children.length;
        for (let i = 0; i < l; i++) {
            const curCon = anm.children[i];
            const p1ID = altNumbering.get(curCon.p1);
            const p2ID = altNumbering.get(curCon.p2);
            const line = [p1ID, p2ID, curCon.eqDist, curCon.type, curCon.strength];
            par.push(line.join(" "));
        }
    });
    return { file_name: name + ".par", file: par.join('\n') };
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
    let listBases = Array.from(selectedBases).map(e => e.gid);
    for (let x = 0; x < listBases.length; x = x + 2) { //for every selected nucleotide in listBases string
        if (listBases[x + 1] !== undefined) { //if there is another nucleotide in the pair
            mutTrapText = mutTrapText + writeMutTrapText(listBases[x], listBases[x + 1]) + writeMutTrapText(listBases[x + 1], listBases[x]); //create mutual trap data for the 2 nucleotides in a pair - selected simultaneously
        }
        else { //if there is no 2nd nucleotide in the pair
            notify("The last selected base does not have a pair and thus cannot be included in the Mutual Trap File."); //give error message
        }
    }
    makeTextFile("mutual_trap.txt", mutTrapText); //after addding all mutual trap data, make mutual trap file
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
        makeTextFile("basepair_trap.txt", mutTrapText); //after addding all mutual trap data, make mutual trap file
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
        view.longCalculation(findBasepairs, view.basepairMessage, write);
    }
    else {
        write();
    }
}
function makeSelectedBasesFile() {
    makeTextFile("baseListFile", Array.from(selectedBases).map(e => e.gid).join(" "));
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
    makeTextFile("output.oxview", JSON.stringify({
        date: new Date(),
        box: box.toArray(),
        systems: systems
    }, null, space));
}
//let textFile: string;
function makeTextFile(filename, text) {
    let blob = new Blob([text], { type: 'text' });
    var elem = window.document.createElement('a'); //
    elem.href = window.URL.createObjectURL(blob); //
    elem.download = filename; //
    document.body.appendChild(elem); //
    elem.click(); //
    document.body.removeChild(elem); //
    //window.parent.FakeDataDownload(blob, filename);
}
;
