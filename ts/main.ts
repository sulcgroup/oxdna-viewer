/// <reference path="./three/index.d.ts" />

// store rendering mode RNA  
var RNA_MODE = false; // By default we do DNA base spacing
// add base index visualistion
var elements: BasicElement[] = []; //contains references to all BasicElements
//initialize the space
var systems: System[] = [];
var sys_count: number = 0;
var strand_count: number = 0;
var nuc_count: number = 0;
var selected_bases = new Set<BasicElement>();

var backbones: THREE.Object3D[] = [];
var lut, devs: number[]; //need for Lut coloring

var DNA: number = 0;
var RNA: number = 1;
var AA: number = 2;

//some developers declare a new i in their for loops.  Some don't and reuse this one...is one better than the other?
var i: number;

//makes for cleaner references down the object hierarcy
var strands = 'children',
    monomers = 'children',
    objects = 'children';

var editHistory = new EditHistory();

render();

// elements store the information about position, orientation, ID
class BasicElement extends THREE.Group{
    local_id: number;
    global_id: number; //location in world - all systems
    pos: THREE.Vector3; //not automatically updated; updated before rotation
    neighbor3: BasicElement | null;
    neighbor5: BasicElement | null;
    pair: number;
    elem_type: number | string; // 0:A 1:G 2:C 3:T/U OR 1 of 20 amino acids
    parent: Strand;
    bb_ns_distance : number;
    element_type: number = -1;
    cluster_id: number;

    constructor(global_id: number, parent: Strand) {
        super();
        this.global_id = global_id;
        this.parent = parent;
    };

    calculatePositions(l: string) {

    };

    calculateNewConfigPositions(l: string) {

    };

    updateSP(num: number): THREE.Object3D {
        return new THREE.Object3D();
    };

    toggle() {

    };

    strand_to_color(strandIndex: number) {
        return backbone_colors[(Math.abs(strandIndex) + this.parent.parent.system_id) % backbone_colors.length];
    };

    elem_to_color(type: number | string): THREE.Color {
        return new THREE.Color();
    };

    getDatFileOutput(): string {
        return "";
    };

    resetColor(overlay) {

    };

    set_position(new_pos: THREE.Vector3) {

    }

    translate_position(amount: THREE.Vector3) {

    }

    rotate(quat: THREE.Quaternion) {

    }

    //retrieve this element's values in a 3-parameter instance array
    //positions, scales, colors
    get_instance_parameter3(name: string) {
        let sys = this.parent.parent;
        let sid = this.global_id - sys.global_start_id;

        let x: number = sys[name][sid * 3];
        let y: number = sys[name][sid * 3 + 1];
        let z: number = sys[name][sid * 3 + 2];

        return new THREE.Vector3(x, y, z);
    }

    //retrieve this element's values in a 4-parameter instance array
    //only rotations
    get_instance_parameter4(name: string) {
        let sys = this.parent.parent;
        let sid = this.global_id - sys.global_start_id;

        let x: number = sys[name][sid * 4];
        let y: number = sys[name][sid * 4 + 1];
        let z: number = sys[name][sid * 4 + 2];
        let w: number = sys[name][sid * 4 + 3]

        return new THREE.Vector4(x, y, z, w);
    }

    //set this element's parameters in the system's instance arrays
    //doing this is slower than sys.fill_vec(), but makes cleaner code sometimes
    set_instance_parameter(name:string, data) {
        let sys = this.parent.parent;
        let sid = this.global_id - sys.global_start_id;
        
        sys.fill_vec(name, data.length, sid, data);
    }

    //poof
    toggle_visibility() {
        let sys = this.parent.parent
        let sid = this.global_id - sys.global_start_id

        let visibility = this.get_instance_parameter3('visibility');
        visibility.addScalar(-1);

        sys.fill_vec('visibility', 3, sid, [Math.abs(visibility.x), Math.abs(visibility.y), Math.abs(visibility.z)]);
    }
};

class Nucleotide extends BasicElement {
    constructor(global_id: number, parent: Strand) {
        super(global_id, parent);
    };
    calculatePositions(l: string) {

        let sys = this.parent.parent
        let sid = this.global_id - sys.global_start_id

        //extract position
        let x = parseFloat(l[0]),
            y = parseFloat(l[1]),
            z = parseFloat(l[2]);

        // extract axis vector a1 (backbone vector) and a3 (stacking vector) 
        let x_a1 = parseFloat(l[3]),
            y_a1 = parseFloat(l[4]),
            z_a1 = parseFloat(l[5]),
            x_a3 = parseFloat(l[6]),
            y_a3 = parseFloat(l[7]),
            z_a3 = parseFloat(l[8]);

        // according to base.py a2 is the cross of a1 and a3
        let [x_a2, y_a2, z_a2] = cross(x_a1, y_a1, z_a1, x_a3, y_a3, z_a3);
        
        // compute backbone position
        let x_bb: number = 0;
        let y_bb: number = 0;
        let z_bb: number = 0;
        let bbpos: THREE.Vector3 = this.calcBBPos(x, y, z, x_a1, y_a1, z_a1, x_a2, y_a2, z_a2, x_a3, y_a3, z_a3);
        x_bb = bbpos.x;
        y_bb = bbpos.y;
        z_bb = bbpos.z;

        // compute nucleoside cm
        let x_ns = x + 0.4 * x_a1,
            y_ns = y + 0.4 * y_a1,
            z_ns = z + 0.4 * z_a1;

        // compute nucleoside rotation
        let base_rotation = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(x_a3, y_a3, z_a3));

        //compute connector position
        let x_con = (x_bb + x_ns) / 2,
            y_con = (y_bb + y_ns) / 2,
            z_con = (z_bb + z_ns) / 2;

