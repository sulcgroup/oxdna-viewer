/// <reference path="./three/index.d.ts" />

// nucleotides store the information about position, orientation, ID
// Eventually there should be a way to pair them
// Everything is an Object3D, but only nucleotides have anything to render
class Nucleotide {
    local_id:number;
    global_id:number;
    pos:THREE.Vector3;
    neighbor3:Nucleotide|null;
    neighbor5:Nucleotide|null;
    pair:number;
    type:number|string; // 0:A 1:G 2:C 3:T/U
    my_strand:number;
    visual_object:THREE.Group;

    constructor(global_id:number, local_id:number, neighbor3:Nucleotide|null, type:number|string, parent_strand:number){
        this.global_id = global_id;
        this.local_id = local_id;
        this.neighbor3 = neighbor3;
        this.type = type;
        this.my_strand = parent_strand;

    };
};

// strands are made up of nucleotides
// strands have an ID within the system
class Strand {

    strand_id:number;
    nucleotides:Nucleotide[] = [];
    my_system:System;



    constructor(id:number, parent_system:System) {
        this.strand_id = id;
        this.my_system = parent_system;
    };

    add_nucleotide(nuc:Nucleotide){
        this.nucleotides.push(nuc);
        nuc.local_id = this.nucleotides.indexOf(nuc);
    };

    remove_nucleotide(to_remove:number){
        this.nucleotides.forEach(function(nucleotide, i){
            if (nucleotide.local_id === to_remove){
                scene.remove(nucleotide.visual_object);
            }
        })
    };

};

// systems are made of strands
// systems can CRUD
class System {

    system_id:number;
    strands:Strand[] = [];
    CoM:THREE.Vector3;
    global_start_id: number;

    constructor(id, start_id) {
        this.system_id = id;
        this.global_start_id = start_id;
    };

    system_length():number{
        let count:number = 0;
        for(let i = 0; i < this.strands.length; i++){
            count += this.strands[i].nucleotides.length;
            }
        return count;
    }

    add_strand(strand:Strand){
        this.strands.push(strand);
    };

    remove_strand(to_remove:number){
        this.strands.forEach(function(strand, i){
            if (strand.strand_id === to_remove){
                for(let j=0; j < strand.nucleotides.length; j++){
                    strand.remove_nucleotide(j);
                }
            };
        })
    };
    //remove_system(){};

};

// store rendering mode RNA  
var RNA_MODE = false; // By default we do DNA


// add base index visualistion
var nucleotide_3objects: THREE.Group[] = []; //contains references to all meshes
var nucleotides: Nucleotide[] = []; //contains references to all nucleotides
var selected_bases = {};

//initialize the space
var systems: System[] = [];
var sys_count:number = 0;
var strand_count:number = 0;
var nuc_count:number = 0;

