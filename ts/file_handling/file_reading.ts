/// <reference path="../typescript_definitions/index.d.ts" />

// chunk .dat file so its not trying to read the entire thing at once
function datChunker(datFile: Blob, currentChunk: number, chunkSize: number) {
    const sliced = datFile.slice(currentChunk * chunkSize, currentChunk * chunkSize + chunkSize);
    return sliced;
}

//markers are used by the trajectory reader to keep track of configuration start/ends
class marker {
    chunk: String;
    lineID: number;
}

// Creates color overlays
function makeLut(data, key) {
    const min = Math.min.apply(null, data[key]), max = Math.max.apply(null, data[key]);
    if (lut == undefined){
        lut = new THREE.Lut(defaultColormap, 512);
        lut.setMax(max);
        lut.setMin(min);
    }
    if (max > lut.maxV){
        lut.setMax(max);
        api.removeColorbar();
    }
    if (min < lut.minV){
        lut.setMin(min);
        api.removeColorbar();
    }

    lut.setLegendOn({ 'layout': 'horizontal', 'position': { 'x': 0, 'y': 0, 'z': 0 }, 'dimensions': { 'width': 2, 'height': 12 } }); //create legend
    lut.setLegendLabels({ 'title': key, 'ticks': 5 }); //set up legend format
    
    //update every system's color map
    for (let i = 0; i < systems.length; i++){
        const system = systems[i];
        const end = system.systemLength()
        for (let i = 0; i < end; i++) { //insert lut colors into lutCols[] to toggle Lut coloring later
            system.lutCols[i] = lut.getColor(Number(system.colormapFile[key][i]));
        }
    }
}

// define the drag and drop behavior of the scene
const target = renderer.domElement;
target.addEventListener("dragover", function (event) {
    event.preventDefault();
}, false);

target.addEventListener("dragenter", function (event) {
    event.preventDefault();
    const e = document.getElementById("dragInstruction");
    e.style.opacity = "0.1";
}, false);

target.addEventListener("dragexit", function (event) {
    event.preventDefault();
    const e = document.getElementById("dragInstruction");
    e.style.opacity = "0.8";
}, false);

// the actual code to drop in the config files
//First, a bunch of global variables for trajectory reading

const datReader = new FileReader();
var trajReader: TrajectoryReader;

let confNum: number = 0,
    datFileout: string = "",
    datFile, //currently var so only 1 datFile stored for all systems w/ last uploaded system's dat
    box = new THREE.Vector3(); //box size for system

//and a couple relating to overlay files
var toggleFailure: Boolean = false, 
    defaultColormap: string = "cooltowarm";

// What to do if a file is dropped
target.addEventListener("drop", function (event) {
    // cancel default actions
    event.preventDefault();

    const files = event.dataTransfer.files,
        filesLen = files.length;

    let topFile, jsonFile, trapFile;

    // assign files to the extentions
    for (let i = 0; i < filesLen; i++) {
        // get file extension
        const fileName = files[i].name.toLowerCase();
        const ext = fileName.split('.').pop();

        if (ext === "oxview") {
            readOxViewJsonFile(files[i]);
            return;
        }
        if (ext === "par") {
            readParFile(files[i]);
            return;
        }
        else if (["dat", "conf", "oxdna"].includes(ext)) datFile = files[i];
        else if (ext === "top") topFile = files[i];
        else if (ext === "json") jsonFile = files[i];
        else if (ext === "txt" && fileName.includes("trap")) trapFile = files[i];
        else {
            notify("This reader uses file extensions to determine file type.\nRecognized extensions are: .conf, .dat, .oxdna, .top, and .json\nPlease drop one .dat/.conf/.oxdna and one .top file.  .json data overlay is optional and can be added later. To load an ANM model par file you must first load the system associated.")
            return
        }
    }
    let jsonAlone = false;
    if (!trapFile){
        if (jsonFile && !topFile) jsonAlone = true;
        if ((filesLen > 3 || filesLen < 2) && !jsonAlone)  {
            notify("Please drag and drop 1 .dat and 1 .top file. .json is optional.  More .jsons can be dropped individually later");
            return
        }

        //read a topology/configuration pair and maybe a json file
        if (!jsonAlone) {
            readFiles(topFile, datFile, jsonFile);
        }

        //read just a json file to generate an overlay on an existing scene
        if (jsonFile && jsonAlone) {
            const jsonReader = new FileReader(); //read .json
            jsonReader.onload = () => {
                readJson(systems[systems.length-1], jsonReader);
            };
            jsonReader.readAsText(jsonFile);
            renderer.domElement.style.cursor = "auto";
        }
    }
    else{
        const trapReader = new FileReader(); //read .trap file
        trapReader.onload = () => {
            readTrap(systems[systems.length-1], trapReader);
        };
        trapReader.readAsText(trapFile);
        renderer.domElement.style.cursor = "auto"; 
    }
    render();
}, false);


