/// <reference path="../typescript_definitions/index.d.ts" />
class File2reader {
    file;
    type;
    reader;
    constructor(file, type, reader) {
        this.file = file;
        this.type = type;
        this.reader = reader;
    }
}
class oxFileReader extends FileReader {
    promise;
    constructor(parser) {
        super();
        this.promise = new Promise(function (resolve, reject) {
            this.onload = () => {
                let f = this.result;
                let result = parser(f);
                resolve(result);
            };
        }.bind(this));
    }
}
// Generic function to connect a file to a reader
async function parseFileWith(file, parser) {
    let reader = new oxFileReader(parser);
    reader.readAsText(file);
    let result = await reader.promise;
    return result;
}
// organizes files into files that create a new system, auxiliary files, and script files.
// Then fires the reads sequentially
function handleFiles(files) {
    const systemFiles = [];
    const auxFiles = [];
    const scriptFiles = [];
    // Nasty "switch" statement
    const filesLen = files.length;
    for (let i = 0; i < filesLen; i++) {
        const fileName = files[i].name.toLowerCase();
        const ext = fileName.split('.').pop();
        // These file types lead to creation of a new system
        if (ext == 'top') {
            systemFiles.push(new File2reader(files[i], 'topology', readTop)); // works
        }
        else if (ext === "oxview") {
            systemFiles.push(new File2reader(files[i], 'oxview', readOxViewFile)); //works
        }
        else if (ext === "pdb" || ext === "pdb1" || ext === "pdb2") { // normal pdb and biological assemblies (.pdb1, .pdb2)
            systemFiles.push(new File2reader(files[i], 'pdb', readPdbFile)); // works
        }
        else if (ext === "unf") {
            systemFiles.push(new File2reader(files[i], 'unf', readUNFString));
        }
        else if (ext === "xyz") {
            systemFiles.push(new File2reader(files[i], 'xyz', readXYZString));
        }
        else if (ext === "mgl") {
            systemFiles.push(new File2reader(files[i], 'mgl', readMGL)); //HELP!
        }
        // These file types modify an existing system
        else if (ext == 'dat' || ext == 'conf' || ext == 'oxdna') {
            auxFiles.push(new File2reader(files[i], 'trajectory', readTraj));
        }
        else if (ext === "json") {
            auxFiles.push(new File2reader(files[i], 'json', readJson));
        }
        else if (ext === "txt" && (fileName.includes("trap") || fileName.includes("force"))) {
            auxFiles.push(new File2reader(files[i], 'force', readTrap));
        }
        else if (ext === "txt" && (fileName.includes("_m"))) {
            auxFiles.push(new File2reader(files[i], 'mass', readMassFile));
        }
        else if (ext === "txt" && (fileName.includes("select"))) {
            auxFiles.push(new File2reader(files[i], 'select', readSelectFile));
        }
        else if (ext === "cam") {
            auxFiles.push(new File2reader(files[i], 'camera', readCamFile));
        }
        else if (ext === "csv") {
            auxFiles.push(new File2reader(files[i], 'csv', handleCSV));
        }
        else if (ext === "idx") {
            auxFiles.push(new File2reader(files[i], 'select', readSelectFile));
        }
        else if (ext === "par") {
            auxFiles.push(new File2reader(files[i], 'par', readParFile));
        }
        else if (ext === "hb") {
            auxFiles.push(new File2reader(files[i], 'hb', readHBondFile));
        }
        else if (fileName.includes("particles") || fileName.includes("loro") || fileName.includes("matrix")) {
            auxFiles.push(new File2reader(files[i], 'particle', parseFileWith)); //HELP!
        }
        else if (fileName.includes("patches")) {
            auxFiles.push(new File2reader(files[i], 'patch', parseFileWith)); //HELP!
        }
        // Who knows what a script might do
        else if (ext == "js") {
            scriptFiles.push(new File2reader(files[i], 'topology', readScriptFile));
        }
        //idk what to do with this one
        // everything else is read in the context of other files so we need to check what we have.
        //else if (
        //    ext === "patchspec" ||
        //    fileName.match(/p_my\w+\.dat/g) // Why do multiple files need to end with dat?
        //) {
        //    if (loroPatchFiles == undefined){
        //        loroPatchFiles = [];
        //    }
        //    loroPatchFiles.push(files[i]);
        //}
    }
    function makeSystem() {
        return new Promise(function (resolve, reject) {
            let system;
            if (systemFiles.length == 0) {
                system = systems[systems.length - 1];
            }
            else if (systemFiles.length == 1) {
                system = systemFiles[0].reader(systemFiles[0].file);
            }
            else {
                throw new Error("Systems must be defined by a single file!");
            }
            resolve(system);
        });
    }
    function readAuxiliaryFiles(system) {
        return new Promise(function (resolve, reject) {
            let readList = auxFiles.map((auxFile) => {
                return new Promise(function (resolve, reject) {
                    auxFile.reader(auxFile.file, system);
                    resolve(system);
                });
            });
            let toWait = Promise.all(readList);
            resolve(toWait);
        });
    }
    function executeScript() { }
    makeSystem().then((system) => readAuxiliaryFiles(system).then((() => executeScript())));
}
function readError() {
    notify("Oh no!", 'error');
}
function readSuccess() {
    notify("Yay!");
}
let initFileReading = true; // dirty hack to keep the event handling in check 
let handledScript = false;
// addEventListener is outside function so multiple EventListeners aren't created, which bugs the function
//document.addEventListener('setupComplete', readAuxiliaryFiles);
// Now that the files are identified, make sure the files are the correct ones and begin the reading process
//function readFiles(topFile: File, datFile: File, idxFile:File, pdbFile?: File, particleFile?: File, patchFile?: File, loroPatchFiles?: File[], scriptFile?:File,) {
//    
//    if(initFileReading){
//        // TODO: apart from a drastic rewrite... 
//        // Figure out if any other places have the bug of adding N event handlers ...
//        //setupComplete fires when indexing arrays are finished being set up
//        //prevents async issues with par and overlay files
//        
//        //document.addEventListener('setupComplete', readAuxiliaryFiles);
//        
//        document.addEventListener('setupComplete', ()=>{
//            if(scriptFile && !handledScript){
//                
//                readScriptFile(scriptFile);
//            }
//        });
//
//        initFileReading = false;
//    }
//    
//    if (topFile && datFile) {
//        renderer.domElement.style.cursor = "wait";
//
//        if(typeof loroPatchFiles !== "undefined" || typeof particleFile !== "undefined"){
//            //make system to store the dropped files in
//            const system = new PatchySystem(
//                sysCount, particleFile, patchFile, 
//                loroPatchFiles, (callback)=>
//            {
//                //we handle patchy files
//                const patchyTopologyReader = new PatchyTopReader(topFile, system, elements,()=>{
//                    //fire dat file read from inside top file reader to make sure they don't desync (large protein files will cause a desync)
//                    trajReader = new TrajectoryReader(datFile, system);
//                    trajReader.indexTrajectory();
//
//                    //set up patchy instancing data arrays
//                    system.initPatchyInstances();
//
//                    callback();
//                });
//                patchyTopologyReader.read();
//            });
//            systems.push(system); //add system to Systems[]
//        } else {
//            //make system to store the dropped files in
//            const system = new System(sysCount, elements.getNextId());
//            systems.push(system); //add system to Systems[]
//            //TODO: is this really neaded?
//            system.setDatFile(datFile); //store datFile in current System object
//            if(!idxFile){
//                //read topology file, the configuration file is read once the topology is loaded to avoid async errors
//                //const topReader = new TopReader(topFile, system, elements,()=>{
//                //    //fire dat file read from inside top file reader to make sure they don't desync (large protein files will cause a desync)
//                //    trajReader = new TrajectoryReader(datFile,system);
//                //    trajReader.indexTrajectory();
//    //
//                //    //set up instancing data arrays
//                //    system.initInstances(system.systemLength());
//                //});
//                //topReader.read();
//            }
//            else{
//                console.log("index provided");
//                const idxReader = new FileReader(); //read .json
//                //idxReader.onload = () => {
//                //    let file = idxReader.result as string;
//                //    let indexes = JSON.parse(file);
//    //
//                //    const topReader = new TopReader(topFile, system, elements,()=>{
//                //        //fire dat file read from inside top file reader to make sure they don't desync (large protein files will cause a desync)
//                //        trajReader = new TrajectoryReader(datFile,system,indexes);
//                //        trajReader.nextConfig();
//                //        //set up instancing data arrays
//                //        system.initInstances(system.systemLength());
//                //    });
//                //    topReader.read();
//                //};
//                idxReader.readAsText(idxFile);
//            }
//        }
//        return;
//    }
//    else if (pdbFile) {
//        readPdbFile(pdbFile);
//        //document.addEventListener('setupComplete', readAuxiliaryFiles)
//        return;
//    }
//    else {
//        readAuxiliaryFiles();
//    }        
//    
//    // now due to async issues this will fire whenever, 
//    // but that's better than not at all 
//    if(scriptFile  && !handledScript){
//        readScriptFile(scriptFile);
//    }
//
//    render();
//    return;
//}
//function readAuxiliaryFiles() {
//    // This is super haunted
//    // up to this point, jsonFile was either undeclared or declared and undefined
//    // Suddenly, here, it's defined as the existing old file.
//    
//    const topFile = auxiliaryFiles.topFile;
//    const datFile = auxiliaryFiles.datFile;
//    const jsonFile = auxiliaryFiles.jsonFile;
//    const trapFile = auxiliaryFiles.trapFile;
//    const parFile = auxiliaryFiles.parFile;
//    const hbFile = auxiliaryFiles.hbFile;
//    const massFile = auxiliaryFiles.massFile;
//    const selectFile = auxiliaryFiles.selectFile;
//    
//    // if .top, .dat, and .json file are dragged on, the json file is only read on the new system
//    if (jsonFile && topFile && datFile) {
//        const jsonReader = new FileReader(); //read .json
//        jsonReader.onload = () => {
//            readJson(systems[systems.length - 1], jsonReader);
//        };
//        jsonReader.readAsText(jsonFile);
//    }
//    else if (jsonFile) {
//        const jsonReader = new FileReader(); //read .json
//        jsonReader.onload = () => {
//            systems.forEach( (system) => {
//                readJson(system, jsonReader);
//            });
//        };
//        jsonReader.readAsText(jsonFile);
//    }
//
//    if (trapFile) {
//        const trapReader = new FileReader(); //read .trap file
//        trapReader.onload = () => {
//            readTrap(trapReader);
//        };
//        trapReader.readAsText(trapFile);
//    }
//
//    if (parFile) {
//        let parReader = new FileReader();
//        parReader.onload = () => {
//            readParFile(systems[systems.length - 1], parReader)
//        };
//        parReader.readAsText(parFile)
//    }
//    if (datFile && !topFile) {
//        const r = new FileReader();
//        r.onload = ()=> {
//            updateConfFromFile(r.result as string);
//        }
//        r.readAsText(datFile);
//    }
//    if (hbFile){
//        const r = new FileReader();
//        r.onload = ()=> {
//            readHBondFile(hbFile);
//        }
//        r.readAsText(hbFile);
//    }
//    if (massFile){
//        const r = new FileReader();
//        r.onload = ()=> {
//            readMassFile(r);
//        }
//        r.readAsText(massFile);
//    }
//    if (selectFile){
//        const r = new FileReader();
//        r.onload = () => {
//            readSelectFile(r);
//        }
//        r.readAsText(selectFile);
//    }
//    //document.removeEventListener('setupComplete', readAuxiliaryFiles);
//}
//
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
