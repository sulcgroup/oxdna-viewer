/// <reference path="./three/index.d.ts" />

render();
// nucleotides store the information about position, orientation, ID
// Eventually there should be a way to pair them
// Everything is an Object3D, but only nucleotides have anything to render
class Nucleotide {
    local_id: number; //location on strand
    global_id: number; //location in world - all systems
    pos: THREE.Vector3; //not automatically updated
    neighbor3: Nucleotide | null;
    neighbor5: Nucleotide | null;
    pair: number;
    type: number | string; // 0:A 1:G 2:C 3:T/U
    my_strand: number;
    my_system: number;
    visual_object: THREE.Group; //contains 4 THREE.Mesh

    constructor(global_id: number, local_id: number, neighbor3: Nucleotide | null, type: number | string,
        parent_strand: number, parent_system: number) {
        this.global_id = global_id;
        this.local_id = local_id;
        this.neighbor3 = neighbor3;
        this.type = type;
        this.my_strand = parent_strand;
        this.my_system = parent_system;

    };
};

// strands are made up of nucleotides
// strands have an ID within the system
class Strand {

    strand_id: number; //system location
    nucleotides: Nucleotide[] = [];
    my_system: System;
    strand_3objects: THREE.Group; //contains visual_objects

    constructor(id: number, parent_system: System) {
        this.strand_id = id;
        this.my_system = parent_system;
        this.strand_3objects = new THREE.Group;
    };

    add_nucleotide(nuc: Nucleotide) {
        this.nucleotides.push(nuc);
        nuc.local_id = this.nucleotides.indexOf(nuc);
    };

    remove_nucleotide(to_remove: number) {
        this.nucleotides.forEach(function (nucleotide, i) {
            if (nucleotide.local_id === to_remove) {
                scene.remove(nucleotide.visual_object);
            }
        })
    };

};

// systems are made of strands
// systems can CRUD
class System {

    system_id: number;
    strands: Strand[] = [];
    CoM: THREE.Vector3; //System center of mass
    global_start_id: number; //1st nucleotide's global_id
    system_3objects: THREE.Group; //contains strand_3objects
    strand_to_material = {};
    base_to_material = {};
    dat_file;
    constructor(id, start_id) {
        this.system_id = id;
        this.global_start_id = start_id;
        this.system_3objects = new THREE.Group;
    };

    system_length(): number {
        let count: number = 0;
        for (let i = 0; i < this.strands.length; i++) {
            count += this.strands[i].nucleotides.length;
        }
        return count;
    }

    add_strand(strand: Strand) {
        this.strands.push(strand);
    };

    remove_strand(to_remove: number) {
        this.strands.forEach(function (strand, i) {
            if (strand.strand_id === to_remove) {
                for (let j = 0; j < strand.nucleotides.length; j++) {
                    strand.remove_nucleotide(j);
                }
            };
        })
    };

    setStrandMaterial(strand_to_material) {
        this.strand_to_material = strand_to_material;
    }
    setBaseMaterial(base_to_material) {
        this.base_to_material = base_to_material;
    }
    setDatFile(dat_file) { //allows for trajectory function
        this.dat_file = dat_file;
    }

    //remove_system(){};
};

// store rendering mode RNA  
let RNA_MODE = false; // By default we do DNA
// add base index visualistion
var nucleotide_3objects: THREE.Group[] = []; //contains references to all THREE.Group obj
var nucleotides: Nucleotide[] = []; //contains references to all nucleotides
//var selected_bases = {};
//initialize the space
var systems: System[] = [];
let sys_count: number = 0;
let strand_count: number = 0;
let nuc_count: number = 0;
var selected_bases: number[] = [];
var backbones: THREE.Object3D[] = [];
let lut, devs: number[]; //need for Lut coloring
let lutCols: THREE.Color[] = [];
let lutColsVis: boolean = false;