// define the drag and drop behavior of the scene 
var target = renderer.domElement;
target.addEventListener("dragover", function(event) {
    event.preventDefault();
}, false);
// the actual code to drop in the config files 
target.addEventListener("drop", function(event) {

    // cancel default actions
    event.preventDefault();

    //make system to store the dropped files in
    var system = new System(sys_count, nucleotides.length);

    var i = 0,
        files = event.dataTransfer.files,
        len = files.length;
    
    var strand_to_material = {};
    var base_to_material = {};
    var base_to_num = {
        "A" : 0,
        "G" : 1,
        "C" : 2,
        "T" : 3,
        "U" : 3 
    };
    // get the extention of one of the 2 files 
    let ext = files[0].name.slice(-3);
    // space to store the file paths 
    let dat_file;
    let top_file;
    // assign files to the extentions 
    if (ext === "dat"){
        dat_file = files[0];    
        top_file = files[1];    
    }
    else{
        dat_file = files[1];
        top_file = files[0];
    }
    
    //read topology file
    let top_reader = new FileReader();
    top_reader.onload = ()=> {
        // make first strand
        var current_strand = new Strand(1, system);
        let nuc_local_id: number = 0;
        let last_strand: number = 1; //strands are 1-indexed in oxDNA .top files
        let last_nuc: Nucleotide|null;
        let neighbor3;
        // parse file into lines
        var lines = top_reader.result.split(/[\r\n]+/g);
        lines = lines.slice(1); // discard the header  
        lines.forEach(
            (line, i) => {
                if (line == ""){return};
                let l = line.split(" "); //split the file and read each column
                let id = parseInt(l[0]); // get the strand id
                if (id != last_strand){
                    current_strand = new Strand(id, system);
                    nuc_local_id = 0;
                    last_nuc = null;
                };

                let base = l[1]; // get base id
                //if we meet a U, we have an RNA (its dumb, but its all we got)
                if(base === "U"){
                    RNA_MODE = true;
                }

                neighbor3 = last_nuc;

                let nuc = new Nucleotide(nuc_count, nuc_local_id, neighbor3, base, id); //create nucleotide
                if (nuc.neighbor3 != null){ //link the previous one to it
                    nuc.neighbor3.neighbor5 = nuc;
                };
                current_strand.add_nucleotide(nuc);
                nucleotides.push(nuc);
                nuc_count += 1;
                nuc_local_id += 1;
                last_strand = id;
                last_nuc = nuc;

                if (parseInt(l[3]) == -1){ //if its the end of a strand
                    system.add_strand(current_strand);
                };

                // create a lookup for
                // coloring base according to base id
                base_to_material[i] = nucleoside_materials[base_to_num[base]];
                // coloring bases according to strand id 
                strand_to_material[i] = backbone_materials[Math.floor(id % backbone_materials.length )];
            });
        systems.push(system);
    };
    top_reader.readAsText(top_file);

    // read a configuration file 
    var x_bb_last,
        y_bb_last,
        z_bb_last;

    let dat_reader = new FileReader();
    dat_reader.onload = ()=>{ 
        var nuc_local_id = 0;
        var current_strand = systems[sys_count].strands[0];
        // parse file into lines 
        var lines = dat_reader.result.split(/[\r\n]+/g);
        
        //get the simulation box size 
        let box = parseFloat(lines[1].split(" ")[3]);

        // everything but the header 
        lines = lines.slice(3);
        
        // calculate offset to have the first strand @ the scene origin 
        let first_line = lines[0].split(" ");
        // parse the coordinates
        let fx = parseFloat(first_line[0]), 
            fy = parseFloat(first_line[1]),
            fz = parseFloat(first_line[2]);
        
        // add the bases to the scene
        lines.forEach((line, i) => {
            if (line == ""){return};
            var current_nucleotide = current_strand.nucleotides[nuc_local_id];
            //get nucleotide information
            // consume a new line 
            let l:string = line.split(" ");
            // shift coordinates such that the 1st base of the  
            // 1st strand is @ origin 
            let x = parseFloat(l[0])- fx, 
                y = parseFloat(l[1])- fy,
                z = parseFloat(l[2])- fz;
            
            // compute offset to bring strand in box
            let dx = Math.round(x / box) * box,
                dy = Math.round(y / box) * box,
                dz = Math.round(z / box) * box;
                        
            //fix coordinates 
            x = x - dx;
            y = y - dy;
            z = z - dz;
            current_nucleotide.pos = new THREE.Vector3(x, y, z);

            // extract axis vector a1 (backbone vector) and a3 (stacking vector) 
            let x_a1 = parseFloat(l[3]),
                y_a1 = parseFloat(l[4]),
                z_a1 = parseFloat(l[5]), 
                x_a3 = parseFloat(l[6]),
                y_a3 = parseFloat(l[7]),
                z_a3 = parseFloat(l[8]);
    

            // according to base.py a2 is the cross of a1 and a3
            let [x_a2,y_a2, z_a2] = cross(x_a1, y_a1, z_a1, x_a3, y_a3, z_a3);

            // compute backbone cm
            let x_bb: number = 0;
            let y_bb: number = 0;
            let z_bb: number = 0;
            if(!RNA_MODE){ //calculations for DNA
                x_bb = x - (0.34 * x_a1 + 0.3408 * x_a2),
                y_bb = y - (0.34 * y_a1 + 0.3408 * y_a2),
                z_bb = z - (0.34 * z_a1 + 0.3408 * z_a2);
            }

            else{
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
            let x_con = (x_bb + x_ns)/2,
                y_con = (y_bb + y_ns)/2,
                z_con = (z_bb + z_ns)/2;

            //compute connector length
            let con_len = Math.sqrt(Math.pow(x_bb-x_ns,2)+Math.pow(y_bb-y_ns,2)+Math.pow(z_bb-z_ns,2));
            
            var base_rotation = new THREE.Matrix4().makeRotationFromQuaternion(
                new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0,1,0),
                new THREE.Vector3(x_a3, y_a3, z_a3)));
            
            // correctly display stacking interactions
            var rotation_con = new THREE.Matrix4().makeRotationFromQuaternion(
                new THREE.Quaternion().setFromUnitVectors(
                    new THREE.Vector3(0,1,0), new THREE.Vector3(x_con-x_ns, y_con-y_ns, z_con-z_ns).normalize()
                )
            );

            // adds a new "backbone", new "nucleoside", and new "connector" to the scene
            var group = new THREE.Group;
            var backbone = new THREE.Mesh( backbone_geometry, strand_to_material[i] );
            var nucleoside = new THREE.Mesh( nucleoside_geometry, base_to_material[i]);
            var con = new THREE.Mesh( connector_geometry, strand_to_material[i] );
            con.applyMatrix(new THREE.Matrix4().makeScale(1.0, con_len, 1.0));
            // apply rotations
            nucleoside.applyMatrix(base_rotation);
            con.applyMatrix(rotation_con);
            //set positions and add to object
            backbone.position.set(x_bb, y_bb, z_bb); 
            nucleoside.position.set(x_ns, y_ns, z_ns);
            con.position.set(x_con, y_con, z_con);
            group.add(backbone);
            group.add(nucleoside);
            group.add(con);
            

            //last, add the sugar-phosphate bond since its not done for the first nucleotide in each strand
            if(current_nucleotide.neighbor3 != null){
                let x_sp = (x_bb + x_bb_last)/2,
                    y_sp = (y_bb + y_bb_last)/2,
                    z_sp = (z_bb + z_bb_last)/2;

                let sp_len = Math.sqrt(Math.pow(x_bb-x_bb_last,2)+Math.pow(y_bb-y_bb_last,2)+Math.pow(z_bb-z_bb_last,2));

                var rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(
                    new THREE.Quaternion().setFromUnitVectors(
                        new THREE.Vector3(0,1,0), new THREE.Vector3(x_sp-x_bb, y_sp-y_bb, z_sp-z_bb).normalize()
                    )
                );
                var sp = new THREE.Mesh(connector_geometry, strand_to_material[i] );
                sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0));
                sp.applyMatrix(rotation_sp);
                sp.position.set(x_sp, y_sp, z_sp);

                group.add(sp);
            };
            
            //actually add the new items to the scene
            current_nucleotide.visual_object = group;
            nucleotide_3objects.push(group);
            scene.add(group);
            


            //update last backbone position and last strand
            x_bb_last = x_bb;
            y_bb_last = y_bb;
            z_bb_last = z_bb;
            if (current_nucleotide.neighbor5 == null){
                current_strand = system.strands[current_strand.strand_id]; //don't ask, its another artifact of strands being 1-indexed
                nuc_local_id = 0;
            }
            else{
                nuc_local_id += 1;
            };

        });

        // reposition center of mass of the system to 0,0,0
        let cms = new THREE.Vector3(0,0,0);
        let n_nucleotides = system.system_length(); 
        let i = system.global_start_id;
        for(; i < system.global_start_id + n_nucleotides; i++){
            cms.add(nucleotides[i].pos);
        }
        let mul = 1.0 / n_nucleotides;
        cms.multiplyScalar(mul);
        i = system.global_start_id;
        for(; i < system.global_start_id + n_nucleotides; i++){
            nucleotide_3objects[i].position.sub(cms);
        }

        systems[sys_count].CoM = cms; //because system com may be useful to know
        sys_count += 1;

        // update the scene
        render();
        
    };
    // execute the read operation 
    dat_reader.readAsText(dat_file);


}, false);

// update the scene
render();



function cross (a1,a2,a3,b1,b2,b3) {
    return [ a2 * b3 - a3 * b2, 
             a3 * b1 - a1 * b3, 
             a1 * b2 - a2 * b1 ];
}


//strand delete testcode
document.addEventListener("keypress", event =>{
    if(event.keyCode === 100){
        systems[0].remove_strand(1);
        render();
    }
});