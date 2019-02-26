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