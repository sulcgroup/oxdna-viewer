function drag() {
    if (getMode() == "drag") {
        let dragControls = new THREE.DragControls(nucleotide_3objects, camera, true, renderer.domElement);
        dragControls.addEventListener('dragstart', function (event) { controls.enabled = false; });
        dragControls.addEventListener('dragend', function (event) { controls.enabled = true; });
    }
    else if (getMode() == "dragGroup") {
        let backbones = [];
        for (let i = 0; i < nucleotides.length; i++) {
            backbones.push(nucleotides[i].visual_object.children[0]);
        }
        // as a child of the grid
        let dragControls = new THREE.DragControls(backbones, camera, false, renderer.domElement);
        dragControls.addEventListener('dragstart', function (event) { controls.enabled = false; });
        dragControls.addEventListener('dragend', function (event) { controls.enabled = true; });
    }
}
function getMode() {
    var modeRadioButtons = document.forms['Mode'].elements['mode'];
    var val;
    for (var i = 0, len = modeRadioButtons.length; i < len; i++) {
        if (modeRadioButtons[i].checked) {
            val = modeRadioButtons[i].value;
            break;
        }
    }
    return val;
}
// get list of radio buttons with name 'mode'
var sz = document.forms['Mode'].elements['mode'];
// loop through list
for (var i = 0, len = sz.length; i < len; i++) {
    sz[i].onclick = function () {
        // put clicked radio button's value in total field
        if (getMode() == "drag" || getMode() == "dragGroup") {
            drag();
        }
    };
}
