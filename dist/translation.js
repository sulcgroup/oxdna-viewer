// select and/or drag
let axisMode = "X";
let scopeMode = "Nuc";
let angle = 90 * Math.PI / 180;
let matrix = new THREE.Matrix3();
let v1 = new THREE.Vector3();
let p = new THREE.Vector3();
let c = new THREE.Vector3();
let d = new THREE.Vector3();
function getActionModes() {
    let modes = document.getElementsByName("action");
    let checked = [];
    for (let i = 0; i < modes.length; i++) {
        if (modes[i].checked) {
            checked.push(modes[i].value);
        }
    }
    return checked;
}
// nucleotides/strand/system
function setScopeMode() {
    scopeMode = document.querySelector('input[name="scope"]:checked')['value'];
}
// X/Y/Z
function setAxisMode() {
    axisMode = document.querySelector('input[name="rotate"]:checked')['value'];
}
function setAngle() {
    angle = document.getElementById("rotAngle").valueAsNumber * Math.PI / 180;
}
let dragControls; //dragging functionality
function drag() {
    var nucleotide_objects = [];
    // accounts for lights camera and arrows << i = 7 
    for (let i = 7; i < scene.children.length; i++) {
        nucleotide_objects.push(scene.children[i].children);
    }
    nucleotide_objects = nucleotide_objects.flat(1);
    //selected_bases
    dragControls = new THREE.DragControls(nucleotide_objects, camera, true, renderer.domElement);
    dragControls.addEventListener('dragstart', function (event) { controls.enabled = false; }); // prevents rotation of camera
    dragControls.addEventListener('dragend', function (event) { controls.enabled = true; });
}
let i;
let originalObjPos;
function rotate() {
    let rot = false; //rotation success boolean
    //let index: number = 0;
    //let setEntries = selected_bases.keys();
    //let setEntry = setEntries.next();
    //while (!setEntry.done) {
    selected_bases.forEach((base) => {
        //rotate around user selected axis with user entered angle
        rot = true;
        i = base.global_id;
        originalObjPos = base.pos.clone();
        switch (scopeMode) {
            case "Nuc": {
                c = originalObjPos;
                break;
            }
            case "Strand": {
                c = base.parent.pos.clone();
                break;
            }
            case "System": {
                c = base.parent.parent.pos.clone();
                break;
            }
            default: {
                break;
            }
        }
        switch (axisMode) {
            case "X":
                matrix.set(1, 0, 0, 0, Math.cos(angle), -Math.sin(angle), 0, Math.sin(angle), Math.cos(angle));
                break;
            case "Y":
                matrix.set(Math.cos(angle), 0, Math.sin(angle), 0, 1, 0, -Math.sin(angle), 0, Math.cos(angle));
                break;
            case "Z":
                matrix.set(Math.cos(angle), -Math.sin(angle), 0, Math.sin(angle), Math.cos(angle), 0, 0, 0, 1);
                break;
            default: alert("Unknown rotation axis: " + axisMode);
        }
        for (let j = 0; j < elements[i][objects].length; j++) {
            p = (elements[i][objects][j].position.clone());
            d = p.sub(c);
            switch (axisMode) {
                case "X": {
                    v1.set(1, 0, 0);
                    break;
                }
                case "Y": {
                    v1.set(0, 1, 0);
                    break;
                }
                case "Z": {
                    v1.set(0, 0, 1);
                    break;
                }
                default: break;
            }
            elements[i][objects][j].rotateOnWorldAxis(v1, angle);
            d.applyMatrix3(matrix);
            d.add(c);
            elements[i][objects][j].position.set(d.x, d.y, d.z);
            rot = true;
        }
        //setEntry = setEntries.next();
    });
    if (!rot) { //if no object has been selected, rotation will not occur and error message displayed
        alert("Please select an object to rotate.");
    }
    render();
    //});
}