        // compute connector rotation
        let rotation_con = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), 
            new THREE.Vector3(x_con - x_ns, y_con - y_ns, z_con - z_ns).normalize());               

        // compute sugar-phosphate positions/rotations, or set them all to 0 if there is no sugar-phosphate.
        let x_sp, y_sp, z_sp, sp_len, rotation_sp;
        if (this.neighbor3 != null && this.neighbor3.local_id < this.local_id) {
            x_sp = (x_bb + x_bb_last) / 2, 
            y_sp = (y_bb + y_bb_last) / 2,
            z_sp = (z_bb + z_bb_last) / 2;

            sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
        
            rotation_sp = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize()
            );
        }
        else {
            x_sp = 0,
            y_sp = 0,
            z_sp = 0;

            sp_len = 0;

            rotation_sp = new THREE.Quaternion(0, 0, 0, 0);
        }

        //handle circular strands
        if (this.neighbor5 != null && this.neighbor5.local_id < this.local_id) {
            let tmpx_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3],
            tmpy_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3 + 1],
            tmpz_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3 + 2];            

            let tmpx_sp = (x_bb + tmpx_bb_last) / 2, 
            tmpy_sp = (y_bb + tmpy_bb_last) / 2,
            tmpz_sp = (z_bb + tmpz_bb_last) / 2;

            let tmpsp_len = Math.sqrt(Math.pow(x_bb - tmpx_bb_last, 2) + Math.pow(y_bb - tmpy_bb_last, 2) + Math.pow(z_bb - tmpz_bb_last, 2));

            let tmprotation_sp = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0), new THREE.Vector3(tmpx_sp - x_bb, tmpy_sp - y_bb, tmpz_sp - z_bb).normalize()
            );
            sys.fill_vec('bbcon_offsets', 3, sid, [tmpx_sp, tmpy_sp, tmpz_sp]);
            sys.fill_vec('bbcon_rotation', 4, sid, [tmprotation_sp.w, tmprotation_sp.z, tmprotation_sp.y, tmprotation_sp.x]);
            sys.fill_vec('bbcon_scales', 3, sid, [1, tmpsp_len, 1]);            
        }

        // determine the mesh color, either from a supplied colormap json or by the strand ID.
        let color = new THREE.Color;
        color = this.strand_to_color(this.parent.strand_id);

        let idColor = new THREE.Color();
        idColor.setHex(this.global_id+1); //has to be +1 or you can't grab nucleotide 0
    

        //fill the instance matrices with data
        this.name = this.global_id + ""; //set name (string) to nucleotide's global id
        sys.fill_vec('cm_offsets', 3, sid, [x, y, z]);
        sys.fill_vec('bb_offsets', 3, sid, [x_bb, y_bb, z_bb]);
        sys.fill_vec('ns_offsets', 3, sid, [x_ns, y_ns, z_ns]);
        sys.fill_vec('ns_offsets', 3, sid, [x_ns, y_ns, z_ns]);
        sys.fill_vec('ns_rotation', 4, sid, [base_rotation.w, base_rotation.z, base_rotation.y, base_rotation.x]);
        sys.fill_vec('con_offsets', 3, sid, [x_con, y_con, z_con]);
        sys.fill_vec('con_rotation', 4, sid, [rotation_con.w, rotation_con.z, rotation_con.y, rotation_con.x]);
        sys.fill_vec('bbcon_offsets', 3, sid, [x_sp, y_sp, z_sp]);
        sys.fill_vec('bbcon_rotation', 4, sid, [rotation_sp.w, rotation_sp.z, rotation_sp.y, rotation_sp.x]);
        sys.fill_vec('bb_colors', 3, sid, [color.r, color.g, color.b]);
        sys.fill_vec('scales', 3, sid, [1, 1, 1]);
        sys.fill_vec('ns_scales', 3, sid, [0.7, 0.3, 0.7]);
        sys.fill_vec('con_scales', 3, sid, [1, this.bb_ns_distance, 1]);
        sys.fill_vec('bbcon_scales', 3, sid, [1, sp_len, 1]);
        sys.fill_vec('visibility', 3, sid, [1,1,1]);

        color = this.elem_to_color(this.type);
        sys.fill_vec('ns_colors', 3, sid, [color.r, color.g, color.b]);

        sys.fill_vec('bb_labels', 3, sid, [idColor.r, idColor.g, idColor.b]);

        // keep track of last backbone for sugar-phosphate positioning
        x_bb_last = x_bb;
        y_bb_last = y_bb;
        z_bb_last = z_bb;
    };

    translate_position(amount: THREE.Vector3) {
        let sys = this.parent.parent;
        let id = (this.global_id - sys.global_start_id)*3;

        sys.bb_offsets[id] += amount.x;
        sys.bb_offsets[id + 1] += amount.y;
        sys.bb_offsets[id + 2] += amount.z;

        sys.ns_offsets[id] += amount.x;
        sys.ns_offsets[id + 1] += amount.y;
        sys.ns_offsets[id + 2] += amount.z;

        sys.con_offsets[id] += amount.x;
        sys.con_offsets[id + 1] += amount.y;
        sys.con_offsets[id + 2] += amount.z;

        sys.bbcon_offsets[id] += amount.x;
        sys.bbcon_offsets[id + 1] += amount.y;
        sys.bbcon_offsets[id + 2] += amount.z;

        sys.cm_offsets[id] += amount.x;
        sys.cm_offsets[id + 1] += amount.y;
        sys.cm_offsets[id + 2] += amount.z;
    }

    //different in DNA and RNA
    calcBBPos(x: number, y: number, z: number, x_a1: number, y_a1: number, z_a1: number, x_a2: number, y_a2: number, z_a2: number, x_a3: number, y_a3: number, z_a3: number): THREE.Vector3 {
        return new THREE.Vector3(x, y, z);
    };

    calculateNewConfigPositions(l: string) {
        let sys = this.parent.parent
        let sid = this.global_id - sys.global_start_id

        //extract position
        let x = parseFloat(l[0]),
            y = parseFloat(l[1]),
            z = parseFloat(l[2]);

        // extract axis vector a1 (backbone vector) and a3 (stacking vector) 
        let x_a1 = parseFloat(l[3]),
            y_a1 = parseFloat(l[4]),
            z_a1 = parseFloat(l[5]),
            x_a3 = parseFloat(l[6]),
            y_a3 = parseFloat(l[7]),
            z_a3 = parseFloat(l[8]);

        // a2 is perpendicular to a1 and a3
        let [x_a2, y_a2, z_a2] = cross(x_a1, y_a1, z_a1, x_a3, y_a3, z_a3);
        // compute backbone cm
        let x_bb: number = 0;
        let y_bb: number = 0;
        let z_bb: number = 0;
        let bbpos: THREE.Vector3 = this.calcBBPos(x, y, z, x_a1, y_a1, z_a1, x_a2, y_a2, z_a2, x_a3, y_a3, z_a3);
        x_bb = bbpos.x;
        y_bb = bbpos.y;
        z_bb = bbpos.z;

        // compute nucleoside cm
        let x_ns = x + 0.4 * x_a1,
            y_ns = y + 0.4 * y_a1,
            z_ns = z + 0.4 * z_a1;

        //compute connector position
        let x_con = (x_bb + x_ns) / 2,
            y_con = (y_bb + y_ns) / 2,
            z_con = (z_bb + z_ns) / 2;

        //correctly display stacking interactions
        let base_rotation = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(x_a3, y_a3, z_a3));

        // compute connector rotation
        let rotation_con = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), 
            new THREE.Vector3(x_bb - x_ns, y_bb - y_ns, z_bb - z_ns).normalize());

        // compute sugar-phosphate positions/rotations, or set them all to 0 if there is no sugar-phosphate.
        let x_sp, y_sp, z_sp, sp_len, rotation_sp;
        if (this.neighbor3 != null && this.neighbor3.local_id < this.local_id) {
            x_sp = (x_bb + x_bb_last) / 2, 
            y_sp = (y_bb + y_bb_last) / 2,
            z_sp = (z_bb + z_bb_last) / 2;

            sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
        
            rotation_sp = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize());
        }
        else {
            x_sp = 0,
            y_sp = 0,
            z_sp = 0;

            sp_len = 0;

            rotation_sp = new THREE.Quaternion(0, 0, 0, 0);
        }

        //handle circular strands
        if (this.neighbor5 != null && this.neighbor5.local_id < this.local_id) { //handle circular strands
            let tmpx_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3],
            tmpy_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3 + 1],
            tmpz_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3 + 2];            

            let tmpx_sp = (x_bb + tmpx_bb_last) / 2, 
            tmpy_sp = (y_bb + tmpy_bb_last) / 2,
            tmpz_sp = (z_bb + tmpz_bb_last) / 2;

            let tmpsp_len = Math.sqrt(Math.pow(x_bb - tmpx_bb_last, 2) + Math.pow(y_bb - tmpy_bb_last, 2) + Math.pow(z_bb - tmpz_bb_last, 2));

            let tmprotation_sp = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0), new THREE.Vector3(tmpx_sp - x_bb, tmpy_sp - y_bb, tmpz_sp - z_bb).normalize()
            );

            sys.fill_vec('bbcon_offsets', 3, sid, [tmpx_sp, tmpy_sp, tmpz_sp]);
            sys.fill_vec('bbcon_rotation', 4, sid, [tmprotation_sp.w, tmprotation_sp.z, tmprotation_sp.y, tmprotation_sp.x]);
            sys.fill_vec('bbcon_scales', 3, sid, [1, tmpsp_len, 1]);
        }

        //update the relevant instancing matrices
        sys.fill_vec('cm_offsets', 3, sid, [x, y, z]);
        sys.fill_vec('bb_offsets', 3, sid, [x_bb, y_bb, z_bb]);
        sys.fill_vec('ns_offsets', 3, sid, [x_ns, y_ns, z_ns]);
        sys.fill_vec('ns_rotation', 4, sid, [base_rotation.w, base_rotation.z, base_rotation.y, base_rotation.x]);
        sys.fill_vec('con_offsets', 3, sid, [x_con, y_con, z_con]);
        sys.fill_vec('con_rotation', 4, sid, [rotation_con.w, rotation_con.z, rotation_con.y, rotation_con.x]);
        sys.fill_vec('bbcon_offsets', 3, sid, [x_sp, y_sp, z_sp]);
        sys.fill_vec('bbcon_rotation', 4, sid, [rotation_sp.w, rotation_sp.z, rotation_sp.y, rotation_sp.x]);
        sys.fill_vec('bbcon_scales', 3, sid, [1, sp_len, 1]);


        // keep track of last backbone for sugar-phosphate positioning
        x_bb_last = x_bb;
        y_bb_last = y_bb;
        z_bb_last = z_bb;

    };

    resetColor(overlay) {
        let sys = this.parent.parent
        let sid = this.global_id - sys.global_start_id
        //recalculate Mesh's proper coloring and set Mesh material on scene to proper material
        let color: THREE.Color;
        if (overlay) {
            color = sys.lutCols[sid];
        }
        else {
            color = this.strand_to_color(this.parent.strand_id);
        }
        sys.fill_vec('bb_colors', 3, sid, [color.r, color.g, color.b]);
    }


    toggle() {
        let sys = this.parent.parent
        let sid = this.global_id - sys.global_start_id

        // highlight/remove highlight the bases we've clicked from the list and modify color
        if (selected_bases.has(this)) {
            this.resetColor(<HTMLInputElement>document.getElementById("lutToggle")["checked"]);
            selected_bases.delete(this);
        }
        else {
            sys.fill_vec('bb_colors', 3, sid, [selection_color.r, selection_color.g, selection_color.b]);
            selected_bases.add(this);
        }
    };

    elem_to_color(elem: number | string): THREE.Color {
        elem = { "A": 0, "G": 1, "C": 2, "T": 3, "U": 3 }[elem];
        if (elem ==undefined){
            return grey
        }
        return nucleoside_colors[elem];
    };

    getDatFileOutput(): string {
        let dat: string = "";
        let tempVec = this.get_instance_parameter3("cm_offsets"); //nucleotide's center of mass in world
        let x: number = tempVec.x;
        let y: number = tempVec.y;
        let z: number = tempVec.z;
        tempVec = this.get_instance_parameter3("bb_offsets");
        let x_bb: number = tempVec.x;
        let y_bb: number = tempVec.y;
        let z_bb: number = tempVec.z;
        tempVec = this.get_instance_parameter3("ns_offsets"); //nucleotide's nucleoside's world position
        let x_ns: number = tempVec.x;
        let y_ns: number = tempVec.y;
        let z_ns: number = tempVec.z;
        let x_a1: number;
        let y_a1: number;
        let z_a1: number;
        //calculate axis vector a1 (backbone vector) and a3 (stacking vector)
        x_a1 = (x_ns - x) / 0.4;
        y_a1 = (y_ns - y) / 0.4;
        z_a1 = (z_ns - z) / 0.4;
        let a3: THREE.Vector3 = this.getA3(x_bb, y_bb, z_bb, x, y, z, x_a1, y_a1, z_a1);
        let x_a3: number = a3.x;
        let y_a3: number = a3.y;
        let z_a3: number = a3.z;
        dat = x + " " + y + " " + z + " " + x_a1 + " " + y_a1 + " " + z_a1 + " " + x_a3 + " " + y_a3 +
            " " + z_a3 + " 0 0 0 0 0 0" + "\n"; //add all locations to dat file string
        return dat;
    };
    getA3(x_bb: number, y_bb: number, z_bb: number, x: number, y: number, z: number, x_a1: number, y_a1: number, z_a1: number): THREE.Vector3 {
        return new THREE.Vector3();
    };
};

