/// <reference path="../typescript_definitions/index.d.ts" />

// Only show options for the selected input format
function toggleInputOpts(value: string) {
    document.getElementById('importCadnanoOpts').hidden = value !== 'cadnano';
    document.getElementById('importRpolyOpts').hidden = value !== 'rpoly';
    document.getElementById('importTiamatOpts').hidden = value !== 'tiamat';
}

// Try to guess format from file ending
function guessInputFormat(files: File[]) {
    let from = document.getElementById('importFromSelect') as HTMLSelectElement;
    for (const f of files) {
        if (f.name.endsWith('.rpoly')) {
            from.value = 'rpoly'; break;
        } else if (f.name.endsWith('.json')) {
            from.value = 'cadnano'; break;
        } else if (f.name.endsWith('.dnajson')) {
            from.value = 'tiamat'; break;
        } else if (f.name.endsWith('.dna')) {
            Metro.infobox.create("<h3>It looks like you are trying to import a tiamat .dna file</h3>Please first open it in Tiamat and export it as .dnajson, which you can then import here.", "alert");
        }
    }
    toggleInputOpts(from.value);
}

function importFiles(files: File[]) {
    let from = (document.getElementById("importFromSelect") as HTMLSelectElement).value;
    let to = 'oxview';
    let opts = {};

    let progress = document.getElementById("importProgress");
    progress.hidden = false;

    let cancelButton = document.getElementById("importFileDialogCancel");

    document.body.style.cursor = "wait";

    if (from === "cadnano") {
        opts = {
            grid: (document.getElementById("importCadnanoLatticeSelect") as HTMLSelectElement).value,
            sequence: (document.getElementById("importCadnanoScaffoldSeq") as HTMLSelectElement).value
        };
    } else if (from === "rpoly") {
        opts = {
            sequence: (document.getElementById("importRpolyScaffoldSeq") as HTMLSelectElement).value
        };
    } else if (from === "tiamat") {
        opts = {
            tiamat_version: parseInt((document.getElementById("importTiamatVersion") as HTMLSelectElement).value),
            isDNA: (document.getElementById("importTiamatIsDNA") as HTMLSelectElement).value == "DNA",
            default_val: (document.getElementById("importTiamatDefaultVal") as HTMLSelectElement).value
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
                }
                worker.onmessage = (e: MessageEvent) => {
                    let converted = e.data;
                    readOxViewString(converted);
                    console.log('Conversion finished');
                    finished();
                };
                worker.onerror = (error) => {
                    console.log('Error in conversion');
                    notify(error.message, "alert");
                    finished();
                }
                cancelButton.onclick = () => {
                    worker.terminate();
                    console.log('Conversion aborted');
                    finished();
                }
                worker.postMessage([[...readFiles.values()], from, to, opts]);
            }
        };
        reader.readAsText(file);
    }
}

// Creates color overlays
function makeLut(data, key) {

    let arr = data[key];
    let min = arr[0], max = arr[0];
    
    for(let i =0; i < arr.length;i++)
    {
        if(min >  arr[i]) min = arr[i];
        if(max <= arr[i]) max = arr[i];
    }
   
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
    target.classList.add('dragging');
}, false);

target.addEventListener("dragenter", function (event) {
    event.preventDefault();
    target.classList.add('dragging');
}, false);

target.addEventListener("dragexit", function (event) {
    event.preventDefault();
    target.classList.remove('dragging');
}, false);

// the actual code to drop in the config files
//First, a bunch of global variables for trajectory reading

let confNum: number = 0,
    datFileout: string = "",
    box = new THREE.Vector3(); //box size for system

//and a couple relating to overlay files
var defaultColormap: string = "cooltowarm";

function handleDrop (event) {
    // cancel default actions
    target.classList.remove('dragging');
    const files = event.dataTransfer.files;
    handleFiles(files);
}

// What to do if a file is dropped
target.addEventListener("drop", function (event) {event.preventDefault();})
target.addEventListener("drop", handleDrop, false);

function handleFiles(files: FileList) {

    const filesLen = files.length;

    let datFile, topFile, jsonFile, trapFile, parFile, idxFile, hbFile, pdbFile; //this sets them all to undefined.


    // assign files to the extentions
    for (let i = 0; i < filesLen; i++) {
        // get file extension
        const fileName = files[i].name.toLowerCase();
        const ext = fileName.split('.').pop();

        // oxview files had better be dropped alone because that's all that's loading.
        if (ext === "oxview") {
            readOxViewJsonFile(files[i]);
            return;
        }
        else if (ext === "mgl"){
            readMGL(files[i]);
            return;
        }
        else if (ext === "pdb" || ext === "pdb1" || ext === "pdb2") { // normal pdb and biological assemblies (.pdb1, .pdb2)
            pdbFile = files[i];
        }
        // everything else is read in the context of other files so we need to check what we have.
        else if (["dat", "conf", "oxdna"].includes(ext)) datFile = files[i];
        else if (ext === "top") topFile = files[i];
        else if (ext === "json") jsonFile = files[i];
        else if (ext === "txt" && (fileName.includes("trap") || fileName.includes("force") )) trapFile = files[i];
        else if (ext === "idx") idxFile = files[i];
        else if (ext === "par") parFile = files[i];
        else if (ext === "hb") hbFile = files[i];
        // otherwise, what is this?
        else {
            notify("This reader uses file extensions to determine file type.\nRecognized extensions are: .conf, .dat, .oxdna, .top, .json, .par, .pdb, mgl, and trap.txt\nPlease drop one .dat/.conf/.oxdna and one .top file.  Additional data files can be added at the time of load or dropped later.")
            return
        }
    }

    // If a new system is being loaded, there will be a dat and top file pair
    let newSystem = datFile && topFile || pdbFile

    // Additional information can be dropped in later
    let datAlone = datFile && !topFile;
    let trapAlone = trapFile && !topFile;
    let jsonAlone =  jsonFile && !topFile;
    let parAlone = parFile && !topFile;
    let hbAlone = hbFile; // Can't think of any situation where (it would make any sense) for a hb file to be dropped with any other file


    let addition = datAlone || trapAlone || jsonAlone || parAlone || hbAlone

    if (!newSystem && !addition) {
        notify("Unrecognized file combination. Please drag and drop 1 .dat and 1 .top file to load a new system or an overlay file to add information to an already loaded system.")
    }

    //read a topology/configuration pair and whatever else
    readFiles(topFile, datFile, idxFile, jsonFile, trapFile, parFile, pdbFile, hbFile);

    render();
    return
}

const cylinderMesh = function (pointX, pointY, r, material) {
    // https://stackoverflow.com/questions/15316127/three-js-line-vector-to-cylinder
    // edge from X to Y
    var direction = new THREE.Vector3().subVectors(pointY, pointX);
    // Make the geometry (of "direction" length)
    var geometry = new THREE.CylinderGeometry(r, 0, direction.length(), 8, 4);
    // shift it so one end rests on the origin
    geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, direction.length() / 2, 0));
    // rotate it the right way for lookAt to work
    geometry.applyMatrix(new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(90)));
    // Make a mesh with the geometry
    var mesh = new THREE.Mesh(geometry, material);
    // Position it where we want
    mesh.position.copy(pointX);
    // And make it point to where we want
    mesh.lookAt(pointY);
    return mesh;
 }