let trap_objs = [];
let trap_file = "";
//parse a trap file
function readTrap(system, trapReader) {

    let file = trapReader.result as string;
    trap_file = file;
    //{ can be replaced with \n to make sure no parameter is lost 
    while(file.indexOf("{")>=0)
        file = file.replace("{","\n");
    // traps can be split by } because everything between {} is one trap 
    let traps = file.split("}");

    
    traps.forEach((trap) =>{
        let lines = trap.split('\n');
        //empty lines and empty traps need not be processed as well as comments  
        lines = lines.filter((line)=> line !== "" && !line.startsWith("#"));
        if(lines.length == 0) return;

        let trap_obj = {};
        lines.forEach((line)  =>{
            let com_pos = line.indexOf("#");
            if (com_pos >= 0) line =  line.slice(0, com_pos).trim();
            //another chance an empty line can be encountered 
            if(line.length == 0 || line == " ") return;
            //split into option name and value
            let options = line.split("=");
            let lft = options[0].trim(); 
            let rght = options[1].trim();
            trap_obj[lft] = rght;  
        });
        if(Object.keys(trap_obj).length > 0)
            trap_objs.push(trap_obj);
    });

    //handle the different traps 
    trap_objs.forEach((trap)=>{
        switch(trap.type){
            //case "trap":
            //    //notify(`${trap["type"]} type `);
            //    
            //    break;
            //case "repulsion_plane":
            //    //notify(`${trap["type"]} type `);
            //    
            //    break;
            case "mutual_trap":
                const particle =  system.getElementBySID( parseInt(trap.particle) ).getInstanceParameter3("bbOffsets"); // the particle on which to exert the force.
                const ref_particle = system.getElementBySID( parseInt(trap.ref_particle) ).getInstanceParameter3("bbOffsets"); // particle to pull towards. 
                                                                                            // Please note that this particle will not feel any force (the name mutual trap is thus misleading).
                const stiff = parseFloat(trap.stiff);// stiffness of the trap.
                const r0 = parseFloat(trap.r0);      // equilibrium distance of the trap.
                let dir = ref_particle.clone().sub(particle);
                dir.normalize();
                
                //draw equilibrium distance 
                let equilibrium_distance = new THREE.Line( 
                    new THREE.BufferGeometry().setFromPoints([
                        particle, particle.clone().add(dir.clone().multiplyScalar(r0))
                    ]),
                    new THREE.LineBasicMaterial({
                        color: 0x0000ff//, //linewidth: stiff
                    }));
                equilibrium_distance.name = `mutual_trap_distance ${trap.particle}->${trap.ref_particle}`;
                scene.add(equilibrium_distance);                
                
                //draw force 
                dir = ref_particle.clone().sub(particle);
                let force_v = dir.clone().normalize().multiplyScalar(
                    (dir.length() - r0 )* stiff
                );
                dir.normalize();
                let force = new THREE.ArrowHelper(dir,
                                                  particle, 
                                                  force_v.length(), 0xC0C0C0, .3);
                force.name = `mutual_trap_force ${trap.particle}->${trap.ref_particle}`;
                scene.add(force);
                break;
            default:
                notify(`trap ${trap["type"]}  type not supported yet, feel free to implement in file_reading.ts`);
                break;
        }
    });
    
}



