// select and/or drag
let axisMode: string = "X";
let scopeMode: string = "Monomer";
let angle: number = 90 * Math.PI / 180;
let matrix: THREE.Matrix3 = new THREE.Matrix3();
let v1: THREE.Vector3 = new THREE.Vector3();
let p: THREE.Vector3 = new THREE.Vector3();
let c: THREE.Vector3 = new THREE.Vector3();
let d: THREE.Vector3 = new THREE.Vector3();
function getActionModes(): string[] {
    let modes = <NodeListOf<HTMLInputElement>>document.getElementsByName("action");
    let checked = [];
    for (let i = 0; i < modes.length; i++) {
        if (modes[i].checked) {
            checked.push(modes[i].value);
        }
    }
    return checked;
}

// nucleotides/strand/system
function setScopeMode(): void {
    scopeMode = document.querySelector('input[name="scope"]:checked')['value'];
}

// X/Y/Z
function setAxisMode(): void {
    axisMode = document.querySelector('input[name="rotate"]:checked')['value'];
}

function setAngle(): void {
    angle = (<HTMLInputElement>document.getElementById("rotAngle")).valueAsNumber * Math.PI / 180;
}


let dragControls: THREE.DragControls; //dragging functionality
function drag() { //sets up DragControls - allows dragging of DNA - if action mode includes "drag"
    dragControls = new THREE.DragControls(camera, renderer.domElement);
    dragControls.addEventListener('dragstart', function (event) { controls.enabled = false; }); // prevents rotation of camera
    dragControls.addEventListener('dragend', function (event) { controls.enabled = true; })
}

//THREE quaternions are in (x, y, z, w) order
//GLSL quaternions are in (w, z, y, x) order
//So when you need to convert between them...
function glsl2three(input: THREE.Vector4) {
    let out = new THREE.Quaternion(input.w, input.z, input.y, input.x)
    return out
}

function rotate() { //rotate according to given angle given in number input
    let rot: boolean = false; //rotation success boolean
    switch (axisMode) {
        case "X": {
            matrix.set(1, 0, 0, 
                0, Math.cos(angle), -Math.sin(angle), 
                0, Math.sin(angle), Math.cos(angle));
            v1.set(1, 0, 0);
            break;
        }
        case "Y": {
            matrix.set(Math.cos(angle), 0, Math.sin(angle), 
            0, 1, 0, 
            -Math.sin(angle), 0, Math.cos(angle));
            v1.set(0, 1, 0);
            break;
        }
        case "Z": {
            matrix.set(Math.cos(angle), -Math.sin(angle), 0, 
            Math.sin(angle), Math.cos(angle), 0, 
            0, 0, 1); 
            v1.set(0, 0, 1);
            break;
        }
        default: alert("Unknown rotation axis: " + axisMode);
    }

    let q = new THREE.Quaternion;
    q.setFromAxisAngle(v1, angle);

    //this will be rotating around the center of mass of the selected bases.
    c = new THREE.Vector3(0, 0, 0);
    selected_bases.forEach((base) => {
        c.add(base.get_instance_parameter3("cm_offsets"));
    });
    c.multiplyScalar(1/selected_bases.size)

    selected_bases.forEach((base) => {
        //rotate around user selected axis with user entered angle
        let sys = base.parent.parent;
        let sid = base.global_id - sys.global_start_id;

        let cm_pos = base.get_instance_parameter3("cm_offsets");
        let bb_pos = base.get_instance_parameter3("bb_offsets");
        let ns_pos = base.get_instance_parameter3("ns_offsets");
        let con_pos = base.get_instance_parameter3("con_offsets");
        let bbcon_pos = base.get_instance_parameter3("bbcon_offsets");

        cm_pos.sub(c);
        bb_pos.sub(c);
        ns_pos.sub(c);
        con_pos.sub(c);
        bbcon_pos.sub(c);
        
        cm_pos.applyMatrix3(matrix);
        bb_pos.applyMatrix3(matrix);
        ns_pos.applyMatrix3(matrix);
        con_pos.applyMatrix3(matrix);
        bbcon_pos.applyMatrix3(matrix);

        let ns_rotationV = base.get_instance_parameter4("ns_rotation");
        let ns_rotation = glsl2three(ns_rotationV);
        let con_rotationV = base.get_instance_parameter4("con_rotation");
        let con_rotation = glsl2three(con_rotationV);
        let bbcon_rotationV = base.get_instance_parameter4("bbcon_rotation");
        let bbcon_rotation = glsl2three(bbcon_rotationV);

        ns_rotation.multiply(q);
        con_rotation.multiply(q);
        bbcon_rotation.multiply(q);

        cm_pos.add(c);
        bb_pos.add(c);
        ns_pos.add(c);
        con_pos.add(c);
        bbcon_pos.add(c);

        sys.fill_vec('cm_offsets', 3, sid, [cm_pos.x, cm_pos.y, cm_pos.z]);
        sys.fill_vec('bb_offsets', 3, sid, [bb_pos.x, bb_pos.y, bb_pos.z]);
        sys.fill_vec('ns_offsets', 3, sid, [ns_pos.x, ns_pos.y, ns_pos.z]);
        sys.fill_vec('con_offsets', 3, sid, [con_pos.x, con_pos.y, con_pos.z]);
        sys.fill_vec('bbcon_offsets', 3, sid, [bbcon_pos.x, bbcon_pos.y, bbcon_pos.z]);
        sys.fill_vec('ns_rotation', 4, sid, [ns_rotation.w, ns_rotation.z, ns_rotation.y, ns_rotation.x]);
        sys.fill_vec('con_rotation', 4, sid, [con_rotation.w, con_rotation.z, con_rotation.y, con_rotation.x]);
        sys.fill_vec('bbcon_rotation', 4, sid, [bbcon_rotation.w, bbcon_rotation.z, bbcon_rotation.y, bbcon_rotation.x]);

        rot = true;
    });

    for (let i = 0; i < systems.length; i++){
        systems[i].backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
        systems[i].nucleoside.geometry["attributes"].instanceOffset.needsUpdate = true;
        systems[i].connector.geometry["attributes"].instanceOffset.needsUpdate = true;
        systems[i].bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
        systems[i].dummy_backbone.geometry["attributes"].instanceOffset.needsUpdate = true;

        systems[i].nucleoside.geometry["attributes"].instanceRotation.needsUpdate = true;
        systems[i].connector.geometry["attributes"].instanceRotation.needsUpdate = true;
        systems[i].bbconnector.geometry["attributes"].instanceRotation.needsUpdate = true;
    }

    if (!rot) { //if no object has been selected, rotation will not occur and error message displayed
        alert("Please select an object to rotate.");
    }
    render();
}

