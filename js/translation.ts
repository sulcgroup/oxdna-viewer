
function drag() {
    if (getMode() == "drag") {
        let dragControls = new THREE.DragControls(nucleotide_3objects, camera, true, renderer.domElement);
        dragControls.addEventListener('dragstart', function (event) { controls.enabled = false; });
        dragControls.addEventListener('dragend', function (event) { controls.enabled = true; });
    }
    else if (getMode() == "dragGroup") {
        alert("IN HERE");
        var objects:THREE.Group[] = [];

        for (var i = 0; i < nucleotide_3objects.length; i++){
            objects.push(nucleotide_3objects[i]);
        }
         // as a child of the grid
        let dragControls = new THREE.DragControls(objects, camera, false, renderer.domElement);
        dragControls.addEventListener('dragstart', function (event) { controls.enabled = false; });
        dragControls.addEventListener('dragend', function (event) { controls.enabled = true; });
    }

}

function getMode() {
    var modeRadioButtons = document.forms['Mode'].elements['mode'];
    var val;
    for (var i: number = 0, len: number = modeRadioButtons.length; i < len; i++) {
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
    sz[i].onclick = function () { // assign onclick handler function to each
        // put clicked radio button's value in total field
        if (getMode() == "drag" || getMode() == "dragGroup") {
            drag();
        }
    };
}