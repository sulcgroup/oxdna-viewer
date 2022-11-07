/// <reference path="../typescript_definitions/index.d.ts" />
/// <reference path="./order_parameter_selector.ts" />
class TopReader extends FileReader{
    topFile: File = null;
    system: System;
    elems: ElementMap;

    sidCounter = 0;
    nucLocalID: number = 0;
    lastStrand: number; //strands are 1-indexed in oxDNA .top files
    n3: number;
    callback : Function;
    configurationLength : number;

    constructor(topFile: File, system: System, elems: ElementMap, callback : Function){
        super();
        this.topFile = topFile;
        this.system = system;
        this.elems = elems;
        this.callback = callback;
        this.onload = () => {
            let nucCount = this.elems.getNextId();
            let file = this.result as string
            let lines = file.split(/[\n]+/g);
            lines = lines.slice(1); // discard the header
            this.configurationLength = lines.length;

            let l0 = lines[0].split(" "); 
            let strID = parseInt(l0[0]); //proteins and GS strands are negative indexed
            this.lastStrand = strID;
            let currentStrand: Strand = this.system.createStrandTyped(strID, l0[1]);
            this.system.addStrand(currentStrand);
            
            // create empty list of elements with length equal to the topology
            // Note: this is implemented such that we have the elements for the DAT reader 
            let nuc: BasicElement;//DNANucleotide | RNANucleotide | AminoAcid | GenericSphere;
            for (let j = 0; j < lines.length; j++) {
                this.elems.set(nucCount+j, nuc);
            }

            // Create new cluster for loaded structure:
            let cluster = ++clusterCounter;
            
            lines.forEach((line, i) => {
                if (line == "") {
                    // Delete last element
                    this.configurationLength -= 1;
                    this.elems.delete(this.elems.getNextId()-1);
                    return;
                }
                //split the file and read each column, format is: "strID base n3 n5"
                let l = line.split(" "); 
                strID = parseInt(l[0]);
                    
                if (strID != this.lastStrand) { //if new strand id, make new strand                        
                    currentStrand = this.system.createStrandTyped(strID, l[1]);
                    this.system.addStrand(currentStrand);
                    this.nucLocalID = 0;
                };
                    
                //create a new element
                if (!this.elems.get(nucCount + i))
                    this.elems.set(nucCount + i, currentStrand.createBasicElement(nucCount + i));
                let nuc = this.elems.get(nucCount + i);

                // Set systemID
                nuc.sid = this.sidCounter++;

                // Set cluster id;
                nuc.clusterId = cluster;

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
                //if we meet a U, we have an RNA (its dumb, but its all we got)
                //this has an unfortunate side effect that the first few nucleotides in an RNA strand are drawn as DNA (before the first U)
                if (base === "U") RNA_MODE = true;
                    
                this.nucLocalID += 1;
                this.lastStrand = strID;
            });
            nucCount = this.elems.getNextId();
            // usually the place where the DatReader gets fired
            this.callback();
        };
    }
    
    read(){
        this.readAsText(this.topFile);
    }
}


class FileChunker{
    file:Blob;
    current_chunk : number;
    chunk_size : number;
    constructor(file: Blob, chunk_size: number){
        this.file = file;
        this.chunk_size = chunk_size;
        this.current_chunk = -1;
    }
    getNextChunk(){
        if(!this.isLast())
            this.current_chunk++;
        return this.getChunk();
    }

    getOffset(){
        return this.current_chunk*this.chunk_size;
    }

    getPrevChunk(){
        this.current_chunk--;
        if(this.current_chunk <= 0) this.current_chunk = 0;
        return this.getChunk();
    }

    isLast(){
        if(this.current_chunk * this.chunk_size + this.chunk_size > this.file.size)
            return true;
        return false;
    }
    getChunkAtPos(start, size){
        return this.file.slice(
            start,  start + size
        );
    }

    getEstimatedState(position_lookup){ 
        // reads the current position lookup array to 
        // guestimate conf count, and how much confs are left in the file
        let l = position_lookup.length;
        let size = position_lookup[l-1][1]; 
        let confs_in_file = Math.round(this.file.size / size); 
        return [confs_in_file, l];
    }

    private getChunk(){
        return this.file.slice(
            this.current_chunk * this.chunk_size,
            this.current_chunk * this.chunk_size + this.chunk_size
        );
    }
}

class  LookupReader extends FileReader {
    chunker : FileChunker;
    position_lookup = []; // store offset and size
    idx = -1;
    confLength : number;
    callback : Function;
    size :number;

    constructor(chunker, confLength, callback) {
        super();
        this.chunker = chunker;
        this.confLength = confLength;
        this.callback = callback;
        this.onload = (evt) =>{ // extract configuration
            let file = this.result as string;
            let lines = file.split(/[\n]+/g);
            // we need to pass down idx to sync with the DatReader
            this.callback(this.idx, lines, this.size);
        };
    }

    addIndex(offset,size,time){
        this.position_lookup.push(
            [offset,size,time]
        );
    }
    
