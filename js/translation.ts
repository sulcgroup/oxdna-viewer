var actionMode: string;
var scopeMode: string;

function getActionMode() {
    // Get the checkbox
    actionMode = "";
    var checkBoxes = document.forms['Action'].elements['action'];
    for (let i: number = 0, len: number = checkBoxes.length; i < len; i++) {
        if (checkBoxes[i].checked) { //if checkbox checked, add mode to string
            actionMode += checkBoxes[i].value;
        }
    }
    //console.log(actionMode);
}

function getScopeMode() {
    var modeRadioButtons = document.forms['Mode'].elements['mode'];
    for (let i: number = 0, len: number = modeRadioButtons.length; i < len; i++) {
        if (modeRadioButtons[i].checked) {
            scopeMode = modeRadioButtons[i].value;
            break;
        }
    }
    //console.log(scopeMode);
}

// get list of radio buttons with name 'mode'
var sz = document.forms['Mode'].elements['mode'];
// loop through list

var dragHist = false;
for (var i = 0, len = sz.length; i < len; i++) {
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
for (var i = 0, len = sz.length; i < len; i++) {
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