const MGL_SCALE = 1;
function readMGL(file:File){
    let reader = new FileReader();
    reader.onload = (e) => {
        let lines =   (e.target.result as string).split(/[\n]+/g);
        // parsing the header
        let header = lines[0].split(":")[1].split(",");
        let x = parseFloat(header[0]) * MGL_SCALE;
        let y = parseFloat(header[1]) * MGL_SCALE;
        let z = parseFloat(header[2]) * MGL_SCALE;
        lines = lines.slice(1); // discard the header
       
        // modify box 
        box.set(x,y,z);
        //lines = lines.slice(0,1);
        lines.forEach(str =>{
            if (str){
                let line = str.split(" ");
                // setup the size of the particles
                const MGL_D =  parseFloat(line[4]) * MGL_SCALE;
                
                let xpos = (parseFloat(line[0]))*MGL_SCALE;
                let ypos = (parseFloat(line[1]))*MGL_SCALE;
                let zpos = (parseFloat(line[2]))*MGL_SCALE;
                let color = line[5].slice(2).slice(0,-1);

                // main particle
                const geometry = new THREE.SphereGeometry( MGL_D, 8, 8 );
                const material = new THREE.MeshPhongMaterial( {color: new THREE.Color(color)} );
                const sphere = new THREE.Mesh( geometry, material );
                sphere.position.set(xpos,ypos,zpos);
                scene.add( sphere );
                // now let's figure out the bonds
                let patch_pos = str.indexOf("M");
                let patches_str = str.slice(patch_pos + 1).split("]").slice(0,-1);
                patches_str.forEach(patch_str=>{  
                    if (patch_str){  
                    let patch_info  = patch_str.split(" ");
                    patch_info = patch_info.slice(1);

                    let patch_x     = parseFloat(patch_info[0]) * MGL_SCALE;                  
                    let patch_y     = parseFloat(patch_info[1]) * MGL_SCALE;
                    let patch_z     = parseFloat(patch_info[2]) * MGL_SCALE; 
                    let patch_size  = parseFloat(patch_info[3]) * MGL_SCALE;

                    let patch_color = patch_info[4].slice(2);
                    const material = new THREE.MeshPhongMaterial( {color: new THREE.Color(patch_color)} );
                    const cylinder = cylinderMesh(
                        new THREE.Vector3(xpos, ypos,zpos),
                        new THREE.Vector3(xpos + patch_x,ypos + patch_y,zpos + patch_z),
                        patch_size,
                        material
                    );
                    scene.add(cylinder);
                    }     
                });
            }
        });
    };
    reader.readAsText(file);
}



