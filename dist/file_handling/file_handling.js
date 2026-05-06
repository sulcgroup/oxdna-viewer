/// <reference path="../typescript_definitions/index.d.ts" />
///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////                Figure out how to read files                ////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
// An object which connects a file to the function which can parse its contents
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
// Generic file reader which wraps its onload function in a promise
// This can be used with async await to force serial execution
class oxFileReader extends FileReader {
    promise;
    constructor(parser) {
        super();
        this.promise = new Promise(function (resolve, reject) {
            this.onload = () => {
                let f = this.result;
                let result = parser(f, ...parser["args"]);
                resolve(result); // This passes the result of the parser up through parseFilesWith
            };
        }.bind(this));
    }
}
// Generic function to connect a text file to a reader to the correct parser
function parseFileWith(file, parser, args = []) {
    parser["args"] = args;
    let reader = new oxFileReader(parser);
    reader.readAsText(file);
    let result = reader.promise;
    return result;
}
async function isVTJEncoded(file) {
    const buf = await file.slice(0, 4).arrayBuffer();
    if (buf.byteLength < 4)
        return false;
    const bytes = new Uint8Array(buf);
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    return magic === "VTJ1";
}
function notifyVTJEncoded(file) {
    console.log(`(VTJ encoded) ${file.name}`);
    if (typeof notify === "function") {
        notify(`(VTJ encoded) ${file.name}`);
    }
}
async function readObservableOutputHeader(file) {
    const buf = await file.slice(0, 8).arrayBuffer();
    if (buf.byteLength < 8)
        return null;
    const bytes = new Uint8Array(buf);
    if (bytes[0] !== 0x4f || // 'O'
        bytes[1] !== 0x58 || // 'X'
        bytes[2] !== 0x44 || // 'D'
        bytes[3] !== 0x01 || // compatibility byte
        bytes[4] !== 0x01 // supported header version
    ) {
        return null;
    }
    return {
        magic: "OXD",
        compatibilityByte: bytes[3],
        version: bytes[4],
        level: bytes[5],
        reserved1: bytes[6],
        reserved2: bytes[7],
    };
}
async function isObservableOutputCompressed(file) {
    const header = await readObservableOutputHeader(file);
    return header !== null;
}
async function decompressZstd(data) {
    const zstdLib = window.fzstd;
    if (!zstdLib || typeof zstdLib.decompress !== "function") {
        throw new Error("zstd decompressor is not loaded. Please include the browser zstd library before uploading .zst files.");
    }
    const result = zstdLib.decompress(data);
    if (result instanceof Uint8Array) {
        return result;
    }
    return new Uint8Array(result);
}
async function decompressObservableOutput(file, system) {
    const header = await readObservableOutputHeader(file);
    if (!header) {
        throw new Error(`File ${file.name} is not a valid oxDNA zstd-compressed observable output`);
    }
    console.log(`Reading zstd-compressed oxDNA output: ${file.name} ` +
        `(header version=${header.version}, zstd level=${header.level})`);
    if (typeof notify === "function") {
        notify(`Reading zstd-compressed oxDNA output: ${file.name} ` +
            `(zstd level ${header.level})`);
    }
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // ObservableOutput writes an 8-byte custom header, then appends
    // zstd-compressed payload.
    const payload = bytes.slice(8);
    const decompressedBytes = await decompressZstd(payload);
    const text = new TextDecoder().decode(decompressedBytes);
    const fakeFile = new File([text], file.name.replace(/\.zst$/i, "").replace(/\.bin$/i, "") + ".dat", { type: "text/plain" });
    return readTraj(fakeFile, system);
}
// organizes files into files that create a new system, auxiliary files, and script files.
// Then fires the reads sequentially
async function handleFiles(files) {
    renderer.domElement.style.cursor = "wait";
    const systemFiles = [];
    const systemHelpers = {};
    const auxFiles = [];
    const scriptFiles = [];
    const filesLen = files.length;
    for (let i = 0; i < filesLen; i++) {
        const fileName = files[i].name.toLowerCase();
        const ext = fileName.split(".").pop();
        // These file types lead to creation of a new system(s)
        if (ext === "top") {
            systemFiles.push(new File2reader(files[i], "topology", await identifyTopologyParser(files[i])));
        }
        else if (ext === "oxview") {
            systemFiles.push(new File2reader(files[i], "oxview", readOxViewFile));
        }
        else if (ext === "pdb" || ext === "pdb1" || ext === "pdb2") {
            systemFiles.push(new File2reader(files[i], "pdb", readPdbFile));
        }
        else if (ext === "cif" || ext === "mmcif") {
            systemFiles.push(new File2reader(files[i], "mmcif", readMmcifFile));
        }
        else if (ext === "unf") {
            systemFiles.push(new File2reader(files[i], "unf", readUNFFile));
        }
        else if (ext === "xyz") {
            systemFiles.push(new File2reader(files[i], "xyz", readXYZFile));
        }
        else if (ext === "mgl") {
            systemFiles.push(new File2reader(files[i], "mgl", readMGL));
        }
        // Patchy files are special and are needed at system creation time
        else if (fileName.includes("particles") || fileName.includes("loro") || fileName.includes("matrix")) {
            systemHelpers["particles"] = files[i];
        }
        else if (fileName.includes("patches")) {
            systemHelpers["patches"] = files[i];
        }
        else if (ext === "patchspec" || fileName.match(/p_my\w+\.dat/g)) {
            (systemHelpers["loroPatchFiles"] == undefined)
                ? systemHelpers["loroPatchFiles"] = [files[i]]
                : systemHelpers["loroPatchFiles"].push(files[i]);
        }
        // These file types modify an existing system
        else if (ext == "dat" || ext == "conf" || ext == "oxdna") {
            auxFiles.push(new File2reader(files[i], "trajectory", readTraj));
        }
        else if (ext === "json") {
            auxFiles.push(new File2reader(files[i], "json", readJson));
        }
        else if (ext === "bin") {
            if (await isVTJEncoded(files[i])) {
                notifyVTJEncoded(files[i]);
            }
            else if (await isObservableOutputCompressed(files[i])) {
                auxFiles.push(new File2reader(files[i], "trajectory", decompressObservableOutput));
            }
            else {
                auxFiles.push(new File2reader(files[i], "binary_overlay", readStressBinary));
            }
        }
        else if (ext === "zst") {
            if (await isObservableOutputCompressed(files[i])) {
                auxFiles.push(new File2reader(files[i], "trajectory", decompressObservableOutput));
            }
        }
        else if (ext === "txt" && (fileName.includes("trap") || fileName.includes("force"))) {
            auxFiles.push(new File2reader(files[i], "force", readForce));
        }
        else if (ext === "txt" && (fileName.includes("_m"))) {
            auxFiles.push(new File2reader(files[i], "mass", readMassFile));
        }
        else if (ext === "txt" && (fileName.includes("select"))) {
            auxFiles.push(new File2reader(files[i], "select", readSelectFile));
        }
        else if (ext === "cam") {
            auxFiles.push(new File2reader(files[i], "camera", readCamFile));
        }
        else if (ext === "csv") {
            auxFiles.push(new File2reader(files[i], "csv", handleCSV));
        }
        else if (ext === "idx") {
            auxFiles.push(new File2reader(files[i], "select", readSelectFile));
        }
        else if (ext === "par") {
            auxFiles.push(new File2reader(files[i], "par", readParFile));
        }
        else if (ext === "hb") {
            auxFiles.push(new File2reader(files[i], "hb", readHBondFile));
        }
        else if (ext === "db") {
            auxFiles.push(new File2reader(files[i], "db", readDotBracket));
        }
        // Who knows what a script might do
        else if (ext == "js") {
            scriptFiles.push(new File2reader(files[i], "script", readScriptFile));
        }
    }
    function getOrMakeSystem() {
        return new Promise(function (resolve, reject) {
            if (systemFiles.length == 0) {
                resolve(systems[systems.length - 1]);
            }
            else if (systemFiles.length == 1) {
                const sysPromise = systemFiles[0].reader(systemFiles[0].file, systemHelpers);
                sysPromise.then((system) => resolve(system));
            }
            else {
                throw new Error("Systems must be defined by a single file (there can be helper files)!");
            }
        });
    }
    function readAuxiliaryFiles(system) {
        let readList = auxFiles.map((auxFile) => new Promise(function (resolve, reject) {
            const result = auxFile.reader(auxFile.file, system);
            resolve(result);
        }));
        return Promise.all(readList);
    }
    function executeScript() {
        let readList = scriptFiles.map((scriptFile) => new Promise(function (resolve, reject) {
            readScriptFile(scriptFile.file);
        }));
        return Promise.all(readList);
    }
    getOrMakeSystem().then((sys) => readAuxiliaryFiles(sys)).then(() => executeScript());
}
// Create Three geometries and meshes that get drawn in the scene.
async function addSystemToScene(system) {
    if (system.isPatchySystem()) {
        let s = system;
        await s.ready;
        if (s.species !== undefined) {
            const patchResolution = 4;
            const patchWidth = 0.2;
            const patchAlignWidth = 0.3;
            s.patchyGeometries = s.offsets.map((_, i) => {
                let g = new THREE.InstancedBufferGeometry();
                const points = [new THREE.Vector3()];
                s.species[i].patches.forEach(patch => {
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
                    if (Math.abs(a1.dot(a2)) > 1e-5) {
                        console.warn(`The a1 and a2 vectors are incorrectly defined in species ${i}. Using patch position instead`);
                        a1 = pos.clone();
                        a1.normalize();
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
                        aw = patchWidth;
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
            g.addAttribute("instanceOffset", new THREE.InstancedBufferAttribute(s.offsets[i], 3));
            g.addAttribute("instanceRotation", new THREE.InstancedBufferAttribute(s.rotations[i], 4));
            g.addAttribute("instanceScale", new THREE.InstancedBufferAttribute(s.scalings[i], 3));
            g.addAttribute("instanceColor", new THREE.InstancedBufferAttribute(s.colors[i], 3));
            g.addAttribute("instanceVisibility", new THREE.InstancedBufferAttribute(s.visibilities[i], 3));
        });
        s.patchyMeshes = s.patchyGeometries.map(g => {
            const mesh = new THREE.Mesh(g, instanceMaterial);
            mesh.frustumCulled = false;
            scene.add(mesh);
            return mesh;
        });
        s.pickingMeshes = s.patchyGeometries.map((g, i) => {
            const pickingGeometry = g.clone();
            pickingGeometry.addAttribute("instanceColor", new THREE.InstancedBufferAttribute(s.labels[i], 3));
            pickingGeometry.addAttribute("instanceOffset", new THREE.InstancedBufferAttribute(s.offsets[i], 3));
            pickingGeometry.addAttribute("instanceVisibility", new THREE.InstancedBufferAttribute(s.visibilities[i], 3));
            const pickingMesh = new THREE.Mesh(pickingGeometry, pickingMaterial);
            pickingMesh.frustumCulled = false;
            return pickingMesh;
        });
        s.pickingMeshes.forEach(m => {
            pickingScene.add(m);
        });
    }
    else {
        system.backboneGeometry = instancedBackbone.clone();
        system.nucleosideGeometry = instancedNucleoside.clone();
        system.connectorGeometry = instancedConnector.clone();
        system.spGeometry = instancedBBconnector.clone();
        system.pickingGeometry = instancedBackbone.clone();
        system.backboneGeometry.addAttribute("instanceOffset", new THREE.InstancedBufferAttribute(system.bbOffsets, 3));
        system.backboneGeometry.addAttribute("instanceRotation", new THREE.InstancedBufferAttribute(system.bbRotation, 4));
        system.backboneGeometry.addAttribute("instanceColor", new THREE.InstancedBufferAttribute(system.bbColors, 3));
        system.backboneGeometry.addAttribute("instanceScale", new THREE.InstancedBufferAttribute(system.scales, 3));
        system.backboneGeometry.addAttribute("instanceVisibility", new THREE.InstancedBufferAttribute(system.visibility, 3));
        system.nucleosideGeometry.addAttribute("instanceOffset", new THREE.InstancedBufferAttribute(system.nsOffsets, 3));
        system.nucleosideGeometry.addAttribute("instanceRotation", new THREE.InstancedBufferAttribute(system.nsRotation, 4));
        system.nucleosideGeometry.addAttribute("instanceColor", new THREE.InstancedBufferAttribute(system.nsColors, 3));
        system.nucleosideGeometry.addAttribute("instanceScale", new THREE.InstancedBufferAttribute(system.nsScales, 3));
        system.nucleosideGeometry.addAttribute("instanceVisibility", new THREE.InstancedBufferAttribute(system.visibility, 3));
        system.connectorGeometry.addAttribute("instanceOffset", new THREE.InstancedBufferAttribute(system.conOffsets, 3));
        system.connectorGeometry.addAttribute("instanceRotation", new THREE.InstancedBufferAttribute(system.conRotation, 4));
        system.connectorGeometry.addAttribute("instanceColor", new THREE.InstancedBufferAttribute(system.bbColors, 3));
        system.connectorGeometry.addAttribute("instanceScale", new THREE.InstancedBufferAttribute(system.conScales, 3));
        system.connectorGeometry.addAttribute("instanceVisibility", new THREE.InstancedBufferAttribute(system.visibility, 3));
        system.spGeometry.addAttribute("instanceOffset", new THREE.InstancedBufferAttribute(system.bbconOffsets, 3));
        system.spGeometry.addAttribute("instanceRotation", new THREE.InstancedBufferAttribute(system.bbconRotation, 4));
        system.spGeometry.addAttribute("instanceColor", new THREE.InstancedBufferAttribute(system.bbColors, 3));
        system.spGeometry.addAttribute("instanceScale", new THREE.InstancedBufferAttribute(system.bbconScales, 3));
        system.spGeometry.addAttribute("instanceVisibility", new THREE.InstancedBufferAttribute(system.visibility, 3));
        system.pickingGeometry.addAttribute("instanceColor", new THREE.InstancedBufferAttribute(system.bbLabels, 3));
        system.pickingGeometry.addAttribute("instanceOffset", new THREE.InstancedBufferAttribute(system.bbOffsets, 3));
        system.pickingGeometry.addAttribute("instanceVisibility", new THREE.InstancedBufferAttribute(system.visibility, 3));
        system.backbone = new THREE.Mesh(system.backboneGeometry, instanceMaterial);
        system.backbone.frustumCulled = false;
        system.nucleoside = new THREE.Mesh(system.nucleosideGeometry, instanceMaterial);
        system.nucleoside.frustumCulled = false;
        system.connector = new THREE.Mesh(system.connectorGeometry, instanceMaterial);
        system.connector.frustumCulled = false;
        system.bbconnector = new THREE.Mesh(system.spGeometry, instanceMaterial);
        system.bbconnector.frustumCulled = false;
        system.dummyBackbone = new THREE.Mesh(system.pickingGeometry, pickingMaterial);
        system.dummyBackbone.frustumCulled = false;
        view.setPropertyInScene("backbone", system);
        view.setPropertyInScene("nucleoside", system);
        view.setPropertyInScene("connector", system);
        view.setPropertyInScene("bbconnector", system);
        pickingScene.add(system.dummyBackbone);
    }
    renderer.domElement.style.cursor = "auto";
    if (!inIframe()) {
        canvas.focus();
    }
}
