var actionMode: string = "";
var scopeMode: string = "";
var axisMode: string = "";

function getActionMode() {
    // Get the checkbox
    actionMode = "";
    var checkBoxes = document.forms['Action'].elements['action'];
    for (let i: number = 0, len: number = checkBoxes.length; i < len; i++) {
        if (checkBoxes[i].checked) { //if checkbox checked, add mode to string
            actionMode += checkBoxes[i].value;
        }
    }
}

function getScopeMode() {
    var modeRadioButtons = document.forms['Mode'].elements['mode'];
    for (let i: number = 0, len: number = modeRadioButtons.length; i < len; i++) {
        if (modeRadioButtons[i].checked) {
            scopeMode = modeRadioButtons[i].value;
            break;
        }
    }
}

// get list of radio buttons with name 'mode'
var sz = document.forms['Mode'].elements['mode'];
// loop through list

var dragHist = false;
for (let i = 0, len = sz.length; i < len; i++) {
    sz[i].onclick = function () { // assign onclick handler function to each
        // put clicked radio button's value in total field
        getScopeMode();
        getActionMode();
    };
}

// get list of checkboxes with name ''
var sz = document.forms['Action'].elements['action'];
// loop through list

var dragHist = false;
for (let i = 0, len = sz.length; i < len; i++) {
    sz[i].onclick = function () { // assign onclick handler function to each
        // put clicked radio button's value in total field
        getScopeMode();
        getActionMode();
        if (actionMode.includes("Drag")) {
            drag();
        }
    };
}

let dragControls: THREE.DragControls;
function drag() {
    dragControls = new THREE.DragControls(nucleotide_3objects, camera, true, renderer.domElement);
    dragControls.addEventListener('dragstart', function (event) { controls.enabled = false; }); // prevents rotation
    dragControls.addEventListener('dragend', function (event) { controls.enabled = true; });
}

var temp = new THREE.Vector3();
function getRotObj(i) {
    let rotobj;
    let found = false;
    if (scopeMode.includes("Nuc")) {
        rotobj = nucleotides[i].visual_object;
    }
    else if (scopeMode.includes("Strand")) {
        let nuctemp = nucleotides[i];
        rotobj = systems[nuctemp.my_system].strands[nuctemp.my_strand - 1].strand_3objects;

    }
    else if (scopeMode.includes("System")) {
        let nuctemp = nucleotides[i];
        rotobj = systems[nuctemp.my_system].system_3objects;
    }
    return rotobj;
}
function rotate(dir) {
    console.log(dir);
    let sel = false;
    for (let i = 0; i < selected_bases.length; i++) {
        if (selected_bases[i] == 1) {
            let rotobj = getRotObj(i);
            getAxisMode();
            if (axisMode == "X") {
                rotobj.rotateX(dir * Math.PI / 2);
            }
            else if (axisMode == "Y") {
                rotobj.rotateY(dir * Math.PI / 2);
            }
            else {
                rotobj.rotateZ(dir * Math.PI / 2);
            }
            render();
            sel = true;
        }
        let tempnuc = nucleotides[i];
        if (scopeMode.includes("Strand")) {
            i += systems[tempnuc.my_system].strands[tempnuc.my_strand - 1].nucleotides.length - 2;
        }
        else if (scopeMode.includes("System")) {
            i += systems[tempnuc.my_system].system_length() - 1;
        }
    }
    if (!sel) {
        alert("Please select an object to rotate.");
    }
}

function getAxisMode() {
    var modeRadioButtons = document.forms['Axis'].elements['rotate'];
    for (let i: number = 0, len: number = modeRadioButtons.length; i < len; i++) {
        if (modeRadioButtons[i].checked) {
            axisMode = modeRadioButtons[i].value;
            break;
        }
    }
}