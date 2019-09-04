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
        //NUCLEOSIDE: number = 0;
        //BB_NS_CON: number = 1;
        this.COM = 0;
        //SP_CON: number = 3;
        this.element_type = -1;
        this.global_id = global_id;
        this.parent = parent;
    }
    ;
    calculatePositions(x, y, z, l) {
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
    strand_to_color(strandIndex) {
        return backbone_colors[(Math.abs(strandIndex) + this.parent.parent.system_id) % backbone_colors.length];
    }
    ;
    elem_to_color(type) {
        return new THREE.Color();
    }
    ;
    getDatFileOutput() {
        return "";
    }
    ;
    resetColor(nucNec) {
    }
    ;
    /*translate_monomer(amount: THREE.Vector3) {
        this[objects].forEach((o) => {
            o.position.add(amount);
        });
    }*/
    set_position(new_pos) {
    }
    translate_position(amount) {
    }
    rotate(quat) {
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
        // compute backbone position
        let x_bb = 0;
        let y_bb = 0;
        let z_bb = 0;
        let bbpos = this.calcBBPos(x, y, z, x_a1, y_a1, z_a1, x_a2, y_a2, z_a2, x_a3, y_a3, z_a3);
        x_bb = bbpos.x;
        y_bb = bbpos.y;
        z_bb = bbpos.z;
        // compute nucleoside cm
        let x_ns = x + 0.4 * x_a1, y_ns = y + 0.4 * y_a1, z_ns = z + 0.4 * z_a1;
        // compute nucleoside rotation
        let base_rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_a3, y_a3, z_a3));
        //compute connector position
        let x_con = (x_bb + x_ns) / 2, y_con = (y_bb + y_ns) / 2, z_con = (z_bb + z_ns) / 2;
        // compute connector rotation
        let rotation_con = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_con - x_ns, y_con - y_ns, z_con - z_ns).normalize());
        // compute sugar-phosphate positions/rotations, or set them all to 0 if there is no sugar-phosphate.
        let x_sp, y_sp, z_sp, sp_len, rotation_sp;
        if (this.neighbor3 != null && this.neighbor3.local_id < this.local_id) {
            x_sp = (x_bb + x_bb_last) / 2,
                y_sp = (y_bb + y_bb_last) / 2,
                z_sp = (z_bb + z_bb_last) / 2;
            sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
            rotation_sp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize());
        }
        else {
            x_sp = 0,
                y_sp = 0,
                z_sp = 0;
            sp_len = 0;
            rotation_sp = new THREE.Quaternion(0, 0, 0, 0);
        }
        if (this.neighbor5 != null && this.neighbor5.local_id < this.local_id) { //handle circular strands
            let tmpx_bb_last = this.parent.parent.bb_offsets[this.neighbor5.global_id * 3], tmpy_bb_last = this.parent.parent.bb_offsets[this.neighbor5.global_id * 3 + 1], tmpz_bb_last = this.parent.parent.bb_offsets[this.neighbor5.global_id * 3 + 2];
            let tmpx_sp = (x_bb + tmpx_bb_last) / 2, tmpy_sp = (y_bb + tmpy_bb_last) / 2, tmpz_sp = (z_bb + tmpz_bb_last) / 2;
            let tmpsp_len = Math.sqrt(Math.pow(x_bb - tmpx_bb_last, 2) + Math.pow(y_bb - tmpy_bb_last, 2) + Math.pow(z_bb - tmpz_bb_last, 2));
            let tmprotation_sp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(tmpx_sp - x_bb, tmpy_sp - y_bb, tmpz_sp - z_bb).normalize());
            this.parent.parent.bbcon_offsets[this.neighbor5.global_id * 3] = tmpx_sp;
            this.parent.parent.bbcon_offsets[this.neighbor5.global_id * 3 + 1] = tmpy_sp;
            this.parent.parent.bbcon_offsets[this.neighbor5.global_id * 3 + 2] = tmpz_sp;
            this.parent.parent.bbcon_rotation[this.neighbor5.global_id * 4] = tmprotation_sp.w;
            this.parent.parent.bbcon_rotation[this.neighbor5.global_id * 4 + 1] = tmprotation_sp.z;
            this.parent.parent.bbcon_rotation[this.neighbor5.global_id * 4 + 2] = tmprotation_sp.y;
            this.parent.parent.bbcon_rotation[this.neighbor5.global_id * 4 + 3] = tmprotation_sp.x;
            this.parent.parent.bbcon_scales[this.neighbor5.global_id * 3] = 1;
            this.parent.parent.bbcon_scales[this.neighbor5.global_id * 3 + 1] = tmpsp_len;
            this.parent.parent.bbcon_scales[this.neighbor5.global_id * 3 + 2] = 1;
        }
        // we keep track of cm position, even though we don't draw anything with it.
        this.parent.parent.cm_offsets[this.global_id * 3] = x;
        this.parent.parent.cm_offsets[this.global_id * 3 + 1] = y;
        this.parent.parent.cm_offsets[this.global_id * 3 + 2] = z;
        // fill backbone positioning array
        this.parent.parent.bb_offsets[this.global_id * 3] = x_bb;
        this.parent.parent.bb_offsets[this.global_id * 3 + 1] = y_bb;
        this.parent.parent.bb_offsets[this.global_id * 3 + 2] = z_bb;
        // backbones are spheres and therefore rotationally invariant
        this.parent.parent.bb_rotation[this.global_id * 4] = 0;
        this.parent.parent.bb_rotation[this.global_id * 4 + 1] = 0;
        this.parent.parent.bb_rotation[this.global_id * 4 + 2] = 0;
        this.parent.parent.bb_rotation[this.global_id * 4 + 3] = 0;
        // fill nucleoside positioning array
        this.parent.parent.ns_offsets[this.global_id * 3] = x_ns;
        this.parent.parent.ns_offsets[this.global_id * 3 + 1] = y_ns;
        this.parent.parent.ns_offsets[this.global_id * 3 + 2] = z_ns;
        // fill nucleoside rotation quaternion
        this.parent.parent.ns_rotation[this.global_id * 4] = base_rotation.w;
        this.parent.parent.ns_rotation[this.global_id * 4 + 1] = base_rotation.z;
        this.parent.parent.ns_rotation[this.global_id * 4 + 2] = base_rotation.y;
        this.parent.parent.ns_rotation[this.global_id * 4 + 3] = base_rotation.x;
        // fill connector positioning array
        this.parent.parent.con_offsets[this.global_id * 3] = x_con;
        this.parent.parent.con_offsets[this.global_id * 3 + 1] = y_con;
        this.parent.parent.con_offsets[this.global_id * 3 + 2] = z_con;
        // fill connector rotation quaternion
        this.parent.parent.con_rotation[this.global_id * 4] = rotation_con.w;
        this.parent.parent.con_rotation[this.global_id * 4 + 1] = rotation_con.z;
        this.parent.parent.con_rotation[this.global_id * 4 + 2] = rotation_con.y;
        this.parent.parent.con_rotation[this.global_id * 4 + 3] = rotation_con.x;
        // fill sugar-phosphate positioning array
        this.parent.parent.bbcon_offsets[this.global_id * 3] = x_sp;
        this.parent.parent.bbcon_offsets[this.global_id * 3 + 1] = y_sp;
        this.parent.parent.bbcon_offsets[this.global_id * 3 + 2] = z_sp;
        // fill sugar-phosphate rotation quaternion
        this.parent.parent.bbcon_rotation[this.global_id * 4] = rotation_sp.w;
        this.parent.parent.bbcon_rotation[this.global_id * 4 + 1] = rotation_sp.z;
        this.parent.parent.bbcon_rotation[this.global_id * 4 + 2] = rotation_sp.y;
        this.parent.parent.bbcon_rotation[this.global_id * 4 + 3] = rotation_sp.x;
        this.name = this.global_id + ""; //set name (string) to nucleotide's global id
        // determine the mesh color, either from a supplied colormap json or by the strand ID.
        var color;
        if (lutColsVis) {
            color = lutCols[i];
        }
        else {
            color = this.strand_to_color(this.parent.strand_id);
        }
        //fill color array for backbones and connectors
        this.parent.parent.bb_colors[this.global_id * 3] = color.r;
        this.parent.parent.bb_colors[this.global_id * 3 + 1] = color.g;
        this.parent.parent.bb_colors[this.global_id * 3 + 2] = color.b;
        // determine the nucleoside color and fill the nucleoside color array
        color = this.elem_to_color(this.type);
        this.parent.parent.ns_colors[this.global_id * 3] = color.r;
        this.parent.parent.ns_colors[this.global_id * 3 + 1] = color.g;
        this.parent.parent.ns_colors[this.global_id * 3 + 2] = color.b;
        // many things are the same size as their original mesh
        this.parent.parent.scales[this.global_id * 3] = 1;
        this.parent.parent.scales[this.global_id * 3 + 1] = 1;
        this.parent.parent.scales[this.global_id * 3 + 2] = 1;
        // except nucleosides, they're flatish disk shapes
        this.parent.parent.ns_scales[this.global_id * 3] = 0.7;
        this.parent.parent.ns_scales[this.global_id * 3 + 1] = 0.3;
        this.parent.parent.ns_scales[this.global_id * 3 + 2] = 0.7;
        // and connectors, their Y axis depends on what they're connecting.
        this.parent.parent.con_scales[this.global_id * 3] = 1;
        this.parent.parent.con_scales[this.global_id * 3 + 1] = this.bb_ns_distance;
        this.parent.parent.con_scales[this.global_id * 3 + 2] = 1;
        this.parent.parent.bbcon_scales[this.global_id * 3] = 1;
        this.parent.parent.bbcon_scales[this.global_id * 3 + 1] = sp_len;
        this.parent.parent.bbcon_scales[this.global_id * 3 + 2] = 1;
        // keep track of last backbone for sugar-phosphate positioning
        x_bb_last = x_bb;
        y_bb_last = y_bb;
        z_bb_last = z_bb;
    }
    ;
    translate_position(amount) {
        let s = this.parent.parent;
        s.bb_offsets[this.global_id * 3] += amount.x;
        s.bb_offsets[this.global_id * 3 + 1] += amount.y;
        s.bb_offsets[this.global_id * 3 + 2] += amount.z;
        s.ns_offsets[this.global_id * 3] += amount.x;
        s.ns_offsets[this.global_id * 3 + 1] += amount.y;
        s.ns_offsets[this.global_id * 3 + 2] += amount.z;
        s.con_offsets[this.global_id * 3] += amount.x;
        s.con_offsets[this.global_id * 3 + 1] += amount.y;
        s.con_offsets[this.global_id * 3 + 2] += amount.z;
        s.bbcon_offsets[this.global_id * 3] += amount.x;
        s.bbcon_offsets[this.global_id * 3 + 1] += amount.y;
        s.bbcon_offsets[this.global_id * 3 + 2] += amount.z;
        s.cm_offsets[this.global_id * 3] += amount.x;
        s.cm_offsets[this.global_id * 3 + 1] += amount.y;
        s.cm_offsets[this.global_id * 3 + 2] += amount.z;
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
        let base_rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_a3, y_a3, z_a3));
        // compute connector rotation
        let rotation_con = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_bb - x_ns, y_bb - y_ns, z_bb - z_ns).normalize());
        // we keep track of cm position, even though we don't draw anything with it.
        this.parent.parent.cm_offsets[this.global_id * 3] = x;
        this.parent.parent.cm_offsets[this.global_id * 3 + 1] = y;
        this.parent.parent.cm_offsets[this.global_id * 3 + 2] = z;
        // compute sugar-phosphate positions/rotations, or set them all to 0 if there is no sugar-phosphate.
        let x_sp, y_sp, z_sp, sp_len, rotation_sp;
        if (this.neighbor3 != null && this.neighbor3.local_id < this.local_id) {
            x_sp = (x_bb + x_bb_last) / 2,
                y_sp = (y_bb + y_bb_last) / 2,
                z_sp = (z_bb + z_bb_last) / 2;
            sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
            rotation_sp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize());
        }
        else {
            x_sp = 0,
                y_sp = 0,
                z_sp = 0;
            sp_len = 0;
            rotation_sp = new THREE.Quaternion(0, 0, 0, 0);
        }
        if (this.neighbor5 != null && this.neighbor5.local_id < this.local_id) { //handle circular strands
            let tmpx_bb_last = this.parent.parent.bb_offsets[this.neighbor5.global_id * 3], tmpy_bb_last = this.parent.parent.bb_offsets[this.neighbor5.global_id * 3 + 1], tmpz_bb_last = this.parent.parent.bb_offsets[this.neighbor5.global_id * 3 + 2];
            let tmpx_sp = (x_bb + tmpx_bb_last) / 2, tmpy_sp = (y_bb + tmpy_bb_last) / 2, tmpz_sp = (z_bb + tmpz_bb_last) / 2;
            let tmpsp_len = Math.sqrt(Math.pow(x_bb - tmpx_bb_last, 2) + Math.pow(y_bb - tmpy_bb_last, 2) + Math.pow(z_bb - tmpz_bb_last, 2));
            let tmprotation_sp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(tmpx_sp - x_bb, tmpy_sp - y_bb, tmpz_sp - z_bb).normalize());
            this.parent.parent.bbcon_offsets[this.neighbor5.global_id * 3] = tmpx_sp;
            this.parent.parent.bbcon_offsets[this.neighbor5.global_id * 3 + 1] = tmpy_sp;
            this.parent.parent.bbcon_offsets[this.neighbor5.global_id * 3 + 2] = tmpz_sp;
            this.parent.parent.bbcon_rotation[this.neighbor5.global_id * 4] = tmprotation_sp.w;
            this.parent.parent.bbcon_rotation[this.neighbor5.global_id * 4 + 1] = tmprotation_sp.z;
            this.parent.parent.bbcon_rotation[this.neighbor5.global_id * 4 + 2] = tmprotation_sp.y;
            this.parent.parent.bbcon_rotation[this.neighbor5.global_id * 4 + 3] = tmprotation_sp.x;
            this.parent.parent.bbcon_scales[this.neighbor5.global_id * 3] = 1;
            this.parent.parent.bbcon_scales[this.neighbor5.global_id * 3 + 1] = tmpsp_len;
            this.parent.parent.bbcon_scales[this.neighbor5.global_id * 3 + 2] = 1;
        }
        // update backbone positioning array
        this.parent.parent.bb_offsets[this.global_id * 3] = x_bb;
        this.parent.parent.bb_offsets[this.global_id * 3 + 1] = y_bb;
        this.parent.parent.bb_offsets[this.global_id * 3 + 2] = z_bb;
        // update nucleoside positioning array
        this.parent.parent.ns_offsets[this.global_id * 3] = x_ns;
        this.parent.parent.ns_offsets[this.global_id * 3 + 1] = y_ns;
        this.parent.parent.ns_offsets[this.global_id * 3 + 2] = z_ns;
        // update nucleoside rotation quaternion
        this.parent.parent.ns_rotation[this.global_id * 4] = base_rotation.w;
        this.parent.parent.ns_rotation[this.global_id * 4 + 1] = base_rotation.z;
        this.parent.parent.ns_rotation[this.global_id * 4 + 2] = base_rotation.y;
        this.parent.parent.ns_rotation[this.global_id * 4 + 3] = base_rotation.x;
        // update connector positioning array
        this.parent.parent.con_offsets[this.global_id * 3] = x_con;
        this.parent.parent.con_offsets[this.global_id * 3 + 1] = y_con;
        this.parent.parent.con_offsets[this.global_id * 3 + 2] = z_con;
        // update connector rotation quaternion
        this.parent.parent.con_rotation[this.global_id * 4] = rotation_con.w;
        this.parent.parent.con_rotation[this.global_id * 4 + 1] = rotation_con.z;
        this.parent.parent.con_rotation[this.global_id * 4 + 2] = rotation_con.y;
        this.parent.parent.con_rotation[this.global_id * 4 + 3] = rotation_con.x;
        // update sugar-phosphate positioning array
        this.parent.parent.bbcon_offsets[this.global_id * 3] = x_sp;
        this.parent.parent.bbcon_offsets[this.global_id * 3 + 1] = y_sp;
        this.parent.parent.bbcon_offsets[this.global_id * 3 + 2] = z_sp;
        // update sugar-phosphate rotation quaternion
        this.parent.parent.bbcon_rotation[this.global_id * 4] = rotation_sp.w;
        this.parent.parent.bbcon_rotation[this.global_id * 4 + 1] = rotation_sp.z;
        this.parent.parent.bbcon_rotation[this.global_id * 4 + 2] = rotation_sp.y;
        this.parent.parent.bbcon_rotation[this.global_id * 4 + 3] = rotation_sp.x;
        // update backbone lengths
        this.parent.parent.bbcon_scales[this.global_id * 3] = 1;
        this.parent.parent.bbcon_scales[this.global_id * 3 + 1] = sp_len;
        this.parent.parent.bbcon_scales[this.global_id * 3 + 2] = 1;
        // keep track of last backbone for sugar-phosphate positioning
        x_bb_last = x_bb;
        y_bb_last = y_bb;
        z_bb_last = z_bb;
    }
    ;
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
                    back_Mesh.material = this.strand_to_color(this.parent.strand_id);
            }
        }
        if (nucNec) {
            if (nuc_Mesh instanceof THREE.Mesh) {
                if (nuc_Mesh.material instanceof THREE.MeshLambertMaterial) {
                    if (lutColsVis)
                        nuc_Mesh.material = tmeshlamb;
                    else
                        nuc_Mesh.material = this.elem_to_color(this.type);
                }
            }
        }
        if (con_Mesh instanceof THREE.Mesh) {
            if (con_Mesh.material instanceof THREE.MeshLambertMaterial) {
                if (lutColsVis)
                    con_Mesh.material = tmeshlamb;
                else
                    con_Mesh.material = this.strand_to_color(this.parent.strand_id);
            }
        }
        if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
            if (sp_Mesh.material instanceof THREE.MeshLambertMaterial) {
                if (lutColsVis)
                    sp_Mesh.material = tmeshlamb;
                else
                    sp_Mesh.material = this.strand_to_color(this.parent.strand_id);
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
    elem_to_color(elem) {
        if (typeof elem == "string") {
            elem = { "A": 0, "G": 1, "C": 2, "T": 3, "U": 3 }[elem];
        }
        else
            elem = Math.abs(elem);
        return nucleoside_colors[elem];
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
        this.bb_ns_distance = 0.8147053;
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
        this.bb_ns_distance = 0.8246211;
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
        this.element_type = AA;
    }
    ;
    elem_to_color(elem) {
        if (typeof elem == "string") {
            elem = { "R": 0, "H": 1, "K": 2, "D": 3, "E": 3, "S": 4, "T": 5, "N": 6, "Q": 7, "C": 8, "U": 9, "G": 10, "P": 11, "A": 12, "V": 13, "I": 14, "L": 15, "M": 16, "F": 17, "Y": 18, "W": 19 }[elem];
        }
        else
            elem = Math.abs(elem);
        return nucleoside_colors[elem];
    }
    ;
    calculatePositions(x, y, z, l) {
        // compute backbone positions/rotations, or set them all to 0 if there is no neighbor.
        let x_sp, y_sp, z_sp, sp_len, rotation_sp;
        if (this.neighbor3 != null && this.neighbor3.local_id < this.local_id) {
            x_sp = (x + x_bb_last) / 2,
                y_sp = (y + y_bb_last) / 2,
                z_sp = (z + z_bb_last) / 2;
            sp_len = Math.sqrt(Math.pow(x - x_bb_last, 2) + Math.pow(y - y_bb_last, 2) + Math.pow(z - z_bb_last, 2));
            rotation_sp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x, y_sp - y, z_sp - z).normalize());
        }
        else {
            x_sp = 0,
                y_sp = 0,
                z_sp = 0;
            sp_len = 0;
            rotation_sp = new THREE.Quaternion(0, 0, 0, 0);
        }
        if (this.neighbor5 != null && this.neighbor5.local_id < this.local_id) { //handle circular strands
            let tmpx_bb_last = this.parent.parent.bb_offsets[this.neighbor5.global_id * 3], tmpy_bb_last = this.parent.parent.bb_offsets[this.neighbor5.global_id * 3 + 1], tmpz_bb_last = this.parent.parent.bb_offsets[this.neighbor5.global_id * 3 + 2];
            let tmpx_sp = (x + tmpx_bb_last) / 2, tmpy_sp = (y + tmpy_bb_last) / 2, tmpz_sp = (z + tmpz_bb_last) / 2;
            let tmpsp_len = Math.sqrt(Math.pow(x - tmpx_bb_last, 2) + Math.pow(y - tmpy_bb_last, 2) + Math.pow(z - tmpz_bb_last, 2));
            let tmprotation_sp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(tmpx_sp - x, tmpy_sp - y, tmpz_sp - z).normalize());
            this.parent.parent.bbcon_offsets[this.neighbor5.global_id * 3] = tmpx_sp;
            this.parent.parent.bbcon_offsets[this.neighbor5.global_id * 3 + 1] = tmpy_sp;
            this.parent.parent.bbcon_offsets[this.neighbor5.global_id * 3 + 2] = tmpz_sp;
            this.parent.parent.bbcon_rotation[this.neighbor5.global_id * 4] = tmprotation_sp.w;
            this.parent.parent.bbcon_rotation[this.neighbor5.global_id * 4 + 1] = tmprotation_sp.z;
            this.parent.parent.bbcon_rotation[this.neighbor5.global_id * 4 + 2] = tmprotation_sp.y;
            this.parent.parent.bbcon_rotation[this.neighbor5.global_id * 4 + 3] = tmprotation_sp.x;
            this.parent.parent.bbcon_scales[this.neighbor5.global_id * 3] = 1;
            this.parent.parent.bbcon_scales[this.neighbor5.global_id * 3 + 1] = tmpsp_len;
            this.parent.parent.bbcon_scales[this.neighbor5.global_id * 3 + 2] = 1;
        }
        // we keep track of cm position, even though we don't draw anything with it.
        this.parent.parent.cm_offsets[this.global_id * 3] = x;
        this.parent.parent.cm_offsets[this.global_id * 3 + 1] = y;
        this.parent.parent.cm_offsets[this.global_id * 3 + 2] = z;
        // we're using the nucleoside meshes for the amino acid backbones
        this.parent.parent.bb_offsets[this.global_id * 3] = 0;
        this.parent.parent.bb_offsets[this.global_id * 3 + 1] = 0;
        this.parent.parent.bb_offsets[this.global_id * 3 + 2] = 0;
        // we're using the nucleoside meshes for the amino acid backbones        
        this.parent.parent.bb_rotation[this.global_id * 4] = 0;
        this.parent.parent.bb_rotation[this.global_id * 4 + 1] = 0;
        this.parent.parent.bb_rotation[this.global_id * 4 + 2] = 0;
        this.parent.parent.bb_rotation[this.global_id * 4 + 3] = 0;
        // set the backbone positions
        this.parent.parent.ns_offsets[this.global_id * 3] = x;
        this.parent.parent.ns_offsets[this.global_id * 3 + 1] = y;
        this.parent.parent.ns_offsets[this.global_id * 3 + 2] = z;
        // these are spheres this time, so rotationally invariant
        this.parent.parent.ns_rotation[this.global_id * 4] = 0;
        this.parent.parent.ns_rotation[this.global_id * 4 + 1] = 0;
        this.parent.parent.ns_rotation[this.global_id * 4 + 2] = 0;
        this.parent.parent.ns_rotation[this.global_id * 4 + 3] = 0;
        // amino acids don't have nucleosides
        this.parent.parent.con_offsets[this.global_id * 3] = 0;
        this.parent.parent.con_offsets[this.global_id * 3 + 1] = 0;
        this.parent.parent.con_offsets[this.global_id * 3 + 2] = 0;
        // amino acids don't have nucleosides
        this.parent.parent.con_rotation[this.global_id * 4] = 0;
        this.parent.parent.con_rotation[this.global_id * 4 + 1] = 0;
        this.parent.parent.con_rotation[this.global_id * 4 + 2] = 0;
        this.parent.parent.con_rotation[this.global_id * 4 + 3] = 0;
        // fill backbone connector positioning array
        this.parent.parent.bbcon_offsets[this.global_id * 3] = x_sp;
        this.parent.parent.bbcon_offsets[this.global_id * 3 + 1] = y_sp;
        this.parent.parent.bbcon_offsets[this.global_id * 3 + 2] = z_sp;
        // fill backbone connector rotation quaternion
        this.parent.parent.bbcon_rotation[this.global_id * 4] = rotation_sp.w;
        this.parent.parent.bbcon_rotation[this.global_id * 4 + 1] = rotation_sp.z;
        this.parent.parent.bbcon_rotation[this.global_id * 4 + 2] = rotation_sp.y;
        this.parent.parent.bbcon_rotation[this.global_id * 4 + 3] = rotation_sp.x;
        this.name = this.global_id + ""; //set name (string) to nucleotide's global id
        // determine the mesh color, either from a supplied colormap json or by the strand ID.
        var color;
        if (lutColsVis) {
            color = lutCols[i];
        }
        else {
            color = this.strand_to_color(this.parent.strand_id);
        }
        // set the backbone colors
        this.parent.parent.bb_colors[this.global_id * 3] = color.r;
        this.parent.parent.bb_colors[this.global_id * 3 + 1] = color.g;
        this.parent.parent.bb_colors[this.global_id * 3 + 2] = color.b;
        // The backbones are nucleosides for proteins
        color = this.elem_to_color(this.type);
        this.parent.parent.ns_colors[this.global_id * 3] = color.r;
        this.parent.parent.ns_colors[this.global_id * 3 + 1] = color.g;
        this.parent.parent.ns_colors[this.global_id * 3 + 2] = color.b;
        // backbones are the only things that use this scale, and we're not using them
        this.parent.parent.scales[this.global_id * 3] = 0;
        this.parent.parent.scales[this.global_id * 3 + 1] = 0;
        this.parent.parent.scales[this.global_id * 3 + 2] = 0;
        // so instead the nucleosides get to be spheres this time.
        this.parent.parent.ns_scales[this.global_id * 3] = 1;
        this.parent.parent.ns_scales[this.global_id * 3 + 1] = 1;
        this.parent.parent.ns_scales[this.global_id * 3 + 2] = 1;
        // except connectors, amino acids don't have connectors.
        this.parent.parent.con_scales[this.global_id * 3] = 0;
        this.parent.parent.con_scales[this.global_id * 3 + 1] = 0;
        this.parent.parent.con_scales[this.global_id * 3 + 2] = 0;
        // but they do have backbones
        this.parent.parent.bbcon_scales[this.global_id * 3] = 1;
        this.parent.parent.bbcon_scales[this.global_id * 3 + 1] = sp_len;
        this.parent.parent.bbcon_scales[this.global_id * 3 + 2] = 1;
        // keep track of last backbone for sugar-phosphate positioning
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
                //let material: THREE.MeshLambertMaterial = this.strand_to_color(this.parent.strand_id);
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
                sp_Mesh.material = this.strand_to_color(this.parent.strand_id);
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
                        back_Mesh.material = this.elem_to_color(this.type);
                }
            }
        }
        if (sp_Mesh != undefined && sp_Mesh instanceof THREE.Mesh) {
            if (sp_Mesh.material instanceof THREE.MeshBasicMaterial || sp_Mesh.material instanceof THREE.MeshLambertMaterial) {
                if (lutColsVis)
                    sp_Mesh.material = tmeshlamb;
                else
                    sp_Mesh.material = this.strand_to_color(this.parent.strand_id);
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
        return new BasicElement(global_id, this);
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
        for (let i = this.children[0].global_id; i <= this.children[this.children.length - 1].global_id; i++) {
            com.add(new THREE.Vector3(this.parent.cm_offsets[i * 3], this.parent.cm_offsets[i * 3 + 1], this.parent.cm_offsets[i * 3 + 2]));
        }
        return (com.multiplyScalar(1 / this[monomers].length));
    }
    translate_strand(amount) {
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
    translate_strand(amount) {
        for (let i = this.children[0].global_id; i <= this.children[this.children.length - 1].global_id; i++) {
            let s = this.parent;
            s.bb_offsets[i * 3] += amount.x;
            s.bb_offsets[i * 3 + 1] += amount.y;
            s.bb_offsets[i * 3 + 2] += amount.z;
            s.ns_offsets[i * 3] += amount.x;
            s.ns_offsets[i * 3 + 1] += amount.y;
            s.ns_offsets[i * 3 + 2] += amount.z;
            s.con_offsets[i * 3] += amount.x;
            s.con_offsets[i * 3 + 1] += amount.y;
            s.con_offsets[i * 3 + 2] += amount.z;
            s.bbcon_offsets[i * 3] += amount.x;
            s.bbcon_offsets[i * 3 + 1] += amount.y;
            s.bbcon_offsets[i * 3 + 2] += amount.z;
            s.cm_offsets[i * 3] += amount.x;
            s.cm_offsets[i * 3 + 1] += amount.y;
            s.cm_offsets[i * 3 + 2] += amount.z;
        }
    }
}
class Peptide extends Strand {
    constructor(id, parent) {
        super(id, parent);
    }
    ;
    create_basicElement(global_id) {
        return new AminoAcid(global_id, this);
    }
    translate_strand(amount) {
        for (let i = this.children[0].global_id; i < this.children[this.children.length - 1].global_id; i++) {
            let s = this.parent;
            s.bb_offsets[i * 3] += amount.x;
            s.bb_offsets[i * 3 + 1] += amount.y;
            s.bb_offsets[i * 3 + 2] += amount.z;
            s.bbcon_offsets[i * 3] += amount.x;
            s.bbcon_offsets[i * 3 + 1] += amount.y;
            s.bbcon_offsets[i * 3 + 2] += amount.z;
            s.cm_offsets[i * 3] += amount.x;
            s.cm_offsets[i * 3 + 1] += amount.y;
            s.cm_offsets[i * 3 + 2] += amount.z;
        }
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
        for (let i = 0; i < this.INSTANCES; i++) {
            com.add(new THREE.Vector3(this.cm_offsets[i * 3], this.cm_offsets[i * 3 + 1], this.cm_offsets[i * 3 + 2]));
        }
        return (com.multiplyScalar(1 / this.INSTANCES));
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
    //THIS ONLY WORKS FOR NUCLEOTIDES.  NEEDS TO BE FIXED FOR OTHER THINGS
    translate_system(amount) {
        for (let i = 0; i < this.INSTANCES; i++) {
            this.bb_offsets[i * 3] += amount.x;
            this.bb_offsets[i * 3 + 1] += amount.y;
            this.bb_offsets[i * 3 + 2] += amount.z;
            this.ns_offsets[i * 3] += amount.x;
            this.ns_offsets[i * 3 + 1] += amount.y;
            this.ns_offsets[i * 3 + 2] += amount.z;
            this.con_offsets[i * 3] += amount.x;
            this.con_offsets[i * 3 + 1] += amount.y;
            this.con_offsets[i * 3 + 2] += amount.z;
            this.bbcon_offsets[i * 3] += amount.x;
            this.bbcon_offsets[i * 3 + 1] += amount.y;
            this.bbcon_offsets[i * 3 + 2] += amount.z;
            this.cm_offsets[i * 3] += amount.x;
            this.cm_offsets[i * 3 + 1] += amount.y;
            this.cm_offsets[i * 3 + 2] += amount.z;
        }
        this.backbone.geometry.attributes.instanceOffset.needsUpdate = true;
        this.nucleoside.geometry.attributes.instanceOffset.needsUpdate = true;
        this.connector.geometry.attributes.instanceOffset.needsUpdate = true;
        this.bbconnector.geometry.attributes.instanceOffset.needsUpdate = true;
        render();
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
