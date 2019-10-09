// select and/or drag
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
function getScopeMode(): string {
    return document.querySelector('input[name="scope"]:checked')['value'];
}

// X/Y/Z
function getAxisMode(): string {
    return document.querySelector('input[name="rotate"]:checked')['value'];
}

function getAngle(): number {
    return (<HTMLInputElement>document.getElementById("rotAngle")).valueAsNumber * Math.PI / 180;
}

//THREE quaternions are in (x, y, z, w) order
//GLSL quaternions are in (w, z, y, x) order
//So when you need to convert between them...
function glsl2three(input: THREE.Vector4) {
    let out = new THREE.Quaternion(input.w, input.z, input.y, input.x);
    return out;
}

function rotateByInput() { //rotate selected according to input controls
    if (selected_bases.size < 1) { //if no object has been selected, rotation will not occur and error message displayed
        alert("Please select elements to rotate.");
    }
    let angle = getAngle();
    let axisString = getAxisMode();

    // Rotate around user selected axis with user entered angle
    let axis = new THREE.Vector3();
    switch (axisString) {
        case "X": axis.set(1, 0, 0); break;
        case "Y": axis.set(0, 1, 0); break;
        case "Z": axis.set(0, 0, 1); break;
        default: alert("Unknown rotation axis: " + axisString);
    }

    // This will be rotating around the center of mass of the selected bases.
    let c = new THREE.Vector3(0, 0, 0);
    selected_bases.forEach((base) => {
        c.add(base.get_instance_parameter3("cm_offsets"));
    });
    c.multiplyScalar(1/selected_bases.size)

    editHistory.do(new RevertableRotation(selected_bases, axis, angle, c));
}

