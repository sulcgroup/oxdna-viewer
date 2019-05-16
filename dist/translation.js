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
let angle = 90 * Math.PI / 180;
function setRotAngle(textArea) {
    angle = parseInt(textArea.value) * Math.PI / 180;
}
function getRotObj(i) {
    let rotobj;
    if (scopeMode.includes("Nuc")) {
        rotobj = nucleotides[i].visual_object; //set rotobj to nucleotide's visual_object
    }
    else if (scopeMode.includes("Strand")) {
        let nuctemp = nucleotides[i];
        rotobj = systems[nuctemp.my_system].strands[nuctemp.my_strand - 1].strand_3objects; //set rotobj to current nuc's strand's strand_3objects
    }
    else if (scopeMode.includes("System")) {
        let nuctemp = nucleotides[i];
        rotobj = systems[nuctemp.my_system].system_3objects; //set rotobj to current nuc's system's system_3objects
    }
    return rotobj;
}
function rotate(dir) {
    let dirangle = dir * angle;
    let t = performance.now();
    updatePos(); //update class positions
    let t2 = performance.now();
    console.log("updatePos Total Time: " + (t2 - t));
    let rot = false;
    getAxisMode(); //get axis on which to rotate //rotate around user selected axis - default is X - and user entered angle - updated every time textarea is changed; default is 90
    let matrix;
    matrix = new THREE.Matrix3();
    if (axisMode == "X") {
        matrix.set(1, 0, 0, 0, Math.cos(dirangle), -Math.sin(dirangle), 0, Math.sin(dirangle), Math.cos(dirangle));
    }
    else if (axisMode == "Y") {
        matrix.set(Math.cos(dirangle), 0, Math.sin(dirangle), 0, 1, 0, -Math.sin(dirangle), 0, Math.cos(dirangle));
    }
    else {
        matrix.set(Math.cos(dirangle), -Math.sin(dirangle), 0, Math.sin(dirangle), Math.cos(dirangle), 0, 0, 0, 1);
    }
    t = performance.now();
    for (let i = 0; i < selected_bases.length; i++) { //go through each nucleotide in all systems
        if (selected_bases[i] == 1) { //if nucleotide is selected
            rot = true;
            let originalObjPos = new THREE.Vector3();
            originalObjPos = nucleotides[i].pos.clone();
            //let originalObjPos: THREE.Vector3 = new THREE.Vector3();
            //originalObjPos.copy(nucleotides[i].visual_object.children[3].position);
            t = performance.now();
            for (let j = 0; j < nucleotides[i].visual_object.children.length; j++) {
                if (true) {
                    let p = new THREE.Vector3();
                    p = (nucleotides[i].visual_object.children[j].position.clone());
                    let c = new THREE.Vector3();
                    if (scopeMode.includes("Nuc"))
                        c = originalObjPos;
                    else if (scopeMode.includes("Strand"))
                        c = (systems[nucleotides[i].my_system].strands[nucleotides[i].my_strand - 1].pos.clone());
                    else if (scopeMode.includes("System"))
                        c.copy(systems[nucleotides[i].my_system].pos.clone());
                    let d = p.sub(c);
                    let v1;
                    if (axisMode == "X") {
                        v1 = new THREE.Vector3(1, 0, 0);
                    }
                    else if (axisMode == "Y") {
                        v1 = new THREE.Vector3(0, 1, 0);
                    }
                    else {
                        v1 = new THREE.Vector3(0, 0, 1);
                    }
                    nucleotides[i].visual_object.children[j].rotateOnWorldAxis(v1, dirangle);
                    d.applyMatrix3(matrix);
                    d.add(c);
                    nucleotides[i].visual_object.children[j].position.set(d.x, d.y, d.z);
                    rot = true;
                }
            }
            t2 = performance.now();
            //console.log("for loop Time 1: " + t);
            //console.log("for loop Time 2: " + t2);
            console.log("for loop Total Time: " + (t2 - t));
        }
    }
    t2 = performance.now();
    //console.log("selected bases loop Time 1: " + t);
    //console.log("selected bases loop Time 2: " + t2);
    console.log("selected bases loop Total Time: " + (t2 - t));
    if (!rot) { //if no object has been selected, rotation will not occur and error message displayed
        alert("Please select an object to rotate.");
    }
    render();
}
function getAxisMode() {
    var modeRadioButtons = document.forms['Axis'].elements['rotate']; //get radio buttons in form with id 'Axis' and radio buttons with name 'rotate'
    for (let i = 0, len = modeRadioButtons.length; i < len; i++) { //for each radio button
        if (modeRadioButtons[i].checked) { //if radio button is checked
            axisMode = modeRadioButtons[i].value; //set axisMode to radio button's value: X,Y, or Z
            break;
        }
    }
}
/*
 * let t : number = performance.now();
    updatePos();
    let t2: number = performance.now();
    //console.log("updatePos Time 1: " + t);
    //console.log("updatePos Time 2: " + t2);
    console.log("updatePos Total Time: " + (t2 - t));

    let angle = (<HTMLInputElement>document.getElementById("rotAngle")).valueAsNumber * Math.PI/180;
    var rot = false; //rotation success boolean

    t = performance.now();
    selected_bases.forEach( (base)=> {
        //let rotobj = getRotObj(base); //get object to rotate - nucleotide, strand, or system based on mode
        //rotate around user selected axis with user entered angle
        rot = false;
        let matrix: THREE.Matrix3 = new THREE.Matrix3();
        switch (getAxisMode()) {
            case "X": {
                matrix.set(1, 0, 0, 0, Math.cos(angle), -Math.sin(angle), 0, Math.sin(angle), Math.cos(angle));
                break;
            };
            case "Y": {
                matrix.set(Math.cos(angle), 0, Math.sin(angle), 0, 1, 0, -Math.sin(angle), 0, Math.cos(angle));
                break;
            };
            case "Z": {
                matrix.set(Math.cos(angle), -Math.sin(angle), 0, Math.sin(angle), Math.cos(angle), 0, 0, 0, 1);
                break;
            };
            default: alert("Unknown rotation axis: " + getAxisMode());
        }

        rot = true;
        let originalObjPos: THREE.Vector3 = new THREE.Vector3();
        originalObjPos = base.pos.clone();
        //let originalObjPos: THREE.Vector3 = new THREE.Vector3();
        //originalObjPos.copy(nucleotides[i].visual_object.children[3].position);
        t = performance.now();
        for (let j = 0; j < base.visual_object.children.length; j++) {
            if (true) {
                let p: THREE.Vector3 = new THREE.Vector3();
                p = (base.visual_object.children[j].position.clone());
                let c: THREE.Vector3 = new THREE.Vector3();
                switch (getScopeMode()) {
                    case "Nuc":
                        c = originalObjPos;
                        break;
                    case "Strand":
                        c = base.parent.pos.clone();
                        break;
                    case "System":
                        c= base.parent.parent.pos.clone();
                        break;
                }
                let d: THREE.Vector3 = p.sub(c);
                let v1: THREE.Vector3;
                switch (getAxisMode()) {
                    case "X": {
                        v1 = new THREE.Vector3(1, 0, 0);
                        break;
                    };
                    case "Y": {
                        v1 = new THREE.Vector3(0, 1, 0);
                        break;
                    };
                    case "Z": {
                        v1 = new THREE.Vector3(0, 0, 1);
                        break;
                    };
                    default: alert("Unknown rotation axis: " + getAxisMode());
                }
                base.visual_object.children[j].rotateOnWorldAxis(v1, angle);
                d.applyMatrix3(matrix);
                d.add(c);
                base.visual_object.children[j].position.set(d.x, d.y, d.z);
                rot = true;
            }
        }
        t2 = performance.now();
        //console.log("for loop Time 1: " + t);
        //console.log("for loop Time 2: " + t2);
        console.log("for loop Total Time: " + (t2 - t));
        if (!rot) { //if no object has been selected, rotation will not occur and error message displayed
            alert("Please select an object to rotate.");
        }
        render();

    });
    t2 = performance.now();
    //console.log("selected bases loop Time 1: " + t);
    //console.log("selected bases loop Time 2: " + t2);
    console.log("selected bases loop Total Time: " + (t2 - t));
    */ 
