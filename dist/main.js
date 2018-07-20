/// <reference path="./three/index.d.ts" />
render();
// nucleotides store the information about position, orientation, ID
// Eventually there should be a way to pair them
// Everything is an Object3D, but only nucleotides have anything to render
class Nucleotide {
    constructor(global_id, local_id, neighbor3, type, parent_strand, parent_system) {
        this.global_id = global_id;
        this.local_id = local_id;
        this.neighbor3 = neighbor3;
        this.type = type;
        this.my_strand = parent_strand;
        this.my_system = parent_system;
    }
    ;
}
;
// strands are made up of nucleotides
// strands have an ID within the system
class Strand {
    constructor(id, parent_system) {
        this.nucleotides = [];
        this.strand_id = id;
        this.my_system = parent_system;
        this.strand_3objects = new THREE.Group;
    }
    ;
    add_nucleotide(nuc) {
        this.nucleotides.push(nuc);
        nuc.local_id = this.nucleotides.indexOf(nuc);
    }
    ;
    remove_nucleotide(to_remove) {
        this.nucleotides.forEach(function (nucleotide, i) {
            if (nucleotide.local_id === to_remove) {
                scene.remove(nucleotide.visual_object);
            }
        });
    }
    ;
}
;
// systems are made of strands
// systems can CRUD
class System {
    constructor(id, start_id) {
        this.strands = [];
        this.system_id = id;
        this.global_start_id = start_id;
        this.system_3objects = new THREE.Group;
    }
    ;
    system_length() {
        let count = 0;
        for (let i = 0; i < this.strands.length; i++) {
            count += this.strands[i].nucleotides.length;
        }
        return count;
    }
    add_strand(strand) {
        this.strands.push(strand);
    }
    ;
    remove_strand(to_remove) {
        this.strands.forEach(function (strand, i) {
            if (strand.strand_id === to_remove) {
                for (let j = 0; j < strand.nucleotides.length; j++) {
                    strand.remove_nucleotide(j);
                }
            }
            ;
        });
    }
    ;
}
;
// store rendering mode RNA  
var RNA_MODE = false; // By default we do DNA
// add base index visualistion
var nucleotide_3objects = []; //contains references to all meshes
var nucleotides = []; //contains references to all nucleotides
//var selected_bases = {};
//initialize the space
var systems = [];
var sys_count = 0;
var strand_count = 0;
var nuc_count = 0;
var lut, devs;
// define the drag and drop behavior of the scene 
var target = renderer.domElement;
target.addEventListener("dragover", function (event) {
    event.preventDefault();
}, false);
// the actual code to drop in the config files
var dat_fileout = "";
target.addEventListener("drop", function (event) {
    // cancel default actions
    event.preventDefault();
    //make system to store the dropped files in
    var system = new System(sys_count, nucleotides.length);
    var i = 0, files = event.dataTransfer.files, files_len = files.length;
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
    let dat_file;
    let top_file;
    let json_file;
    // assign files to the extentions 
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
    else
        (alert("Please drag and drop 1 .dat and 1 .top file. .json is optional."));
    //read topology file
    let top_reader = new FileReader();
    top_reader.onload = () => {
        // make first strand
        var current_strand = new Strand(1, system);
        let nuc_local_id = 0;
        let last_strand = 1; //strands are 1-indexed in oxDNA .top files
        let last_nuc;
        let neighbor3;
        // parse file into lines
        var lines = top_reader.result.split(/[\r\n]+/g);
        lines = lines.slice(1); // discard the header  
        lines.forEach((line, i) => {
            if (line == "") {
                return;
            }
            ;
            let l = line.split(" "); //split the file and read each column
            let id = parseInt(l[0]); // get the strand id
            if (id != last_strand) {
                current_strand = new Strand(id, system);
                nuc_local_id = 0;
                last_nuc = null;
            }
            ;
            let base = l[1]; // get base id
            //if we meet a U, we have an RNA (its dumb, but its all we got)
            if (base === "U") {
                RNA_MODE = true;
            }
            neighbor3 = last_nuc;
            let nuc = new Nucleotide(nuc_count, nuc_local_id, neighbor3, base, id, system.system_id); //create nucleotide
            if (nuc.neighbor3 != null) { //link the previous one to it
                nuc.neighbor3.neighbor5 = nuc;
            }
            ;
            current_strand.add_nucleotide(nuc);
            nucleotides.push(nuc);
            nuc_count += 1;
            nuc_local_id += 1;
            last_strand = id;
            last_nuc = nuc;
            if (parseInt(l[3]) == -1) { //if its the end of a strand
                system.add_strand(current_strand);
            }
            ;
            // create a lookup for
            // coloring base according to base id
            base_to_material[i] = nucleoside_materials[base_to_num[base]];
            // coloring bases according to strand id 
            strand_to_material[i] = backbone_materials[Math.floor(id % backbone_materials.length)];
        });
        systems.push(system);
    };
    if (files_len == 3) {
        let json_reader = new FileReader();
        json_reader.onload = () => {
            let lines = json_reader.result.split(", ");
            devs = [];
            for (let i = 0; i < lines.length; i++) {
                devs.push(parseFloat(lines[i]));
            }
            let min = Math.min.apply(null, devs), max = Math.max.apply(null, devs);
            lut = new THREE.Lut("rainbow", 4000);
            lut.setMax(max);
            lut.setMin(min);
            let legend = lut.setLegendOn({ 'layout': 'horizontal', 'position': { 'x': 0, 'y': 10, 'z': 0 } });
            scene.add(legend);
            let labels = lut.setLegendLabels({ 'title': 'Number', 'um': 'id', 'ticks': 5, 'position': { 'x': 0, 'y': 10, 'z': 0 } });
            scene.add(labels['title']);
            for (let i = 0; i < Object.keys(labels['ticks']).length; i++) {
                scene.add(labels['ticks'][i]);
                scene.add(labels['lines'][i]);
            }
        };
        json_reader.readAsText(json_file);
    }
    top_reader.readAsText(top_file);
    // read a configuration file 
    var x_bb_last, y_bb_last, z_bb_last;
    let dat_reader = new FileReader();
    dat_reader.onload = () => {
        var nuc_local_id = 0;
        var current_strand = systems[sys_count].strands[0];
        // parse file into lines 
        var lines = dat_reader.result.split(/[\r\n]+/g);
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
        let fx = parseFloat(first_line[0]), fy = parseFloat(first_line[1]), fz = parseFloat(first_line[2]);
        // add the bases to the scene
        let test = 0;
        let arb = 0;
        lines.forEach((line, i) => {
            if (line == "") {
                return;
            }
            ;
            var current_nucleotide = current_strand.nucleotides[nuc_local_id];
            //get nucleotide information
            // consume a new line 
            let l = line.split(" ");
            // shift coordinates such that the 1st base of the  
            // 1st strand is @ origin 
            let x = parseFloat(l[0]), // - fx,
            y = parseFloat(l[1]), // - fy,
            z = parseFloat(l[2]); // - fz;
            var geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
            var material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            var cube = new THREE.Mesh(geometry, material);
            cube.position.set(x, y, z);
            //scene.add(cube);
            /*             // compute offset to bring strand in box
                        let dx = Math.round(x / box) * box,
                            dy = Math.round(y / box) * box,
                            dz = Math.round(z / box) * box;
            
                        //fix coordinates
                        x = x - dx;
                        y = y - dy;
                        z = z - dz;*/
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
            //compute connector length
            let con_len = Math.sqrt(Math.pow(x_bb - x_ns, 2) + Math.pow(y_bb - y_ns, 2) + Math.pow(z_bb - z_ns, 2));
            let base_rotation = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_a3, y_a3, z_a3)));
            // correctly display stacking interactions
            let rotation_con = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_con - x_ns, y_con - y_ns, z_con - z_ns).normalize()));
            // adds a new "backbone", new "nucleoside", and new "connector" to the scene
            let group = new THREE.Group;
            let backbone, nucleoside, con;
            if (files_len == 2) {
                backbone = new THREE.Mesh(backbone_geometry, strand_to_material[i]);
                nucleoside = new THREE.Mesh(nucleoside_geometry, base_to_material[i]);
                con = new THREE.Mesh(connector_geometry, strand_to_material[i]);
            }
            else if (files_len == 3) {
                let tmeshlamb = new THREE.MeshLambertMaterial({
                    color: lut.getColor(devs[arb]),
                    //emissive: 0x072534,
                    side: THREE.DoubleSide,
                });
                backbone = new THREE.Mesh(backbone_geometry, tmeshlamb);
                arb++;
                tmeshlamb = new THREE.MeshLambertMaterial({
                    color: lut.getColor(devs[arb]),
                    //emissive: 0x072534,
                    side: THREE.DoubleSide,
                });
                nucleoside = new THREE.Mesh(nucleoside_geometry, tmeshlamb);
                arb++;
                tmeshlamb = new THREE.MeshLambertMaterial({
                    color: lut.getColor(devs[arb]),
                    //emissive: 0x072534,
                    side: THREE.DoubleSide,
                });
                con = new THREE.Mesh(connector_geometry, tmeshlamb);
                arb++;
            }
            let posObj = new THREE.Mesh(); //new THREE.Mesh(new THREE.SphereGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
            con.applyMatrix(new THREE.Matrix4().makeScale(1.0, con_len, 1.0));
            // apply rotations
            nucleoside.applyMatrix(base_rotation);
            con.applyMatrix(rotation_con);
            //set positions and add to object
            backbone.position.set(x_bb, y_bb, z_bb);
            nucleoside.position.set(x_ns, y_ns, z_ns);
            con.position.set(x_con, y_con, z_con);
            posObj.position.set(x, y, z);
            //current_strand.strand_3objects.children.push(backbone);
            //current_strand.strand_3objects.children.push(nucleoside);
            //current_strand.strand_3objects.children.push(con);
            group.add(backbone);
            group.add(nucleoside);
            group.add(con);
            group.add(posObj);
            //last, add the sugar-phosphate bond since its not done for the first nucleotide in each strand
            if (current_nucleotide.neighbor3 != null) {
                let x_sp = (x_bb + x_bb_last) / 2, y_sp = (y_bb + y_bb_last) / 2, z_sp = (z_bb + z_bb_last) / 2;
                let sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
                // easy periodic boundary condition fix  
                // if the bonds are to long just don't add them 
                if (sp_len <= 1.2) {
                    var rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize()));
                    let sp;
                    if (files_len == 2) {
                        sp = new THREE.Mesh(connector_geometry, strand_to_material[i]);
                    }
                    else if (files_len == 3) {
                        let tmeshlamb = new THREE.MeshLambertMaterial({
                            color: lut.getColor(devs[arb]),
                            //emissive: 0x072534,
                            side: THREE.DoubleSide,
                        });
                        sp = new THREE.Mesh(connector_geometry, tmeshlamb);
                        arb++;
                    }
                    sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0));
                    sp.applyMatrix(rotation_sp);
                    sp.position.set(x_sp, y_sp, z_sp);
                    //current_strand.strand_3objects.children.push(sp);
                    group.add(sp);
                }
            }
            ;
            //actually add the new items to the scene
            current_nucleotide.visual_object = group;
            nucleotide_3objects.push(group);
            current_strand.strand_3objects.add(group);
            //update last backbone position and last strand
            x_bb_last = x_bb;
            y_bb_last = y_bb;
            z_bb_last = z_bb;
            if (current_nucleotide.neighbor5 == null) {
                system.system_3objects.add(current_strand.strand_3objects);
                current_strand = system.strands[current_strand.strand_id]; //don't ask, its another artifact of strands being 1-indexed
                nuc_local_id = 0;
            }
            else {
                nuc_local_id += 1;
            }
            ;
            render();
        });
        let dx, dy, dz;
        for (let i = 0; i < systems[sys_count].strands.length; i++) {
            // compute offset to bring strand in box
            let n = systems[sys_count].strands[i].nucleotides.length;
            let cms = new THREE.Vector3(0, 0, 0);
            for (let j = 0; j < n; j++) {
                cms.add(systems[sys_count].strands[i].nucleotides[j].visual_object.children[3].position);
            }
            let mul = 1.0 / n;
            cms.multiplyScalar(mul);
            dx = Math.round(cms.x / box) * box;
            dy = Math.round(cms.y / box) * box;
            dz = Math.round(cms.z / box) * box;
            //fix coordinates
            let temp = new THREE.Vector3();
            for (let j = 0; j < systems[sys_count].strands[i].nucleotides.length; j++) {
                for (let k = 0; k < systems[sys_count].strands[i].nucleotides[j].visual_object.children.length; k++) {
                    let pos = systems[sys_count].strands[i].nucleotides[j].visual_object.children[k].position;
                    pos.x = pos.x - dx;
                    pos.y = pos.y - dy;
                    pos.z = pos.z - dz;
                    systems[sys_count].strands[i].nucleotides[j].visual_object.children[k].position.set(pos.x, pos.y, pos.z);
                }
            }
        }
        scene.add(systems[sys_count].system_3objects);
        sys_count += 1;
        getActionMode();
        getScopeMode();
        getAxisMode();
        if (actionMode.includes("Drag")) {
            drag();
        }
        // update the scene
        render();
        updatePos(sys_count - 1);
    };
    // execute the read operation 
    dat_reader.readAsText(dat_file);
    if (files_len == 1) {
        if (files[0].name.slice(-4) == "json") {
            json_file = files[0];
            let json_reader = new FileReader();
            json_reader.onload = () => {
                let lines = json_reader.result.split(", ");
                devs = [];
                for (let i = 0; i < lines.length; i++) {
                    devs.push(parseFloat(lines[i]));
                }
                let min = Math.min.apply(null, devs), max = Math.max.apply(null, devs);
                lut = new THREE.Lut("rainbow", 4000);
                lut.setMax(max);
                lut.setMin(min);
                let legend = lut.setLegendOn({ 'layout': 'horizontal', 'position': { 'x': 0, 'y': 10, 'z': 0 } });
                scene.add(legend);
                let labels = lut.setLegendLabels({ 'title': 'Number', 'um': 'id', 'ticks': 5, 'position': { 'x': 0, 'y': 10, 'z': 0 } });
                scene.add(labels['title']);
                for (let i = 0; i < Object.keys(labels['ticks']).length; i++) {
                    scene.add(labels['ticks'][i]);
                    scene.add(labels['lines'][i]);
                }
                let arb = 0;
                for (let i = 0; i < nucleotides.length; i++) {
                    for (let j = 0; j < nucleotides[i].visual_object.children.length; j++) {
                        if (j != 3) {
                            let tmeshlamb = new THREE.MeshLambertMaterial({
                                color: lut.getColor(devs[arb]),
                                //emissive: 0x072534,
                                side: THREE.DoubleSide,
                            });
                            let tmesh = nucleotides[i].visual_object.children[j];
                            if (tmesh instanceof THREE.Mesh) {
                                tmesh.material = tmeshlamb;
                            }
                        }
                        arb++;
                    }
                }
                render();
            };
            json_reader.readAsText(json_file);
        }
    }
}, false);
/* if (files_len == 1) {
        if (files[0].name.slice(-4) == "json") {
            json_file = files[0];
            let json_reader = new FileReader();

            json_reader.onload = () => {
                let lines: string[] = json_reader.result.split(", ");
                lines[0] = lines[0].slice(1);
                lines[lines.length - 1] = lines[lines.length - 1].slice(-1);
                console.log(lines);
                devs = [];
                for (let i = 0; i < lines.length; i++) {
                    devs.push(parseFloat(lines[i]));
                }
                console.log(devs);
                let min = Math.min.apply(null, devs),
                    max = Math.max.apply(null, devs);
                lut = new THREE.Lut("rainbow", 4000);
                console.log(max);
                console.log(min);
                lut.setMax(max);
                lut.setMin(min);
                console.log(lut);
                let legend = lut.setLegendOn({ 'layout': 'horizontal', 'position': { 'x': 0, 'y': 10, 'z': 0 } });
                scene.add(legend);
                let labels = lut.setLegendLabels({ 'title': 'Number', 'um': 'id', 'ticks': 5, 'position': { 'x': 0, 'y': 10, 'z': 0 } });
                scene.add(labels['title']);

                for (let i = 0; i < Object.keys(labels['ticks']).length; i++) {
                    scene.add(labels['ticks'][i]);
                    scene.add(labels['lines'][i]);
                }

                let arb = 0;
                for (let i = 0; i < nucleotides.length; i++) {
                    //console.log(nucleotides[i]);
                    for (let j = 0; j < nucleotides[i].visual_object.children.length; j++) {
                        if (j != 3) {
                            //console.log(devs[arb]);
                            let tmeshlamb = new THREE.MeshLambertMaterial({
                                color: lut.getColor(devs[arb]),
                                //emissive: 0x072534,
                                side: THREE.DoubleSide
                                //flatShading: true
                            });
                            nucleotides[i].visual_object.children[j] = new THREE.Mesh(backbone_geometry, tmeshlamb);

                        }
                        arb++;
                    }
                }
            };
            json_reader.readAsText(json_file);
        }
    } */
