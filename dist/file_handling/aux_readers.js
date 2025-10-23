/// <reference path="../typescript_definitions/index.d.ts" />
///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////               Read a file, modify the scene                ////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
function readTraj(trajFile, system) {
    system.reader = new TrajectoryReader(trajFile, system);
    return system.reader.lookupReader.promise;
}
function readJson(jsonFile, system) {
    return parseFileWith(jsonFile, parseJson, [system]);
}
function readParFile(parFile, system) {
    return parseFileWith(parFile, parsePar, [system]);
}
// Nicer lower and upper bound 
function roundRange(arr) {
    let min = arr[0], max = arr[0];
    for (let i = 0; i < arr.length; i++) {
        if (min > arr[i])
            min = arr[i];
        if (max < arr[i])
            max = arr[i];
    }
    console.log(min, max);
    const roundedMin = Math.floor(min) + (min % 1 >= 0.5 ? 0.5 : 0);
    const roundedMax = Math.ceil(max) - ((max % 1) >= 0.5 ? 0.5 : 0);
    return [roundedMin, roundedMax];
}
// Creates color overlays
function makeLut(data, key, system) {
    let arr = data[key];
    let [min, max] = roundRange(arr);
    // we have no Lut 
    if (lut == undefined) {
        lut = new THREE.Lut(defaultColormap, 500);
        lut.setMax(max);
        lut.setMin(min);
    }
    // we need update 
    if (max > lut.maxV) {
        lut.setMax(max);
        api.removeColorbar();
    }
    if (min < lut.minV) {
        lut.setMin(min);
        api.removeColorbar();
    }
    lut.setLegendOn({ 'layout': 'horizontal', 'position': { 'x': 0, 'y': 0, 'z': 0 }, 'dimensions': { 'width': 2, 'height': 12 } }); //create legend
    lut.setLegendLabels({ 'title': key, 'ticks': 5 }); //set up legend format 
}
// export the current camera position
const exportCam = () => {
    const cam = {
        position: camera.position,
        rotation: camera.rotation,
        up: camera.up,
        target: controls.target,
    };
    const camJSON = JSON.stringify(cam);
    makeTextFile("camera.cam", camJSON);
};
// Read a camera export file
const readCamFile = (file) => {
    file.text().then(txt => {
        const cam = JSON.parse(txt);
        camera.position.set(cam.position.x, cam.position.y, cam.position.z);
        camera.rotation.set(cam.rotation.x, cam.rotation.y, cam.rotation.z);
        camera.up.set(cam.up.x, cam.up.y, cam.up.z);
        controls.target.set(cam.target.x, cam.target.y, cam.target.z);
    });
};
// Highlight sequences found in cadnano or sequence csv
const handleCSV = (file) => {
    // highlight all the sequences complying with the cadnano file
    // or a line by line sequence file 
    const search_func = (system, seq) => {
        system.strands.forEach(strand => {
            strand.search(seq).forEach(match => {
                api.selectElements(match, true);
            });
        });
    };
    const cadnano_line_to_seq = (line) => line.split(",")[2].replaceAll("?", "N").toUpperCase().trim();
    const reg_line = (line) => line.replaceAll("?", "N").toUpperCase().trim();
    //read in a cadnano csv sequence file and highlight them in the scene
    file.text().then(txt => {
        let lines = txt.split("\n");
        let len = lines.length;
        let start_id = 0;
        //we handle bothe cadnano and just regular lists
        let processor = reg_line;
        if (lines[0].startsWith("Start,End,Sequence,Length,Color")) {
            start_id = 1;
            processor = cadnano_line_to_seq;
        }
        for (let i = start_id; i < len; i++) {
            if (lines[i]) {
                let seq = processor(lines[i]);
                console.log(seq);
                systems.forEach(sys => search_func(sys, seq));
                tmpSystems.forEach(sys => search_func(sys, seq));
            }
        }
        render();
    });
};
function readForce(forceFile) {
    forceFile.text().then(text => {
        //{ can be replaced with \n to make sure no parameter is lost
        while (text.indexOf("{") >= 0)
            text = text.replace("{", "\n");
        // forces can be split by } because everything between {} is one force
        let forceTxt = text.split("}");
        let trap_objs = [];
        forceTxt.forEach((force) => {
            let lines = force.split('\n');
            //empty lines and empty traps need not be processed as well as comments
            lines = lines.filter((line) => line !== "" && !line.startsWith("#"));
            if (lines.length == 0)
                return;
            let trap_obj = {};
            lines.forEach((line) => {
                // remove comments
                let com_pos = line.indexOf("#");
                if (com_pos >= 0)
                    line = line.slice(0, com_pos).trim();
                // another chance an empty line can be encountered. Remove whitespace
                if (line.trim().length == 0)
                    return;
                // split into option name and value
                let options = line.split("=");
                let lft = options[0].trim();
                let rght = options[1].trim();
                // Check if the string represents a list of floats (numbers separated by commas)
                if (rght.includes(',')) {
                    // Split the string by commas and convert each part to a float
                    let floatList = rght.split(',').map(Number);
                    trap_obj[lft] = floatList;
                }
                else if (/^-?\d+(\.\d+)?$/.test(rght)) {
                    // Check if the entire string is a valid number
                    trap_obj[lft] = parseFloat(rght);
                }
                else {
                    // Otherwise, treat it as a string
                    trap_obj[lft] = rght;
                }
            });
            if (Object.keys(trap_obj).length > 0)
                trap_objs.push(trap_obj);
        });
        const forceObjs = [];
        //handle the different traps
        trap_objs.forEach(f => {
            switch (f.type) {
                case "mutual_trap":
                    let mutTrap = new MutualTrap();
                    mutTrap.setFromParsedJson(f);
                    mutTrap.update();
                    forceObjs.push(mutTrap);
                    break;
                case "skew_trap":
                    let skewTrap = new SkewTrap();
                    skewTrap.setFromParsedJson(f);
                    skewTrap.update();
                    forceObjs.push(skewTrap);
                    break;
                case "repulsion_plane":
                    let repPlane = new RepulsionPlane();
                    repPlane.setFromParsedJson(f);
                    repPlane.update();
                    forceObjs.push(repPlane);
                    break;
                case "attraction_plane":
                    let attrPlane = new AttractionPlane();
                    attrPlane.setFromParsedJson(f);
                    attrPlane.update();
                    forceObjs.push(attrPlane);
                    break;
                default:
                    notify(`External force -${f["type"]}- type not supported yet, feel free to implement in aux_readers.ts and force.ts`);
                    break;
            }
        });
        forceHandler.set(forceObjs);
        render();
    });
}
// Json files can be a lot of things, read them.
function parseJson(json, system) {
    const data = JSON.parse(json);
    for (var key in data) {
        if (data[key].length == system.systemLength()) { //if json and dat files match/same length
            if (typeof (data[key][0]) == "number") { //we assume that scalars denote a new color map
                system.setColorFile(data);
                makeLut(data, key, system);
                //update every system's color map
                systems.forEach(s => {
                    s.doVisuals(() => {
                        const end = s.systemLength();
                        for (let j = 0; j < end; j++) //insert lut colors into lutCols[] 
                            s.lutCols[j] = lut.getColor(Number(s.colormapFile[key][j]));
                    });
                });
                view.coloringMode.set("Overlay");
                //const end = system.systemLength();
                //for (let j = 0; j < end; j++) { //insert lut colors into lutCols[] to toggle Lut coloring later
                //    system.lutCols[j] = lut.getColor(Number(system.colormapFile[key][elements.get(system.globalStartId + j).sid]));
                //} 
            }
            if (data[key][0].length == 3) { //we assume that 3D vectors denote motion
                const end = system.systemLength() + system.globalStartId;
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
        notify("Warning: Selection files select on global ID, not system ID.  There are multiple systems loaded.", 'warning');
    }
    const ids = reader.result.split(' ').map(function (i) {
        return parseInt(i, 10);
    });
    api.selectElementIDs(ids, true);
}
//reads in an anm parameter file and associates it with the last loaded system.
function parsePar(lines, system) {
    lines = lines.split(/[\n]+/g);
    //remove the header
    lines = lines.slice(1);
    const size = lines.length;
    //create an ANM object to allow visualization
    const net = new Network(networks.length, system.getAAMonomers());
    //process connections
    for (let i = 0; i < size; i++) {
        let l = lines[i].split(/\s+/);
        //extract values
        const p = parseInt(l[0]), q = parseInt(l[1]), eqDist = parseFloat(l[2]), type = l[3], strength = parseFloat(l[4]);
        if (!Number.isInteger(p) || !Number.isInteger(q) || !Number.isFinite(eqDist) || !Number.isFinite(strength)) {
            notify("Cannot read par file, see console for bad line", 'error');
            console.log("Error on par line", i);
            console.log(l);
            return;
        }
        // if its a torsional ANM then there are additional parameters on some lines
        let extraParams = [];
        if (l.length > 5) {
            for (let i = 5; i < l.length; i++) {
                extraParams.push(l[i]);
            }
        }
        if (Number.isInteger(p) && Number.isInteger(q)) {
            net.reducedEdges.addEdge(p, q, eqDist, type, strength, extraParams);
        }
    }
    ;
    // Create and Fill Vectors
    net.initInstances(net.reducedEdges.total);
    net.initEdges();
    net.fillConnections(); // fills connection array for
    net.networktype = "par";
    net.prepVis(); // Creates Mesh for visualization
    networks.push(net); // Any network added here shows up in UI network selector
    selectednetwork = net.nid; // auto select network just loaded
    view.addNetwork(net.nid);
    notify("Par file read! Turn on visualization in the Protein tab");
}
// reads hydrogen bonding file generated with Chimera
// hbondinfo is then stored in the pdbfiledatasets
function readHBondFile(file) {
    let reader = new FileReader();
    let pdbInfoIndx = pdbFileInfo.length - 1;
    if (pdbInfoIndx == -1) {
        notify("Please Load PDB file to associate H-Bond file with");
        return;
    }
    reader.onload = () => {
        let lines = reader.result.split(/[\n]+/g);
        const size = lines.length;
        let hbonds = [];
        //process hbonds
        for (let i = 0; i < size - 1; i++) {
            // trims all split items then removes the empty strings
            let l = lines[i].split(/\s+/).map(function (item) { return item.trim(); }).filter(n => n);
            if (recongizedProteinResidues.indexOf(l[0]) != -1) { //check that its a protein residue
                //extract values
                const pos1 = l[1].split("."), atm1 = l[2], id2 = l[3], pos2 = l[4].split("."), atm2 = l[5], dist = parseFloat(l[8]);
                if (recongizedProteinResidues.indexOf(id2) != -1) { //bonded to another protein residue
                    // Chain Identifier, residue number
                    let pdbinds1 = [pos1[1], parseInt(pos1[0])];
                    let pdbinds2 = [pos2[1], parseInt(pos2[0])];
                    let hbond = [pdbinds1, pdbinds2];
                    hbonds.push(hbond);
                }
                // can read hbonds using just model identifiers (no chain identifiers)
            }
            else if (recongizedProteinResidues.indexOf(l[1]) != -1 && recongizedProteinResidues.indexOf(l[5]) != -1) { // residue is second listed indicates hbonds listed from models
                //extract values
                const pos1 = l[0].split(".")[1], atm1 = l[3], id1 = l[2], id2 = l[6], pos2 = l[4].split(".")[1], atm2 = l[7], dist = parseFloat(l[10]);
                let pdbinds1 = [pos1, parseInt(id1)];
                let pdbinds2 = [pos2, parseInt(id2)];
                let hbond = [pdbinds1, pdbinds2];
                hbonds.push(hbond);
            }
        }
        if (hbonds.length == 0)
            notify("H bond file format is unrecongized");
        pdbFileInfo[pdbInfoIndx].hydrogenBonds = hbonds;
    };
    reader.readAsText(file);
}
// associates massfile with last loaded system (only needed for Generic Sphere Systems)
function readMassFile(reader) {
    let lines = reader.result.split(/[\n]+/g);
    let key = {
        indx: [],
        mass: [],
        radius: []
    };
    if (parseInt(lines[0]) > 27) { // subtypes 0-27 taken by dna/protein subtypes
        //remove the header
        lines = lines.slice(1);
        const size = lines.length;
        for (let i = 0; i < size; i++) {
            let l = lines[i].split(/\s+/);
            //extract values
            const p = parseInt(l[0]), mass = parseInt(l[1]), radius = parseFloat(l[2]);
            if (p > 26) {
                key.indx.push(p - 27);
                key.mass.push(mass);
                key.radius.push(radius);
            }
        }
        // change all generic sphere radius and mass according to mass file
        let sub, indx, gs;
        systems.forEach(sys => {
            sys.strands.forEach(strand => {
                if (strand.isGS()) {
                    let mon = strand.getMonomers();
                    mon.forEach(be => {
                        sub = parseInt(be.type.substring(2));
                        indx = key.indx.indexOf(sub);
                        if (indx == -1) {
                            console.log("Subtype " + sub.toString() + " not found in the provided mass file");
                        }
                        else {
                            gs = be;
                            gs.updateSize(key.mass[indx], key.radius[indx]);
                        }
                    });
                }
            });
        });
    }
    else {
        console.log("No GS Masses in file, (no subtype over 27), double check header");
    }
}
function parseDotBracket(input) {
    // Converts a dot-bracket string to a list of paired nucleotides.
    const output = new Array(input.length).fill(-1);
    const parenQueue = [];
    const squareQueue = [];
    const curlyQueue = [];
    for (let i = 0; i < input.trim().length; i++) {
        const c = input[i];
        switch (c) {
            case '.':
                continue;
            case '(':
                parenQueue.push(i);
                break;
            case '[':
                squareQueue.push(i);
                break;
            case '{':
                curlyQueue.push(i);
                break;
            case ')':
                if (parenQueue.length === 0) {
                    throw new Error("Mismatched parentheses in dot-bracket notation.");
                }
                const parenPair = parenQueue.pop();
                output[i] = parenPair;
                output[parenPair] = i;
                break;
            case ']':
                if (squareQueue.length === 0) {
                    throw new Error("Mismatched square brackets in dot-bracket notation.");
                }
                const squarePair = squareQueue.pop();
                output[i] = squarePair;
                output[squarePair] = i;
                break;
            case '}':
                if (curlyQueue.length === 0) {
                    throw new Error("Mismatched curly brackets in dot-bracket notation.");
                }
                const curlyPair = curlyQueue.pop();
                output[i] = curlyPair;
                output[curlyPair] = i;
                break;
            default:
                throw new Error(`Encountered invalid character '${c}' in dot bracket`);
        }
    }
    return output;
}
function readDotBracket(file) {
    const updateForceHandler = (forces) => {
        forceHandler.set(forces);
        render();
    };
    file.text().then(txt => {
        // let's define the input db format as follows:
        // - each line can be a db string or a sequence
        // - they have to alternate and be separated by a newline
        // - if a line is a sequence, the next line has to be a db string
        // - if a line is a db string, the next line has to be a sequence 
        // - the function will search in all the systems for a strand with the same length and sequence as the sequence line
        // - if it finds one, it will create a trap between the bases according to the db string
        // - if the file contains only 1 line it has to be a db string and the trap will be created for the last system for all strands with the same length as the db string
        // - unless there are selected bases, in which case the trap will be created only for the selected bases
        // preprocess the file
        // strip spaces and newlines
        const forces = [];
        let lines = txt.split("\n").map(s => s.replace(/\s/g, '')).filter(s => s.length > 0);
        // now let's parse the file
        let file_length = lines.length;
        let db_strings = [];
        let sequences = [];
        for (let i = 0; i < file_length; i++) {
            if (i % 2 == 0) {
                db_strings.push(lines[i]);
            }
            else {
                sequences.push(lines[i]);
            }
        }
        // if we have only one line, it has to be a db string
        if (db_strings.length == 1 && sequences.length == 0) {
            let db_string = db_strings[0];
            let pairs = parseDotBracket(db_string);
            // we always work with either the last system or the selectedBases
            let to_process;
            // so do we have selected bases ? 
            if (selectedBases.size > 0) {
                // we do and do only on selectedBases
                to_process = [[...selectedBases].sort((a, b) => a.id - b.id)];
                if (to_process[0].length != db_string.length)
                    to_process = []; //make sure we have enough bases selected 
            }
            else {
                // we work with the last system
                to_process = systems[systems.length - 1].strands.filter(strand => strand.getLength() == db_string.length).map(s => s.getMonomers());
            }
            to_process.forEach(elements => {
                pairs.forEach((pair, i) => {
                    if (pair != -1) {
                        // if pair
                        let trap = new MutualTrap();
                        trap.set(elements[i], elements[pair], .09, 1.2, 1);
                        forces.push(trap);
                    }
                });
            });
            updateForceHandler(forces);
            return;
        }
        // check if the file is valid
        if (db_strings.length != sequences.length) {
            notify("Invalid dot bracket file format");
            return;
        }
        // if we have multiple lines, we have to search the strands for the subsequences
        // and we'll use the first match we find
        for (let i = 0; i < sequences.length; i++) {
            let to_process = [];
            let db_string = db_strings[i];
            let seq = sequences[i];
            let pairs = parseDotBracket(db_string);
            let strands = systems[systems.length - 1].strands.forEach(strand => {
                // check if strand is NucleicAcidStrand
                if (!(strand instanceof NucleicAcidStrand)) {
                    return;
                }
                let matches = strand.search(seq);
                if (matches.length > 0) {
                    to_process.push(matches[0]);
                }
            });
            to_process.forEach(elements => {
                pairs.forEach((pair, i) => {
                    if (pair != -1) {
                        // if pair
                        let trap = new MutualTrap();
                        trap.set(elements[i], elements[pair], .09, 1.2, 1);
                        forces.push(trap);
                    }
                });
            });
            updateForceHandler(forces);
        }
    });
}
