/// <reference path="../typescript_definitions/index.d.ts" />
class TopReader extends FileReader {
    constructor(topFile, system, elems, callback) {
        super();
        this.topFile = null;
        this.sidCounter = 0;
        this.nucLocalID = 0;
        this.onload = ((f) => {
            return () => {
                let nucCount = this.elems.getNextId();
                let file = this.result;
                let lines = file.split(/[\n]+/g);
                lines = lines.slice(1); // discard the header
                this.configurationLength = lines.length;
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
                        this.configurationLength -= 1;
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
                    // Set systemID
                    nuc.sid = this.sidCounter++;
                    //create neighbor 3 element if it doesn't exist
                    let n3 = parseInt(l[2]);
                    if (n3 != -1) {
                        if (!this.elems.get(nucCount + n3)) {
                            this.elems.set(nucCount + n3, currentStrand.createBasicElement(nucCount + n3));
                        }
                        nuc.n3 = this.elems.get(nucCount + n3);
                    }
                    else {
                        nuc.n3 = null;
                        currentStrand.end3 = nuc;
                    }
                    //create neighbor 5 element if it doesn't exist
                    let n5 = parseInt(l[3]);
                    if (n5 != -1) {
                        if (!this.elems.get(nucCount + n5)) {
                            this.elems.set(nucCount + n5, currentStrand.createBasicElement(nucCount + n5));
                        }
                        nuc.n5 = this.elems.get(nucCount + n5);
                    }
                    else {
                        nuc.n5 = null;
                        currentStrand.end5 = nuc;
                    }
                    let base = l[1]; // get base id
                    nuc.type = base;
                    //if we meet a U, we have an RNsibleA (its dumb, but its all we got)
                    //this has an unfortunate side effect that the first few nucleotides in an RNA strand are drawn as DNA (before the first U)
                    if (base === "U")
                        RNA_MODE = true;
                    this.nucLocalID += 1;
                    this.lastStrand = strID;
                });
                nucCount = this.elems.getNextId();
                // usually the place where the DatReader gets fired
                this.callback();
            };
        })(this.topFile);
        this.topFile = topFile;
        this.system = system;
        this.elems = elems;
        this.callback = callback;
    }
    read() {
        this.readAsText(this.topFile);
    }
}
class FileChunker {
    constructor(file, chunk_size) {
        this.file = file;
        this.chunk_size = chunk_size;
        this.current_chunk = -1;
    }
    getNextChunk() {
        if (!this.isLast())
            this.current_chunk++;
        return this.getChunk();
    }
    getPrevChunk() {
        this.current_chunk--;
        if (this.current_chunk <= 0)
            this.current_chunk = 0;
        return this.getChunk();
    }
    isLast() {
        if (this.current_chunk * this.chunk_size + this.chunk_size > this.file.size)
            return true;
        return false;
    }
    getChunkAtPos(start, size) {
        return this.file.slice(start, start + size);
    }
    getEstimatedState(position_lookup) {
        // reads the current position lookup array to 
        // guestimate conf count, and how much confs are left in the file
        let l = position_lookup.length;
        let size = position_lookup[l - 1][1];
        let confs_in_file = Math.round(this.file.size / size);
        return [confs_in_file, l];
    }
    getChunk() {
        return this.file.slice(this.current_chunk * this.chunk_size, this.current_chunk * this.chunk_size + this.chunk_size);
    }
}
class LookupReader extends FileReader {
    constructor(chunker, confLength, callback) {
        super();
        this.position_lookup = []; // store offset and size
        this.idx = -1;
        this.onload = ((evt) => {
            return () => {
                let file = this.result;
                let lines = file.split(/[\n]+/g);
                // we need to pass down idx to sync with the DatReader
                this.callback(this.idx, lines, this.size);
            };
        })();
        this.chunker = chunker;
        this.confLength = confLength;
        this.callback = callback;
    }
    addIndex(offset, size, time) {
        this.position_lookup.push([offset, size, time]);
    }
    indexNotLoaded(idx) {
        let l = this.position_lookup.length;
        return l == 0 || idx >= l;
    }
    getConf(idx) {
        if (idx < this.position_lookup.length) {
            let offset = this.position_lookup[idx][0];
            this.size = this.position_lookup[idx][1];
            this.idx = idx; // as we are successful in retrieving
            // we can update 
            this.readAsText(this.chunker.getChunkAtPos(offset, this.size));
        }
    }
}
class TrajectoryReader {
    constructor(datFile, topReader, system, elems, indexes) {
        this.firstConf = true;
        this.idx = 0;
        this.offset = 0;
        this.firstRead = true;
        this.playFlag = false;
        this.intervalId = null;
        this.topReader = topReader;
        this.system = system;
        this.elems = elems;
        this.datFile = datFile;
        this.chunker = new FileChunker(datFile, 1024 * 1024 * 50); // 30*this.topReader.configurationLength); // we read in chunks of 30 MB 
        this.confLength = this.topReader.configurationLength + 3;
        this.numNuc = system.systemLength();
        this.trajectorySlider = document.getElementById("trajectorySlider");
        this.indexProgressControls = document.getElementById("trajIndexingProgressControls");
        this.indexProgress = document.getElementById("trajIndexingProgress");
        this.trajControls = document.getElementById("trajControls");
        this.lookupReader = new LookupReader(this.chunker, this.confLength, (idx, lines, size) => {
            this.idx = idx;
            //try display the retrieved conf
            this.parseConf(lines);
            this.trajectorySlider.setAttribute("value", this.idx.toString());
            if (myChart) {
                // hacky way to propagate the line annotation
                myChart["annotation"].elements['hline'].options.value = trajReader.lookupReader.position_lookup[this.idx][2];
                myChart.update();
            }
        });
        if (indexes) { // use index file
            this.lookupReader.position_lookup = indexes;
            // enable traj control
            this.trajControls.hidden = false;
            //enable video creation during indexing
            let videoControls = document.getElementById("videoCreateButton");
            videoControls.disabled = false;
            //notify("finished indexing");
            this.trajectorySlider.setAttribute("max", (this.lookupReader.position_lookup.length - 1).toString());
            let timedisp = document.getElementById("trajTimestep");
            timedisp.hidden = false;
            // set focus to trajectory
            document.getElementById('trajControlsLink').click();
            document.getElementById("hyperSelectorBtnId").disabled = false;
        }
    }
    nextConfig() {
        this.idx++; // idx is also set by the callback of the reader
        if (this.idx == this.lookupReader.position_lookup.length)
            document.dispatchEvent(new Event('finalConfig'));
        if (!this.lookupReader.indexNotLoaded(this.idx))
            this.lookupReader.getConf(this.idx);
        //    this.indexingReader.get_next_conf();
        else
            this.idx--;
    }
    //indexes =[];
    indexTrajectory() {
        this.chunker.getNextChunk().arrayBuffer().then(value => {
            let buff = new Uint8Array(value);
            let val = 116; // t
            let i = 1; // first = 0; we know that the 1st index will be a t 
            let last_id = 0;
            //populate the index array by the positions of t
            while ((i = buff.indexOf(val, i + 1)) != -1) {
                //this.indexes.push(i); 
                this.lookupReader.addIndex(last_id, i - last_id, "0");
                last_id = i; // we update the last index
            }
            // what if we have just one conf
            if (this.lookupReader.position_lookup.length == 0)
                this.lookupReader.addIndex(0, this.chunker.file.size, "0");
            else {
                if (!this.trajControls.hidden) {
                    console.log("open trajectory");
                    // enable traj control
                    trajReader.trajControls.hidden = false;
                    // set focus to trajectory controls
                    document.getElementById('trajControlsLink').click();
                }
            }
            // handle first read to display some conf
            if (this.firstRead) {
                this.firstRead = false;
                this.lookupReader.getConf(0); // load up first conf
            }
            if (!this.chunker.isLast()) {
                //do update magic
                let state = this.chunker.getEstimatedState(this.lookupReader.position_lookup);
                if (this.indexProgressControls.hidden) {
                    this.indexProgressControls.hidden = false;
                    this.trajControls.hidden = false;
                }
                this.indexProgress.value = Math.round((state[1] / state[0]) * 100);
                console.log(Math.round((state[1] / state[0]) * 100));
                this.indexTrajectory();
            }
            else {
                //finish up indexing
                console.log("done");
                //console.log("indexes:",this.indexes);
                document.dispatchEvent(new Event('finalConfigIndexed'));
            }
        }, reason => {
            console.log(reason);
        });
        //function _load(e) {
        //    e.preventDefault(); // cancel default actions
        //    if(trajReader.indexingReader.readyState == 1)
        //        setTimeout(_load,3); // try untill can actually read
        //    trajReader.indexingReader.getNextConf();
        //
        //    let state = trajReader.chunker.getEstimatedState(trajReader.lookupReader.position_lookup);
        //    if(trajReader.indexProgressControls.hidden)
        //        trajReader.indexProgressControls.hidden=false;
        //    
        //    trajReader.indexProgress.value=Math.round((state[1]/state[0]) * 100);
        //    trajReader.trajectorySlider.setAttribute("max" ,
        //        (trajReader.lookupReader.position_lookup.length-1).toString()
        //    );
        //
        //    if(trajReader.lookupReader.position_lookup.length>1 && trajReader.trajControls.hidden){
        //        //enable video creation during indexing
        //        let videoControls = <HTMLButtonElement>document.getElementById("videoCreateButton");
        //        videoControls.disabled = false;
        //        
        //        // enable traj control
        //        trajReader.trajControls.hidden = false;
        //        // set focus to trajectory controls
        //        document.getElementById('trajControlsLink').click();
        //    }  
        //
        //};
        //
        //// Listen for last configuration event
        //function _done(e) {
        //    document.removeEventListener('nextConfigIndexed', _load);
        //    document.removeEventListener('finalConfigIndexed', _done);
        //
        //    //notify("finished indexing");
        //    trajReader.trajectorySlider.setAttribute("max" ,
        //        (trajReader.lookupReader.position_lookup.length-1).toString()
        //    );
        //
        //    
        //    (<HTMLElement>document.getElementById('trajIndexingProgress')).hidden=true;
        //    (<HTMLElement>document.getElementById('trajIndexingProgressLabel')).hidden=true;
        //    //open save index file
        //    if(trajReader.lookupReader.position_lookup.length>1)
        //        (<HTMLElement>document.getElementById('downloadIndex')).hidden=false;
        //    
        //    (<HTMLButtonElement>document.getElementById("hyperSelectorBtnId")).disabled = false;
        //
        //};
        //document.addEventListener('nextConfigIndexed', _load);
        //document.addEventListener('finalConfigIndexed', _done);
        //trajReader.indexingReader.getNextConf();
    }
    downloadIndexFile() {
        makeTextFile("trajectory.idx", JSON.stringify(trajReader.lookupReader.position_lookup));
    }
    retrieveByIdx(idx) {
        //used by the slider to set the conf
        if (this.lookupReader.readyState != 1) {
            //        setTimeout(()=>{
            //            this.retrieveByIdx(idx);
            //        },30); // try untill can actually read
            //else {
            this.idx = idx;
            this.lookupReader.getConf(idx);
            this.trajectorySlider.setAttribute("value", this.idx.toString());
            if (myChart) {
                // hacky way to propagate the line annotation
                myChart["annotation"].elements['hline'].options.value = trajReader.lookupReader.position_lookup[idx][2];
                myChart.update();
            }
        }
    }
    previousConfig() {
        this.idx--; // ! idx is also set by the callback of the reader
        if (this.idx < 0) {
            notify("Can't step past the initial conf!");
            this.idx = 0;
        }
        this.trajectorySlider.setAttribute("value", this.idx.toString());
        this.lookupReader.getConf(this.idx);
    }
    playTrajectory() {
        this.playFlag = !this.playFlag;
        if (this.playFlag) {
            this.intervalId = setInterval(() => {
                if (trajReader.idx == trajReader.lookupReader.position_lookup.length - 1) {
                    this.playFlag = false;
                    clearInterval(this.intervalId);
                    return;
                }
                trajReader.nextConfig();
            }, 100);
        }
        else {
            clearInterval(this.intervalId);
            this.playFlag = false;
        }
    }
    parseConf(lines) {
        let system = this.system;
        let numNuc = this.numNuc;
        // parse file into lines
        //let lines = this.curConf;
        if (lines.length - 3 < numNuc) { //Handles dat files that are too small.  can't handle too big here because you don't know if there's a trajectory
            notify(".dat and .top files incompatible", "alert");
            return;
        }
        if (box === undefined)
            box = new THREE.Vector3(0, 0, 0);
        // Increase the simulation box size if larger than current
        box.x = Math.max(box.x, parseFloat(lines[1].split(" ")[2]));
        box.y = Math.max(box.y, parseFloat(lines[1].split(" ")[3]));
        box.z = Math.max(box.z, parseFloat(lines[1].split(" ")[4]));
        redrawBox();
        const time = parseInt(lines[0].split(" ")[2]);
        this.time = time; //update our notion of time
        confNum += 1;
        console.log(confNum, "t =", time);
        let timedisp = document.getElementById("trajTimestep");
        timedisp.innerHTML = `t = ${time.toLocaleString()}`;
        //timedisp.hidden = false;
        // discard the header
        lines = lines.slice(3);
        let currentNucleotide, l;
        if (this.firstConf) {
            this.firstConf = false;
            let currentStrand = system.strands[0];
            //for each line in the current configuration, read the line and calculate positions
            for (let i = 0; i < numNuc; i++) {
                if (lines[i] == "" || lines[i].slice(0, 1) == 't') {
                    break;
                }
                ;
                // get the nucleotide associated with the line
                currentNucleotide = elements.get(i + system.globalStartId);
                // consume a new line from the file
                l = lines[i].split(" ");
                currentNucleotide.calcPositionsFromConfLine(l, true);
                //when a strand is finished, add it to the system
                if (!currentNucleotide.n5 || currentNucleotide.n5 == currentStrand.end3) { //if last nucleotide in straight strand
                    if (currentNucleotide.n5 == currentStrand.end3) {
                        currentStrand.end5 = currentNucleotide;
                    }
                    system.addStrand(currentStrand); // add strand to system
                    currentStrand = system.strands[currentStrand.id]; //strandID]; //don't ask, its another artifact of strands being 1-indexed
                    if (elements.get(currentNucleotide.id + 1)) {
                        currentStrand = elements.get(currentNucleotide.id + 1).strand;
                    }
                }
            }
            addSystemToScene(system);
            sysCount++;
        }
        else {
            // here goes update logic in theory ?
            for (let lineNum = 0; lineNum < numNuc; lineNum++) {
                if (lines[lineNum] == "") {
                    notify("There's an empty line in the middle of your configuration!");
                    break;
                }
                ;
                currentNucleotide = elements.get(system.globalStartId + lineNum);
                // consume a new line
                l = lines[lineNum].split(" ");
                currentNucleotide.calcPositionsFromConfLine(l);
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
        centerAndPBC(system.getMonomers());
        if (forceHandler)
            forceHandler.redraw();
        render();
        // Signal that config has been loaded
        // block the nextConfig loaded to prevent the video loader from continuing after the chunk
        document.dispatchEvent(new Event('nextConfigLoaded'));
    }
}
