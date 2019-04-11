/// <reference path="./three/index.d.ts" />

var BACKBONE = 0
var NUCLEOSIDE = 1
var BB_NS_CON = 2
var COM = 3
var SP_CON = 4

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

    constructor(global_id: number, parent_system: number) {
        this.global_id = global_id;
        this.my_system = parent_system;

    };
};

// strands are made up of nucleotides
// strands have an ID within the system
class Strand {

    strand_id: number; //system location
    nucleotides: Nucleotide[] = [];
    my_system: System;
    strand_3objects: THREE.Group; //contains Nucleotide.visual_objects

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
        for (let i = 0; i < this.nucleotides.length; i++) {
            let n = this.nucleotides[i];
            if (n.local_id == to_remove) {
                scene.remove(n.visual_object);
                n = null;
            }
        }
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
        for (let i = 0; i < this.strands.length; i++) {
            let s = this.strands[i];
            if (s.strand_id == to_remove) {
                this.system_3objects.remove(s.strand_3objects);
                for (let j = 0; j < s.nucleotides.length; j++) {
                    s.strand_3objects.remove(s.nucleotides[j].visual_object);
                    s.remove_nucleotide(j);
                }
                scene.remove(s.strand_3objects);
                s = null;
            };
            
            render();
        }
    };

    strand_to_material(strandIndex: number) {
        return backbone_materials[strandIndex % backbone_materials.length];
    };

    base_to_material(base: number|string) {
        if(typeof base == "string") {
            base = {"A":0,"G":1,"C":2,"T":3,"U":3}[base];
        }
        return nucleoside_materials[base];
    };

    setDatFile(dat_file) { //allows for trajectory function
        this.dat_file = dat_file;
    }

    //remove_system(){};
};

function dat_loader(file) {

}

// store rendering mode RNA  
let RNA_MODE = false; // By default we do DNA base spacing
// add base index visualistion
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

/*function updatePos(sys_count) { //sets positions of system, strands, and visual objects to be located at their cms - messes up rotation sp recalculation and trajectory
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
}*/

function nextConfig() {
    if (next_reader.readyState == 1) { //0: nothing loaded 1: working 2: done
        return;
    }
    getNewConfig(1);
    let centering_on = (<HTMLInputElement>document.getElementById("centering")).checked
    if (centering_on) {
        centerSystems()
    }
}

function previousConfig() {
    if (previous_previous_reader.readyState == 1) {
        return;
    }
    getNewConfig(-1);
    let centering_on = (<HTMLInputElement>document.getElementById("centering")).checked
    if (centering_on) {
        centerSystems()
    }
}

function toggleVideoOptions() {
    let opt = document.getElementById("videoOptions");
    opt.hidden = !opt.hidden;
}

function toggleColorOptions() {
    let opt = document.getElementById("colorOptions");
    opt.hidden = !opt.hidden;
    if(!opt.hidden) {
        opt.innerHTML = "";  //Clear content
        for(let i=0; i<backbone_materials.length; i++) {
            let m = backbone_materials[i];
            let c = document.createElement('input');
            c.type = 'color';
            c.value = "#" + m.color.getHexString();
            c.oninput = function() {
                backbone_materials[i].color = new THREE.Color(c.value);
            };
            c.oncontextmenu = function(event) {
                event.preventDefault();
                opt.removeChild(c);
                backbone_materials.splice(i, 1);
                return false;
            }
            opt.appendChild(c);
        }
        let addButton = document.createElement('button');
        addButton.innerText = "Add color";
        addButton.onclick = function() {
            backbone_materials.push(
                new THREE.MeshLambertMaterial({
                    color: 0x156289,
                    side: THREE.DoubleSide
                }));
            render();
            opt.hidden = true; toggleColorOptions();
        }
        opt.appendChild(addButton);
    }
}

function updateColor(colorPicker) {
}

