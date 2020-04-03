/// <reference path="../typescript_definitions/index.d.ts" />
class TopReader extends FileReader {
    constructor(topFile, system, elems) {
        super();
        this.nucLocalID = 0;
        this.onload = ((f) => {
            return () => {
                let nucCount = this.elems.getNextId();
                let file = this.result;
                let lines = file.split(/[\n]+/g);
                lines = lines.slice(1); // discard the header
                let l0 = lines[0].split(" ");
                let strID = parseInt(l0[0]); //proteins are negative indexed
                this.lastStrand = strID;
                let currentStrand = this.system.createStrand(strID);
                this.system.addStrand(currentStrand);
                // create empty list of elements with length equal to the topology
                // Note: this is implemented such that we have the elements for the DAT reader 
                let nuc; //DNANucleotide | RNANucleotide | AminoAcid;
                for (let j = 0; j < lines.length; j++) {
                    this.elems.set(nucCount + j, nuc);
                }
                lines.forEach((line, i) => {
                    if (line == "") {
                        // Delete last element
                        this.elems.delete(this.elems.getNextId() - 1);
                        return;
                    }
                    //split the file and read each column, format is: "strID base n3 n5"
                    let l = line.split(" ");
                    strID = parseInt(l[0]);
                    if (strID != this.lastStrand) { //if new strand id, make new strand                        
                        currentStrand = this.system.createStrand(strID);
                        this.system.addStrand(currentStrand);
                        this.nucLocalID = 0;
                    }
                    ;
                    //create a new element
                    if (!this.elems.get(nucCount + i))
                        this.elems.set(nucCount + i, currentStrand.createBasicElement(nucCount + i));
                    let nuc = this.elems.get(nucCount + i);
                    nuc.lid = this.nucLocalID;
                    //create neighbor 3 element if it doesn't exist
                    let neighbor3 = parseInt(l[2]);
                    if (neighbor3 != -1) {
                        if (!this.elems.get(nucCount + neighbor3)) {
                            this.elems.set(nucCount + neighbor3, currentStrand.createBasicElement(nucCount + neighbor3));
                        }
                        nuc.neighbor3 = this.elems.get(nucCount + neighbor3);
                    }
                    else
                        nuc.neighbor3 = null;
                    //create neighbor 5 element if it doesn't exist
                    let neighbor5 = parseInt(l[3]);
                    if (neighbor5 != -1) {
                        if (!this.elems.get(nucCount + neighbor5)) {
                            this.elems.set(nucCount + neighbor5, currentStrand.createBasicElement(nucCount + neighbor5));
                        }
                        nuc.neighbor5 = this.elems.get(nucCount + neighbor5);
                    }
                    else
                        nuc.neighbor5 = null;
                    //proteins also have the anm connections which need to be kept.for file output
                    let j = 4;
                    let connection = parseInt(l[j]);
                    if (connection != undefined) {
                        const n = nuc; //the compiler complains if it doesn't know that we're working with AAs.
                        while (connection) {
                            n.connections.push(connection + this.system.globalStartId);
                            j += 1;
                            connection = parseInt(l[j]);
                        }
                    }
                    let base = l[1]; // get base id
                    nuc.type = base;
                    //if we meet a U, we have an RNA (its dumb, but its all we got)
                    //this has an unfortunate side effect that the first few nucleotides in an RNA strand are drawn as DNA (before the first U)
                    if (base === "U")
                        RNA_MODE = true;
                    currentStrand.addMonomer(nuc);
                    this.nucLocalID += 1;
                    this.lastStrand = strID;
                });
                this.system.setDatFile(datFile); //store datFile in current System object
                systems.push(this.system); //add system to Systems[]
                nucCount = this.elems.getNextId();
                //fire dat file read from inside top file reader to make sure they don't desync (large protein files will cause a desync)
                //anonymous functions to handle fileReader outputs
                datReader.onload = () => {
                    // Find out if what you're reading is a single configuration or a trajectory
                    let isTraj = readDat(datReader, this.system);
                    document.dispatchEvent(new Event('nextConfigLoaded'));
                    //if its a trajectory, create the other readers
                    if (isTraj) {
                        trajReader = new TrajectoryReader(datFile, this.system, approxDatLen, datReader.result);
                    }
                };
                let approxDatLen = this.topFile.size * 30; //the relation between .top and a single .dat size is very variable, the largest I've found is 27x, although most are around 15x
                // read the first chunk
                const firstChunkBlob = datChunker(datFile, 0, approxDatLen);
                datReader.readAsText(firstChunkBlob);
                //set up instancing data arrays
                this.system.initInstances(this.system.systemLength());
            };
        })(this.topFile);
        this.topFile = topFile;
        this.system = system;
        this.elems = elems;
    }
    read() {
        this.readAsText(this.topFile);
    }
}
class TrajectoryReader {
    // Create the readers and read the second chunk
    constructor(datFile, system, approxDatLen, currentChunk) {
        this.datFile = datFile;
        this.system = system;
        this.approxDatLen = approxDatLen;
        this.nextReader = new FileReader();
        this.previousReader = new FileReader();
        this.currentChunkNumber = 0;
        this.currentChunk = currentChunk;
        this.confBegin = new marker;
        this.confEnd = new marker;
        this.createReadHandlers();
        const nextChunkBlob = datChunker(this.datFile, 1, this.approxDatLen);
        this.nextReader.readAsText(nextChunkBlob);
        const numNuc = system.systemLength();
        this.confLen = numNuc + 3;
        this.confBegin.chunk = currentChunk;
        this.confBegin.lineID = 0;
        this.confEnd.chunk = currentChunk;
        this.confEnd.lineID = numNuc + 2; //end of current configuration
    }
    createReadHandlers() {
        //chunking bytewise often leaves incomplete lines, so cut off the beginning of the new chunk and append it to the chunk before
        this.nextReader.onload = () => {
            this.nextChunk = this.nextReader.result;
            if (this.nextChunk == "") {
                document.dispatchEvent(new Event('finalConfig'));
                return;
            }
            this.nHangingLine = "";
            let c = "";
            for (c = this.nextChunk.slice(0, 1); c != '\n'; c = this.nextChunk.slice(0, 1)) {
                this.nHangingLine += c;
                this.nextChunk = this.nextChunk.substring(1);
            }
            try {
                this.currentChunk = this.currentChunk.concat(this.nHangingLine);
            }
            catch (error) {
                console.log("File readers got all topsy-turvy, traj reading may not work :( \n");
                console.log(error);
            }
            this.nextChunk = this.nextChunk.substring(1);
            this.confEnd.chunk = this.currentChunk;
            // Signal that config has been loaded
            // block the nextConfig loaded to prevent the video loader from continuing after the chunk
            document.dispatchEvent(new Event('nextConfigLoaded'));
        };
        //same as the above declaration, but this doesn't have anywhere to put the cut string, so it just holds it.
        this.previousReader.onload = () => {
            this.previousPreviousChunk = this.previousReader.result;
            if (this.previousPreviousChunk == "") {
                return;
            }
            this.ppHangingLine = "";
            let c = "";
            for (c = this.previousPreviousChunk.slice(0, 1); c != '\n'; c = this.previousPreviousChunk.slice(0, 1)) {
                this.ppHangingLine += c;
                this.previousPreviousChunk = this.previousPreviousChunk.substring(1);
            }
            this.previousPreviousChunk = this.previousPreviousChunk.substring(1);
            this.previousPreviousChunk = this.previousPreviousChunk.concat(this.pHangingLine);
            this.confEnd.chunk = this.currentChunk;
            // Signal that config has been loaded
            document.dispatchEvent(new Event('nextConfigLoaded'));
        };
    }
    extractNextConf() {
        let needNextChunk = false;
        const currentChunkLines = this.currentChunk.split(/[\n]+/g);
        const nextChunkLines = this.nextChunk.split(/[\n]+/g);
        const currentChunkLength = currentChunkLines.length;
        const nextConf = [];
        const start = new marker;
        if (nextChunkLines[0] == "") {
            return undefined;
        }
        if (this.confEnd.lineID != currentChunkLength) { //handle very rare edge case where conf ended exactly at end of chunk
            start.chunk = this.confEnd.chunk;
            start.lineID = this.confEnd.lineID + 1;
        }
        else {
            start.chunk = this.nextChunk;
            start.lineID = 0;
            needNextChunk = true;
        }
        const end = new marker;
        if (start.lineID + this.confLen <= currentChunkLength) { //is the whole conf in a single chunk?
            end.chunk = start.chunk;
            end.lineID = start.lineID + this.confLen - 1;
            for (let i = start.lineID; i < end.lineID + 1; i++) {
                if (currentChunkLines[i] == "" || currentChunkLines == undefined) {
                    return undefined;
                }
                nextConf.push(currentChunkLines[i]);
            }
        }
        else {
            end.chunk = this.nextChunk;
            end.lineID = this.confLen - (currentChunkLength - start.lineID) - 1;
            needNextChunk = true;
            for (let i = start.lineID; i < currentChunkLength; i++) {
                if (currentChunkLines[i] == "" || currentChunkLines == undefined) {
                    return undefined;
                }
                nextConf.push(currentChunkLines[i]);
            }
            for (let i = 0; i < end.lineID + 1; i++) {
                nextConf.push(nextChunkLines[i]);
            }
        }
        this.confBegin = start;
        this.confEnd = end;
        if (needNextChunk) {
            this.getNextChunk(this.currentChunkNumber + 2); //current is the old middle, so need two ahead
        }
        return (nextConf);
    }
    extractPreviousConf() {
        let needPreviousChunk = false;
        const previousConf = [];
        const end = new marker;
        if (confNum == 1) { //can't go backwards from 1
            return undefined;
        }
        else if (this.confBegin.lineID != 0) { //handle rare edge case where a conf began at the start of a chunk
            end.chunk = this.confBegin.chunk;
            if (end.chunk == this.previousChunk) {
                needPreviousChunk = true;
            }
            end.lineID = this.confBegin.lineID - 1;
        }
        else {
            end.chunk = this.previousChunk;
            end.lineID = this.previousChunk.length - 1;
            needPreviousChunk = true;
        }
        const endChunkLines = end.chunk.split(/[\n]+/g);
        const start = new marker;
        if (end.lineID - this.confLen >= 0) { //is the whole conf in a single chunk?
            start.chunk = end.chunk;
            start.lineID = end.lineID - this.confLen + 1;
            const startChunkLines = start.chunk.split(/[\n]+/g);
            for (let i = start.lineID; i < end.lineID + 1; i++) {
                if (startChunkLines[i] == "" || startChunkLines == undefined) {
                    return undefined;
                }
                previousConf.push(startChunkLines[i]);
            }
        }
        else {
            if (end.chunk == this.currentChunk && confNum != 2) {
                start.chunk = this.previousChunk;
            }
            else if (end.chunk == this.previousChunk && confNum != 2) {
                start.chunk = this.previousPreviousChunk;
            }
            else {
                start.chunk = this.previousChunk;
            }
            const startChunkLines = start.chunk.split(/[\n]+/g);
            start.lineID = startChunkLines.length - (this.confLen - (end.lineID + 1));
            for (let i = start.lineID; i < startChunkLines.length; i++) {
                if (startChunkLines[i] == "" || startChunkLines == undefined) {
                    return undefined;
                }
                previousConf.push(startChunkLines[i]);
            }
            for (let i = 0; i < end.lineID + 1; i++) {
                if (endChunkLines[i] == "" || endChunkLines == undefined) {
                    return undefined;
                }
                previousConf.push(endChunkLines[i]);
            }
        }
        this.confBegin = start;
        this.confEnd = end;
        if (needPreviousChunk) {
            this.getPreviousChunk(this.currentChunkNumber - 3);
        }
        return (previousConf);
    }
    getNextChunk(chunkNumber) {
        this.previousPreviousChunk = this.previousChunk;
        this.ppHangingLine = this.pHangingLine;
        this.previousChunk = this.currentChunk;
        this.pHangingLine = this.cHangingLine;
        this.currentChunk = this.nextChunk;
        this.cHangingLine = this.nHangingLine;
        const nextChunkBlob = datChunker(datFile, chunkNumber, this.approxDatLen);
        this.nextReader.readAsText(nextChunkBlob);
        this.currentChunkNumber += 1;
    }
    getPreviousChunk(chunkNumber) {
        this.nextChunk = this.currentChunk;
        this.nHangingLine = this.cHangingLine;
        this.currentChunk = this.previousChunk;
        this.cHangingLine = this.pHangingLine;
        this.previousChunk = this.previousPreviousChunk;
        this.pHangingLine = this.ppHangingLine;
        if (chunkNumber < 0) {
            console.log("tried to load conf -1");
            if (this.previousPreviousChunk == undefined) {
                this.previousChunk = undefined;
            }
            else {
                this.previousPreviousChunk = undefined;
            }
            this.currentChunkNumber -= 1;
            return;
        }
        const previousPreviousChunkBlob = datChunker(this.datFile, chunkNumber, this.approxDatLen);
        this.previousReader.readAsText(previousPreviousChunkBlob);
        this.currentChunkNumber -= 1;
    }
    getNewConfig(mode) {
        if (systems.length > 1) {
            notify("Only one file at a time can be read as a trajectory, sorry...");
            return;
        }
        for (let i = 0; i < systems.length; i++) { //for each system - does not actually work for multiple systems...but maybe one day
            const system = this.system;
            const numNuc = system.systemLength(); //gets # of nuc in system
            let lines;
            if (mode == 1) {
                lines = this.extractNextConf();
                confNum += 1;
            }
            if (mode == -1) {
                lines = this.extractPreviousConf();
                confNum -= 1;
            }
            if (lines == undefined || lines[0] == "" || lines[0] == undefined) {
                notify("No more confs to load!");
                confNum -= mode;
                return;
            }
            //get the simulation box size
            this.time = parseInt(lines[0].split(" ")[2]);
            console.log(confNum, 't =', this.time);
            let timedisp = document.getElementById("trajTimestep");
            timedisp.innerHTML = `t = ${this.time}`;
            timedisp.hidden = false;
            // discard the header
            lines = lines.slice(3);
            let currentNucleotide, l;
            for (let lineNum = 0; lineNum < numNuc; lineNum++) {
                if (lines[lineNum] == "") {
                    notify("There's an empty line in the middle of your configuration!");
                    break;
                }
                ;
                currentNucleotide = elements.get(systems[i].globalStartId + lineNum);
                // consume a new line
                l = lines[lineNum].split(" ");
                currentNucleotide.calculateNewConfigPositions(l);
            }
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
        PBCswitchbox();
        render();
        document.dispatchEvent(new Event('nextConfigLoaded'));
    }
    nextConfig() {
        if (this.nextReader.readyState == 1) { //0: nothing loaded 1: working 2: done
            return;
        }
        this.getNewConfig(1);
    }
    ;
    previousConfig() {
        if (this.previousReader.readyState == 1) {
            return;
        }
        this.getNewConfig(-1);
    }
    ;
    /**
     * Step through trajectory until a specified timestep
     * is found
     * @param timeLim Timestep to stop at
     * @param backwards Step backwards
     */
    stepUntil(timeLim, backwards) {
        let icon = document.getElementById(backwards ? 'trajPrevUntilBtn' : 'trajNextUntilBtn');
        if (icon.innerHTML == 'pause') {
            // If we're already running, abort!
            icon.innerHTML = backwards ? 'fast_rewind' : 'fast_forward';
            return;
        }
        // Set icon to enable pausing
        icon.innerHTML = 'pause';
        // Define loop, for requestAnimationFrame
        let loop = () => {
            if (icon.innerHTML == 'pause' && ( // If user has clicked pause
            !this.time || // Or we don't know the current timestep
                // Or if we have stepped to far:
                backwards && this.previousChunk && (this.time > timeLim) ||
                !backwards && this.nextChunk && ((timeLim < 0) || this.time < timeLim))) {
                // Take one step
                if (backwards) {
                    this.previousConfig();
                }
                else {
                    this.nextConfig();
                }
                requestAnimationFrame(loop);
            }
            else {
                // When finished, change icon back from pause
                icon.innerHTML = backwards ? 'fast_rewind' : 'fast_forward';
            }
        };
        loop(); // Actually call the function
    }
}
