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
    if (selectedBases.size < 1) { //if no object has been selected, rotation will not occur and error message displayed
        notify("Please select elements to rotate.");
    }
    let angle = getAngle();
    let axisString = getAxisMode();

    // Rotate around user selected axis with user entered angle
    let axis = new THREE.Vector3();
    switch (axisString) {
        case "X": axis.set(1, 0, 0); break;
        case "Y": axis.set(0, 1, 0); break;
        case "Z": axis.set(0, 0, 1); break;
        default: notify("Unknown rotation axis: " + axisString);
    }

    // This will be rotating around the center of mass of the selected bases.
    let c = new THREE.Vector3(0, 0, 0);
    selectedBases.forEach((base) => {
        c.add(base.getInstanceParameter3("cmOffsets"));
    });
    c.multiplyScalar(1/selectedBases.size)

    editHistory.do(new RevertableRotation(selectedBases, axis, angle, c));
}

function rotateElements(elements: Set<BasicElement>, axis: THREE.Vector3, angle: number, about: THREE.Vector3) {
    let q = new THREE.Quaternion();
    q.setFromAxisAngle(axis, angle);
    rotateElementsByQuaternion(elements, q, about)
}

function rotateElementsByQuaternion(elements: Set<BasicElement>, q: THREE.Quaternion, about: THREE.Vector3) {
    // For some reason, we have to rotate the orientations
    // around an axis with inverted y-value...
    let q2 = q.clone();
    q2.y *= -1;

    elements.forEach((base) => {
        let sys = base.parent.parent;
        let sid = base.gid - sys.globalStartId;

        //get current positions
        let cm_pos = base.getInstanceParameter3("cmOffsets");
        let bb_pos = base.getInstanceParameter3("bbOffsets");
        let ns_pos = base.getInstanceParameter3("nsOffsets");
        let con_pos = base.getInstanceParameter3("conOffsets");
        let bbcon_pos = base.getInstanceParameter3("bbconOffsets");

        //the rotation center needs to be (0,0,0)
        cm_pos.sub(about);
        bb_pos.sub(about);
        ns_pos.sub(about);
        con_pos.sub(about);
        bbcon_pos.sub(about);

        cm_pos.applyQuaternion(q);
        bb_pos.applyQuaternion(q);
        ns_pos.applyQuaternion(q);
        con_pos.applyQuaternion(q);
        bbcon_pos.applyQuaternion(q);

        //get current rotations and convert to THREE coordinates
        let ns_rotationV = base.getInstanceParameter4("nsRotation");
        let nsRotation = glsl2three(ns_rotationV);
        let con_rotationV = base.getInstanceParameter4("conRotation");
        let conRotation = glsl2three(con_rotationV);
        let bbcon_rotationV = base.getInstanceParameter4("bbconRotation");
        let bbconRotation = glsl2three(bbcon_rotationV);

        //apply individual object rotation
        nsRotation.multiply(q2);
        conRotation.multiply(q2);
        bbconRotation.multiply(q2);

        //move the object back to its original position
        cm_pos.add(about);
        bb_pos.add(about);
        ns_pos.add(about);
        con_pos.add(about);
        bbcon_pos.add(about);

        //update the instancing matrices
        sys.fillVec('cmOffsets', 3, sid, [cm_pos.x, cm_pos.y, cm_pos.z]);
        sys.fillVec('bbOffsets', 3, sid, [bb_pos.x, bb_pos.y, bb_pos.z]);
        sys.fillVec('nsOffsets', 3, sid, [ns_pos.x, ns_pos.y, ns_pos.z]);
        sys.fillVec('conOffsets', 3, sid, [con_pos.x, con_pos.y, con_pos.z]);
        sys.fillVec('bbconOffsets', 3, sid, [bbcon_pos.x, bbcon_pos.y, bbcon_pos.z]);
        
        sys.fillVec('nsRotation', 4, sid, [nsRotation.w, nsRotation.z, nsRotation.y, nsRotation.x]);
        sys.fillVec('conRotation', 4, sid, [conRotation.w, conRotation.z, conRotation.y, conRotation.x]);
        sys.fillVec('bbconRotation', 4, sid, [bbconRotation.w, bbconRotation.z, bbconRotation.y, bbconRotation.x]);
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
        systems[i].dummyBackbone.geometry["attributes"].instanceOffset.needsUpdate = true;

        systems[i].nucleoside.geometry["attributes"].instanceRotation.needsUpdate = true;
        systems[i].connector.geometry["attributes"].instanceRotation.needsUpdate = true;
        systems[i].bbconnector.geometry["attributes"].instanceRotation.needsUpdate = true;
    }
    render();
}

//adjust the backbone after the move. Copied from DragControls
function calcsp(current_nuc) {
    let temp = current_nuc.neighbor3.getInstanceParameter3("bbOffsets");
    let xbbLast = temp.x,
        ybbLast = temp.y,
        zbbLast = temp.z;
    temp = current_nuc.getInstanceParameter3("bbOffsets"); //get current_nuc's backbone world position
    let xbb = temp.x;
    let ybb = temp.y;
    let zbb = temp.z;

    //calculate sp location, length and orientation
    let xsp = (xbb + xbbLast) / 2,
        ysp = (ybb + ybbLast) / 2,
        zsp = (zbb + zbbLast) / 2;
    let spLen = Math.sqrt(Math.pow(xbb - xbbLast, 2) + Math.pow(ybb - ybbLast, 2) + Math.pow(zbb - zbbLast, 2));
    let spRotation = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), new THREE.Vector3(xsp - xbb, ysp - ybb, zsp - zbb).normalize());

    current_nuc.setInstanceParameter('bbconOffsets', [xsp, ysp, zsp]);
    current_nuc.setInstanceParameter('bbconRotation', [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
    current_nuc.setInstanceParameter('bbconScales', [1, spLen, 1]);
    current_nuc.parent.parent.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
    current_nuc.parent.parent.bbconnector.geometry["attributes"].instanceRotation.needsUpdate = true;
    current_nuc.parent.parent.bbconnector.geometry["attributes"].instanceScale.needsUpdate = true;
}

function translateElements(elements: Set<BasicElement>, v: THREE.Vector3) {
    elements.forEach((base) => {
        let sys = base.parent.parent;
        let sid = base.gid - sys.globalStartId;

        let cm_pos = base.getInstanceParameter3("cmOffsets");
        let bb_pos = base.getInstanceParameter3("bbOffsets");
        let ns_pos = base.getInstanceParameter3("nsOffsets");
        let con_pos = base.getInstanceParameter3("conOffsets");
        let bbcon_pos = base.getInstanceParameter3("bbconOffsets");

        cm_pos.add(v);
        bb_pos.add(v);
        ns_pos.add(v);
        con_pos.add(v);
        bbcon_pos.add(v);

        sys.fillVec('cmOffsets', 3, sid, [cm_pos.x, cm_pos.y, cm_pos.z]);
        sys.fillVec('bbOffsets', 3, sid, [bb_pos.x, bb_pos.y, bb_pos.z]);
        sys.fillVec('nsOffsets', 3, sid, [ns_pos.x, ns_pos.y, ns_pos.z]);
        sys.fillVec('conOffsets', 3, sid, [con_pos.x, con_pos.y, con_pos.z]);
        sys.fillVec('bbconOffsets', 3, sid, [bbcon_pos.x, bbcon_pos.y, bbcon_pos.z]);
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
        systems[i].dummyBackbone.geometry["attributes"].instanceOffset.needsUpdate = true;
    }
    render();
}
