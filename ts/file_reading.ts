/// <reference path="./three/index.d.ts" />

// chunk .dat file so its not trying to read the entire thing at once
function datChunker(datFile: Blob, currentChunk: number, chunkSize: number) {
    let sliced = datFile.slice(currentChunk * chunkSize, currentChunk * chunkSize + chunkSize);
    return sliced;
}

function extractNextConf() {
    let needNextChunk: boolean = false;
    let currentChunkLines: string[] = currentChunk.split(/[\n]+/g);
    let nextChunkLines: string[] = nextChunk.split(/[\n]+/g);
    let currentChunkLength: number = currentChunkLines.length;
    let nextConf: string[] = [];
    let start = new marker;
    if (confEnd.lineID != currentChunkLength) { //handle very rare edge case where conf ended exactly at end of chunk
        start.chunk = confEnd.chunk;
        start.lineID = confEnd.lineID + 1;
    }
    else {
        start.chunk = nextChunk;
        start.lineID = 0;
        needNextChunk = true;
    }

    let end = new marker;
    if (start.lineID + confLen <= currentChunkLength) { //is the whole conf in a single chunk?
        end.chunk = start.chunk;
        end.lineID = start.lineID + confLen - 1;
        for (let i = start.lineID; i < end.lineID + 1; i++) {
            if (currentChunkLines[i] == "" || currentChunkLines == undefined) { return undefined }
            nextConf.push(currentChunkLines[i]);
        }
    }
    else {
        end.chunk = nextChunk;
        end.lineID = confLen - (currentChunkLength - start.lineID) - 1;
        needNextChunk = true
        for (let i = start.lineID; i < currentChunkLength; i++) {
            if (currentChunkLines[i] == "" || currentChunkLines == undefined) { return undefined }
            nextConf.push(currentChunkLines[i]);
        }
        for (let i = 0; i < end.lineID + 1; i++) {
            nextConf.push(nextChunkLines[i]);
        }
    }
    confBegin = start;
    confEnd = end;
    if (needNextChunk) {
        getNextChunk(datFile, currentChunkNumber + 2); //current is the old middle, so need two ahead
    }
    else {
        // Signal that config has been loaded
        document.dispatchEvent(new Event('nextConfigLoaded'));
    }

    return (nextConf);
}

function extractPreviousConf() {
    let needPreviousChunk: boolean = false;
    let previousConf: string[] = []
    let end = new marker;
    if (confNum == 1) { //can't go backwards from 1
        return undefined
    }
    else if (confBegin.lineID != 0) { //handle rare edge case where a conf began at the start of a chunk
        end.chunk = confBegin.chunk;
        if (end.chunk == previousChunk) {
            needPreviousChunk = true;
        }
        end.lineID = confBegin.lineID - 1;
    }
    else {
        end.chunk = previousChunk;
        end.lineID = previousChunk.length - 1;
        needPreviousChunk = true;
    }
    let endChunkLines: string[] = end.chunk.split(/[\n]+/g);

    let start = new marker;
    if (end.lineID - confLen >= 0) { //is the whole conf in a single chunk?
        start.chunk = end.chunk;
        start.lineID = end.lineID - confLen + 1;
        let startChunkLines: string[] = start.chunk.split(/[\n]+/g);
        for (let i = start.lineID; i < end.lineID + 1; i++) {
            if (startChunkLines[i] == "" || startChunkLines == undefined) { return undefined }
            previousConf.push(startChunkLines[i]);
        }
    }
    else {
        if (end.chunk == currentChunk && confNum != 2) {
            start.chunk = previousChunk;
        }
        else if (end.chunk == previousChunk && confNum != 2) {
            start.chunk = previousPreviousChunk;
        }
        else {
            start.chunk = previousChunk;
        }
        let startChunkLines: string[] = start.chunk.split(/[\n]+/g);
        start.lineID = startChunkLines.length - (confLen - (end.lineID + 1));
        for (let i = start.lineID; i < startChunkLines.length; i++) {
            if (startChunkLines[i] == "" || startChunkLines == undefined) { return undefined }
            previousConf.push(startChunkLines[i]);
        }
        for (let i = 0; i < end.lineID + 1; i++) {
            if (endChunkLines[i] == "" || endChunkLines == undefined) { return undefined }
            previousConf.push(endChunkLines[i]);
        }
    }
    confBegin = start;
    confEnd = end;
    if (needPreviousChunk) {
        getPreviousChunk(datFile, currentChunkNumber - 3);
    }
    return (previousConf);
}