class DNANucleotide extends Nucleotide {
    constructor(global_id: number, parent: Strand) {
        super(global_id, parent);
        this.element_type = DNA;
        this.bb_ns_distance = 0.8147053;
    };
    calcBBPos(x: number, y: number, z: number, x_a1: number, y_a1: number, z_a1: number, x_a2: number, y_a2: number, z_a2: number, x_a3: number, y_a3: number, z_a3: number): THREE.Vector3 {
        let x_bb = x - (0.34 * x_a1 + 0.3408 * x_a2),
            y_bb = y - (0.34 * y_a1 + 0.3408 * y_a2),
            z_bb = z - (0.34 * z_a1 + 0.3408 * z_a2);
        return new THREE.Vector3(x_bb, y_bb, z_bb);
    };
    getA3(x_bb: number, y_bb: number, z_bb: number, x: number, y: number, z: number, x_a1: number, y_a1: number, z_a1: number): THREE.Vector3 {
        let x_a2: number;
        let y_a2: number;
        let z_a2: number;
        x_a2 = ((x_bb - x) + (0.34 * x_a1)) / (-0.3408);
        y_a2 = ((y_bb - y) + (0.34 * y_a1)) / (-0.3408);
        z_a2 = ((z_bb - z) + (0.34 * z_a1)) / (-0.3408);

        let a3: number[] = divAndNeg(cross(x_a1, y_a1, z_a1, x_a2, y_a2, z_a2), dot(x_a1, y_a1, z_a1, x_a1, y_a1, z_a1));
        let x_a3 = a3[0]; let y_a3 = a3[1]; let z_a3 = a3[2];
        return new THREE.Vector3(x_a3, y_a3, z_a3);
    };
};

