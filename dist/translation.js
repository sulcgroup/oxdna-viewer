var actionMode = ""; //select and/or drag
var scopeMode = ""; //nucleotides/strand/system
var axisMode = ""; //x,y, or z axis
function getActionMode() {
    // Get the checkbox
    actionMode = "";
    var checkBoxes = document.forms['Action'].elements['action']; //get checkboxes in form with id = 'Action' and checkboxes with name = 'action'
    for (let i = 0, len = checkBoxes.length; i < len; i++) { //for each checkbox
        if (checkBoxes[i].checked) { //if checkbox checked, add mode to actionMode string
            actionMode += checkBoxes[i].value;
        }
    }
}
function getScopeMode() {
    var modeRadioButtons = document.forms['Mode'].elements['mode']; //get radio buttons in form with id = 'Mode' and radio buttons with name = 'mode'
    for (let i = 0, len = modeRadioButtons.length; i < len; i++) { //for each radio button
        if (modeRadioButtons[i].checked) { //if radio button selected, set mode to scopeMode string
            scopeMode = modeRadioButtons[i].value;
            break;
        }
    }
}
// get list of radio buttons with name 'mode'
var sz = document.forms['Mode'].elements['mode'];
// loop through list
for (let i = 0, len = sz.length; i < len; i++) {
    sz[i].onclick = function () {
        //when radio button changed, get new modes
        getScopeMode();
    };
}
// get list of checkboxes with name 'action'
var sz = document.forms['Action'].elements['action']; //form id = 'Action'; checkbox name = 'action'
// loop through list
for (let i = 0, len = sz.length; i < len; i++) {
    sz[i].onclick = function () {
        // put clicked radio button's value in total field
        getActionMode();
        if (actionMode.includes("Drag")) {
            drag();
        }
    };
}
let dragControls; //dragging functionality
function drag() {
    var nucleotide_objects = [];
    for (let i = 6; i < scene.children.length; i++) {
        nucleotide_objects.push(scene.children[i].children);
    }
    nucleotide_objects = nucleotide_objects.flat(1);
    dragControls = new THREE.DragControls(nucleotide_objects, camera, true, renderer.domElement);
    dragControls.addEventListener('dragstart', function (event) { controls.enabled = false; }); // prevents rotation of camera
    dragControls.addEventListener('dragend', function (event) { controls.enabled = true; });
}
let angle = 90 * Math.PI / 180;
function setRotAngle(textArea) {
    angle = parseInt(textArea.value) * Math.PI / 180;
}
function getRotObj(i) {
    let rotobj;
    if (scopeMode.includes("Nuc")) {
        rotobj = nucleotides[i].visual_object; //set rotobj to nucleotide's visual_object
    }
    else if (scopeMode.includes("Strand")) {
        let nuctemp = nucleotides[i];
        rotobj = systems[nuctemp.my_system].strands[nuctemp.my_strand - 1].strand_3objects; //set rotobj to current nuc's strand's strand_3objects
    }
    else if (scopeMode.includes("System")) {
        let nuctemp = nucleotides[i];
        rotobj = systems[nuctemp.my_system].system_3objects; //set rotobj to current nuc's system's system_3objects
    }
    return rotobj;
}
function rotate(dir) {
    let dirangle = dir * angle;
    //let angleInner: number = -1 * dirangle;
    updatePos(); //update class positions
    let rot = false;
    getAxisMode(); //get axis on which to rotate //rotate around user selected axis - default is X - and user entered angle - updated every time textarea is changed; default is 90
    let matrix;
    matrix = new THREE.Matrix3();
    if (axisMode == "X") {
        matrix.set(1, 0, 0, 0, Math.cos(dirangle), -Math.sin(dirangle), 0, Math.sin(dirangle), Math.cos(dirangle));
    }
    else if (axisMode == "Y") {
        matrix.set(Math.cos(dirangle), 0, Math.sin(dirangle), 0, 1, 0, -Math.sin(dirangle), 0, Math.cos(dirangle));
    }
    else {
        matrix.set(Math.cos(dirangle), -Math.sin(dirangle), 0, Math.sin(dirangle), Math.cos(dirangle), 0, 0, 0, 1);
    }
    let matrix4;
    matrix4 = new THREE.Matrix4();
    if (axisMode == "X") {
        matrix4.set(1, 0, 0, 0, 0, Math.cos(dirangle), -Math.sin(dirangle), 0, 0, Math.sin(dirangle), Math.cos(dirangle), 0, 0, 0, 0, 1);
    }
    else if (axisMode == "Y") {
        matrix4.set(Math.cos(dirangle), 0, Math.sin(dirangle), 0, 0, 1, 0, 0, -Math.sin(dirangle), 0, Math.cos(dirangle), 0, 0, 0, 0, 1);
    }
    else {
        matrix4.set(Math.cos(dirangle), -Math.sin(dirangle), 0, 0, Math.sin(dirangle), Math.cos(dirangle), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    }
    let q = new THREE.Quaternion();
    q.setFromRotationMatrix(matrix4);
    for (let i = 0; i < selected_bases.length; i++) { //go through each nucleotide in all systems
        if (selected_bases[i] == 1) { //if nucleotide is selected
            let temp = new THREE.Vector3(nucleotides[i].visual_object.children[3].position.x, 0, 0);
            //temp.normalize();
            //q.setFromAxisAngle(temp, angle);
            //nucleotides[i].visual_object.quaternion.multiply(q);
            render();
            rot = true;
            let originalObjPos = new THREE.Vector3();
            originalObjPos.copy(nucleotides[i].visual_object.children[3].position);
            //let rotobj: THREE.Group = getRotObj(i); //get object to rotate - nucleotide, strand, or system based on mode
            for (let j = 0; j < nucleotides[i].visual_object.children.length; j++) {
                if (true) {
                    let p = new THREE.Vector3();
                    p.copy(nucleotides[i].visual_object.children[j].position);
                    let c = new THREE.Vector3();
                    if (scopeMode.includes("Nuc"))
                        c = originalObjPos;
                    else if (scopeMode.includes("Strand"))
                        c.copy(systems[nucleotides[i].my_system].strands[nucleotides[i].my_strand].pos);
                    else if (scopeMode.includes("System"))
                        c.copy(systems[nucleotides[i].my_system].pos);
                    let d = p.sub(c);
                    let v1;
                    if (axisMode == "X") {
                        v1 = new THREE.Vector3(1, 0, 0);
                    }
                    else if (axisMode == "Y") {
                        v1 = new THREE.Vector3(0, 1, 0);
                    }
                    else {
                        v1 = new THREE.Vector3(0, 0, 1);
                    }
                    nucleotides[i].visual_object.children[j].rotateOnWorldAxis(v1, dirangle);
                    d.applyMatrix3(matrix);
                    d.add(c);
                    nucleotides[i].visual_object.children[j].position.set(d.x, d.y, d.z);
                    rot = true;
                    //}
                }
                /*if (!scopeMode.includes("Nuc")) {
                    let p: THREE.Vector3 = nucleotides[i].visual_object.children[j].position;
                    let c1: THREE.Vector3 = originalObjPos;
                    let d1: THREE.Vector3 = p.sub(c1);
                    d1.applyMatrix3(matrix);
                    d1.add(c1);
                    nucleotides[i].visual_object.children[j].position.set(d1.x, d1.y, d1.z);
                }
                let v1: THREE.Vector3;
                if (axisMode == "X") {
                    v1 = new THREE.Vector3(1,0,0);
                }
                else if (axisMode == "Y") {
                    v1 = new THREE.Vector3(0, 1, 0);
                }
                else {
                    v1 = new THREE.Vector3(0, 0, 1);
                }
                nucleotides[i].visual_object.children[j].rotateOnWorldAxis(v1, dirangle);
                rot = true;*/
            }
            /*for (let j = 0; j < nucleotides[i].visual_object.children.length; j++) {
                let v1: THREE.Vector3;
                if (axisMode == "X") {
                    v1 = new THREE.Vector3(1, 0, 0);
                }
                else if (axisMode == "Y") {
                    v1 = new THREE.Vector3(0, 1, 0);
                }
                else {
                    v1 = new THREE.Vector3(0, 0, 1);
                }
                nucleotides[i].visual_object.children[j].rotateOnWorldAxis(v1, dirangle);
            }*/
            // }
        }
        // let tempnuc = nucleotides[i];
        /*if (rot) {
            if (scopeMode.includes("Strand")) {
                i += systems[tempnuc.my_system].strands[tempnuc.my_strand - 1].nucleotides.length - tempnuc.local_id - 1; //increment i to get to end of strand; subtract 1 because add 1 in loop automatically
            }
            if (scopeMode.includes("System")) {
                let locsysID = (tempnuc.my_strand - 1) * systems[tempnuc.my_system].strands[tempnuc.my_strand - 1].nucleotides.length + tempnuc.local_id; //gets nucleotide id in relation to system
                i += systems[tempnuc.my_system].system_length() - locsysID - 1; //increment i to get to end of system; subtract 1 to undo automatic increment by for loop
            }
        }*/
    }
    if (!rot) { //if no object has been selected, rotation will not occur and error message displayed
        alert("Please select an object to rotate.");
    }
    render();
}
function getAxisMode() {
    var modeRadioButtons = document.forms['Axis'].elements['rotate']; //get radio buttons in form with id 'Axis' and radio buttons with name 'rotate'
    for (let i = 0, len = modeRadioButtons.length; i < len; i++) { //for each radio button
        if (modeRadioButtons[i].checked) { //if radio button is checked
            axisMode = modeRadioButtons[i].value; //set axisMode to radio button's value: X,Y, or Z
            break;
        }
    }
}
