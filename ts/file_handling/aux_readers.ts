/// <reference path="../typescript_definitions/index.d.ts" />

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////               Read a file, modify the scene                ////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

function readTraj(trajFile:File, system:System):Promise<string> {
    system.reader = new TrajectoryReader(trajFile, system);
    return system.reader.lookupReader.promise
}

function readJson(jsonFile:File, system:System){ // this still doesn't work for some reason.  It might be a bigger problem tho.
    return parseFileWith(jsonFile, parseJson, [system])
}

// Creates color overlays
function makeLut(data, key, system) {

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
    const end = system.systemLength();
    for (let j = 0; j < end; j++) { //insert lut colors into lutCols[] to toggle Lut coloring later
        system.lutCols[j] = lut.getColor(Number(system.colormapFile[key][elements.get(system.globalStartId + j).sid]));
    } 
}

// export the current camera position
const exportCam = ()=>{
    const cam = {
        position: camera.position,
        rotation: camera.rotation,
        up: camera.up,
        target: controls.target,
    }
    const camJSON = JSON.stringify(cam);
    makeTextFile("camera.cam", camJSON);
}
// Read a camera export file
const readCamFile = (file:File)=>{
    file.text().then(txt=>{
        const cam = JSON.parse(txt);
        camera.position.set(cam.position.x,cam.position.y,cam.position.z);
        camera.rotation.set(cam.rotation.x,cam.rotation.y,cam.rotation.z);
        camera.up.set(cam.up.x,cam.up.y,cam.up.z);
        controls.target.set(cam.target.x,cam.target.y,cam.target.z);
    })
}

// Highlight sequences found in cadnano or sequence csv
const handleCSV = (file:File)=>{
    // highlight all the sequences complying with the cadnano file
    // or a line by line sequence file 
    const search_func = (system,seq) => {
        system.strands.forEach(strand => {
            strand.search(seq).forEach(match => {
                api.selectElements(match, true);
            });
        });
    };

    const cadnano_line_to_seq = (line)=> line.split(",")[2].replaceAll("?","N").toUpperCase().trim();
    const reg_line = (line)=> line.replaceAll("?","N").toUpperCase().trim();

    //read in a cadnano csv sequence file and highlight them in the scene
    file.text().then(txt=>{
        let lines = txt.split("\n");
        let len = lines.length;
        let start_id = 0;

        //we handle bothe cadnano and just regular lists
        let processor = reg_line;
        if (lines[0].startsWith("Start,End,Sequence,Length,Color")){
            start_id=1;
            processor= cadnano_line_to_seq;
        }
        for(let i=start_id; i<len;i++){
            if(lines[i]){
            let seq = processor(lines[i]);
            console.log(seq)
            systems.forEach(sys => search_func(sys,seq));
            tmpSystems.forEach(sys => search_func(sys,seq));
            }
        }
        render();
            
    });
}

//parse a trap file
function readTrap(trapFile) {

    trapFile.text().then(text=>{
        //{ can be replaced with \n to make sure no parameter is lost
        while(text.indexOf("{")>=0)
            text = text.replace("{","\n");
        // traps can be split by } because everything between {} is one trap
        let traps = text.split("}");

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
                    notify(`External force ${f["type"]} type not supported yet, feel free to implement in aux_readers.ts and force.ts`);
                    break;
            }
        });
        if (!forceHandler) {
            forceHandler = new ForceHandler(forces);
        } else {
            forceHandler.set(forces);
        }
        render()
    })
}

// Json files can be a lot of things, read them.
function parseJson(json:string, system:System) {
    const data = JSON.parse(json);
    for (var key in data) {
        if (data[key].length == system.systemLength()) { //if json and dat files match/same length
            if (typeof (data[key][0]) == "number") { //we assume that scalars denote a new color map
                system.setColorFile(data);
                makeLut(data, key, system);
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

function readSelectFile(reader) {
    if (systems.length > 1) {
        notify("Warning: Selection files select on global ID, not system ID.  There are multiple systems loaded.", 'warning')
    }
    const ids = (reader.result as string).split(' ').map(function(i) {
        return parseInt(i, 10)
    });
    api.selectElementIDs(ids, true)
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
        let l = lines[i].split(/\s+/)
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
    net.networktype = "par";

    net.prepVis(); // Creates Mesh for visualization
    networks.push(net); // Any network added here shows up in UI network selector
    selectednetwork = net.nid; // auto select network just loaded
    view.addNetwork(net.nid);

    notify("Par file read! Turn on visualization in the Protein tab")
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
            let l = lines[i].split(/\s+/).map(function(item) {return item.trim()}).filter(n => n);
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
            let l = lines[i].split(/\s+/)
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