class RNANucleotide extends Nucleotide {
    constructor(global_id: number, parent: Strand) {
        super(global_id, parent);
        this.element_type = RNA;
        this.bb_ns_distance = 0.8246211;

    };

    calcBBPos(x: number, y: number, z: number, x_a1: number, y_a1: number, z_a1: number, x_a2: number, y_a2: number, z_a2: number, x_a3: number, y_a3: number, z_a3: number): THREE.Vector3 {
        let x_bb = x - (0.4 * x_a1 + 0.2 * x_a3),
            y_bb = y - (0.4 * y_a1 + 0.2 * y_a3),
            z_bb = z - (0.4 * z_a1 + 0.2 * z_a3);
        return new THREE.Vector3(x_bb, y_bb, z_bb);
    };

    getA3(x_bb: number, y_bb: number, z_bb: number, x: number, y: number, z: number, x_a1: number, y_a1: number, z_a1: number): THREE.Vector3 {
        let x_a3 = ((x_bb - x) + (0.4 * x_a1)) / (-0.2);
        let y_a3 = ((y_bb - y) + (0.4 * y_a1)) / (-0.2);
        let z_a3 = ((z_bb - z) + (0.4 * z_a1)) / (-0.2);
        return new THREE.Vector3(x_a3, y_a3, z_a3);
    };
};
class AminoAcid extends BasicElement {
    constructor(global_id: number, parent: Strand) {
        super(global_id, parent);
        this.element_type = AA;
    };

    elem_to_color(elem: number | string): THREE.Color {
        elem = { "R": 0, "H": 1, "K": 2, "D": 3, "E": 3, "S": 4, "T": 5, "N": 6, "Q": 7, "C": 8, "U": 9, "G": 10, "P": 11, "A": 12, "V": 13, "I": 14, "L": 15, "M": 16, "F": 17, "Y": 18, "W": 19 }[elem];
        if (elem == undefined) return grey
        return nucleoside_colors[elem];
    };

