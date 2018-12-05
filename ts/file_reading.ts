/// <reference path="./three/index.d.ts" />

// define the drag and drop behavior of the scene 
var target = renderer.domElement;
target.addEventListener("dragover", function (event) {
    event.preventDefault();
}, false);

// the actual code to drop in the config files
var current_system: System,
    current_chunk: String,
    dat_reader = new FileReader(),
    top_reader = new FileReader(),
    conf_len: number;

var base_to_num = {
    "A": 0,
    "G": 1,
    "C": 2,
    "T": 3,
    "U": 3
},
    strand_to_material = {},
    base_to_material = {};

top_reader.onload = () => {
    readTop(top_reader);
}

dat_reader.onload = () => {
    readDat(dat_reader, strand_to_material, base_to_material, current_system);
}

//get files from a drag-and-drop action
target.addEventListener("drop", function (event) {
    // cancel default actions
    event.preventDefault();
    let files = event.dataTransfer.files;
    handleFiles(files);
}, false);

//get files from URL
function getFileFromURL() {
    let url = new URL(window.location.href);
    let top_file = url.searchParams.get("topology") || '';
    let dat_file = url.searchParams.get("configuration") || '';
    if (top_file != '' && dat_file != '') {
        let top_xhr = new XMLHttpRequest();
        let dat_xhr = new XMLHttpRequest();
        top_xhr.open("GET", top_file);
        dat_xhr.open("GET", dat_file)
        top_xhr.responseType = "blob";
        dat_xhr.responseType = "blob";
        top_xhr.onload = () => {
            let top_blob = top_xhr.response;
            top_reader.readAsText(top_blob);
        }
        top_xhr.send();
        dat_xhr.onload = () => {
            let dat_blob = dat_xhr.response;
            dat_reader.readAsText(dat_blob);
        }
        dat_xhr.send();
    }
}
getFileFromURL();

//get files from upload button
function uploadFile(fileList) {
    document.getElementById("externalLoader").click();
}

function handleFiles(files) {
    let files_len = files.length;
    let top_file;
    let dat_file;

    // figure out which file is which based on extension
    let ext = files[0].name.slice(-3);
    if (files_len == 2) {
        if (ext == "dat" || ext == "onf") { //because nobody can decide whether the files are .dat or .conf
            dat_file = files[0];
            top_file = files[1];
        }
        else {
            dat_file = files[1];
            top_file = files[0];
        }
    }
    else { alert("Please drag and drop 1 .dat and 1 .top file.") }

    renderer.domElement.style.cursor = "wait";
    top_reader.readAsText(top_file);
    dat_reader.readAsText(dat_file);
    render();
}