// update the scene
render();
function updatePos(sys_count) {
    for (let h = sys_count; h < sys_count + 1; h++) {
        let cmssys = new THREE.Vector3();
        let n = systems[h].system_length();
        for (let i = 0; i < systems[h].system_3objects.children.length; i++) { //each strand
            let n1 = systems[h].system_3objects.children[i].children.length;
            let cms = new THREE.Vector3();
            for (let j = 0; j < n1; j++) { //each group
                let rotobj = systems[h].system_3objects.children[i].children[j];
                let n2 = rotobj.children.length;
                let cms1 = new THREE.Vector3(), currentpos = new THREE.Vector3();
                cms.add(rotobj.children[3].position);
                cms1 = rotobj.children[3].position;
                let cmsx = cms1.x, cmsy = cms1.y, cmsz = cms1.z;
                cmssys.add(rotobj.children[3].position);
                for (let k = 0; k < n2; k++) {
                    rotobj.children[k].applyMatrix(new THREE.Matrix4().makeTranslation(-cmsx, -cmsy, -cmsz));
                }
                rotobj.applyMatrix(new THREE.Matrix4().makeTranslation(cmsx, cmsy, cmsz));
            }
            let mul = 1.0 / n1;
            cms.multiplyScalar(mul);
            for (let k = 0; k < n1; k++) {
                systems[h].strands[i].strand_3objects.children[k].applyMatrix(new THREE.Matrix4().makeTranslation(-cms.x, -cms.y, -cms.z));
            }
            systems[h].strands[i].strand_3objects.applyMatrix(new THREE.Matrix4().makeTranslation(cms.x, cms.y, cms.z));
        }
        let mul = 1.0 / n;
        cmssys.multiplyScalar(mul);
        for (let k = 0; k < systems[h].system_3objects.children.length; k++) {
            systems[h].system_3objects.children[k].applyMatrix(new THREE.Matrix4().makeTranslation(-cmssys.x, -cmssys.y, -cmssys.z));
        }
        systems[h].system_3objects.applyMatrix(new THREE.Matrix4().makeTranslation(cmssys.x, cmssys.y, cmssys.z));
    }
}
function cross(a1, a2, a3, b1, b2, b3) {
    return [a2 * b3 - a3 * b2,
        a3 * b1 - a1 * b3,
        a1 * b2 - a2 * b1];
}
function centerSystems() {
    for (let i = 0; i < nucleotides.length; i++) {
        nucleotides[i].pos.x = nucleotides[i].visual_object.children[3].position.x;
        nucleotides[i].pos.y = nucleotides[i].visual_object.children[3].position.y;
        nucleotides[i].pos.z = nucleotides[i].visual_object.children[3].position.z;
    }
    let cms = new THREE.Vector3;
    let n_nucleotides = 0;
    for (let x = 0; x < systems.length; x++) {
        for (let y = 0; y < systems[x].system_3objects.children.length; y++) {
            for (let z = 0; z < systems[x].system_3objects.children[y].children.length; z++) {
                let temp = new THREE.Vector3;
                systems[x].system_3objects.children[y].children[z].children[3].getWorldPosition(temp);
                cms.add(temp);
                n_nucleotides++;
            }
        }
    }
    let mul = 1.0 / n_nucleotides;
    cms.multiplyScalar(mul);
    for (let x = 0; x < systems.length; x++) {
        let pos = systems[x].system_3objects.position;
        pos.set(pos.x - cms.x, pos.y - cms.y, pos.z - cms.z);
    }
    /*
    systems[x].system_3objects.position.set(0, 0, 0);
    n_nucleotides += systems[x].system_length();
    cms.add(calcCMS(x, n_nucleotides, i));
    let pos = systems[x].system_3objects.position;
    pos.set(pos.x - cms.x, pos.y - cms.y, pos.z - cms.z);
      i = systems[x].global_start_id;
     for (; i < systems[x].global_start_id + n_nucleotides; i++) {
         let pos = nucleotide_3objects[i].position;
         pos.set(pos.x - cms.x, pos.y - cms.y, pos.z - cms.z);
     }
    systems[x].CoM = cms; //because system com may be useful to know
    console.log(calcCMS(x, n_nucleotides, i));*/
    render();
}
/* function calcCMS(x, n_nucleotides, i) {
    let cms = new THREE.Vector3(0, 0, 0);
    let temp = new THREE.Vector3(0, 0, 0);
    for (; i < systems[x].global_start_id + n_nucleotides; i++) {
        nucleotides[i].visual_object.children[3].getWorldPosition(temp);
        cms.add(temp);
    }
    let mul = 1.0 / n_nucleotides;
    cms.multiplyScalar(mul);
    return cms;
} */
//strand delete testcode
document.addEventListener("keypress", event => {
    if (event.keyCode === 100) {
        systems[0].remove_strand(1);
        render();
    }
});
