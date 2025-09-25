/// <reference path="../typescript_definitions/index.d.ts" />

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////                Figure out how to read files                ////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

// An object which connects a file to the function which can parse its contents
class File2reader {
    file: File;
    type: string;
    reader: Function;

    constructor(file, type, reader) {
        this.file = file;
        this.type = type;
        this.reader = reader;
    }
} 

// Generic file reader which wraps its onload function in a promise
// This can be used with async await to force serial execution
class oxFileReader extends FileReader {
    promise:Promise<unknown>

    constructor(parser:Function) {
        super();
        this.promise = new Promise (function (resolve, reject) {
            this.onload = () => {
                let f = this.result as string
                let result = parser(f, ...parser['args'])
                resolve(result) // This passes the result of the parser up through parseFilesWith
            }
        }.bind(this))
    }
}

// Generic function to connect a text file to a reader to the correct parser
function parseFileWith(file: File, parser: Function, args:unknown[]=[]): Promise<unknown> {
    parser['args'] = args
    let reader = new oxFileReader(parser);
    reader.readAsText(file);
    let result = reader.promise
    return result
}

// organizes files into files that create a new system, auxiliary files, and script files.
// Then fires the reads sequentially
async function handleFiles(files: File[]) {
    renderer.domElement.style.cursor = "wait";
    const systemFiles:File2reader[] = [];
    const systemHelpers:Object = {}; // These can be named whatever.
    const auxFiles:File2reader[] = [];
    const scriptFiles:File2reader[] = [];

    // Nasty "switch" statement.  
    // The file will be assigned to the first reader it matches.
    // This is because some people name their particle files "particles.dat".
    const filesLen = files.length;
    for (let i = 0; i < filesLen; i++) {
        const fileName = files[i].name.toLowerCase();
        const ext = fileName.split('.').pop();

        // These file types lead to creation of a new system(s)
        if      (ext === 'top') { systemFiles.push(new File2reader(files[i], 'topology', await identifyTopologyParser(files[i]))); } 
        else if (ext === "oxview") { systemFiles.push(new File2reader(files[i], 'oxview', readOxViewFile)); }
        else if (ext === "pdb" || ext === "pdb1" || ext === "pdb2") { systemFiles.push(new File2reader(files[i], 'pdb', readPdbFile)); } 
        else if (ext === "unf") { systemFiles.push(new File2reader(files[i], 'unf', readUNFFile)); } 
        else if (ext === "xyz") { systemFiles.push(new File2reader(files[i], 'xyz', readXYZFile)); } 
        else if (ext === "mgl") { systemFiles.push(new File2reader(files[i], 'mgl', readMGL)); }  

        // Patchy files are special and are needed at system creation time
        else if (fileName.includes("particles") || fileName.includes("loro") || fileName.includes("matrix")) { systemHelpers["particles"] = files[i]; } 
        else if (fileName.includes("patches")) { systemHelpers["patches"] = files[i]; } 
        else if (ext === "patchspec" || fileName.match(/p_my\w+\.dat/g)) { (systemHelpers["loroPatchFiles"] == undefined) ? systemHelpers["loroPatchFiles"] = [files[i]]: systemHelpers["loroPatchFiles"].push(files[i])}

        // These file types modify an existing system
        else if (ext == 'dat' || ext == 'conf' || ext == 'oxdna') { auxFiles.push(new File2reader(files[i], 'trajectory', readTraj)); }
        else if (ext === "json") { auxFiles.push(new File2reader(files[i], 'json', readJson)); }
        else if (ext === "txt" && (fileName.includes("trap") || fileName.includes("force") )) { auxFiles.push(new File2reader(files[i], 'force', readForce)); }
        else if (ext === "txt" && (fileName.includes("_m"))) { auxFiles.push(new File2reader(files[i], 'mass', readMassFile)); }
        else if (ext === "txt" && (fileName.includes("select"))) { auxFiles.push(new File2reader(files[i], 'select', readSelectFile)); }
        else if (ext === "cam") { auxFiles.push(new File2reader(files[i], 'camera', readCamFile)); }
        else if (ext === "csv") { auxFiles.push(new File2reader(files[i], 'csv', handleCSV)); }
        else if (ext === "idx") { auxFiles.push(new File2reader(files[i], 'select', readSelectFile)); }
        else if (ext === "par") { auxFiles.push(new File2reader(files[i], 'par', readParFile)); }
        else if (ext === "hb")  { auxFiles.push(new File2reader(files[i], 'hb', readHBondFile)); }
        else if (ext==="db")    { auxFiles.push(new File2reader(files[i], 'db', readDotBracket)); }

        // Who knows what a script might do
        else if (ext=="js"){ scriptFiles.push(new File2reader(files[i], 'script', readScriptFile)); }
    }

    // Create a system from a file and resolve with a reference to the system
    function getOrMakeSystem() {
        return new Promise<System> (function (resolve, reject) {
            if (systemFiles.length == 0) { resolve(systems[systems.length-1]) } // If we're not making a new system
            else if (systemFiles.length == 1) {
                const sysPromise = systemFiles[0].reader(systemFiles[0].file, systemHelpers);
                sysPromise.then((system) => resolve(system))
            } // If we're reading a file to make a system
            else {throw new Error("Systems must be defined by a single file (there can be helper files)!")}
        });
    }

    function readAuxiliaryFiles(system) {
        let readList:Promise<unknown>[] = auxFiles.map((auxFile) => 
            new Promise(function (resolve, reject) {
                const result = auxFile.reader(auxFile.file, system);
                resolve(result);
            })
        );
        return Promise.all(readList);
    }

    // Wheeeeeeeee
    function executeScript() {
        let readList:Promise<unknown>[] = scriptFiles.map((scriptFile) =>
            new Promise(function (resolve, reject) {
                readScriptFile(scriptFile.file)
            })
        )
        return Promise.all(readList)
    }

    getOrMakeSystem().then((sys) => readAuxiliaryFiles(sys)).then(() => executeScript())
}