    calculatePositions(l: string) {
        let sys = this.parent.parent;
        let sid = this.global_id - sys.global_start_id;

        //extract position
        let x = parseFloat(l[0]),
            y = parseFloat(l[1]),
            z = parseFloat(l[2]);

        // compute backbone positions/rotations, or set them all to 0 if there is no neighbor.
        let x_sp, y_sp, z_sp, sp_len, rotation_sp;
        if (this.neighbor3 != null && this.neighbor3.local_id < this.local_id) {
            x_sp = (x + x_bb_last) / 2,
                y_sp = (y + y_bb_last) / 2,
                z_sp = (z + z_bb_last) / 2;

            sp_len = Math.sqrt(Math.pow(x - x_bb_last, 2) + Math.pow(y - y_bb_last, 2) + Math.pow(z - z_bb_last, 2));

            rotation_sp = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x, y_sp - y, z_sp - z).normalize()
            );
        }
        else {
            x_sp = 0,
                y_sp = 0,
                z_sp = 0;

            sp_len = 0;

            rotation_sp = new THREE.Quaternion(0, 0, 0, 0);
        }

        //handle circular strands
        if (this.neighbor5 != null && this.neighbor5.local_id < this.local_id) {
            let tmpx_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3],
            tmpy_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3 + 1],
            tmpz_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3 + 2];            

            let tmpx_sp = (x + tmpx_bb_last) / 2, 
            tmpy_sp = (y + tmpy_bb_last) / 2,
            tmpz_sp = (z + tmpz_bb_last) / 2;

            let tmpsp_len = Math.sqrt(Math.pow(x - tmpx_bb_last, 2) + Math.pow(y - tmpy_bb_last, 2) + Math.pow(z - tmpz_bb_last, 2));

            let tmprotation_sp = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0), new THREE.Vector3(tmpx_sp - x, tmpy_sp - y, tmpz_sp - z).normalize()
            );

            sys.fill_vec('bbcon_offsets', 3, sid, [tmpx_sp, tmpy_sp, tmpz_sp]);
            sys.fill_vec('bbcon_rotation', 4, sid, [tmprotation_sp.w, tmprotation_sp.z, tmprotation_sp.y, tmprotation_sp.x]);
            sys.fill_vec('bbcon_scales', 3, sid, [1, tmpsp_len, 1]);            
        }

        // determine the mesh color, either from a supplied colormap json or by the strand ID.
        let color = new THREE.Color();
        color = this.strand_to_color(this.parent.strand_id);
        let idColor = new THREE.Color();
        idColor.setHex(this.global_id+1); //has to be +1 or you can't grab nucleotide 0

        // fill in the instancing matrices
        this.name = this.global_id + ""; //set name (string) to nucleotide's global id
        sys.fill_vec('cm_offsets', 3, sid, [x, y, z]);
        sys.fill_vec('bb_offsets', 3, sid, [x, y, z]);
        sys.fill_vec('bb_rotation', 4, sid, [0, 0, 0, 0]);
        sys.fill_vec('ns_offsets', 3, sid, [x, y, z]);
        sys.fill_vec('ns_rotation', 4, sid, [0, 0, 0, 0]);
        sys.fill_vec('con_offsets', 3, sid, [0, 0, 0]);        
        sys.fill_vec('con_rotation', 4, sid, [0, 0, 0, 0]);
        sys.fill_vec('bbcon_offsets', 3, sid, [x_sp, y_sp, z_sp]);
        sys.fill_vec('bbcon_rotation', 4, sid, [rotation_sp.w, rotation_sp.z, rotation_sp.y, rotation_sp.x]);
        sys.fill_vec('scales', 3, sid, [0, 0, 0]);     
        sys.fill_vec('ns_scales', 3, sid, [1, 1, 1]);       
        sys.fill_vec('con_scales', 3, sid, [0, 0, 0]); 
        sys.fill_vec('bbcon_scales', 3, sid, [1, sp_len, 1]);      
        sys.fill_vec('bb_colors', 3, sid, [color.r, color.g, color.b]);
        sys.fill_vec('visibility', 3, sid, [1,1,1]);

        color = this.elem_to_color(this.type);
        sys.fill_vec('ns_colors', 3, sid, [color.r, color.g, color.b]);
        
        sys.fill_vec('bb_labels', 3, sid, [idColor.r, idColor.g, idColor.b]);

        // keep track of last backbone for sugar-phosphate positioning
        x_bb_last = x;
        y_bb_last = y;
        z_bb_last = z;
    };
    calculateNewConfigPositions(l: string) {
        let sys = this.parent.parent;
        let sid = this.global_id - sys.global_start_id;

        //extract position
        let x = parseFloat(l[0]),
            y = parseFloat(l[1]),
            z = parseFloat(l[2]);

        //calculate new backbone connector position/rotation
        let x_sp, y_sp, z_sp, sp_len, rotation_sp;
        if (this.neighbor3 != null && this.neighbor3.local_id < this.local_id) {
            x_sp = (x + x_bb_last) / 2,
                y_sp = (y + y_bb_last) / 2,
                z_sp = (z + z_bb_last) / 2;

            sp_len = Math.sqrt(Math.pow(x - x_bb_last, 2) + Math.pow(y - y_bb_last, 2) + Math.pow(z - z_bb_last, 2));

            rotation_sp = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x, y_sp - y, z_sp - z).normalize()
            );
        }
        else {
            x_sp = 0,
                y_sp = 0,
                z_sp = 0;

            sp_len = 0;

            rotation_sp = new THREE.Quaternion(0, 0, 0, 0);
        }

        //handle circular strands
        if (this.neighbor5 != null && this.neighbor5.local_id < this.local_id) {
            let tmpx_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3],
            tmpy_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3 + 1],
            tmpz_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3 + 2];            

            let tmpx_sp = (x + tmpx_bb_last) / 2, 
            tmpy_sp = (y + tmpy_bb_last) / 2,
            tmpz_sp = (z + tmpz_bb_last) / 2;

            let tmpsp_len = Math.sqrt(Math.pow(x - tmpx_bb_last, 2) + Math.pow(y - tmpy_bb_last, 2) + Math.pow(z - tmpz_bb_last, 2));

            let tmprotation_sp = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0), new THREE.Vector3(tmpx_sp - x, tmpy_sp - y, tmpz_sp - z).normalize()
            );

            sys.fill_vec('bbcon_offsets', 3, sid, [tmpx_sp, tmpy_sp, tmpz_sp]);
            sys.fill_vec('bbcon_rotation', 4, sid, [tmprotation_sp.w, tmprotation_sp.z, tmprotation_sp.y, tmprotation_sp.x]);
            sys.fill_vec('bbcon_scales', 3, sid, [1, tmpsp_len, 1]);   
        }

        sys.fill_vec('cm_offsets', 3, sid, [x, y, z]);
        sys.fill_vec('bb_offsets', 3, sid, [x, y, z]);
        sys.fill_vec('ns_offsets', 3, sid, [x, y, z]);
        sys.fill_vec('bbcon_offsets', 3, sid, [x_sp, y_sp, z_sp]);
        sys.fill_vec('bbcon_rotation', 4, sid, [rotation_sp.w, rotation_sp.z, rotation_sp.y, rotation_sp.x]);
        sys.fill_vec('bbcon_scales', 3, sid, [1, sp_len, 1]);  
        
        x_bb_last = x;
        y_bb_last = y;
        z_bb_last = z;
    };

    translate_position(amount: THREE.Vector3) {
        let sys = this.parent.parent;
        let id = (this.global_id - sys.global_start_id)*3;

        sys.bb_offsets[id] += amount.x;
        sys.bb_offsets[id + 1] += amount.y;
        sys.bb_offsets[id + 2] += amount.z;

        sys.ns_offsets[id] += amount.x;
        sys.ns_offsets[id + 1] += amount.y;
        sys.ns_offsets[id + 2] += amount.z;

        sys.bbcon_offsets[id] += amount.x;
        sys.bbcon_offsets[id + 1] += amount.y;
        sys.bbcon_offsets[id + 2] += amount.z;

        sys.cm_offsets[id] += amount.x;
        sys.cm_offsets[id + 1] += amount.y;
        sys.cm_offsets[id + 2] += amount.z;
    }

    resetColor(overlay) {
        let sys = this.parent.parent
        let sid = this.global_id - sys.global_start_id
        //recalculate Mesh's proper coloring and set Mesh material on scene to proper material
        let bb_color: THREE.Color;
        let aa_color: THREE.Color;
        if (overlay) {
            bb_color = sys.lutCols[this.global_id];
        }
        else {
            bb_color = this.strand_to_color(this.parent.strand_id);
        }
        aa_color = this.elem_to_color(this.type);
        sys.fill_vec('bb_colors', 3, sid, [bb_color.r, bb_color.g, bb_color.b]);
        sys.fill_vec('ns_colors', 3, sid, [aa_color.r, aa_color.g, aa_color.b]);
    };

    toggle() {
        let sys = this.parent.parent
        let sid = this.global_id - sys.global_start_id

        if (selected_bases.has(this)) { //if clicked nucleotide is already selected
            this.resetColor(<HTMLInputElement>document.getElementById("lutToggle")["checked"]);
            selected_bases.delete(this); //"unselect" nucletide by setting value in selected_bases array at nucleotideID to 0
        }
        else {
            sys.fill_vec('bb_colors', 3, sid, [selection_color.r, selection_color.g, selection_color.b]);
            sys.fill_vec('ns_colors', 3, sid, [selection_color.r, selection_color.g, selection_color.b]);
            selected_bases.add(this); //"select" nucletide by adding it to the selected base list
        }
    };

    getDatFileOutput(): string {
        let dat: string = "";
        let tempVec = this.get_instance_parameter3("cm_offsets");
        let x: number = tempVec.x;
        let y: number = tempVec.y;
        let z: number = tempVec.z;
        dat = x + " " + y + " " + z + "1.0 1.0 0.0 0.0 0.0 -1.0 0.0 0.0 0.0 0.0 0.0 0.0" + "\n"; //add all locations to dat file string
        return dat;
    };
};

