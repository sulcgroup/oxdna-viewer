// select and/or drag
let axisMode: string = "X";
let scopeMode: string = "Nuc";
let angle: number = 90 * Math.PI / 180;
let matrix: THREE.Matrix3 = new THREE.Matrix3();
let v1: THREE.Vector3 = new THREE.Vector3();
let p: THREE.Vector3 = new THREE.Vector3();
let c: THREE.Vector3 = new THREE.Vector3();
let d: THREE.Vector3 = new THREE.Vector3();
function getActionModes(): string[] {
    let modes = <NodeListOf<HTMLInputElement>>document.getElementsByName("action");
    let checked = [];
    for (let i = 0; i < modes.length; i++) {
        if (modes[i].checked) {
            checked.push(modes[i].value);
        }
    }
    return checked;
}

// nucleotides/strand/system
function setScopeMode(): void {
    scopeMode = document.querySelector('input[name="scope"]:checked')['value'];
}

// X/Y/Z
function setAxisMode(): void {
    axisMode = document.querySelector('input[name="rotate"]:checked')['value'];
}

function setAngle(): void {
    angle = (<HTMLInputElement>document.getElementById("rotAngle")).valueAsNumber * Math.PI / 180;
    console.log(angle);
}


let dragControls: THREE.DragControls; //dragging functionality
function drag() { //sets up DragControls - allows dragging of DNA - if action mode includes "drag"
    var nucleotide_objects = []

    // accounts for lights camera and arrows << i = 7 
    for (let i = 7; i < scene.children.length; i++) {
        nucleotide_objects.push(scene.children[i].children);
    }
    nucleotide_objects = nucleotide_objects.flat(1);
    //selected_bases
    dragControls = new THREE.DragControls(nucleotide_objects, camera, true, renderer.domElement);
    dragControls.addEventListener('dragstart', function (event) { controls.enabled = false; }); // prevents rotation of camera
    dragControls.addEventListener('dragend', function (event) { controls.enabled = true; })
}
let i: number;
let originalObjPos: THREE.Vector3;

function rotate() { //rotate according to given angle given in number input
    let rot: boolean = false; //rotation success boolean
    updatePos(); //update class positions
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
                c = originalObjPos; break;
            }
            case "Strand": {
                c = base.parent.pos.clone();
                break;
            }
            case "System": {
                c = base.parent.parent.pos.clone();
                break;
            }
            default: { break; }
        }
        switch (axisMode) {
            case "X": matrix.set(1, 0, 0, 0, Math.cos(angle), -Math.sin(angle), 0, Math.sin(angle), Math.cos(angle)); break;
            case "Y": matrix.set(Math.cos(angle), 0, Math.sin(angle), 0, 1, 0, -Math.sin(angle), 0, Math.cos(angle)); break;
            case "Z": matrix.set(Math.cos(angle), -Math.sin(angle), 0, Math.sin(angle), Math.cos(angle), 0, 0, 0, 1); break;
            default: alert("Unknown rotation axis: " + axisMode);
        }
        for (let j: number = 0; j < nucleotides[i].visual_object.children.length; j++) {
            p = (nucleotides[i].visual_object.children[j].position.clone());
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
            nucleotides[i].visual_object.children[j].rotateOnWorldAxis(v1, angle);
            d.applyMatrix3(matrix);
            d.add(c);
            nucleotides[i].visual_object.children[j].position.set(d.x, d.y, d.z);
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