// define the drag and drop behavior of the scene 
var target = renderer.domElement;
target.addEventListener("dragover", function (event) {
    event.preventDefault();
}, false);
// the actual code to drop in the config files
var dat_fileout: string = "";
var datnum = 0;
var dat_file; //currently var so only 1 dat_file stored for all systems w/ last uploaded system's dat
target.addEventListener("drop", function (event) {

    // cancel default actions
    event.preventDefault();

    //make system to store the dropped files in
    var system = new System(sys_count, nucleotides.length);

    var i = 0,
        files = event.dataTransfer.files,
        files_len = files.length;

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
    else if (files_len > 3) (alert("Please drag and drop 1 .dat and 1 .top file. .json is optional.")) //error message
    //read topology file
    let top_reader = new FileReader();
    top_reader.onload = () => {
        // make first strand
        var current_strand = new Strand(1, system);
        let nuc_local_id: number = 0;
        let last_strand: number = 1; //strands are 1-indexed in oxDNA .top files
        let last_nuc: Nucleotide | null;
        let neighbor3;
        // parse file into lines
        var lines = top_reader.result.split(/[\r\n]+/g);
        lines = lines.slice(1); // discard the header  
        lines.forEach(
            (line, i) => {
                if (line == "") { return };
                let l = line.split(" "); //split the file and read each column
                let id = parseInt(l[0]); // get the strand id
                if (id != last_strand) { //if new strand id, make new strand
                    current_strand = new Strand(id, system);
                    nuc_local_id = 0;
                    last_nuc = null;
                };

                let base = l[1]; // get base id
                //if we meet a U, we have an RNA (its dumb, but its all we got)
                if (base === "U") {
                    RNA_MODE = true;
                }

                neighbor3 = last_nuc;

                let nuc = new Nucleotide(nuc_count, nuc_local_id, neighbor3, base, id, system.system_id); //create nucleotide
                if (nuc.neighbor3 != null) { //link the previous one to it
                    nuc.neighbor3.neighbor5 = nuc;
                };
                current_strand.add_nucleotide(nuc); //add nuc into Strand object
                nucleotides.push(nuc); //add nuc to global nucleotides array
                nuc_count += 1;
                nuc_local_id += 1;
                last_strand = id;
                last_nuc = nuc;

                if (parseInt(l[3]) == -1) { //if its the end of a strand, add it to current system
                    system.add_strand(current_strand);
                };

                // create a lookup for
                // coloring base according to base id
                base_to_material[i] = nucleoside_materials[base_to_num[base]];
                // coloring bases according to strand id 
                strand_to_material[i] = backbone_materials[Math.floor(id % backbone_materials.length)]; //i = nucleotide id in system but not = global id b/c global id takes all systems into account


            });
        for (let i = system.global_start_id; i < nucleotides.length; i++) { //set selected_bases[] to 0 for nucleotides[]-system start
            selected_bases.push(0);
        }
        system.setBaseMaterial(base_to_material); //store this system's base 
        system.setStrandMaterial(strand_to_material); //and strand coloring in current System object
        system.setDatFile(dat_file); //store dat_file in current System object
        systems.push(system); //add system to Systems[]
    };
    top_reader.readAsText(top_file);


    if (files_len == 3) { //if dropped 3 files = also included .json
        let json_reader = new FileReader(); //read .json
        json_reader.onload = () => {

            let lines: string[] = json_reader.result.split(", ");
            devs = [];
            if (lines.length == system.system_length()) { //if json and dat files match/same length
                for (let i = 0; i < lines.length; i++) {
                    devs.push(parseFloat(lines[i])); //insert numbers from json file into devs[]
                }
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
            }
            else { //if json and dat files do not match, display error message and set files_len to 2 (not necessary)
                alert(".json and .top files are not compatible.");
                files_len = 2;
            }
        };
        json_reader.readAsText(json_file);
    }

    if (files_len == 2 || files_len == 3) {
        // read a configuration file 
        var x_bb_last, //last backbone positions
            y_bb_last,
            z_bb_last;
        //read .dat
        let dat_reader = new FileReader();
        dat_reader.onload = () => {
            readDat(/*datnum,*/ system.system_length(), dat_reader, strand_to_material, base_to_material, system, files_len, x_bb_last, y_bb_last, z_bb_last);
        };
        // execute the read operation 
        dat_reader.readAsText(dat_file);

    }


    //Lut coloring - colors nucleotides based on flexibility during oxDNA simulation run
    //doesn't work for more than one system
    if (files_len == 1) { //if .json dropped after .dat and .top
        if (files[0].name.slice(-4) == "json") { //if actually a .json file
            json_file = files[0];
            let json_reader = new FileReader();
            json_reader.onload = () => {

                let lines: string[] = json_reader.result.split(", "); //read numbers as strings
                devs = [];
                if (lines.length == nucleotides.length) {
                    for (let i = 0; i < lines.length; i++) {
                        devs.push(parseFloat(lines[i])); //insert lines[i] strings as numbers into devs[]
                    }
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
                    render();
                }
                else {
                    alert(".json and .top files are not compatible."); //error message if dat_file does not match/same length as .json file
                }
            };
            json_reader.readAsText(json_file);
        }
    }
    render();
}, false);
// update the scene
render();

