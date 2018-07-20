var actionMode;
var scopeMode;
function getActionMode() {
    // Get the checkbox
    actionMode = "";
    var checkBoxes = document.forms['Action'].elements['action'];
    for (let i = 0, len = checkBoxes.length; i < len; i++) {
        if (checkBoxes[i].checked) { //if checkbox checked, add mode to string
            actionMode += checkBoxes[i].value;
        }
    }
    //console.log(actionMode);
}
function getScopeMode() {
    var modeRadioButtons = document.forms['Mode'].elements['mode'];
    for (let i = 0, len = modeRadioButtons.length; i < len; i++) {
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
for (let i = 0, len = sz.length; i < len; i++) {
    sz[i].onclick = function () {
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
    sz[i].onclick = function () {
        // put clicked radio button's value in total field
        getScopeMode();
        getActionMode();
        if (actionMode.includes("Drag")) {
            drag();
        }
    };
}
let dragControls;
function drag() {
    dragControls = new THREE.DragControls(nucleotide_3objects, camera, true, renderer.domElement);
    dragControls.addEventListener('dragstart', function (event) { controls.enabled = false; }); // prevents rotation
    dragControls.addEventListener('dragend', function (event) { controls.enabled = true; });
}
var temp = new THREE.Vector3();
function rotate() {
    let rotobj;
    for (let it = 0; it < 1; it++) {
        for (let i = 0; i < selected_bases.length; i++) {
            let found = false;
            if (scopeMode.includes("Nuc")) {
                rotobj = nucleotides[selected_bases[i].id].visual_object;
                temp = rotobj.children[3].position;
            }
            else if (scopeMode.includes("Strand")) {
                for (let i = 0; i < systems.length; i++) {
                    for (let j = 0; j < systems[i].strands.length; j++) {
                        if (systems[i].strands[j].strand_id == nucleotides[selected_bases[i].id].my_strand) {
                            rotobj = systems[i].strands[j].strand_3objects;
                            found = true;
                            break;
                        }
                        if (found)
                            break;
                    }
                    if (found)
                        break;
                }
            }
            else if (scopeMode.includes("System")) {
                for (let i = 0; i < systems.length; i++) {
                    if (systems[i].system_id == nucleotides[selected_bases[i].id].my_system) {
                        rotobj = systems[i].system_3objects;
                        found = true;
                        break;
                    }
                    if (found)
                        break;
                }
            }
        }
    }
    return rotobj;
}
function rotateClock() {
    let rotobj = rotate();
    rotobj.rotateY(Math.PI / 2);
    render();
    /* var geometry = new THREE.Geometry();
    geometry.vertices.push(temp);
    //rotateAboutPoint(visobj, temp, temp.normalize(), Math.PI/2, true);
     
    //create a blue LineBasicMaterial
    var material = new THREE.LineBasicMaterial({ color: 0x800000 });
    material.linewidth = 2;
    geometry.vertices.push(temp.add(new THREE.Vector3(0, 0, 10)));
    var line = new THREE.Line(geometry, material);
    scene.add(line); */
    //rotateAboutPoint(visobj, temp, temp3, Math.PI / 2, true);
    //console.log(visobj.rotation);
    //console.log(visobj);
}
//}
/* var geometry3 = new THREE.CubeGeometry(3, 2, 1);
var material1 = new THREE.MeshNormalMaterial();

var mesh = new THREE.Mesh(geometry3, material1);
var group = new THREE.Group();
group.add(mesh);

var geometry1 = new THREE.CylinderGeometry(2, 2, 2, 30);
mesh = new THREE.Mesh(geometry1, material1);
mesh.position.set(7, 2, 0);
group.add(mesh);

var geometry2 = new THREE.SphereGeometry(1);

mesh = new THREE.Mesh(geometry2, material1);
mesh.position.set(-5, 5, 0);
group.add(mesh);
render();

scene.add(group); */
//for (let p = 0; p < 99; p++) {
/*  let temp = new THREE.Vector3();
 group.children[0].getWorldPosition(temp);
 //console.log(group);
 //temp.normalize();
 let temp3 = new THREE.Vector3();
 temp3.copy(temp);
 temp3.add(new THREE.Vector3(0, 0, 30));
 group.rotateOnAxis(temp3.normalize(), Math.PI / 2);
 //rotateAboutPoint(group, temp, temp.normalize(), Math.PI / 2, true);
 //console.log(temp);
 console.log(group.rotation);
 render(); */
// }
function rotateCounter() {
    let rotobj = rotate();
    rotobj.rotateY(-Math.PI / 2);
    render();
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
