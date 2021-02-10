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
}, false);

target.addEventListener("dragexit", function (event) {
    event.preventDefault();
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
    const files = event.dataTransfer.files;
    handleFiles(files);

}, false);

function handleFiles(files: FileList) {

    const filesLen = files.length;

    let topFile, jsonFile, trapFile, pdbfile;

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
        else if (ext === "txt" && (fileName.includes("trap") || fileName.includes("force") )) trapFile = files[i];
        else if (ext === "pdb") {
            pdbfile = files[i];
            readPdbFile(pdbfile);
        }
        else {
            notify("This reader uses file extensions to determine file type.\nRecognized extensions are: .conf, .dat, .oxdna, .top, .json, .pdb, and trap.txt\nPlease drop one .dat/.conf/.oxdna and one .top file.  .json data overlay is optional and can be added later. To load an ANM model par file you must first load the system associated.")
            return
        }
    }
    let jsonAlone = false;
    if (!trapFile){
        if (jsonFile && !topFile) jsonAlone = true;
        if ((filesLen > 3 || filesLen < 2) && !jsonAlone)  {
            if (pdbfile) notify("Reading PDB File...");
            else notify("Please drag and drop 1 .dat and 1 .top file. .json is optional.  More .jsons can be dropped individually later");
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
}

//parse a trap file
function readTrap(system, trapReader) {

    let file = trapReader.result as string;
    let trap_file = file;
    //{ can be replaced with \n to make sure no parameter is lost 
    while(file.indexOf("{")>=0)
        file = file.replace("{","\n");
    // traps can be split by } because everything between {} is one trap 
    let traps = file.split("}");

    let trap_objs = [];
    traps.forEach((trap) =>{
        let lines = trap.split('\n');
        //empty lines and empty traps need not be processed as well as comments  
        lines = lines.filter((line)=> line !== "" && !line.startsWith("#"));
        if(lines.length == 0) return;

        let trap_obj = {};
        lines.forEach((line)  =>{
            let com_pos = line.indexOf("#");
            if (com_pos >= 0) line =  line.slice(0, com_pos).trim();
            //another chance an empty line can be encountered. Remove whitespace
            if(line.trim().length == 0) return;
            //split into option name and value
            let options = line.split("=");
            let lft = options[0].trim(); 
            let rght = options[1].trim();
            trap_obj[lft] = Number.isNaN(parseFloat(rght)) ? rght : parseFloat(rght);
        });
        if(Object.keys(trap_obj).length > 0)
            trap_objs.push(trap_obj);
    });

    //handle the different traps 
    trap_objs.forEach((trap)=>{
        switch(trap.type){
            case "mutual_trap":
                let mutTrap = new MutualTrap(trap, system);
                mutTrap.update();
                forces.push(mutTrap);
                
                break;
            default:
                notify(`External force ${trap["type"]} type not supported yet, feel free to implement in file_reading.ts and force.ts`);
                break;
        }
    });
   forceHandler =  new ForceHandler(forces);
    
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
    if (topFile && datFile) {
        renderer.domElement.style.cursor = "wait";

        //make system to store the dropped files in
        const system = new System(sysCount, elements.getNextId());

        //read topology file, the configuration file is read once the topology is loaded to avoid async errors
        const topReader = new TopReader(topFile, system, elements);
        topReader.readAsText(topReader.topFile)

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

function readDat(datReader, system) {
    let currentStrand = system.strands[0];
    let numNuc = system.systemLength();
    // parse file into lines
    let lines = datReader.result.split(/[\n]+/g);
    if (lines.length-3 < numNuc) { //Handles dat files that are too small.  can't handle too big here because you don't know if there's a trajectory
        notify(".dat and .top files incompatible", "alert");
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
    timedisp.innerHTML = `t = ${time.toLocaleString()}`;
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
        currentNucleotide.calcPositionsFromConfLine(l);

        //when a strand is finished, add it to the system
        if (!currentNucleotide.n5 || currentNucleotide.n5 == currentStrand.end3) { //if last nucleotide in straight strand
            if (currentNucleotide.n5 == currentStrand.end3) {
                currentStrand.end5 = currentNucleotide;
            }
            system.addStrand(currentStrand); // add strand to system
            currentStrand = system.strands[currentStrand.strandID]; //don't ask, its another artifact of strands being 1-indexed
            if (elements.get(currentNucleotide.id+1)) {
                currentStrand = elements.get(currentNucleotide.id+1).strand;
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
                    view.coloringMode.set("Overlay");
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
                    const arrowHelper = new THREE.ArrowHelper(vec, elements.get(i).getInstanceParameter3("bbOffsets"), len, 0x000000);
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
            notify(".json and .top files are not compatible.", "alert");
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
                    let strandClass;
                    switch (strandData.class) {
                        case 'NucleicAcidStrand': strandClass = NucleicAcidStrand; break;
                        case 'Peptide': strandClass = Peptide; break;
                        default:
                            let error = `Unrecognised type of strand:  ${strandData.class}`;
                            notify(error, "alert");
                            throw error;
                    }
                    strand = new strandClass(strandData.id, sys);

                    // Add strand to system
                    sys.addStrand(strand);

                    // Go through and add each monomer element
                    strandData.monomers.forEach(elementData => {
                        // Create element of correct class
                        let e: BasicElement;
                        let elementClass;
                        switch (elementData.class) {
                            case 'DNA': elementClass = DNANucleotide; break;
                            case 'RNA': elementClass = RNANucleotide; break;
                            case 'AA': elementClass = AminoAcid; break;
                            default:
                                let error = `Unrecognised type of element:  ${elementData.class}`;
                                notify(error);
                                throw error;
                        }
                        e = new elementClass(undefined, strand);

                        // Preserve ID when possible, keep track of new IDs if not
                        if (elements.has(elementData.id)) {
                            elements.push(e); // Create new ID
                        } else {
                            elements.set(elementData.id, e) // Reuse old ID
                        }
                        newElementIds.set(elementData.id, e.id);

                        e.strand = strand;
                        if(strandData.end3 == elementData.id || !elementData.n3) {
                            strand.end3 = e; // Set strand 3' end
                        }
                        if(strandData.end5 == elementData.id || !elementData.n5) {
                            strand.end5 = e; // Set strand 3' end
                        }

                        // Set misc attributes
                        e.label = elementData.label;
                        e.type = elementData.type;
                        e.clusterId = elementData.cluster;
                        if (elementData.color) {
                            e.color = new THREE.Color(elementData.color);
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
                        if ('n5' in d) {e.n5 = elements.get(newElementIds.get(d.n5));}
                        if ('n3' in d) {e.n3 = elements.get(newElementIds.get(d.n3));}
                        if ('bp' in d) {e.pair = elements.get(newElementIds.get(d.bp));}
                    });
                });
            });
            // Let's do this one more time...
            // Since we now have the topology setup, let's set the configuration
            data.systems.forEach(sysData => {
                let sys: System = sysData.createdSystem;
                let deprecated: boolean = false;
                sysData.strands.forEach(strandData => {
                    strandData.monomers.slice().reverse().forEach(d => {
                        let e = d.createdElement;
                        // If we have a position, use that
                        if (d.p) {
                            let p = new THREE.Vector3().fromArray(d.p);
                            if (d.a1 && d.a3) {
                                let a1 = new THREE.Vector3().fromArray(d.a1);
                                let a3 = new THREE.Vector3().fromArray(d.a3);
                                e.calcPositions(p, a1, a3);
                            } else {
                                e.calcPositions(p); // Amino acid
                            }

                        // Otherwise fallback to reading instance parameters
                        } else if('conf' in d) {
                            //make sure warning shows up only once 
                            if(!deprecated) notify("The loaded file is using a deprecated .oxView format. Please save your design again to avoid this warning", 'warn');
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
/*
                // Redraw sp connectors
                sys.strands.forEach(s=>{
                    s.forEach(e=>{
                        if(e.n3) {
                            calcsp(e);
                        }
                    });
                    s.updateEnds();
                });
*/
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

            // if its a torsional ANM then there are additional parameters on some lines
            let extraParams = []
            if (l.length > 5) {
                for (let i = 5; i < l.length; i++) {
                    extraParams.push(l[i])
                }
            }

            //dereference p and q into particle positions from the system
            const particle1 = system.getElementBySID(p),
                  particle2 = system.getElementBySID(q);  

            if (particle1 == undefined) console.log(i)

            anm.createConnection(particle1, particle2, eqDist, type, strength, extraParams);
        };
        addANMToScene(anm);
        system.strands.forEach((s) => {
            if (s.isPeptide()) {
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
        view.coloringMode.set("Overlay");
    }

    render();

    // Reset the cursor from the loading spinny and reset canvas focus
    renderer.domElement.style.cursor = "auto";
    canvas.focus();
}

// Helper Objects for pdb parsing
class pdbatom{
    indx : number;
    atomType: string;
    altLoc: string;
    resType: string;
    chainID: string;
    pdbResNum : number;
    iCode: string;
    x: number;
    y: number;
    z: number;
    occupancy: number;
    tempFactor: number;
    element: string;
    charge: string;
    constructor() {
        this.indx = -1;
        this.atomType = 'X';
        this.altLoc = "";
        this.resType = "";
        this.chainID = "";
        this.pdbResNum = -1;
        this.iCode = "";
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.occupancy = 0;
        this.tempFactor = 0;
        this.element = "";
        this.charge = "";
    }
}

class pdbresidue{
    resType: string;
    pdbResNum: number;
    chainID: string;
    type: string;
    atoms: pdbatom[];
    constructor(){
        this.resType = "";
        this.pdbResNum = -1;
        this.chainID = "";
        this.type = "";
        this.atoms = [];
    }
}

class pdbchain{
    chainID: string;
    residues: pdbresidue[];
    strandtype: string;
    constructor(){
        this.chainID = "";
        this.residues = [];
        this.strandtype = "";
    }
};

class pdbinfowrapper { //Transfers Necessary Data from readPdbFile to addPDBtoScene
    pdbfilename: string;
    sysdim: number[][];
    pdbsysinfo: pdbchain[];

    constructor(pi, sys, chains) {
        this.pdbfilename = pi;
        this.sysdim = sys;
        this.pdbsysinfo = chains;
    }
}

function readPdbFile(file) {  //TODO: *Only* two issues. 1) repeated chain identifiers in pdb files 2) centering of system will need a little work
    let reader = new FileReader();

    reader.onload = () => {
        const pdbLines = (reader.result as string).split(/[\n]+/g);
        let atoms : pdbatom[] = [];
        let residues : pdbresidue[] = []; // individual residue data parsed from Atomic Info
        let chains : pdbchain[] = [];
        let na = new pdbatom();
        let nr = new pdbresidue();
        let nc = new pdbchain();
        let boxBounds = [[1000, -1000], [1000, -1000], [1000, -1000]]; // [[xmin, xmax], [ymin, ymax], [zmin, zmax]

        // bookkeeping
        let prevChainId = " ";
        let prevResId : number = -1;
        let label = "pdb";
        // Iterate each line looking for atoms
        for(let i = 0; i < pdbLines.length; i++){
            if (i < 10 && pdbLines[i].substr(0, 6) === 'HEADER'){
                let head = pdbLines[i].match(/\S+/g); //header info, search
                head.forEach(i => {
                    let si = i.split('');
                    if(si.length == 4 && (!isNaN(parseFloat(si[0])) && isFinite(parseFloat(si[0]))) ){ //PDB IDs are 4 characters 1st character is always an integer checks for that
                        label = i;
                    }
                })
            }
            if (pdbLines[i].substr(0, 4) === 'ATOM') {
                let pdbLine = pdbLines[i];
                //notify("atom found");
                // http://www.wwpdb.org/documentation/file-format-content/format33/sect9.html#ATOM
                na.indx = parseInt(pdbLine.substring(6, 11));
                na.atomType = pdbLine.substring(12, 16).trim();
                na.altLoc = pdbLine.substring(16, 17).trim();
                na.resType = pdbLine.substring(17, 20).trim();
                na.chainID = pdbLine.substring(21, 22).trim();
                na.pdbResNum = parseInt(pdbLine.substring(22, 26).trim());
                na.iCode = pdbLine.substring(26, 27).trim();
                // Convert From Angstroms to Simulation Units
                na.x = parseFloat(pdbLine.substring(30, 38))/ 8.518;
                if(na.x < boxBounds[0][0]) boxBounds[0][0] = na.x; //update x min
                if(na.x > boxBounds[0][1]) boxBounds[0][1] = na.x; //update x max
                na.y = parseFloat(pdbLine.substring(38, 46))/ 8.518;
                if(na.y < boxBounds[1][0]) boxBounds[1][0] = na.y; //update y min
                if(na.y > boxBounds[1][1]) boxBounds[1][1] = na.y; //update y max
                na.z = parseFloat(pdbLine.substring(46, 54))/ 8.518;
                if(na.z < boxBounds[2][0]) boxBounds[2][0] = na.z; //update z min
                if(na.z > boxBounds[2][1]) boxBounds[2][1] = na.z; //update z max
                na.occupancy = parseFloat(pdbLine.substring(54, 60).trim());
                na.tempFactor = parseFloat(pdbLine.substring(60, 66).trim());
                na.element = pdbLine.substring(76, 78).trim();
                na.charge = pdbLine.substring(78, 80).trim();

                let nac: pdbatom = {
                    ...na
                };
                atoms.push(nac);


                //checks if last read atom belongs to a different chain than the one before it
                if (prevResId !== na.pdbResNum) {
                    //notify("residue created");
                    nr.resType = na.resType;
                    nr.pdbResNum = na.pdbResNum;3
                    nr.chainID = na.chainID;

                    let nrc = {
                        ...nr
                    };

                    residues.push(nrc)

                    //set previous chain id to that of last read atom
                    prevResId = na.pdbResNum;
                }

                //checks if last read atom belongs to a different chain than the one before it
                if (prevChainId !== na.chainID) {
                    //notify("chain created");
                    nc.chainID = na.chainID;
                    let ncc = {
                        ...nc
                    };
                    chains.push(ncc);
                    //set previous chain id to that of last read atom
                    prevChainId = na.chainID;
                }
            }
        }

        // Assigns Atoms to their corresponding Residues
        residues.forEach((res: pdbresidue) =>
            res.atoms = atoms.filter(atom => {
                if(atom.pdbResNum == res.pdbResNum && atom.chainID == res.chainID) return true;
            })
        );

        // Assigns Residues to their corresponding Chain
        chains.forEach((chain: pdbchain) =>
            chain.residues = residues.filter(res => res.chainID == chain.chainID)
        );


        if (chains.length == 0){
            notify("No Chains Found in PDB File");
            return;
        }
        if (atoms.length == 0){
            notify("No Atoms Found in PDB File");
            return;
        }
        chains.forEach((chain: pdbchain) =>
            notify("Chain ".concat(chain.chainID," loaded with ", chain.residues.length.toString(), " residues"))
        );

        let pdbinfo = new pdbinfowrapper(label, boxBounds, chains);
        pdbFileInfo.push(pdbinfo);
        let fileRead = new Promise(function (resolve) {
            if(pdbFileInfo.length > 1){
                resolve("done");
            }
        });
        return fileRead;
    }
    reader.onloadend = () => {
        addPDBToScene();
    }


    reader.readAsText(file); // Executes Loading reads file etc.
                             // when it ends triggers addPDBtoScene
}

function addPDBToScene () {
    // Adds last added pdb info object in pdbFile Info
    if(pdbFileInfo.length > 0) {
        let pdata = pdbFileInfo.slice(-1)[0];
        let strands = pdata.pdbsysinfo;
        let bounds = pdata.sysdim;
        let label = pdata.pdbfilename;

        // Looking back at this the strands name probably wasn't the most unique choice
        // strands is meant to be the chain object from the PDB Parser
        // Parses PDB Data and Intializes System, Errors go to the Console

        //PDB Parsing
        // Members of the Recongized arrays cannot have overlapping Members
        const recongizedDNAResidues = ["DG", "DT", "DA", "DC", "DU", "DI", "DN"];
        const recongizedDNAStrandEnds = ["DG3", "DG5", "DT3", "DT5", "DA3", "DA3", "DC3", "DC5"];
        const recongizedProteinResidues = ["ALA", "ARG", "ASN", "ASP", "CYS", "GLN",
            "GLU", "GLY", "HIS", "ILE", "MET", "LEU", "LYS", "PHE", "PRO", "SER",
            "THR", "TRP", "TYR", "VAL", "SEC", "PYL", "ASX", "GLX", "UNK"];
        const recongizedRNAResidues = ["A", "C", "G", "I", "U", "N"];

        // Intialize bookkeeping Members for Boolean Checks
        let checker = {
            DNAPresent: false,
            proteinPresent: false,
            RNAPresent: false,
            mutantStrand: false
        };

        //Classify Residue Types
        for (let i: number = 0; i < strands.length; i++) {
            let strand: pdbchain = strands[i];
            // Reset Bookkeeping Members for each Strand
            for (let key in checker) checker[key] = false;
            // Loop over all Residues in each Strand
            strand.residues.forEach(res => {
                // Sort PDB Info and set Flags for System Initialization at Residue Level

                //Check if Residue from PDB is in recongized array
                if (recongizedDNAResidues.indexOf(res.resType) > -1 || recongizedDNAStrandEnds.indexOf(res.resType) > -1) {
                    // Deal with Special Cases Here
                    if (res.resType === 'DN') {
                        notify("Nucleotide Number blank has Residue Base type 'N' for Generic Nucleic Acid in PDB File");
                        return 1;
                    }
                    if (res.resType === 'DI') {
                        notify("Nucleotide Number blank has Residue Type Inosine. This is currently unsupported.")
                        return 1;
                    }

                    // Sets which Nucleic Acids are Intialized
                    res.type = 'dna';
                    // Bookkeeping
                    checker.DNAPresent = true;

                } else if (recongizedProteinResidues.indexOf(res.resType) > -1) {
                    // Deal with Special Cases Here
                    if (res.resType === 'UNK') {
                        notify("Amino Acid blank is Unknown");
                        return 1;
                    }
                    // Sets which Residues are Intialized
                    res.type = 'pro';
                    // Bookkeeping
                    checker.proteinPresent = true;

                } else if (recongizedRNAResidues.indexOf(res.resType) > -1) {
                    // Deal with Special Cases Here
                    if (res.resType === 'N') {
                        notify("Nucleotide Number blank has Residue Base type 'N' for Generic Nucleic Acid in PDB File");
                        return 1;
                    }
                    if (res.resType === 'I') {
                        notify("Nucleotide Number blank has Residue Type Inosine. This is currently unsupported.")
                        return 1;
                    }
                    // Sets which Nucleic Acids are Intialized
                    res.type = 'rna';
                    // Bookkeeping
                    checker.RNAPresent = true;

                } else {
                    notify("Residue Number blank on Strand blank in Provided PDB is Not Supported. " +
                        "It will not be Intialized in the Viewer.");
                    res.type = 'unworthy';
                }
            });

            // Check for strands with inconsistent Residue Types
            checker.mutantStrand = checker.proteinPresent ? (checker.DNAPresent || checker.RNAPresent) : (checker.DNAPresent && checker.RNAPresent);
            if (checker.mutantStrand) {
                notify("Strand BLANK contains more thank one macromolecule type, no thanks"); //lol
                strand.strandtype = 'bastard';
            } else {
                if (checker.proteinPresent) strand.strandtype = 'pro';
                if (checker.DNAPresent) strand.strandtype = 'dna';
                if (checker.RNAPresent) strand.strandtype = 'rna';
            }

        }

        // Set Box Size
        box.x = Math.ceil((bounds[0][1] - bounds[0][0]) * 2);
        box.y = Math.ceil((bounds[1][1] - bounds[1][0]) * 2);
        box.z = Math.ceil((bounds[2][1] - bounds[2][0]) * 2);
        redrawBox();

        let CalcInfoAA = (res: pdbresidue): [number, string, THREE.Vector3, THREE.Vector3, THREE.Vector3, number] => {
            if (res.type == 'pro') {
                let type;
                let pdbid;
                //Set Type
                let elem = {
                    "LYS": "K",
                    "CYS": "C",
                    "ALA": "A",
                    "THR": "T",
                    "GLU": "E",
                    "GLN": "Q",
                    "SER": "S",
                    "ASP": "D",
                    "ASN": "N",
                    "HIS": "H",
                    "GLY": "G",
                    "PRO": "P",
                    "ARG": "R",
                    "VAL": "V",
                    "ILE": "I",
                    "LEU": "L",
                    "MET": "M",
                    "PHE": "F",
                    "TYR": "Y",
                    "TRP": "W"
                };
                type = elem[res.resType]; //Set Type Based Off Three Letter Codes
                pdbid = res.pdbResNum;
                let scHAcom = new THREE.Vector3; //side chain Heavy atoms Center of Mass
                res.atoms.forEach(a => {
                    if (['N', 'C', 'O', 'H', 'CA'].indexOf(a.atomType) == -1) {
                        scHAcom.x += a.x;
                        scHAcom.y += a.y;
                        scHAcom.z += a.z;
                    }
                })
                // if null vector (glycine) a1 is 1, 0, 0
                if (scHAcom.length() == 0) scHAcom.x = 1;
                scHAcom.normalize();
                let CA = res.atoms.filter(a => a.atomType == 'CA')[0];
                let CApos = new THREE.Vector3(<number>CA.x, <number>CA.y, <number>CA.z);
                let CABfactor = CA.tempFactor;

                // notify(AM.getPos().x.toString().concat(AM.getPos().y.toString(), AM.getPos().z.toString()));
                let a1 = scHAcom.clone().sub(CApos).normalize();
                let a3 = new THREE.Vector3();
                let bv1 = new THREE.Vector3(1, 0, 0);
                let bv2 = new THREE.Vector3(0, 1, 0);
                let bv3 = new THREE.Vector3(0, 1, 1);
                if (a1.dot(bv1) < 0.99) {
                    a3 = a1.clone().cross(bv1);
                } else if (a1.dot(bv2) < 0.99) {
                    a3 = a1.clone().cross(bv2);
                } else if (a1.dot(bv3) < 0.99) {
                    a3 = a1.clone().cross(bv3);
                }
                return [pdbid, type, CApos, a1, a3, CABfactor];
            }
        }

        // This Function calculates all necessary info for a Nuclcleotide in PDB format and writes it to the system
        let CalcInfoNC = (res: pdbresidue): [number, string, THREE.Vector3, THREE.Vector3, THREE.Vector3, number] => {
            // Info we want from PDB
            let pdbid;
            let type;

            //Residue Number in PDB File
            pdbid = res.pdbResNum;

            if (res.resType.includes('A')) type = 'A';
            if (res.resType.includes('C')) type = 'C';
            if (res.resType.includes('G')) type = 'G';
            if (res.resType.includes('T')) type = 'T';
            if (res.resType.includes('U')) type = 'U';

            //Calculate Base atoms Center of Mass
            let base_atoms = res.atoms.filter(a => a.atomType.includes("'") || a.atomType.includes("*"));
            let baseCom = new THREE.Vector3;
            baseCom.x = base_atoms.map(a => a.x).reduce((a, b) => a + b);
            baseCom.y = base_atoms.map(a => a.y).reduce((a, b) => a + b);
            baseCom.z = base_atoms.map(a => a.z).reduce((a, b) => a + b);
            baseCom.divideScalar(base_atoms.length);

            let Bfact = res.atoms.map(a => a.tempFactor).reduce((a, b) => a+b); //sum bfactors of ind atoms
            Bfact /= res.atoms.length;
            let o4atom = res.atoms.filter(a => a.atomType == "O4'")[0];
            let o4pos = new THREE.Vector3(o4atom.x, o4atom.y, o4atom.z);
            let parallel_to = o4pos.sub(baseCom);

            //Calculate Center of Mass
            let nuccom = new THREE.Vector3;
            nuccom.x = res.atoms.map(a => a.x).reduce((a, b) => a + b);
            nuccom.y = res.atoms.map(a => a.y).reduce((a, b) => a + b);
            nuccom.z = res.atoms.map(a => a.z).reduce((a, b) => a + b);
            let l = res.atoms.length;
            let p = nuccom.divideScalar(l);

            //Calculate a3 Vector Helper Function
            // Stack Overflow<3 Permutator
            const permutator = (inputArr) => {
                let result = [];
                const permute = (arr, m = []) => {
                    if (arr.length === 0) {
                        result.push(m)
                    } else {
                        for (let i = 0; i < arr.length; i++) {
                            let curr = arr.slice();
                            let next = curr.splice(i, 1);
                            permute(curr.slice(), m.concat(next))
                        }
                    }
                }
                permute(inputArr)
                return result;
            }

            // Compute a1 Vector
            let ring_names: string[] = ["C2", "C4", "C5", "C6", "N1", "N3"];
            let ring_poss = permutator(ring_names);
            let a3 = new THREE.Vector3;
            for (let i: number = 0; i < ring_poss.length; i++) {
                let types = ring_poss[i];
                let p = res.atoms.filter(a => a.atomType == types[0])[0]
                let q = res.atoms.filter(a => a.atomType == types[1])[0]
                let r = res.atoms.filter(a => a.atomType == types[2])[0]
                let v1 = new THREE.Vector3;
                let v2 = new THREE.Vector3;
                v1.x = p.x - q.x;
                v1.y = p.y - q.y;
                v1.z = p.z - q.z;
                v2.x = p.x - r.x;
                v2.y = p.y - r.y;
                v2.z = p.z - r.z;
                let nv1 = v1.clone().normalize();
                let nv2 = v2.clone().normalize();

                if (Math.abs(nv1.dot(nv2)) > 0.01) {
                    let tmpa3 = nv1.cross(nv2);
                    tmpa3.normalize();
                    if (tmpa3.dot(parallel_to) < 0) {
                        tmpa3.negate();
                    }
                    a3.add(tmpa3);
                }
            }

            a3.normalize();

            // Compute a1 Vector
            let pairs: [string, string][];

            if (["DC", "DT", "DU", "C", "T", "U", "DC5", "DC3", "DT5", "DT3", "DU3", "DU5", "C3", "T3", "U3", "C5", "T5", "U5"].indexOf(res.resType) > -1) {
                pairs = [["N3", "C6"], ["C2", "N1"], ["C4", "C5"]];
            } else {
                pairs = [["N1", "C4"], ["C2", "N3"], ["C6", "C5"]];
            }

            let a1 = new THREE.Vector3(0, 0, 0);
            for (let i = 0; i < pairs.length; i++) {
                let p_atom = res.atoms.filter(a => a.atomType == pairs[i][0])[0];
                let q_atom = res.atoms.filter(a => a.atomType == pairs[i][1])[0];
                let diff = new THREE.Vector3(p_atom.x - q_atom.x, p_atom.y - q_atom.y, p_atom.z - q_atom.z);
                a1.add(diff);
            }
            a1.normalize();

            return [pdbid, type, p, a1, a3, Bfact]
        }

        let nextElementId = elements.getNextId();
        let oldElementId = nextElementId;

        let initInfo: [number, string, THREE.Vector3, THREE.Vector3, THREE.Vector3, number][] = [];
        //Make System From the PDB Information
        let sys = new System(sysCount, nextElementId);
        // First Loop to Map Out the System
        let com = new THREE.Vector3();
        // Store B-factor Information Here
        let bFactors = [];
        let xdata = [];
        for (let i: number = 0; i < strands.length; i++) {
            let nstrand = strands[i];

            if (nstrand.strandtype == 'pro') {
                let currentStrand: Peptide = sys.addNewPeptideStrand();
                // currentStrand.system = sys;
                for (let j = 0; j < nstrand.residues.length; j++) {
                    let aa = currentStrand.createBasicElement(nextElementId);
                    aa.sid = nextElementId - oldElementId;
                    let info = CalcInfoAA(nstrand.residues[j]);
                    initInfo.push(info);

                    bFactors.push(info[5]);
                    xdata.push(aa.sid);
                    com.add(info[2]); //Add position to COM calc
                    // Amino Acids are intialized from N-terminus to C-terminus
                    // Same as PDB format
                    // Neighbors must be filled for correct initialization
                    if (j != 0) {
                        let prevaa = elements.get(nextElementId - 1); //Get previous Element
                        aa.n3 = prevaa;
                        prevaa.n5 = aa;
                    }
                    elements.push(aa);
                    nextElementId++;
                }
                currentStrand.updateEnds();

            } else if (nstrand.strandtype == 'rna' || nstrand.strandtype == 'dna') {
                let currentStrand: NucleicAcidStrand = sys.addNewNucleicAcidStrand();

                //PDB entries typically list from 5' to 3'
                //Neighbors must be filled for correct initialization
                let pdbres3to5 = nstrand.residues.reverse(); // Flipped Order so it reads 3'  to 5'
                for (let j = 0; j < nstrand.residues.length; j++) {
                    //For getting center of mass
                    let info = CalcInfoNC(pdbres3to5[j]);
                    initInfo.push(info);
                    com.add(info[2]); //Add position to COM calc

                    let nc = currentStrand.createBasicElement(nextElementId);
                    nc.sid = nextElementId - oldElementId;
                    bFactors.push(info[5]);
                    xdata.push(nc.sid);
                    if (j != 0) {
                        let prevnc = elements.get(nextElementId - 1); //Get previous Element
                        nc.n3 = prevnc;
                        prevnc.n5 = nc;
                    }
                    elements.push(nc);
                    nextElementId++;
                }
                currentStrand.updateEnds();

            }
        }

        com.divideScalar(sys.systemLength());
        let pdbBfactors = new graphData(label, bFactors, xdata, "bfactor", "A_sqr");
        graphDatasets.push(pdbBfactors);

        sys.initInstances(sys.systemLength())
        // This Function calculates all necessary info for an Amino Acid in PDB format and writes it to the system
        let FillInfoAA = (info: [number, string, THREE.Vector3, THREE.Vector3, THREE.Vector3, number], AM: AminoAcid, CM: THREE.Vector3) => {
            AM.pdbid = info[0];
            AM.type = info[1];
            let center = info[2].sub(CM);
            AM.calcPositions(center);
            AM.a1 = info[3];
            AM.a3 = info[4];
        }

        // This Function calculates all necessary info for a Nuclcleotide in PDB format and writes it to the system
        let FillInfoNC = (info: [number, string, THREE.Vector3, THREE.Vector3, THREE.Vector3, number], NC: Nucleotide, CM: THREE.Vector3) => {
            NC.pdbid = info[0];
            NC.type = info[1];
            let center = info[2].sub(CM);
            NC.calcPositions(center, info[3], info[4]);
        }

        // Second Loop Going through Exactly the same way
        // Fill Info Functions called on each element to initialize type specific
        let Amino: AminoAcid;
        let Nuc: Nucleotide;
        nextElementId = oldElementId; //Reset

        for (let i: number = 0; i < strands.length; i++) {
            let strand = sys.strands[i];

            if (strand.isPeptide()) {
                for (let k = 0; k < strand.getLength(); k++) {
                    Amino = elements.get(nextElementId) as AminoAcid;
                    FillInfoAA(initInfo[nextElementId], Amino, com);
                    nextElementId++;
                }
            } else if (strand.isNucleicAcid()) {
                for (let k = 0; k < strand.getLength(); k++) {
                    Nuc = elements.get(nextElementId) as Nucleotide;
                    FillInfoNC(initInfo[nextElementId], Nuc, com);
                    nextElementId++;
                }
            }
        }

        //System is set Up just needs to be added to the systems array now I believe
        addSystemToScene(sys);
        systems.push(sys);
        sysCount++;
        //centerAndPBC(sys.getMonomers());
    }
}