// Files can also be retrieved from a path
function readFilesFromPath(topologyPath:string, configurationPath:string, overlayPath:string=undefined) {
    if(topologyPath && configurationPath) {
        let topReq = new XMLHttpRequest();
        topReq.open("GET", topologyPath);
        topReq.responseType = "blob";
        topReq.onload = () => {
            const topFile = topReq.response;

            let overlayFile = undefined;
            if (overlayPath != undefined) {
                var overlayReq = new XMLHttpRequest();
                overlayReq.open("GET", overlayPath);
                overlayReq.responseType = "blob";
                overlayReq.onload = () => {
                    overlayFile = overlayReq.response;
                }
                overlayReq.send()
            }

            var datReq = new XMLHttpRequest();
            datReq.open("GET", configurationPath);
            datReq.responseType = "blob";
            datReq.onload = () => {
                datFile = datReq.response;
                readFiles(topFile, datFile, overlayFile);
            }
            datReq.send();
        }
        topReq.send();
    }
}

// And from the URL
function readFilesFromURLParams() {
    const url = new URL(window.location.href);
    const topologyPath = url.searchParams.get("topology");
    const configurationPath = url.searchParams.get("configuration");
    const overlayPath = url.searchParams.get("overlay");

    readFilesFromPath(topologyPath, configurationPath, overlayPath);
}

// Now that the files are identified, make sure the files are the correct ones and begin the reading process
function readFiles(topFile: File, datFile: File, jsonFile?: File) {
    // Remove drag instructions
    const dragInstruction = document.getElementById("dragInstruction");
    dragInstruction.style.display = "none";

    if (topFile && datFile) {
        renderer.domElement.style.cursor = "wait";

        //make system to store the dropped files in
        const system = new System(sysCount, elements.getNextId());

        //read topology file, the configuration file is read once the topology is loaded to avoid async errors
        const topReader = new TopReader(topFile, system, elements);
        topReader.read();

        if (jsonFile) {
            const jsonReader = new FileReader(); //read .json
            jsonReader.onload = () => {
                readJson(system, jsonReader)
            };
            jsonReader.readAsText(jsonFile);
            renderer.domElement.style.cursor = "auto";
        }
    }
    else {
        notify("Please drop one topology and one configuration/trajectory file");
    }
}

let xbbLast,
    ybbLast,
    zbbLast;

function readDat(datReader, system) {
    let currentStrand = system.strands[0];
    let numNuc = system.systemLength();
    // parse file into lines
    let lines = datReader.result.split(/[\n]+/g);
    if (lines.length-3 < numNuc) { //Handles dat files that are too small.  can't handle too big here because you don't know if there's a trajectory
        notify(".dat and .top files incompatible")
        return
    }
    // Increase the simulation box size if larger than current
    box.x = Math.max(box.x, parseFloat(lines[1].split(" ")[2]));
    box.y = Math.max(box.y, parseFloat(lines[1].split(" ")[3]));
    box.z = Math.max(box.z, parseFloat(lines[1].split(" ")[4]));
    redrawBox();

    const time = parseInt(lines[0].split(" ")[2]);
    confNum += 1
    console.log(confNum, "t =", time);
    let timedisp = document.getElementById("trajTimestep");
    timedisp.innerHTML = `t = ${time}`;
    timedisp.hidden = false;
    // discard the header
    lines = lines.slice(3);
    
    let currentNucleotide: BasicElement,
        l: string[];

    //for each line in the current configuration, read the line and calculate positions
    for (let i = 0; i < numNuc; i++) {
        if (lines[i] == "" || lines[i].slice(0, 1) == 't') {
            break
        };
        // get the nucleotide associated with the line
        currentNucleotide = elements.get(i+system.globalStartId);

        // consume a new line from the file
        l = lines[i].split(" ");
        currentNucleotide.calculatePositions(l);

        //when a strand is finished, add it to the system
        if ((currentNucleotide.neighbor5 == undefined || currentNucleotide.neighbor5 == null) || (currentNucleotide.neighbor5.lid < currentNucleotide.lid)) { //if last nucleotide in straight strand
            system.addStrand(currentStrand); // add strand to system
            currentStrand = system.strands[currentStrand.strandID]; //don't ask, its another artifact of strands being 1-indexed
            if (elements.get(currentNucleotide.gid+1) != undefined) {
                currentStrand = elements.get(currentNucleotide.gid+1).strand;
            }
        }

    }
    addSystemToScene(system);
    centerAndPBC(system.getMonomers());
    sysCount++;

    //if there's another time line after the first configuration is loaded, its a trajectory
    if (lines[numNuc].slice(0, 1) == 't')
        return true
    return false
}

