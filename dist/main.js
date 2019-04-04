/// <reference path="./three/index.d.ts" />
var BACKBONE = 0;
var NUCLEOSIDE = 1;
var BB_NS_CON = 2;
var COM = 3;
var SP_CON = 4;
render();
// nucleotides store the information about position, orientation, ID
// Eventually there should be a way to pair them
// Everything is an Object3D, but only nucleotides have anything to render
class Nucleotide {
    constructor(global_id, parent_system) {
        this.global_id = global_id;
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
        this.strand_to_material = {};
        this.base_to_material = {};
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
    setStrandMaterial(strand_to_material) {
        this.strand_to_material = strand_to_material;
    }
    setBaseMaterial(base_to_material) {
        this.base_to_material = base_to_material;
    }
    setDatFile(dat_file) {
        this.dat_file = dat_file;
    }
}
;
function dat_loader(file) {
}
// store rendering mode RNA  
let RNA_MODE = false; // By default we do DNA base spacing
// add base index visualistion
var nucleotides = []; //contains references to all nucleotides
//var selected_bases = {};
//initialize the space
var systems = [];
let sys_count = 0;
let strand_count = 0;
let nuc_count = 0;
var selected_bases = [];
var backbones = [];
let lut, devs; //need for Lut coloring
let lutCols = [];
let lutColsVis = false;
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
    getNewConfig(1);
    let centering_on = document.getElementById("centering").checked;
    if (centering_on) {
        centerSystems();
    }
}
function previousConfig() {
    getNewConfig(-1);
    let centering_on = document.getElementById("centering").checked;
    if (centering_on) {
        centerSystems();
    }
}
function toggleLut(chkBox) {
    if (lutCols.length > 0) { //lutCols stores each nucleotide's color (determined by flexibility)
        if (lutColsVis) { //if "Display Alternate Colors" checkbox selected (currently displaying coloring) - does not actually get checkbox value; at onload of webpage is false and every time checkbox is changed, it switches boolean
            for (let i = 0; i < nucleotides.length; i++) { //for all nucleotides in all systems - does not work for more than one system
                let sysID = nucleotides[i].my_system;
                let back_Mesh = nucleotides[i].visual_object.children[BACKBONE]; //backbone
                let nuc_Mesh = nucleotides[i].visual_object.children[NUCLEOSIDE]; //nucleoside
                let con_Mesh = nucleotides[i].visual_object.children[BB_NS_CON]; //backbone nucleoside connector
                let sp_Mesh = nucleotides[i].visual_object.children[SP_CON]; //sugar phosphate connector
                back_Mesh.material = systems[sysID].strand_to_material[nucleotides[i].global_id];
                nuc_Mesh.material = systems[sysID].base_to_material[nucleotides[i].global_id];
                con_Mesh.material = systems[sysID].strand_to_material[nucleotides[i].global_id];
                if (nucleotides[i].visual_object[SP_CON])
                    sp_Mesh.material = systems[sysID].strand_to_material[nucleotides[i].global_id];
            }
            lutColsVis = false; //now flexibility coloring is not being displayed and checkbox is not selected
        }
        else {
            for (let i = 0; i < nucleotides.length; i++) { //for each nucleotide in all systems - does not work for multiple systems yet
                let tmeshlamb = new THREE.MeshLambertMaterial({
                    color: lutCols[i],
                    side: THREE.DoubleSide
                });
                for (let j = 0; j < nucleotides[i].visual_object.children.length; j++) { //for each Mesh in each nucleotide's visual_object
                    if (j != 3) { //for all except cms posObj Mesh
                        let tmesh = nucleotides[i].visual_object.children[j];
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
function cross(a1, a2, a3, b1, b2, b3) {
    return [a2 * b3 - a3 * b2,
        a3 * b1 - a1 * b3,
        a1 * b2 - a2 * b1];
}
function centerSystems() {
    //get center of mass for all systems
    let cms = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < nucleotides.length; i++) {
        let tmp_pos = new THREE.Vector3;
        tmp_pos.setFromMatrixPosition(nucleotides[i].visual_object.children[COM].matrixWorld);
        cms.add(tmp_pos);
    }
    let mul = 1.0 / nucleotides.length;
    cms.multiplyScalar(mul * -1);
    //change position by the center of mass
    for (let i = 0; i < nucleotides.length; i++) {
        for (let j = 0; j < nucleotides[i].visual_object.children.length; j++) {
            nucleotides[i].visual_object.children[j].position.add(cms);
        }
    }
    render();
}
//changes resolution on the nucleotide visual objects
function setResolution(resolution) {
    //change mesh_setup with the given resolution
    backbone_geometry = new THREE.SphereGeometry(.2, resolution, resolution);
    nucleoside_geometry = new THREE.SphereGeometry(.3, resolution, resolution).applyMatrix(new THREE.Matrix4().makeScale(0.7, 0.3, 0.7));
    connector_geometry = new THREE.CylinderGeometry(.1, .1, 1, Math.max(2, resolution));
    //update all nucleotides and hide some meshes if resolution is low enough
    for (let i = 0; i < nucleotides.length; i++) {
        let nuc_group = nucleotides[i].visual_object.children;
        nuc_group[BACKBONE].visible = resolution > 1;
        nuc_group[BACKBONE].geometry = backbone_geometry;
        nuc_group[NUCLEOSIDE].visible = resolution > 1;
        nuc_group[NUCLEOSIDE].geometry = nucleoside_geometry;
        if (nuc_group[BB_NS_CON]) {
            nuc_group[BB_NS_CON].geometry = connector_geometry;
            nuc_group[BB_NS_CON].visible = resolution > 1;
        }
        if (nuc_group[SP_CON]) {
            nuc_group[SP_CON].geometry = connector_geometry;
        }
    }
    render();
}
function toggleSideNav(button) {
    let hidden = "show";
    let visible = "hide";
    let tabcontent = document.getElementsByClassName("tabcontent");
    let allNone = false;
    if (button.innerText == hidden) {
        tabcontent[0].style.display = "block";
        console.log("All was hidden, so we revealed");
        button.innerHTML = visible;
    }
    else {
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