var trajlines;
function readDat(/*datnum, */datlen, dat_reader, strand_to_material, base_to_material, system, files_len, x_bb_last, y_bb_last, z_bb_last) {
    var nuc_local_id = 0;
    var current_strand = systems[sys_count].strands[0];
    // parse file into lines 
    let lines = dat_reader.result.split(/[\r\n]+/g);
    trajlines = lines;
    //get the simulation box size 
    let box = parseFloat(lines[1].split(" ")[3]);
    // everything but the header
    lines = lines.slice(3);
    //for (var t = 2; t < 3; t++){
    //  dat_fileout = dat_fileout + lines[t] + "\n";
    //}

    // calculate offset to have the first strand @ the scene origin 
    let first_line = lines[0].split(" ");
    // parse the coordinates
    let fx = parseFloat(first_line[0]),
        fy = parseFloat(first_line[1]),
        fz = parseFloat(first_line[2]);
    let test = 0;
    let arb = 0;
    let trajlen = (datnum + 1) * datlen; //end of current configuration's list of positions
    // add the bases to the scene
    for (let i = datnum * datlen; i < trajlen; i++) {//from beginning to end of current configuration's list of positions; for each nucleotide in the system
        if (lines[i] == "") { return };
        var current_nucleotide = current_strand.nucleotides[nuc_local_id];
        //get nucleotide information
        // consume a new line 
        let l: string = lines[i].split(" ");
        // shift coordinates such that the 1st base of the  
        // 1st strand is @ origin 
        let x = parseFloat(l[0]),// - fx,
            y = parseFloat(l[1]),// - fy,
            z = parseFloat(l[2]);// - fz;

        /* // compute offset to bring strand in box
        let dx = Math.round(x / box) * box,
            dy = Math.round(y / box) * box,
            dz = Math.round(z / box) * box;

        //fix coordinates 
        x = x - dx;
        y = y - dy;
        z = z - dz; */

        /* let geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        let material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        let cube = new THREE.Mesh(geometry, material);
        cube.position.set(x, y, z);
        scene.add(cube);
        backbones.push(cube); */
        current_nucleotide.pos = new THREE.Vector3(x, y, z); //set pos; not updated by DragControls

        // extract axis vector a1 (backbone vector) and a3 (stacking vector) 
        let x_a1 = parseFloat(l[3]),
            y_a1 = parseFloat(l[4]),
            z_a1 = parseFloat(l[5]),
            x_a3 = parseFloat(l[6]),
            y_a3 = parseFloat(l[7]),
            z_a3 = parseFloat(l[8]);

        // according to base.py a2 is the cross of a1 and a3
        let [x_a2, y_a2, z_a2] = cross(x_a1, y_a1, z_a1, x_a3, y_a3, z_a3);
        // compute backbone cm
        let x_bb: number = 0;
        let y_bb: number = 0;
        let z_bb: number = 0;
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
        let x_ns = x + 0.4 * x_a1,
            y_ns = y + 0.4 * y_a1,
            z_ns = z + 0.4 * z_a1;

        //compute connector position
        let x_con = (x_bb + x_ns) / 2,
            y_con = (y_bb + y_ns) / 2,
            z_con = (z_bb + z_ns) / 2;

        //compute connector length
        let con_len = Math.sqrt(Math.pow(x_bb - x_ns, 2) + Math.pow(y_bb - y_ns, 2) + Math.pow(z_bb - z_ns, 2));

        let base_rotation = new THREE.Matrix4().makeRotationFromQuaternion( //create base sphere rotation
            new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(x_a3, y_a3, z_a3)));

        // correctly display stacking interactions
        let rotation_con = new THREE.Matrix4().makeRotationFromQuaternion( //creat nucleoside sphere rotation
            new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_con - x_ns, y_con - y_ns, z_con - z_ns).normalize()
            )
        );

        // adds a new "backbone", new "nucleoside", and new "connector" to the scene by adding to visual_object then to strand_3objects then to system_3objects then to scene
        let group = new THREE.Group; //create visual_object group
        group.name = current_nucleotide.global_id + ""; //set name (string) to nucleotide's global id
        let backbone, nucleoside, con;
        //if (files_len == 2) {
        //4 Mesh to display DNA + 1 Mesh to store visual_object group's center of mass as its position
        backbone = new THREE.Mesh(backbone_geometry, strand_to_material[i]); //sphere - sugar phosphate backbone
        nucleoside = new THREE.Mesh(nucleoside_geometry, base_to_material[i]); //sphere - nucleotide
        con = new THREE.Mesh(connector_geometry, strand_to_material[i]); //cyclinder - backbone and nucleoside connector
        //}

        //if .dat, .top, and .json files dropped simultaneously
        if (files_len == 3) {
            lutCols.push(lut.getColor(devs[arb])); //add colors to lutCols[]
        }
        let posObj = new THREE.Mesh; //Mesh (no shape) storing visual_object group center of mass  //new THREE.Mesh(new THREE.SphereGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
        con.applyMatrix(new THREE.Matrix4().makeScale(1.0, con_len, 1.0));
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
        if (current_nucleotide.neighbor3 != null) {
            let x_sp = (x_bb + x_bb_last) / 2, //sugar phospate position in center of both current and last sugar phosphates
                y_sp = (y_bb + y_bb_last) / 2,
                z_sp = (z_bb + z_bb_last) / 2;

            let sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
            // easy periodic boundary condition fix  
            // if the bonds are to long just don't add sugar phosphate connectors
            if (sp_len <= 1.2) {
                let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion( //create cylinder rotation from original vertical orientation to new orientation
                    new THREE.Quaternion().setFromUnitVectors(
                        new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize()
                    )
                );
                let sp = new THREE.Mesh(connector_geometry, strand_to_material[i]); //cylinder - sugar phosphate connector
                sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //set length according to distance between current and last sugar phosphate
                sp.applyMatrix(rotation_sp); //set rotation
                sp.position.set(x_sp, y_sp, z_sp);
                group.add(sp); //add to visual_object
            }
            arb++; //increment for each nucleotide b/c each nucleotide has 
        };
        //actually add the new items to the scene by adding to visual_object then to strand_3objects then to system_3objects then to scene
        current_nucleotide.visual_object = group; //set Nucleotide nuc's visual_object attribute to group
        nucleotide_3objects.push(group); //add group to nucleotide_3objects[] with THREE.Group for each nucleotide
        current_strand.strand_3objects.add(group); //add group to strand_3objects
        //update last backbone position and last strand
        x_bb_last = x_bb;
        y_bb_last = y_bb;
        z_bb_last = z_bb;
        if (current_nucleotide.neighbor5 == null) { //if last nucleotide in strand
            system.system_3objects.add(current_strand.strand_3objects); //add strand THREE.Group to system THREE.Group
            current_strand = system.strands[current_strand.strand_id]; //don't ask, its another artifact of strands being 1-indexed
            nuc_local_id = 0;
        }
        else {
            nuc_local_id += 1;
        };
        render();

    }
    datnum++; //configuration # - currently only works for 1 system
    let dx, dy, dz;

    //bring strand in box
    for (let i = 0; i < systems[sys_count].strands.length; i++) { //for each strand in current system
        // compute offset to bring strand in box
        let n = systems[sys_count].strands[i].nucleotides.length; //strand's nucleotides[] length
        let cms = new THREE.Vector3(0, 0, 0); //center of mass
        for (let j = 0; j < n; j++) { //for every nuc in strand
            cms.add(systems[sys_count].strands[i].nucleotides[j].visual_object.children[3].position); //sum center of masses - children[3] = posObj Mesh at cms
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
        backbones.push(nucleotides[i].visual_object.children[0]);
    }
    //render();
}

