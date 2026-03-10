/// <reference path="../typescript_definitions/index.d.ts" />
// Rename this to oxDNA_reader.ts???
class FileChunker {
    file;
    current_chunk;
    chunk_size;
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
    getOffset() {
        return this.current_chunk * this.chunk_size;
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
    chunker;
    position_lookup = []; // store offset and size
    idx = -1;
    callback;
    size;
    promise;
    constructor(chunker, callback) {
        super();
        this.chunker = chunker;
        this.callback = callback;
        this.promise = new Promise(function (resolve, reject) {
            this.onload = () => {
                let file = this.result;
                let lines = file.split(/[\n]+/g);
                // we need to pass down idx to sync with the DatReader
                this.callback(this.idx, lines, this.size);
                resolve("success");
            };
            this.onerror = () => {
                console.log("oh no!");
                reject("rejected");
            };
        }.bind(this));
    }
    addIndex(offset, size, time) {
        this.position_lookup.push([offset, size, time]);
    }
    indexNotLoaded(idx) {
        let l = this.position_lookup.length;
        return l == 0 || idx >= l;
    }
    async getConf(idx) {
        if (idx < this.position_lookup.length) {
            let offset = this.position_lookup[idx][0];
            this.size = this.position_lookup[idx][1];
            this.idx = idx; // as we are successful in retrieving
            // we can update 
            this.readAsText(this.chunker.getChunkAtPos(offset, this.size));
            await this.promise;
        }
    }
}
class TrajectoryReader {
    system;
    chunker;
    datFile;
    firstConf = true;
    lookupReader;
    idx = 0;

    // ------------------------------------------------------------------
    // Frame index compatibility accessors
    // ------------------------------------------------------------------
    // Canonical state is `idx`. These getters exist so older codepaths and
    // aux overlay loaders can read the current frame without duplicating state.
    get currentFrame() { return this.idx; }   // legacy alias
    get frame() { return this.idx; }          // legacy alias