function readJson(system, jsonReader) {
    const file = jsonReader.result as string;
    const data = JSON.parse(file);
    for (var key in data) {
        if (data[key].length == system.systemLength()) { //if json and dat files match/same length
            if (typeof (data[key][0]) == "number") { //we assume that scalars denote a new color map
                system.setColorFile(data);
                makeLut(data, key);
                try{ //you need to toggle here for small systems, during the scene add for large systems because asynchronous reading.
                    setColoringMode("Overlay");
                }
                catch {
                    toggleFailure = true;
                }
            }
            if (data[key][0].length == 3) { //we assume that 3D vectors denote motion
                const end = system.systemLength() + system.globalStartId
                for (let i = system.globalStartId; i < end; i++) {
                    const vec = new THREE.Vector3(data[key][i][0], data[key][i][1], data[key][i][2]);
                    const len = vec.length();
                    vec.normalize();
                    const arrowHelper = new THREE.ArrowHelper(vec, elements.get(i).getInstanceParameter3("bbOffsets"), len/5, 0x000000);
                    arrowHelper.name = i + "disp";
                    scene.add(arrowHelper);
                }
            }
        }
        else if (data[key][0].length == 6) { //draw arbitrary arrows on the scene
            for (let entry of data[key]) {
                const pos = new THREE.Vector3(entry[0], entry[1], entry[2]);
                const vec = new THREE.Vector3(entry[3], entry[4], entry[5]);
                vec.normalize();
                const arrowHelper = new THREE.ArrowHelper(vec, pos, 5 * vec.length(), 0x00000);
                scene.add(arrowHelper);
            }
        }
        else { //if json and dat files do not match, display error message and set filesLen to 2 (not necessary)
            notify(".json and .top files are not compatible.");
            return;
        }
    }
}

