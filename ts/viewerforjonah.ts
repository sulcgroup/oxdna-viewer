/// <reference path="./three/index.d.ts" />

//This is a horrible hack of the file_reading script for a different model
//It breaks a lot of things, not recommended to use.

// chunk .dat file so its not trying to read the entire thing at once
function dat_chunker(dat_file: Blob, current_chunk: number, chunk_size: number) {
    let sliced = dat_file.slice(current_chunk * chunk_size, current_chunk * chunk_size + chunk_size);
    return sliced;
}

function extract_next_conf() {
    if (!next_chunk) {
        return(undefined)
    }
    let need_next_chunk: boolean = false;
    let current_chunk_lines: string[] = current_chunk.split(/[\r\n]+/g);
    let next_chunk_lines: string[] = next_chunk.split(/[\r\n]+/g);
    let current_chunk_length: number = current_chunk_lines.length;
    let next_conf: string[] = [];
    let start = new marker;
    if (conf_end.line_id != current_chunk_length) { //handle very rare edge case where conf ended exactly at end of chunk
        start.chunk = conf_end.chunk;
        start.line_id = conf_end.line_id + 1; //that +1 is necessary for the first one and bad for all the rest.  Why?
    }
    else {
        start.chunk = next_chunk;
        start.line_id = 0;
        need_next_chunk = true;
    }

    let end = new marker;
    if (start.line_id + conf_len <= current_chunk_length) {
        end.chunk = start.chunk;
        end.line_id = start.line_id + conf_len - 1;
        for (let i = start.line_id; i < end.line_id + 1; i++) {
            if (current_chunk_lines[i] == "" || current_chunk_lines == undefined) { return undefined }
            next_conf.push(current_chunk_lines[i]);
        }
    }
    else {
        end.chunk = next_chunk;
        end.line_id = conf_len - (current_chunk_length - start.line_id) - 1;
        need_next_chunk = true
        for (let i = start.line_id; i < current_chunk_length; i++) {
            if (current_chunk_lines[i] == "" || current_chunk_lines == undefined) { return undefined }
            next_conf.push(current_chunk_lines[i]);
        }
        for (let i = 0; i < end.line_id + 1; i++) {
            next_conf.push(next_chunk_lines[i]);
        }
    }
    conf_begin = start;
    conf_end = end;
    if (need_next_chunk) {
        get_next_chunk(dat_file, current_chunk_number + 2) //current is the old middle, so need two ahead
    }
    return (next_conf);
}

//can probably just use this to get previous chunk with some if statements and chunk number
function get_next_chunk(dat_file, chunk_number) {
    previous_chunk = current_chunk;
    conf_begin.chunk = previous_chunk;
    current_chunk = next_chunk;

    if (conf_end.chunk == current_chunk) {
        conf_end.chunk = previous_chunk;
    }
    else if (conf_end.chunk == next_chunk) {
        conf_end.chunk = current_chunk;
    }

    let next_chunk_blob = dat_chunker(dat_file, chunk_number, approx_dat_len);
    next_reader.readAsText(next_chunk_blob);
    current_chunk_number += 1
}

class marker {
    chunk: String;
    line_id: number;
}

// define the drag and drop behavior of the scene 
var target = renderer.domElement;
target.addEventListener("dragover", function (event) {
    event.preventDefault();
}, false);

// the actual code to drop in the config files
var approx_dat_len: number,
    current_chunk_number: number, //this is the chunk in the middle of the three in memory
    previous_chunk: String,
    current_chunk: String,
    next_chunk: String,
    dat_reader = new FileReader(),
    next_reader = new FileReader(),
    last_reader = new FileReader(),
    conf_begin = new marker,
    conf_end = new marker,
    conf_len: number,
    conf_num: number = 0,
    dat_fileout: string = "",
    dat_file; //currently var so only 1 dat_file stored for all systems w/ last uploaded system's dat