// Create Three geometries and meshes that get drawn in the scene.
async function addSystemToScene(system: System) {
    // If you make any modifications to the drawing matricies here, they will take effect before anything draws
    // however, if you want to change once stuff is already drawn, you need to add "<attribute>.needsUpdate" before the render() call.
    // This will force the gpu to check the vectors again when redrawing.

    if (system.isPatchySystem()) {
        // Patchy particle geometries
        let s = system as PatchySystem;
        await s.ready

        if (s.species !== undefined) {

            const patchResolution = 4; // Number of points defining each patch
            const patchWidth = 0.2; // Radius of patch "circle"
            const patchAlignWidth = 0.3; // Widest radius of patch circle
                                         // (indicating patch alignment)

            s.patchyGeometries = s.offsets.map((_,i)=>{
                let g = new THREE.InstancedBufferGeometry();

                const points = [new THREE.Vector3()];

                s.species[i].patches.forEach(patch=>{
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
                        for (let i of [0,1,2]) {
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
                    for (let i=0; i<patchResolution; i++) {
                        let diff = a2.clone().multiplyScalar(i == 0 ? aw : patchWidth);
                        diff.applyAxisAngle(
                            a1,
                            i * 2*Math.PI/patchResolution
                        );
                        points.push(
                            pos.clone().add(diff)
                        );
                    }

                });
                let particleGeometry = new THREE.ConvexGeometry(points);

                g.copy(particleGeometry as unknown as THREE.InstancedBufferGeometry);
                return g;
            });
        } else {
            s.patchyGeometries = s.offsets.map(_=>{
                let g = new THREE.InstancedBufferGeometry();
                g.copy(new THREE.SphereBufferGeometry(.5,10,10) as unknown as THREE.InstancedBufferGeometry);
                return g;
            });
        }
        s.patchyGeometries.forEach((g,i)=>{
            g.addAttribute('instanceOffset', new THREE.InstancedBufferAttribute(s.offsets[i], 3));
            g.addAttribute('instanceRotation', new THREE.InstancedBufferAttribute(s.rotations[i], 4));
            g.addAttribute('instanceScale', new THREE.InstancedBufferAttribute(s.scalings[i], 3));
            g.addAttribute('instanceColor', new THREE.InstancedBufferAttribute(s.colors[i], 3));
            g.addAttribute('instanceVisibility', new THREE.InstancedBufferAttribute(s.visibilities[i], 3));
        });

        // Those were geometries, the mesh is actually what gets drawn
        s.patchyMeshes = s.patchyGeometries.map(g=>{
            const mesh = new THREE.Mesh(g, instanceMaterial);
            //you have to turn off culling because instanced materials all exist at (0, 0, 0)
            mesh.frustumCulled = false;

            scene.add(mesh);
            return mesh;
        });

        // Picking
        s.pickingMeshes = s.patchyGeometries.map((g,i)=>{
            const pickingGeometry = g.clone();
            pickingGeometry.addAttribute('instanceColor', new THREE.InstancedBufferAttribute(s.labels[i], 3));
            pickingGeometry.addAttribute('instanceOffset', new THREE.InstancedBufferAttribute(s.offsets[i], 3));
            pickingGeometry.addAttribute('instanceVisibility', new THREE.InstancedBufferAttribute(s.visibilities[i], 3));
            const pickingMesh = new THREE.Mesh(pickingGeometry, pickingMaterial);
            pickingMesh.frustumCulled = false;
            return pickingMesh;
        });
        s.pickingMeshes.forEach(m=>{
            pickingScene.add(m);
        });

    } else {
        // Classic nucleic acid geometries

        // Add the geometries to the systems
        system.cmGeometry = instancedBackbone.clone();
        system.backboneGeometry = instancedBackbone.clone();
        system.nucleosideGeometry = instancedNucleoside.clone();
        //system.connectorGeometry = instancedConnector.clone();
        system.connector1Geometry = instancedConnector.clone();
        system.connector2Geometry = instancedConnector.clone()
        system.spGeometry = instancedBBconnector.clone();

        system.pickingGeometry = instancedBackbone.clone();

        // Feed data arrays to the geometries
        system.cmGeometry.addAttribute( 'instanceOffset', new THREE.InstancedBufferAttribute(system.cmOffsets, 3));
        system.cmGeometry.addAttribute( 'instanceRotation', new THREE.InstancedBufferAttribute(system.bbRotation, 4));
        system.cmGeometry.addAttribute( 'instanceColor', new THREE.InstancedBufferAttribute(system.bbColors, 3));
        system.cmGeometry.addAttribute( 'instanceScale', new THREE.InstancedBufferAttribute(system.cmScales, 3 ) );
        system.cmGeometry.addAttribute( 'instanceVisibility', new THREE.InstancedBufferAttribute(system.visibility, 3 ) );

        system.backboneGeometry.addAttribute( 'instanceOffset', new THREE.InstancedBufferAttribute(system.bbOffsets, 3));
        system.backboneGeometry.addAttribute( 'instanceRotation', new THREE.InstancedBufferAttribute(system.bbRotation, 4));
        system.backboneGeometry.addAttribute( 'instanceColor', new THREE.InstancedBufferAttribute(system.bbColors, 3));
        system.backboneGeometry.addAttribute( 'instanceScale', new THREE.InstancedBufferAttribute(system.scales, 3 ) );
        system.backboneGeometry.addAttribute( 'instanceVisibility', new THREE.InstancedBufferAttribute(system.visibility, 3 ) );

        system.nucleosideGeometry.addAttribute( 'instanceOffset', new THREE.InstancedBufferAttribute(system.nsOffsets, 3));
        system.nucleosideGeometry.addAttribute( 'instanceRotation', new THREE.InstancedBufferAttribute(system.nsRotation, 4));
        system.nucleosideGeometry.addAttribute( 'instanceColor', new THREE.InstancedBufferAttribute(system.nsColors, 3));
        system.nucleosideGeometry.addAttribute( 'instanceScale', new THREE.InstancedBufferAttribute(system.nsScales, 3 ) );
        system.nucleosideGeometry.addAttribute( 'instanceVisibility', new THREE.InstancedBufferAttribute(system.visibility, 3 ) );

        //system.connectorGeometry.addAttribute( 'instanceOffset', new THREE.InstancedBufferAttribute(system.conOffsets, 3));
        //system.connectorGeometry.addAttribute( 'instanceRotation', new THREE.InstancedBufferAttribute(system.conRotation, 4));
        //system.connectorGeometry.addAttribute( 'instanceColor', new THREE.InstancedBufferAttribute(system.bbColors, 3));
        //system.connectorGeometry.addAttribute( 'instanceScale', new THREE.InstancedBufferAttribute(system.conScales, 3));
        //system.connectorGeometry.addAttribute( 'instanceVisibility', new THREE.InstancedBufferAttribute(system.visibility, 3 ) );

        system.connector1Geometry.addAttribute( 'instanceOffset', new THREE.InstancedBufferAttribute(system.con1Offsets, 3));
        system.connector1Geometry.addAttribute( 'instanceRotation', new THREE.InstancedBufferAttribute(system.con1Rotation, 4));
        system.connector1Geometry.addAttribute( 'instanceColor', new THREE.InstancedBufferAttribute(system.bbColors, 3));
        system.connector1Geometry.addAttribute( 'instanceScale', new THREE.InstancedBufferAttribute(system.con1Scales, 3));
        system.connector1Geometry.addAttribute( 'instanceVisibility', new THREE.InstancedBufferAttribute(system.visibility, 3 ) );

        system.connector2Geometry.addAttribute( 'instanceOffset', new THREE.InstancedBufferAttribute(system.con2Offsets, 3));
        system.connector2Geometry.addAttribute( 'instanceRotation', new THREE.InstancedBufferAttribute(system.con2Rotation, 4));
        system.connector2Geometry.addAttribute( 'instanceColor', new THREE.InstancedBufferAttribute(system.bbColors, 3));
        system.connector2Geometry.addAttribute( 'instanceScale', new THREE.InstancedBufferAttribute(system.con2Scales, 3));
        system.connector2Geometry.addAttribute( 'instanceVisibility', new THREE.InstancedBufferAttribute(system.visibility, 3 ) );

        system.spGeometry.addAttribute( 'instanceOffset', new THREE.InstancedBufferAttribute(system.bbconOffsets, 3));
        system.spGeometry.addAttribute( 'instanceRotation', new THREE.InstancedBufferAttribute(system.bbconRotation, 4));
        system.spGeometry.addAttribute( 'instanceColor', new THREE.InstancedBufferAttribute(system.bbColors, 3));
        system.spGeometry.addAttribute( 'instanceScale', new THREE.InstancedBufferAttribute(system.bbconScales, 3));
        system.spGeometry.addAttribute( 'instanceVisibility', new THREE.InstancedBufferAttribute(system.visibility, 3 ) );

        system.pickingGeometry.addAttribute( 'instanceColor', new THREE.InstancedBufferAttribute(system.bbLabels, 3));
        system.pickingGeometry.addAttribute( 'instanceOffset', new THREE.InstancedBufferAttribute(system.bbOffsets, 3));
        system.pickingGeometry.addAttribute( 'instanceVisibility', new THREE.InstancedBufferAttribute(system.visibility, 3 ) );

        // Those were geometries, the mesh is actually what gets drawn
        system.cm = new THREE.Mesh(system.cmGeometry, instanceMaterial);
        system.cm.frustumCulled = false;
        
        system.backbone = new THREE.Mesh(system.backboneGeometry, instanceMaterial);
        system.backbone.frustumCulled = false; //you have to turn off culling because instanced materials all exist at (0, 0, 0)

        system.nucleoside = new THREE.Mesh(system.nucleosideGeometry, instanceMaterial);
        system.nucleoside.frustumCulled = false;

        //system.connector = new THREE.Mesh(system.connectorGeometry, instanceMaterial);
        //system.connector.frustumCulled = false;

        system.connector1 = new THREE.Mesh(system.connector1Geometry, instanceMaterial);
        system.connector1.frustumCulled = false;

        system.connector2 = new THREE.Mesh(system.connector2Geometry, instanceMaterial);
        system.connector2.frustumCulled = false;

        system.bbconnector = new THREE.Mesh(system.spGeometry, instanceMaterial);
        system.bbconnector.frustumCulled = false;

        system.dummyBackbone = new THREE.Mesh(system.pickingGeometry, pickingMaterial);
        system.dummyBackbone.frustumCulled = false;

        // Add everything to the scene (if they are toggled)
        view.setPropertyInScene('cm', system);
        view.setPropertyInScene('backbone', system);
        view.setPropertyInScene('nucleoside', system);
        //view.setPropertyInScene('connector', system);
        view.setPropertyInScene('connector1', system);
        view.setPropertyInScene('connector2', system);
        view.setPropertyInScene('bbconnector', system);

        pickingScene.add(system.dummyBackbone);
    }

    // Reset the cursor from the loading spinny and reset canvas focus
    renderer.domElement.style.cursor = "auto";
    if (!inIframe()){
        canvas.focus();
    }
}