let x_bb_last, y_bb_last, z_bb_last; //last nucleotide's backbone positions
function nextConfig() { //attempts to display next configuration; same as readDat() except does not make new sphere Meshes, etc. - maximize efficiency
    for (let i = 0; i < systems.length; i++) { //for each system - does not actually work for multiple systems
        let system = systems[i];
        let datlen = system.system_length(); //gets # of nuc in system
        let nuc_local_id = 0;
        let current_strand = systems[i].strands[0];
        let len = datnum * datlen + 3 * datnum; //gets start position of nuc position data in .dat file
        //get the simulation box size 
        if (len < trajlines.length) { //for all nuc position data of current configuration
            console.log(datlen); //troubleshooting
            console.log(datnum);
            console.log(len);
            console.log(trajlines.length);
            let box = parseFloat(trajlines[len + 1].split(" ")[3]); //box numbers from .dat file
            // everything but the header
            console.log(trajlines[len + 1].split(" ")[3]);
            let temptrajlines = trajlines.slice(len + 3);
            console.log(temptrajlines);
            //for (var t = 2; t < 3; t++){
            //  dat_fileout = dat_fileout + lines[t] + "\n";
            //}

            // calculate offset to have the first strand @ the scene origin 
            let first_line = temptrajlines[0].split(" ");
            // parse the coordinates
            let fx = parseFloat(first_line[0]),
                fy = parseFloat(first_line[1]),
                fz = parseFloat(first_line[2]);
            // add the bases to the scene
            let test = 0;
            let arb = 0;
            let trajlen = (datnum + 1) * datlen + 3 * datnum;
            for (let datx = 0; datx < 10; datx++) {
                if (temptrajlines[datx] == "") { return };
                let current_nucleotide = current_strand.nucleotides[nuc_local_id];
                //get nucleotide information
                // consume a new line 
                let l: string = temptrajlines[datx].split(" ");
                console.log(l);
                // shift coordinates such that the 1st base of the  
                // 1st strand is @ origin 
                let x = parseFloat(l[0]),// - fx,
                    y = parseFloat(l[1]),// - fy,
                    z = parseFloat(l[2]);// - fz;
                current_nucleotide.pos = new THREE.Vector3(x, y, z);

                // extract axis vector a1 (backbone vector) and a3 (stacking vector) 
                let x_a1 = parseFloat(l[3]),
                    y_a1 = parseFloat(l[4]),
                    z_a1 = parseFloat(l[5]),
                    x_a3 = parseFloat(l[6]),
                    y_a3 = parseFloat(l[7]),
                    z_a3 = parseFloat(l[8]);

                // according to base.py a2 is the cross of a1 and a3
                let [x_a2, y_a2, z_a2] = cross(x_a1, y_a1, z_a1, x_a3, y_a3, z_a3);
                // compute backbone cm
                let x_bb: number = 0;
                let y_bb: number = 0;
                let z_bb: number = 0;
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
                let x_ns = x + 0.4 * x_a1,
                    y_ns = y + 0.4 * y_a1,
                    z_ns = z + 0.4 * z_a1;

                //compute connector position
                let x_con = (x_bb + x_ns) / 2,
                    y_con = (y_bb + y_ns) / 2,
                    z_con = (z_bb + z_ns) / 2;

                //compute connector length
                let con_len = Math.sqrt(Math.pow(x_bb - x_ns, 2) + Math.pow(y_bb - y_ns, 2) + Math.pow(z_bb - z_ns, 2));

                let base_rotation = new THREE.Matrix4().makeRotationFromQuaternion(
                    new THREE.Quaternion().setFromUnitVectors(
                        new THREE.Vector3(0, 1, 0),
                        new THREE.Vector3(x_a3, y_a3, z_a3)));

                // correctly display stacking interactions
                let rotation_con = new THREE.Matrix4().makeRotationFromQuaternion(
                    new THREE.Quaternion().setFromUnitVectors(
                        new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_con - x_ns, y_con - y_ns, z_con - z_ns).normalize()
                    )
                );

                // adds a new "backbone", new "nucleoside", and new "connector" to the scene by adding to visual_object then to strand_3objects then to system_3objects then to scene
                let group = current_nucleotide.visual_object;
                let locstrandID = (current_nucleotide.my_strand - 1) * system.strands[current_nucleotide.my_strand - 1].nucleotides.length + current_nucleotide.local_id; //gets nucleotide id in relation to system - used to color nucleotide Meshes properly
                group.name = current_nucleotide.global_id + "";
                //group.children[0] = backbone
                //group.children[1] = nucleoside
                //group.children[2] = backbone nucleoside connector / con
                //group.children[3] = posObj - cms Mesh
                //group.children[4] = sugar phosphate connector
                group.children[2] = new THREE.Mesh(connector_geometry, system.strand_to_material[locstrandID]); //new con 
                group.children[2].applyMatrix(new THREE.Matrix4().makeScale(1.0, con_len, 1.0)); //length
                // apply rotations
                group.children[1].applyMatrix(base_rotation); //nucleoside
                group.children[2].applyMatrix(rotation_con); //con 
                //set positions
                group.children[0].position.set(x_bb, y_bb, z_bb);
                group.children[1].position.set(x_ns, y_ns, z_ns);
                group.children[2].position.set(x_con, y_con, z_con);
                group.children[3].position.set(x, y, z);
                console.log(x_bb, y_bb, z_bb); //troubleshooting
                console.log(x_ns, y_ns, z_ns);
                console.log(x_con, y_con, z_con);
                console.log(x, y, z);
                //last, add the sugar-phosphate bond since its not done for the first nucleotide in each strand
                if (current_nucleotide.neighbor3 != null) {
                    let temp = new THREE.Vector3();
                    current_nucleotide.neighbor3.visual_object.children[0].getWorldPosition(temp); //backone's world position
                    let x_sp = (x_bb + temp.x) / 2, //sp position
                        y_sp = (y_bb + temp.y) / 2,
                        z_sp = (z_bb + temp.z) / 2;
                    let sp_len = Math.sqrt(Math.pow(x_bb - temp.x, 2) + Math.pow(y_bb - temp.y, 2) + Math.pow(z_bb - temp.z, 2));
                    //easy periodic boundary condition fix
                    //if the bonds are to long just don't add them
                    if (sp_len <= 1.2) {
                        let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(
                            new THREE.Quaternion().setFromUnitVectors(
                                new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize()
                            )
                        );
                        group.children[4] = new THREE.Mesh(connector_geometry, system.strand_to_material[locstrandID]); //new sp
                        group.children[4].applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //length
                        group.children[4].applyMatrix(rotation_sp); //rotate
                        group.children[4].position.set(x_sp, y_sp, z_sp); //set position
                        //group.children[4].applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0));
                        //group.children[4].applyMatrix(rotation_sp);
                        //group.children[4].position.set(x_sp, y_sp, z_sp);
                        console.log(x_sp, y_sp, z_sp);
                    }
                };
                arb++; //used for coloring - not necessary here?
                if (current_nucleotide.neighbor5 == null) {
                    system.system_3objects.add(current_strand.strand_3objects); //add strand_3objects to system_3objects
                    current_strand = system.strands[current_strand.strand_id]; //don't ask, its another artifact of strands being 1-indexed
                    nuc_local_id = 0; //reset
                }
                else {
                    nuc_local_id += 1;
                };
                render();

                //box by strand
                let dx, dy, dz;
                for (let j = 0; j < systems[i].strands.length; j++) { //for each strand in system
                    // compute offset to bring strand in box
                    let n = systems[i].strands[j].nucleotides.length; //# of nucleotides on strand
                    let cms = new THREE.Vector3(0, 0, 0);
                    for (let k = 0; k < n; k++) { //sum cms of each visual_object in strand; stored in children[3] = posObj Mesh 
                        cms.add(systems[i].strands[j].nucleotides[k].visual_object.children[3].position);
                    }
                    //calculate cms
                    let mul = 1.0 / n;
                    cms.multiplyScalar(mul);
                    dx = Math.round(cms.x / box) * box;
                    dy = Math.round(cms.y / box) * box;
                    dz = Math.round(cms.z / box) * box;

                    //fix coordinates
                    let temp = new THREE.Vector3();
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

function updatePos(sys_count) { //sets positions of system, strands, and visual objects to be located at their cms - messes up rotation sp recalculation and trajectory
    for (let h = sys_count; h < sys_count + 1; h++) { //for current system
        let cmssys = new THREE.Vector3(); //system cms
        let n = systems[h].system_length(); //# of nucleotides in system
        for (let i = 0; i < systems[h].system_3objects.children.length; i++) { //for each strand
            let n1 = systems[h].system_3objects.children[i].children.length; //for strand_3objects in system_3objects
            let cms = new THREE.Vector3(); //strand cms
            for (let j = 0; j < n1; j++) { //for each visual_object
                let rotobj = systems[h].system_3objects.children[i].children[j]; //current nuc's visual_object
                let n2 = rotobj.children.length; //# of Meshes in visual_object/rot obj
                let cms1 = new THREE.Vector3(); //group cms
                let currentpos = new THREE.Vector3();
                //sum cms of all visual_object in each system, strand, and itself
                cms.add(rotobj.children[3].position); //strand cms
                cms1 = rotobj.children[3].position; //rotobj cms
                let cmsx = cms1.x, cmsy = cms1.y, cmsz = cms1.z;
                cmssys.add(rotobj.children[3].position); //system cms

                for (let k = 0; k < n2; k++) { //for all Meshes in rotobj/visual_object translate by -cms1
                    rotobj.children[k].applyMatrix(new THREE.Matrix4().makeTranslation(-cmsx, -cmsy, -cmsz));
                }
                rotobj.position.set(0, 0, 0);
                rotobj.applyMatrix(new THREE.Matrix4().makeTranslation(cmsx, cmsy, cmsz)); //translate rotobj by cms1
            }
            //calculate strand cms
            let mul = 1.0 / n1;
            cms.multiplyScalar(mul);
            for (let k = 0; k < n1; k++) { //for each nucleotide in strand, translate by -cms
                systems[h].strands[i].strand_3objects.children[k].applyMatrix(new THREE.Matrix4().makeTranslation(-cms.x, -cms.y, -cms.z));
            }
            systems[h].strands[i].strand_3objects.position.set(0, 0, 0);
            systems[h].strands[i].strand_3objects.applyMatrix(new THREE.Matrix4().makeTranslation(cms.x, cms.y, cms.z)); //translate strand by cms
        }
        //calculate system cms
        let mul = 1.0 / n;
        cmssys.multiplyScalar(mul);
        for (let k = 0; k < systems[h].system_3objects.children.length; k++) { //for each strand, translate by -cmssys
            systems[h].system_3objects.children[k].applyMatrix(new THREE.Matrix4().makeTranslation(-cmssys.x, -cmssys.y, -cmssys.z));
        }
        systems[h].system_3objects.position.set(0, 0, 0);
        systems[h].system_3objects.applyMatrix(new THREE.Matrix4().makeTranslation(cmssys.x, cmssys.y, cmssys.z)); //translate system by cmssys
    }
}

function toggleLut(chkBox) { //toggles display of coloring by flexibility / structure modeled off of base selector
    if (lutCols.length > 0) { //lutCols stores each nucleotide's color (determined by flexibility)
        if (lutColsVis) { //if "Display Flexibility" checkbox selected (currently displaying coloring) - does not actually get checkbox value; at onload of webpage is false and every time checkbox is changed, it switches boolean
            for (let i = 0; i < nucleotides.length; i++) { //for all nucleotides in all systems - does not work for more than one system
                let sysID = nucleotides[i].my_system;
                let back_Mesh: THREE.Object3D = nucleotides[i].visual_object.children[0]; //backbone
                let nuc_Mesh: THREE.Object3D = nucleotides[i].visual_object.children[1]; //nucleoside
                let con_Mesh: THREE.Object3D = nucleotides[i].visual_object.children[2]; //backbone nucleoside connector; cms posObj Mesh does not have a shape or color, etc.
                let sp_Mesh: THREE.Object3D = nucleotides[i].visual_object.children[4]; //sugar phosphate connector
                if (back_Mesh instanceof THREE.Mesh) { //needed because Object3D "may not be" THREE.Mesh
                    if (back_Mesh.material instanceof THREE.MeshLambertMaterial) { //needed because Mesh.material "may not be" MeshLambertMaterial
                        back_Mesh.material = (systems[sysID].strand_to_material[nucleotides[i].global_id]); //set material to material stored earlier based on strandID
                    }
                }
                if (nuc_Mesh instanceof THREE.Mesh) {
                    if (nuc_Mesh.material instanceof THREE.MeshLambertMaterial || nuc_Mesh.material instanceof THREE.MeshLambertMaterial) {
                        nuc_Mesh.material = (systems[sysID].base_to_material[nucleotides[i].global_id]); //set material to material stored earlier based on base id
                    }
                }
                if (con_Mesh instanceof THREE.Mesh) {
                    if (con_Mesh.material instanceof THREE.MeshLambertMaterial) {
                        con_Mesh.material = (systems[sysID].strand_to_material[nucleotides[i].global_id]);
                    }
                }
                if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
                    if (sp_Mesh.material instanceof THREE.MeshLambertMaterial) {
                        sp_Mesh.material = (systems[sysID].strand_to_material[nucleotides[i].global_id]);
                    }
                }
            }
            lutColsVis = false; //now flexibility coloring is not being displayed and checkbox is not selected
        }
        else {
            for (let i = 0; i < nucleotides.length; i++) { //for each nucleotide in all systems - does not work for multiple systems yet
                let tmeshlamb = new THREE.MeshLambertMaterial({ //create new MeshLambertMaterial with appropriate coloring stored in lutCols
                    color: lutCols[i],
                    side: THREE.DoubleSide
                });
                for (let j = 0; j < nucleotides[i].visual_object.children.length; j++) { //for each Mesh in each nucleotide's visual_object
                    if (j != 3) { //for all except cms posObj Mesh
                        let tmesh: THREE.Object3D = nucleotides[i].visual_object.children[j];
                        if (tmesh instanceof THREE.Mesh) { //needed because nucleotides[i].visual_object.children[j] "may not be" a Mesh
                            tmesh.material = tmeshlamb;
                        }
                    }
                }
            }
            lutColsVis = true; //now flexibility coloring is being displayed and checkbox is selected
        }
        render();
    }
    else {
        alert("Please drag and drop the corresponding .json file.");
        chkBox.checked = false;
    }
}

function cross(a1, a2, a3, b1, b2, b3) { //calculate cross product of 2 THREE.Vectors but takes coordinates as (x,y,z,x1,y1,z1)
    return [a2 * b3 - a3 * b2,
    a3 * b1 - a1 * b3,
    a1 * b2 - a2 * b1];
}

function centerSystems() { //centers systems based on cms calculated for world (all systems) - works only along with updatePos()
    for (let i = 0; i < nucleotides.length; i++) { //for each nucleotide in all systems, set pos variable - not updated by updatePos(), rotation, + drag features
        nucleotides[i].pos.x = nucleotides[i].visual_object.position.x;
        nucleotides[i].pos.y = nucleotides[i].visual_object.position.y;
        nucleotides[i].pos.z = nucleotides[i].visual_object.position.z;
    }
    let cms = new THREE.Vector3;
    let n_nucleotides = 0;
    for (let x = 0; x < systems.length; x++) { //for each system
        for (let y = 0; y < systems[x].system_3objects.children.length; y++) { //for each strand_3objects
            for (let z = 0; z < systems[x].system_3objects.children[y].children.length; z++) { //for each visual_object
                let temp = new THREE.Vector3;
                systems[x].system_3objects.children[y].children[z].getWorldPosition(temp); //get nucleotide's visual_object world position
                cms.add(temp); //sum all visual_object cms
                n_nucleotides++;
            }
        }
    }
    //calculate cms
    let mul = 1.0 / n_nucleotides;
    cms.multiplyScalar(mul);
    for (let x = 0; x < systems.length; x++) { //for each system, translate system by -world cms
        let pos = systems[x].system_3objects.position;
        pos.set(pos.x - cms.x, pos.y - cms.y, pos.z - cms.z);
    }
    render();
}

//strand delete testcode
document.addEventListener("keypress", event => {
    if (event.keyCode === 100) { //if p is pressed, delete first system's first strand
        systems[0].remove_strand(1);
        render();
    }
});