function getNextChunk(datFile, chunkNumber) {
    previousPreviousChunk = previousChunk;
    ppHangingLine = pHangingLine;
    previousChunk = currentChunk;
    pHangingLine = cHangingLine;
    currentChunk = nextChunk;
    cHangingLine = nHangingLine;

    let nextChunkBlob = datChunker(datFile, chunkNumber, approxDatLen);
    nextReader.readAsText(nextChunkBlob);
    currentChunkNumber += 1;
}

function getPreviousChunk(datFile, chunkNumber) {
    nextChunk = currentChunk;
    nHangingLine = cHangingLine;
    currentChunk = previousChunk;
    cHangingLine = pHangingLine;
    previousChunk = previousPreviousChunk;
    pHangingLine = ppHangingLine;

    if (chunkNumber < 0) {
        console.log("tried to load conf -1");
        if (previousPreviousChunk == undefined) {
            previousChunk = undefined;
        }
        else {
            previousPreviousChunk = undefined;
        }
        currentChunkNumber -= 1;
        return
    }

    let previousPreviousChunkBlob = datChunker(datFile, chunkNumber, approxDatLen);
    previousPreviousReader.readAsText(previousPreviousChunkBlob);
    currentChunkNumber -= 1
}

class marker {
    chunk: String;
    lineID: number;
}

function makeLut(data, key) {
    let min = Math.min.apply(null, data[key]), max = Math.max.apply(null, data[key]);
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
        let system = systems[i];
        let end = system.systemLength()
        for (let i = 0; i < end; i++) { //insert lut colors into lutCols[] to toggle Lut coloring later
            system.lutCols[i] = lut.getColor(Number(system.colormapFile[key][i]));
        }
    }
}

// define the drag and drop behavior of the scene
var target = renderer.domElement;
target.addEventListener("dragover", function (event) {
    event.preventDefault();
}, false);

target.addEventListener("dragenter", function (event) {
    event.preventDefault();
    let e = document.getElementById("dragInstruction");
    e.style.opacity = "0.1";
}, false);

target.addEventListener("dragexit", function (event) {
    event.preventDefault();
    let e = document.getElementById("dragInstruction");
    e.style.opacity = "0.8";
}, false);

// the actual code to drop in the config files
//First, a bunch of global variables relating to files
var approxDatLen: number,
    currentChunkNumber: number, //this is the chunk containing the end of the current conf
    previousPreviousChunk: String, //Space to store the chunks
    previousChunk: String,
    currentChunk: String,
    nextChunk: String,
    ppHangingLine, //Deal with bad linebreaks caused by splitting the trajectory bitwise
    pHangingLine,
    cHangingLine,
    nHangingLine,
    datReader = new FileReader(),
    nextReader = new FileReader(),
    previousReader = new FileReader(), //previous and previousPrevious are basicaly the same...
    previousPreviousReader = new FileReader(),
    confBegin = new marker,
    confEnd = new marker,
    confLen: number,
    confNum: number = 0,
    datFileout: string = "",
    datFile, //currently var so only 1 datFile stored for all systems w/ last uploaded system's dat
    box: number, //box size for system
    toggleFailure: Boolean = false, 
    defaultColormap: string = "cooltowarm";

