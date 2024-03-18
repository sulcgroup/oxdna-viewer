function handleFiles(files) {
    const filesLen = files.length;
    let datFile, topFile, jsonFile, trapFile, parFile, idxFile, hbFile, pdbFile, massFile, particleFile, patchFile, loroPatchFiles, scriptFile, selectFile; //this sets them all to undefined.
    // assign files to the extentions
    for (let i = 0; i < filesLen; i++) {
        // get file extension
        const fileName = files[i].name.toLowerCase();
        const ext = fileName.split('.').pop();
        // oxview files had better be dropped alone because that's all that's loading.
        if (ext === "oxview") {
            parseFileWith(files[i], readOxViewString);
            return;
        }
        else if (ext === "cam") {
            readCamFile(files[i]);
            return;
        }
        else if (ext == "js") {
            scriptFile = files[i];
            //readScriptFile(files[i]);
            //return;
        }
        else if (ext === "mgl") {
            readMGL(files[i]);
            return;
        }
        else if (ext === "pdb" || ext === "pdb1" || ext === "pdb2") { // normal pdb and biological assemblies (.pdb1, .pdb2)
            pdbFile = files[i];
        }
        else if (ext === "unf") {
            parseFileWith(files[i], readUNFString);
            return;
        }
        else if (ext === "xyz") {
            parseFileWith(files[i], readXYZString);
            return;
        }
        else if (ext === "csv") {
            handleCSV(files[i]);
            return;
        }
        // everything else is read in the context of other files so we need to check what we have.
        else if (ext === "patchspec" ||
            fileName.match(/p_my\w+\.dat/g) // Why do multiple files need to end with dat?
        ) {
            if (loroPatchFiles == undefined) {
                loroPatchFiles = [];
            }
            loroPatchFiles.push(files[i]);
        }
        else if (["dat", "conf", "oxdna"].includes(ext))
            datFile = files[i];
        else if (ext === "top")
            topFile = files[i];
        else if (ext === "json")
            jsonFile = files[i];
        else if (fileName.includes("particles") || fileName.includes("loro") || fileName.includes("matrix"))
            particleFile = files[i];
        else if (fileName.includes("patches"))
            patchFile = files[i];
        else if (ext === "txt" && (fileName.includes("trap") || fileName.includes("force")))
            trapFile = files[i];
        else if (ext === "txt" && (fileName.includes("_m")))
            massFile = files[i];
        else if (ext === "txt" && (fileName.includes("select")))
            selectFile = files[i];
        else if (ext === "idx")
            idxFile = files[i];
        else if (ext === "par")
            parFile = files[i];
        else if (ext === "hb")
            hbFile = files[i];
        // otherwise, what is this?
        else {
            notify("This reader uses file extensions to determine file type.\nRecognized extensions are: .conf, .dat, .oxdna, .top, .json, .par, .pdb, .mgl, .xyz, and trap.txt\nPlease drop one .dat/.conf/.oxdna and one .top file.  Additional data files can be added at the time of load or dropped later.");
            return;
        }
    }
    // If a new system is being loaded, there will be a dat and top file pair
    let newSystem = datFile && topFile || pdbFile;
    // Additional information can be dropped in later
    let datAlone = datFile && !topFile;
    let trapAlone = trapFile && !topFile;
    let jsonAlone = jsonFile && !topFile;
    let parAlone = parFile && !topFile;
    let hbAlone = hbFile; // Can't think of any situation where (it would make any sense) for a hb file to be dropped with any other file
    let selectAlone = selectFile && !topFile;
    let addition = datAlone || trapAlone || jsonAlone || parAlone || hbAlone || selectAlone;
    if ((!newSystem && !addition) || (addition && systems.length == 0)) {
        notify("Unrecognized file combination. Please drag and drop 1 .dat and 1 .top file to load a new system or an overlay file to add information to an already loaded system.");
    }
    // same dirty logic as the event fix 
    // we ensure this way that the script is not handeled 2ce
    handledScript = false;
    // set list of auxiliary files for the readAuxiliaryFiles function
    setAuxiliaryFiles(topFile, datFile, jsonFile, trapFile, hbFile, massFile, parFile, selectFile);
    //read a topology/configuration pair and whatever else
    readFiles(topFile, datFile, idxFile, pdbFile, particleFile, patchFile, loroPatchFiles, scriptFile);
    render();
    return;
}
// auxiliary files array for readAuxiliaryFiles function
let auxiliaryFiles = {};
function setAuxiliaryFiles(topFile, datFile, jsonFile, trapFile, hbFile, massFile, parFile, selectFile) {
    auxiliaryFiles.topFile = topFile;
    auxiliaryFiles.datFile = datFile;
    auxiliaryFiles.jsonFile = jsonFile;
    auxiliaryFiles.trapFile = trapFile;
    auxiliaryFiles.hbFile = hbFile;
    auxiliaryFiles.massFile = massFile;
    auxiliaryFiles.parFile = parFile;
    auxiliaryFiles.selectFile = selectFile;
}
let initFileReading = true; // dirty hack to keep the event handling in check 
let handledScript = false;
// addEventListener is outside function so multiple EventListeners aren't created, which bugs the function
document.addEventListener('setupComplete', readAuxiliaryFiles);
// Now that the files are identified, make sure the files are the correct ones and begin the reading process
function readFiles(topFile, datFile, idxFile, pdbFile, particleFile, patchFile, loroPatchFiles, scriptFile) {
    if (initFileReading) {
        // TODO: apart from a drastic rewrite... 
        // Figure out if any other places have the bug of adding N event handlers ...
        //setupComplete fires when indexing arrays are finished being set up
        //prevents async issues with par and overlay files
        //document.addEventListener('setupComplete', readAuxiliaryFiles);
        document.addEventListener('setupComplete', () => {
            if (scriptFile && !handledScript) {
                readScriptFile(scriptFile);
            }
        });
        initFileReading = false;
    }
    if (topFile && datFile) {
        renderer.domElement.style.cursor = "wait";
        if (typeof loroPatchFiles !== "undefined" || typeof particleFile !== "undefined") {
            //make system to store the dropped files in
            const system = new PatchySystem(sysCount, particleFile, patchFile, loroPatchFiles, (callback) => {
                //we handle patchy files
                const patchyTopologyReader = new PatchyTopReader(topFile, system, elements, () => {
                    //fire dat file read from inside top file reader to make sure they don't desync (large protein files will cause a desync)
                    trajReader = new TrajectoryReader(datFile, patchyTopologyReader, system, elements);
                    trajReader.indexTrajectory();
                    //set up patchy instancing data arrays
                    system.initPatchyInstances();
                    callback();
                });
                patchyTopologyReader.read();
            });
            systems.push(system); //add system to Systems[]
        }
        else {
            //make system to store the dropped files in
            const system = new System(sysCount, elements.getNextId());
            systems.push(system); //add system to Systems[]
            //TODO: is this really neaded?
            system.setDatFile(datFile); //store datFile in current System object
            if (!idxFile) {
                //read topology file, the configuration file is read once the topology is loaded to avoid async errors
                const topReader = new TopReader(topFile, system, elements, () => {
                    //fire dat file read from inside top file reader to make sure they don't desync (large protein files will cause a desync)
                    trajReader = new TrajectoryReader(datFile, topReader, system, elements);
                    trajReader.indexTrajectory();
                    //set up instancing data arrays
                    system.initInstances(system.systemLength());
                });
                topReader.read();
            }
            else {
                console.log("index provided");
                const idxReader = new FileReader(); //read .json
                idxReader.onload = () => {
                    let file = idxReader.result;
                    let indexes = JSON.parse(file);
                    const topReader = new TopReader(topFile, system, elements, () => {
                        //fire dat file read from inside top file reader to make sure they don't desync (large protein files will cause a desync)
                        trajReader = new TrajectoryReader(datFile, topReader, system, elements, indexes);
                        trajReader.nextConfig();
                        //set up instancing data arrays
                        system.initInstances(system.systemLength());
                    });
                    topReader.read();
                };
                idxReader.readAsText(idxFile);
            }
        }
        return;
    }
    else if (pdbFile) {
        readPdbFile(pdbFile);
        //document.addEventListener('setupComplete', readAuxiliaryFiles)
        return;
    }
    else {
        readAuxiliaryFiles();
    }
    // now due to async issues this will fire whenever, 
    // but that's better than not at all 
    if (scriptFile && !handledScript) {
        readScriptFile(scriptFile);
    }
    render();
    return;
}
function readAuxiliaryFiles() {
    // This is super haunted
    // up to this point, jsonFile was either undeclared or declared and undefined
    // Suddenly, here, it's defined as the existing old file.
    const topFile = auxiliaryFiles.topFile;
    const datFile = auxiliaryFiles.datFile;
    const jsonFile = auxiliaryFiles.jsonFile;
    const trapFile = auxiliaryFiles.trapFile;
    const parFile = auxiliaryFiles.parFile;
    const hbFile = auxiliaryFiles.hbFile;
    const massFile = auxiliaryFiles.massFile;
    const selectFile = auxiliaryFiles.selectFile;
    // if .top, .dat, and .json file are dragged on, the json file is only read on the new system
    if (jsonFile && topFile && datFile) {
        const jsonReader = new FileReader(); //read .json
        jsonReader.onload = () => {
            readJson(systems[systems.length - 1], jsonReader);
        };
        jsonReader.readAsText(jsonFile);
    }
    else if (jsonFile) {
        const jsonReader = new FileReader(); //read .json
        jsonReader.onload = () => {
            systems.forEach((system) => {
                readJson(system, jsonReader);
            });
        };
        jsonReader.readAsText(jsonFile);
    }
    if (trapFile) {
        const trapReader = new FileReader(); //read .trap file
        trapReader.onload = () => {
            readTrap(trapReader);
        };
        trapReader.readAsText(trapFile);
    }
    if (parFile) {
        let parReader = new FileReader();
        parReader.onload = () => {
            readParFile(systems[systems.length - 1], parReader);
        };
        parReader.readAsText(parFile);
    }
    if (datFile && !topFile) {
        const r = new FileReader();
        r.onload = () => {
            updateConfFromFile(r.result);
        };
        r.readAsText(datFile);
    }
    if (hbFile) {
        const r = new FileReader();
        r.onload = () => {
            readHBondFile(hbFile);
        };
        r.readAsText(hbFile);
    }
    if (massFile) {
        const r = new FileReader();
        r.onload = () => {
            readMassFile(r);
        };
        r.readAsText(massFile);
    }
    if (selectFile) {
        const r = new FileReader();
        r.onload = () => {
            readSelectFile(r);
        };
        r.readAsText(selectFile);
    }
    //document.removeEventListener('setupComplete', readAuxiliaryFiles);
}
function addSystemToScene(system) {
    // If you make any modifications to the drawing matricies here, they will take effect before anything draws
    // however, if you want to change once stuff is already drawn, you need to add "<attribute>.needsUpdate" before the render() call.
    // This will force the gpu to check the vectors again when redrawing.
    if (system.isPatchySystem()) {
        // Patchy particle geometries
        let s = system;
        if (s.species !== undefined) {
            const patchResolution = 4; // Number of points defining each patch
            const patchWidth = 0.2; // Radius of patch "circle"
            const patchAlignWidth = 0.3; // Widest radius of patch circle
            // (indicating patch alignment)
            s.patchyGeometries = s.offsets.map((_, i) => {
                let g = new THREE.InstancedBufferGeometry();
                const points = [new THREE.Vector3()];
                s.species[i].patches.forEach(patch => {
                    // Need to invert y and z axis for mysterious reasons
                    const pos = patch.position.clone();
                    pos.y *= -1;
                    pos.z *= -1;
                    let a1 = patch.a1.clone();
                    a1.y *= -1;
                    a1.z *= -1;
                    let a2 = patch.a2.clone();
                    a2.y *= -1;
                    a2.z *= -1;
                    let aw = patchAlignWidth;
                    // Too many patches.txt files fail to set a1 and a2 correctly.
                    if (Math.abs(a1.dot(a2)) > 1e-5) {
                        console.warn(`The a1 and a2 vectors are incorrectly defined in species ${i}. Using patch position instead`);
                        a1 = pos.clone();
                        a1.normalize();
                        // Create a2 vector othogonal to a1
                        for (let i of [0, 1, 2]) {
                            let v = new THREE.Vector3();
                            v.setComponent(i, 1);
                            v.projectOnPlane(a1);
                            v.normalize();
                            if (v.length() > 0) {
                                a2.copy(v);
                                break;
                            }
                        }
                        console.assert(a2.length() > 0);
                        aw = patchWidth; // Remove alignment protrusion
                    }
                    for (let i = 0; i < patchResolution; i++) {
                        let diff = a2.clone().multiplyScalar(i == 0 ? aw : patchWidth);
                        diff.applyAxisAngle(a1, i * 2 * Math.PI / patchResolution);
                        points.push(pos.clone().add(diff));
                    }
                });
                let particleGeometry = new THREE.ConvexGeometry(points);
                g.copy(particleGeometry);
                return g;
            });
        }
        else {
            s.patchyGeometries = s.offsets.map(_ => {
                let g = new THREE.InstancedBufferGeometry();
                g.copy(new THREE.SphereBufferGeometry(.5, 10, 10));
                return g;
            });
        }
        s.patchyGeometries.forEach((g, i) => {
            g.addAttribute('instanceOffset', new THREE.InstancedBufferAttribute(s.offsets[i], 3));
            g.addAttribute('instanceRotation', new THREE.InstancedBufferAttribute(s.rotations[i], 4));
            g.addAttribute('instanceScale', new THREE.InstancedBufferAttribute(s.scalings[i], 3));
            g.addAttribute('instanceColor', new THREE.InstancedBufferAttribute(s.colors[i], 3));
            g.addAttribute('instanceVisibility', new THREE.InstancedBufferAttribute(s.visibilities[i], 3));
        });
        // Those were geometries, the mesh is actually what gets drawn
        s.patchyMeshes = s.patchyGeometries.map(g => {
            const mesh = new THREE.Mesh(g, instanceMaterial);
            //you have to turn off culling because instanced materials all exist at (0, 0, 0)
            mesh.frustumCulled = false;
            scene.add(mesh);
            return mesh;
        });
        // Picking
        s.pickingMeshes = s.patchyGeometries.map((g, i) => {
            const pickingGeometry = g.clone();
            pickingGeometry.addAttribute('instanceColor', new THREE.InstancedBufferAttribute(s.labels[i], 3));
            pickingGeometry.addAttribute('instanceOffset', new THREE.InstancedBufferAttribute(s.offsets[i], 3));
            pickingGeometry.addAttribute('instanceVisibility', new THREE.InstancedBufferAttribute(s.visibilities[i], 3));
            const pickingMesh = new THREE.Mesh(pickingGeometry, pickingMaterial);
            pickingMesh.frustumCulled = false;
            return pickingMesh;
        });
        s.pickingMeshes.forEach(m => {
            pickingScene.add(m);
        });
    }
    else {
        // Classic nucleic acid geometries
        // Add the geometries to the systems
        system.backboneGeometry = instancedBackbone.clone();
        system.nucleosideGeometry = instancedNucleoside.clone();
        system.connectorGeometry = instancedConnector.clone();
        system.spGeometry = instancedBBconnector.clone();
        system.pickingGeometry = instancedBackbone.clone();
        // Feed data arrays to the geometries
        system.backboneGeometry.addAttribute('instanceOffset', new THREE.InstancedBufferAttribute(system.bbOffsets, 3));
        system.backboneGeometry.addAttribute('instanceRotation', new THREE.InstancedBufferAttribute(system.bbRotation, 4));
        system.backboneGeometry.addAttribute('instanceColor', new THREE.InstancedBufferAttribute(system.bbColors, 3));
        system.backboneGeometry.addAttribute('instanceScale', new THREE.InstancedBufferAttribute(system.scales, 3));
        system.backboneGeometry.addAttribute('instanceVisibility', new THREE.InstancedBufferAttribute(system.visibility, 3));
        system.nucleosideGeometry.addAttribute('instanceOffset', new THREE.InstancedBufferAttribute(system.nsOffsets, 3));
        system.nucleosideGeometry.addAttribute('instanceRotation', new THREE.InstancedBufferAttribute(system.nsRotation, 4));
        system.nucleosideGeometry.addAttribute('instanceColor', new THREE.InstancedBufferAttribute(system.nsColors, 3));
        system.nucleosideGeometry.addAttribute('instanceScale', new THREE.InstancedBufferAttribute(system.nsScales, 3));
        system.nucleosideGeometry.addAttribute('instanceVisibility', new THREE.InstancedBufferAttribute(system.visibility, 3));
        system.connectorGeometry.addAttribute('instanceOffset', new THREE.InstancedBufferAttribute(system.conOffsets, 3));
        system.connectorGeometry.addAttribute('instanceRotation', new THREE.InstancedBufferAttribute(system.conRotation, 4));
        system.connectorGeometry.addAttribute('instanceColor', new THREE.InstancedBufferAttribute(system.bbColors, 3));
        system.connectorGeometry.addAttribute('instanceScale', new THREE.InstancedBufferAttribute(system.conScales, 3));
        system.connectorGeometry.addAttribute('instanceVisibility', new THREE.InstancedBufferAttribute(system.visibility, 3));
        system.spGeometry.addAttribute('instanceOffset', new THREE.InstancedBufferAttribute(system.bbconOffsets, 3));
        system.spGeometry.addAttribute('instanceRotation', new THREE.InstancedBufferAttribute(system.bbconRotation, 4));
        system.spGeometry.addAttribute('instanceColor', new THREE.InstancedBufferAttribute(system.bbColors, 3));
        system.spGeometry.addAttribute('instanceScale', new THREE.InstancedBufferAttribute(system.bbconScales, 3));
        system.spGeometry.addAttribute('instanceVisibility', new THREE.InstancedBufferAttribute(system.visibility, 3));
        system.pickingGeometry.addAttribute('instanceColor', new THREE.InstancedBufferAttribute(system.bbLabels, 3));
        system.pickingGeometry.addAttribute('instanceOffset', new THREE.InstancedBufferAttribute(system.bbOffsets, 3));
        system.pickingGeometry.addAttribute('instanceVisibility', new THREE.InstancedBufferAttribute(system.visibility, 3));
        // Those were geometries, the mesh is actually what gets drawn
        system.backbone = new THREE.Mesh(system.backboneGeometry, instanceMaterial);
        system.backbone.frustumCulled = false; //you have to turn off culling because instanced materials all exist at (0, 0, 0)
        system.nucleoside = new THREE.Mesh(system.nucleosideGeometry, instanceMaterial);
        system.nucleoside.frustumCulled = false;
        system.connector = new THREE.Mesh(system.connectorGeometry, instanceMaterial);
        system.connector.frustumCulled = false;
        system.bbconnector = new THREE.Mesh(system.spGeometry, instanceMaterial);
        system.bbconnector.frustumCulled = false;
        system.dummyBackbone = new THREE.Mesh(system.pickingGeometry, pickingMaterial);
        system.dummyBackbone.frustumCulled = false;
        // Add everything to the scene (if they are toggled)
        view.setPropertyInScene('backbone', system);
        view.setPropertyInScene('nucleoside', system);
        view.setPropertyInScene('connector', system);
        view.setPropertyInScene('bbconnector', system);
        pickingScene.add(system.dummyBackbone);
    }
    // Let the other file readers know that it's safe to reference system properties
    document.dispatchEvent(new Event('setupComplete'));
    // Reset the cursor from the loading spinny and reset canvas focus
    renderer.domElement.style.cursor = "auto";
    if (!inIframe()) {
        canvas.focus();
    }
}