// strands are made up of elements
// strands have an ID within the system
class Strand extends THREE.Group {

    strand_id: number; //system location
    parent: System;
    pos: THREE.Vector3;

    constructor(id: number, parent: System) {
        super();
        this.strand_id = id;
        this.parent = parent;
    };

    //POINT OF CONCERN FOR LATER: NEED TO SOMEHOW ADD THIS TO ARRAYS
    //DO WE JUST MAKE ALL NEW THINGS IN THEIR OWN SYSTEM??
    //AND THEN HAVE SOME COMPLICATED STUFF TO MAKE THEM BEHAVE?
    add_basicElement(elem: BasicElement) {
        this[monomers].push(elem);
        elem.parent = this;
    };

    create_basicElement(global_id: number): BasicElement {
        return new BasicElement(global_id, this);
    }

    remove_basicElement(to_remove: number) {
        for (let i = 0; i < this[monomers].length; i++) {
            let n = this[monomers][i];
            if (n.global_id == to_remove) { //changed from local to global id
                scene.remove(n);
                n = null;
            }
        }
    };

    exclude_Elements(elements: BasicElement[]) {
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
    };

    get_com() {
        let com = new THREE.Vector3(0, 0, 0);
        for (let i = ((this[monomers][0] as BasicElement).global_id - this.parent.global_start_id) * 3; i <= ((this[monomers][this[monomers].length-1] as BasicElement).global_id - this.parent.global_start_id) * 3; i+=3){
            com.add(new THREE.Vector3(this.parent.cm_offsets[i], this.parent.cm_offsets[i+1], this.parent.cm_offsets[i+2]));
        }
        return(com.multiplyScalar(1/this[monomers].length))
    };

    translate_strand(amount: THREE.Vector3) {

    };
};

class NucleicAcidStrand extends Strand {
    constructor(id: number, parent: System) {
        super(id, parent);
    };

    create_basicElement(global_id: number) {
        if (RNA_MODE)
            return new RNANucleotide(global_id, this);
        else
            return new DNANucleotide(global_id, this);
    };

    translate_strand(amount: THREE.Vector3) {
        let s = this.parent;
        for (let i = ((this[monomers][0] as Nucleotide).global_id - this.parent.global_start_id) * 3; i <= ((this[monomers][this[monomers].length-1] as Nucleotide).global_id - this.parent.global_start_id) * 3; i+=3){
            s.bb_offsets[i] += amount.x;
            s.bb_offsets[i + 1] += amount.y;
            s.bb_offsets[i + 2] += amount.z;

            s.ns_offsets[i] += amount.x;
            s.ns_offsets[i + 1] += amount.y;
            s.ns_offsets[i + 2] += amount.z;

            s.con_offsets[i] += amount.x;
            s.con_offsets[i + 1] += amount.y;
            s.con_offsets[i + 2] += amount.z;

            s.bbcon_offsets[i] += amount.x;
            s.bbcon_offsets[i + 1] += amount.y;
            s.bbcon_offsets[i + 2] += amount.z;

            s.cm_offsets[i] += amount.x;
            s.cm_offsets[i + 1] += amount.y;
            s.cm_offsets[i + 2] += amount.z;
        } 
        s.backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
        s.nucleoside.geometry["attributes"].instanceOffset.needsUpdate = true;
        s.connector.geometry["attributes"].instanceOffset.needsUpdate = true;
        s.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
        s.dummy_backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
    }
}
class Peptide extends Strand {
    constructor(id: number, parent: System) {
        super(id, parent);
    };

    create_basicElement(global_id: number) {
        return new AminoAcid(global_id, this);
    };

    translate_strand(amount: THREE.Vector3) {
        let s = this.parent;
        for (let i = ((this.children[0] as AminoAcid).global_id - this.parent.global_start_id) * 3; i <= ((this[monomers][this[monomers].length-1] as AminoAcid).global_id - this.parent.global_start_id) * 3; i+=3){

            s.ns_offsets[i] += amount.x;
            s.ns_offsets[i + 1] += amount.y;
            s.ns_offsets[i + 2] += amount.z;

            s.bb_offsets[i] += amount.x;
            s.bb_offsets[i + 1] += amount.y;
            s.bb_offsets[i + 2] += amount.z;

            s.bbcon_offsets[i] += amount.x;
            s.bbcon_offsets[i + 1] += amount.y;
            s.bbcon_offsets[i + 2] += amount.z;

            s.cm_offsets[i] += amount.x;
            s.cm_offsets[i + 1] += amount.y;
            s.cm_offsets[i + 2] += amount.z;
        } 
        s.nucleoside.geometry["attributes"].instanceOffset.needsUpdate = true;
        s.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
        s.dummy_backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
    };
}


// systems are made of strands
// systems can CRUD
class System extends THREE.Group {

    system_id: number;
    global_start_id: number; //1st nucleotide's global_id
    dat_file;
    colormap_file;
    lutCols: THREE.Color[];

    //the system contains all the data from a dat file in its instancing arrays
    //the system also owns the actual meshes that get sent to the scene.
    INSTANCES: number;
    bb_offsets: Float32Array;
    bb_rotation: Float32Array;
    ns_offsets: Float32Array;
    ns_rotation: Float32Array;
    con_offsets: Float32Array;
    con_rotation: Float32Array;
    bbcon_offsets: Float32Array;
    bbcon_rotation: Float32Array;
    bbcon_scales: Float32Array;
    cm_offsets: Float32Array;
    bb_colors: Float32Array;
    ns_colors: Float32Array;
    scales: Float32Array;
    ns_scales: Float32Array;
    con_scales: Float32Array;
    visibility: Float32Array;