function readOxViewJsonFile(file: File) {
    let reader = new FileReader();
    reader.onload = () => {
        let sysStartId = sysCount;
        const newElementIds = new Map();
        // Parse json string
        const data = JSON.parse(reader.result as string);

        // Set box data, if provided
        if (data.box) {
            box = new THREE.Vector3().fromArray(data.box);
        }
        // Add systems, if provided (really should be)
        if (data.systems) {
            // Go through and add each system
            data.systems.forEach(sysData => {
                let sys = new System(sysStartId+sysData.id, elements.getNextId());
                sys.label = sysData.label;
                let sidCounter = 0;

                // Go through and add each strand
                sysData.strands.forEach(strandData => {
                    let strand: Strand;

                    // Create strand of correct class
                    let constr;
                    switch (strandData.class) {
                        case 'NucleicAcidStrand': constr = NucleicAcidStrand; break;
                        case 'Peptide': constr = Peptide; break;
                        default:
                            let error = `Unrecognised type of strand:  ${strandData.class}`;
                            notify(error);
                            throw error;
                    }
                    strand = new constr(strandData.id, sys);

                    // Add strand to system
                    sys.addStrand(strand);

                    // Go through and add each monomer element
                    strandData.monomers.forEach(elementData => {
                        // Create element of correct class
                        let element: BasicElement;
                        let constr;
                        switch (elementData.class) {
                            case 'DNA': constr = DNANucleotide; break;
                            case 'RNA': constr = RNANucleotide; break;
                            case 'AA': constr = AminoAcid; break;
                            default:
                                let error = `Unrecognised type of element:  ${elementData.class}`;
                                notify(error);
                                throw error;
                        }
                        element = new constr(undefined, strand);

                        // Preserve ID when possible, keep track of new IDs if not
                        if (elements.has(elementData.id)) {
                            elements.push(element);
                        } else {
                            elements.set(elementData.id, element)
                        }
                        newElementIds.set(elementData.id, element.gid);

                        // Set misc attributes
                        element.label = elementData.label;
                        element.type = elementData.type;
                        element.clusterId = elementData.cluster;
                        element.sid = sidCounter++;

                        // Add monomer element to strand
                        strand.addMonomer(element);

                        elementData.createdElement = element;
                    });
                });
                sysData.createdSystem = sys;
                sys.initInstances(sidCounter);
                systems.push(sys);
                sysCount++;
            });
            // Let's do this one more time...
            // Since we now have instances initialised and updated IDs
            // Go through each system
            data.systems.forEach(sysData => {
                let sys = sysData.createdSystem;
                // Go through each strand
                sysData.strands.forEach(strandData => {
                    // Go through each monomer element
                    strandData.monomers.forEach(elementData => {
                        let element = elementData.createdElement;
                        // Set references to any connected elements
                        if ('n5' in elementData) {
                            element.neighbor5 = elements.get(newElementIds.get(elementData.n5));
                        }
                        if ('n3' in elementData) {
                            element.neighbor3 = elements.get(newElementIds.get(elementData.n3));
                        }
                        if ('bp' in elementData) {
                            element.pair = elements.get(newElementIds.get(elementData.bp));
                        }
                        // Populate instances
                        for (let attr in elementData.conf) {
                            let v = elementData.conf[attr];
                            sys.fillVec(attr, v.length, element.sid, v);
                        }
                        // Re-assign a picking color if ID has changed
                        if (elementData.id !== element.gid) {
                            let idColor = new THREE.Color();
                            idColor.setHex(element.gid + 1); //has to be +1 or you can't grab nucleotide 0
                            sys.fillVec('bbLabels', 3, element.sid, [idColor.r, idColor.g, idColor.b]);
                        }
                    });
                });
                // Finally, we can add the system to the scene
                addSystemToScene(sys);
            });
        }
    };
    reader.readAsText(file);
}

//reads in an anm parameter file and associates it with the last loaded system.
function readParFile(file) {
    let system = systems[systems.length - 1]; //associate the par file with the last loaded system
    let reader = new FileReader();
    reader.onload = () => {
        let lines = (reader.result as string).split(/[\n]+/g);

        //remove the header
        lines = lines.slice(1)

        const size = lines.length;

        //create an ANM object to allow visualization
        const anm = new ANM(system, ANMs.length, size)

        //process connections
        for (let i = 0; i < size-1; i++) {
            let l = lines[i].split(" ")
            //extract values
            const p = parseInt(l[0]),
                q = parseInt(l[1]),
                eqDist = parseFloat(l[2]),
                type = l[3],
                strength = parseFloat(l[4]);

            //dereference p and q into particle positions from the system
            const particle1 = system.getElementBySID(p),
                  particle2 = system.getElementBySID(q);  

            if (particle1 == undefined) console.log(i)

            const connection = anm.createConnection(particle1, particle2, eqDist, type, strength);
        };
        addANMToScene(anm);
        system.strands.forEach((s) => {
            if (s.getType() == "Peptide") {
                api.toggleStrand(s);
            }
        })
        ANMs.push(anm);
    }
    reader.readAsText(file);
}

