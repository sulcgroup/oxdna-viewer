/// <reference path="../typescript_definitions/index.d.ts" />
///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////                 Read a file, make a system                 ////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
async function identifyTopologyParser(topFile) {
    // .top files may be DNA/RNA/Protein, or some sort of patchy.
    // There are 4(5?) different file formats, all called .top.  Which is this one?
    let contents;
    await topFile.text().then((result) => { contents = result; });
    let lines = contents.split(/[\n]+/g);
    lines = lines.filter(item => item); // remove blank lines
    let header = lines[0];
    let l0 = header.split(/\s+/);
    // It might be a DNA/RNA/Protein file
    if (header.indexOf('5->3') > 0 || lines.length == parseInt(l0[0]) + 1) {
        return readTop;
    }
    // It might be a patchy or LORO file
    else if (lines.length == parseInt(l0[1]) + 1 || lines.length == 2) {
        return readPatchyTop;
    }
    // It might be Subhajit's topology
    else if (0) {
        //NOT IMPLEMENTED
        return new Function;
    }
    else {
        notify("ERROR: Topology format not recognized", 'error');
        return undefined;
    }
}
function readTop(topFile) {
    //make system to store the dropped files in
    return parseFileWith(topFile, parseTop);
}
function readPatchyTop(topFile, systemHelpers) {
    // Loro topology files have loro in the name
    let LORO = false;
    if (topFile.name.toLowerCase().includes("loro")) {
        LORO = true;
    }
    return parseFileWith(topFile, parsePatchyTop, [systemHelpers, LORO]);
}
function readOxViewFile(oxFile) {
    // oxView files may contain multiple systems
    return parseFileWith(oxFile, parseOxViewString);
}
function readUNFFile(unfFile) {
    // UNF files may contain multiple systems
    return parseFileWith(unfFile, parseUNFString);
}
function readXYZFile(xyzFile) {
    return parseFileWith(xyzFile, parseXYZString);
}
function parseTop(s) {
    function readNewTopFile(lines) {
        // TODO: This does not work with (#) formatted base types
        // TODO: What to do with keywords other than type and circular? color, label
        // TODO: Have each system keep track of which direction its strands are in case of mixed systems
        view.setInputBool("topFormat", true); // if input is new format, default to new format
        let nucCount = elements.getNextId();
        let cluster = ++clusterCounter;
        let l0 = lines[0].split(/\s+/);
        let nMonomers = l0[0];
        let nStrands = l0[0];
        lines = lines.slice(1);
        lines.forEach((line, i) => {
            if (!line) {
                return;
            } // skip empty lines
            let l = line.trim().split(/\s+/);
            let seq = l[0];
            let kwdata = {
                id: i,
                type: "DNA",
                circular: false
            };
            l.slice(1).forEach(kv => {
                let split = kv.split('=');
                // Turn values representing bools into JS bools
                if (split[1].toLowerCase() === 'true' || split[1].toLowerCase() === 'false') {
                    kwdata[split[0]] = (split[1].toLocaleLowerCase() === 'true');
                }
                // Keep everything else as strings
                else {
                    kwdata[split[0]] = split[1];
                }
            });
            // create strand
            let strand_type = kwdata["type"];
            let new_strand;
            if (strand_type == "DNA" || strand_type == "RNA") {
                new_strand = system.addNewNucleicAcidStrand(strand_type);
            }
            else if (strand_type == "peptide") {
                new_strand = system.addNewPeptideStrand();
            }
            else if (strand_type == "generic") {
                new_strand = system.addNewGenericSphereStrand();
            }
            else {
                let error = `Unrecognised type of strand: ${strand_type}`;
                notify(error, "alert");
                throw new Error(error);
            }
            new_strand.kwdata = kwdata;
            // Should strands maintain negative indexing on peptide strands for compatibility with the old writer.
            // Or should I re-index here to have nicely 0-indexed strings
            // create monomers in strand
            let last_nuc = null;
            let nuc = null;
            for (let j = 0; j < seq.length; j++) {
                if (new_strand instanceof NucleicAcidStrand) {
                    nuc = new_strand.createBasicElementTyped(strand_type.toLowerCase(), nucCount);
                }
                else {
                    nuc = new_strand.createBasicElement(nucCount);
                }
                elements.set(nucCount, nuc);
                // set nucleotide properties
                nuc.sid = sidCounter++;
                nuc.clusterId = cluster;
                nuc.n5 = last_nuc;
                if (last_nuc) {
                    last_nuc.n3 = nuc;
                }
                nuc.type = seq[j];
                last_nuc = nuc;
                nucCount = elements.getNextId();
            }
            new_strand.end3 = nuc;
            if (kwdata["circular"]) {
                new_strand.end3.n3 = new_strand.end5;
                new_strand.end5.n5 = new_strand.end3;
            }
            new_strand.updateEnds();
        });
    }
    function readOldTopFile(lines) {
        function strandTypeFromLine(l) {
            let strID = parseInt(l[0]); //proteins and GS strands are negative indexed
            if (strID < 0) {
                if (l[1].includes('gs'))
                    type = 'gs';
                else
                    type = 'peptide';
            }
            else {
                type = isRNA ? 'RNA' : 'DNA';
            }
            return type;
        }
        let nucCount = elements.getNextId();
        lines = lines.slice(1); // discard the header
        // create empty list of elements with length equal to the topology
        // old style topology files can only contain one of DNA or RNA, so this is safe.
        // Note: this is implemented such that we have the elements for the dat reader 
        let nuc; //DNANucleotide | RNANucleotide | AminoAcid | GenericSphere;
        let isRNA;
        let type = '';
        for (let j = 0; j < lines.length; j++) {
            elements.set(nucCount + j, nuc);
            if (lines[j].includes("U")) {
                isRNA = true;
            }
        }
        let l0 = lines[0].split(/\s+/);
        let strID = parseInt(l0[0]); //proteins and GS strands are negative indexed
        lastStrand = strID;
        type = strandTypeFromLine(l0);
        let currentStrand = system.createStrandTyped(type);
        // Create new cluster for loaded structure:
        let cluster = ++clusterCounter;
        lines.forEach((line, i) => {
            if (line == "") {
                // Delete last element
                elements.delete(elements.getNextId() - 1);
                return;
            }
            //split the file and read each column, format is: "strID base n3 n5"
            let l = line.split(/\s+/);
            if (l.length < 4) {
                let err = `Line ${i} : ${line} is not a valid topology line.`;
                notify(err, "alert");
                throw new Error(err);
            }
            strID = parseInt(l[0]);
            if (strID != lastStrand) { //if new strand id, make new strand                        
                type = strandTypeFromLine(l);
                currentStrand = system.createStrandTyped(type);
            }
            ;
            // create a new element
            if (!elements.get(nucCount + i))
                elements.set(nucCount + i, currentStrand.createBasicElement(nucCount + i));
            let nuc = elements.get(nucCount + i);
            // Set systemID
            nuc.sid = sidCounter++;
            // Set cluster id;
            nuc.clusterId = cluster;
            //create neighbor 3 element if it doesn't exist
            let n3 = parseInt(l[2]);
            if (n3 != -1) {
                if (!elements.get(nucCount + n3)) {
                    elements.set(nucCount + n3, currentStrand.createBasicElement(nucCount + n3));
                }
                nuc.n3 = elements.get(nucCount + n3);
            }
            else {
                nuc.n3 = null;
                currentStrand.end3 = nuc;
            }
            //create neighbor 5 element if it doesn't exist
            let n5 = parseInt(l[3]);
            if (n5 != -1) {
                if (!elements.get(nucCount + n5)) {
                    elements.set(nucCount + n5, currentStrand.createBasicElement(nucCount + n5));
                }
                nuc.n5 = elements.get(nucCount + n5);
            }
            else {
                nuc.n5 = null;
                currentStrand.end5 = nuc;
            }
            let base = l[1]; // get base id
            nuc.type = base;
            lastStrand = strID;
        });
        nucCount = elements.getNextId();
    }
    const system = new System(systems.length, elements.getNextId());
    systems.push(system);
    let sidCounter = 0;
    let lastStrand;
    let lines = s.split(/[\n]+/g);
    (lines[0].indexOf('5->3') > 0) ? readNewTopFile(lines) : readOldTopFile(lines);
    system.initInstances(system.systemLength());
    system.fillDefaultColors();
    addSystemToScene(system);
    return system;
}
function parsePatchyTop(s, systemHelpers, LORO) {
    const system = new PatchySystem(systems.length);
    systems.push(system);
    let sidCounter = 0;
    let nucCount = elements.getNextId();
    s = s.replace(/ {2,}/g, " "); // remove double spaces (cause Josh likes them)
    let lines = s.split(/[\n]+/g);
    const configurationLength = parseInt(lines[0].split(/\s+/)[0]);
    lines = lines.slice(1); // discard the header as we have the info now
    const speciesCounts = [];
    if (!LORO) {
        lines[0].trim().split(/\s+/).forEach((t, i) => {
            if (t) {
                let sphere = new PatchyParticle(nucCount + i, system);
                system.particles.push(sphere);
                sphere.id = nucCount + i;
                elements.set(nucCount + i, sphere);
                sphere.type = t;
                const s = parseInt(t);
                if (speciesCounts[s] == undefined) {
                    speciesCounts[s] = 1;
                }
                else {
                    speciesCounts[s]++;
                }
                sphere.sid = speciesCounts[s] - 1;
                sphere.clusterId = clusterCounter;
            }
        });
    }
    else {
        let idCounter = 0;
        lines.forEach((line, t) => {
            // Split on one or more spaces
            const [pCountStr, nPatches, patchIds, patchSpec] = line.split(/\s+/g);
            let pCount = parseInt(pCountStr);
            for (let p = 0; p < pCount; p++) {
                const id = idCounter++;
                let sphere = new PatchyParticle(id, system);
                system.particles.push(sphere);
                sphere.sid = sidCounter++;
                sphere.id = id;
                elements.set(id, sphere);
                sphere['patchSpec'] = patchSpec;
                sphere.type = t.toString();
                // Set the id per species
                if (speciesCounts[t] == undefined) {
                    speciesCounts[t] = 1;
                }
                else {
                    speciesCounts[t]++;
                }
                sphere.sid = speciesCounts[t] - 1;
                sphere.clusterId = clusterCounter;
            }
        });
    }
    system.readPatchFiles(systemHelpers["particles"], systemHelpers["patches"], systemHelpers["loroPatchFiles"]);
    system.initPatchyInstances();
    addSystemToScene(system);
    return system;
}
// Read an oxView file
function parseOxViewString(s) {
    let sysStartId = systems.length;
    const createdSystems = [];
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
            createdSystems.push(sys);
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
                    e.sid = sidCounter++;
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
                    elementData.createdElement = e;
                });
            });
            sysData.createdSystem = sys;
            sys.initInstances(sidCounter);
            systems.push(sys);
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
            sysData.createdSystem.fillDefaultColors(); // do this here after strands have been connected
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
    if (createdSystems.length > 1) {
        notify("Warning additional files only affect the last file in a multi-system file", "warning");
    }
    return createdSystems[createdSystems.length - 1]; // for aux reader purposes, there can only be one system created.
}
// Read an mgl file
const MGL_SCALE = 1;
function readMGL(file) {
    notify("Warning: MGL will render but it's not interactive", "warning");
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
    // initialize System
    let startID = elements.getNextId();
    var sys = new System(systems.length, startID);
    reader.onload = () => {
        const pdbLines = reader.result.split(/[\n]+/g);
        // feed pdbLines into worker
        let transfer = [pdbLines, pdbFileInfo.length, elements.getNextId(), systems.length];
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
    return (sys);
}
