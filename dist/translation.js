let dragControls;
function drag() {
    dragControls = new THREE.DragControls(nucleotide_3objects, camera, true, renderer.domElement);
    dragControls.addEventListener('dragstart', function (event) { controls.enabled = false; }); // prevents rotation
    dragControls.addEventListener('dragend', function (event) { controls.enabled = true; });
}
var mode;
function getMode() {
    var modeRadioButtons = document.forms['Mode'].elements['mode'];
    for (let i = 0, len = modeRadioButtons.length; i < len; i++) {
        if (modeRadioButtons[i].checked) {
            mode = modeRadioButtons[i].value;
            break;
        }
    }
}
// get list of radio buttons with name 'mode'
var sz = document.forms['Mode'].elements['mode'];
// loop through list
var dragHist = false;
for (var i = 0, len = sz.length; i < len; i++) {
    sz[i].onclick = function () {
        // put clicked radio button's value in total field
        getMode();
        if (mode != "baseSelect") {
            drag();
        }
    };
}