target.addEventListener("drop", function (event) {

    // cancel default actions
    event.preventDefault();

    //make system to store the dropped files in
    var system = new System(sys_count, nucleotides.length);

    var files = event.dataTransfer.files,
        files_len = files.length;

    var base_to_material = {};
    var base_to_num = {
        "A": 0,
        "G": 1,
        "C": 2,
        "T": 3,
        "U": 3
    };
    let top_file, json_file;

    // assign files to the extentions; all possible combinations of entered files
    for (let i = 0; i < files_len; i++) {
        // get file extension
        let file_name = files[i].name;
        let ext = file_name.split('.').pop();

        if (ext === "dat") dat_file = files[i];
        if (ext === "conf") dat_file = files[i];
        if (ext === "top")  top_file = files[i];
        if (ext === "json")  json_file = files[i];
    }
    let json_alone = false
    if (json_file && !top_file) json_alone = true;
    if (files_len > 3) alert("Please drag and drop 1 .dat and 1 .top file. .json is optional."); //error message

    if (top_file) {
        //read topology file
        let top_reader = new FileReader();
        top_reader.onload = () => {
            // make first strand
            var current_strand = new Strand(1, system);
            let nuc_local_id: number = 0;
            let last_strand: number = 1; //strands are 1-indexed in oxDNA .top files
            let neighbor3;

            // parse file into lines
            var file = top_reader.result as string
            var lines = file.split(/[\r\n]+/g);
            lines = lines.slice(1); // discard the header

            //create empty list of nucleotides with length equal to the topology
            for (let j = 0; j < lines.length; j++) {
                let nuc = new Nucleotide(nucleotides.length, system.system_id);
                nucleotides.push(nuc);
            }
            lines.forEach(
                (line, i) => {
                    if (line == "") {
                        nucleotides.pop();
                        system.add_strand(current_strand);
                        system.strand_to_material[current_strand.strand_id] = backbone_materials[Math.floor(current_strand.strand_id % backbone_materials.length)];
                        return
                    }
                    let l = line.split(" "); //split the file and read each column, format is: "str_id base n3 n5"
                    let nuc = nucleotides[nuc_count + i];
                    nuc.local_id = nuc_local_id;
                    let str_id = parseInt(l[0]);
                    nuc.my_strand = str_id;
                    neighbor3 = parseInt(l[2]);
                    if (neighbor3 != -1) {
                        nuc.neighbor3 = nucleotides[nuc_count + neighbor3];
                    }
                    else {
                        nuc.neighbor3 = null;
                    }
                    let neighbor5 = parseInt(l[3]);
                    if (neighbor5 != -1) {
                        nuc.neighbor5 = nucleotides[nuc_count + neighbor5];
                    }
                    else {
                        nuc.neighbor5 = null;
                    }
                    if (str_id != last_strand) { //if new strand id, make new strand
                        system.add_strand(current_strand);
                        system.strand_to_material[last_strand] = backbone_materials[Math.floor(last_strand % backbone_materials.length)];
                        current_strand = new Strand(str_id, system);
                        nuc_local_id = 0;
                    };

                    let base = l[1]; // get base id
                    nuc.type = base;
                    //if we meet a U, we have an RNA (its dumb, but its all we got)
                    if (base === "U") {
                        RNA_MODE = true;
                    }

                    //let nuc = new Nucleotide(nuc_count, nuc_local_id, neighbor3_nuc, base, str_id, system.system_id); //create nucleotide
                    current_strand.add_nucleotide(nuc); //add nuc into Strand object
                    //nucleotides.push(nuc); //add nuc to global nucleotides array
                    nuc_local_id += 1;
                    last_strand = str_id;

                    // create a lookup for
                    // coloring base according to base id
                    base_to_material[nuc.global_id] = nucleoside_materials[base_to_num[base]];

                    if (i == lines.length - 1) {
                        system.strand_to_material[current_strand.strand_id] = backbone_materials[Math.floor(current_strand.strand_id % backbone_materials.length)];
                        system.add_strand(current_strand);
                        return
                    };

                });
            //for (let i = system.global_start_id; i < nucleotides.length; i++) { //set selected_bases[] to 0 for nucleotides[]-system start
            //    selected_bases.push(0);
            //}
            //system.setBaseMaterial(base_to_material); //store this system's base 
            system.setDatFile(dat_file); //store dat_file in current System object
            systems.push(system); //add system to Systems[]
            nuc_count = nucleotides.length;
            conf_len = nuc_count + 3;

        };
        top_reader.readAsText(top_file);
        //test_dat_read(dat_file);
    }

    //Lut coloring - colors nucleotides based on flexibility during oxDNA simulation run
    //doesn't work for more than one system
    /*if (files_len == 1) { //if .json dropped after .dat and .top
        if (files[0].name.slice(-4) == "json") { //if actually a .json file
            json_file = files[0];
            let json_reader = new FileReader();
            json_reader.onload = () => {
                let file = json_reader.result as string;
                let devs: string[] = file.split(", ");
                devs[0] = devs[0].slice(1, -1)
                devs[devs.length-1] = devs[devs.length-1].slice(0, -1)
                if (devs.length == nucleotides.length) {
                    let min = Math.min.apply(null, devs), //set min and max
                        max = Math.max.apply(null, devs);
                    lut = new THREE.Lut("rainbow", 4000); //create Lut obj
                    lut.setMax(max)
                    lut.setMin(min);
                    let legend = lut.setLegendOn({ 'layout': 'horizontal', 'position': { 'x': 0, 'y': 10, 'z': 0 } }); //create and add legend
                    scene.add(legend);
                    let labels = lut.setLegendLabels({ 'title': 'Number', 'um': 'id', 'ticks': 5, 'position': { 'x': 0, 'y': 10, 'z': 0 } }); //create legend formatting
                    scene.add(labels['title']); //add title

                    for (let i = 0; i < Object.keys(labels['ticks']).length; i++) { //add tick marks
                        scene.add(labels['ticks'][i]);
                        scene.add(labels['lines'][i]);
                    }
                    for (let i = 0; i < nucleotides.length; i++) { //insert lut colors into lutCols[] to toggle Lut coloring later
                        lutCols.push(lut.getColor(devs[i]));
                    }
                    document.getElementById("lutToggle").checked = true //typescript doesn't like this for some reason, but it works
                    toggleLut(false);
                    render();
                }
                else {
                    alert(".json and .top files are not compatible."); //error message if dat_file does not match/same length as .json file
                }
            };
            json_reader.readAsText(json_file);
        }
    }*/

    // asynchronously read the first two chunks of a configuration file
    if (dat_file) {
        renderer.domElement.style.cursor = "wait";
        //read information in dat file into system
        dat_reader.onload = () => {
            current_chunk = dat_reader.result as string;
            current_chunk_number = 0;
            readDat(system.system_length(), dat_reader, system, lutColsVis);
        };
        next_reader.onload = () => {
            //chunking bytewise often leaves incomplete lines, so take the start of next_chunk and append it to current_chunk
            next_chunk = next_reader.result as string;
            if (current_chunk.slice(-1) != '\n') {
                let c;
                for (c = next_chunk.slice(0, 1); c != '\n'; c = next_chunk.slice(0, 1)) {
                    current_chunk += c;
                    next_chunk = next_chunk.substring(1);
                }
                next_chunk = next_chunk.substring(1);
            }
        };

        // read the first chunk
        if (dat_file && top_file) {
            approx_dat_len = top_file.size * 30; //the relation between .top and a single .dat size is very variable, the largest I've found is 27x, although most are around 15x
            let first_chunk_blob = dat_chunker(dat_file, 0, approx_dat_len);
            dat_reader.readAsText(first_chunk_blob);

            //if its a trajectory, read in the second chunk
            if (dat_file.size > approx_dat_len) {
                let next_chunk_blob = dat_chunker(dat_file, 1, approx_dat_len);
                next_reader.readAsText(next_chunk_blob);
            }
        }

    }

    if (json_file) { 
        //lutColsVis = true;
        let check_box = <HTMLInputElement>document.getElementById("lutToggle");
        let json_reader = new FileReader(); //read .json
        json_reader.onload = () => {
            let file = json_reader.result as string;
            let devs: string[] = file.split(", ");
            devs[0] = devs[0].slice(1, -1)
            devs[devs.length - 1] = devs[devs.length - 1].replace(/^\s+|\s+$/g, "")
            devs[devs.length - 1] = devs[devs.length - 1].slice(0, -1)
            let curr_sys;
            if (json_alone) curr_sys = sys_count-1;
            else curr_sys = sys_count;
            if (devs.length == systems[curr_sys].system_length()) { //if json and dat files match/same length
                let min = Math.min.apply(null, devs), //find min and max
                    max = Math.max.apply(null, devs);
                lut = new THREE.Lut("rainbow", 4000);
                lut.setMax(max)
                lut.setMin(min);
                let legend = lut.setLegendOn({ 'layout': 'horizontal', 'position': { 'x': 0, 'y': 10, 'z': 0 } }); //create legend
                scene.add(legend);
                let labels = lut.setLegendLabels({ 'title': 'Number', 'um': 'id', 'ticks': 5, 'position': { 'x': 0, 'y': 10, 'z': 0 } }); //set up legend format
                scene.add(labels['title']); //add title

                for (let i = 0; i < Object.keys(labels['ticks']).length; i++) { //add tick marks
                    scene.add(labels['ticks'][i]);
                    scene.add(labels['lines'][i]);
                }
                for (let i = 0; i < nucleotides.length; i++) { //insert lut colors into lutCols[] to toggle Lut coloring later
                    lutCols.push(lut.getColor(devs[i]));
                }
                if (!json_alone) lutColsVis = true;
                check_box.checked = true;
                if (json_alone) toggleLut(check_box);
            }
            else { //if json and dat files do not match, display error message and set files_len to 2 (not necessary)
                alert(".json and .top files are not compatible.");
            }
        };
        json_reader.readAsText(json_file);
    }

    render();
}, false);