function createVideo() {
    // get canvas
    let canvas = <HTMLCanvasElement> document.getElementById("threeCanvas");

    // get options:
    let format = (<HTMLInputElement>document.querySelector('input[name="videoFormat"]:checked')).value;
    let framerate = (<HTMLInputElement>document.getElementById("videoFramerate")).value;
    // set up movie capturer
    const capturer = new CCapture({
        format: format,
        framerate: framerate,
        name: 'trajectory',
        verbose: true,
        display: true,
        workersPath: 'ts/lib/'
    });

    function _load(e) {
        e.preventDefault(); // cancel default actions
        try {
            capturer.capture(canvas);
        } catch (e) {
            alert("Failed to capture video: \n"+e);
            capturer.stop();
            return;
        }
        nextConfig();
    }

    function _done() {
        document.removeEventListener('nextConfigLoaded', _load);
        capturer.stop();
        capturer.save();
        document.removeEventListener('finalConfig', _done);
        return;
    }

    document.addEventListener('nextConfigLoaded', _load);
    document.addEventListener('finalConfig', _done);

    capturer.start();
    nextConfig();

}

function toggleLut(chkBox) { //toggles display of coloring by json file / structure modeled off of base selector
    if (lutCols.length > 0) { //lutCols stores each nucleotide's color (determined by flexibility)
        if (lutColsVis) { //if "Display Alternate Colors" checkbox selected (currently displaying coloring) - does not actually get checkbox value; at onload of webpage is false and every time checkbox is changed, it switches boolean
            for (let i = 0; i < nucleotides.length; i++) { //for all nucleotides in all systems - does not work for more than one system
                let sysID = nucleotides[i].my_system;
                let back_Mesh: THREE.Mesh = <THREE.Mesh>nucleotides[i].visual_object.children[BACKBONE]; //backbone
                let nuc_Mesh: THREE.Mesh = <THREE.Mesh>nucleotides[i].visual_object.children[NUCLEOSIDE]; //nucleoside
                let con_Mesh: THREE.Mesh = <THREE.Mesh>nucleotides[i].visual_object.children[BB_NS_CON]; //backbone nucleoside connector
                let sp_Mesh: THREE.Mesh = <THREE.Mesh>nucleotides[i].visual_object.children[SP_CON]; //sugar phosphate connector

                back_Mesh.material = systems[sysID].strand_to_material(nucleotides[i].global_id);
                nuc_Mesh.material = systems[sysID].base_to_material(nucleotides[i].global_id);
                con_Mesh.material = systems[sysID].strand_to_material(nucleotides[i].global_id);
                if (nucleotides[i].visual_object[SP_CON]) sp_Mesh.material = systems[sysID].strand_to_material(nucleotides[i].global_id);
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
                        let tmesh: THREE.Mesh = <THREE.Mesh>nucleotides[i].visual_object.children[j];
                        tmesh.material = tmeshlamb;
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

function toggleBackground() {
    if (scene.background == WHITE) {
        scene.background = BLACK;
        render();
    }
    else {
        scene.background = WHITE;
        render();
    }
}

function cross(a1, a2, a3, b1, b2, b3) { //calculate cross product of 2 THREE.Vectors but takes coordinates as (x,y,z,x1,y1,z1)
    return [a2 * b3 - a3 * b2,
    a3 * b1 - a1 * b3,
    a1 * b2 - a2 * b1];
}
/*
function moveWithinBox(pos, dpos) {
    a = pos.x + dpos.x;
    b = (pos.x+1.5*box)%box - box/2 + dpos.x)
    return Math.abs(a) < Math.abs(b) ? a:b;
}
*/

// Calculate center of mass taking periodic boundary conditions into account:
// https://doi.org/10.1080/2151237X.2008.10129266
// https://en.wikipedia.org/wiki/Center_of_mass#Systems_with_periodic_boundary_conditions
function centerSystems() { //centers systems based on cms calculated for world (all systems)
/*
    //get center of mass for all systems
    let cms = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < nucleotides.length; i++) {
        let tmp_pos = new THREE.Vector3;
        tmp_pos.setFromMatrixPosition(nucleotides[i].visual_object.children[COM].matrixWorld);
        cms.add(tmp_pos);
    }
    let mul = 1.0 / nucleotides.length;
    cms.multiplyScalar(mul * -1);
*/
    // Create one averaging variable for each dimension, representing that 1D
    // interval as a unit circle in 2D (with the circumference being the 
    // bounding box side length)
    let cm_x = new THREE.Vector2(),
        cm_y = new THREE.Vector2(),
        cm_z = new THREE.Vector2();

    for (let i = 0; i < nucleotides.length; i++) { 
        let p = nucleotides[i].visual_object.children[COM].position.clone();
        // Shift coordinates so that the origin is in the corner of the 
        // bounding box, instead of the centre.
        p.add(new THREE.Vector3().addScalar(1.5*box));
        p.x %= box; p.y %= box; p.z %= box;
        
        // Calculate positions on unit circle for each dimension and that to the
        // sum.
        let angle = p.clone().multiplyScalar(2*Math.PI / box);
        cm_x.add(new THREE.Vector2(Math.cos(angle.x), Math.sin(angle.x)));
        cm_y.add(new THREE.Vector2(Math.cos(angle.y), Math.sin(angle.y)));
        cm_z.add(new THREE.Vector2(Math.cos(angle.z), Math.sin(angle.z)));
    }

    // Divide center of mass sums to get the averages
    cm_x.divideScalar(nucleotides.length);
    cm_y.divideScalar(nucleotides.length);
    cm_z.divideScalar(nucleotides.length);

    // Convert back from unit circle coordinates into x,y,z
    let cms = new THREE.Vector3(
        box/(2*Math.PI) * (Math.atan2(-cm_x.x, -cm_x.y) + Math.PI),
        box/(2*Math.PI) * (Math.atan2(-cm_y.x, -cm_y.y) + Math.PI),
        box/(2*Math.PI) * (Math.atan2(-cm_z.x, -cm_z.y) + Math.PI)
    );
    // Shift back origin to center of the box
    cms.sub(new THREE.Vector3().addScalar(box/2));

    // Change nucleotide positions by the center of mass
    for (let i = 0; i < nucleotides.length; i++) {
        for (let j = 0; j < nucleotides[i].visual_object.children.length; j++) {
/*
            nucleotides[i].visual_object.children[j].position.add(cms);
*/
            let p = nucleotides[i].visual_object.children[j].position;
            // Shift with centre of mass
            p.add(cms);
            // Keep positions within bounding box
            p.add(new THREE.Vector3().addScalar(1.5*box));
            p.x %= box; p.y %= box; p.z %= box;
            p.sub(new THREE.Vector3().addScalar(0.75*box));
        }
    }
    render();
}

//changes resolution on the nucleotide visual objects
function setResolution(resolution: number) {
    //change mesh_setup with the given resolution
    backbone_geometry = new THREE.SphereGeometry(.2,resolution,resolution);
    nucleoside_geometry = new THREE.SphereGeometry(.3,resolution,resolution).applyMatrix(
        new THREE.Matrix4().makeScale(0.7, 0.3, 0.7));
    connector_geometry = new THREE.CylinderGeometry(.1,.1,1, Math.max(2,resolution));

    //update all nucleotides and hide some meshes if resolution is low enough
    for (let i = 0; i < nucleotides.length; i++) {
        let nuc_group: THREE.Mesh[] = <THREE.Mesh[]>nucleotides[i].visual_object.children;

        nuc_group[BACKBONE].visible = resolution > 1;
        nuc_group[BACKBONE].geometry = backbone_geometry;

        nuc_group[NUCLEOSIDE].visible = resolution > 1;
        nuc_group[NUCLEOSIDE].geometry = nucleoside_geometry;

        if(nuc_group[BB_NS_CON]) {
            nuc_group[BB_NS_CON].geometry = connector_geometry;
            nuc_group[BB_NS_CON].visible = resolution > 1;
        }
        if(nuc_group[SP_CON]) {
            nuc_group[SP_CON].geometry = connector_geometry;
        }
    }
    render();
}

function toggleSideNav(button: HTMLInputElement) {
    let hidden =  "show";
    let visible = "hide";
    let tabcontent = <HTMLCollectionOf<HTMLElement>>document.getElementsByClassName("tabcontent");
    let allNone = false;
    if (button.innerText == hidden) {
        tabcontent[0].style.display = "block";
        console.log("All was hidden, so we revealed");
        button.innerHTML = visible;
    } else {
        for (let i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }
        button.innerHTML = hidden;
    }
}

//strand delete testcode
document.addEventListener("keypress", event => {
    if (event.keyCode === 100) { //if d is pressed, delete first system's first strand
        systems[0].remove_strand(1);
        render();
    }
});