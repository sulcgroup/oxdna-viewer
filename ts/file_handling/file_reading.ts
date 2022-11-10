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
            sequence: (document.getElementById("importCadnanoScaffoldSeq") as HTMLSelectElement).value,
            default_val: (document.getElementById("importCadnanoDefaultVal") as HTMLSelectElement).value
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
        for (let j = 0; j < end; j++) { //insert lut colors into lutCols[] to toggle Lut coloring later
            system.lutCols[j] = lut.getColor(Number(system.colormapFile[key][elements.get(systems[i].globalStartId + j).sid]));
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

    let datFile, topFile, jsonFile, trapFile, parFile, idxFile, hbFile, pdbFile, massFile, particleFile, patchFile,loroPatchFiles, scriptFile; //this sets them all to undefined.


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
        else if (ext=="js"){
            scriptFile = files[i];
            //readScriptFile(files[i]);
            //return;
        }
        else if (ext === "mgl"){
            readMGL(files[i]);
            return;
        }
        else if (ext === "pdb" || ext === "pdb1" || ext === "pdb2") { // normal pdb and biological assemblies (.pdb1, .pdb2)
            pdbFile = files[i];
        }
        else if (ext === "unf") {
            readUNFfile(files[i]);
            return;
        }
        else if (ext === "xyz") {
            readXYZfile(files[i]);
            return;
        }
        // everything else is read in the context of other files so we need to check what we have.
        else if (
            ext === "patchspec" ||
            fileName.match(/p_my\w+\.dat/g) // Why do multiple files need to end with dat?
        ) {
            if (loroPatchFiles == undefined){
                loroPatchFiles = [];
            }
            loroPatchFiles.push(files[i]);
        }
        else if (["dat", "conf", "oxdna"].includes(ext)) datFile = files[i];
        else if (ext === "top") topFile = files[i];
        else if (ext === "json") jsonFile = files[i];
        else if (fileName.includes("particles") || fileName.includes("loro") || fileName.includes("matrix")) particleFile = files[i];
        else if ( fileName.includes("patches")) patchFile = files[i];
        else if (ext === "txt" && (fileName.includes("trap") || fileName.includes("force") )) trapFile = files[i];
        else if (ext === "txt" && (fileName.includes("_m"))) massFile = files[i];
        else if (ext === "idx") idxFile = files[i];
        else if (ext === "par") parFile = files[i];
        else if (ext === "hb") hbFile = files[i];
        // otherwise, what is this?
        else {
            notify("This reader uses file extensions to determine file type.\nRecognized extensions are: .conf, .dat, .oxdna, .top, .json, .par, .pdb, .mgl, .xyz, and trap.txt\nPlease drop one .dat/.conf/.oxdna and one .top file.  Additional data files can be added at the time of load or dropped later.")
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
    // same dirty logic as the event fix 
    // we ensure this way that the script is not handeled 2ce
    handledScript = false;
    //read a topology/configuration pair and whatever else
    readFiles(topFile, datFile, idxFile, jsonFile, trapFile, parFile, pdbFile, hbFile, massFile, particleFile, patchFile, loroPatchFiles,scriptFile);

    render();
    return
}

const cylinderMesh = function (pointX, pointY, r, material) {
    // https://stackoverflow.com/questions/15316127/three-js-line-vector-to-cylinder
    // edge from X to Y
    var direction = new THREE.Vector3().subVectors(pointY, pointX);
    // Make the geometry (of "direction" length)
    var geometry = new THREE.CylinderGeometry(r, 0, direction.length(), 10, 4);
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
                let color_value:THREE.Color;
                if(color.indexOf(",")>-1){
                    //we have a an rgb color definition
                    let rgb = color.split(",").map(s => parseFloat(s));
                    color_value = new THREE.Color(rgb[0],rgb[1],rgb[2]);
                }
                else{
                    color_value = new THREE.Color(color);
                }

                // main particle
                const geometry = new THREE.SphereGeometry( MGL_D, 10, 10 );
                const material = new THREE.MeshPhongMaterial( {color: color_value} );
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

                    if(patch_color.indexOf(",")>-1){
                        //we have a an rgb color definition
                        let rgb = patch_color.split(",").map(s => parseFloat(s));
                        color_value = new THREE.Color(rgb[0],rgb[1],rgb[2]);
                    }
                    else{
                        color_value = new THREE.Color(patch_color);
                    }


                    const material = new THREE.MeshPhongMaterial( {color: color_value} );
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
    } else {
        forceHandler.set(forces);
    }
    render()
}