let x_bb_last,
    y_bb_last,
    z_bb_last;
function readDat(num_nuc, dat_reader, system, lutColsVis) {
    var nuc_local_id = 0;
    var current_strand = systems[sys_count].strands[0];
    // parse file into lines 
    let lines = dat_reader.result.split(/[\r\n]+/g);
    //get the simulation box size 
    let box = parseFloat(lines[1].split(" ")[3]);
    let time = parseInt(lines[0].split(" ")[2]);
    conf_num += 1
    console.log(conf_num, "t =", time);
    // discard the header
    lines = lines.slice(3);

    conf_begin.chunk = current_chunk;
    conf_begin.line_id = 0;

    if (lines.length < num_nuc) {
        alert("single conf more than 30x size of .top file, please modify approx_dat_len in file_reading.ts")
    }
    conf_end.chunk = current_chunk;
    conf_end.line_id = num_nuc + 2; //end of current configuration
    // add the bases to the scene
    for (let i = 0; i < num_nuc; i++) {//from beginning to end of current configuration's list of positions; for each nucleotide in the system
        if (lines[i] == "" || lines[i].slice(0, 1) == 't') {
            break
        };
        var current_nucleotide = current_strand.nucleotides[nuc_local_id];
        //get nucleotide information
        // consume a new line 
        let l: string = lines[i].split(" ");
        // shift coordinates such that the 1st base of the  
        // 1st strand is @ origin 
        let x_bb = parseFloat(l[0]),// - fx,
            y_bb = parseFloat(l[1]),// - fy,
            z_bb = parseFloat(l[2]);// - fz;

        current_nucleotide.pos = new THREE.Vector3(x_bb, y_bb, z_bb); //set pos; not updated by DragControls

        // adds a new "backbone", new "nucleoside", and new "connector" to the scene by adding to visual_object then to strand_3objects then to system_3objects then to scene
        let group = new THREE.Group; //create visual_object group
        group.name = current_nucleotide.global_id + ""; //set name (string) to nucleotide's global id
        let backbone;
        // 4 Mesh to display DNA + 1 Mesh to store visual_object group's center of mass as its position
        //make material depending on whether there is an alternate color scheme available
        var material;
        if (lutColsVis) {
            material = new THREE.MeshLambertMaterial({
                color: lutCols[i],
                side: THREE.DoubleSide
            })
        }
        else {
            material = system.strand_to_material[current_strand.strand_id]
        }
        backbone = new THREE.Mesh(backbone_geometry, material); //sphere - sugar phosphate backbone 
        backbone.position.set(x_bb, y_bb, z_bb);
        group.add(backbone);

        //last, add the sugar-phosphate bond since its not done for the first nucleotide in each strand
        if (current_nucleotide.neighbor3 != null && current_nucleotide.neighbor3.local_id < current_nucleotide.local_id) {
            let x_sp = (x_bb + x_bb_last) / 2, //sugar phospate position in center of both current and last sugar phosphates
                y_sp = (y_bb + y_bb_last) / 2,
                z_sp = (z_bb + z_bb_last) / 2;

            let sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
            // easy periodic boundary condition fix  
            // if the bonds are to long just don't add them 
            if (sp_len <= 500) {
                let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(
                    new THREE.Quaternion().setFromUnitVectors(
                        new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize()
                    )
                );
                let sp = new THREE.Mesh(connector_geometry, material); //cylinder - sugar phosphate connector
                sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //set length according to distance between current and last sugar phosphate
                sp.applyMatrix(rotation_sp); //set rotation
                sp.position.set(x_sp, y_sp, z_sp);
                sp.name = "sp"+group.id
                group.add(sp); //add to visual_object
            }
        }
        if (current_nucleotide.neighbor5 != null && current_nucleotide.neighbor5.local_id < current_nucleotide.local_id) { //handles strand end connection
            let x_sp = (x_bb + current_nucleotide.neighbor5.visual_object.children[BACKBONE].position.x) / 2, //make sugar phosphate connection
                y_sp = (y_bb + current_nucleotide.neighbor5.visual_object.children[BACKBONE].position.y) / 2,
                z_sp = (z_bb + current_nucleotide.neighbor5.visual_object.children[BACKBONE].position.z) / 2;
            let sp_len = Math.sqrt(Math.pow(x_bb - current_nucleotide.neighbor5.visual_object.children[BACKBONE].position.x, 2) + Math.pow(y_bb - current_nucleotide.neighbor5.visual_object.children[BACKBONE].position.y, 2) + Math.pow(z_bb - current_nucleotide.neighbor5.visual_object.children[BACKBONE].position.z, 2));
            let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(
                new THREE.Quaternion().setFromUnitVectors(
                    new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize()
                )
            );
            let sp = new THREE.Mesh(connector_geometry, system.strand_to_material[i]); //cylinder - sugar phosphate connector
            sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //set length according to distance between current and last sugar phosphate
            sp.applyMatrix(rotation_sp); //set rotation
            sp.position.set(x_sp, y_sp, z_sp);
            group.add(sp); //add to visual_object
        }

        //actually add the new items to the scene by adding to visual_object then to strand_3objects then to system_3objects then to scene
        current_nucleotide.visual_object = group; //set Nucleotide nuc's visual_object attribute to group
        current_strand.strand_3objects.add(group); //add group to strand_3objects
        //update last backbone position and last strand
        x_bb_last = x_bb;
        y_bb_last = y_bb;
        z_bb_last = z_bb;

        //catch the two possible cases for strand ends (no connection or circular)
        if (current_nucleotide.neighbor5 == undefined) { //if last nucleotide in straight strand
            system.system_3objects.add(current_strand.strand_3objects); //add strand THREE.Group to system THREE.Group
            current_strand = system.strands[current_strand.strand_id]; //don't ask, its another artifact of strands being 1-indexed
            nuc_local_id = -1;
        }
        else if (current_nucleotide.neighbor5.local_id < current_nucleotide.local_id) { //if last nucleotide in circular strand
            system.system_3objects.add(current_strand.strand_3objects); //add strand THREE.Group to system THREE.Group
            current_strand = system.strands[current_strand.strand_id]; //don't ask, its another artifact of strands being 1-indexed
            nuc_local_id = -1;
        }

        nuc_local_id += 1
    }
    let dx, dy, dz;

    //bring strand in box
    for (let i = 0; i < systems[sys_count].strands.length; i++) { //for each strand in current system
        // compute offset to bring strand in box
        let n = systems[sys_count].strands[i].nucleotides.length; //strand's nucleotides[] length
        let cms = new THREE.Vector3(0, 0, 0); //center of mass
        for (let j = 0; j < n; j++) { //for every nuc in strand
            cms.add(systems[sys_count].strands[i].nucleotides[j].visual_object.children[BACKBONE].position); //sum center of masses - children[3] = posObj Mesh at cms
        }
        //cms calculations
        let mul = 1.0 / n;
        cms.multiplyScalar(mul);
        dx = Math.round(cms.x / box) * box;
        dy = Math.round(cms.y / box) * box;
        dz = Math.round(cms.z / box) * box;

        //fix coordinates
        for (let j = 0; j < systems[sys_count].strands[i].nucleotides.length; j++) { //for every nucleotide in strand
            for (let k = 0; k < systems[sys_count].strands[i].nucleotides[j].visual_object.children.length; k++) { //for every Mesh in nucleotide's visual_object
                let pos = systems[sys_count].strands[i].nucleotides[j].visual_object.children[k].position; //get Mesh position
                //update pos by offset <dx, dy, dz>
                pos.x = pos.x - dx;
                pos.y = pos.y - dy;
                pos.z = pos.z - dz;
                systems[sys_count].strands[i].nucleotides[j].visual_object.children[k].position.set(pos.x, pos.y, pos.z);
            }
        }
    }

    scene.add(systems[sys_count].system_3objects); //add system_3objects with strand_3objects with visual_object with Meshes
    sys_count += 1;

    //radio button/checkbox selections
    //getActionMode();
    //getScopeMode();
    //getAxisMode();
    if (getActionModes().includes("Drag")) {
        drag();
    }
    /*  let geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
     let material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
     let cube = new THREE.Mesh(geometry, material);
     cube.position.set(0,0,0);
     scene.add(cube);
     backbones.push(cube);
     cube = new THREE.Mesh(geometry, material);
     cube.position.set(10,10,10);
     scene.add(cube);
     backbones.push(cube); */
    // set camera position based on structure
    // update the scene
    render();
    //updatePos(sys_count - 1); //sets positions of system, strands, and visual objects to be located at their cms - messes up rotation sp recalculation and trajectory
    for (let i = 0; i < nucleotides.length; i++) { //create array of backbone sphere Meshes for base_selector
        backbones.push(nucleotides[i].visual_object.children[BACKBONE]);
    }
    renderer.domElement.style.cursor = "auto";
}

