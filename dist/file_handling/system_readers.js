/// <reference path="../typescript_definitions/index.d.ts" />
///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////                 Read a file, make a system                 ////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
// Generic function to connect a file to a reader
function parseFileWith(file, parser) {
    let reader = new FileReader();
    reader.onload = (e) => {
        parser(e.target.result);
    };
    reader.readAsText(file);
}
// TacoxDNA importer
function importFiles(files) {
    let from = document.getElementById("importFromSelect").value;
    let to = 'oxview';
    let opts = {};
    let progress = document.getElementById("importProgress");
    progress.hidden = false;
    let cancelButton = document.getElementById("importFileDialogCancel");
    document.body.style.cursor = "wait";
    if (from === "cadnano") {
        opts = {
            grid: document.getElementById("importCadnanoLatticeSelect").value,
            sequence: document.getElementById("importCadnanoScaffoldSeq").value,
            default_val: document.getElementById("importCadnanoDefaultVal").value
        };
    }
    else if (from === "rpoly") {
        opts = {
            sequence: document.getElementById("importRpolyScaffoldSeq").value
        };
    }
    else if (from === "tiamat") {
        opts = {
            tiamat_version: parseInt(document.getElementById("importTiamatVersion").value),
            isDNA: document.getElementById("importTiamatIsDNA").value == "DNA",
            default_val: document.getElementById("importTiamatDefaultVal").value
        };
    }
    console.log(`Converting ${[...files].map(f => f.name).join(',')} from ${from} to ${to}.`);
    let readFiles = new Map();
    for (const file of files) {
        const reader = new FileReader();
        reader.onload = function (evt) {
            readFiles.set(file, evt.target.result);
            console.log(`Finished reading ${readFiles.size} of ${files.length} files`);
            if (readFiles.size === files.length) {
                var worker = new Worker('./dist/file_handling/tacoxdna_worker.js');
                let finished = () => {
                    progress.hidden = true;
                    Metro.dialog.close('#importFileDialog');
                    document.body.style.cursor = "auto";
                };
                worker.onmessage = (e) => {
                    let converted = e.data;
                    readOxViewString(converted);
                    console.log('Conversion finished');
                    finished();
                };
                worker.onerror = (error) => {
                    console.log('Error in conversion');
                    notify(error.message, "alert");
                    finished();
                };
                cancelButton.onclick = () => {
                    worker.terminate();
                    console.log('Conversion aborted');
                    finished();
                };
                worker.postMessage([[...readFiles.values()], from, to, opts]);
            }
        };
        reader.readAsText(file);
    }
}
// Read an oxView file
function readOxViewString(s) {
    let sysStartId = sysCount;
    const newElementIds = new Map();
    // Check if file includes custom colors
    let customColors = false;
    // Parse json string
    const data = JSON.parse(s);
    // Update box data, if provided
    if (data.box) {
        // Don't make smaller than current
        box.x = Math.max(box.x, data.box[0]);
        box.y = Math.max(box.y, data.box[1]);
        box.z = Math.max(box.z, data.box[2]);
    }
    // Add systems, if provided (really should be)
    if (data.systems) {
        // Keep track if new clusters
        let newClusterMap = new Map();
        // Go through and add each system
        data.systems.forEach(sysData => {
            let sys = new System(sysStartId + sysData.id, elements.getNextId());
            sys.label = sysData.label;
            let sidCounter = 0;
            // Go through and add each strand
            sysData.strands.forEach(strandData => {
                let strand;
                let strandType;
                // Create strand of correct class
                let strandClass;
                switch (strandData.class) {
                    case 'NucleicAcidStrand':
                        strandClass = NucleicAcidStrand;
                        strandType = strandData.monomers[0].class;
                        break;
                    case 'Peptide':
                        strandClass = Peptide;
                        strandType = 'peptide';
                        break;
                    default:
                        let error = `Unrecognised type of strand:  ${strandData.class}`;
                        notify(error, "alert");
                        throw new Error(error);
                }
                strand = new strandClass(strandData.id, sys);
                strand.kwdata['type'] = strandType;
                // Add strand to system
                sys.addStrand(strand);
                // Go through and add each monomer element
                strandData.monomers.forEach(elementData => {
                    // Create element of correct class
                    let e;
                    let elementClass;
                    switch (elementData.class) {
                        case 'DNA':
                            elementClass = DNANucleotide;
                            break;
                        case 'RNA':
                            elementClass = RNANucleotide;
                            break;
                        case 'AA':
                            elementClass = AminoAcid;
                            break;
                        default:
                            let error = `Unrecognised type of element:  ${elementData.class}`;
                            notify(error);
                            throw new Error(error);
                    }
                    e = new elementClass(undefined, strand);
                    // Preserve ID when possible, keep track of new IDs if not
                    if (elements.has(elementData.id)) {
                        elements.push(e); // Create new ID
                    }
                    else {
                        elements.set(elementData.id, e); // Reuse old ID
                    }
                    newElementIds.set(elementData.id, e.id);
                    e.strand = strand;
                    if (strandData.end3 == elementData.id || !('n3' in elementData)) {
                        strand.end3 = e; // Set strand 3' end
                    }
                    if (strandData.end5 == elementData.id || !('n5' in elementData)) {
                        strand.end5 = e; // Set strand 3' end
                    }
                    // Set misc attributes
                    e.label = elementData.label;
                    e.type = elementData.type;
                    // Set cluster id, making sure not to reuse any already
                    // existing cluster id loaded earlier.
                    if (elementData.cluster) {
                        if (!newClusterMap.has(elementData.cluster)) {
                            newClusterMap.set(elementData.cluster, ++clusterCounter);
                        }
                        e.clusterId = newClusterMap.get(elementData.cluster);
                    }
                    if (elementData.color) {
                        e.color = new THREE.Color(elementData.color);
                        customColors = true;
                    }
                    e.sid = sidCounter++;
                    elementData.createdElement = e;
                });
            });
            sysData.createdSystem = sys;
            sys.initInstances(sidCounter);
            systems.push(sys);
            sysCount++;
        });
        // Loop through another time to connect elements, since we now have updated IDs
        data.systems.forEach(sysData => {
            sysData.strands.forEach(strandData => {
                strandData.monomers.forEach(d => {
                    let e = d.createdElement;
                    // Set references to any connected elements
                    if ('n5' in d) {
                        e.n5 = elements.get(newElementIds.get(d.n5));
                    }
                    if ('n3' in d) {
                        e.n3 = elements.get(newElementIds.get(d.n3));
                    }
                    if ('bp' in d) {
                        e.pair = elements.get(newElementIds.get(d.bp));
                    }
                });
            });
        });
        // Let's do this one more time...
        // Since we now have the topology setup, let's set the configuration
        data.systems.forEach(sysData => {
            let sys = sysData.createdSystem;
            let deprecated = false;
            sysData.strands.forEach(strandData => {
                strandData.monomers.slice().reverse().forEach(d => {
                    let e = d.createdElement;
                    // If we have a position, use that
                    if (d.p) {
                        let p = new THREE.Vector3().fromArray(d.p);
                        if (d.a1 && d.a3) {
                            let a1 = new THREE.Vector3().fromArray(d.a1);
                            let a3 = new THREE.Vector3().fromArray(d.a3);
                            e.calcPositions(p, a1, a3, true);
                        }
                        else {
                            const zero = new THREE.Vector3();
                            e.calcPositions(p, zero, zero, true); // Amino acid
                        }
                        // Otherwise fallback to reading instance parameters
                    }
                    else if ('conf' in d) {
                        //make sure warning shows up only once
                        if (!deprecated)
                            notify("The loaded file is using a deprecated .oxView format. Please save your design again to avoid this warning", 'warn');
                        deprecated = true;
                        e.sid = e.id; // Why is this needed?
                        // Populate instances
                        for (let attr in d.conf) {
                            let v = d.conf[attr];
                            sys.fillVec(attr, v.length, e.sid, v);
                        }
                        // Re-assign a picking color if ID has changed
                        if (d.id !== e.id) {
                            let idColor = new THREE.Color();
                            idColor.setHex(e.id + 1); //has to be +1 or you can't grab nucleotide 0
                            sys.fillVec('bbLabels', 3, e.sid, [idColor.r, idColor.g, idColor.b]);
                        }
                    }
                });
            });
            // Finally, we can add the system to the scene
            addSystemToScene(sys);
            if (data.selections) {
                data.selections.forEach((selection_element) => {
                    selectionListHandler.append(new Set(api.getElements(selection_element[1])), selection_element[0]);
                });
            }
            if (customColors) {
                view.coloringMode.set("Custom");
            }
        });
        // Center the newly added systems as one
        // Needs to be done after all systems are added to the scene
        centerAndPBC(
        // Consider all added monomers
        data.systems.flatMap(sysData => sysData.createdSystem.getMonomers()));
    }
    if (data.forces) {
        data.forces.forEach(f => {
            switch (f.type) {
                case "mutual_trap":
                    let mutTrap = new MutualTrap();
                    mutTrap.setFromParsedJson(f);
                    mutTrap.update();
                    forces.push(mutTrap);
                    break;
                case "skew_trap":
                    let skewTrap = new SkewTrap();
                    skewTrap.setFromParsedJson(f);
                    skewTrap.update();
                    forces.push(skewTrap);
                    break;
                default:
                    notify(`External force ${f["type"]} type not supported yet, feel free to implement in file_reading.ts and force.ts`);
                    break;
            }
        });
        if (!forceHandler) {
            forceHandler = new ForceHandler(forces);
        }
        else {
            forceHandler.set(forces);
        }
    }
}
// Read an mgl file
const MGL_SCALE = 1;
function readMGL(file) {
    // utility function to parse colors in MGL format
    function materialFromMGLColor(color, opacity = 1.0) {
        if (color === "magenta") {
            opacity = 0.5;
        }
        let color_value;
        if (color.indexOf(",") > -1) {
            //we have a an rgb color definition
            let rgb = color.split(",").map(s => parseFloat(s));
            if (rgb.length > 3) {
                opacity = rgb[3];
            }
            color_value = new THREE.Color(rgb[0], rgb[1], rgb[2]);
        }
        else {
            color_value = new THREE.Color(color);
        }
        const material = new THREE.MeshPhongMaterial({ color: color_value });
        if (opacity < 1.0) {
            material.transparent = true;
            material.opacity = opacity;
        }
        return material;
    }
    // utility function to generate a cylindrical or conical mesh
    function cylinderMesh(pos_bottom, pos_top, r_bottom, r_top, material) {
        // https://stackoverflow.com/questions/15316127/three-js-line-vector-to-cylinder
        // edge from X to Y
        var direction = new THREE.Vector3().subVectors(pos_top, pos_bottom);
        // Make the geometry (of "direction" length)
        var geometry = new THREE.CylinderGeometry(r_top, r_bottom, direction.length(), 10, 4);
        // shift it so one end rests on the origin
        geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, direction.length() / 2, 0));
        // rotate it the right way for lookAt to work
        geometry.applyMatrix(new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(90)));
        // Make a mesh with the geometry
        var mesh = new THREE.Mesh(geometry, material);
        // Position it where we want
        mesh.position.copy(pos_bottom);
        // And make it point to where we want
        mesh.lookAt(pos_top);
        return mesh;
    }
    let reader = new FileReader();
    reader.onload = (e) => {
        let lines = e.target.result.split(/[\n]+/g);
        // parse the on-line header
        let box_header = lines[0].split(":")[1].split(",");
        // the box can be specified as .Box:X,Y,Z or .Vol:V
        let x, y, z;
        if (box_header.length == 1) {
            x = y = z = parseFloat(box_header[0]) ** 0.33 * MGL_SCALE;
        }
        else if (box_header.length == 3) {
            [x, y, z] = box_header.slice(0, 3).map(side => parseFloat(side) * MGL_SCALE);
        }
        else {
            notify(`The first line of an mgl file should be either '.Box:X,Y,Z' or '.Vol:V', with X, Y, Z and V numbers`);
        }
        lines = lines.slice(1); // discard the header line
        // modify the box 
        box.set(x, y, z);
        lines.forEach(str => {
            // in cogli shapes can be grouped in a single object by using "G" delimiters. Here we treat each shape 
            // as a different object, so we split lines if we find G's
            str.split("G").forEach(substr => {
                substr = substr.trim();
                if (substr) {
                    let line = substr.split(/\s+/);
                    // setup the size of the particles
                    const radius = parseFloat(line[4]) * MGL_SCALE;
                    let [xpos, ypos, zpos] = line.slice(0, 3).map(coord => parseFloat(coord) * MGL_SCALE);
                    let color = line[5].slice(2).slice(0, -1);
                    let material = materialFromMGLColor(color);
                    let key = "S"; //  which object do we need to build? The default is a sphere
                    if (line.length > 6) {
                        key = line[6];
                    }
                    switch (key) {
                        // a simple sphere
                        case 'S': {
                            const geometry = new THREE.SphereGeometry(radius, 10, 10);
                            const sphere = new THREE.Mesh(geometry, material);
                            sphere.position.set(xpos, ypos, zpos);
                            scene.add(sphere);
                            break;
                        }
                        // a patchy particle
                        case 'M': {
                            const geometry = new THREE.SphereGeometry(radius, 10, 10);
                            const sphere = new THREE.Mesh(geometry, material);
                            sphere.position.set(xpos, ypos, zpos);
                            scene.add(sphere);
                            // now let's figure out the bonds
                            let patch_pos = str.indexOf("M");
                            let patches_str = str.slice(patch_pos + 1).split("]").slice(0, -1);
                            patches_str.forEach(patch_str => {
                                if (patch_str) {
                                    let patch_info = patch_str.split(/\s+/);
                                    patch_info = patch_info.slice(1);
                                    let [patch_x, patch_y, patch_z] = patch_info.slice(0, 3).map(coord => parseFloat(coord) * MGL_SCALE);
                                    let patch_size = parseFloat(patch_info[3]) * MGL_SCALE;
                                    let patch_color = patch_info[4].slice(2);
                                    let patch_material = materialFromMGLColor(patch_color, material.opacity);
                                    const cylinder = cylinderMesh(new THREE.Vector3(xpos, ypos, zpos), new THREE.Vector3(xpos + patch_x, ypos + patch_y, zpos + patch_z), 0, patch_size, patch_material);
                                    scene.add(cylinder);
                                }
                            });
                            break;
                        }
                        // a cylinder
                        case 'C': {
                            let [axis_x, axis_y, axis_z] = line.slice(7, 10).map(coord => parseFloat(coord) * MGL_SCALE);
                            const cylinder = cylinderMesh(new THREE.Vector3(xpos, ypos, zpos), new THREE.Vector3(xpos + axis_x, ypos + axis_y, zpos + axis_z), radius, radius, material);
                            scene.add(cylinder);
                            break;
                        }
                        // a dipolar sphere (i.e. a sphere with an embedded dipole)
                        case 'D': {
                            // opaque colours don't make sense here
                            if (material.opacity == 1.0) {
                                material.transparent = true;
                                material.opacity = 0.5;
                            }
                            const geometry = new THREE.SphereGeometry(radius, 10, 10);
                            const sphere = new THREE.Mesh(geometry, material);
                            sphere.position.set(xpos, ypos, zpos);
                            scene.add(sphere);
                            let arrow_material = materialFromMGLColor("black");
                            let [dip_x, dip_y, dip_z] = line.slice(7, 10).map(coord => parseFloat(coord) * MGL_SCALE);
                            let dip_length = Math.sqrt(dip_x ** 2 + dip_y ** 2 + dip_z ** 2);
                            let cyl_radius = radius * 0.2;
                            let arrow_length = dip_length * 0.8;
                            let cyl_length = arrow_length * 0.6;
                            let cyl_x = xpos - 0.5 * arrow_length * dip_x / dip_length;
                            let cyl_y = ypos - 0.5 * arrow_length * dip_y / dip_length;
                            let cyl_z = zpos - 0.5 * arrow_length * dip_z / dip_length;
                            let cone_radius = cyl_radius * 2;
                            let cone_length = arrow_length * 0.4;
                            let cone_x = cyl_x + cyl_length * dip_x / dip_length;
                            let cone_y = cyl_y + cyl_length * dip_y / dip_length;
                            let cone_z = cyl_z + cyl_length * dip_z / dip_length;
                            const cylinder = cylinderMesh(new THREE.Vector3(cyl_x, cyl_y, cyl_z), new THREE.Vector3(cone_x, cone_y, cone_z), cyl_radius, cyl_radius, arrow_material);
                            scene.add(cylinder);
                            const cone = cylinderMesh(new THREE.Vector3(cone_x, cone_y, cone_z), new THREE.Vector3(cone_x + dip_x * cone_length / dip_length, cone_y + dip_y * cone_length / dip_length, cone_z + dip_z * cone_length / dip_length), cone_radius, 0, arrow_material);
                            scene.add(cone);
                            break;
                        }
                        default:
                            notify(`mgl object '${key}' not supported yet`);
                            break;
                    }
                }
            });
        });
        render();
    };
    reader.readAsText(file);
}
function readPdbFile(file) {
    let reader = new FileReader();
    var worker = new Worker('./dist/file_handling/pdb_worker.js');
    let indx = -1;
    reader.onload = () => {
        const pdbLines = reader.result.split(/[\n]+/g);
        // feed pdbLines into worker
        let transfer = [pdbLines, pdbFileInfo.length, elements.getNextId(), sysCount];
        worker.postMessage(transfer);
    };
    function activate() {
        var promise = new Promise(function (resolve, reject) {
            var counter = 0;
            // var array = [];
            var callback = function (message) {
                counter++;
                pdbtemp = message.data;
                //And when all workers ends, resolve the promise
                if (counter >= 1 && pdbtemp.length > 0) {
                    worker.terminate(); // Free up the memory taken by worker
                    // let strandElems = pdbtemp[0];
                    let strandID = pdbtemp[1];
                    let com = pdbtemp[2];
                    let gd = pdbtemp[3];
                    let dims = pdbtemp[4];
                    let pdbindices = pdbtemp[5];
                    // let pdbinfo = pdbtemp[6]
                    let startID = elements.getNextId();
                    let id = startID;
                    // store PDB data
                    let pdata = new pdbinfowrapper(pdbtemp[6][0], pdbtemp[6][1], pdbtemp[6][2]);
                    pdata.disulphideBonds = pdbtemp[6][3];
                    pdbFileInfo.push(pdata);
                    pdata = undefined;
                    // pdbinfo = undefined;
                    // store B factor Data in global graphDatasets
                    let gdata = new graphData(gd[0], gd[1], gd[2], gd[3], gd[4]);
                    graphDatasets.push(gdata);
                    gdata = undefined;
                    gd = undefined;
                    // redraw box so nucleotides will be drawn with backbone connectors
                    if (box.x < dims[0])
                        box.x = dims[0] * 1.25;
                    if (box.y < dims[1])
                        box.y = dims[1] * 1.25;
                    if (box.z < dims[2])
                        box.z = dims[2] * 1.25;
                    redrawBox();
                    dims = undefined;
                    // initialize System
                    let sys = new System(sysCount, startID);
                    for (let i = 0; i < pdbtemp[0].length; i++) {
                        if (strandID[i] == "pro") {
                            let currentstrand = sys.addNewPeptideStrand();
                            for (let j = 0; j < pdbtemp[0][i].length; j++) {
                                let AA = currentstrand.createBasicElement(id);
                                AA.sid = id - startID;
                                AA.pdbindices = pdbindices[AA.sid];
                                if (j != 0) {
                                    let prevaa = elements.get(id - 1); //Get previous Element
                                    AA.n3 = prevaa;
                                    prevaa.n5 = AA;
                                }
                                elements.push(AA);
                                id++;
                            }
                            if (currentstrand.end3 == undefined) {
                                console.log("Strand " + currentstrand.id + " could not be initialized");
                            }
                            else {
                                currentstrand.updateEnds();
                            }
                        }
                        else if (['dna', 'rna'].includes(strandID[i])) { //DNA or RNA
                            let currentstrand = sys.addNewNucleicAcidStrand(strandID[i].toUpperCase());
                            for (let j = 0; j < pdbtemp[0][i].length; j++) {
                                let nc = currentstrand.createBasicElementTyped(strandID[i], id);
                                nc.sid = id - startID;
                                nc.pdbindices = pdbindices[nc.sid];
                                if (j != 0) {
                                    let prevnc = elements.get(id - 1); //Get previous Element
                                    nc.n3 = prevnc;
                                    prevnc.n5 = nc;
                                }
                                elements.push(nc);
                                id++;
                            }
                            if (currentstrand.end3 == undefined) {
                                console.log("Strand " + currentstrand.id + " could not be initialized");
                            }
                            else {
                                currentstrand.updateEnds();
                            }
                        }
                    }
                    sys.initInstances(sys.systemLength());
                    // Load monomer info
                    let count = 0;
                    for (let i = 0; i < pdbtemp[0].length; i++) {
                        let strand = sys.strands[i];
                        if (strand.isPeptide()) {
                            for (let k = 0; k < strand.getLength(); k++) {
                                let Amino = elements.get(startID + count);
                                FillInfoAA(pdbtemp[0][i][k], Amino, com);
                                count++;
                            }
                        }
                        else if (strand.isNucleicAcid()) {
                            for (let k = 0; k < strand.getLength(); k++) {
                                let Nuc = elements.get(startID + count);
                                FillInfoNC(pdbtemp[0][i][k], Nuc, com);
                                count++;
                            }
                        }
                    }
                    //System is set Up just needs to be added to the systems array now I believe
                    addSystemToScene(sys);
                    systems.push(sys);
                    sysCount++;
                    if (flux.fluxWindowOpen)
                        view.addGraphData(graphDatasets.length - 1); // add to flux window if open, otherwise it'll be added on next opening
                    // notify("ANM Fitting Complete, Please check under Available Datasets in the Fluctuation Solver");
                    resolve(message.data);
                }
            };
            worker.onmessage = callback;
            reader.readAsText(file); // Executes Loading reads file etc.
            notify("Reading PDB file...");
            // when it ends triggers addPDBtoScene
        });
        return promise;
    }
    activate();
    pdbtemp = [];
}