function readPBFromId(pdbID: string) {
    readFilesFromPath([`https://files.rcsb.org/download/${pdbID}.pdb`]);
}

function readNanobaseFromURL(url: string) {
    const id = url.split('/').pop();
    const path = `https://nanobase.org/oxdna/${id}`
    let req = new XMLHttpRequest();
    req.open("GET", path);
    req.onload = () => {
        let file_names = req.response.split('|');
        file_names = file_names.map(file_name => `https://nanobase.org/file/${id}/structure/${file_name}`)
        readFilesFromPath(file_names);
    }
    req.send();
}

// Files can also be retrieved from a path
function readFilesFromPath(paths: string[]) {
    const promises = paths.map(p => new Promise (resolve => {
        let req = new XMLHttpRequest();
        req.open("GET", p);
        req.responseType = "blob";
        req.onload = () => {
            let f = req.response;
            f.name = p.split('/')
            f.name = f.name[f.name.length -1]
            f.type = ''
            resolve(f);
        }
        req.send();
    }));

    //file list isn't actually a type with a constructor, but there's nothing in handleFiles() where it doesn't behave like an array.
    Promise.all(promises).then((files) => {
        handleFiles(files as unknown as FileList)
    })
}

//fancy function to read files from args for electron parameters
function readFilesFromPathArgs(args){

    let activity = Metro.activity.open({
        type: 'square',
        overlayColor: '#fff',
        overlayAlpha: 1,
        text: "Loading files from arguments."
    });

    // Set wait cursor and request an animation frame to make sure
    // that it gets changed before starting calculation:
    let dom = document.activeElement;
    dom['style'].cursor = "wait";

    const done = () => {
        // Change cursor back and remove modal
        dom['style'].cursor = "auto";
        Metro.activity.close(activity);
    }

    let datFile, topFile, jsonFile, trapFile, parFile, idxFile, hbFile, pdbFile, massFile, particleFile, patchFile, loroPatchFiles; //this sets them all to undefined.
    const  get_request = (paths) => {
           if(paths.length == 0) {
                //read a topology/configuration pair and whatever else
                readFiles(topFile, datFile, idxFile, jsonFile, trapFile, parFile, pdbFile, hbFile, massFile, particleFile, patchFile, loroPatchFiles);
                done();
           }
           else {
            let path = paths.pop();
            let req = new XMLHttpRequest();
            // get file extension
            const fileName = path.toLowerCase();
            const ext = fileName.split('.').pop();

            console.log("get_request://",fileName);

            req.open("GET", path);
            req.responseType = "blob";
            req.onload = () => {
                const file = req.response;
                file.name = fileName; // we need to pass the fileName as it's missing in the file object from the get_request
                //assign the file to the correct variable
                if (["dat", "conf", "oxdna"].includes(ext)) datFile = file;
                else if (ext === "top") topFile = file;
                else if (ext === "json") jsonFile = file;
                else if (ext === "txt" && (fileName.includes("trap") || fileName.includes("force") )) trapFile = file;
                else if (ext === "txt" && (fileName.includes("_m"))) massFile = file;
                else if (ext === "idx") idxFile = file;
                else if (ext === "par") parFile = file;
                else if (ext === "hb") hbFile = file;
                else if (ext === "pdb" || ext === "pdb1" || ext === "pdb2") pdbFile = file;
                else if (ext === "patchspec") {
                    if (loroPatchFiles == undefined){
                        loroPatchFiles = [];
                    }
                    loroPatchFiles.push(file);
                }
                else if (fileName.includes("particles") || fileName.includes("loro") || fileName.includes("matrix"))
                    particleFile = file;
                // otherwise, what is this?
                else if (fileName.includes("patches"))
                    patchFile = file;
                // otherwise, what is this?
                else {
                    notify("This reader uses file extensions to determine file type.\nRecognized extensions are: .conf, .dat, .oxdna, .top, .json, .par, .pdb, mgl, and trap.txt\nPlease drop one .dat/.conf/.oxdna and one .top file.  Additional data files can be added at the time of load or dropped later.")
                    done();
                    return
                }
                if (ext === "oxview") {
                    readOxViewJsonFile(file);
                    done();
                    return;
                }
                else if (ext === "mgl"){
                    readMGL(file);
                    done();
                    return;
                }

                get_request(paths);
            }
            req.onerror = () => {done()};
            req.send();
        }
    }
    if(args.length > 0) {
        get_request(args);
    }
}