target.addEventListener("drop", function (event) {
    // cancel default actions
    event.preventDefault();

    var files = event.dataTransfer.files,
        filesLen = files.length;

    let topFile, jsonFile;

    // assign files to the extentions; all possible combinations of entered files
    for (let i = 0; i < filesLen; i++) {
        // get file extension
        let fileName = files[i].name;
        let ext = fileName.split('.').pop();

        if (ext === "dat") datFile = files[i];
        else if (ext === "conf") datFile = files[i];
        else if (ext === "top") topFile = files[i];
        else if (ext === "json") jsonFile = files[i];
        else {
            notify("This reader uses file extensions to determine file type.\nRecognized extensions are: .conf, .dat, .top, and .json\nPlease drop one .dat/.conf and one .top file.  .json data overlay is optional and can be added later.")
            return
        }
    }
    let jsonAlone = false;
    if (jsonFile && !topFile) jsonAlone = true;
    if ((filesLen > 3 || filesLen < 2) && !jsonAlone)  {
        notify("Please drag and drop 1 .dat and 1 .top file. .json is optional.  More .jsons can be dropped individually later");
        return
    }

    readFiles(topFile, datFile, jsonFile);

    if (jsonFile && jsonAlone) {
        let jsonReader = new FileReader(); //read .json
        jsonReader.onload = () => {
            readJson(systems[systems.length-1], jsonReader);
        };
        jsonReader.readAsText(jsonFile);
        renderer.domElement.style.cursor = "auto";
    }

    render();
}, false);

function readFilesFromPath(topologyPath:string, configurationPath:string) {
    if(topologyPath && configurationPath) {
        let topReq = new XMLHttpRequest();
        topReq.open("GET", topologyPath);
        topReq.responseType = "blob";
        topReq.onload = () => {
            const topFile = topReq.response;
            var datReq = new XMLHttpRequest();
            datReq.open("GET", configurationPath);
            datReq.responseType = "blob";
            datReq.onload = () => {
                const datFile = datReq.response;
                readFiles(topFile, datFile);
            }
            datReq.send();
        }
        topReq.send();
    }
}

function readFilesFromURLParams() {
    var url = new URL(window.location.href);
    var topologyPath = url.searchParams.get("topology");
    var configurationPath = url.searchParams.get("configuration");

    readFilesFromPath(topologyPath, configurationPath);
}

function readFiles(topFile: File, datFile: File, jsonFile?: File) {
    // Remove drag instructions
    let dragInstruction = document.getElementById("dragInstruction");
    dragInstruction.style.display = "none";

    //make system to store the dropped files in
    var system = new System(sysCount, elements.length);

    if (topFile) {
        //read topology file
        let topReader = new TopReader(topFile,system,elements);
        topReader.read();

        // asynchronously read the first two chunks of a configuration file
        if (datFile) {
            renderer.domElement.style.cursor = "wait";
            //anonymous functions to handle fileReader outputs
            datReader.onload = () => {
                currentChunk = datReader.result as String;
                currentChunkNumber = 0;
                readDat(system.systemLength(), datReader, system);
                document.dispatchEvent(new Event('nextConfigLoaded'));
            };
            //chunking bytewise often leaves incomplete lines, so cut off the beginning of the new chunk and append it to the chunk before
            nextReader.onload = () => {
                nextChunk = nextReader.result as String;
                if (nextChunk == "") {
                    document.dispatchEvent(new Event('finalConfig'));
                    return;
                }
                nHangingLine = "";
                let c = "";
                for (c = nextChunk.slice(0, 1); c != '\n'; c = nextChunk.slice(0, 1)) {
                    nHangingLine += c;
                    nextChunk = nextChunk.substring(1);
                }
                try {
                    currentChunk = currentChunk.concat(nHangingLine);
                }
                catch (error) {
                    console.log("File readers got all topsy-turvy, traj reading may not work :( \n")
                    console.log(error);
                }
                nextChunk = nextChunk.substring(1);
                confEnd.chunk = currentChunk;

                // Signal that config has been loaded
                document.dispatchEvent(new Event('nextConfigLoaded'));
            };
            previousPreviousReader.onload = () => {
                previousPreviousChunk = previousPreviousReader.result as String;
                if (previousPreviousChunk == "") { return }
                ppHangingLine = "";
                let c = "";
                for (c = previousPreviousChunk.slice(0, 1); c != '\n'; c = previousPreviousChunk.slice(0, 1)) {
                    ppHangingLine += c;
                    previousPreviousChunk = previousPreviousChunk.substring(1);
                }
                previousPreviousChunk = previousPreviousChunk.substring(1);
                previousPreviousChunk = previousPreviousChunk.concat(pHangingLine);
                confEnd.chunk = currentChunk;

                // Signal that config has been loaded
                document.dispatchEvent(new Event('nextConfigLoaded'));
            };

            // read the first chunk
            if (datFile && topFile) {
                approxDatLen = topFile.size * 30; //the relation between .top and a single .dat size is very variable, the largest I've found is 27x, although most are around 15x
                let firstChunkBlob = datChunker(datFile, 0, approxDatLen);
                datReader.readAsText(firstChunkBlob);

                //if its a trajectory, read in the second chunk
                if (datFile.size > approxDatLen) {
                    let nextChunkBlob = datChunker(datFile, 1, approxDatLen);
                    nextReader.readAsText(nextChunkBlob);
                }
            }

            if (jsonFile) {
                let jsonReader = new FileReader(); //read .json
                jsonReader.onload = () => {
                    readJson(system, jsonReader)
                };
                jsonReader.readAsText(jsonFile);
                renderer.domElement.style.cursor = "auto";
            }
        }
    }
}