var need_next_chunk: boolean = false;
var need_previous_chunk: boolean = false;
function getNewConfig(mode) { //attempts to display next configuration; same as readDat() except does not make new sphere Meshes, etc. - maximize efficiency
    if (systems.length > 1) {
        alert("Only one file at a time can be read as a trajectory, sorry...");
        return;
    }
    for (let i = 0; i < systems.length; i++) { //for each system - does not actually work for multiple systems
        let system = systems[i];
        let num_nuc: number = system.system_length(); //gets # of nuc in system
        let lines
        if (mode == 1) {
            lines = extract_next_conf()
            conf_num += 1
        }
        if (mode == -1) {
            lines = extract_previous_conf()
            conf_num -= 1
        }
        if (lines == undefined) {
            alert("No more confs to load!");
            return;
        }

        let nuc_local_id = 0;
        let current_strand = systems[i].strands[0];
        //get the simulation box size
        let box = parseFloat(lines[1].split(" ")[3]);
        let time = parseInt(lines[0].split(" ")[2]);
        conf_num += 1
        console.log(conf_num, 't =', time);
        // discard the header
        lines = lines.slice(3);

        for (let line_num = 0; line_num < num_nuc; line_num++) {
            if (lines[line_num] == "" || undefined) {
                alert("There's an empty line in the middle of your configuration!")
                break
            };
            let current_nucleotide = current_strand.nucleotides[nuc_local_id];
            //get nucleotide information
            // consume a new line 
            let l = lines[line_num].split(" ");
            let x_bb = parseFloat(l[0]),
                y_bb = parseFloat(l[1]),
                z_bb = parseFloat(l[2]);
            current_nucleotide.pos = new THREE.Vector3(x_bb, y_bb, z_bb);

            let group = current_nucleotide.visual_object;
            let locstrandID = current_strand.strand_id
            group.name = current_nucleotide.global_id + "";

            //set new positions/rotations for the meshes.  Don't need to create new meshes since they exist.
            //if you position.set() before applyMatrix() everything explodes and I don't know why
            group.children[BACKBONE].position.set(x_bb, y_bb, z_bb);


            //last, add the sugar-phosphate bond since its not done for the first nucleotide in each strand
            /*if (current_nucleotide.neighbor3 != null && current_nucleotide.neighbor3.local_id < current_nucleotide.local_id) {
                scene.remove(group.children[NUCLEOSIDE]);
                let x_sp = (x_bb + x_bb_last) / 2, //sugar phospate position in center of both current and last sugar phosphates
                    y_sp = (y_bb + y_bb_last) / 2,
                    z_sp = (z_bb + z_bb_last) / 2;
            
                let sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
                // easy periodic boundary condition fix  
                // if the bonds are to long just don't add them 
                if (sp_len <= 500) {
                    let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(
                        new THREE.Quaternion().setFromUnitVectors(
                            new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize()
                        )
                    );
                    let sp = new THREE.Mesh(connector_geometry, system.strand_to_material[i]); //cylinder - sugar phosphate connector
                    sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //set length according to distance between current and last sugar phosphate
                    sp.applyMatrix(rotation_sp); //set rotation
                    sp.position.set(x_sp, y_sp, z_sp);
                    group.add(sp); //add to visual_object
                }
            }
            if (current_nucleotide.neighbor5 != null && current_nucleotide.neighbor5.local_id < current_nucleotide.local_id) { //handles strand end connection
                scene.remove(group.children[NUCLEOSIDE]);
                let x_sp = (x_bb + current_nucleotide.neighbor5.visual_object.children[BACKBONE].position.x) / 2, //make sugar phosphate connection
                    y_sp = (y_bb + current_nucleotide.neighbor5.visual_object.children[BACKBONE].position.y) / 2,
                    z_sp = (z_bb + current_nucleotide.neighbor5.visual_object.children[BACKBONE].position.z) / 2;
                let sp_len = Math.sqrt(Math.pow(x_bb - current_nucleotide.neighbor5.visual_object.children[BACKBONE].position.x, 2) + Math.pow(y_bb - current_nucleotide.neighbor5.visual_object.children[BACKBONE].position.y, 2) + Math.pow(z_bb - current_nucleotide.neighbor5.visual_object.children[BACKBONE].position.z, 2));
                let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(
                    new THREE.Quaternion().setFromUnitVectors(
                        new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize()
                    )
                );
                let sp = new THREE.Mesh(connector_geometry, system.strand_to_material[i]); //cylinder - sugar phosphate connector
                sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //set length according to distance between current and last sugar phosphate
                sp.applyMatrix(rotation_sp); //set rotation
                sp.position.set(x_sp, y_sp, z_sp);
                group.add(sp); //add to visual_object
            }*/



            //last, add the sugar-phosphate bond since its not done for the first nucleotide in each strand
            if (current_nucleotide.neighbor3 != null && current_nucleotide.neighbor3.local_id < current_nucleotide.local_id) {
                let x_sp = (x_bb + x_bb_last) / 2, //sugar phospate position in center of both current and last sugar phosphates
                    y_sp = (y_bb + y_bb_last) / 2,
                    z_sp = (z_bb + z_bb_last) / 2;
    
                let sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
                // easy periodic boundary condition fix  
                // if the bonds are to long just don't add them 
                if (sp_len <= 500) {
                    let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(
                        new THREE.Quaternion().setFromUnitVectors(
                            new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize()
                        )
                    );
                    let sp = new THREE.Mesh(connector_geometry, group.children[BACKBONE].material); //cylinder - sugar phosphate connector
                    sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //set length according to distance between current and last sugar phosphate
                    sp.applyMatrix(rotation_sp); //set rotation
                    sp.position.set(x_sp, y_sp, z_sp);
                    group.children[NUCLEOSIDE] = sp; //add to visual_object
                }
            }
            x_bb_last = x_bb;
            y_bb_last = y_bb;
            z_bb_last = z_bb;

            if (current_nucleotide.neighbor5 == null) {
                system.system_3objects.add(current_strand.strand_3objects); //add strand_3objects to system_3objects
                current_strand = system.strands[current_strand.strand_id]; //don't ask, its another artifact of strands being 1-indexed
                nuc_local_id = 0; //reset
            }
            else {
                nuc_local_id += 1;
            };
        }
        if (getActionModes().includes("Drag")) {
            drag();
        }
    }
    render();
}