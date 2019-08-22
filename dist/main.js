/// <reference path="./three/index.d.ts" />
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
let DNA = 0;
let RNA = 1;
let AA = 2;
var strands = 'children', monomers = 'children', objects = 'children';
render();
// elements store the information about position, orientation, ID
// Eventually there should be a way to pair them
// Everything is an Object3D, but only elements have anything to render
class BasicElement extends THREE.Group {
    constructor(global_id, parent) {
        super();
        //: THREE.Group; //contains 4 THREE.Mesh
        //BACKBONE: number = 0;
        this.NUCLEOSIDE = 0;
        this.BB_NS_CON = 1;
        this.COM = 2;
        //SP_CON: number = 3;
        this.element_type = -1;
        this.global_id = global_id;
        this.parent = parent;
    }
    ;
    calculatePositions(x, y, z, l) {
    }
    ;
    recalcPos() {
    }
    ;
    calculateNewConfigPositions(x, y, z, l) {
    }
    ;
    updateSP(num) {
        return new THREE.Object3D();
    }
    ;
    getCOM() {
        return this.COM;
    }
    ;
    //abstract rotate(): void;
    toggle() {
    }
    ;
    strand_to_material(strandIndex) {
        return backbone_materials[(Math.abs(strandIndex) + this.parent.parent.system_id) % backbone_materials.length];
    }
    ;
    elem_to_material(type) {
        return new THREE.MeshLambertMaterial();
    }
    ;
    getDatFileOutput() {
        return "";
    }
    ;
    resetColor(nucNec) {
    }
    ;
    translate_monomer(amount) {
        this[objects].forEach((o) => {
            o.position.add(amount);
        });
    }
}
;
class Nucleotide extends BasicElement {
    constructor(global_id, parent) {
        super(global_id, parent);
    }
    ;
    calculatePositions(x, y, z, l) {
        // extract axis vector a1 (backbone vector) and a3 (stacking vector) 
        let x_a1 = parseFloat(l[3]), y_a1 = parseFloat(l[4]), z_a1 = parseFloat(l[5]), x_a3 = parseFloat(l[6]), y_a3 = parseFloat(l[7]), z_a3 = parseFloat(l[8]);
        // according to base.py a2 is the cross of a1 and a3
        let [x_a2, y_a2, z_a2] = cross(x_a1, y_a1, z_a1, x_a3, y_a3, z_a3);
        // compute backbone cm
        let x_bb = 0;
        let y_bb = 0;
        let z_bb = 0;
        let bbpos = this.calcBBPos(x, y, z, x_a1, y_a1, z_a1, x_a2, y_a2, z_a2, x_a3, y_a3, z_a3);
        x_bb = bbpos.x;
        y_bb = bbpos.y;
        z_bb = bbpos.z;
        bb_offsets[this.global_id * 3] = x_bb;
        bb_offsets[this.global_id * 3 + 1] = y_bb;
        bb_offsets[this.global_id * 3 + 2] = z_bb;
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
        // adds a new "backbone", new "nucleoside", and new "connector" to the scene by adding to  then to strand_3objects then to system_3objects then to scene
        this.name = this.global_id + ""; //set name (string) to nucleotide's global id
        let nucleoside, con;
        // 4 Mesh to display DNA + 1 Mesh to store  group's center of mass as its position
        //make material depending on whether there is an alternate color scheme available
        var material;
        if (lutColsVis) {
            material = new THREE.MeshLambertMaterial({
                color: lutCols[i],
                side: THREE.DoubleSide
            });
        }
        else {
            material = this.strand_to_material(this.parent.strand_id);
        }
        colors[this.global_id * 3] = material.color.r;
        colors[this.global_id * 3 + 1] = material.color.g;
        colors[this.global_id * 3 + 2] = material.color.b;
        scales[this.global_id] = 1;
        //sphere - sugar phosphate backbone
        nucleoside = new THREE.Mesh(nucleoside_geometry, this.elem_to_material(this.type)); //sphere - nucleotide
        con = new THREE.Mesh(connector_geometry, material); //cyclinder - backbone and nucleoside connector
        let posObj = new THREE.Mesh; //Mesh (no shape) storing  group center of mass  
        con.applyMatrix(new THREE.Matrix4().makeScale(1.0, con_len, 1.0));
        // apply rotations
        nucleoside.applyMatrix(base_rotation);
        con.applyMatrix(rotation_con);
        //set positions and add to object (group - )
        //backbone.position.set(x_bb, y_bb, z_bb);
        nucleoside.position.set(x_ns, y_ns, z_ns);
        con.position.set(x_con, y_con, z_con);
        posObj.position.set(x, y, z);
        //this.add(backbone);
        this.add(nucleoside);
        this.add(con);
        this.add(posObj);
        //last, add the sugar-phosphate bond since its not done for the first nucleotide in each strand
        if (this.neighbor3 != null && this.neighbor3.local_id < this.local_id) {
            let x_sp = (x_bb + x_bb_last) / 2, //sugar phospate position in center of both current and last sugar phosphates
            y_sp = (y_bb + y_bb_last) / 2, z_sp = (z_bb + z_bb_last) / 2;
            let sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
            // easy periodic boundary condition fix  
            // if the bonds are to long just don't add them 
            if (sp_len <= 500) {
                let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize()));
                let sp = new THREE.Mesh(connector_geometry, material); //cylinder - sugar phosphate connector
                sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //set length according to distance between current and last sugar phosphate
                sp.applyMatrix(rotation_sp); //set rotation
                sp.position.set(x_sp, y_sp, z_sp);
                this.add(sp); //add to visual_object
            }
        }
        /*if (this.neighbor5 != null && this.neighbor5.local_id < this.local_id) { //handles strand end connection
            let x_sp = (x_bb + this.neighbor5.visual_object.children[this.BACKBONE].position.x) / 2, //make sugar phosphate connection
                y_sp = (y_bb + this.neighbor5.visual_object.children[this.BACKBONE].position.y) / 2,
                z_sp = (z_bb + this.neighbor5.visual_object.children[this.BACKBONE].position.z) / 2;
            let sp_len = Math.sqrt(Math.pow(x_bb - this.neighbor5.visual_object.children[this.BACKBONE].position.x, 2) + Math.pow(y_bb - this.neighbor5.visual_object.children[this.BACKBONE].position.y, 2) + Math.pow(z_bb - this.neighbor5.visual_object.children[this.BACKBONE].position.z, 2));
            let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(
                new THREE.Quaternion().setFromUnitVectors(
                    new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize()
                )
            );
            let sp = new THREE.Mesh(connector_geometry, material); //cylinder - sugar phosphate connector
            sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //set length according to distance between current and last sugar phosphate
            sp.applyMatrix(rotation_sp); //set rotation
            sp.position.set(x_sp, y_sp, z_sp);
            group.add(sp); //add to visual_object
        }*/
        //actually add the new items to the scene by adding to visual_object then to strand_3objects then to system_3objects then to scene
        //update last backbone position and last strand
        x_bb_last = x_bb;
        y_bb_last = y_bb;
        z_bb_last = z_bb;
    }
    ;
    recalcPos() {
        let bb = this.children[this.BACKBONE].position;
        if (this.neighbor3 != null && this.neighbor3.local_id > this.local_id) { //handles strand end connection
            let material;
            if (lutColsVis) {
                material = new THREE.MeshLambertMaterial({
                    color: lutCols[i],
                    side: THREE.DoubleSide
                });
            }
            else {
                material = this.strand_to_material(this.parent.strand_id);
            }
            let x_sp = (bb.x + this.neighbor3.children[this.BACKBONE].position.x) / 2, //make sugar phosphate connection
            y_sp = (bb.y + this.neighbor3.children[this.BACKBONE].position.y) / 2, z_sp = (bb.z + this.neighbor3.children[this.BACKBONE].position.z) / 2;
            let sp_len = Math.sqrt(Math.pow(bb.x - this.neighbor3.children[this.BACKBONE].position.x, 2) + Math.pow(bb.y - this.neighbor3.children[this.BACKBONE].position.y, 2) + Math.pow(bb.z - this.neighbor3.children[this.BACKBONE].position.z, 2));
            let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - bb.x, y_sp - bb.y, z_sp - bb.z).normalize()));
            let sp = new THREE.Mesh(connector_geometry, material); //cylinder - sugar phosphate connector
            sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //set length according to distance between current and last sugar phosphate
            sp.applyMatrix(rotation_sp); //set rotation
            sp.position.set(x_sp, y_sp, z_sp);
            this.add(sp); //add to visual_object
        }
    }
    calcBBPos(x, y, z, x_a1, y_a1, z_a1, x_a2, y_a2, z_a2, x_a3, y_a3, z_a3) {
        return new THREE.Vector3(x, y, z);
    }
    ;
    calculateNewConfigPositions(x, y, z, l) {
        // extract axis vector a1 (backbone vector) and a3 (stacking vector) 
        let x_a1 = parseFloat(l[3]), y_a1 = parseFloat(l[4]), z_a1 = parseFloat(l[5]), x_a3 = parseFloat(l[6]), y_a3 = parseFloat(l[7]), z_a3 = parseFloat(l[8]);
        // according to base.py a2 is the cross of a1 and a3
        let [x_a2, y_a2, z_a2] = cross(x_a1, y_a1, z_a1, x_a3, y_a3, z_a3);
        // compute backbone cm
        let x_bb = 0;
        let y_bb = 0;
        let z_bb = 0;
        let bbpos = this.calcBBPos(x, y, z, x_a1, y_a1, z_a1, x_a2, y_a2, z_a2, x_a3, y_a3, z_a3);
        x_bb = bbpos.x;
        y_bb = bbpos.y;
        z_bb = bbpos.z;
        // compute nucleoside cm
        let x_ns = x + 0.4 * x_a1, y_ns = y + 0.4 * y_a1, z_ns = z + 0.4 * z_a1;
        //compute connector position
        let x_con = (x_bb + x_ns) / 2, y_con = (y_bb + y_ns) / 2, z_con = (z_bb + z_ns) / 2;
        //correctly display stacking interactions
        let old_a3 = new THREE.Matrix4();
        old_a3.extractRotation(this[objects][this.NUCLEOSIDE].matrix);
        let base_rotation = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(old_a3.elements[4], old_a3.elements[5], old_a3.elements[6]), new THREE.Vector3(x_a3, y_a3, z_a3)));
        // correctly orient connectors
        let neg_NS_pos = this[objects][this.NUCLEOSIDE].position.multiplyScalar(-1);
        let curr_heading = this[objects][this.BACKBONE].position.add(neg_NS_pos);
        let rotation_con = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(curr_heading.normalize(), new THREE.Vector3(x_bb - x_ns, y_bb - y_ns, z_bb - z_ns).normalize()));
        // update position and orientation of the elements
        let group = this;
        let locstrandID = this.parent.strand_id;
        group.name = this.global_id + "";
        //set new positions/rotations for the meshes.  Don't need to create new meshes since they exist.
        //if you position.set() before applyMatrix() everything explodes because its messing with the world matrix.
        group[objects][this.BACKBONE].position.set(x_bb, y_bb, z_bb);
        group[objects][this.NUCLEOSIDE].applyMatrix(base_rotation);
        group[objects][this.NUCLEOSIDE].position.set(x_ns, y_ns, z_ns);
        //not going to change the BB_NS_CON length because its the same out to 7 decimal places each time
        group[objects][this.BB_NS_CON].applyMatrix(rotation_con);
        group[objects][this.BB_NS_CON].position.set(x_con, y_con, z_con);
        group[objects][this.COM].position.set(x, y, z);
        //last, add the sugar-phosphate bond since its not done for the first nucleotide in each strand
        if (this.neighbor3 != null) {
            //get current and 3' backbone positions and set length/rotation
            let last_pos = new THREE.Vector3();
            this.neighbor3[objects][this.BACKBONE].getWorldPosition(last_pos);
            let this_pos = new THREE.Vector3();
            group[objects][this.BACKBONE].getWorldPosition(this_pos);
            let x_sp = (this_pos.x + last_pos.x) / 2, y_sp = (this_pos.y + last_pos.y) / 2, z_sp = (this_pos.z + last_pos.z) / 2;
            let sp_len = Math.sqrt(Math.pow(this_pos.x - last_pos.x, 2) + Math.pow(this_pos.y - last_pos.y, 2) + Math.pow(this_pos.z - last_pos.z, 2));
            let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(this_pos.x - last_pos.x, this_pos.y - last_pos.y, this_pos.z - last_pos.z).normalize()));
            this.updateSP();
            group[objects][this.SP_CON].applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //length
            group[objects][this.SP_CON].applyMatrix(rotation_sp); //rotate
            group[objects][this.SP_CON].position.set(x_sp, y_sp, z_sp); //set position
            group[objects][this.SP_CON].parent = this;
        }
        ;
    }
    ;
    updateSP() {
        let sp_Mesh = this[objects][this.SP_CON];
        if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
            if (sp_Mesh.material instanceof THREE.MeshLambertMaterial) {
                sp_Mesh.material = this.strand_to_material(this.parent.strand_id);
            }
            let geo = sp_Mesh.geometry;
            geo = connector_geometry;
            sp_Mesh.drawMode = THREE.TrianglesDrawMode;
            sp_Mesh.updateMorphTargets();
            sp_Mesh.up = THREE.Object3D.DefaultUp.clone();
            sp_Mesh.position.set(0, 0, 0);
            sp_Mesh.rotation.set(0, 0, 0);
            sp_Mesh.quaternion.set(0, 0, 0, 0);
            sp_Mesh.scale.set(1, 1, 1);
            sp_Mesh.matrix.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
            sp_Mesh.matrixWorld.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
            sp_Mesh.matrixAutoUpdate = THREE.Object3D.DefaultMatrixAutoUpdate;
            sp_Mesh.matrixWorldNeedsUpdate = false;
            sp_Mesh.visible = true;
            sp_Mesh.castShadow = false;
            sp_Mesh.receiveShadow = false;
            sp_Mesh.frustumCulled = true;
            sp_Mesh.renderOrder = 0;
            sp_Mesh.userData = {};
        }
        return sp_Mesh;
    }
    getCOM() {
        return this.COM;
    }
    ;
    resetColor(nucNec) {
        let back_Mesh = this[objects][this.BACKBONE]; //get clicked nucleotide's Meshes
        let nuc_Mesh = this[objects][this.NUCLEOSIDE];
        let con_Mesh = this[objects][this.BB_NS_CON];
        let sp_Mesh = this[objects][this.SP_CON];
        // figure out what that base was before you painted it black and revert it
        //recalculate Mesh's proper coloring and set Mesh material on scene to proper material
        let tmeshlamb;
        if (lutColsVis) {
            tmeshlamb = new THREE.MeshLambertMaterial({
                color: lutCols[this.global_id],
                side: THREE.DoubleSide
            });
        }
        if (back_Mesh instanceof THREE.Mesh) { //necessary for proper typing
            if (back_Mesh.material instanceof THREE.MeshLambertMaterial) {
                if (lutColsVis)
                    back_Mesh.material = tmeshlamb;
                else
                    back_Mesh.material = this.strand_to_material(this.parent.strand_id);
            }
        }
        if (nucNec) {
            if (nuc_Mesh instanceof THREE.Mesh) {
                if (nuc_Mesh.material instanceof THREE.MeshLambertMaterial) {
                    if (lutColsVis)
                        nuc_Mesh.material = tmeshlamb;
                    else
                        nuc_Mesh.material = this.elem_to_material(this.type);
                }
            }
        }
        if (con_Mesh instanceof THREE.Mesh) {
            if (con_Mesh.material instanceof THREE.MeshLambertMaterial) {
                if (lutColsVis)
                    con_Mesh.material = tmeshlamb;
                else
                    con_Mesh.material = this.strand_to_material(this.parent.strand_id);
            }
        }
        if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
            if (sp_Mesh.material instanceof THREE.MeshLambertMaterial) {
                if (lutColsVis)
                    sp_Mesh.material = tmeshlamb;
                else
                    sp_Mesh.material = this.strand_to_material(this.parent.strand_id);
            }
        }
    }
    toggle() {
        // highlight/remove highlight the bases we've clicked 
        let back_Mesh = this[objects][this.BACKBONE]; //get clicked nucleotide's Meshes
        let nuc_Mesh = this[objects][this.NUCLEOSIDE];
        let con_Mesh = this[objects][this.BB_NS_CON];
        let sp_Mesh = this[objects][this.SP_CON];
        if (selected_bases.has(this)) { //if clicked nucleotide is already selected
            this.resetColor(true);
            selected_bases.delete(this); //"unselect" nucletide by setting value in selected_bases array at nucleotideID to 0
        }
        else {
            //set all materials to selection_material color - currently aqua
            if (back_Mesh instanceof THREE.Mesh) {
                if (back_Mesh.material instanceof THREE.MeshLambertMaterial)
                    back_Mesh.material = selection_material;
            }
            if (nuc_Mesh instanceof THREE.Mesh) {
                if (nuc_Mesh.material instanceof THREE.MeshLambertMaterial)
                    nuc_Mesh.material = selection_material;
            }
            if (con_Mesh instanceof THREE.Mesh) {
                if (con_Mesh.material instanceof THREE.MeshLambertMaterial)
                    con_Mesh.material = selection_material;
            }
            if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
                if (sp_Mesh.material instanceof THREE.MeshLambertMaterial)
                    sp_Mesh.material = selection_material;
            }
            //selList.push(nucleotideID);
            selected_bases.add(this); //"select" nucletide by adding it to the selected base list
        }
    }
    ;
    elem_to_material(elem) {
        if (typeof elem == "string") {
            elem = { "A": 0, "G": 1, "C": 2, "T": 3, "U": 3 }[elem];
        }
        else
            elem = Math.abs(elem);
        return nucleoside_materials[elem];
    }
    ;
    getDatFileOutput() {
        let dat = "";
        let tempVec = new THREE.Vector3(0, 0, 0);
        this[objects][this.COM].getWorldPosition(tempVec); //nucleotide's center of mass in world
        let x = tempVec.x;
        let y = tempVec.y;
        let z = tempVec.z;
        this[objects][this.BACKBONE].getWorldPosition(tempVec); //nucleotide's backbone's world position
        let x_bb = tempVec.x;
        let y_bb = tempVec.y;
        let z_bb = tempVec.z;
        this[objects][this.NUCLEOSIDE].getWorldPosition(tempVec); //nucleotide's nucleoside's world position
        let x_ns = tempVec.x;
        let y_ns = tempVec.y;
        let z_ns = tempVec.z;
        let x_a1;
        let y_a1;
        let z_a1;
        //calculate axis vector a1 (backbone vector) and a3 (stacking vector)
        x_a1 = (x_ns - x) / 0.4;
        y_a1 = (y_ns - y) / 0.4;
        z_a1 = (z_ns - z) / 0.4;
        let a3 = this.getA3(x_bb, y_bb, z_bb, x, y, z, x_a1, y_a1, z_a1);
        let x_a3 = a3.x;
        let y_a3 = a3.y;
        let z_a3 = a3.z;
        dat = x + " " + y + " " + z + " " + x_a1 + " " + y_a1 + " " + z_a1 + " " + x_a3 + " " + y_a3 +
            " " + z_a3 + " 0 0 0 0 0 0" + "\n"; //add all locations to dat file string
        return dat;
    }
    ;
    getA3(x_bb, y_bb, z_bb, x, y, z, x_a1, y_a1, z_a1) {
        return new THREE.Vector3();
    }
    ;
}
;
class DNANucleotide extends Nucleotide {
    constructor(global_id, parent) {
        super(global_id, parent);
        this.element_type = DNA;
    }
    ;
    calcBBPos(x, y, z, x_a1, y_a1, z_a1, x_a2, y_a2, z_a2, x_a3, y_a3, z_a3) {
        let x_bb = x - (0.34 * x_a1 + 0.3408 * x_a2), y_bb = y - (0.34 * y_a1 + 0.3408 * y_a2), z_bb = z - (0.34 * z_a1 + 0.3408 * z_a2);
        return new THREE.Vector3(x_bb, y_bb, z_bb);
    }
    ;
    getA3(x_bb, y_bb, z_bb, x, y, z, x_a1, y_a1, z_a1) {
        let x_a2;
        let y_a2;
        let z_a2;
        x_a2 = ((x_bb - x) + (0.34 * x_a1)) / (-0.3408);
        y_a2 = ((y_bb - y) + (0.34 * y_a1)) / (-0.3408);
        z_a2 = ((z_bb - z) + (0.34 * z_a1)) / (-0.3408);
        let Coeff = [[0, -(z_a1), y_a1], [-(z_a1), 0, x_a1], [-(y_a1), x_a1, 0]];
        let x_matrix = [[x_a2, -(z_a1), y_a1], [y_a2, 0, x_a1], [z_a2, x_a1, 0]];
        let y_matrix = [[0, x_a2, y_a1], [-(z_a1), y_a2, x_a1], [-(y_a1), z_a2, 0]];
        let z_matrix = [[0, -(z_a1), x_a2], [-(z_a1), 0, y_a2], [-(y_a1), x_a1, z_a2]];
        let a3 = divAndNeg(cross(x_a1, y_a1, z_a1, x_a2, y_a2, z_a2), dot(x_a1, y_a1, z_a1, x_a1, y_a1, z_a1));
        let x_a3 = a3[0];
        let y_a3 = a3[1];
        let z_a3 = a3[2];
        return new THREE.Vector3(x_a3, y_a3, z_a3);
    }
    ;
}
;
class RNANucleotide extends Nucleotide {
    constructor(global_id, parent) {
        super(global_id, parent);
        this.element_type = RNA;
    }
    ;
    calcBBPos(x, y, z, x_a1, y_a1, z_a1, x_a2, y_a2, z_a2, x_a3, y_a3, z_a3) {
        let x_bb = x - (0.4 * x_a1 + 0.2 * x_a3), y_bb = y - (0.4 * y_a1 + 0.2 * y_a3), z_bb = z - (0.4 * z_a1 + 0.2 * z_a3);
        return new THREE.Vector3(x_bb, y_bb, z_bb);
    }
    ;
    getA3(x_bb, y_bb, z_bb, x, y, z, x_a1, y_a1, z_a1) {
        let x_a3 = ((x_bb - x) + (0.4 * x_a1)) / (-0.2);
        let y_a3 = ((y_bb - y) + (0.4 * y_a1)) / (-0.2);
        let z_a3 = ((z_bb - z) + (0.4 * z_a1)) / (-0.2);
        return new THREE.Vector3(x_a3, y_a3, z_a3);
    }
    ;
}
;
class AminoAcid extends BasicElement {
    constructor(global_id, parent) {
        super(global_id, parent);
        this.SP_CON = 1;
        this.COM = 0;
        this.element_type = AA;
    }
    ;
    elem_to_material(elem) {
        if (typeof elem == "string") {
            elem = { "R": 0, "H": 1, "K": 2, "D": 3, "E": 3, "S": 4, "T": 5, "N": 6, "Q": 7, "C": 8, "U": 9, "G": 10, "P": 11, "A": 12, "V": 13, "I": 14, "L": 15, "M": 16, "F": 17, "Y": 18, "W": 19 }[elem];
        }
        else
            elem = Math.abs(elem);
        return nucleoside_materials[elem];
    }
    ;
    calculatePositions(x, y, z, l) {
        // adds a new "backbone", new "nucleoside", and new "connector" to the scene by adding to  then to strand_3objects then to system_3objects then to scene
        this.name = this.global_id + ""; //set name (string) to nucleotide's global id
        let backbone;
        // 4 Mesh to display DNA + 1 Mesh to store  group's center of mass as its position
        //make material depending on whether there is an alternate color scheme available
        var material;
        if (lutColsVis) {
            material = new THREE.MeshLambertMaterial({
                color: lutCols[this.global_id],
                side: THREE.DoubleSide
            });
        }
        else {
            material = this.elem_to_material(this.type);
        }
        backbone = new THREE.Mesh(backbone_geometry, material);
        backbone.position.set(x, y, z);
        this.add(backbone);
        //last, add the sugar-phosphate bond since its not done for the first nucleotide in each strand
        if (this.neighbor3 != null && this.neighbor3.local_id < this.local_id) {
            let x_sp = (x + x_bb_last) / 2, //sugar phospate position in center of both current and last sugar phosphates
            y_sp = (y + y_bb_last) / 2, z_sp = (z + z_bb_last) / 2;
            let sp_len = Math.sqrt(Math.pow(x - x_bb_last, 2) + Math.pow(y - y_bb_last, 2) + Math.pow(z - z_bb_last, 2));
            // easy periodic boundary condition fix  
            // if the bonds are to long just don't add them 
            if (sp_len <= 500) {
                let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x, y_sp - y, z_sp - z).normalize()));
                material = this.strand_to_material(this.parent.strand_id);
                let sp = new THREE.Mesh(connector_geometry, material); //cylinder - sugar phosphate connector
                sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //set length according to distance between current and last sugar phosphate
                sp.applyMatrix(rotation_sp); //set rotation
                sp.position.set(x_sp, y_sp, z_sp);
                sp.name = "sp" + this.id;
                this.add(sp); //add to 
            }
        }
        if (this.neighbor5 != null && this.neighbor5.local_id < this.local_id) { //handles strand end connection
            let x_sp = (x + this.neighbor5[objects][this.BACKBONE].position.x) / 2, //make sugar phosphate connection
            y_sp = (y + this.neighbor5[objects][this.BACKBONE].position.y) / 2, z_sp = (z + this.neighbor5[objects][this.BACKBONE].position.z) / 2;
            let sp_len = Math.sqrt(Math.pow(x - this.neighbor5[objects][this.BACKBONE].position.x, 2) + Math.pow(y - this.neighbor5[objects][this.BACKBONE].position.y, 2) + Math.pow(z - this.neighbor5[objects][this.BACKBONE].position.z, 2));
            let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x, y_sp - y, z_sp - z).normalize()));
            let sp = new THREE.Mesh(connector_geometry, material); //cylinder - sugar phosphate connector
            sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //set length according to distance between current and last sugar phosphate
            sp.applyMatrix(rotation_sp); //set rotation
            sp.position.set(x_sp, y_sp, z_sp);
            this.add(sp); //add to 
        }
        //actually add the new items to the scene by adding to  then to strand_3objects then to system_3objects then to scene
        //this = group; //set Nucleotide nuc's attribute to group
        this.parent.add(this); //add group to strand_3objects
        //update last backbone position and last strand
        x_bb_last = x;
        y_bb_last = y;
        z_bb_last = z;
    }
    ;
    calculateNewConfigPositions(x, y, z, l) {
        let group = this;
        group.name = this.global_id + "";
        //set new positions/rotations for the meshes.  Don't need to create new meshes since they exist.
        //if you position.set() before applyMatrix() everything explodes and I don't know why
        group[objects][this.BACKBONE].position.set(x, y, z);
        //last, add the sugar-phosphate bond since its not done for the first nucleotide in each strand
        if (this.neighbor3 != null && this.neighbor3.local_id < this.local_id) {
            let x_sp = (x + x_bb_last) / 2, //sugar phospate position in center of both current and last sugar phosphates
            y_sp = (y + y_bb_last) / 2, z_sp = (z + z_bb_last) / 2;
            let sp_len = Math.sqrt(Math.pow(x - x_bb_last, 2) + Math.pow(y - y_bb_last, 2) + Math.pow(z - z_bb_last, 2));
            // easy periodic boundary condition fix  
            // if the bonds are to long just don't add them 
            if (sp_len <= 500) {
                let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x, y_sp - y, z_sp - z).normalize()));
                //let material: THREE.MeshLambertMaterial = this.strand_to_material(this.parent.strand_id);
                //let sp = new THREE.Mesh(connector_geometry, material); //cylinder - sugar phosphate connector
                let sp = group[objects][this.SP_CON];
                this.updateSP();
                sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //set length according to distance between current and last sugar phosphate
                sp.applyMatrix(rotation_sp); //set rotation
                sp.position.set(x_sp, y_sp, z_sp);
                group[objects][this.SP_CON].parent = this;
            }
        }
        x_bb_last = x;
        y_bb_last = y;
        z_bb_last = z;
    }
    ;
    updateSP() {
        let sp_Mesh = this[objects][this.SP_CON];
        if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
            if (sp_Mesh.material instanceof THREE.MeshLambertMaterial) {
                sp_Mesh.material = this.strand_to_material(this.parent.strand_id);
            }
            let geo = sp_Mesh.geometry;
            geo = connector_geometry;
            sp_Mesh.drawMode = THREE.TrianglesDrawMode;
            sp_Mesh.updateMorphTargets();
            sp_Mesh.up = THREE.Object3D.DefaultUp.clone();
            sp_Mesh.position.set(0, 0, 0);
            sp_Mesh.rotation.set(0, 0, 0);
            sp_Mesh.quaternion.set(0, 0, 0, 0);
            sp_Mesh.scale.set(1, 1, 1);
            sp_Mesh.matrix.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
            sp_Mesh.matrixWorld.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
            sp_Mesh.matrixAutoUpdate = THREE.Object3D.DefaultMatrixAutoUpdate;
            sp_Mesh.matrixWorldNeedsUpdate = false;
            //sp_Mesh.layers.set(1);
            sp_Mesh.visible = true;
            sp_Mesh.castShadow = false;
            sp_Mesh.receiveShadow = false;
            sp_Mesh.frustumCulled = true;
            sp_Mesh.renderOrder = 0;
            sp_Mesh.userData = {};
        }
        return sp_Mesh;
    }
    ;
    getCOM() {
        return this.BACKBONE;
    }
    ;
    resetColor(nucNec) {
        let back_Mesh = this[objects][this.BACKBONE]; //get clicked nucleotide's Meshes
        let sp_Mesh = this[objects][this.SP_CON];
        let tmeshlamb;
        if (lutColsVis) {
            tmeshlamb = new THREE.MeshLambertMaterial({
                color: lutCols[this.global_id],
                side: THREE.DoubleSide
            });
        }
        // figure out what that base was before you painted it black and revert it
        //recalculate Mesh's proper coloring and set Mesh material on scene to proper material
        if (nucNec) {
            if (back_Mesh != undefined && back_Mesh instanceof THREE.Mesh) { //necessary for proper typing
                if (back_Mesh.material != undefined && (back_Mesh.material instanceof THREE.MeshBasicMaterial || back_Mesh.material instanceof THREE.MeshLambertMaterial)) {
                    if (lutColsVis)
                        back_Mesh.material = tmeshlamb;
                    else
                        back_Mesh.material = this.elem_to_material(this.type);
                }
            }
        }
        if (sp_Mesh != undefined && sp_Mesh instanceof THREE.Mesh) {
            if (sp_Mesh.material instanceof THREE.MeshBasicMaterial || sp_Mesh.material instanceof THREE.MeshLambertMaterial) {
                if (lutColsVis)
                    sp_Mesh.material = tmeshlamb;
                else
                    sp_Mesh.material = this.strand_to_material(this.parent.strand_id);
            }
        }
    }
    ;
    toggle() {
        // highlight/remove highlight the bases we've clicked 
        let back_Mesh = this[objects][this.BACKBONE]; //get clicked nucleotide's Meshes
        let sp_Mesh = this[objects][this.SP_CON];
        if (selected_bases.has(this)) { //if clicked nucleotide is already selected
            this.resetColor(true);
            selected_bases.delete(this); //"unselect" nucletide by setting value in selected_bases array at nucleotideID to 0
        }
        else {
            //set all materials to selection_material color - currently aqua
            if (back_Mesh instanceof THREE.Mesh) {
                if (back_Mesh.material instanceof THREE.MeshBasicMaterial || back_Mesh.material instanceof THREE.MeshLambertMaterial) {
                    back_Mesh.material = selection_material;
                }
            }
            if (sp_Mesh != undefined && sp_Mesh instanceof THREE.Mesh) {
                if (sp_Mesh.material instanceof THREE.MeshBasicMaterial || sp_Mesh.material instanceof THREE.MeshLambertMaterial) {
                    sp_Mesh.material = selection_material;
                }
            }
            //selList.push(nucleotideID);
            selected_bases.add(this); //"select" nucletide by setting value in selected_bases array at nucleotideID to 1
        }
    }
    getDatFileOutput() {
        let dat = "";
        let tempVec = new THREE.Vector3();
        this[objects][this.BACKBONE].getWorldPosition(tempVec); //nucleotide's center of mass in world
        let x = tempVec.x;
        let y = tempVec.y;
        let z = tempVec.z;
        dat = x + " " + y + " " + z + "1.0 1.0 0.0 0.0 0.0 -1.0 0.0 0.0 0.0 0.0 0.0 0.0" + "\n"; //add all locations to dat file string
        return dat;
    }
    ;
}
;
// strands are made up of elements
// strands have an ID within the system
class Strand extends THREE.Group {
    constructor(id, parent) {
        super();
        this.strand_id = id;
        this.parent = parent;
    }
    ;
    add_basicElement(elem) {
        this[monomers].push(elem);
        elem.parent = this;
    }
    ;
    create_basicElement(global_id) {
        return new AminoAcid(global_id, this);
    }
    remove_basicElement(to_remove) {
        for (let i = 0; i < this[monomers].length; i++) {
            let n = this[monomers][i];
            if (n.global_id == to_remove) { //changed from local to global id
                scene.remove(n);
                n = null;
            }
        }
    }
    ;
    exclude_Elements(elements) {
        // detach from parent
        elements.forEach((e) => {
            e.parent = null;
            this.remove(e);
        });
        // create a new list of strand elements  
        let filtered = this[monomers].filter((v, i, arr) => {
            return !elements.includes(v);
        });
        this[monomers] = filtered;
    }
    get_com() {
        let com = new THREE.Vector3(0, 0, 0);
        this[monomers].forEach((e) => {
            com.add(e[objects][e.COM].position);
        });
        return (com.multiplyScalar(1 / this[monomers].length));
    }
    translate_strand(amount) {
        this[monomers].forEach((m) => {
            m[objects].forEach((o) => {
                o.position.add(amount);
            });
        });
    }
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
class System extends THREE.Group {
    constructor(id, start_id) {
        super();
        this.system_id = id;
        this.global_start_id = start_id;
    }
    ;
    system_length() {
        let count = 0;
        for (let i = 0; i < this[strands].length; i++) {
            count += this[strands][i][monomers].length;
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
        this[strands].push(strand);
        strand.parent = this;
    }
    ;
    remove_strand(to_remove) {
        for (let i = 0; i < this[strands].length; i++) {
            let s = this[strands][i];
            if (s.strand_id == to_remove) {
                this.remove(s);
                for (let j = 0; j < s[monomers].length; j++) {
                    s.remove(s[monomers][j]);
                    s.remove_basicElement(j);
                }
                scene.remove(s);
                s = null;
            }
            ;
            render();
        }
    }
    ;
    //computes the center of mass of the system
    get_com() {
        let com = new THREE.Vector3(0, 0, 0);
        let count = 0;
        this[strands].forEach((s) => {
            s[monomers].forEach((m) => {
                com.add(m[objects][m.COM].position);
                count += 1;
            });
        });
        return (com.multiplyScalar(1 / count));
    }
    //This is needed to handle strands that have experienced fix_diffusion.  Don't use it.
    strand_unweighted_com() {
        let com = new THREE.Vector3(0, 0, 0);
        let count = 0;
        this[strands].forEach((s) => {
            com.add(s.get_com());
            count += 1;
        });
        return (com.multiplyScalar(1 / count));
    }
    setDatFile(dat_file) {
        this.dat_file = dat_file;
    }
    translate_system(amount) {
        this[strands].forEach((s) => {
            s[monomers].forEach((m) => {
                m[objects].forEach((o) => {
                    o.position.add(amount);
                });
            });
        });
    }
}
;
function updatePos() {
    for (let h = 0; h < systems.length; h++) { //for current system
        let syscms = new THREE.Vector3(0, 0, 0); //system cms
        let n = systems[h].system_length(); //# of BasicElements in system
        for (let i = 0; i < systems[h][strands].length; i++) { //for each strand
            let n1 = systems[h][strands][i][monomers].length; //for strand_3objects in system_3objects
            let strandcms = new THREE.Vector3(0, 0, 0); //strand cms
            for (let j = 0; j < n1; j++) { //for each 
                let nucobj = systems[h][strands][i][monomers][j]; //current nuc's 
                let objcms = new THREE.Vector3(); //group cms
                //sum cms of all  in each system, strand, and itself
                let bbint = systems[h][strands][i][monomers][j].getCOM();
                let tempposition = nucobj[objects][bbint].position.clone();
                objcms = tempposition; //nucobj cms
                strandcms.add(tempposition); //strand cms
                syscms.add(tempposition); //system cms
                systems[h][strands][i][monomers][j].pos = objcms.clone(); // set nucleotide object position to objcms
            }
            //calculate strand cms
            let mul = 1.0 / n1;
            strandcms.multiplyScalar(mul);
            systems[h][strands][i].pos = strandcms.clone(); //set strand object position to strand cms
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
}
function previousConfig() {
    if (previous_previous_reader.readyState == 1) {
        return;
    }
    getNewConfig(-1);
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
    colorOptions();
}
function colorOptions() {
    let opt = document.getElementById("colorOptions");
    if (!opt.hidden) {
        opt.innerHTML = ""; //Clear content
        let addButton = document.createElement('button');
        addButton.innerText = "Add Color";
        addButton.onclick = function () {
            backbone_materials.push(new THREE.MeshLambertMaterial({
                color: 0x156289,
                side: THREE.DoubleSide
            }));
            let index = 0;
            for (; index < elements.length; index++) {
                if (!selected_bases.has(elements[i]))
                    elements[index].resetColor(false);
            }
            colorOptions();
            render();
        };
        for (let i = 0; i < backbone_materials.length; i++) {
            let m = backbone_materials[i];
            let c = document.createElement('input');
            c.type = 'color';
            c.value = "#" + m.color.getHexString();
            c.oninput = function () {
                m.color = new THREE.Color(c.value);
                render();
            };
            c.oncontextmenu = function (event) {
                event.preventDefault();
                backbone_materials.splice(i, 1);
                colorOptions();
                return false;
            };
            opt.appendChild(c);
        }
        opt.appendChild(addButton);
        let index = 0;
        for (; index < elements.length; index++) {
            elements[index].resetColor(false);
        }
        render();
    }
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
    let button = document.getElementById("videoStartStop");
    button.innerText = "Stop";
    button.onclick = function () {
        capturer.stop();
        capturer.save();
    };
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
        button.innerText = "Start";
        button.onclick = createVideo;
        return;
    }
    // Overload stop button so that we don't forget to remove listeners
    let button = document.getElementById("videoStartStop");
    button.onclick = _done;
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
    // Overload stop button so that we don't forget to remove listeners
    let button = document.getElementById("videoStartStop");
    button.onclick = function () { tMax = 0; };
    // Move camera and capture frames
    // This is not a for-loop since we need to use
    // requestAnimationFrame recursively.
    let t = 0;
    var animate = function () {
        if (t >= tMax) {
            capturer.stop();
            capturer.save();
            button.innerText = "Start";
            button.onclick = createVideo;
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
            lutColsVis = false; //now flexibility coloring is not being displayed and checkbox is not selected
            for (let i = 0; i < elements.length; i++) { //for all elements in all systems - does not work for more than one system
                if (!selected_bases.has(elements[i]))
                    elements[i].resetColor(true);
            }
        }
        else {
            for (let i = 0; i < elements.length; i++) { //for each nucleotide in all systems - does not work for multiple systems yet
                let tmeshlamb = new THREE.MeshLambertMaterial({
                    color: lutCols[i],
                    side: THREE.DoubleSide
                });
                for (let j = 0; j < elements[i][objects].length; j++) { //for each Mesh in each nucleotide's 
                    if (j != 3) { //for all except cms posObj Mesh
                        let tmesh = elements[i][objects][j];
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
function toggleFog(near, far) {
    if (scene.fog == null) {
        scene.fog = new THREE.Fog(scene.background, near, far);
    }
    else {
        scene.fog = null;
    }
    render();
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
/*function centerSystems() { //centers systems based on cms calculated for world (all systems)
    
    // Create one averaging variable for each dimension, representing that 1D
    // interval as a unit circle in 2D (with the circumference being the
    // bounding box side length)
    let checkbox = document.getElementById("centering") as HTMLInputElement;
    if (checkbox.checked) {
        let cm_x = new THREE.Vector2(),
            cm_y = new THREE.Vector2(),
            cm_z = new THREE.Vector2();

        for (let i = 0; i < elements.length; i++) {
            let bbint: number = elements[i].getCOM();
            let p = elements[i][objects][bbint].position.clone();
            // Shift coordinates so that the origin is in the corner of the
            // bounding box, instead of the centre.
            p.add(new THREE.Vector3().addScalar(1.5 * box));
            p.x %= box; p.y %= box; p.z %= box;

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
        let cms = new THREE.Vector3(
            box / (2 * Math.PI) * (Math.atan2(-cm_x.x, -cm_x.y) + Math.PI),
            box / (2 * Math.PI) * (Math.atan2(-cm_y.x, -cm_y.y) + Math.PI),
            box / (2 * Math.PI) * (Math.atan2(-cm_z.x, -cm_z.y) + Math.PI)
        );
        // Shift back origin to center of box
        cms.sub(new THREE.Vector3().addScalar(box / 2));

        // Change nucleotide positions by the center of mass
        for (let i = 0; i < elements.length; i++) {
            for (let j = 0; j < elements[i][objects].length; j++) {
                let p = elements[i][objects][j].position;
                // Shift with centre of mass
                p.add(cms);
                // Keep positions within bounding box
                p.add(new THREE.Vector3().addScalar(1.5 * box));
                p.x %= box; p.y %= box; p.z %= box;
                p.sub(new THREE.Vector3().addScalar(0.75 * box));
            }
        }
    }
    render();
}*/
//changes resolution on the nucleotide visual objects
function setResolution(resolution) {
    //change mesh_setup with the given resolution
    backbone_geometry = new THREE.SphereBufferGeometry(.2, resolution, resolution);
    nucleoside_geometry = new THREE.SphereBufferGeometry(.3, resolution, resolution).applyMatrix(new THREE.Matrix4().makeScale(0.7, 0.3, 0.7));
    connector_geometry = new THREE.CylinderBufferGeometry(.1, .1, 1, Math.max(2, resolution));
    //update all elements and hide some meshes if resolution is low enough
    for (let i = 0; i < elements.length; i++) {
        let nuc_group = elements[i][objects];
        nuc_group[elements[i].BACKBONE].visible = resolution > 1;
        nuc_group[elements[i].BACKBONE].geometry = backbone_geometry;
        nuc_group[elements[i].NUCLEOSIDE].visible = resolution > 1;
        nuc_group[elements[i].NUCLEOSIDE].geometry = nucleoside_geometry;
        if (nuc_group[elements[i].BB_NS_CON]) {
            nuc_group[elements[i].BB_NS_CON].geometry = connector_geometry;
            nuc_group[elements[i].BB_NS_CON].visible = resolution > 1;
        }
        if (nuc_group[elements[i].SP_CON]) {
            nuc_group[elements[i].SP_CON].geometry = connector_geometry;
        }
    }
    render();
}
function toggleSideNav(button) {
    let hidden = "show";
    let visible = "hide";
    let tabcontent = document.getElementsByClassName("tabcontent");
    if (button.innerText == hidden) {
        tabcontent[0].style.display = "block";
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