let xbbLast,
    ybbLast,
    zbbLast;

function readDat(numNuc, datReader, system) {
    var currentStrand = systems[sysCount][strands][0];
    // parse file into lines
    let lines = datReader.result.split(/[\n]+/g);
    if (lines.length-3 < numNuc) { //Handles dat files that are too small.  can't handle too big here because you don't know if there's a trajectory
        notify(".dat and .top files incompatible")
        return
    }
    //get the simulation box size
    box = parseFloat(lines[1].split(" ")[3]);
    let time = parseInt(lines[0].split(" ")[2]);
    confNum += 1
    console.log(confNum, "t =", time);
    // discard the header
    lines = lines.slice(3);

    confBegin.chunk = currentChunk;
    confBegin.lineID = 0;

    confEnd.chunk = currentChunk;
    confEnd.lineID = numNuc + 2; //end of current configuration

    //for each line in the current configuration, read the line and calculate positions
    for (let i = 0; i < numNuc; i++) {
        if (lines[i] == "" || lines[i].slice(0, 1) == 't') {
            break
        };
        // get the nucleotide associated with the line
        var currentNucleotide: BasicElement = elements[i+system.globalStartId];

        // consume a new line from the file
        let l: string = lines[i].split(" ");

        currentNucleotide.calculatePositions(l);

        //when a strand is finished, add it to the system
        if ((currentNucleotide.neighbor5 == undefined || currentNucleotide.neighbor5 == null) || (currentNucleotide.neighbor5.lid < currentNucleotide.lid)) { //if last nucleotide in straight strand
            system.add(currentStrand); //add strand THREE.Group to system THREE.Group
            currentStrand = system[strands][currentStrand.strandID]; //don't ask, its another artifact of strands being 1-indexed
            if (elements[currentNucleotide.gid+1] != undefined) {
                currentStrand = elements[currentNucleotide.gid+1].parent;
            }
        }

    }
    addSystemToScene(system);
}

function readJson(system, jsonReader) {
    let file = jsonReader.result as string;
    let data = JSON.parse(file);
    for (var key in data) {
        if (data[key].length == system.systemLength()) { //if json and dat files match/same length
            if (typeof (data[key][0]) == "number") { //we assume that scalars denote a new color map
                system.setColorFile(data);
                makeLut(data, key);
                try{ //you need to toggle here for small systems, during the scene add for large systems.
                    setColoringMode("Overlay");
                }
                catch {
                    toggleFailure = true;
                }
            }
            if (data[key][0].length == 3) { //we assume that 3D vectors denote motion
                let end = system.systemLength() + system.globalStartId
                for (let i = system.globalStartId; i < end; i++) {
                    let vec = new THREE.Vector3(data[key][i][0], data[key][i][1], data[key][i][2]);
                    let len = vec.length();
                    vec.normalize();
                    let arrowHelper = new THREE.ArrowHelper(vec, elements[i].getInstanceParameter3("bbOffsets"), len, 0x000000);
                    arrowHelper.name = i + "disp";
                    scene.add(arrowHelper);
                }
            }
        }
        else if (data[key][0].length == 6) { //draw arbitrary arrows on the scene
            for (let entry of data[key]) {
                let pos = new THREE.Vector3(entry[0], entry[1], entry[2]);
                let vec = new THREE.Vector3(entry[3], entry[4], entry[5]);
                vec.normalize();
                let arrowHelper = new THREE.ArrowHelper(vec, pos, 5 * vec.length(), 0x00000);
                scene.add(arrowHelper);
            }
        }
        else { //if json and dat files do not match, display error message and set filesLen to 2 (not necessary)
            notify(".json and .top files are not compatible.");
            return;
        }
    }
}