function addANMToScene(anm: ANM) {
    anm.geometry = instancedConnector.clone();

    anm.geometry.addAttribute( 'instanceOffset', new THREE.InstancedBufferAttribute(anm.offsets, 3));
    anm.geometry.addAttribute( 'instanceRotation', new THREE.InstancedBufferAttribute(anm.rotations, 4));  
    anm.geometry.addAttribute( 'instanceColor', new THREE.InstancedBufferAttribute(anm.colors, 3));
    anm.geometry.addAttribute( 'instanceScale', new THREE.InstancedBufferAttribute(anm.scales, 3));  
    anm.geometry.addAttribute( 'instanceVisibility', new THREE.InstancedBufferAttribute(anm.visibility, 3 ) );

    anm.network = new THREE.Mesh(anm.geometry, instanceMaterial);
    anm.network.frustumCulled = false;

    scene.add(anm.network);

    render();

    canvas.focus();
}

function addSystemToScene(system: System) {
    // If you make any modifications to the drawing matricies here, they will take effect before anything draws
    // however, if you want to change once stuff is already drawn, you need to add "<attribute>.needsUpdate" before the render() call.
    // This will force the gpu to check the vectors again when redrawing.

    // Add the geometries to the systems
    system.backboneGeometry = instancedBackbone.clone();
    system.nucleosideGeometry = instancedNucleoside.clone();
    system.connectorGeometry = instancedConnector.clone();
    system.spGeometry = instancedBBconnector.clone();
    
    system.pickingGeometry = instancedBackbone.clone();

    // Feed data arrays to the geometries
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

    system.connectorGeometry.addAttribute( 'instanceOffset', new THREE.InstancedBufferAttribute(system.conOffsets, 3));
    system.connectorGeometry.addAttribute( 'instanceRotation', new THREE.InstancedBufferAttribute(system.conRotation, 4));  
    system.connectorGeometry.addAttribute( 'instanceColor', new THREE.InstancedBufferAttribute(system.bbColors, 3));
    system.connectorGeometry.addAttribute( 'instanceScale', new THREE.InstancedBufferAttribute(system.conScales, 3));  
    system.connectorGeometry.addAttribute( 'instanceVisibility', new THREE.InstancedBufferAttribute(system.visibility, 3 ) );

    system.spGeometry.addAttribute( 'instanceOffset', new THREE.InstancedBufferAttribute(system.bbconOffsets, 3));
    system.spGeometry.addAttribute( 'instanceRotation', new THREE.InstancedBufferAttribute(system.bbconRotation, 4));  
    system.spGeometry.addAttribute( 'instanceColor', new THREE.InstancedBufferAttribute(system.bbColors, 3));
    system.spGeometry.addAttribute( 'instanceScale', new THREE.InstancedBufferAttribute(system.bbconScales, 3));  
    system.spGeometry.addAttribute( 'instanceVisibility', new THREE.InstancedBufferAttribute(system.visibility, 3 ) );

    system.pickingGeometry.addAttribute( 'instanceColor', new THREE.InstancedBufferAttribute(system.bbLabels, 3));
    system.pickingGeometry.addAttribute( 'instanceOffset', new THREE.InstancedBufferAttribute(system.bbOffsets, 3));
    system.pickingGeometry.addAttribute( 'instanceVisibility', new THREE.InstancedBufferAttribute(system.visibility, 3 ) );

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

    // Add everything to the scene
    scene.add(system.backbone);
    scene.add(system.nucleoside);
    scene.add(system.connector);
    scene.add(system.bbconnector);

    pickingScene.add(system.dummyBackbone);

    // Catch an error caused by asynchronous readers and different file sizes
    if(toggleFailure){
        setColoringMode("Overlay");
    }

    render();

    // Reset the cursor from the loading spinny and reset canvas focus
    renderer.domElement.style.cursor = "auto";
    canvas.focus();
}