    bb_labels: Float32Array;

    backbone: THREE.Mesh;
    nucleoside: THREE.Mesh;
    connector: THREE.Mesh;
    bbconnector: THREE.Mesh;
    dummy_backbone: THREE.Mesh;

    constructor(id, start_id) {
        super();
        this.system_id = id;
        this.global_start_id = start_id;
        this.lutCols = [];
    };

    system_length(): number {
        let count: number = 0;
        for (let i = 0; i < this[strands].length; i++) {
            count += this[strands][i][monomers].length;
        }
        return count;
    };

    create_Strand(str_id: number): Strand {
        if (str_id < 0)
            return new Peptide(str_id, this);
        else
            return new NucleicAcidStrand(str_id, this);
    };

    add_strand(strand: Strand) {
        this[strands].push(strand);
        strand.parent = this;
    };

    remove_strand(to_remove: number) {
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
            };

            render();
        }
    };

    //computes the center of mass of the system
    get_com() {
        let com = new THREE.Vector3(0, 0, 0);
        for (let i = 0; i < this.INSTANCES * 3; i+=3){
            com.add(new THREE.Vector3(this.cm_offsets[i], this.cm_offsets[i+1], this.cm_offsets[i+2]))
        }
        return(com.multiplyScalar(1/this.INSTANCES))
    };

    //This is needed to handle strands that have experienced fix_diffusion.  Don't use it.
    strand_unweighted_com() {
        let com = new THREE.Vector3(0, 0, 0);
        let count = 0;
        this[strands].forEach((s: Strand) => {
            com.add(s.get_com())
            count += 1;
        });
    return(com.multiplyScalar(1/count))
    };

    setDatFile(dat_file) { //allows for trajectory function
        this.dat_file = dat_file;
    };

    setColorFile(json_file) {
        this.colormap_file = json_file;
    };

    translate_system(amount: THREE.Vector3) {
        for (let i = 0; i < this.INSTANCES * 3; i+=3){
            this.bb_offsets[i] += amount.x;
            this.bb_offsets[i + 1] += amount.y;
            this.bb_offsets[i + 2] += amount.z;

            this.ns_offsets[i] += amount.x;
            this.ns_offsets[i + 1] += amount.y;
            this.ns_offsets[i + 2] += amount.z;

            this.con_offsets[i] += amount.x;
            this.con_offsets[i + 1] += amount.y;
            this.con_offsets[i + 2] += amount.z;

            this.bbcon_offsets[i] += amount.x;
            this.bbcon_offsets[i + 1] += amount.y;
            this.bbcon_offsets[i + 2] += amount.z;

            this.cm_offsets[i] += amount.x;
            this.cm_offsets[i + 1] += amount.y;
            this.cm_offsets[i + 2] += amount.z;
        }
        this.backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
        this.nucleoside.geometry["attributes"].instanceOffset.needsUpdate = true;
        this.connector.geometry["attributes"].instanceOffset.needsUpdate = true;
        this.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
        this.dummy_backbone.geometry["attributes"].instanceOffset.needsUpdate = true;

        render();
    };

    fill_vec(vec_name, unit_size, pos, vals) {
        for (i = 0; i < unit_size; i++) {
            this[vec_name][pos * unit_size + i] = vals[i]
        }
    };
};

function nextConfig() {
    if (next_reader.readyState == 1) { //0: nothing loaded 1: working 2: done
        return;
    }
    getNewConfig(1);
};

function previousConfig() {
    if (previous_previous_reader.readyState == 1) {
        return;
    }
    getNewConfig(-1);
};

function toggleVideoOptions() {
    let opt = document.getElementById("videoOptions");
    opt.hidden = !opt.hidden;
};

function toggleColorOptions() {
    let opt: HTMLElement = document.getElementById("colorOptions");
    opt.hidden = !opt.hidden;
    colorOptions();
};

function colorOptions() {
    let opt: HTMLElement = document.getElementById("colorOptionContent");
    if (!opt.hidden) {
        opt.innerHTML = "";  //Clear content
        let addButton = document.createElement('button');
        addButton.innerText = "Add Color";
        // Append new color to the end of the color list and reset colors
        addButton.onclick = function () {
            backbone_colors.push(new THREE.Color(0x156289));
            colorOptions();
        }

        //modifies the backbone_colors array
        for (let i = 0; i < backbone_colors.length; i++) {
            let m = backbone_colors[i];
            let c = document.createElement('input');
            c.type = 'color';
            c.value = "#" + m.getHexString();
            c.onchange = function () {
                backbone_colors[i] = new THREE.Color(c.value);
                colorOptions();
            }
            
            //deletes color on right click
            c.oncontextmenu = function (event) {
                event.preventDefault();
                backbone_colors.splice(i, 1);
                colorOptions();
                return false;
            }
            opt.appendChild(c);
        }
        opt.appendChild(addButton);
        let index: number = 0;

        //actually update things in the scene
        for (; index < elements.length; index++) {
            if (!selected_bases.has(elements[index]))
                elements[index].resetColor(false);
        }
        for (let i = 0; i < systems.length; i++){
            systems[i].backbone.geometry["attributes"].instanceColor.needsUpdate = true;
            systems[i].connector.geometry["attributes"].instanceColor.needsUpdate = true;
            systems[i].bbconnector.geometry["attributes"].instanceColor.needsUpdate = true;
        }
        render();
    }
};

function createVideo() {
    // Get canvas
    let canvas = <HTMLCanvasElement>document.getElementById("threeCanvas");

    // Get options:
    let format = (<HTMLInputElement>document.querySelector('input[name="videoFormat"]:checked')).value;
    let framerate = (<HTMLInputElement>document.getElementById("videoFramerate")).value;
    let videoType = <HTMLInputElement>document.getElementById("videoType");

    // Set up movie capturer
    const capturer = new CCapture({
        format: format,
        framerate: framerate,
        name: videoType.value,
        verbose: true,
        display: true,
        workersPath: 'ts/lib/'
    });

    let button = <HTMLInputElement>document.getElementById("videoStartStop");
    button.innerText = "Stop";
    button.onclick = function () {
        capturer.stop();
        capturer.save();
    }
    try {
        switch (videoType.value) {
            case "trajectory":
                createTrajectoryVideo(canvas, capturer);
                break;
            case "lemniscate":
                createLemniscateVideo(canvas, capturer, framerate);
                break;
        }
    } catch (e) {
        alert("Failed to capture video: \n" + e);
        capturer.stop();
    }
};

