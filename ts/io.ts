/// <reference path="./three/index.d.ts" />

class TopReader extends FileReader{
    topFile: File;
    system: System;
    elems: ElementMap;

    nucLocalID: number = 0;
    lastStrand: number; //strands are 1-indexed in oxDNA .top files
    neighbor3: number;

    constructor(topFile: File, system: System, elems: ElementMap){
        super();
        this.topFile = topFile;
        this.system = system;
        this.elems = elems;
    }
    onload = ((f) => {
        return () => {
            let nucCount = this.elems.getLastId();
            let file = this.result as string
            let lines = file.split(/[\n]+/g);
            lines = lines.slice(1); // discard the header
            
            let l0 = lines[0].split(" "); 
            let strID = parseInt(l0[0]); //proteins are negative indexed
            this.lastStrand = strID;
            let currentStrand: Strand = this.system.createStrand(strID);
            this.system.addStrand(currentStrand);
            
            // create empty list of elements with length equal to the topology
            // Note: this is implemented such that we have the elements for the DAT reader 
            let nuc: BasicElement;//DNANucleotide | RNANucleotide | AminoAcid;
            for (let i = 0; i < lines.length; i++) {
                this.elems.set(nucCount+i, nuc);
            }
            
            lines.forEach((line, i) => {
                if (line == "") {
                    this.elems.delete(i);
                    return;
                }
                //split the file and read each column, format is: "strID base n3 n5"
                let l = line.split(" "); 
                strID = parseInt(l[0]);
                    
                if (strID != this.lastStrand) { //if new strand id, make new strand                        
                    currentStrand = this.system.createStrand(strID);
                    this.system.addStrand(currentStrand);
                    this.nucLocalID = 0;
                };

                let gid = nucCount + i;
                    
                //create a new element
                if (!this.elems.has(gid) || !this.elems.get(gid)) {
                    this.elems.set(
                        gid,
                        currentStrand.createBasicElement(nucCount + i));
                }

                let nuc = this.elems.get(gid);
                nuc.lid = this.nucLocalID;
                    
                //create neighbor 3 element if it doesn't exist
                let neighbor3 = parseInt(l[2]);
                if (neighbor3 != -1) {
                    if (!this.elems.has(nucCount + neighbor3) ||
                        !this.elems.get(nucCount + neighbor3))
                    {
                        this.elems.set(
                            nucCount + neighbor3,
                            currentStrand.createBasicElement(nucCount + neighbor3)
                        );
                    }
                    nuc.neighbor3 = this.elems.get(nucCount + neighbor3);
                }
                else 
                    nuc.neighbor3 = null;
        
                //create neighbor 5 element if it doesn't exist
                let neighbor5 = parseInt(l[3]);
                if (neighbor5 != -1) {
                    if (!this.elems.has(nucCount + neighbor5) ||
                        !this.elems.get(nucCount + neighbor5))
                    {
                        this.elems.set(
                            nucCount + neighbor5,
                            currentStrand.createBasicElement(nucCount + neighbor5)
                        );
                    }
                    nuc.neighbor5 = this.elems.get(nucCount + neighbor5);
                }
                else nuc.neighbor5 = null;
                    
                let base = l[1]; // get base id
                nuc.type = base;
                //if we meet a U, we have an RNA (its dumb, but its all we got)
                //this has an unfortunate side effect that the first few nucleotides in an RNA strand are drawn as DNA (before the first U)
                if (base === "U") RNA_MODE = true;
                    
                currentStrand.addBasicElement(nuc);
                this.nucLocalID += 1;
                this.lastStrand = strID;
                    
                if (i == lines.length - 1) {
                    return;
                }; 
            });
            this.system.setDatFile(datFile); //store datFile in current System object
            systems.push(this.system); //add system to Systems[]
            let confLen = this.elems.size + 3;

            //set up instancing data arrays
            this.system.initInstances(this.system.systemLength());

            return confLen;

        }})(this.topFile);
    
    read(){
        this.readAsText(this.topFile);
    }
}

class TrajectoryReader {
    datFile: File;
    system: System;
    approxDatLen;
    nextReader: FileReader;
    previousReader: FileReader;
    currentChunkNumber: number;
    previousPreviousChunk: String; //Space to store the chunks
    previousChunk: String;
    currentChunk: String;
    nextChunk: String;
    ppHangingLine: string; //Deal with bad linebreaks caused by splitting the trajectory bitwise
    pHangingLine: string;
    cHangingLine: string;
    nHangingLine: string;
    confBegin: marker;
    confEnd: marker;
    confLen: number;

