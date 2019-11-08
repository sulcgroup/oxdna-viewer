// select and/or drag
function getActionModes() {
    let modes = document.getElementsByName("action");
    let checked = [];
    for (let i = 0; i < modes.length; i++) {
        if (modes[i].checked) {
            checked.push(modes[i].value);
        }
    }
    return checked;
}
// nucleotides/strand/system
function getScopeMode() {
    return document.querySelector('input[name="scope"]:checked')['value'];
}
// X/Y/Z
function getAxisMode() {
    return document.querySelector('input[name="rotate"]:checked')['value'];
}
function getAngle() {
    return document.getElementById("rotAngle").valueAsNumber * Math.PI / 180;
}
//THREE quaternions are in (x, y, z, w) order
//GLSL quaternions are in (w, z, y, x) order
//So when you need to convert between them...
function glsl2three(input) {
    let out = new THREE.Quaternion(input.w, input.z, input.y, input.x);
    return out;
}
function rotateByInput() {
    if (selectedBases.size < 1) { //if no object has been selected, rotation will not occur and error message displayed
        notify("Please select elements to rotate.");
    }
    let angle = getAngle();
    let axisString = getAxisMode();
    // Rotate around user selected axis with user entered angle
    let axis = new THREE.Vector3();
    switch (axisString) {
        case "X":
            axis.set(1, 0, 0);
            break;
        case "Y":
            axis.set(0, 1, 0);
            break;
        case "Z":
            axis.set(0, 0, 1);
            break;
        default: notify("Unknown rotation axis: " + axisString);
    }
    // This will be rotating around the center of mass of the selected bases.
    let c = new THREE.Vector3(0, 0, 0);
    selectedBases.forEach((base) => {
        c.add(base.getInstanceParameter3("cmOffsets"));
    });
    c.multiplyScalar(1 / selectedBases.size);
    editHistory.do(new RevertableRotation(selectedBases, axis, angle, c));
}
function rotateElements(elements, axis, angle, about) {
    let q = new THREE.Quaternion();
    q.setFromAxisAngle(axis, angle);
    rotateElementsByQuaternion(elements, q, about);
}
function rotateElementsByQuaternion(elements, q, about) {
    // For some reason, we have to rotate the orientations
    // around an axis with inverted y-value...
    let q2 = q.clone();
    q2.y *= -1;
    elements.forEach((base) => {
        let sys = base.parent.parent;
        let sid = base.gid - sys.globalStartId;
        //get current positions
        let cmPos = base.getInstanceParameter3("cmOffsets");
        let bbPos = base.getInstanceParameter3("bbOffsets");
        let nsPos = base.getInstanceParameter3("nsOffsets");
        let conPos = base.getInstanceParameter3("conOffsets");
        let bbconPos = base.getInstanceParameter3("bbconOffsets");
        //the rotation center needs to be (0,0,0)
        cmPos.sub(about);
        bbPos.sub(about);
        nsPos.sub(about);
        conPos.sub(about);
        bbconPos.sub(about);
        cmPos.applyQuaternion(q);
        bbPos.applyQuaternion(q);
        nsPos.applyQuaternion(q);
        conPos.applyQuaternion(q);
        bbconPos.applyQuaternion(q);
        //get current rotations and convert to THREE coordinates
        let nsRotationV = base.getInstanceParameter4("nsRotation");
        let nsRotation = glsl2three(nsRotationV);
        let conRotationV = base.getInstanceParameter4("conRotation");
        let conRotation = glsl2three(conRotationV);
        let bbconRotationV = base.getInstanceParameter4("bbconRotation");
        let bbconRotation = glsl2three(bbconRotationV);
        //apply individual object rotation
        nsRotation.multiply(q2);
        conRotation.multiply(q2);
        bbconRotation.multiply(q2);
        //move the object back to its original position
        cmPos.add(about);
        bbPos.add(about);
        nsPos.add(about);
        conPos.add(about);
        bbconPos.add(about);
        //update the instancing matrices
        sys.fillVec('cmOffsets', 3, sid, [cmPos.x, cmPos.y, cmPos.z]);
        sys.fillVec('bbOffsets', 3, sid, [bbPos.x, bbPos.y, bbPos.z]);
        sys.fillVec('nsOffsets', 3, sid, [nsPos.x, nsPos.y, nsPos.z]);
        sys.fillVec('conOffsets', 3, sid, [conPos.x, conPos.y, conPos.z]);
        sys.fillVec('bbconOffsets', 3, sid, [bbconPos.x, bbconPos.y, bbconPos.z]);
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
    // Update backbone connections (is there a more clever way to do this than
    // to loop through all? We only need to update bases with neigbours
    // outside the selection set)
    selectedBases.forEach((base) => {
        if (base.neighbor3 !== null && base.neighbor3 !== undefined) {
            calcsp(base); //calculate sp between current and neighbor3
        }
        if (base.neighbor5 !== null && base.neighbor5 !== undefined) {
            calcsp(base.neighbor5); //calculate sp between current and neighbor5
        }
    });
    for (let i = 0; i < systems.length; i++) {
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
function calcsp(currentNuc) {
    let temp = currentNuc.neighbor3.getInstanceParameter3("bbOffsets");
    let xbbLast = temp.x, ybbLast = temp.y, zbbLast = temp.z;
    temp = currentNuc.getInstanceParameter3("bbOffsets"); //get currentNuc's backbone world position
    let xbb = temp.x;
    let ybb = temp.y;
    let zbb = temp.z;
    //calculate sp location, length and orientation
    let xsp = (xbb + xbbLast) / 2, ysp = (ybb + ybbLast) / 2, zsp = (zbb + zbbLast) / 2;
    let spLen = Math.sqrt(Math.pow(xbb - xbbLast, 2) + Math.pow(ybb - ybbLast, 2) + Math.pow(zbb - zbbLast, 2));
    let spRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(xsp - xbb, ysp - ybb, zsp - zbb).normalize());
    currentNuc.setInstanceParameter('bbconOffsets', [xsp, ysp, zsp]);
    currentNuc.setInstanceParameter('bbconRotation', [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
    currentNuc.setInstanceParameter('bbconScales', [1, spLen, 1]);
    currentNuc.parent.parent.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
    currentNuc.parent.parent.bbconnector.geometry["attributes"].instanceRotation.needsUpdate = true;
    currentNuc.parent.parent.bbconnector.geometry["attributes"].instanceScale.needsUpdate = true;
}
function translateElements(elements, v) {
    elements.forEach((base) => {
        let sys = base.parent.parent;
        let sid = base.gid - sys.globalStartId;
        let cmPos = base.getInstanceParameter3("cmOffsets");
        let bbPos = base.getInstanceParameter3("bbOffsets");
        let nsPos = base.getInstanceParameter3("nsOffsets");
        let conPos = base.getInstanceParameter3("conOffsets");
        let bbconPos = base.getInstanceParameter3("bbconOffsets");
        cmPos.add(v);
        bbPos.add(v);
        nsPos.add(v);
        conPos.add(v);
        bbconPos.add(v);
        sys.fillVec('cmOffsets', 3, sid, [cmPos.x, cmPos.y, cmPos.z]);
        sys.fillVec('bbOffsets', 3, sid, [bbPos.x, bbPos.y, bbPos.z]);
        sys.fillVec('nsOffsets', 3, sid, [nsPos.x, nsPos.y, nsPos.z]);
        sys.fillVec('conOffsets', 3, sid, [conPos.x, conPos.y, conPos.z]);
        sys.fillVec('bbconOffsets', 3, sid, [bbconPos.x, bbconPos.y, bbconPos.z]);
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
    for (let i = 0; i < systems.length; i++) {
        systems[i].backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
        systems[i].nucleoside.geometry["attributes"].instanceOffset.needsUpdate = true;
        systems[i].connector.geometry["attributes"].instanceOffset.needsUpdate = true;
        systems[i].bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
        systems[i].dummyBackbone.geometry["attributes"].instanceOffset.needsUpdate = true;
    }
    render();
}