    indexNotLoaded(idx:number){
        let l = this.position_lookup.length;
        return l == 0 || idx >= l;
    }

    getConf(idx:number){
        if (idx < this.position_lookup.length){
            let offset = this.position_lookup[idx][0];
            this.size  = this.position_lookup[idx][1];
            this.idx = idx; // as we are successful in retrieving
                            // we can update 
            this.readAsText(
                this.chunker.getChunkAtPos(
                    offset,
                    this.size
                )
            );
        }
    }
}



class TrajectoryReader {
    topReader : TopReader;
    system : System;
    elems : ElementMap;
    chunker : FileChunker;
    datFile: File;
    confLength : number;
    firstConf = true;
    numNuc : number;
    lookupReader : LookupReader;
    idx = 0;
    offset = 0;
    time:number;
    firstRead:boolean=true;
    trajectorySlider :HTMLInputElement;
    indexProgressControls :HTMLDivElement;
    indexProgress :HTMLProgressElement;
    trajControls:HTMLElement;

    constructor(datFile:File, topReader: TopReader, system: System, elems: ElementMap,indexes?:[]){
        this.topReader = topReader;
        this.system = system;
        this.elems = elems;
        this.datFile = datFile;
        this.chunker = new FileChunker(datFile, 1024 * 1024 * 50);// 30*this.topReader.configurationLength); // we read in chunks of 30 MB 
        this.confLength = this.topReader.configurationLength +3; 
        this.numNuc = system.systemLength();
        this.trajectorySlider = <HTMLInputElement>document.getElementById("trajectorySlider");
        this.indexProgressControls = <HTMLDivElement>document.getElementById("trajIndexingProgressControls");
        this.indexProgress=<HTMLProgressElement>document.getElementById("trajIndexingProgress");
        this.trajControls = document.getElementById("trajControls");
        this.lookupReader = new LookupReader(this.chunker,this.confLength,
            (idx, lines, size)=>{
                this.idx = idx;
                //try display the retrieved conf
                this.parseConf(lines);
                this.trajectorySlider.setAttribute("value",this.idx.toString());
                if(myChart){
                    // hacky way to propagate the line annotation
                    myChart["annotation"].elements['hline'].options.value = trajReader.lookupReader.position_lookup[this.idx][2];
                    myChart.update();
                }
            });

        if (indexes) {// use index file
            this.lookupReader.position_lookup=indexes;
            // enable traj control
            this.trajControls.hidden = false;
            //enable video creation during indexing
            let videoControls = <HTMLButtonElement>document.getElementById("videoCreateButton");
            videoControls.disabled = false;
            this.trajectorySlider.setAttribute("max" ,
                (this.lookupReader.position_lookup.length-1).toString()
            );
            let timedisp = document.getElementById("trajTimestep");
            timedisp.hidden = false;
            // set focus to trajectory
            document.getElementById('trajControlsLink').click();
            (<HTMLButtonElement>document.getElementById("hyperSelectorBtnId")).disabled = false;
        }
    }

    nextConfig(){
        this.idx++; // idx is also set by the callback of the reader
        if(this.idx==this.lookupReader.position_lookup.length)
            document.dispatchEvent(new Event('finalConfig'));
        if(!this.lookupReader.indexNotLoaded(this.idx))
            this.lookupReader.getConf( this.idx );
        //    this.indexingReader.get_next_conf();
        else
            this.idx--;        
    }

    indexTrajectory(){
        var worker = new Worker('./dist/file_handling/read_worker.js');
        worker.postMessage(this.datFile);
        this.firstConf
        worker.onmessage = (e: MessageEvent) => {
            let [indices, last, state] = e.data;
            this.lookupReader.position_lookup=indices;

            if (this.firstRead){
                this.firstRead = false;
                this.lookupReader.getConf(0); // load up first conf
                this.indexProgressControls.hidden=false;
                this.trajControls.hidden = false;
                // set focus to trajectory controls
                document.getElementById('trajControlsLink').click();
            }
            //update progress bar
            this.indexProgress.value=Math.round((state[1]/state[0]) * 100);

            if(last){
            //finish up indexing
                notify("Finished indexing!");
                //dirty hack to handle single conf case
                if(indices.length==1){
                    trajReader.trajectorySlider.hidden=true;
                    this.indexProgressControls.hidden=true;
                    this.trajControls.hidden = true;
                    document.getElementById('fileSectionLink').click();
                    return;
                }
                // and index file saving 
                (<HTMLElement>document.getElementById('downloadIndex')).hidden=false;
                // hide progress bar 
                (<HTMLElement>document.getElementById('trajIndexingProgress')).hidden=true;
                (<HTMLElement>document.getElementById('trajIndexingProgressLabel')).hidden=true;
                //enable orderparameter selector 
                (<HTMLButtonElement>document.getElementById("hyperSelectorBtnId")).disabled = false;

            }
            //update slider
            trajReader.trajectorySlider.setAttribute("max" ,
                    (trajReader.lookupReader.position_lookup.length-1).toString()
            );
        };

    }
    downloadIndexFile(){
         makeTextFile("trajectory.idx", JSON.stringify(trajReader.lookupReader.position_lookup));
    }
    retrieveByIdx(idx){
        //used by the slider to set the conf
        if(this.lookupReader.readyState != 1){
            this.idx=idx;
            this.lookupReader.getConf(idx);
            this.trajectorySlider.setAttribute("value",this.idx.toString());
            if(myChart){
                // hacky way to propagate the line annotation
                myChart["annotation"].elements['hline'].options.value = trajReader.lookupReader.position_lookup[idx][2];
                myChart.update();
            }
        }
    }

