function makeOutputFiles() {
    let name = view.getInputValue("outputFilename");
    // Determine which order to write the files in
    // Old has backwards NA strands (3'-5') while new has 5'-3'
    let useNew = view.getInputBool("topFormat");
    // remove any gaps in the particle numbering
    const [newElementIDs, newStrandIds, counts, gsSubtypes] = getNewIds(useNew);
    // Create topology file
    let top = view.getInputBool("topDownload");
    if (top) {
        let { file_name, file } = makeTopFile(name, newElementIDs, newStrandIds, gsSubtypes, counts, useNew);
        // add timeout because if you try to download multiple files at the same time, the browser often misses the later ones.
        setTimeout(() => makeTextFile(file_name, file), 10);
    }
    else if (systems.length > 1 || topologyEdited) {
        notify("You have edited the topology of the scene, a new topology file must be generated", "warning");
        return;
    }
    // Create configuration file
    let dat = view.getInputBool("datDownload");
    if (dat) {
        let { file_name, file } = makeDatFile(name, newElementIDs);
        setTimeout(() => makeTextFile(file_name, file), 20);
    }
    if (gsSubtypes.masses.length > 0) { // check for generic sphere presence
        let file_name = name + "_m.txt";
        let file = makeMassFile(newElementIDs, gsSubtypes);
        setTimeout(() => makeTextFile(file_name, file), 20);
    }
    if (networks.length > 0) {
        let { file_name, file } = makeParFile(name, newElementIDs, counts);
        setTimeout(() => makeTextFile(file_name, file), 30);
    }
    let force_download = view.getInputBool("forceDownload");
    if (force_download) {
        if (forces.length > 0) {
            let file_name = name.concat('_force.txt');
            let contents = forcesToString(newElementIDs);
            setTimeout(() => makeTextFile(file_name, contents), 40);
        }
        else {
            notify('No forces to export. Use the forces editor in the "Dynamics" tab to add new forces.', "warning");
        }
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
    const include_backbone = view.getInputBool("backbone_toggle");
    const include_nucleoside = view.getInputBool("nucleoside_toggle");
    const include_connector = view.getInputBool("connector_toggle");
    const include_bbconnector = view.getInputBool("bbconnector_toggle");
    const faces_mul = view.getInputNumber("3dExportFacesMul");
    if (fileFormat === 'stl') {
        saveSTL(name, include_backbone, include_nucleoside, include_connector, include_bbconnector, view.backboneScale, view.nucleosideScale, view.connectorScale, view.bbconnectorScale, faces_mul);
    }
    else if (fileFormat === 'gltf' || fileFormat === 'glb') {
        let binary = fileFormat === 'glb';
        const flattenHierarchy = view.getInputBool("3dExport_flat");
        const bbMetalness = view.getSliderInputNumber("3dExport_bbMetalness");
        const nsMetalness = view.getSliderInputNumber("3dExport_nsMetalness");
        const bbRoughness = view.getSliderInputNumber("3dExport_bbRoughness");
        const nsRoughness = view.getSliderInputNumber("3dExport_nsRoughness");
        const includeCamera = view.getInputBool("3dExport_camera");
        let objects = exportGLTF(systems, include_backbone, include_nucleoside, include_connector, include_bbconnector, view.backboneScale, view.nucleosideScale, view.connectorScale, view.bbconnectorScale, faces_mul, flattenHierarchy, nsRoughness, bbRoughness, nsMetalness, bbMetalness);
        if (includeCamera) {
            objects.push(camera);
        }
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
// Not sure if I broke generic spheres, but as far as I know they're unused (Erik, Sept 2023)
function getNewIds(useNew = false) {
    // Particle numbering in oxDNA systems must be contiguous.
    // All proteins must be listed either before or after all nucleic acids.
    // This function creates a map which maps each BasicElement to its ID in the output.
    let peptides = [];
    let nas = [];
    let gstrands = [];
    // Partition strands by their molecule type 
    systems.forEach(system => {
        peptides.push(...system.strands.filter((s) => s.isPeptide()));
        gstrands.push(...system.strands.filter((s) => s.isGS()));
        nas.push(...system.strands.filter((s) => s.isNucleicAcid()));
    });
    // initialize our counters
    const newStrandIds = new Map();
    const newElementIDs = new Map();
    let totNuc = 0;
    let totAA = 0;
    let totGS = 0;
    let totNucleic = nas.length;
    let totPeptide = peptides.length;
    let totGStrand = gstrands.length;
    let sidCounter = -1;
    let idCounter = 0;
    // By convention, the file will start with peptide strands
    // Peptides were never backwards, so we always iterate forward.
    peptides.forEach(strand => {
        newStrandIds.set(strand, sidCounter--); // peptide strands use negative indexing.
        strand.forEach((e) => {
            newElementIDs.set(e, idCounter++);
            totAA++;
        });
    });
    // these subtypes are not implemented in the CG-oxDNA model, just used for a 'relative' subtype that oxDNA will take as input
    let gsSubtypes = {
        subtypelist: [],
        masses: [],
        radii: [],
        subtype: -1
    };
    // Next, generic sphere objects
    // This has not been thorougly tested.
    gstrands.forEach(strand => {
        newStrandIds.set(strand, sidCounter--);
        strand.forEach((e) => {
            let f = e;
            newElementIDs.set(e, idCounter++);
            // Need to Assign "Subtypes" of each particle based of their masses, repeated masses are represented as the same particle1
            // resulting subtypes start from 0
            let ind = gsSubtypes.masses.indexOf(f.mass);
            if (ind > -1) {
                gsSubtypes.subtypelist.push(gsSubtypes.subtypelist[ind]);
            }
            else {
                gsSubtypes.subtype++;
                gsSubtypes.subtypelist.push(gsSubtypes.subtype);
                gsSubtypes.masses.push(f.mass); //masses will be indexed by the subtype ex. masses[2] Gathers all unique mass values
                gsSubtypes.radii.push(f.radius);
            }
            totGS++;
        });
    });
    // Finally, nucleic acids
    sidCounter = 1; // NA strands are positive-indexed.
    let lastType;
    // Program crashes if we try to set lastType and have
    // no nucleic acid strands. So we need this check.
    if (nas.length > 0) {
        lastType = nas[0].kwdata['type'];
    }
    nas.forEach(strand => {
        //console.log(strand.kwdata['type'] != lastType, !useNew, strand.kwdata['type'] != lastType && !useNew);
        if (strand.kwdata['type'] != lastType && !useNew) {
            let error = "You must use the new topology format when mixing DNA and RNA.";
            notify(error, 'alert');
            throw new Error(error);
        }
        newStrandIds.set(strand, sidCounter++);
        strand.forEach((e) => {
            newElementIDs.set(e, idCounter++);
            totNuc++;
        }, !useNew //new = 5'-3'; old = 3'=5'
        );
    });
    const counts = {
        totParticles: totNuc + totAA + totGS,
        totStrands: totPeptide + totNucleic + totGStrand,
        totNuc: totNuc,
        totAA: totAA,
        totGS: totGS,
        totPeptide: totPeptide,
        totNucleic: totNucleic
    };
    if (counts.totParticles != elements.size) {
        notify(`Length of totNuc (${counts.totParticles}) is not equal to length of elements array (${elements.size})`);
    }
    return [newElementIDs, newStrandIds, counts, gsSubtypes];
}
function makeTopFile(name, newElementIDs, newStrandIDs, gsSubtypes, counts, useNew = undefined) {
    function makeTopFileOld(name) {
        const top = []; // string of contents of .top file
        let firstLine = [counts['totParticles'], counts['totStrands']];
        if (counts['totGS'] > 0) {
            // Add extra counts for protein/DNA/ cg DNA simulation
            firstLine = firstLine.concat(['totNuc', 'totAA', 'totNucleic', 'totPeptide'].map(v => counts[v]));
        }
        else if (counts['totAA'] > 0) {
            // Add extra counts needed in protein simulation
            firstLine = firstLine.concat(['totNuc', 'totAA', 'totNucleic'].map(v => counts[v]));
        }
        top.push(firstLine.join(" "));
        newElementIDs.forEach((_id, e) => {
            let n3 = e.n3 ? newElementIDs.get(e.n3) : -1;
            let n5 = e.n5 ? newElementIDs.get(e.n5) : -1;
            let cons = [];
            // Protein mode
            if (counts['totAA'] > 0 || counts['totGS'] > 0) {
                if (e.isAminoAcid() || e.isGS()) {
                    for (let i = 0; i < e.connections.length; i++) {
                        let c = e.connections[i];
                        if (newElementIDs.get(c) > newElementIDs.get(e) && newElementIDs.get(c) != n5) {
                            cons.push(newElementIDs.get(c));
                        }
                    }
                }
            }
            if (e.isGS()) {
                top.push([newStrandIDs.get(e.strand), "gs" + gsSubtypes.subtypelist[_id], n3, n5, ...cons].join(' '));
            }
            else {
                top.push([newStrandIDs.get(e.strand), e.type, n3, n5, ...cons].join(' '));
            }
        });
        //this is absolute abuse of ES6 and I feel a little bad about it
        return { a: newElementIDs, b: firstLine, c: counts, file_name: name + ".top", file: top.join("\n"), gs: gsSubtypes };
    }
    function makeTopFileNew(name) {
        const top = []; // string of contents of .top file
        let default_props = ['id', 'type', 'circular'];
        let firstLine = [counts['totParticles'].toString(), counts['totStrands'].toString()];
        if (counts['totGS'] > 0) {
            // Add extra counts for protein/DNA/cg DNA simulation
            firstLine = firstLine.concat(['totNuc', 'totAA', 'totNucleic', 'totPeptide'].map(v => counts[v].toString()));
        }
        else if (counts['totAA'] > 0) {
            // Add extra counts needed in protein simulation
            firstLine = firstLine.concat(['totNuc', 'totAA', 'totNucleic'].map(v => counts[v].toString()));
        }
        firstLine.push('5->3');
        top.push(firstLine.join(" "));
        newStrandIDs.forEach((_id, s) => {
            let line = [s.getSequence(), "id=" + _id.toString(), "type=" + s.kwdata['type'], "circular=" + s.isCircular(), s.getKwdataString(default_props)];
            top.push(line.join(" "));
        });
        top.push(''); // topology has to end in an empty line
        return { file_name: name + ".top", file: top.join("\n") };
    }
    let topOut = (useNew ? makeTopFileNew(name) : makeTopFileOld(name));
    return topOut;
}
function makeDatFile(name, newElementIDs) {
    // Get largest absolute coordinate:
    let maxCoord = 0;
    elements.forEach(e => {
        let p = e.getPos();
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
    newElementIDs.forEach((_id, e) => {
        dat += e.getDatFileOutput();
    });
    return { file_name: name + ".dat", file: dat }; //make .dat file
}
function makeParFile(name, newElementIDs, counts) {
    const par = [];
    par.push(counts['totAA'] + counts['totGS']);
    networks.forEach((net) => {
        const t = net.reducedEdges.total;
        if (t != 0) {
            for (let i = 0; i < t; i++) {
                let p1 = net.particles[net.reducedEdges.p1[i]]; // old element old id
                let p2 = net.particles[net.reducedEdges.p2[i]];
                const p1ID = newElementIDs.get(p1);
                const p2ID = newElementIDs.get(p2);
                const line = [p1ID, p2ID, net.reducedEdges.eqDist[i], net.reducedEdges.types[i], net.reducedEdges.ks[i]].concat(net.reducedEdges.extraParams[i]);
                par.push(line.join(" "));
            }
        }
    });
    return { file_name: name + ".par", file: par.join('\n') };
}
function makeMassFile(newElementIDs, gsSubtypes) {
    let text = (gsSubtypes.subtype + 27).toString() + "\n";
    for (let i = 0; i < 27; i++) {
        text += i.toString() + " 1 1\n"; // Mass and radius defaults for DNA/ AA, Radius values are unused by oxDNA
    }
    text += gsSubtypes.masses.map((m, idx) => (idx + 27).toString() + " " + m.toString() + " " + gsSubtypes.radii[idx].toString()).join('\n');
    return (text);
}
function makeSelectedBasesFile() {
    makeTextFile("selectedBases.txt", Array.from(selectedBases).map(e => e.id).join(" "));
}
function makeSequenceFile() {
    let seqTxts = [
        'name, seq, len, RGB'
    ];
    const handle_strand = (strand) => {
        let label = strand.label ? strand.label : `strand_${strand.id}`;
        let line = `${label},${strand.getSequence()}`;
        // add the length info
        line += `,${strand.getLength()}`;
        // assume that the strand color is the same from top to bottom. 
        let color = null;
        if (typeof (strand.end5.color) !== "undefined")
            color = `,${Math.round(strand.end5.color.r * 255)}/${Math.round(strand.end5.color.g * 255)}/${Math.round(strand.end5.color.b * 255)}`;
        else if (typeof (strand.end3.color) !== "undefined")
            color = `,${Math.round(strand.end3.color.r * 255)}/${Math.round(strand.end3.color.g * 255)}/${Math.round(strand.end3.color.b * 255)}`;
        if (color)
            line += color;
        else
            line += `, `;
        seqTxts.push(line);
    };
    let strands = new Set();
    if (selectedBases.size > 0) {
        selectedBases.forEach(e => {
            strands.add(e.strand);
        });
        strands.forEach(handle_strand);
    }
    else {
        systems.forEach((sys) => {
            sys.strands.forEach(handle_strand);
        });
    }
    makeTextFile("sequences.csv", seqTxts.join("\n"));
}
function makeOxViewJsonFile(name, space) {
    let file_name = name ? name + ".oxview" : "output.oxview";
    makeTextFile(file_name, JSON.stringify({
        date: new Date(),
        box: box.toArray(),
        systems: systems,
        forces: forces,
        selections: selectionListHandler.serialize()
    }, null, space));
}
function makeTextFile(filename, text) {
    let blob = new Blob([text], { type: 'text' });
    var elem = window.document.createElement('a');
    elem.href = window.URL.createObjectURL(blob);
    elem.download = filename;
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
    //window.parent.FakeDataDownload(blob, filename);
}
;
function makeIndxFile(indxarray) {
    let write = () => {
        let text = "";
        indxarray.forEach(ind => {
            ind.forEach((sub, si) => {
                if (si != 0 && si != sub.length - 1) {
                    text += " ";
                }
                text += sub.toString(); // Add particle id
            });
            // Newline between each particles array
            text += '\n';
        });
        makeTextFile("index.txt", text);
    };
    if (indxarray.length == 0) {
        notify("Index Data is Empty");
        return;
    }
    else {
        write();
    }
}
function makeNetworkJSONFile(nid) {
    makeTextFile("network.json", JSON.stringify(networks[nid].toJson()));
}
function makeFluctuationFile(gid) {
    makeTextFile("flux.json", JSON.stringify(graphDatasets[gid].toJson()));
}
function makeUNFOutput(name) {
    const oxDNAToUNF = 0.8518; //oxDNA to nm conversion factor
    function identifyClusters() {
        class unfGroup {
            name;
            id;
            includedObjects;
            constructor(name, id, includedObjects) {
                this.name = name;
                this.id = id;
                this.includedObjects = includedObjects;
                this.name = name;
                this.id = id;
                this.includedObjects = includedObjects;
            }
        }
        let groups = [];
        for (let i = 0; i < clusterCounter; i++) {
            groups.push(new unfGroup(`group${i}`, i, []));
        }
        systems.forEach(sys => sys.strands.forEach(strand => strand.forEach(e => {
            groups[e.clusterId - 1].includedObjects.push(e.id); //apparently clusters are 1-indexed
        })));
        return groups;
    }
    function makeFileSchema() {
        let fileSchema = {
            "id": 0,
            "path": "",
            "isIncluded": false,
            "hash": ""
        };
        return fileSchema;
    }
    function makeLatticeSchema() {
        function makeVirtualHelixSchema() {
            function makeCellsSchema() {
                let cellsSchema = {
                    "id": 0,
                    "number": 0,
                    "type": "n",
                    "fiveToThreeNts": [],
                    "threeToFiveNts": []
                };
                return cellsSchema;
            }
            let virtualHelixSchema = {
                "id": 0,
                "latticePosition": [0, 0],
                "firstActiveCell": 0,
                "lastActiveCell": 0,
                "lastCell": 0,
                "initialAngle": [0, 0, 0],
                "altPosition": [0, 0, 0],
                "cells": []
            };
            return virtualHelixSchema;
        }
        let latticeSchema = {
            "id": 0,
            "name": "",
            "type": "",
            "position": [0, 0, 0],
            "orientation": [0, 0, 0],
            "virtualHelices": []
        };
        return latticeSchema;
    }
    function makeStructuresSchema(system) {
        function makeNaStrandsSchema(strand) {
            function makeNucleotidesSchema(nuc) {
                let nucleotidesSchema = {
                    "id": nuc.id,
                    "nbAbbrev": nuc.type,
                    "pair": nuc.pair ? nuc.pair.id : -1,
                    "prev": nuc.n5 ? nuc.n5.id : -1,
                    "next": nuc.n3 ? nuc.n3.id : -1,
                    "pdbId": 0,
                    "altPositions": [{
                            "nucleobaseCenter": nuc.getInstanceParameter3('nsOffsets').multiplyScalar(oxDNAToUNF).toArray(),
                            "backboneCenter": nuc.getInstanceParameter3('bbOffsets').multiplyScalar(oxDNAToUNF).toArray(),
                            "baseNormal": nuc.getA3().toArray(),
                            "hydrogenFaceDir": nuc.getA1().toArray()
                        }]
                };
                return nucleotidesSchema;
            }
            let naStrandsSchema = {
                "id": strand.id,
                "name": strand.label,
                "isScaffold": strand.getLength() > 1000 ? true : false,
                "naType": strand.end5.isDNA() ? "DNA" : "RNA",
                "color": strand.end5.color ? '#'.concat(strand.end5.color.getHexString()) : '',
                "fivePrimeId": strand.end5.id,
                "threePrimeId": strand.end3.id,
                "pdbFileId": 0,
                "chainName": "",
                "nucleotides": strand.map(makeNucleotidesSchema)
            };
            return naStrandsSchema;
        }
        function makeAaChainsSchema(strand) {
            function makeAminoAcidsSchema(aa) {
                let aminoAcidsSchema = {
                    "id": aa.id,
                    "secondary": "",
                    "aaAbbrev": aa.type,
                    "prev": aa.n5 ? aa.n5.id : -1,
                    "next": aa.n3 ? aa.n3.id : -1,
                    "pdbId": 0,
                    "altPositions": [aa.getInstanceParameter3('nsOffsets').multiplyScalar(oxDNAToUNF).toArray()]
                };
                return aminoAcidsSchema;
            }
            let aaChainSchema = {
                "id": strand.id,
                "chainName": strand.label,
                "color": strand.end5.color ? '#'.concat(strand.end5.color.getHexString()) : '',
                "pdbFileId": 0,
                "nTerm": strand.end5.id,
                "cTerm": strand.end3.id,
                "aminoAcids": strand.map(makeAminoAcidsSchema)
            };
            return aaChainSchema;
        }
        let structuresSchema = {
            "id": system.id,
            "name": system.label,
            "naStrands": system.strands.filter(strand => strand.isNucleicAcid()).map(makeNaStrandsSchema),
            "aaChains": system.strands.filter(strand => strand.isPeptide()).map(makeAaChainsSchema)
        };
        return structuresSchema;
    }
    let unfSchema = {
        "format": "unf",
        "version": "1.0.0",
        "idCounter": elements.getNextId(),
        "lengthUnits": "nm",
        "angularUnits": "deg",
        "name": view.getInputElement('unfStructureName'),
        "author": view.getInputElement('unfAuthorName'),
        "creationDate": new Date().toISOString().split('T')[0],
        "doi": view.getInputElement('unfDOI'),
        "simData": {
            "boxSize": box.toArray(),
        },
        "externalFiles": [],
        "lattices": [],
        "structures": systems.map(makeStructuresSchema),
        "molecules": {
            "ligands": [],
            "bonds": [],
            "nanostructures": []
        },
        "groups": clusterCounter > 0 ? identifyClusters() : [],
        "connections": [],
        "modifications": [],
        "misc": {}
    };
    makeTextFile(view.getInputValue("UNFexportFileName").concat(".unf"), JSON.stringify(unfSchema));
}