    offset = 0;
    time;
    firstRead = true;
    trajectorySlider;
    indexProgressControls;
    indexProgress;
    trajControls;
    constructor(datFile, system, indexes) {
        this.system = system;
        this.datFile = datFile;
        this.chunker = new FileChunker(datFile, 1024 * 1024 * 50); // we read in chunks of 50 MB 
        this.trajectorySlider = document.getElementById("trajectorySlider");
        this.indexProgressControls = document.getElementById("trajIndexingProgressControls");
        this.indexProgress = document.getElementById("trajIndexingProgress");
        this.trajControls = document.getElementById("trajControls");
        this.lookupReader = new LookupReader(this.chunker, (idx, lines) => {
            this.idx = idx;
            //try display the retrieved conf
            this.parseConf(lines);
            this.trajectorySlider.setAttribute("value", this.idx.toString());
            // // Apply any frame-synced overlays (e.g., Stress (MPa))
            // this.system._applyStressFrame && this.system._applyStressFrame(this.idx);
            if (myChart) {
                // hacky way to propagate the line annotation
                myChart["annotation"].elements['hline'].options.value = this.lookupReader.position_lookup[this.idx][2];
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
            this.trajectorySlider.setAttribute("max", (this.lookupReader.position_lookup.length - 1).toString());
            let timedisp = document.getElementById("trajTimestep");
            timedisp.hidden = false;
            // set focus to trajectory
            document.getElementById('trajControlsLink').click();
            document.getElementById("hyperSelectorBtnId").disabled = false;
        }
        else {
            this.indexTrajectory();
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
    indexTrajectory() {
        var worker = new Worker('./dist/file_handling/read_worker.js');
        worker.postMessage(this.datFile);
        worker.onmessage = (e) => {
            let [indices, last, state] = e.data;
            this.lookupReader.position_lookup = indices;
            if (this.firstRead) {
                this.firstRead = false;
                this.lookupReader.getConf(0); // load up first conf
                this.indexProgressControls.hidden = false;
                this.trajControls.hidden = false;
                // set focus to trajectory controls
                document.getElementById('trajControlsLink').click();
            }
            //update progress bar
            this.indexProgress.value = Math.round((state[1] / state[0]) * 100);
            if (last) {
                //finish up indexing
                notify("Finished indexing!");
                //dirty hack to handle single conf case
                if (indices.length == 1) {
                    this.trajectorySlider.hidden = true;
                    this.indexProgressControls.hidden = true;
                    this.trajControls.hidden = true;
                    document.getElementById('fileSectionLink').click();
                    return;
                }
                // and index file saving 
                document.getElementById('downloadIndex').hidden = false;
                // hide progress bar 
                document.getElementById('trajIndexingProgress').hidden = true;
                document.getElementById('trajIndexingProgressLabel').hidden = true;
                //enable orderparameter selector 
                document.getElementById("hyperSelectorBtnId").disabled = false;
            }
            //update slider
            this.trajectorySlider.setAttribute("max", (this.lookupReader.position_lookup.length - 1).toString());
        };
    }
    downloadIndexFile() {
        makeTextFile("trajectory.idx", JSON.stringify(this.lookupReader.position_lookup));
    }
    retrieveByIdx(idx) {
        //used by the slider to set the conf
        if (this.lookupReader.readyState != 1) {
            this.idx = idx;
            this.lookupReader.getConf(idx);
            this.trajectorySlider.setAttribute("value", this.idx.toString());
            if (myChart) {
                // hacky way to propagate the line annotation
                myChart["annotation"].elements['hline'].options.value = this.lookupReader.position_lookup[idx][2];
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
    // TODO: Make the frame rate choosable by a HTML element
    // TODO: Make it listen for the 'nextConfigLoaded' event and fire the next conf when either the
    // timeout is config is ready or the timeout is reached, whichever is second.
    playFlag = false;
    intervalId = null;
    playTrajectory() {
        this.playFlag = !this.playFlag;
        if (this.playFlag) {
            this.intervalId = setInterval(() => {
                if (this.idx == this.lookupReader.position_lookup.length - 1) {
                    this.playFlag = false;
                    clearInterval(this.intervalId);
                    return;
                }
                this.nextConfig();
            }, 100);
        }
        else {
            clearInterval(this.intervalId);
            this.playFlag = false;
        }
    }
    parseConf(lines) {
        let system = this.system;
        let numNuc = system.systemLength(); // NEVER call system.systemLength() inside a for loop, it walks the whole system.
        if (lines.length - 3 < numNuc) { //Handles dat files that are too small.  can't handle too big here because you don't know if there's a trajectory
            notify(".dat and .top files incompatible", "alert");
            return;
        }
        // Parse time and update time displays
        const time = parseInt(lines[0].split(/\s+/)[2]);
        this.time = time;

        // -------------------------------
        // Publish current frame/time globally (forces + overlays rely on this)
        // -------------------------------
        // current frame is exposed via TrajectoryReader.idx (and legacy getter aliases)

        // global "step" signals (used by time-dependent forces)
        window.currentFrameIndex = this.idx;
        window.currentSimTime = time;

        // If you have frame-synced overlays (e.g. Stress (MPa)), update them here too
        if (this.system && this.system._applyStressFrame) {
        this.system._applyStressFrame(this.idx);
        }

        confNum += 1;
        console.log(confNum, "t =", time);
        let timedisp = document.getElementById("trajTimestep");
        timedisp.innerHTML = `t = ${time.toLocaleString()}`;
        // Parse box and increase box size if larger than current box
        if (box === undefined)
            box = new THREE.Vector3(0, 0, 0);
        let newBox = new THREE.Vector3(parseFloat(lines[1].split(/\s+/)[2]), parseFloat(lines[1].split(/\s+/)[3]), parseFloat(lines[1].split(/\s+/)[4]));
        box.x = Math.max(box.x, newBox.x);
        box.y = Math.max(box.y, newBox.y);
        box.z = Math.max(box.z, newBox.z);
        redrawBox();
        // discard the header so that line number matches particle number
        lines = lines.slice(3);
        let currentNucleotide, l;
        //for each line in the current configuration, read the line and calculate positions
        for (let i = 0; i < numNuc; i++) {
            if (lines[i] == "" || lines[i].slice(0, 1) == 't') {
                notify("WARNING: provided configuration is shorter than topology. Assuming you know what you're doing.", 'warning');
                break;
            }
            ;
            // consume a new line from the file
            l = lines[i].split(/\s+/);
            // get the nucleotide associated with the line
            if (system.lines2ele) {
                currentNucleotide = system.lines2ele.get(i);
            } // ugly hack to get oxServe to work
            else {
                currentNucleotide = elements.get(i + system.globalStartId);
            }
            currentNucleotide.calcPositionsFromConfLine(l);
        }
        // Update instancing arrays, run inboxing, re-calculate forces
        system.callAllUpdates();
        tmpSystems.forEach(s => s.callAllUpdates());
        centerAndPBC(system.getMonomers(), newBox);
        // Force files tend to read faster than configuration files, so there's a race condition.
        if (forceHandler.forces.length > 0) {
            forceHandler.redrawTraps();
            if (typeof forceHandler.redrawSpheres === "function") forceHandler.redrawSpheres();
            if (typeof forceHandler.redrawBoxes === "function") forceHandler.redrawBoxes();
            if (typeof forceHandler.redrawPlanes === "function") forceHandler.redrawPlanes();
        }
        // Signal that config has been loaded. This is used by the trajectory video loader.
        document.dispatchEvent(new Event('nextConfigLoaded'));
    }
}
