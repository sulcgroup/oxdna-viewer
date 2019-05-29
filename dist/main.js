/// <reference path="./three/index.d.ts" />
var BACKBONE = 0;
var NUCLEOSIDE = 1;
var BB_NS_CON = 2;
var COM = 3;
var SP_CON = 4;
render();
// elements store the information about position, orientation, ID
// Eventually there should be a way to pair them
// Everything is an Object3D, but only elements have anything to render
class BasicElement {
    constructor(global_id, parent) {
        this.global_id = global_id;
        this.parent = parent;
    }
    ;
}
;
class DNANucleotide extends BasicElement {
    constructor(global_id, parent) {
        super(global_id, parent);
    }
    ;
}
;
class RNANucleotide extends BasicElement {
    constructor(global_id, parent) {
        super(global_id, parent);
    }
    ;
}
;
class AminoAcid extends BasicElement {
    constructor(global_id, parent) {
        super(global_id, parent);
    }
    ;
}
;
// strands are made up of elements
// strands have an ID within the system
class Strand {
    constructor(id, parent) {
        this.elements = [];
        this.strand_id = id;
        this.parent = parent;
        this.strand_3objects = new THREE.Group;
    }
    ;
    add_basicElement(elem) {
        this.elements.push(elem);
        elem.parent = this;
    }
    ;
    remove_basicElement(to_remove) {
        for (let i = 0; i < this.elements.length; i++) {
            let n = this.elements[i];
            if (n.global_id == to_remove) { //changed from local to global id
                scene.remove(n.visual_object);
                n = null;
            }
        }
    }
    ;
}
;
class NucleicAcidStrand extends Strand {
    constructor(id, parent) {
        super(id, parent);
    }
    ;
    create_basicElement(global_id) {
        if (RNA_MODE)
            return new RNANucleotide(global_id, this);
        else
            return new DNANucleotide(global_id, this);
    }
    ;
}
class Peptide extends Strand {
    constructor(id, parent) {
        super(id, parent);
    }
    ;
    create_basicElement(global_id) {
        return new AminoAcid(global_id, this);
    }
}
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
            count += this.strands[i].elements.length;
        }
        return count;
    }
    ;
    create_Strand(str_id) {
        if (str_id < 0)
            return new Peptide(str_id, this);
        else
            return new NucleicAcidStrand(str_id, this);
    }
    ;
    add_strand(strand) {
        this.strands.push(strand);
    }
    ;
    remove_strand(to_remove) {
        for (let i = 0; i < this.strands.length; i++) {
            let s = this.strands[i];
            if (s.strand_id == to_remove) {
                this.system_3objects.remove(s.strand_3objects);
                for (let j = 0; j < s.elements.length; j++) {
                    s.strand_3objects.remove(s.elements[j].visual_object);
                    s.remove_basicElement(j);
                }
                scene.remove(s.strand_3objects);
                s = null;
            }
            ;
            render();
        }
    }
    ;
    strand_to_material(strandIndex) {
        return backbone_materials[strandIndex % backbone_materials.length];
    }
    ;
    elem_to_material(elem) {
        if (typeof elem == "string") {
            elem = { "A": 0, "G": 1, "C": 2, "T": 3, "U": 3 }[elem];
        }
        return nucleoside_materials[elem];
    }
    ;
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
var elements = []; //contains references to all BasicElements
//initialize the space
var systems = [];
let sys_count = 0;
let strand_count = 0;
let nuc_count = 0;
//var selected_bases: number[] = [];
var selected_bases = new Set();
var backbones = [];
let lut, devs; //need for Lut coloring
let lutCols = [];
let lutColsVis = false;
function updatePos() {
    for (let h = 0; h < systems.length; h++) { //for current system
        let syscms = new THREE.Vector3(0, 0, 0); //system cms
        let n = systems[h].system_length(); //# of BasicElements in system
        for (let i = 0; i < systems[h].strands.length; i++) { //for each strand
            let n1 = systems[h].strands[i].elements.length; //for strand_3objects in system_3objects
            console.log("strand length: " + n1);
            let strandcms = new THREE.Vector3(0, 0, 0); //strand cms
            for (let j = 0; j < n1; j++) { //for each visual_object
                let nucobj = systems[h].strands[i].elements[j].visual_object; //current nuc's visual_object
                let objcms = new THREE.Vector3(); //group cms
                //sum cms of all visual_object in each system, strand, and itself
                let tempposition = nucobj.children[3].position.clone();
                objcms = tempposition; // nucobj.children[3].position; //nucobj cms
                strandcms.add(tempposition); //nucobj.children[3].position); //strand cms
                syscms.add(tempposition); //nucobj.children[3].position); //system cms
                systems[h].strands[i].elements[j].pos = objcms.clone(); // set nucleotide object position to objcms
                //elements[systems[h].strands[i].elements[j].global_id].pos = objcms.clone();
            }
            //calculate strand cms
            let mul = 1.0 / n1;
            strandcms.multiplyScalar(mul);
            systems[h].strands[i].pos = strandcms.clone(); //set strand object position to strand cms
        }
        //calculate system cms
        let mul = 1.0 / n;
        syscms.multiplyScalar(mul);
        systems[h].pos = syscms.clone(); //set system object position to system cms
    }
}
function nextConfig() {
    if (next_reader.readyState == 1) { //0: nothing loaded 1: working 2: done
        return;
    }
    getNewConfig(1);
    let centering_on = document.getElementById("centering").checked;
    if (centering_on) {
        centerSystems();
    }
}
function previousConfig() {
    if (previous_previous_reader.readyState == 1) {
        return;
    }
    getNewConfig(-1);
    let centering_on = document.getElementById("centering").checked;
    if (centering_on) {
        centerSystems();
    }
}
document.addEventListener("keydown", function (event) {
    switch (event.key) {
        case 'n':
            nextConfig();
            break;
        case 'b':
            previousConfig();
            break;
    }
}, true);
function toggleVideoOptions() {
    let opt = document.getElementById("videoOptions");
    opt.hidden = !opt.hidden;
}
function toggleColorOptions() {
    let opt = document.getElementById("colorOptions");
    opt.hidden = !opt.hidden;
    if (!opt.hidden) {
        opt.innerHTML = ""; //Clear content
        for (let i = 0; i < backbone_materials.length; i++) {
            let m = backbone_materials[i];
            let c = document.createElement('input');
            c.type = 'color';
            c.value = "#" + m.color.getHexString();
            c.oninput = function () {
                backbone_materials[i].color = new THREE.Color(c.value);
                render();
            };
            c.oncontextmenu = function (event) {
                event.preventDefault();
                opt.removeChild(c);
                backbone_materials.splice(i, 1);
                return false;
            };
            opt.appendChild(c);
        }
        let addButton = document.createElement('button');
        addButton.innerText = "Add color";
        addButton.onclick = function () {
            backbone_materials.push(new THREE.MeshLambertMaterial({
                color: 0x156289,
                side: THREE.DoubleSide
            }));
            let index = 0;
            for (; index < elements.length; index++) {
                let nuc = elements[index];
                let back_Mesh = elements[index].visual_object.children[BACKBONE]; //get clicked nucleotide's Meshes
                let con_Mesh = elements[index].visual_object.children[BB_NS_CON];
                let sp_Mesh = elements[index].visual_object.children[SP_CON];
                //recalculate Mesh's proper coloring and set Mesh material on scene to proper material
                if (back_Mesh instanceof THREE.Mesh) { //necessary for proper typing
                    if (back_Mesh.material instanceof THREE.MeshLambertMaterial) {
                        back_Mesh.material = nuc.parent.parent.strand_to_material(nuc.parent.strand_id);
                    }
                }
                if (con_Mesh instanceof THREE.Mesh) {
                    if (con_Mesh.material instanceof THREE.MeshLambertMaterial) {
                        con_Mesh.material = nuc.parent.parent.strand_to_material(nuc.parent.strand_id);
                    }
                }
                if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
                    if (sp_Mesh.material instanceof THREE.MeshLambertMaterial) {
                        sp_Mesh.material = nuc.parent.parent.strand_to_material(nuc.parent.strand_id);
                    }
                }
            }
            render();
            opt.hidden = true;
            toggleColorOptions();
        };
        opt.appendChild(addButton);
    }
}
function updateColor(colorPicker) {
}
function createVideo() {
    // Get canvas
    let canvas = document.getElementById("threeCanvas");
    // Get options:
    let format = document.querySelector('input[name="videoFormat"]:checked').value;
    let framerate = document.getElementById("videoFramerate").value;
    let videoType = document.getElementById("videoType");
    // Set up movie capturer
    const capturer = new CCapture({
        format: format,
        framerate: framerate,
        name: videoType.value,
        verbose: true,
        display: true,
        workersPath: 'ts/lib/'
    });
    try {
        switch (videoType.value) {
            case "trajectory":
                createTrajectoryVideo(canvas, capturer);
                break;
            case "lemniscate":
                createLemniscateVideo(canvas, capturer, framerate);
                break;
        }
    }
    catch (e) {
        alert("Failed to capture video: \n" + e);
        capturer.stop();
    }
}
function createTrajectoryVideo(canvas, capturer) {
    // Listen for configuration loaded events
    function _load(e) {
        e.preventDefault(); // cancel default actions
        capturer.capture(canvas);
        nextConfig();
    }
    // Listen for last configuration event
    function _done(e) {
        document.removeEventListener('nextConfigLoaded', _load);
        document.removeEventListener('finalConfig', _done);
        capturer.stop();
        capturer.save();
        return;
    }
    document.addEventListener('nextConfigLoaded', _load);
    document.addEventListener('finalConfig', _done);
    // Start capturing
    capturer.start();
    nextConfig();
}
function createLemniscateVideo(canvas, capturer, framerate) {
    // Setup timing
    let duration = 10; //Seconds
    let tMax = 2 * Math.PI;
    let nFrames = duration * framerate;
    let dt = tMax / nFrames;
    // Preserve camera distance from origin:
    let d = Origin.distanceTo(camera.position);
    capturer.start();
    // Move camera and capture frames
    // This is not a for-loop since we need to use
    // requestAnimationFrame recursively.
    let t = 0;
    var animate = function () {
        if (t >= tMax) {
            capturer.stop();
            capturer.save();
            return;
        }
        requestAnimationFrame(animate);
        camera.position.set(d * Math.cos(t), d * Math.sin(t) * Math.cos(t), d * Math.sqrt(Math.pow(Math.sin(t), 4)));
        camera.lookAt(Origin);
        t += dt;
        render();
        capturer.capture(canvas);
    };
    animate();
}
function toggleLut(chkBox) {
    if (lutCols.length > 0) { //lutCols stores each nucleotide's color (determined by flexibility)
        if (lutColsVis) { //if "Display Alternate Colors" checkbox selected (currently displaying coloring) - does not actually get checkbox value; at onload of webpage is false and every time checkbox is changed, it switches boolean
            for (let i = 0; i < elements.length; i++) { //for all elements in all systems - does not work for more than one system
                let sysID = elements[i].parent.parent.system_id;
                let back_Mesh = elements[i].visual_object.children[BACKBONE]; //backbone
                let nuc_Mesh = elements[i].visual_object.children[NUCLEOSIDE]; //nucleoside
                let con_Mesh = elements[i].visual_object.children[BB_NS_CON]; //backbone nucleoside connector
                let sp_Mesh = elements[i].visual_object.children[SP_CON]; //sugar phosphate connector
                back_Mesh.material = systems[sysID].strand_to_material(elements[i].global_id);
                nuc_Mesh.material = systems[sysID].elem_to_material(elements[i].global_id);
                con_Mesh.material = systems[sysID].strand_to_material(elements[i].global_id);
                if (elements[i].visual_object[SP_CON])
                    sp_Mesh.material = systems[sysID].strand_to_material(elements[i].global_id);
            }
            lutColsVis = false; //now flexibility coloring is not being displayed and checkbox is not selected
        }
        else {
            for (let i = 0; i < elements.length; i++) { //for each nucleotide in all systems - does not work for multiple systems yet
                let tmeshlamb = new THREE.MeshLambertMaterial({
                    color: lutCols[i],
                    side: THREE.DoubleSide
                });
                for (let j = 0; j < elements[i].visual_object.children.length; j++) { //for each Mesh in each nucleotide's visual_object
                    if (j != 3) { //for all except cms posObj Mesh
                        let tmesh = elements[i].visual_object.children[j];
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
function centerSystems() {
    /*
        //get center of mass for all systems
        let cms = new THREE.Vector3(0, 0, 0);
        for (let i = 0; i < elements.length; i++) {
            let tmp_pos = new THREE.Vector3;
            tmp_pos.setFromMatrixPosition(elements[i].visual_object.children[COM].matrixWorld);
            cms.add(tmp_pos);
        }
        let mul = 1.0 / elements.length;
        cms.multiplyScalar(mul * -1);
    */
    // Create one averaging variable for each dimension, representing that 1D
    // interval as a unit circle in 2D (with the circumference being the 
    // bounding box side length)
    let cm_x = new THREE.Vector2(), cm_y = new THREE.Vector2(), cm_z = new THREE.Vector2();
    for (let i = 0; i < elements.length; i++) {
        let p = elements[i].visual_object.children[COM].position.clone();
        // Shift coordinates so that the origin is in the corner of the 
        // bounding box, instead of the centre.
        p.add(new THREE.Vector3().addScalar(1.5 * box));
        p.x %= box;
        p.y %= box;
        p.z %= box;
        // Calculate positions on unit circle for each dimension and that to the
        // sum.
        let angle = p.clone().multiplyScalar(2 * Math.PI / box);
        cm_x.add(new THREE.Vector2(Math.cos(angle.x), Math.sin(angle.x)));
        cm_y.add(new THREE.Vector2(Math.cos(angle.y), Math.sin(angle.y)));
        cm_z.add(new THREE.Vector2(Math.cos(angle.z), Math.sin(angle.z)));
    }
    // Divide center of mass sums to get the averages
    cm_x.divideScalar(elements.length);
    cm_y.divideScalar(elements.length);
    cm_z.divideScalar(elements.length);
    // Convert back from unit circle coordinates into x,y,z
    let cms = new THREE.Vector3(box / (2 * Math.PI) * (Math.atan2(-cm_x.x, -cm_x.y) + Math.PI), box / (2 * Math.PI) * (Math.atan2(-cm_y.x, -cm_y.y) + Math.PI), box / (2 * Math.PI) * (Math.atan2(-cm_z.x, -cm_z.y) + Math.PI));
    // Shift back origin to center of the box
    cms.sub(new THREE.Vector3().addScalar(box / 2));
    // Change nucleotide positions by the center of mass
    for (let i = 0; i < elements.length; i++) {
        for (let j = 0; j < elements[i].visual_object.children.length; j++) {
            /*
                        elements[i].visual_object.children[j].position.add(cms);
            */
            let p = elements[i].visual_object.children[j].position;
            // Shift with centre of mass
            p.add(cms);
            // Keep positions within bounding box
            p.add(new THREE.Vector3().addScalar(1.5 * box));
            p.x %= box;
            p.y %= box;
            p.z %= box;
            p.sub(new THREE.Vector3().addScalar(0.75 * box));
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
    //update all elements and hide some meshes if resolution is low enough
    for (let i = 0; i < elements.length; i++) {
        let nuc_group = elements[i].visual_object.children;
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