// And from the URL
function readFilesFromURLParams() {
    let paths = []
    const types = ['file', 'pdb', 'topology', 'configuration', 'overlay', 'force', 'par', 'oxview', 'hb', 'mgl', 'idx', 'json']
    const url = new URL(window.location.href);
    types.forEach(t =>{
        if (url.searchParams.get(t)) {
            paths.push(...url.searchParams.getAll(t))
        }
    })
    if (paths.length > 0) {
        readFilesFromPath(paths)
    }
}

var trajReader :TrajectoryReader;
let initFileReading = true; // dirty hack to keep the event handling in check 
let handledScript = false;

// Now that the files are identified, make sure the files are the correct ones and begin the reading process
function readFiles(topFile: File, datFile: File, idxFile:File, jsonFile?: File, trapFile?: File, parFile?: File, pdbFile?: File, hbFile?: File, massFile?: File, particleFile?: File, patchFile?: File, loroPatchFiles?: File[],scriptFile?:File) {
    
    if(initFileReading){
        // TODO: apart from a drastic rewrite... 
        // Figure out if any other places have the bug of adding N event handlers ...
        //setupComplete fires when indexing arrays are finished being set up
        //prevents async issues with par and overlay files
        
        
        document.addEventListener('setupComplete', readAuxiliaryFiles);
        
        document.addEventListener('setupComplete', ()=>{
            if(scriptFile && !handledScript){
                
                readScriptFile(scriptFile);
            }
        });

        initFileReading = false;
    }
    
    if (topFile && datFile) {
        renderer.domElement.style.cursor = "wait";

        if(typeof loroPatchFiles !== "undefined" || typeof particleFile !== "undefined"){
            //make system to store the dropped files in
            const system = new PatchySystem(
                sysCount, particleFile, patchFile, 
                loroPatchFiles, (callback)=>
            {
                //we handle patchy files
                const patchyTopologyReader = new PatchyTopReader(topFile, system, elements,()=>{
                    //fire dat file read from inside top file reader to make sure they don't desync (large protein files will cause a desync)
                    trajReader = new TrajectoryReader(datFile,patchyTopologyReader, system, elements);
                    trajReader.indexTrajectory();

                    //set up patchy instancing data arrays
                    system.initPatchyInstances();

                    callback();
                });
                patchyTopologyReader.read();
            });
            systems.push(system); //add system to Systems[]
        } else {
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
    if(scriptFile  && !handledScript){
        readScriptFile(scriptFile);
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
        if (massFile){
            const r = new FileReader();
            r.onload = ()=> {
                readMassFile(r);
            }
            r.readAsText(massFile);
        }
        //document.removeEventListener('setupComplete', readAuxiliaryFiles, false);
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

function readScriptFile(file: File){

    let reader = new FileReader();
    reader.onload=(e)=>{
        handledScript=true;
        eval(e.target.result as string); // hacky, but should do the trick 
    };
    reader.readAsText(file);
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
                            const zero = new THREE.Vector3();
                            e.calcPositions(p, zero, zero, true); // Amino acid
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
            
            if(data.selections){
                data.selections.forEach((selection_element) =>{
                    selectionListHandler.append(
                        new Set(api.getElements(selection_element[1])),
                                selection_element[0]
                    )
                })
            }
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
    const net = new Network(networks.length, system.getAAMonomers());

    //process connections
    for (let i = 0; i < size; i++) {
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
        if(Number.isInteger(p) && Number.isInteger(q)){
            net.reducedEdges.addEdge(p, q, eqDist, type, strength, extraParams);
        }
        // if (particle1 == undefined) console.log(i)
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

    if (system.isPatchySystem()) {
        // Patchy particle geometries
        let s = system as PatchySystem;
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
    }



    // Let the other file readers know that it's safe to reference system properties
    document.dispatchEvent(new Event('setupComplete'))

    // Reset the cursor from the loading spinny and reset canvas focus
    renderer.domElement.style.cursor = "auto";
    if (!inIframe()){
        canvas.focus();
    }
}


window.addEventListener("message", (event) => {
    if(event.data.message){ // do we have a message ?
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
        else if(event.data.message === 'iframe_drop'){
            let files = event.data.files;
            let ext = event.data.ext;
            let inbox_settings = event.data.inbox_settings;
            if(files.length != ext.length){
                notify("make sure you pass all files with extenstions");
                return
            }
            //if present change the preference for inboxing
            if(inbox_settings){
                view.inboxingMode.set(inbox_settings[0]);
                view.centeringMode.set(inbox_settings[1]);
                centerAndPBCBtnClick();
            }
            //set the names and extensions for every passed file
            for(let i =0; i< files.length; i++){
                files[i].name = `${i}.${ext[i]}`;
                
            }
            handleFiles(files);
            return
        }
        else {
            console.log(event.data.message, "is not a recognized message")
            return
        }
    }
}, false);

// associates massfile with last loaded system (only needed for Generic Sphere Systems)
function readMassFile(reader){
    let lines = (reader.result as string).split(/[\n]+/g);
    let key ={
        indx: [],
        mass: [],
        radius: []
    }

    if(parseInt(lines[0]) > 27){  // subtypes 0-27 taken by dna/protein subtypes
        //remove the header
        lines = lines.slice(1)
        const size = lines.length;
        for (let i = 0; i < size; i++) {
            let l = lines[i].split(" ")
            //extract values
            const p = parseInt(l[0]),
                mass = parseInt(l[1]),
                radius = parseFloat(l[2]);

            if(p > 26){
                key.indx.push(p-27);
                key.mass.push(mass);
                key.radius.push(radius);
            }

        }

        // change all generic sphere radius and mass according to mass file
        let sub, indx, gs;
        systems.forEach(sys => {
            sys.strands.forEach(strand => {
                if(strand.isGS()){
                    let mon = strand.getMonomers();
                    mon.forEach(be => {
                        sub = parseInt(be.type.substring(2))
                        indx = key.indx.indexOf(sub);
                        if(indx == -1){
                            console.log("Subtype " + sub.toString() + " not found in the provided mass file");
                        } else {
                            gs = <GenericSphere>be;
                            gs.updateSize(key.mass[indx], key.radius[indx]);
                        }
                    })
                }
            })
        })


    } else {
        console.log("No GS Masses in file, (no subtype over 27), double check header")
    }
}

function readPdbFile(file) {
    let reader = new FileReader();
    var worker = new Worker('./dist/file_handling/pdb_worker.js');
    let indx = -1;

    reader.onload = () => {
        const pdbLines = (reader.result as string).split(/[\n]+/g);
        // feed pdbLines into worker
        let transfer = [pdbLines, pdbFileInfo.length, elements.getNextId(), sysCount];
        worker.postMessage(transfer);
    }

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
                    if(box.x < dims[0]) box.x = dims[0]*1.25;
                    if(box.y < dims[1]) box.y = dims[1]*1.25;
                    if(box.z < dims[2]) box.z = dims[2]*1.25;
                    redrawBox();

                    dims = undefined;

                    // initialize System
                    let sys = new System(sysCount, startID);
                    for(let i = 0; i< pdbtemp[0].length; i++){
                        if(strandID[i] == "pro"){
                            let currentstrand = sys.addNewPeptideStrand()
                            for(let j = 0; j < pdbtemp[0][i].length; j++){
                                let AA = currentstrand.createBasicElement(id);
                                AA.sid = id - startID;
                                AA.pdbindices = pdbindices[AA.sid];
                                if (j != 0) {
                                    let prevaa = elements.get(id-1); //Get previous Element
                                    AA.n3 = prevaa;
                                    prevaa.n5 = AA;
                                }
                                elements.push(AA);
                                id++;
                            }

                            if(currentstrand.end3 == undefined){
                                console.log("Strand " + currentstrand.id + " could not be initialized")
                            } else {
                                currentstrand.updateEnds();
                            }
                        } else if (['dna', 'rna'].includes(strandID[i])){ //DNA or RNA
                            let currentstrand = sys.addNewNucleicAcidStrand();
                            for(let j = 0; j < pdbtemp[0][i].length; j++){
                                let nc = currentstrand.createBasicElementTyped(strandID[i], id);
                                nc.sid = id - startID;
                                nc.pdbindices = pdbindices[nc.sid];
                                if (j != 0) {
                                    let prevnc = elements.get(id-1); //Get previous Element
                                    nc.n3 = prevnc;
                                    prevnc.n5 = nc;
                                }
                                elements.push(nc);
                                id++;
                            }

                            if(currentstrand.end3 == undefined){
                                console.log("Strand " + currentstrand.id + " could not be initialized")
                            } else {
                                currentstrand.updateEnds();
                            }
                        }
                    }

                    sys.initInstances(sys.systemLength())
                    // Load monomer info
                    let count = 0;
                    for (let i: number = 0; i < pdbtemp[0].length; i++) {
                        let strand = sys.strands[i];

                        if (strand.isPeptide()) {
                            for (let k = 0; k < strand.getLength(); k++) {
                                let Amino = elements.get(startID+count) as AminoAcid;
                                FillInfoAA(pdbtemp[0][i][k], Amino, com);
                                count++;
                            }
                        } else if (strand.isNucleicAcid()) {
                            for (let k = 0; k < strand.getLength(); k++) {
                                let Nuc = elements.get(startID+count) as Nucleotide;
                                FillInfoNC(pdbtemp[0][i][k], Nuc, com);
                                count++;
                            }
                        }
                    }

                    //System is set Up just needs to be added to the systems array now I believe
                    addSystemToScene(sys);
                    systems.push(sys);
                    sysCount++;


                    if(flux.fluxWindowOpen) view.addGraphData(graphDatasets.length-1); // add to flux window if open, otherwise it'll be added on next opening

                    // notify("ANM Fitting Complete, Please check under Available Datasets in the Fluctuation Solver");
                    resolve(message.data);
                }
            }
            worker.onmessage = callback;
            reader.readAsText(file); // Executes Loading reads file etc.
            notify("Reading PDB file...")
            // when it ends triggers addPDBtoScene
        });
        return promise;
    }

    activate();
    pdbtemp=[];

}

function readUNFfile(file: File) {
    let reader = new FileReader();
    reader.onload = (e) => {
        readUNFString(e.target.result as string);
    };
    reader.readAsText(file);
}

function readXYZfile(file: File) {
    let reader = new FileReader();
    reader.onload = (e) => {
        readXYZString(e.target.result as string);
    };
    reader.readAsText(file);
}
