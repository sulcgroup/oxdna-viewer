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


function rotateClock() {
    for (let i = 0; i < selected_bases.length; i++) {
        let visobj = nucleotides[selected_bases[i].id].visual_object;
        for (let j = 0; j < visobj.children.length; j++) {
            let temp = new THREE.Vector3();
            visobj.children[0].getWorldPosition(temp);
            //create a blue LineBasicMaterial
            var material = new THREE.LineBasicMaterial({ color: 0x800000 });
            material.linewidth = 2;
            var geometry = new THREE.Geometry();
            geometry.vertices.push(temp);
            temp = new THREE.Vector3(temp.x, temp.y-5, temp.z)
            geometry.vertices.push(temp);
            var line = new THREE.Line( geometry, material );
            scene.add( line );
            //let tempmesh = new THREE.Mesh(, backbone_materials)
            //scene.add(tempmesh);

            visobj.children[j].rotateOnAxis(temp, Math.PI / 2);
        }
        render();
    }
}
function rotateCounter() {

}