function createTrajectoryVideo(canvas, capturer) {
    // Listen for configuration loaded events
    function _load(e) {
        e.preventDefault(); // cancel default actions
        capturer.capture(canvas);
        nextConfig();
    };

    // Listen for last configuration event
    function _done(e) {
        document.removeEventListener('nextConfigLoaded', _load);
        document.removeEventListener('finalConfig', _done);
        capturer.stop();
        capturer.save();
        button.innerText = "Start";
        button.onclick = createVideo;
        return;
    };

    // Overload stop button so that we don't forget to remove listeners
    let button = <HTMLInputElement>document.getElementById("videoStartStop");
    button.onclick = _done;

    document.addEventListener('nextConfigLoaded', _load);
    document.addEventListener('finalConfig', _done);

    // Start capturing
    capturer.start();
    nextConfig();
};

function createLemniscateVideo(canvas, capturer, framerate) {
    // Setup timing
    let duration = 10; //Seconds
    let tMax = 2 * Math.PI;
    let nFrames = duration * (<number><unknown>framerate);
    let dt = tMax / nFrames;

    // Preserve camera distance from origin:
    let d = Origin.distanceTo(camera.position);

    capturer.start();

    // Overload stop button so that we don't forget to remove listeners
    let button = <HTMLInputElement>document.getElementById("videoStartStop");
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
        camera.position.set(
            d * Math.cos(t),
            d * Math.sin(t) * Math.cos(t),
            d * Math.sqrt(Math.pow(Math.sin(t), 4))
        );
        camera.lookAt(Origin);
        t += dt;
        render();
        capturer.capture(canvas);
    }
    animate();
};

//toggles display of coloring by json file / structure modeled off of base selector
function toggleLut(chkBox) {
    if (!chkBox.checked) {
        api.remove_colorbar();
    }
    else if (chkBox.checked && lut != undefined) {
        api.show_colorbar();
    }
    else {
        alert("Please drag and drop the corresponding .json file.");
        chkBox.checked = false;
        return
    }
    for (let i = 0; i < elements.length; i++) {
        if (!selected_bases.has(elements[i])) {
            elements[i].resetColor(chkBox.checked);
        }
    }
    for (let i = 0; i < systems.length; i++) {
        systems[i].backbone.geometry["attributes"].instanceColor.needsUpdate = true;
        systems[i].connector.geometry["attributes"].instanceColor.needsUpdate = true;
        systems[i].bbconnector.geometry["attributes"].instanceColor.needsUpdate = true;
    }
    render();
};

function toggleBackground() {
    if (scene.background == WHITE) {
        scene.background = BLACK;
        render();
    }
    else {
        scene.background = WHITE;
        render();
    }
};

function toggleFog(near, far) {
    if (scene.fog == null) {
        scene.fog = new THREE.Fog(scene.background, near, far);
    }
    else {
        scene.fog = null;
    }
    render();
}

function cross(a1, a2, a3, b1, b2, b3) { //calculate cross product of 2 THREE.Vectors but takes coordinates as (x,y,z,x1,y1,z1)
    return [a2 * b3 - a3 * b2,
    a3 * b1 - a1 * b3,
    a1 * b2 - a2 * b1];
}

function toggleSideNav(button: HTMLInputElement) {
    let hidden = "show";
    let visible = "hide";
    let tabcontent = <HTMLCollectionOf<HTMLElement>>document.getElementsByClassName("tabcontent");
    if (button.innerText.toLowerCase() == hidden) {
        tabcontent[0].style.display = "block";
        button.innerHTML = visible;
    } else {
        for (let i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }
        button.innerHTML = hidden;
    }
}

function toggleClusterOptions() {
    let opt = document.getElementById("clusterOptions");
    opt.hidden = !opt.hidden;
};

function calculateClusters() {
    let minPts = parseFloat((<HTMLInputElement>document.getElementById("minPts")).value);
    let epsilon = parseFloat((<HTMLInputElement>document.getElementById("epsilon")).value);

    document.getElementById("clusterOptions").hidden = true;
    // Set wait cursor and request an animation frame to make sure
    // that it gets changed before starting dbscan:
    renderer.domElement.style.cursor = "wait";

    requestAnimationFrame(() => requestAnimationFrame(function(){
        dbscan(minPts, epsilon);
        renderer.domElement.style.cursor = "auto"; // Change cursor back
    }))
}

// Algorithm and comments from:
// https://en.wikipedia.org/wiki/DBSCAN#Algorithm
function dbscan(minPts: number, eps: number) {
    let nElements = elements.length;
    let c = 0 // Cluster counter
    let noise = -1; // Label for noise
    let getPos = (element: BasicElement) => {
        return element.get_instance_parameter3("cm_offsets");
    }
    let findNeigbours = (p: BasicElement, eps: number) => {
        let neigbours: BasicElement[] = [];
        for (let i=0; i<nElements; i++) {
        let q: BasicElement = elements[i];
            if (p != q) {
                let dist = getPos(p).distanceTo(getPos(q));
                if (dist < eps) {
                   neigbours.push(q);
                }
            }
        }
        return neigbours;
    }
    for (let i=0; i<nElements; i++) {
        let p: BasicElement = elements[i];
        if (typeof p.cluster_id !== 'undefined') {
            continue; // Previously processed in inner loop
        }
        // Find neigbours of p:
        let neigbours: BasicElement[] = findNeigbours(p, eps);
        if (neigbours.length < minPts) { // Density check
            p.cluster_id = noise // Label as noise
            continue;
        }
        c++; // Next cluster id
        p.cluster_id = c; // Label initial point
        for (let j=0; j<neigbours.length; j++) { // Process every seed point
            let q: BasicElement = neigbours[j];
            if ((typeof q.cluster_id !== 'undefined') && // Previously processed
                (q.cluster_id !== noise) // If noise, change it to border point
            ) {
                continue;
            }
            q.cluster_id = c; // Label neigbour
            // Find neigbours of q:
            let meta_neigbours: BasicElement[] = findNeigbours(q, eps);
            if (meta_neigbours.length >= minPts) { // Density check
                // Add new neigbours to seed set
                neigbours = neigbours.concat(meta_neigbours);
            }
        }
    }
}