    // Create the readers and read the second chunk
    constructor(datFile, system, approxDatLen, currentChunk){
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
            this.nextChunk = this.nextReader.result as String;
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
                console.log("File readers got all topsy-turvy, traj reading may not work :( \n")
                console.log(error);
            }
            this.nextChunk = this.nextChunk.substring(1);
            this.confEnd.chunk = this.currentChunk;
        
            // Signal that config has been loaded
            document.dispatchEvent(new Event('nextConfigLoaded'));
        };

        //same as the above declaration, but this doesn't have anywhere to put the cut string, so it just holds it.
        this.previousReader.onload = () => {
            this.previousPreviousChunk = this.previousReader.result as String;
            if (this.previousPreviousChunk == "") { return }
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
        let needNextChunk: boolean = false;
        const currentChunkLines: string[] = this.currentChunk.split(/[\n]+/g);
        const nextChunkLines: string[] = this.nextChunk.split(/[\n]+/g);
        const currentChunkLength: number = currentChunkLines.length;
        const nextConf: string[] = [];
        const start = new marker;
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
                if (currentChunkLines[i] == "" || currentChunkLines == undefined) { return undefined }
                nextConf.push(currentChunkLines[i]);
            }
        }
        else {
            end.chunk = this.nextChunk;
            end.lineID = this.confLen - (currentChunkLength - start.lineID) - 1;
            needNextChunk = true
            for (let i = start.lineID; i < currentChunkLength; i++) {
                if (currentChunkLines[i] == "" || currentChunkLines == undefined) { return undefined }
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
        else {
            // Signal that config has been loaded
            document.dispatchEvent(new Event('nextConfigLoaded'));
        }
        return (nextConf);
    }
    
    extractPreviousConf() {
        let needPreviousChunk: boolean = false;
        const previousConf: string[] = []
        const end = new marker;
        if (confNum == 1) { //can't go backwards from 1
            return undefined
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
        const endChunkLines: string[] = end.chunk.split(/[\n]+/g);
    
        const start = new marker;
        if (end.lineID - this.confLen >= 0) { //is the whole conf in a single chunk?
            start.chunk = end.chunk;
            start.lineID = end.lineID - this.confLen + 1;
            const startChunkLines: string[] = start.chunk.split(/[\n]+/g);
            for (let i = start.lineID; i < end.lineID + 1; i++) {
                if (startChunkLines[i] == "" || startChunkLines == undefined) { return undefined }
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
            const startChunkLines: string[] = start.chunk.split(/[\n]+/g);
            start.lineID = startChunkLines.length - (this.confLen - (end.lineID + 1));
            for (let i = start.lineID; i < startChunkLines.length; i++) {
                if (startChunkLines[i] == "" || startChunkLines == undefined) { return undefined }
                previousConf.push(startChunkLines[i]);
            }
            for (let i = 0; i < end.lineID + 1; i++) {
                if (endChunkLines[i] == "" || endChunkLines == undefined) { return undefined }
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
            return
        }
    
        const previousPreviousChunkBlob = datChunker(this.datFile, chunkNumber, this.approxDatLen);
        this.previousReader.readAsText(previousPreviousChunkBlob);
        this.currentChunkNumber -= 1
    }

    getNewConfig(mode) { //attempts to display next configuration; same as readDat() except does not make new sphere Meshes, etc. - maximize efficiency
        if (systems.length > 1) {
            notify("Only one file at a time can be read as a trajectory, sorry...");
            return;
        }
        for (let i = 0; i < systems.length; i++) { //for each system - does not actually work for multiple systems
            const system = this.system
            const numNuc: number = system.systemLength(); //gets # of nuc in system
            let lines
            if (mode == 1) {
                lines = this.extractNextConf()
                confNum += 1
            }
            if (mode == -1) {
                lines = this.extractPreviousConf()
                confNum -= 1
            }
            if (lines == undefined) {
                notify("No more confs to load!");
                confNum -= mode;
                return;
            }
    
            //get the simulation box size
            const time = parseInt(lines[0].split(" ")[2]);
            console.log(confNum, 't =', time);
            // discard the header
            lines = lines.slice(3);
            let currentNucleotide: BasicElement,
                l: string[];
    
            for (let lineNum = 0; lineNum < numNuc; lineNum++) {
                if (lines[lineNum] == "" || undefined) {
                    notify("There's an empty line in the middle of your configuration!")
                    break
                };
                currentNucleotide = elements.get(systems[i].globalStartId+lineNum);
                // consume a new line
                l = lines[lineNum].split(" ");
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

    nextConfig() {
        if (this.nextReader.readyState == 1) { //0: nothing loaded 1: working 2: done
            return;
        }
        this.getNewConfig(1);
    };
    
    previousConfig() {
        if (this.previousReader.readyState == 1) {
            return;
        }
        this.getNewConfig(-1);
    };
}