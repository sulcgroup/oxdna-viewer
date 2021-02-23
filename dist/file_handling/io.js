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
    get_next_chunk() {
        if (!this.is_last())
            this.current_chunk++;
        return this.get_chunk();
    }
    get_prev_chunk() {
        this.current_chunk--;
        if (this.current_chunk <= 0)
            this.current_chunk = 0;
        return this.get_chunk();
    }
    is_last() {
        if (this.current_chunk * this.chunk_size + this.chunk_size > this.file.size)
            return true;
        return false;
    }
    get_chunk_at_pos(start, size) {
        return this.file.slice(start, start + size);
    }
    get_estimated_state(position_lookup) {
        // reads the current position lookup array to 
        // guestimate conf count, and how much confs are left in the file
        let l = position_lookup.length;
        let size = position_lookup[l - 1][1];
        let confs_in_file = Math.round(this.file.size / size);
        return [confs_in_file, l];
    }
    get_chunk() {
        return this.file.slice(this.current_chunk * this.chunk_size, this.current_chunk * this.chunk_size + this.chunk_size);
    }
}
class ForwardReader extends FileReader {
    constructor(chunker, confLength, callback) {
        super();
        this.firstConf = true;
        this.byteSize = str => new Blob([str]).size;
        this.onload = ((evt) => {
            return () => {
                let file = this.result;
                this.StrBuff = this.StrBuff.concat(file);
                this._handle_read();
            };
        })();
        this.chunker = chunker;
        this.confLength = confLength;
        this.callback = callback;
        this.idx = -1;
        this.configsBuffer = [];
        this.StrBuff = "";
    }
    _handle_read() {
        //now we can populate the configs buffer 
        this.configsBuffer = this.StrBuff.split(/[t]+/g);
        //an artifact of this is that a single conf gets splitted into "" and the rest
        if (this.configsBuffer[0] === "")
            this.configsBuffer.shift(); // so we can discard the first entry
        // now the current conf to process is 1st in configsBuffer
        let cur_conf = this.configsBuffer.shift();
        if (cur_conf === undefined && this.chunker.is_last()) {
            notify("No more confs to load!");
            document.dispatchEvent(new Event('finalConfig'));
            document.dispatchEvent(new Event('finalConfigIndexed'));
            this.callback(this.idx, 0, 0);
            return;
        }
        if (cur_conf === undefined)
            cur_conf = "";
        let lines = cur_conf.split(/[\n]+/g);
        if (lines.length <= this.confLength && !this.chunker.is_last()) { // we need more as configuration is too small
            //there should be no conf in the buffer
            this.StrBuff = "t" + cur_conf; // this takes care even of cases where a line like xxx yyy zzz is read only to xxx y
            this.readAsText(//so we ask the chunker to spit out more
            this.chunker.get_next_chunk());
            return;
        }
        this.idx++; // we are moving forward
        let size = this.byteSize("t" + cur_conf); // as we are missing a t which is 1 in byteSize
        // we need to empty the StringBuffer
        this.StrBuff = this.StrBuff.slice(size);
        this.callback(this.idx, lines, size);
    }
    get_next_conf() {
        if (this.firstConf) {
            this.readAsText(this.chunker.get_next_chunk());
            this.firstConf = false;
        }
        else
            this._handle_read();
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
    add_index(offset, size) {
        this.position_lookup.push([offset, size]);
    }
    index_not_loaded(idx) {
        let l = this.position_lookup.length;
        return l == 0 || idx >= l;
    }
    get_conf(idx) {
        if (idx < this.position_lookup.length) {
            let offset = this.position_lookup[idx][0];
            this.size = this.position_lookup[idx][1];
            this.idx = idx; // as we are successful in retrieving
            // we can update 
            this.readAsText(this.chunker.get_chunk_at_pos(offset, this.size));
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
        this.chunker = new FileChunker(datFile, topReader.topFile.size * 15);
        this.confLength = this.topReader.configurationLength + 3;
        this.numNuc = system.systemLength();
        this.trajectorySlider = document.getElementById("trajectorySlider");
        this.indexProgressControls = document.getElementById("trajIndexingProgressControls");
        this.indexProgress = document.getElementById("trajIndexingProgress");
        this.trajControls = document.getElementById("trajControls");
        this.lookupReader = new LookupReader(this.chunker, this.confLength, (idx, lines, size) => {
            this.idx = idx;
            //try display the retrieved conf
            this.parse_conf(lines);
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
        }
        this.indexingReader = new ForwardReader(this.chunker, this.confLength, (idx, lines, size) => {
            if (size > 0) {
                //record the retrieved conf
                this.lookupReader.add_index(this.offset, size);
                this.offset += size;
                document.dispatchEvent(new Event('nextConfigIndexed'));
                console.log(this.firstRead);
                if (this.firstRead) {
                    this.parse_conf(lines);
                    this.firstRead = false;
                }
            }
        });
    }
    nextConfig() {
        this.idx++; // idx is also set by the callback of the reader
        if (this.idx == this.lookupReader.position_lookup.length)
            document.dispatchEvent(new Event('finalConfig'));
        if (!this.lookupReader.index_not_loaded(this.idx))
            this.lookupReader.get_conf(this.idx);
        //    this.indexingReader.get_next_conf();
        else
            this.idx--;
        this.trajectorySlider.setAttribute("value", this.idx.toString());
    }
    indexTrajectory() {
        function _load(e) {
            e.preventDefault(); // cancel default actions
            if (trajReader.indexingReader.readyState == 1)
                setTimeout(_load, 3); // try untill can actually read
            trajReader.indexingReader.get_next_conf();
            //TODO:find out why this is happening
            let state = trajReader.chunker.get_estimated_state(trajReader.lookupReader.position_lookup);
            if (trajReader.indexProgressControls.hidden)
                trajReader.indexProgressControls.hidden = false;
            trajReader.indexProgress.value = Math.round((state[1] / state[0]) * 100);
            trajReader.trajectorySlider.setAttribute("max", (trajReader.lookupReader.position_lookup.length - 1).toString());
            console.log("am indexing");
            if (state[1] >= state[0]) {
                document.dispatchEvent(new Event('finalConfigIndexed'));
            }
            if (trajReader.lookupReader.position_lookup.length > 1 && trajReader.trajControls.hidden) {
                //enable video creation during indexing
                let videoControls = document.getElementById("videoCreateButton");
                videoControls.disabled = false;
                // enable traj control
                //let trajControls = document.getElementById("trajControls");
                trajReader.trajControls.hidden = false;
                document.getElementById('trajControlsLink').click();
            }
        }
        ;
        // Listen for last configuration event
        function _done(e) {
            document.removeEventListener('nextConfigIndexed', _load);
            document.removeEventListener('finalConfigIndexed', _done);
            //notify("finished indexing");
            trajReader.trajectorySlider.setAttribute("max", (trajReader.lookupReader.position_lookup.length - 1).toString());
            document.getElementById('trajIndexingProgress').hidden = true;
            document.getElementById('trajIndexingProgressLabel').hidden = true;
            //open save index file
            if (trajReader.lookupReader.position_lookup.length > 1)
                document.getElementById('downloadIndex').hidden = false;
        }
        ;
        document.addEventListener('nextConfigIndexed', _load);
        document.addEventListener('finalConfigIndexed', _done);
        trajReader.indexingReader.get_next_conf();
    }
    downloadIndexFile() {
        makeTextFile("trajectory.idx", JSON.stringify(trajReader.lookupReader.position_lookup));
    }
    retrieveByIdx(idx) {
        //used by the slider to set the conf
        if (this.lookupReader.readyState == 1)
            setTimeout(() => {
                this.retrieveByIdx(idx);
            }, 30); // try untill can actually read
        else {
            this.idx = idx;
            this.lookupReader.get_conf(idx);
        }
    }
    previousConfig() {
        this.idx--; // ! idx is also set by the callback of the reader
        if (this.idx < 0) {
            notify("Can't step past the initial conf!");
            this.idx = 0;
        }
        this.trajectorySlider.setAttribute("value", this.idx.toString());
        this.lookupReader.get_conf(this.idx);
    }
    playTrajectory() {
        this.playFlag = !this.playFlag;
        if (this.playFlag) {
            this.intervalId = setInterval(() => {
                if (this.idx == trajReader.lookupReader.position_lookup.length) {
                    this.playFlag = false;
                    clearInterval(this.intervalId);
                    return;
                }
                trajReader.nextConfig();
                trajReader.trajectorySlider.setAttribute("value", trajReader.lookupReader.idx.toString());
            }, 100);
        }
        else {
            clearInterval(this.intervalId);
            this.playFlag = false;
        }
    }
    parse_conf(lines) {
        let system = this.system;
        let numNuc = this.numNuc;
        // parse file into lines
        //let lines = this.curConf;
        if (lines.length - 3 < numNuc) { //Handles dat files that are too small.  can't handle too big here because you don't know if there's a trajectory
            notify(".dat and .top files incompatible", "alert");
            return;
        }
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
            forceHandler.update();
        render();
        // Signal that config has been loaded
        // block the nextConfig loaded to prevent the video loader from continuing after the chunk
        document.dispatchEvent(new Event('nextConfigLoaded'));
    }
}
