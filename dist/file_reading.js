/// <reference path="./three/index.d.ts" />
// chunk .dat file so its not trying to read the entire thing at once
function dat_cunker(dat_file, current_conf, conf_len) {
    return dat_file.slice(current_conf * conf_len, current_conf * conf_len + conf_len + 1); //this doesn't slice linewise, its bytewise
}
// define the drag and drop behavior of the scene 
var target = renderer.domElement;
target.addEventListener("dragover", function (event) {
    event.preventDefault();
}, false);
// the actual code to drop in the config files
var dat_fileout = "";
var datnum = 0;
var dat_file; //currently var so only 1 dat_file stored for all systems w/ last uploaded system's dat
var conf_len = [];
target.addEventListener("drop", function (event) {
    // cancel default actions
    event.preventDefault();
    //make system to store the dropped files in
    var system = new System(sys_count, nucleotides.length);
    var files = event.dataTransfer.files, files_len = files.length;
    var strand_to_material = {};
    var base_to_material = {};
    var base_to_num = {
        "A": 0,
        "G": 1,
        "C": 2,
        "T": 3,
        "U": 3
    };
    // get the extention of one of the 2 files 
    let ext = files[0].name.slice(-3);
    // space to store the file paths 
    let top_file;
    let json_file;
    // assign files to the extentions; all possible combinations of entered files
    if (files_len == 2) {
        if (ext == "dat") {
            dat_file = files[0];
            top_file = files[1];
        }
        else {
            dat_file = files[1];
            top_file = files[0];
        }
    }
    else if (files_len === 3) {
        let ext1 = files[1].name.slice(-3);
        if (ext === "dat") {
            if (ext1 == "top") {
                dat_file = files[0];
                top_file = files[1];
                json_file = files[2];
            }
            else if (ext1 === "son") {
                dat_file = files[0];
                top_file = files[2];
                json_file = files[1];
            }
        }
        else if (ext === "top") {
            if (ext1 == "dat") {
                dat_file = files[1];
                top_file = files[0];
                json_file = files[2];
            }
            else if (ext1 === "son") {
                dat_file = files[2];
                top_file = files[0];
                json_file = files[1];
            }
        }
        else {
            if (ext1 == "dat") {
                dat_file = files[1];
                top_file = files[2];
                json_file = files[0];
            }
            else if (ext1 === "top") {
                dat_file = files[2];
                top_file = files[1];
                json_file = files[0];
            }
        }
    }
    else if (files_len > 3)
        (alert("Please drag and drop 1 .dat and 1 .top file. .json is optional.")); //error message
    var conf_len;
    //read topology file
    let top_reader = new FileReader();
    top_reader.onload = () => {
        // make first strand
        var current_strand = new Strand(1, system);
        let nuc_local_id = 0;
        let last_strand = 1; //strands are 1-indexed in oxDNA .top files
        let neighbor3;
        // parse file into lines
        var file = top_reader.result;
        var lines = file.split(/[\r\n]+/g);
        lines = lines.slice(1); // discard the header
        conf_len = lines.length;
        //create empty list of nucleotides with length equal to the topology
        for (let j = 0; j < lines.length; j++) {
            let nuc = new Nucleotide(j, system.system_id);
            nucleotides.push(nuc);
        }
        lines.forEach((line, i) => {
            if (line == "") {
                nucleotides.pop();
                system.add_strand(current_strand);
                return;
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
                current_strand = new Strand(str_id, system);
                nuc_local_id = 0;
            }
            ;
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
            base_to_material[i] = nucleoside_materials[base_to_num[base]];
            // coloring bases according to strand id 
            strand_to_material[i] = backbone_materials[Math.floor(str_id % backbone_materials.length)]; //i = nucleotide id in system but not = global id b/c global id takes all systems into account
            if (i == lines.length - 1) {
                system.add_strand(current_strand);
                return;
            }
            ;
        });
        for (let i = system.global_start_id; i < nucleotides.length; i++) { //set selected_bases[] to 0 for nucleotides[]-system start
            selected_bases.push(0);
        }
        system.setBaseMaterial(base_to_material); //store this system's base 
        system.setStrandMaterial(strand_to_material); //and strand coloring in current System object
        system.setDatFile(dat_file); //store dat_file in current System object
        systems.push(system); //add system to Systems[]
        nuc_count = nucleotides.length;
    };
    top_reader.readAsText(top_file);
    //test_dat_read(dat_file);
    var show_flex = false;
    if (files_len == 3) { //if dropped 3 files = also included flexibility coloring .json
        show_flex = true;
        let json_reader = new FileReader(); //read .json
        json_reader.onload = () => {
            let file = json_reader.result;
            let lines = file.split(", ");
            devs = [];
            if (lines.length == system.system_length()) { //if json and dat files match/same length
                for (let i = 0; i < lines.length; i++) {
                    devs.push(parseFloat(lines[i])); //insert numbers from json file into devs[]
                }
                let min = Math.min.apply(null, devs), //find min and max
                max = Math.max.apply(null, devs);
                lut = new THREE.Lut("rainbow", 4000);
                lut.setMax(max);
                lut.setMin(min);
                let legend = lut.setLegendOn({ 'layout': 'horizontal', 'position': { 'x': 0, 'y': 10, 'z': 0 } }); //create legend
                scene.add(legend);
                let labels = lut.setLegendLabels({ 'title': 'Number', 'um': 'id', 'ticks': 5, 'position': { 'x': 0, 'y': 10, 'z': 0 } }); //set up legend format
                scene.add(labels['title']); //add title
                for (let i = 0; i < Object.keys(labels['ticks']).length; i++) { //add tick marks
                    scene.add(labels['ticks'][i]);
                    scene.add(labels['lines'][i]);
                }
            }
            else { //if json and dat files do not match, display error message and set files_len to 2 (not necessary)
                alert(".json and .top files are not compatible.");
                files_len = 2;
            }
        };
        json_reader.readAsText(json_file);
    }
    //Lut coloring - colors nucleotides based on flexibility during oxDNA simulation run
    //doesn't work for more than one system
    if (files_len == 1) { //if .json dropped after .dat and .top
        if (files[0].name.slice(-4) == "json") { //if actually a .json file
            json_file = files[0];
            let json_reader = new FileReader();
            json_reader.onload = () => {
                let file = json_reader.result;
                let lines = file.split(", "); //read numbers as strings
                devs = [];
                if (lines.length == nucleotides.length) {
                    for (let i = 0; i < lines.length; i++) {
                        devs.push(parseFloat(lines[i])); //insert lines[i] strings as numbers into devs[]
                    }
                    let min = Math.min.apply(null, devs), //set min and max
                    max = Math.max.apply(null, devs);
                    lut = new THREE.Lut("rainbow", 4000); //create Lut obj
                    lut.setMax(max);
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
                    render();
                }
                else {
                    alert(".json and .top files are not compatible."); //error message if dat_file does not match/same length as .json file
                }
            };
            json_reader.readAsText(json_file);
        }
    }
    if (files_len == 2 || files_len == 3) { //read the dat file here to avoid async issues where the dat reader got ahead of the top reader (which was making the systems)
        // read a configuration file
        let dat_reader = new FileReader();
        dat_reader.onload = () => {
            readDat(/*datnum,*/ system.system_length(), dat_reader, strand_to_material, base_to_material, system, show_flex);
        };
        // execute the read operation 
        //let first_conf = dat_cunker(dat_file, 0, conf_len);
        dat_reader.readAsText(dat_file);
    }
    render();
}, false);
var trajlines;
let x_bb_last, y_bb_last, z_bb_last;
function readDat(/*datnum, */ datlen, dat_reader, strand_to_material, base_to_material, system, show_flex) {
    var nuc_local_id = 0;
    var current_strand = systems[sys_count].strands[0];
    // parse file into lines 
    let lines = dat_reader.result.split(/[\r\n]+/g);
    //get the simulation box size 
    let box = parseFloat(lines[1].split(" ")[3]);
    // everything but the header
    lines = lines.slice(3);
    // calculate offset to have the first strand @ the scene origin 
    let first_line = lines[0].split(" ");
    // parse the coordinates
    let fx = parseFloat(first_line[0]), fy = parseFloat(first_line[1]), fz = parseFloat(first_line[2]);
    let arb = 0;
    let trajlen = (datnum + 1) * datlen; //end of current configuration's list of positions
    // add the bases to the scene
    for (let i = datnum * datlen; i < trajlen; i++) { //from beginning to end of current configuration's list of positions; for each nucleotide in the system
        if (lines[i] == "") {
            return;
        }
        ;
        var current_nucleotide = current_strand.nucleotides[nuc_local_id];
        //get nucleotide information
        // consume a new line 
        let l = lines[i].split(" ");
        // shift coordinates such that the 1st base of the  
        // 1st strand is @ origin 
        let x = parseFloat(l[0]), // - fx,
        y = parseFloat(l[1]), // - fy,
        z = parseFloat(l[2]); // - fz;
        current_nucleotide.pos = new THREE.Vector3(x, y, z); //set pos; not updated by DragControls
        // extract axis vector a1 (backbone vector) and a3 (stacking vector) 
        let x_a1 = parseFloat(l[3]), y_a1 = parseFloat(l[4]), z_a1 = parseFloat(l[5]), x_a3 = parseFloat(l[6]), y_a3 = parseFloat(l[7]), z_a3 = parseFloat(l[8]);
        // according to base.py a2 is the cross of a1 and a3
        let [x_a2, y_a2, z_a2] = cross(x_a1, y_a1, z_a1, x_a3, y_a3, z_a3);
        // compute backbone cm
        let x_bb = 0;
        let y_bb = 0;
        let z_bb = 0;
        if (!RNA_MODE) { //calculations for DNA
            x_bb = x - (0.34 * x_a1 + 0.3408 * x_a2),
                y_bb = y - (0.34 * y_a1 + 0.3408 * y_a2),
                z_bb = z - (0.34 * z_a1 + 0.3408 * z_a2);
        }
        else {
            // calculations for RNA
            x_bb = x - (0.4 * x_a1 + 0.2 * x_a3);
            y_bb = y - (0.4 * y_a1 + 0.2 * y_a3);
            z_bb = z - (0.4 * z_a1 + 0.2 * z_a3);
        }
        // compute nucleoside cm
        let x_ns = x + 0.4 * x_a1, y_ns = y + 0.4 * y_a1, z_ns = z + 0.4 * z_a1;
        //compute connector position
        let x_con = (x_bb + x_ns) / 2, y_con = (y_bb + y_ns) / 2, z_con = (z_bb + z_ns) / 2;
        //compute connector length
        let con_len = Math.sqrt(Math.pow(x_bb - x_ns, 2) + Math.pow(y_bb - y_ns, 2) + Math.pow(z_bb - z_ns, 2));
        let base_rotation = new THREE.Matrix4().makeRotationFromQuaternion(//create base sphere rotation
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_a3, y_a3, z_a3)));
        // correctly display stacking interactions
        let rotation_con = new THREE.Matrix4().makeRotationFromQuaternion(//creat nucleoside sphere rotation
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_con - x_ns, y_con - y_ns, z_con - z_ns).normalize()));
        // adds a new "backbone", new "nucleoside", and new "connector" to the scene by adding to visual_object then to strand_3objects then to system_3objects then to scene
        let group = new THREE.Group; //create visual_object group
        group.name = current_nucleotide.global_id + ""; //set name (string) to nucleotide's global id
        let backbone, nucleoside, con;
        // 4 Mesh to display DNA + 1 Mesh to store visual_object group's center of mass as its position
        backbone = new THREE.Mesh(backbone_geometry, strand_to_material[i]); //sphere - sugar phosphate backbone
        nucleoside = new THREE.Mesh(nucleoside_geometry, base_to_material[i]); //sphere - nucleotide
        con = new THREE.Mesh(connector_geometry, strand_to_material[i]); //cyclinder - backbone and nucleoside connector
        let posObj = new THREE.Mesh; //Mesh (no shape) storing visual_object group center of mass  
        con.applyMatrix(new THREE.Matrix4().makeScale(1.0, con_len, 1.0));
        //if .dat, .top, and .json files dropped simultaneously, handle coloring
        if (show_flex) {
            lutCols.push(lut.getColor(devs[arb])); //add colors to lutCols[]
        }
        // apply rotations
        nucleoside.applyMatrix(base_rotation);
        con.applyMatrix(rotation_con);
        //set positions and add to object (group - visual_object)
        backbone.position.set(x_bb, y_bb, z_bb);
        nucleoside.position.set(x_ns, y_ns, z_ns);
        con.position.set(x_con, y_con, z_con);
        posObj.position.set(x, y, z);
        group.add(backbone);
        group.add(nucleoside);
        group.add(con);
        group.add(posObj);
        //last, add the sugar-phosphate bond since its not done for the first nucleotide in each strand
        if (current_nucleotide.neighbor3 != null && current_nucleotide.neighbor3.local_id < current_nucleotide.local_id) {
            let x_sp = (x_bb + x_bb_last) / 2, //sugar phospate position in center of both current and last sugar phosphates
            y_sp = (y_bb + y_bb_last) / 2, z_sp = (z_bb + z_bb_last) / 2;
            let sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
            // easy periodic boundary condition fix  
            // if the bonds are to long just don't add them 
            if (sp_len <= 5) {
                let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize()));
                let sp = new THREE.Mesh(connector_geometry, strand_to_material[i]); //cylinder - sugar phosphate connector
                sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //set length according to distance between current and last sugar phosphate
                sp.applyMatrix(rotation_sp); //set rotation
                sp.position.set(x_sp, y_sp, z_sp);
                group.add(sp); //add to visual_object
            }
            arb++; //increment for each nucleotide b/c each nucleotide has 
        }
        if (current_nucleotide.neighbor5 != null && current_nucleotide.neighbor5.local_id < current_nucleotide.local_id) { //handles strand end connection
            let x_sp = (x_bb + current_nucleotide.neighbor5.visual_object.children[BACKBONE].position.x) / 2, //make sugar phosphate connection
            y_sp = (y_bb + current_nucleotide.neighbor5.visual_object.children[BACKBONE].position.y) / 2, z_sp = (z_bb + current_nucleotide.neighbor5.visual_object.children[BACKBONE].position.z) / 2;
            let sp_len = Math.sqrt(Math.pow(x_bb - current_nucleotide.neighbor5.visual_object.children[BACKBONE].position.x, 2) + Math.pow(y_bb - current_nucleotide.neighbor5.visual_object.children[BACKBONE].position.y, 2) + Math.pow(z_bb - current_nucleotide.neighbor5.visual_object.children[BACKBONE].position.z, 2));
            let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize()));
            let sp = new THREE.Mesh(connector_geometry, strand_to_material[i]); //cylinder - sugar phosphate connector
            sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //set length according to distance between current and last sugar phosphate
            sp.applyMatrix(rotation_sp); //set rotation
            sp.position.set(x_sp, y_sp, z_sp);
            group.add(sp); //add to visual_object
        }
        //actually add the new items to the scene by adding to visual_object then to strand_3objects then to system_3objects then to scene
        current_nucleotide.visual_object = group; //set Nucleotide nuc's visual_object attribute to group
        nucleotide_3objects.push(group); //add group to nucleotide_3objects[] with THREE.Group for each nucleotide
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
        nuc_local_id += 1;
    }
    datnum++; //configuration # - currently only works for 1 system
    let dx, dy, dz;
    //bring strand in box
    for (let i = 0; i < systems[sys_count].strands.length; i++) { //for each strand in current system
        // compute offset to bring strand in box
        let n = systems[sys_count].strands[i].nucleotides.length; //strand's nucleotides[] length
        let cms = new THREE.Vector3(0, 0, 0); //center of mass
        for (let j = 0; j < n; j++) { //for every nuc in strand
            cms.add(systems[sys_count].strands[i].nucleotides[j].visual_object.children[COM].position); //sum center of masses - children[3] = posObj Mesh at cms
        }
        //cms calculations
        let mul = 1.0 / n;
        cms.multiplyScalar(mul);
        dx = Math.round(cms.x / box) * box;
        dy = Math.round(cms.y / box) * box;
        dz = Math.round(cms.z / box) * box;
        //fix coordinates
        let temp = new THREE.Vector3();
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
    /* // reposition center of mass of the system to 0,0,0
    let cms = new THREE.Vector3(0, 0, 0);
    let n_nucleotides = system.system_length();
    let i = system.global_start_id;
    for (; i < system.global_start_id + n_nucleotides; i++) {
        cms.add(nucleotides[i].pos);
    }
    let mul = 1.0 / n_nucleotides;
    cms.multiplyScalar(mul);
    i = system.global_start_id;
    for (; i < system.global_start_id + n_nucleotides; i++) {
        nucleotide_3objects[i].position.sub(cms);
    }

    systems[sys_count].CoM = cms; //because system com may be useful to know */
    scene.add(systems[sys_count].system_3objects); //add system_3objects with strand_3objects with visual_object with Meshes
    sys_count += 1;
    //radio button/checkbox selections
    getActionMode();
    getScopeMode();
    getAxisMode();
    if (actionMode.includes("Drag")) {
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
    // update the scene
    render();
    //updatePos(sys_count - 1); //sets positions of system, strands, and visual objects to be located at their cms - messes up rotation sp recalculation and trajectory
    for (let i = 0; i < nucleotides.length; i++) { //create array of backbone sphere Meshes for base_selector
        backbones.push(nucleotides[i].visual_object.children[BACKBONE]);
    }
    //render();
}
function nextConfig() {
    for (let i = 0; i < systems.length; i++) { //for each system - does not actually work for multiple systems
        let system = systems[i];
        let datlen = system.system_length(); //gets # of nuc in system
        let nuc_local_id = 0;
        let current_strand = systems[i].strands[0];
        let len = datnum * datlen + 3 * datnum; //gets start position of nuc position data in .dat file
        //get the simulation box size 
        if (len < trajlines.length) { //for all nuc position data of current configuration
            let box = parseFloat(trajlines[len + 1].split(" ")[3]); //box numbers from .dat file
            let temptrajlines = trajlines.slice(len + 3);
            //for (var t = 2; t < 3; t++){
            //  dat_fileout = dat_fileout + lines[t] + "\n";
            //}
            for (let datx = 0; datx < datlen; datx++) {
                if (temptrajlines[datx] == "") {
                    return;
                }
                ;
                let current_nucleotide = current_strand.nucleotides[nuc_local_id];
                //get nucleotide information
                // consume a new line 
                let l = temptrajlines[datx].split(" ");
                let x = parseFloat(l[0]), y = parseFloat(l[1]), z = parseFloat(l[2]);
                current_nucleotide.pos = new THREE.Vector3(x, y, z);
                // extract axis vector a1 (backbone vector) and a3 (stacking vector) 
                let x_a1 = parseFloat(l[3]), y_a1 = parseFloat(l[4]), z_a1 = parseFloat(l[5]), x_a3 = parseFloat(l[6]), y_a3 = parseFloat(l[7]), z_a3 = parseFloat(l[8]);
                // according to base.py a2 is the cross of a1 and a3
                let [x_a2, y_a2, z_a2] = cross(x_a1, y_a1, z_a1, x_a3, y_a3, z_a3);
                // compute backbone cm
                let x_bb = 0;
                let y_bb = 0;
                let z_bb = 0;
                if (!RNA_MODE) { //calculations for DNA
                    x_bb = x - (0.34 * x_a1 + 0.3408 * x_a2),
                        y_bb = y - (0.34 * y_a1 + 0.3408 * y_a2),
                        z_bb = z - (0.34 * z_a1 + 0.3408 * z_a2);
                }
                else {
                    // calculations for RNA
                    x_bb = x - (0.4 * x_a1 + 0.2 * x_a3);
                    y_bb = y - (0.4 * y_a1 + 0.2 * y_a3);
                    z_bb = z - (0.4 * z_a1 + 0.2 * z_a3);
                }
                // compute nucleoside cm
                let x_ns = x + 0.4 * x_a1, y_ns = y + 0.4 * y_a1, z_ns = z + 0.4 * z_a1;
                //compute connector position
                let x_con = (x_bb + x_ns) / 2, y_con = (y_bb + y_ns) / 2, z_con = (z_bb + z_ns) / 2;
                //correctly display stacking interactions
                let old_a3 = new THREE.Matrix4();
                old_a3.extractRotation(current_nucleotide.visual_object.children[NUCLEOSIDE].matrix);
                let base_rotation = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(old_a3.elements[4], old_a3.elements[5], old_a3.elements[6]), new THREE.Vector3(x_a3, y_a3, z_a3)));
                // correctly orient connectors
                let neg_NS_pos = current_nucleotide.visual_object.children[NUCLEOSIDE].position.multiplyScalar(-1);
                let curr_heading = current_nucleotide.visual_object.children[BACKBONE].position.add(neg_NS_pos);
                let rotation_con = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(curr_heading.normalize(), new THREE.Vector3(x_bb - x_ns, y_bb - y_ns, z_bb - z_ns).normalize()));
                // update position and orientation of the nucleotides
                let group = current_nucleotide.visual_object;
                let locstrandID = (current_nucleotide.my_strand - 1) * system.strands[current_nucleotide.my_strand - 1].nucleotides.length + current_nucleotide.local_id; //gets nucleotide id in relation to system - used to color nucleotide Meshes properly
                group.name = current_nucleotide.global_id + "";
                //set new positions/rotations for the meshes.  Don't need to create new meshes since they exist.
                //if you position.set() before applyMatrix() everything explodes and I don't know why
                group.children[BACKBONE].position.set(x_bb, y_bb, z_bb);
                group.children[NUCLEOSIDE].applyMatrix(base_rotation);
                group.children[NUCLEOSIDE].position.set(x_ns, y_ns, z_ns);
                //not going to change the BB_NS_CON length because its the same out to 7 decimal places each time
                group.children[BB_NS_CON].applyMatrix(rotation_con);
                group.children[BB_NS_CON].position.set(x_con, y_con, z_con);
                group.children[COM].position.set(x, y, z);
                //last, add the sugar-phosphate bond since its not done for the first nucleotide in each strand
                if (current_nucleotide.neighbor3 != null) {
                    //remove the current sugar-phosphate bond to make room for the new one
                    scene.remove(group.children[SP_CON]);
                    //get current and 3' backbone positions and set length/rotation
                    let last_pos = new THREE.Vector3();
                    current_nucleotide.neighbor3.visual_object.children[BACKBONE].getWorldPosition(last_pos);
                    let this_pos = new THREE.Vector3;
                    group.children[BACKBONE].getWorldPosition(this_pos);
                    let x_sp = (this_pos.x + last_pos.x) / 2, y_sp = (this_pos.y + last_pos.y) / 2, z_sp = (this_pos.z + last_pos.z) / 2;
                    let sp_len = Math.sqrt(Math.pow(this_pos.x - last_pos.x, 2) + Math.pow(this_pos.y - last_pos.y, 2) + Math.pow(this_pos.z - last_pos.z, 2));
                    //easy periodic boundary condition fix
                    //if the bonds are too long just don't add them
                    if (sp_len <= 5) {
                        let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(this_pos.x - last_pos.x, this_pos.y - last_pos.y, this_pos.z - last_pos.z).normalize()));
                        group.children[SP_CON] = new THREE.Mesh(connector_geometry, system.strand_to_material[locstrandID]);
                        group.children[SP_CON].applyMatrix(rotation_sp); //rotate
                        group.children[SP_CON].applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //length
                        group.children[SP_CON].position.set(x_sp, y_sp, z_sp); //set position                     
                        /*let old_sp_rot = new THREE.Matrix4();
                        old_sp_rot.extractRotation(current_nucleotide.visual_object.children[SP_CON].matrix);
                        let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(
                            new THREE.Quaternion().setFromUnitVectors(
                                new THREE.Vector3(old_sp_rot.elements[4], old_sp_rot.elements[5], old_sp_rot.elements[6]), new THREE.Vector3(this_pos.x - last_pos.x, this_pos.y - last_pos.y, this_pos.z - last_pos.z).normalize()
                            )
                        );
                        group.children[SP_CON].applyMatrix(rotation_sp); //rotate
                        group.children[SP_CON].applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //length
                        group.children[SP_CON].position.set(x_sp, y_sp, z_sp); //set position
                    */ }
                }
                ;
                if (current_nucleotide.neighbor5 == null) {
                    system.system_3objects.add(current_strand.strand_3objects); //add strand_3objects to system_3objects
                    current_strand = system.strands[current_strand.strand_id]; //don't ask, its another artifact of strands being 1-indexed
                    nuc_local_id = 0; //reset
                }
                else {
                    nuc_local_id += 1;
                }
                ;
                render();
                //box by strand
                let dx, dy, dz;
                for (let j = 0; j < systems[i].strands.length; j++) { //for each strand in system
                    // compute offset to bring strand in box
                    let n = systems[i].strands[j].nucleotides.length; //# of nucleotides on strand
                    let cms = new THREE.Vector3(0, 0, 0);
                    for (let k = 0; k < n; k++) { //sum cms of each visual_object in strand; stored in children[3] = posObj Mesh 
                        cms.add(systems[i].strands[j].nucleotides[k].visual_object.children[COM].position);
                    }
                    //calculate cms
                    let mul = 1.0 / n;
                    cms.multiplyScalar(mul);
                    dx = Math.round(cms.x / box) * box;
                    dy = Math.round(cms.y / box) * box;
                    dz = Math.round(cms.z / box) * box;
                    //fix coordinates
                    for (let k = 0; k < systems[i].strands[j].nucleotides.length; k++) { //for each nucleotide in strand
                        for (let l = 0; l < systems[i].strands[j].nucleotides[k].visual_object.children.length; l++) { //for each Mesh in nucleotide's visual_object
                            let pos = systems[i].strands[j].nucleotides[k].visual_object.children[l].position; //get Mesh position
                            //calculate new positions by offset
                            pos.x = pos.x - dx;
                            pos.y = pos.y - dy;
                            pos.z = pos.z - dz;
                            systems[i].strands[j].nucleotides[k].visual_object.children[l].position.set(pos.x, pos.y, pos.z); //set new positions
                        }
                    }
                }
                render();
                //updatePos(i); //currently messes up next configuration - sets positions of system, strands, and visual objects to be located at their cms - messes up rotation sp recalculation and trajectory
            }
            datnum += 5;
        }
        else {
            alert("No more configurations to load.");
        }
    }
}
