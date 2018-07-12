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
    for (let it = 0; it < 10; it++) {
        for (let i = 0; i < selected_bases.length; i++) {
            let visobj = nucleotides[selected_bases[i].id].visual_object;
            //for (let j = 0; j < visobj.children.length; j++) {
            let temp = new THREE.Vector3();
            visobj.children[0].getWorldPosition(temp);

            //create a blue LineBasicMaterial
            var material = new THREE.LineBasicMaterial({ color: 0x800000 });
            material.linewidth = 2;
            var geometry = new THREE.Geometry();
            geometry.vertices.push(temp);
            let temp1 = new THREE.Vector3(temp.x, temp.y - 3, temp.z)
            geometry.vertices.push(temp1);
            var line = new THREE.Line(geometry, material);
            scene.add(line);
            let temp3 = new THREE.Vector3();
            temp3.copy(temp);
            temp3.normalize()
            //visobj.rotation.y += Math.PI / 2;
            //console.log(visobj.rotation);
            rotateAboutPoint(visobj, temp, temp3, Math.PI/2, true);
            //let tempmesh = new THREE.Mesh(, backbone_materials)
            //scene.add(tempmesh);
            console.log(visobj.rotation);


            // }
            render();
        }
    }

}
function rotateCounter() {

}
// obj - your object (THREE.Object3D or derived)
// point - the point of rotation (THREE.Vector3)
// axis - the axis of rotation (normalized THREE.Vector3)
// theta - radian value of rotation
// pointIsWorld - boolean indicating the point is in world coordinates (default = false)
function rotateAboutPoint(obj, point, axis, theta, pointIsWorld) {
    pointIsWorld = (pointIsWorld === undefined) ? false : pointIsWorld;

    if (pointIsWorld) {
        obj.parent.localToWorld(obj.position); // compensate for world coordinate
    }

    obj.position.sub(point); // remove the offset
    obj.position.applyAxisAngle(axis, theta); // rotate the POSITION
    obj.position.add(point); // re-add the offset

    if (pointIsWorld) {
        obj.parent.worldToLocal(obj.position); // undo world coordinates compensation
    }

    obj.rotateOnAxis(axis, theta); // rotate the OBJECT
}