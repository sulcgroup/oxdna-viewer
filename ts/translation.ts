var actionMode: string = ""; //select and/or drag
var scopeMode: string = ""; //nucleotides/strand/system
var axisMode: string = ""; //x,y, or z axis

function getActionMode() {
    // Get the checkbox
    actionMode = "";
    var checkBoxes = document.forms['Action'].elements['action']; //get checkboxes in form with id = 'Action' and checkboxes with name = 'action'
    for (let i: number = 0, len: number = checkBoxes.length; i < len; i++) { //for each checkbox
        if (checkBoxes[i].checked) { //if checkbox checked, add mode to actionMode string
            actionMode += checkBoxes[i].value;
        }
    }
}

function getScopeMode() {
    var modeRadioButtons = document.forms['Mode'].elements['mode']; //get radio buttons in form with id = 'Mode' and radio buttons with name = 'mode'
    for (let i: number = 0, len: number = modeRadioButtons.length; i < len; i++) { //for each radio button
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
    sz[i].onclick = function () { // assign onclick handler function to each radio button
        //when radio button changed, get new modes
        getScopeMode();
    };
}

// get list of checkboxes with name 'action'
var sz = document.forms['Action'].elements['action']; //form id = 'Action'; checkbox name = 'action'
// loop through list

for (let i = 0, len = sz.length; i < len; i++) {
    sz[i].onclick = function () { // assign onclick handler function to each
        // put clicked radio button's value in total field
        getActionMode();
        if (actionMode.includes("Drag")) {
            drag();
        }
    };
}

let dragControls: THREE.DragControls; //dragging functionality
function drag() { //sets up DragControls - allows dragging of DNA - if action mode includes "drag"
    var nucleotide_objects = []
    for (let i = 6; i < scene.children.length; i++){
        nucleotide_objects.push(scene.children[i].children)
    }
    nucleotide_objects = nucleotide_objects.flat(1)
    dragControls = new THREE.DragControls(nucleotide_objects, camera, true, renderer.domElement);
    dragControls.addEventListener('dragstart', function (event) { controls.enabled = false; }); // prevents rotation of camera
    dragControls.addEventListener('dragend', function (event) { controls.enabled = true; })
}
let angle: number = 90 * Math.PI / 180;

function setRotAngle(textArea) { //get angle in text area and store it
    angle = parseInt(textArea.value) * Math.PI / 180;
}

function getRotObj(i) { //identify selected objects and rotate
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

function rotate(dir) { //rotate according to given direction depending on which arrow button is pressed; left = -1 = counterclockwise; right = 1 = clockwise
    var rot = false; //rotation success boolean
    for (let i = 0; i < selected_bases.length; i++) { //go through each nucleotide in all systems
        if (selected_bases[i] == 1) { //if nucleotide is selected
            let rotobj: THREE.Group = getRotObj(i); //get object to rotate - nucleotide, strand, or system based on mode
            getAxisMode(); //get axis on which to rotate
            updatePos(nucleotides[i].my_system); //update class positions
            //rotate around user selected axis - default is X - and user entered angle - updated every time textarea is changed; default is 90
            let p: THREE.Vector3 = rotobj.position;
            let c: THREE.Vector3 = new THREE.Vector3();
            if (scopeMode.includes("Nuc"))
                c = nucleotides[i].pos;
            else if (scopeMode.includes("Strand"))
                c = systems[nucleotides[i].my_system].strands[nucleotides[i].my_strand].pos;
            else if (scopeMode.includes("System"))
                c = systems[nucleotides[i].my_system].pos;
            console.log(c.x);
            let d: THREE.Vector3 = p.sub(c);
            let matrix: THREE.Matrix3;
            matrix = new THREE.Matrix3();
            if (axisMode == "X") {
                matrix.set(1, 0, 0, 0, Math.cos(angle), -Math.sin(angle), 0, Math.sin(angle), Math.cos(angle));
               //rotobj.rotateX(dir * angle * Math.PI / 180);
            }
            else if (axisMode == "Y") {
               matrix.set(Math.cos(angle), 0, Math.sin(angle), 0, 1, 0, -Math.sin(angle), 0, Math.cos(angle));
                //rotobj.rotateY(dir * angle * Math.PI / 180);
            }
            else {
               matrix.set(Math.cos(angle), -Math.sin(angle), 0, Math.sin(angle), Math.cos(angle), 0, 0, 0, 1);
                //rotobj.rotateZ(dir * angle * Math.PI / 180);
            }
            d.applyMatrix3(matrix);
            d.add(c);
            rotobj.position = d;
            render();
            rot = true;
        }
        let tempnuc = nucleotides[i];
        if (rot) {
            if (scopeMode.includes("Strand")) {
                i += systems[tempnuc.my_system].strands[tempnuc.my_strand - 1].nucleotides.length - tempnuc.local_id - 1; //increment i to get to end of strand; subtract 1 because add 1 in loop automatically
            }
            else if (scopeMode.includes("System")) {
                let locsysID = (tempnuc.my_strand - 1) * systems[tempnuc.my_system].strands[tempnuc.my_strand - 1].nucleotides.length + tempnuc.local_id; //gets nucleotide id in relation to system
                i += systems[tempnuc.my_system].system_length() - locsysID - 1; //increment i to get to end of system; subtract 1 to undo automatic increment by for loop
            }
        }
    }
    if (!rot) { //if no object has been selected, rotation will not occur and error message displayed
        alert("Please select an object to rotate.");
    }
}

function getAxisMode() { //gets user selected axis around which to rotate; default is x-axis
    var modeRadioButtons = document.forms['Axis'].elements['rotate']; //get radio buttons in form with id 'Axis' and radio buttons with name 'rotate'
    for (let i: number = 0, len: number = modeRadioButtons.length; i < len; i++) { //for each radio button
        if (modeRadioButtons[i].checked) { //if radio button is checked
            axisMode = modeRadioButtons[i].value; //set axisMode to radio button's value: X,Y, or Z
            break;
        }
    }
}