    previousConfig(){
        this.idx--; // ! idx is also set by the callback of the reader
        if (this.idx < 0 ) {
            notify("Can't step past the initial conf!");
            this.idx = 0;
        }
        this.trajectorySlider.setAttribute("value",this.idx.toString());
        this.lookupReader.getConf(this.idx);
    }

    playFlag = false;
    intervalId = null;
    playTrajectory(){
        this.playFlag = !this.playFlag;

        if (this.playFlag )
        {
            this.intervalId = setInterval(()=>{
                if(trajReader.idx==trajReader.lookupReader.position_lookup.length-1)
                {
                    this.playFlag = false;
                    clearInterval(this.intervalId);
                    return;
                }
                trajReader.nextConfig();
            }, 100);
        }
        else{
            clearInterval(this.intervalId);
            this.playFlag = false;
        }
       
    }


    parseConf(lines :string[]){
        let system = this.system;
        let numNuc = this.numNuc;
        // parse file into lines
        //let lines = this.curConf;
        if (lines.length-3 < numNuc) { //Handles dat files that are too small.  can't handle too big here because you don't know if there's a trajectory
            notify(".dat and .top files incompatible", "alert");
            return
        }
        if( box === undefined)
            box = new THREE.Vector3(0,0,0);
        let newBox = new THREE.Vector3(parseFloat(lines[1].split(/\s+/)[2]), parseFloat(lines[1].split(/\s+/)[3]), parseFloat(lines[1].split(/\s+/)[4]))
        // Increase the simulation box size if larger than current
        box.x = Math.max(box.x, newBox.x);
        box.y = Math.max(box.y, newBox.y);
        box.z = Math.max(box.z, newBox.z);
        redrawBox();
    
        const time = parseInt(lines[0].split(" ")[2]);
        this.time = time; //update our notion of time
        confNum += 1
        console.log(confNum, "t =", time);
        
        let timedisp = document.getElementById("trajTimestep");
        timedisp.innerHTML = `t = ${time.toLocaleString()}`;
        //timedisp.hidden = false;

        // discard the header
        lines = lines.slice(3);
        
        let currentNucleotide: BasicElement,
            l: string[];
        
        if (this.firstConf){
            this.firstConf = false;
            let currentStrand = system.strands[0];
            //for each line in the current configuration, read the line and calculate positions
            for (let i = 0; i < numNuc; i++) {
                if (lines[i] == "" || lines[i].slice(0, 1) == 't') {
                    break
                };
                // get the nucleotide associated with the line
                currentNucleotide = elements.get(i+system.globalStartId);

                // consume a new line from the file
                l = lines[i].split(" ");
                currentNucleotide.calcPositionsFromConfLine(l, true);

                //when a strand is finished, add it to the system
                if (currentStrand !== undefined && (!currentNucleotide.n5 || currentNucleotide.n5 == currentStrand.end3)) { //if last nucleotide in straight strand
                    if (currentNucleotide.n5 == currentStrand.end3) {
                        currentStrand.end5 = currentNucleotide;
                    }
                    system.addStrand(currentStrand); // add strand to system
                    currentStrand = system.strands[currentStrand.id];//strandID]; //don't ask, its another artifact of strands being 1-indexed
                    if (elements.get(currentNucleotide.id+1)) {
                        currentStrand = elements.get(currentNucleotide.id+1).strand;
                    }
                }

            }
            addSystemToScene(system);
            sysCount++;
        }
        else{
            // here goes update logic in theory ?
            for (let lineNum = 0; lineNum < numNuc; lineNum++) {
                if (lines[lineNum] == "") {
                    notify("There's an empty line in the middle of your configuration!")
                    break
                };
                currentNucleotide = elements.get(system.globalStartId+lineNum);
                // consume a new line
                l = lines[lineNum].split(" ");
                currentNucleotide.calcPositionsFromConfLine(l);
            }
            system.callUpdates(['instanceOffset','instanceRotation']);
        }
        centerAndPBC(system.getMonomers(), newBox);
        if (forceHandler) forceHandler.redraw();
        // Signal that config has been loaded
        // block the nextConfig loaded to prevent the video loader from continuing after the chunk
        document.dispatchEvent(new Event('nextConfigLoaded'));
    }
}