//parse a trap file
function readTrap(system, trapReader) {

    let file = trapReader.result as string;
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
    trap_objs.forEach(f=>{
        switch(f.type){
            case "mutual_trap":
                let mutTrap = new MutualTrap();
                mutTrap.setFromParsedJson(f);
                mutTrap.update();
                forces.push(mutTrap);
                break;
            default:
                notify(`External force ${f["type"]} type not supported yet, feel free to implement in file_reading.ts and force.ts`);
                break;
        }
    });
    if (!forceHandler) {
        forceHandler = new ForceHandler(forces);
    } else {
        forceHandler.set(forces);
    }
    render()
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
                const datFile = datReq.response;
                readFiles(topFile, datFile, null, overlayFile);
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
var trajReader :TrajectoryReader;
// Now that the files are identified, make sure the files are the correct ones and begin the reading process
function readFiles(topFile: File, datFile: File, idxFile:File, jsonFile?: File, trapFile?: File, parFile?: File, pdbFile?: File, hbFile?: File) {
    if (topFile && datFile) {
        renderer.domElement.style.cursor = "wait";

        //setupComplete fires when indexing arrays are finished being set up
        //prevents async issues with par and overlay files
        document.addEventListener('setupComplete', readAuxiliaryFiles)

        //make system to store the dropped files in
        const system = new System(sysCount, elements.getNextId());
        systems.push(system); //add system to Systems[]
        //TODO: is this really neaded?
        system.setDatFile(datFile); //store datFile in current System object
        if(!idxFile){
            //read topology file, the configuration file is read once the topology is loaded to avoid async errors
            const topReader = new TopReader(topFile, system, elements,()=>{
                //fire dat file read from inside top file reader to make sure they don't desync (large protein files will cause a desync)
                trajReader = new TrajectoryReader(datFile,topReader,system,elements);
                trajReader.indexTrajectory();

                //set up instancing data arrays
                system.initInstances(system.systemLength());
            });
            topReader.read();
        }
        else{
            console.log("index provided");
            const idxReader = new FileReader(); //read .json
            idxReader.onload = () => {
                let file = idxReader.result as string;
                let indexes = JSON.parse(file);

                const topReader = new TopReader(topFile, system, elements,()=>{
                    //fire dat file read from inside top file reader to make sure they don't desync (large protein files will cause a desync)
                    trajReader = new TrajectoryReader(datFile,topReader,system,elements,indexes);
                    trajReader.nextConfig();
                    //set up instancing data arrays
                    system.initInstances(system.systemLength());
                });
                topReader.read();
            };
            idxReader.readAsText(idxFile);
        }
    }
    else if (pdbFile) {
        readPdbFile(pdbFile);
        document.addEventListener('setupComplete', readAuxiliaryFiles)
    }
    else {
        readAuxiliaryFiles()
    }

    function readAuxiliaryFiles() {
        if (jsonFile) {
            const jsonReader = new FileReader(); //read .json
            jsonReader.onload = () => {
                readJson(systems[systems.length-1], jsonReader)
            };
            jsonReader.readAsText(jsonFile);
        }

        if (trapFile) {
            const trapReader = new FileReader(); //read .trap file
            trapReader.onload = () => {
                readTrap(systems[systems.length-1], trapReader);
            };
            trapReader.readAsText(trapFile);
        }

        if (parFile) {
            let parReader = new FileReader();
            parReader.onload = () => {
                readParFile(systems[systems.length - 1], parReader)
            };
            parReader.readAsText(parFile)
        }
        if (datFile && !topFile) {
            const r = new FileReader();
            r.onload = ()=> {
                updateConfFromFile(r.result as string);
            }
            r.readAsText(datFile);
        }
        if (hbFile){
            const r = new FileReader();
            r.onload = ()=> {
                readHBondFile(hbFile);
            }
            r.readAsText(hbFile);
        }
    }
    render();
    return
}

function updateConfFromFile(dat_file) {
    let lines = dat_file.split("\n");
    lines = lines.slice(3) // discard the header
    systems.forEach(system =>{
        system.strands.forEach((strand: Strand) => {
            strand.forEach(e => {
                let line = lines.shift().split(' ');
                e.calcPositionsFromConfLine(line);
            }, true); //oxDNA runs 3'-5'
        });
        system.callUpdates(['instanceOffset','instanceRotation','instanceScale']);
    });
    tmpSystems.forEach(system =>{
        system.callUpdates(['instanceOffset','instanceRotation','instanceScale']);
    });

    centerAndPBC();
    render();
}



function readJson(system, jsonReader) {
    const file = jsonReader.result as string;
    const data = JSON.parse(file);
    for (var key in data) {
        if (data[key].length == system.systemLength()) { //if json and dat files match/same length
            if (typeof (data[key][0]) == "number") { //we assume that scalars denote a new color map
                system.setColorFile(data);
                makeLut(data, key);
                view.coloringMode.set("Overlay");

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
    reader.onload = (e) => {
        readOxViewString(e.target.result as string);
    };
    reader.readAsText(file);
}

function readOxViewString(s: string) {
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
        let newClusterMap: Map<number, number> = new Map();

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
                    if(strandData.end3 == elementData.id || !('n3' in elementData)) {
                        strand.end3 = e; // Set strand 3' end
                    }
                    if(strandData.end5 == elementData.id || !('n5' in elementData)) {
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
                            e.calcPositions(p, a1, a3, true);
                        } else {
                            e.calcPositions(p, undefined, undefined, true); // Amino acid
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

            if (customColors) {
                view.coloringMode.set("Custom");
            }
        });

        // Center the newly added systems as one
        // Needs to be done after all systems are added to the scene
        centerAndPBC(
            // Consider all added monomers
            data.systems.flatMap(sysData=>sysData.createdSystem.getMonomers())
        );
    }

    if (data.forces) {
        data.forces.forEach(f => {
            switch(f.type){
                case "mutual_trap":
                    let mutTrap = new MutualTrap();
                    mutTrap.setFromParsedJson(f);
                    mutTrap.update();
                    forces.push(mutTrap);
                    break;
                default:
                    notify(`External force ${f["type"]} type not supported yet, feel free to implement in file_reading.ts and force.ts`);
                    break;
            }
        });
        if (!forceHandler) {
            forceHandler = new ForceHandler(forces);
        } else {
            forceHandler.set(forces);
        }
    }
}

// reads hydrogen bonding file generated with Chimera
// hbondinfo is then stored in the pdbfiledatasets
function readHBondFile(file) {
    let reader = new FileReader();
    let pdbInfoIndx = pdbFileInfo.length - 1;

    if(pdbInfoIndx == -1){
        notify("Please Load PDB file to associate H-Bond file with");
        return;
    }

    reader.onload = () => {
        let lines = (reader.result as string).split(/[\n]+/g);
        const size = lines.length;
        let hbonds = [];

        //process hbonds
        for (let i = 0; i < size-1; i++) {
            // trims all split items then removes the empty strings
            let l = lines[i].split(" ").map(function(item) {return item.trim()}).filter(n => n);
            if (recongizedProteinResidues.indexOf(l[0]) != -1) { //check that its a protein residue
                //extract values
                const pos1 = l[1].split("."),
                    atm1 = l[2],
                    id2 = l[3],
                    pos2 = l[4].split("."),
                    atm2 = l[5],
                    dist = parseFloat(l[8]);

                if(recongizedProteinResidues.indexOf(id2) != -1) { //bonded to another protein residue
                    // Chain Identifier, residue number
                    let pdbinds1 = [pos1[1], parseInt(pos1[0])];
                    let pdbinds2 = [pos2[1], parseInt(pos2[0])];

                    let hbond = [pdbinds1, pdbinds2];
                    hbonds.push(hbond);
                }
                // can read hbonds using just model identifiers (no chain identifiers)
            } else if (recongizedProteinResidues.indexOf(l[1]) != -1 && recongizedProteinResidues.indexOf(l[5]) != -1) { // residue is second listed indicates hbonds listed from models
                //extract values
                const pos1 = l[0].split(".")[1],
                    atm1 = l[3],
                    id1 = l[2],
                    id2 = l[6],
                    pos2 = l[4].split(".")[1],
                    atm2 = l[7],
                    dist = parseFloat(l[10]);

                let pdbinds1 = [pos1, parseInt(id1)];
                let pdbinds2 = [pos2, parseInt(id2)];

                let hbond = [pdbinds1, pdbinds2];
                hbonds.push(hbond);
            }
        }
        if(hbonds.length == 0) notify("H bond file format is unrecongized");
        pdbFileInfo[pdbInfoIndx].hydrogenBonds = hbonds;
    }
    reader.readAsText(file);
}

//reads in an anm parameter file and associates it with the last loaded system.
function readParFile(system, reader) {
    let lines = (reader.result as string).split(/[\n]+/g);

    //remove the header
    lines = lines.slice(1)

    const size = lines.length;

    //create an ANM object to allow visualization
    const net = new Network(networks.length, system.getMonomers());

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

        // if (particle1 == undefined) console.log(i)
        net.reducedEdges.addEdge(p, q, eqDist, type, strength, extraParams);
    };
    // Create and Fill Vectors
    net.initInstances(net.reducedEdges.total);
    net.initEdges();
    net.fillConnections(); // fills connection array for

    net.prepVis(); // Creates Mesh for visualization
    networks.push(net); // Any network added here shows up in UI network selector
    selectednetwork = net.nid; // auto select network just loaded
    view.addNetwork(net.nid);

    notify("Par file read! Turn on visualization in the Protein tab")
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

    // Add everything to the scene (if they are toggled)

    view.setPropertyInScene('backbone', system);
    view.setPropertyInScene('nucleoside', system);
    view.setPropertyInScene('connector', system);
    view.setPropertyInScene('bbconnector', system);

    pickingScene.add(system.dummyBackbone);

    // Let the other file readers know that it's safe to reference system properties
    document.dispatchEvent(new Event('setupComplete'))

    // Reset the cursor from the loading spinny and reset canvas focus
    renderer.domElement.style.cursor = "auto";
    canvas.focus();
}


window.addEventListener("message", (event) => {
    if (event.data.message === 'drop') {
        handleFiles(event.data.files);
    }
    else if (event.data.message === 'download') {
        makeOutputFiles();
    }
    else if (event.data.message === 'remove-event') {
        target.removeEventListener("drop", handleDrop);
        target.addEventListener("drop", function () {notify("Dragging onto embedded viewer does not allow form completion")});
        const openButton : HTMLInputElement = <HTMLInputElement>document.getElementById('open-button')
        openButton.disabled = true;
    }
    else {
        console.log(event.data.message, "is not a recognized message")
        return
    }
}, false);

// Helper Objects for pdb parsing
class pdbatom{
    // store most info as strings to make robust against more interestingly formulated PDB files
    indx : string;
    atomType: string;
    altLoc: string;
    resType: string;
    chainID: string;
    chainIndx: number;
    pdbResIdent : string;
    iCode: string;
    x: number;
    y: number;
    z: number;
    occupancy: string;
    tempFactor: string; // make optional?
    element: string | number;
    charge: string | number;
    constructor() {
        this.indx = "";
        this.atomType = "";
        this.altLoc = "";
        this.resType = "";
        this.chainID = "";
        this.chainIndx = -1;
        this.pdbResIdent = "";
        this.iCode = "";
        this.x = 0; // these MUST be numbers
        this.y = 0;
        this.z = 0;
        this.occupancy = "";
        this.tempFactor = "";
        this.element = "";
        this.charge = "";
    }
}

class pdbresidue{
    resType: string;
    pdbResIdent: string;
    chainID: string;
    chainIndx: number;
    type: string;
    atoms: pdbatom[];
    constructor(){
        this.resType = "";
        this.chainIndx = -1;
        this.pdbResIdent = "";
        this.chainID = "";
        this.type = "";
        this.atoms = [];
    }
}

class pdbchain{
    chainID: string;
    chainIndx: number;
    residues: pdbresidue[];
    strandtype: string;
    constructor(){
        this.chainIndx = -1;
        this.chainID = "";
        this.residues = [];
        this.strandtype = "";
    }
}

// Stores locations of unique and repeated chains throughout the provided PDB file
class pdbReadingList{
    uniqueIDs: string[]; // unique chain Identifiers
    uniqueStart: number[]; // starting line number of
    uniqueEnd : number[];
    repeatIDs : string[];
    repeatStart: number[];
    repeatEnd: number[];
    repeatCoords : THREE.Vector3[][]; // coordinates for repeated chains
    repeatQuatRots : THREE.Quaternion[]; // Rotation Quaternion for Repeated chain a1/a3 vectors
    constructor(){
        this.uniqueIDs = [];
        this.uniqueStart = [];
        this.uniqueEnd = [];
        this.repeatIDs = [];
        this.repeatStart =[];
        this.repeatEnd = [];
        this.repeatCoords = [];
        this.repeatQuatRots = [];
    }
}

class pdbinfowrapper { //Transfers Necessary Data from readPdbFile to addPDBtoScene
    pdbfilename: string;
    pdbsysinfo: pdbchain[];
    initlist: pdbReadingList;
    disulphideBonds: [any, number, any, number][];
    hydrogenBonds: [[any, number], [any, number]][];


    constructor(pi, chains, initlist) {
        this.pdbfilename = pi;
        this.pdbsysinfo = chains;
        this.initlist = initlist;
        this.disulphideBonds = [];
    }
}

function prep_pdb(pdblines: string[]){

    //Checks for repeated chains, Biological Assemblies etc.
    let chainDivs: number[] = [];
    let modelDivs: number[] = [];
    let firstatom = 0;
    let noatom = false;
    // Other Info for MWCENM
    let dsbonds = [];

    let start = 0;  // sometimes the end of a chain is saved into a different file, ignoring any garbage like that
    if(pdblines[0].substr(0, 3) == "TER"){
        start = 1;
    }

    // Find Chain Termination statements TER and uses
    for(let i = start; i< pdblines.length; i++){
        if(pdblines[i].substr(0, 4) == 'ATOM' && noatom==false){
            firstatom = i; //line number of first atomic coordinate
            noatom = true;
        }
        if (pdblines[i].substr(0, 3) === 'TER'){
            chainDivs.push(i);
        } else if(pdblines[i].substr(0, 6) === 'ENDMDL'){
            modelDivs.push(i);
        } else if(pdblines[i].substr(0, 6) === 'SSBOND'){
            let line = pdblines[i];
            // disulphide bond info: residue 1 chain id, res 1 res num, res2 chain id, res 2 res num
            let dbond = [line.substring(15, 17).trim(), parseInt(line.substring(17, 21).trim()), line.substring(29, 31).trim(), parseInt(line.substring(31, 35).trim())];
            dsbonds.push(dbond);
        } else if(pdblines[i].substr(0, 3) === 'END'){ // sometimes people don't end their chain with a TER statement
            chainDivs.push(i);
        }
    }

    // If models are present in pdb file, Assumes that repeat chain ids are
    // repeat instances of the 1st chain w/ the same chain identifer
    let bioassemblyassumption = false;
    if (modelDivs.length > 0) bioassemblyassumption = true;


    let nchainids : string[] = []; // Store new chainids
    let finalids : string[] = []; // Final Ids to Loaded, can be from chains or models
    let finaldivs : number[] = [];

    if(chainDivs.length != 0){ // Assumes normal PDB file with all chains declared
        // check for chaindivs that are too close to one another (<= 2 lines)
        chainDivs = chainDivs.filter(function(a, aid, arr){
            if(aid != 0){
                return a - arr[aid - 1] > 2; // false if less than two lines from previous (ex. [1030, 1032, 100001] -> [1030, 100001])
            } else return true;
        });

        // Look at line above chain termination for chain ID
        let chainids: string[] = [];
        chainDivs.forEach(d => {
            chainids.push(pdblines[d-1].substring(21, 22).trim())
        });


        //Re-Assign Chain Ids based off repeating or not
        let sorted_repeated_chainids: string[] = [];
        chainids.forEach((chain, ind) => {
            if(chainids.indexOf(chain) != ind && bioassemblyassumption) { //Check for repeated and presence of models
                sorted_repeated_chainids.push(chain);
            } else {
                sorted_repeated_chainids.push(chain+"*"); // not a repeat? denoted as A*
            }
        })


        let fullalpha = []
        let lastindex = 1; //
        let alphabet = 'a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z.1.2.3.4.5.6.7.8.9.<.>.?./.!.@.#.$.%.^.&.*.(.)._.-.=.+'.split('.');
        fullalpha = fullalpha.concat(alphabet);
        // supports 2862 chains with the same chain id in the same pdb file
        alphabet.forEach((id, idx, arr) => fullalpha = fullalpha.concat(arr.map(x => {return id+x;})));
        sorted_repeated_chainids.forEach((val, ind) => {
            if(nchainids.indexOf(val) != ind){ //same chain identifier needs to be fixed
                if(val != "" && val.includes("*")){ //unique chain
                    let nval = val;
                    let attmpt_indx = lastindex;
                    while(nchainids.indexOf(nval) != -1 && attmpt_indx < 2862){
                        nval = fullalpha[attmpt_indx] + val;
                        attmpt_indx += 1;
                    }
                    lastindex = attmpt_indx;
                    nchainids.push(nval);
                } else {
                    nchainids.push(val);
                }
            } else {
                nchainids.push(val);
            }
        });

        //important must be set
        finalids = nchainids;
        finaldivs = chainDivs;

    } else if(modelDivs.length != 0){
        // Assumes a malformed PDB with models but no chains, (looking at you Modeller)
        bioassemblyassumption = false;
        let chainids: string[] = [];
        modelDivs.forEach((d, dindx) => { // just need an identifer, needs to be unique though
            chainids.push((dindx+1).toString()+"*") // Assumes all chains are unique since they weren't labeled
        });

        finalids = chainids;
        finaldivs = modelDivs;
    }


    // Stores ID, start line, end line if chain is unique
    // Stores Id, start line, end line, coordinates a if chain is repeated and Quat Rotation for a1
    // tl;dr  unique chains require more calculations while repeated chains can resuse those calculated parameters and shifts them accordingly
    // necessary for loading large things like Virus particles


    let initList =  new pdbReadingList;
    let prevend = firstatom;
    for(let i=0; i<finalids.length; i++){
        if(finalids[i].includes("*")){
            let id = finalids[i].replace('*', ''); // remove asterisk from chain id
            initList.uniqueIDs.push(id)
            initList.uniqueStart.push(prevend)
            initList.uniqueEnd.push(finaldivs[i])
            prevend = finaldivs[i]
        } else {
            initList.repeatIDs.push(finalids[i])
            initList.repeatStart.push(prevend)
            initList.repeatEnd.push(finaldivs[i])
            initList.repeatCoords.push([new THREE.Vector3(0, 0, 0)])
            initList.repeatQuatRots.push(new THREE.Quaternion())
            prevend = finaldivs[i]
        }
    }

    return {"initlist":initList, "dsbonds":dsbonds};
}

// Members of the Recongized arrays cannot have overlapping Members
const recongizedProteinResidues = ["ALA", "ARG", "ASN", "ASP", "CYS", "CYX", "GLN",
    "GLU", "GLY", "HIS", "HSD", "ILE", "MET", "LEU", "LYS", "PHE", "PRO", "SER",
    "THR", "TRP", "TYR", "VAL", "SEC", "PYL", "ASX", "GLX", "UNK"];
const recongizedDNAResidues = ["DG", "DT", "DA", "DC", "DU", "DI", "DN"];
const recongizedDNAStrandEnds = ["DG3", "DG5", "DT3", "DT5", "DA3", "DA3", "DC3", "DC5"];
const recongizedRNAResidues = ["A", "C", "G", "I", "U", "N"];
const recongizedRNAStrandEnds = ["A3", "A5", "C3", "C5", "G3", "G5", "U3", "U5"];

function readPdbFile(file) {
    let reader = new FileReader();

    reader.onload = () => {
        const pdbLines = (reader.result as string).split(/[\n]+/g);
        let ret = prep_pdb(pdbLines);
        let initList = ret["initlist"];
        let dsbonds = ret["dsbonds"]
        let uniqatoms : pdbatom[] = [];
        let uniqresidues : pdbresidue[] = []; // individual residue data parsed from Atomic Info
        let uniqchains : pdbchain[] = []; // individual chain data parsed from Atomic Info

        // bookkeeping

        let label = "pdb";

        // Search Just the Header for PDB code ex. (1BU4), label used for graph datasets
        for(let i = 0; i < 10; i++) {
            if (pdbLines[i].substr(0, 6) === 'HEADER') {
                let head = pdbLines[i].match(/\S+/g); //header info, search
                head.forEach(i => {
                    let si = i.split('');
                    if (si.length == 4 && (!isNaN(parseFloat(si[0])) && isFinite(parseFloat(si[0])))) { //PDB IDs are 4 characters 1st character is always an integer checks for that
                        label = i;
                    }
                })
            }
        }

        // Called for each unique chain found in the system
        let pdbpositions = [];
        let prevChainId = "";
        let Amino: boolean = false;
        let atoms : pdbatom[] = [];
        let residues : pdbresidue[] = []; // individual residue data parsed from Atomic Info
        let chains : pdbchain[] = [];
        let na = new pdbatom();
        let nr = new pdbresidue();
        let nc = new pdbchain();

        // helper functions for calculating a1 vector of nucleotide
        function contains(target, pattern){
            var value = 0;
            pattern.forEach(function(word){
                value = value + target.includes(word);
            });
            return (value === 1)
        }

        // calculates a1 vector from nucleotide of Amino acid
        let calcA1FromRes = function(firstresidueunique){
            if(recongizedProteinResidues.indexOf(firstresidueunique.resType) > -1) {
                let scHAcom = new THREE.Vector3; //side chain Heavy atoms Center of Mass
                firstresidueunique.atoms.forEach(a => {
                    if (['N', 'C', 'O', 'H', 'CA'].indexOf(a.atomType) == -1) {
                        scHAcom.x += a.x;
                        scHAcom.y += a.y;
                        scHAcom.z += a.z;
                    }
                })
                // if null vector (glycine) a1 is 1, 0, 0
                if (scHAcom.lengthSq() == 0) scHAcom.x = 1;
                scHAcom.normalize();
                let CA = firstresidueunique.atoms.filter(a => a.atomType == 'CA')[0];
                if (CA) {
                    let CApos = new THREE.Vector3(<number>CA.x, <number>CA.y, <number>CA.z);
                    return scHAcom.clone().sub(CApos).normalize(); // this is the a1 vector
                } else {
                    notify("No CA coordinate found in Repeat Chain");
                    return new THREE.Vector3(1, 0, 0);
                }

            } else {
                let pairs;
                // Compute a1 Vector
                if (contains(firstresidueunique.resType, ["C", "T", "U"])) {
                    pairs = [["N3", "C6"], ["C2", "N1"], ["C4", "C5"]];
                } else {
                    pairs = [["N1", "C4"], ["C2", "N3"], ["C6", "C5"]];
                }

                let a1 = new THREE.Vector3(0, 0, 0);
                for (let i = 0; i < pairs.length; i++) {
                    let p_atom = firstresidueunique.atoms.filter(a => a.atomType == pairs[i][0])[0];
                    let q_atom = firstresidueunique.atoms.filter(a => a.atomType == pairs[i][1])[0];
                    let diff = new THREE.Vector3(p_atom.x - q_atom.x, p_atom.y - q_atom.y, p_atom.z - q_atom.z);
                    a1.add(diff);
                }
                a1.normalize();
                return a1;
            }
        }

        let chainindx = 0;
        let loadpdbsection = function(start, end): [boolean, THREE.Vector3[], pdbatom[], pdbresidue[], pdbchain[]] {
            pdbpositions = [];
            atoms = [];
            chains = [];
            residues = [];
            prevChainId = "";
            let prevResId = " ";
            // residue type has to be correct
            let Amino = recongizedProteinResidues.indexOf(pdbLines[start].substring(17, 20).trim()) >= 0;

            for(let j = start; j < end; j++){
                if (pdbLines[j].substr(0, 4) === 'ATOM') {
                    let pdbLine = pdbLines[j];
                    // http://www.wwpdb.org/documentation/file-format-content/format33/sect9.html#ATOM
                    na.indx = pdbLine.substring(6, 11).trim();
                    na.atomType = pdbLine.substring(12, 16).trim();
                    na.altLoc = pdbLine.substring(16, 17).trim();
                    na.resType = pdbLine.substring(17, 20).trim();

                    let chaincheck = pdbLine.substring(21, 22).trim() != ""; // chain is legit if filled at 21st character
                    if(!chaincheck){ // fill missing chain data
                        if(prevChainId == chainindx.toString()){
                            na.chainID = chainindx.toString();
                        }
                        else{
                            na.chainID = (chainindx+1).toString();
                        }

                        let tmp = pdbLine.substring(21, 27); // Location of residue identifer IF file is missing chain data
                        //check for insertion code
                        na.iCode = "";
                        if(isNaN(parseInt(tmp[5]))){
                            na.iCode = tmp[5];
                            na.pdbResIdent = tmp.slice(0, 5).trim()
                        } else {
                            na.pdbResIdent = tmp.trim();
                        }

                    } else {
                        let negative = false; // flag that triggers upon finding negative residues
                        let resIdentAddOn = '';
                        let tmpchainID = pdbLine.substring(21, 23).trim(); //changed to (21, 22) to (21, 23) to deal with 2 letter identifiers present in some PDB Files
                        if(tmpchainID.includes("-", -1)){
                            // negative numbered residues, yes they're real
                            negative = true;
                            tmpchainID = tmpchainID.substring(0, 1);
                        }


                        if(prevChainId.includes('9', -1)){ // number strand identifiers
                            if(isNaN(parseInt(tmpchainID.substr(0, 1))) && isNaN(parseInt(tmpchainID.substr(1, 1)))) {
                                na.chainID = tmpchainID
                            } else {
                                resIdentAddOn = tmpchainID.substr(1, 1);
                                na.chainID = tmpchainID.substr(0, 1);
                            }
                        } else {
                            if(!isNaN(parseInt(tmpchainID.substr(1, 1)))){
                                resIdentAddOn = tmpchainID.substr(1, 1);
                                na.chainID = tmpchainID.substr(0, 1);
                            } else {
                                na.chainID = tmpchainID
                            }
                        }

                        let tmp = pdbLine.substring(23, 29); // Usually the residue number
                        //check for insertion code
                        na.iCode = "";
                        if(isNaN(parseInt(tmp[5]))){ // not a number, most likely an insertion code
                            na.iCode = tmp[5];
                            if(!negative){
                                na.pdbResIdent = resIdentAddOn+tmp.slice(0, 5).trim()
                            } else {
                                na.pdbResIdent = '-'+resIdentAddOn+tmp.slice(0, 5).trim()
                            }

                        } else {
                            // is a number, most likely no insertion code and misplaced pbd residue number
                            if(!negative){
                                na.pdbResIdent = resIdentAddOn+tmp.trim();
                            } else {
                                na.pdbResIdent = '-'+resIdentAddOn+tmp.trim();
                            }
                        }
                    }

                    // Convert From Angstroms to Simulation Units while we're at it
                    na.x = parseFloat(pdbLine.substring(30, 38))/ 8.518;
                    na.y = parseFloat(pdbLine.substring(38, 46))/ 8.518;
                    na.z = parseFloat(pdbLine.substring(46, 54))/ 8.518;
                    na.occupancy = pdbLine.substring(54, 60).trim();
                    na.tempFactor = pdbLine.substring(60, 66).trim();
                    na.element = pdbLine.substring(76, 78).trim();
                    na.charge = pdbLine.substring(78, 80).trim();

                    if(Amino){
                        if(na.atomType == "CA") pdbpositions.push(new THREE.Vector3(na.x, na.y, na.z));
                    } else {
                        if(na.atomType == "N1") pdbpositions.push(new THREE.Vector3(na.x, na.y, na.z));
                    }

                    //checks if last read atom belongs to a different chain than the one before it, or if the Res Identifer has sudden jump
                    if (prevChainId !== na.chainID || (Math.abs(parseInt(na.pdbResIdent) - parseInt(prevResId)) > 1 && !isNaN(parseInt(prevResId)))) {
                        //notify("chain created");
                        chainindx += 1;
                        na.chainIndx = chainindx;
                        nc.chainID = na.chainID;
                        nc.chainIndx = na.chainIndx;
                        // copy is necessary
                        let ncc = {
                            ...nc
                        };
                        chains.push(ncc);
                        //set previous chain id to that of last read atom
                        prevChainId = na.chainID;
                    } else { // not a new chain, same chain index
                        na.chainIndx = chainindx;
                    }

                    //checks if last read atom belongs to a different chain than the one before it
                    if (prevResId != na.pdbResIdent) {
                        nr.resType = na.resType;
                        nr.pdbResIdent = na.pdbResIdent;
                        nr.chainID = na.chainID;
                        nr.chainIndx = na.chainIndx;

                        // copy is necessary
                        let nrc = {
                            ...nr
                        };
                        residues.push(nrc)
                        //set previous chain id to that of last read atom
                        prevResId = nrc.pdbResIdent;
                    }

                    // copy is necessary
                    let nac: pdbatom = {
                        ...na
                    };
                    atoms.push(nac);
                }
            }
            // info
            return [Amino, pdbpositions, atoms, residues, chains];
        }

        let getpdbpositions = function(start, end, Amino?): [THREE.Vector3[], THREE.Vector3] {
            // reads in pdb text and returns the positions b/t start and end linenumbers and the first residues a1 vector
            let pdbpositions = [];
            let atoms = [];
            let firstres = true;
            let prevResId;
            let a1;

            for(let j = start; j < end; j++) {

                if (pdbLines[j].substr(0, 4) === 'ATOM'){

                    if(firstres){
                        let pdbLine = pdbLines[j];
                        na.atomType = pdbLine.substring(12, 16).trim();
                        na.resType = pdbLine.substring(17, 20).trim();
                        let tmp = pdbLine.substring(23, 29); // Usually the residue number
                        //check for insertion code
                        na.iCode = "";
                        if(isNaN(parseInt(tmp[5]))){
                            na.iCode = tmp[5];
                            na.pdbResIdent = tmp.slice(0, 5).trim()
                        } else {
                            na.pdbResIdent = tmp.trim();
                        }
                        // Convert From Angstroms to Simulation Units while we're at it
                        na.x = parseFloat(pdbLine.substring(30, 38))/ 8.518;
                        na.y = parseFloat(pdbLine.substring(38, 46))/ 8.518;
                        na.z = parseFloat(pdbLine.substring(46, 54))/ 8.518;
                        // residue type has to be correct

                        if(atoms.length==0) prevResId = na.pdbResIdent;

                        //checks if last read atom belongs to a different Residue than the one before it
                        if (prevResId != na.pdbResIdent) { // will trigger after first residue is read
                            nr.resType = atoms[0].resType;
                            nr.pdbResIdent = atoms[0].pdbResIdent;
                            nr.atoms = atoms;

                            let nrc: pdbresidue = {
                                ...nr
                            };

                            a1 = calcA1FromRes(nrc);
                            firstres = false;

                        } else {
                            // copy is necessary
                            let nac: pdbatom = {
                                ...na
                            };
                            atoms.push(nac);
                        }
                    }

                    // Align via N1 positions for DNA & CA for proteins
                    if (!Amino && pdbLines[j].substring(12, 16).trim() == "N1"){
                        let x = parseFloat(pdbLines[j].substring(30, 38))/ 8.518;
                        let y = parseFloat(pdbLines[j].substring(38, 46))/ 8.518;
                        let z = parseFloat(pdbLines[j].substring(46, 54))/ 8.518;
                        pdbpositions.push(new THREE.Vector3(x, y, z));
                    } else if (Amino && pdbLines[j].substring(12, 16).trim() == "CA"){
                        let x = parseFloat(pdbLines[j].substring(30, 38))/ 8.518;
                        let y = parseFloat(pdbLines[j].substring(38, 46))/ 8.518;
                        let z = parseFloat(pdbLines[j].substring(46, 54))/ 8.518;
                        pdbpositions.push(new THREE.Vector3(x, y, z));
                    }
                }
            }
            // nr.atoms = this.atoms; //fill atoms array
            return [pdbpositions, a1];
        }



        // load all Unique Chains
        initList.uniqueIDs.forEach((id, indx) => {
            let alignTO = loadpdbsection(initList.uniqueStart[indx], initList.uniqueEnd[indx]);
            uniqatoms = uniqatoms.concat(alignTO[2]);
            uniqresidues = uniqresidues.concat(alignTO[3]);
            uniqchains = uniqchains.concat(alignTO[4]);

            // deal with repeats of each individual unique chain
            initList.repeatIDs.forEach((rid, rindx) => {
                if(id.includes(rid)){ //Makes sure Chain IDs contain original chain identifier
                    let alignME = getpdbpositions(initList.repeatStart[rindx], initList.repeatEnd[rindx], alignTO[0]); // [0] -> pdb positions [1] -> a1 vector of first residue

                    let firstresidueunique = uniqresidues[0];
                    firstresidueunique.atoms = uniqatoms.filter(atom => atom.chainIndx == firstresidueunique.chainIndx && atom.pdbResIdent ==  firstresidueunique.pdbResIdent)
                    let uniqa1 = calcA1FromRes(firstresidueunique);
                    let repeata1 = alignME[1];

                    if(alignME[0].length != alignTO[1].length) notify("PDB Error: Master chain and repeat chain have unequal lengths: "+alignME[0].length.toString()+" "+alignTO[1].length.toString());
                    // currently the rotation doesn't work as desired, but is not necessary at this stage
                    // b/c protein a1 and a3 are arbitrary (for now), and dna repeat strands don't seem to exist in wild pdbs
                    // let alignMEcoord = alignME[0].map(x => {return x.clone()}); //copy our arrays
                    let newcoords = alignME[0].map(x => {return x.clone()}); //copy our arrays
                    // let alignTOcoord = alignTO[1].map(x => {return x.clone()});//copy our arrays

                    // let uniqueCOM = alignTO[1].reduce((a,b) => a.add(b)).divideScalar(alignTO[1].length);
                    // let repeatCOM = alignME.reduce((a,b) => a.add(b)).divideScalar(alignME.length);
                    //
                    // let aME = alignMEcoord[0].clone().sub(repeatCOM).normalize();
                    // let aTO = alignTOcoord[0].clone().sub(uniqueCOM).normalize();
                    // notify(aME.x.toString() + " " + aME.y.toString() + " " + aME.z.toString());
                    // notify(aTO.x.toString() + " " + aTO.y.toString() + " " + aTO.z.toString());
                    //Calc quaternion rotation between vectors
                    // let rotQuat = new THREE.Quaternion().setFromUnitVectors(uniqa1, repeata1);
                    let rotQuat = new THREE.Quaternion().setFromUnitVectors(repeata1, uniqa1);
                    // let rotQuat = new THREE.Quaternion().setFromUnitVectors(aME, aTO);
                    // let newcoords = alignMEcoord;
                    initList.repeatCoords[rindx] = newcoords;
                    initList.repeatQuatRots[rindx] = rotQuat;
                }
            })
        })

        // Assigns Atoms to their corresponding Residues
        uniqresidues.forEach((res: pdbresidue) => {
            res.atoms = uniqatoms.filter(atom => atom.chainIndx == res.chainIndx && atom.pdbResIdent ==  res.pdbResIdent)
        });

        // Assigns Residues to their corresponding Chain
        uniqchains.forEach((chain: pdbchain) => {
            chain.residues = uniqresidues.filter(res => res.chainIndx == chain.chainIndx)
        });

        if (uniqchains.length == 0){
            notify("No Chains Found in PDB File");
            return;
        }
        if (uniqatoms.length == 0){
            notify("No Atoms Found in PDB File");
            return;
        }

        // Rewrite initlist.uniqueIDs to take into account subchains (labeled but no TER statements) found in the PDB file
        // Won't work for repeated copies of subchains (something to look out for in the future)
        initList.uniqueIDs = uniqchains.map(x => {return x.chainID});

        // These hefty objects are needed to calculate the positions & a1, a3 of nucleotides and amino acids
        let pdbinfo = new pdbinfowrapper(label, uniqchains, initList);
        pdbinfo.disulphideBonds = dsbonds; // Store Disulphide Bonds
        pdbFileInfo.push(pdbinfo); // Store Info in this global array so onloadend can access the info

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
        let pindx = pdbFileInfo.indexOf(pdata);
        let strands = pdata.pdbsysinfo;
        let label = pdata.pdbfilename;
        let initlist = pdata.initlist;
        // Looking back at this the strands as a variable name probably wasn't the most unique choice
        // strands is meant to be the chain object from the PDB Parser passed through the pdbsysinfo of the pdbdata
        // Parses PDB Data and Intializes System, Errors go to the Console


        // Intialize bookkeeping Members for Boolean Checks
        let checker = {
            DNAPresent: false,
            proteinPresent: false,
            RNAPresent: false,
            mutantStrand: false
        };

        //Classify Residue Types
        for (let i: number = 0; i < initlist.uniqueIDs.length; i++) {
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
                        notify("Nucleotide Base type 'DN' (for Generic Nucleic Acid) in PDB File. Replacing with 'DA'");
                        res.resType = 'DA';
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
                        notify("Amino Acid blank is Unknown, shown in grey");
                        res.resType = undefined;
                    }
                    // Sets which Residues are Intialized
                    res.type = 'pro';
                    // Bookkeeping
                    checker.proteinPresent = true;

                } else if (recongizedRNAResidues.indexOf(res.resType) > -1 || recongizedRNAStrandEnds.indexOf(res.resType) > -1) {
                    // Deal with Special Cases Here
                    if (res.resType === 'N') {
                        notify("Nucleotide has Residue Base type 'N' for Generic Nucleic Acid in PDB File, shown in grey");
                        res.resType = undefined;
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
                    notify("Residue type: "+res.resType+" Residue Number: "+res.pdbResIdent+ " on chain: " +strand.chainID+"in Provided PDB is Not Supported. " +
                        "It will not be Intialized in the Viewer.");
                    res.type = 'unworthy';
                }
            });

            // Corrects wrong identifers for DNA or RNA
            if(checker.DNAPresent && checker.RNAPresent){
                let restypestmp = strand.residues.map(x=>x.resType);
                let Upresent = restypestmp.indexOf('U') > -1 // U is our check on whether its RNA or not
                if(Upresent){ //Assume RNA
                    checker.DNAPresent = false;
                } else { // Assume DNA
                    checker.RNAPresent = false;
                }
            }

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

        //Helper values
        let bv1 = new THREE.Vector3(1, 0, 0);
        let bv2 = new THREE.Vector3(0, 1, 0);
        let bv3 = new THREE.Vector3(0, 0, 1);
        let proelem = {
            "LYS": "K",
            "CYS": "C",
            "CYX": "C",
            "ALA": "A",
            "THR": "T",
            "GLU": "E",
            "GLN": "Q",
            "SER": "S",
            "ASP": "D",
            "ASN": "N",
            "HIS": "H",
            "HSD": "H",
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
        let type: string = "";
        let pdbid: string = "";
        let a3 = new THREE.Vector3();
        // This Function calculates all necessary info for an Amino Acid in PDB format and writes it to initInfo
        let CalcInfoAA = (res: pdbresidue): [string, string, THREE.Vector3, THREE.Vector3, THREE.Vector3, number] => {
            //Set Type
            type = proelem[res.resType]; //Set Type Based Off Three Letter Codes
            pdbid = res.pdbResIdent;
            let scHAcom = new THREE.Vector3; //side chain Heavy atoms Center of Mass
            res.atoms.forEach(a => {
                if (['N', 'C', 'O', 'H', 'CA'].indexOf(a.atomType) == -1) {
                    scHAcom.x += a.x;
                    scHAcom.y += a.y;
                    scHAcom.z += a.z;
                }
            })
            // if null vector (glycine) a1 is 1, 0, 0
            if (scHAcom.lengthSq() == 0) scHAcom.x = 1;
            scHAcom.normalize();
            let CA = res.atoms.filter(a => a.atomType == 'CA')[0];
            if(CA) {
                let CApos = new THREE.Vector3(<number>CA.x, <number>CA.y, <number>CA.z);
                let CABfactor = parseFloat(CA.tempFactor);

                let a1 = scHAcom.clone().sub(CApos).normalize();
                if (a1.dot(bv1) < 0.99) {
                    a3 = a1.clone().cross(bv1);
                } else if (a1.dot(bv2) < 0.99) {
                    a3 = a1.clone().cross(bv2);
                } else if (a1.dot(bv3) < 0.99) {
                    a3 = a1.clone().cross(bv3);
                }
                return [pdbid, type, CApos, a1, a3, CABfactor];
            } else return ["NOCA", "NOCA", bv1, bv1, bv1, 0]
        }

        // Helper values
        let nucelems = {"DC": "C", "DC3": "C", "DC5":"C",  "DG": "G", "DG3": "G", "DG5":"G", "DT": "T", "DT3": "T", "DT5":"T", "T": "T", "T3": "T", "T5":"T", "DA": "A", "DA3": "A", "DA5":"A", "U": "U", "U3": "U", "U5":"U", "A": "A", "A3": "A", "A5":"A", "G": "G", "G3": "G", "G5":"G", "C": "C", "C3": "C", "C5":"C"}
        // type and pdbid don't need to be redeclared here
        let ring_names: string[] = ["C2", "C4", "C5", "C6", "N1", "N3"];
        let pairs: [string, string][];
        //Helper Function
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
        // This Function calculates all necessary info for a Nuclcleotide in PDB format and writes it to initInfo
        let CalcInfoNC = (res: pdbresidue): [string, string, THREE.Vector3, THREE.Vector3, THREE.Vector3, number] => {
            // Info we want from PDB
            type = nucelems[res.resType];
            //Residue Number in PDB File
            pdbid = res.pdbResIdent;
            let nuccom = new THREE.Vector3;
            let baseCom = new THREE.Vector3;
            //Calculate Base atoms Center of Mass
            let base_atoms = res.atoms.filter(a => a.atomType.includes("'") || a.atomType.includes("*"));

            baseCom.x = base_atoms.map(a => a.x).reduce((a, b) => a + b);
            baseCom.y = base_atoms.map(a => a.y).reduce((a, b) => a + b);
            baseCom.z = base_atoms.map(a => a.z).reduce((a, b) => a + b);
            baseCom.divideScalar(base_atoms.length);

            let nanCheck = false;
            let Bfacts = res.atoms.map(a => {
                let b = parseFloat(a.tempFactor);
                if (isNaN(b)) {
                    notify("Bfactors contain NaN value, check formatting of provided PDB file");
                    nanCheck = true;
                    return;
                }
                return b;
            });

            if(nanCheck) return;

            let Bfactavg = Bfacts.map(a => a).reduce((a, b) => a+b);
            Bfactavg /= res.atoms.length;
            //sum bfactors of ind atoms

            let o4atom = res.atoms.filter(a => a.atomType == "O4'")[0];
            let o4pos = new THREE.Vector3(o4atom.x, o4atom.y, o4atom.z);
            let parallel_to = o4pos.sub(baseCom);

            //Calculate Center of Mass

            nuccom.x = res.atoms.map(a => a.x).reduce((a, b) => a + b);
            nuccom.y = res.atoms.map(a => a.y).reduce((a, b) => a + b);
            nuccom.z = res.atoms.map(a => a.z).reduce((a, b) => a + b);
            let l = res.atoms.length;
            let pos = nuccom.divideScalar(l);

            // Compute a1 Vector
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
            if (["C", "T", "U"].indexOf(type) > -1) {
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

            return [pdbid, type, pos, a1, a3, Bfactavg]
        }

        let nextElementId = elements.getNextId();
        let oldElementId = nextElementId;

        let initInfo: [string, string, THREE.Vector3, THREE.Vector3, THREE.Vector3, number][] = [];
        //Make System From the PDB Information
        let sys = new System(sysCount, nextElementId);
        // First Loop to Map Out the System
        let com = new THREE.Vector3();
        // Store B-factor Information Here
        let bFactors = [];
        let xdata = [];
        for (let i: number = 0; i < (initlist.uniqueIDs.length); i++) {
            let nstrand = strands[i];

            if (nstrand.strandtype == 'pro') {
                let currentStrand: Peptide = sys.addNewPeptideStrand();
                // currentStrand.system = sys;
                let strandInfo = [];
                for (let j = 0; j < nstrand.residues.length; j++) {
                    let aa = currentStrand.createBasicElement(nextElementId);
                    aa.sid = nextElementId - oldElementId;
                    let info = CalcInfoAA(nstrand.residues[j]);
                    if(info[1] != "NOCA"){ // If C-Alpha Coordinates found
                        initInfo.push(info);
                        strandInfo.push(info);
                        bFactors.push(info[5]);
                        xdata.push(aa.sid);
                        com.add(info[2]); //Add position to COM calc
                        // pdbFileInfo Index, chain index, pdbResIdent
                        aa.setPDBIndices(pindx, initlist.uniqueIDs[i], info[0]);
                        // Amino Acids are intialized from N-terminus to C-terminus
                        // Same as PDB format
                        // Neighbors must be filled for correct initialization
                        aa.n3 = null;
                        aa.n5 = null;
                        if (j != 0) {
                            let prevaa = elements.get(nextElementId - 1); //Get previous Element
                            aa.n3 = prevaa;
                            prevaa.n5 = aa;
                        }
                        elements.push(aa);
                        nextElementId++;
                    }
                }
                currentStrand.updateEnds();

                // Take care of repeats Access by Chain Identifier
                initlist.repeatIDs.forEach((rid, indx) => {
                    if(nstrand.chainID.includes(rid)){ // Repeat same chain
                        let repeatStrand: Peptide = sys.addNewPeptideStrand();
                        currentStrand.getMonomers().forEach((mon, mid) => {
                            // basically just copy the strand we just built using the sotred init info and repeat chain info
                            let repeatAmino = repeatStrand.createBasicElement(nextElementId);
                            repeatAmino.pdbindices = (mon as AminoAcid).pdbindices;
                            repeatAmino.sid = nextElementId - oldElementId;
                            let rinfo = strandInfo[mid].slice(); // copy originals initialization info
                            let rotquat = initlist.repeatQuatRots[indx];
                            rinfo[3] = rinfo[3].applyQuaternion(rotquat) // Rotate a1
                            rinfo[4] = rinfo[4].applyQuaternion(rotquat) // Rotate a3
                            rinfo[2] = initlist.repeatCoords[indx][mid];
                            bFactors.push(rinfo[5]) // Assume same B factors
                            xdata.push(repeatAmino.sid)
                            com.add(rinfo[2])
                            initInfo.push(rinfo);
                            repeatAmino.n3 = null;
                            repeatAmino.n5 = null;
                            if (mid != 0) { // not first element of strand
                                let prevaa = elements.get(nextElementId - 1); //Get previous Element
                                repeatAmino.n3 = prevaa;
                                prevaa.n5 = repeatAmino;
                            }
                            elements.push(repeatAmino);
                            nextElementId++;
                        });
                        repeatStrand.updateEnds();
                    }
                });

            } else if (nstrand.strandtype == 'rna' || nstrand.strandtype == 'dna') {
                let currentStrand: NucleicAcidStrand = sys.addNewNucleicAcidStrand();
                let strandInfo = [];
                //PDB entries typically list from 5' to 3'
                //Neighbors must be filled for correct initialization
                let pdbres3to5 = nstrand.residues.reverse(); // Flipped Order so it reads 3'  to 5'
                for (let j = 0; j < nstrand.residues.length; j++) {
                    //For getting center of mass
                    try{
                        let info = CalcInfoNC(pdbres3to5[j]);
                        initInfo.push(info);
                        strandInfo.push(info);
                        com.add(info[2]); //Add position to COM calc

                        let nc = currentStrand.createBasicElement(nextElementId);
                        nc.n3 = null;
                        nc.n5 = null;
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
                    } catch (e) {
                        notify("Nucleotide could not be initialized");
                    }

                }
                currentStrand.updateEnds();


                // Take care of repeats Access by Chain Identifier
                initlist.repeatIDs.forEach((rid, indx) => {
                    if(nstrand.chainID.includes(rid)){
                        let repeatStrand: NucleicAcidStrand = sys.addNewNucleicAcidStrand();
                        currentStrand.getMonomers(true).forEach((mon, mid) => {
                            let repeatNuc = repeatStrand.createBasicElement(nextElementId);
                            repeatNuc.sid = nextElementId - oldElementId;
                            try {
                                let rinfo = strandInfo[mid].slice(); // copy originals initialization info
                                let rotquat = initlist.repeatQuatRots[indx];
                                rinfo[3] = rinfo[3].applyQuaternion(rotquat) // Rotate a1
                                rinfo[4] = rinfo[4].applyQuaternion(rotquat) // Rotate a3
                                rinfo[2] = initlist.repeatCoords[indx][mid]; // New Position
                                bFactors.push(rinfo[5]) // Assume same B factors
                                xdata.push(repeatNuc.sid)
                                com.add(rinfo[2])
                                initInfo.push(rinfo);
                                repeatNuc.n3 = null;
                                repeatNuc.n5 = null;
                                // monomers go 5' to 3'
                                if (mid != 0) {
                                    let prevaa = elements.get(nextElementId - 1); //Get previous Element
                                    repeatNuc.n3 = prevaa;
                                    prevaa.n5 = repeatNuc;
                                }
                                elements.push(repeatNuc);
                                nextElementId++;
                            } catch (e) {
                                notify("Nucleotide could not be initialized");
                            }
                        });
                        repeatStrand.updateEnds();
                    }
                });
            }
        }

        com.divideScalar(sys.systemLength());
        let pdbBfactors = new graphData(label, bFactors, xdata, "bfactor", "A_sqr");
        graphDatasets.push(pdbBfactors);
        if(flux.fluxWindowOpen) view.addGraphData(graphDatasets.length-1); // add to flux window if open, otherwise it'll be added on next opening

        sys.initInstances(sys.systemLength())
        // This Function calculates all necessary info for an Amino Acid in PDB format and writes it to the system
        let FillInfoAA = (info: [string, string, THREE.Vector3, THREE.Vector3, THREE.Vector3, number], AM: AminoAcid, CM: THREE.Vector3) => {
            AM.type = info[1];
            let center = info[2].sub(CM);
            AM.calcPositions(center, info[3], info[4], true);
        }

        // This Function calculates all necessary info for a Nuclcleotide in PDB format and writes it to the system
        let FillInfoNC = (info: [string, string, THREE.Vector3, THREE.Vector3, THREE.Vector3, number], NC: Nucleotide, CM: THREE.Vector3) => {
            NC.type = info[1];
            let center = info[2].sub(CM);
            NC.calcPositions(center, info[3], info[4], true);
        }

        //Set box dimensions
        let xpos = initInfo.map((info) => {return info[2].x;});
        let ypos = initInfo.map((info) => {return info[2].y;});
        let zpos = initInfo.map((info) => {return info[2].z;});
        //built in Math.min and Math.max crash the program once xpos, ypos, and zpos reach a high length (N=300000 was my test case)
        let xmax = xpos.reduce((a,b) => {return Math.max(a, b)})
        let xmin = xpos.reduce((a,b) => {return Math.min(a, b)})
        let ymax = ypos.reduce((a,b) => {return Math.max(a, b)})
        let ymin = ypos.reduce((a,b) => {return Math.min(a, b)})
        let zmax = zpos.reduce((a,b) => {return Math.max(a, b)})
        let zmin = zpos.reduce((a,b) => {return Math.min(a, b)})
        let xdim= xmax - xmin;
        let ydim= ymax - ymin;
        let zdim= zmax - zmin;
        if(xdim < 2) xdim = 2.5;
        if(ydim < 2) ydim = 2.5;
        if(zdim < 2) zdim = 2.5;

        if(box.x < xdim) box.x = xdim*1.25;
        if(box.y < ydim) box.y = ydim*1.25;
        if(box.z < zdim) box.z = zdim*1.25;
        redrawBox();

        // Second Loop Going through Exactly the same way
        // Fill Info Functions called on each element to initialize type specific
        let Amino: AminoAcid;
        let Nuc: Nucleotide;
        nextElementId = oldElementId; //Reset

        for (let i: number = 0; i < (initlist.uniqueIDs.length+initlist.repeatIDs.length); i++) {
            let strand = sys.strands[i];

            if (strand.isPeptide()) {
                for (let k = 0; k < strand.getLength(); k++) {
                    Amino = elements.get(nextElementId) as AminoAcid;
                    FillInfoAA(initInfo[nextElementId-oldElementId], Amino, com);
                    nextElementId++;
                }
            } else if (strand.isNucleicAcid()) {
                for (let k = 0; k < strand.getLength(); k++) {
                    Nuc = elements.get(nextElementId) as Nucleotide;
                    FillInfoNC(initInfo[nextElementId-oldElementId], Nuc, com);
                    nextElementId++;
                }
            }
        }

        //System is set Up just needs to be added to the systems array now I believe
        addSystemToScene(sys);
        systems.push(sys);
        sysCount++;
    }
}