function readTop(top_reader) {
    //make system to store strands in
    current_system = new System(sys_count, nucleotides.length);

    // make first strand
    let current_strand = new Strand(1, current_system);
    let nuc_local_id: number = 0;
    let last_strand: number = 1; //strands are 1-indexed in oxDNA .top files
    let neighbor3;

    // parse file into lines
    var file = top_reader.result as string
    var lines = file.split(/[\r\n]+/g);
    lines = lines.slice(1); // discard the header

    //create empty list of nucleotides with length equal to the topology
    for (let j = 0; j < lines.length; j++) {
        let nuc = new Nucleotide(nucleotides.length, current_system.system_id);
        nucleotides.push(nuc);
    }
    lines.forEach(
        (line, i) => {
            if (line == "") {
                nucleotides.pop();
                current_system.add_strand(current_strand);
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
                current_system.add_strand(current_strand);
                current_strand = new Strand(str_id, current_system);
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
            base_to_material[i] = nucleoside_materials[base_to_num[base]];
            // coloring bases according to strand id 
            strand_to_material[i] = backbone_materials[Math.floor(str_id % backbone_materials.length)]; //i = nucleotide id in system but not = global id b/c global id takes all systems into account

            if (i == lines.length - 1) {
                current_system.add_strand(current_strand);
                return
            };

        });
    for (let i = current_system.global_start_id; i < nucleotides.length; i++) { //set selected_bases[] to 0 for nucleotides[]-system start
        selected_bases.push(0);
    }
    current_system.setBaseMaterial(base_to_material); //store this system's base 
    current_system.setStrandMaterial(strand_to_material); //and strand coloring in current System object
    systems.push(current_system); //add system to Systems[]
    nuc_count = nucleotides.length;
    conf_len = nuc_count + 3;

}


let x_bb_last,
    y_bb_last,
    z_bb_last;
function readDat(dat_reader, strand_to_material, base_to_material, system) {
    var nuc_local_id = 0;
    var current_strand = systems[sys_count].strands[0];
    // parse file into lines 
    let lines = dat_reader.result.split(/[\r\n]+/g);
    //get the simulation box size 
    let box = parseFloat(lines[1].split(" ")[3]);
    // discard the header
    lines = lines.slice(3);

    // add the bases to the scene
    for (let i = 0; i < lines.length; i++) {//from beginning to end of current configuration's list of positions; for each nucleotide in the system
        if (lines[i] == "" || lines[i].slice(0, 1) == 't') {
            break
        };
        var current_nucleotide = current_strand.nucleotides[nuc_local_id];
        //get nucleotide information
        // consume a new line 
        let l: string = lines[i].split(" ");
        // shift coordinates such that the 1st base of the  
        // 1st strand is @ origin 
        let x = parseFloat(l[0]),// - fx,
            y = parseFloat(l[1]),// - fy,
            z = parseFloat(l[2]);// - fz;

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
        // 4 Mesh to display DNA + 1 Mesh to store visual_object group's center of mass as its position
        backbone = new THREE.Mesh(backbone_geometry, strand_to_material[i]); //sphere - sugar phosphate backbone
        nucleoside = new THREE.Mesh(nucleoside_geometry, base_to_material[i]); //sphere - nucleotide
        con = new THREE.Mesh(connector_geometry, strand_to_material[i]); //cyclinder - backbone and nucleoside connector
        let posObj = new THREE.Mesh; //Mesh (no shape) storing visual_object group center of mass  
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
        if (current_nucleotide.neighbor3 != null && current_nucleotide.neighbor3.local_id < current_nucleotide.local_id) {
            let x_sp = (x_bb + x_bb_last) / 2, //sugar phospate position in center of both current and last sugar phosphates
                y_sp = (y_bb + y_bb_last) / 2,
                z_sp = (z_bb + z_bb_last) / 2;

            let sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
            // easy periodic boundary condition fix  
            // if the bonds are to long just don't add them 
            if (sp_len <= 5) {
                let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(
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

        nuc_local_id += 1
    }
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
    // reposition center of mass of the system to 0,0,0
    let largestX = 0
    let largestY = 0
    let largestZ = 0
    let cms = new THREE.Vector3(0, 0, 0);
    let n_nucleotides = system.system_length();
    let i = system.global_start_id;
    for (; i < system.global_start_id + n_nucleotides; i++) {
        cms.add(nucleotides[i].visual_object.children[COM].position);
    }
    let mul = 1.0 / n_nucleotides;
    cms.multiplyScalar(mul);
    i = system.global_start_id;
    for (; i < system.global_start_id + n_nucleotides; i++) {
        for (let j = 0; j < nucleotides[i].visual_object.children.length; j++){
            nucleotides[i].visual_object.children[j].position.sub(cms);
        }
        nucleotides[i].visual_object.children[COM].position.sub(cms);
        if (nucleotides[i].visual_object.children[COM].position.x > largestX) {
            largestX = nucleotides[i].visual_object.children[COM].position.x;
        }
        if (nucleotides[i].visual_object.children[COM].position.y > largestY) {
            largestY = nucleotides[i].visual_object.children[COM].position.y;
        }
        if (nucleotides[i].visual_object.children[COM].position.z > largestZ) {
            largestZ = nucleotides[i].visual_object.children[COM].position.z;
        }
    }

    //set the camera 20 be 20 x units out from the largest x value
    camera.position.x = largestX + 20;
    camera.position.y = largestY + 20;
    camera.position.z = largestZ + 20;
    camera.lookAt(0,0,0)

    systems[sys_count].CoM = cms;

    scene.add(systems[sys_count].system_3objects); //add system_3objects with strand_3objects with visual_object with Meshes
    sys_count += 1;

    // update the scene
    render();

    for (let i = 0; i < nucleotides.length; i++) { //create array of backbone sphere Meshes for base_selector
        backbones.push(nucleotides[i].visual_object.children[BACKBONE]);
    }
    renderer.domElement.style.cursor = "auto";
}