function addSystemToScene(system) {
    //instancing note: if you make any modifications to the drawing matricies here, they will take effect before anything draws
    //however, if you want to change once stuff is already drawn, you need to add "<attribute>.needsUpdate" before the render() call.
    //This will force the gpu to check the vectors again when redrawing.

    system.backboneGeometry = instancedBackbone.clone();
    system.nucleosideGeometry = instancedNucleoside.clone();
    system.connectorGeometry = instancedConnector.clone();
    system.spGeometry = instancedBBconnector.clone();
    
    system.pickingGeometry = instancedBackbone.clone();

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

    system.pickingGeometry.addAttribute( 'idcolor', new THREE.InstancedBufferAttribute(system.bbLabels, 3));
    system.pickingGeometry.addAttribute( 'instanceOffset', new THREE.InstancedBufferAttribute(system.bbOffsets, 3));
    system.pickingGeometry.addAttribute( 'instanceVisibility', new THREE.InstancedBufferAttribute(system.visibility, 3 ) );

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

    scene.add(system.backbone);
    scene.add(system.nucleoside);
    scene.add(system.connector);
    scene.add(system.bbconnector);

    pickingScene.add(system.dummyBackbone);

    //bring things in the box based on the PBC/centering menus
    PBCswitchbox(system);

    if(toggleFailure){
        setColoringMode("Overlay");
    }

    sysCount += 1;
    render();

    renderer.domElement.style.cursor = "auto";
}

function getNewConfig(mode) { //attempts to display next configuration; same as readDat() except does not make new sphere Meshes, etc. - maximize efficiency
    if (systems.length > 1) {
        notify("Only one file at a time can be read as a trajectory, sorry...");
        return;
    }
    for (let i = 0; i < systems.length; i++) { //for each system - does not actually work for multiple systems
        let system = systems[i];
        let numNuc: number = system.systemLength(); //gets # of nuc in system
        let lines
        if (mode == 1) {
            lines = extractNextConf()
            confNum += 1
        }
        if (mode == -1) {
            lines = extractPreviousConf()
            confNum -= 1
        }
        if (lines == undefined) {
            notify("No more confs to load!");
            confNum -= mode;
            return;
        }

        //get the simulation box size
        let box = parseFloat(lines[1].split(" ")[3]);
        let time = parseInt(lines[0].split(" ")[2]);
        console.log(confNum, 't =', time);
        // discard the header
        lines = lines.slice(3);

        for (let lineNum = 0; lineNum < numNuc; lineNum++) {
            if (lines[lineNum] == "" || undefined) {
                notify("There's an empty line in the middle of your configuration!")
                break
            };
            let currentNucleotide = elements[systems[i].globalStartId+lineNum];
            // consume a new line
            let l = lines[lineNum].split(" ");
            currentNucleotide.calculateNewConfigPositions(l);
        }

        //bring things in box based on the PBC/centering menus
        PBCswitchbox(system);

        system.backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
        system.nucleoside.geometry["attributes"].instanceOffset.needsUpdate = true;
        system.nucleoside.geometry["attributes"].instanceRotation.needsUpdate = true;
        system.connector.geometry["attributes"].instanceOffset.needsUpdate = true;
        system.connector.geometry["attributes"].instanceRotation.needsUpdate = true;
        system.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
        system.bbconnector.geometry["attributes"].instanceRotation.needsUpdate = true;
        system.bbconnector.geometry["attributes"].instanceScale.needsUpdate = true;
        system.dummyBackbone.geometry["attributes"].instanceOffset.needsUpdate = true;
    }
    render();
}