function rotateElements(elements: Set<BasicElement>, axis: THREE.Vector3, angle: number, about: THREE.Vector3) {
    // Normalize axis
    axis = axis.clone().normalize();

    //create quaternion defining the rotation about the axis by the angle
    let q1 = new THREE.Quaternion;
    q1.setFromAxisAngle(axis, angle);

    //However for some reason, to actually rotate the meshes you need to invert the axis y-coordinate
    let axis2 = axis.clone();
    axis2.y *= -1;
    let q2 = new THREE.Quaternion;
    q2.setFromAxisAngle(axis2, angle);

    elements.forEach((base) => {
        let sys = base.parent.parent;
        let sid = base.global_id - sys.global_start_id;

        //get current positions
        let cm_pos = base.get_instance_parameter3("cm_offsets");
        let bb_pos = base.get_instance_parameter3("bb_offsets");
        let ns_pos = base.get_instance_parameter3("ns_offsets");
        let con_pos = base.get_instance_parameter3("con_offsets");
        let bbcon_pos = base.get_instance_parameter3("bbcon_offsets");

        //the rotation center needs to be (0,0,0)
        cm_pos.sub(about);
        bb_pos.sub(about);
        ns_pos.sub(about);
        con_pos.sub(about);
        bbcon_pos.sub(about);
      
        //rotate object positions around the rotation point
        cm_pos.applyQuaternion(q1);
        bb_pos.applyQuaternion(q1);
        ns_pos.applyQuaternion(q1);
        con_pos.applyQuaternion(q1);
        bbcon_pos.applyQuaternion(q1);

        //get current rotations and convert to THREE coordinates
        let ns_rotationV = base.get_instance_parameter4("ns_rotation");
        let ns_rotation = glsl2three(ns_rotationV);
        let con_rotationV = base.get_instance_parameter4("con_rotation");
        let con_rotation = glsl2three(con_rotationV);
        let bbcon_rotationV = base.get_instance_parameter4("bbcon_rotation");
        let bbcon_rotation = glsl2three(bbcon_rotationV);

        //apply individual object rotation
        ns_rotation.multiply(q2);
        con_rotation.multiply(q2);
        bbcon_rotation.multiply(q2);

        //move the object back to its original position
        cm_pos.add(about);
        bb_pos.add(about);
        ns_pos.add(about);
        con_pos.add(about);
        bbcon_pos.add(about);

        //update the instancing matrices
        sys.fill_vec('cm_offsets', 3, sid, [cm_pos.x, cm_pos.y, cm_pos.z]);
        sys.fill_vec('bb_offsets', 3, sid, [bb_pos.x, bb_pos.y, bb_pos.z]);
        sys.fill_vec('ns_offsets', 3, sid, [ns_pos.x, ns_pos.y, ns_pos.z]);
        sys.fill_vec('con_offsets', 3, sid, [con_pos.x, con_pos.y, con_pos.z]);
        sys.fill_vec('bbcon_offsets', 3, sid, [bbcon_pos.x, bbcon_pos.y, bbcon_pos.z]);
        
        sys.fill_vec('ns_rotation', 4, sid, [ns_rotation.w, ns_rotation.z, ns_rotation.y, ns_rotation.x]);
        sys.fill_vec('con_rotation', 4, sid, [con_rotation.w, con_rotation.z, con_rotation.y, con_rotation.x]);
        sys.fill_vec('bbcon_rotation', 4, sid, [bbcon_rotation.w, bbcon_rotation.z, bbcon_rotation.y, bbcon_rotation.x]);
    });

    // Update backbone connections for bases with neigbours outside the selection set
    elements.forEach((base) => {
        if (base.neighbor3 !== null && base.neighbor3 !== undefined && !elements.has(base.neighbor3)) {
            calcsp(base); //calculate sp between current and neighbor3
        }
        if (base.neighbor5 !== null && base.neighbor5 !== undefined && !elements.has(base.neighbor5)) {
            calcsp(base.neighbor5); //calculate sp between current and neighbor5
        }
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
    render();
}

//adjust the backbone after the move. Copied from DragControls
function calcsp(current_nuc) {
    let temp = current_nuc.neighbor3.get_instance_parameter3("bb_offsets");
    let x_bb_last = temp.x,
        y_bb_last = temp.y,
        z_bb_last = temp.z;
    temp = current_nuc.get_instance_parameter3("bb_offsets"); //get current_nuc's backbone world position
    let x_bb = temp.x;
    let y_bb = temp.y;
    let z_bb = temp.z;

    //calculate sp location, length and orientation
    let x_sp = (x_bb + x_bb_last) / 2,
        y_sp = (y_bb + y_bb_last) / 2,
        z_sp = (z_bb + z_bb_last) / 2;
    let sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
    let rotation_sp = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize());

    current_nuc.set_instance_parameter('bbcon_offsets', [x_sp, y_sp, z_sp]);
    current_nuc.set_instance_parameter('bbcon_rotation', [rotation_sp.w, rotation_sp.z, rotation_sp.y, rotation_sp.x]);
    current_nuc.set_instance_parameter('bbcon_scales', [1, sp_len, 1]);
    current_nuc.parent.parent.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
    current_nuc.parent.parent.bbconnector.geometry["attributes"].instanceRotation.needsUpdate = true;
    current_nuc.parent.parent.bbconnector.geometry["attributes"].instanceScale.needsUpdate = true;
}

function translateElements(elements: Set<BasicElement>, v: THREE.Vector3) {
    elements.forEach((base) => {
        let sys = base.parent.parent;
        let sid = base.global_id - sys.global_start_id;

        let cm_pos = base.get_instance_parameter3("cm_offsets");
        let bb_pos = base.get_instance_parameter3("bb_offsets");
        let ns_pos = base.get_instance_parameter3("ns_offsets");
        let con_pos = base.get_instance_parameter3("con_offsets");
        let bbcon_pos = base.get_instance_parameter3("bbcon_offsets");

        cm_pos.add(v);
        bb_pos.add(v);
        ns_pos.add(v);
        con_pos.add(v);
        bbcon_pos.add(v);

        sys.fill_vec('cm_offsets', 3, sid, [cm_pos.x, cm_pos.y, cm_pos.z]);
        sys.fill_vec('bb_offsets', 3, sid, [bb_pos.x, bb_pos.y, bb_pos.z]);
        sys.fill_vec('ns_offsets', 3, sid, [ns_pos.x, ns_pos.y, ns_pos.z]);
        sys.fill_vec('con_offsets', 3, sid, [con_pos.x, con_pos.y, con_pos.z]);
        sys.fill_vec('bbcon_offsets', 3, sid, [bbcon_pos.x, bbcon_pos.y, bbcon_pos.z]);
    });

    // Update backbone connections (is there a more clever way to do this than
    // to loop through all? We only need to update bases with neigbours
    // outside the selection set)
    elements.forEach((base) => {
        if (base.neighbor3 !== null && base.neighbor3 !== undefined) {
            calcsp(base); //calculate sp between current and neighbor3
        }
        if (base.neighbor5 !== null && base.neighbor5 !== undefined) {
            calcsp(base.neighbor5); //calculate sp between current and neighbor5
        }
    });

    for (let i = 0; i < systems.length; i++){
        systems[i].backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
        systems[i].nucleoside.geometry["attributes"].instanceOffset.needsUpdate = true;
        systems[i].connector.geometry["attributes"].instanceOffset.needsUpdate = true;
        systems[i].bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
        systems[i].dummy_backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
    }
    render();
}
