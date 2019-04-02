// select and/or drag
function getActionMode(): string {
    return document.querySelector('input[name="action"]:checked')['value'];
}

// nucleotides/strand/system
function getScopeMode(): string {
    return document.querySelector('input[name="scope"]:checked')['value'];
}

// X/Y/Z
function getAxisMode(): string {
    return document.querySelector('input[name="rotate"]:checked')['value'];
}


let dragControls: THREE.DragControls; //dragging functionality
function drag() { //sets up DragControls - allows dragging of DNA - if action mode includes "drag"
    var nucleotide_objects = []
    for (let i = 6; i < scene.children.length; i++){
        nucleotide_objects.push(scene.children[i].children)
    }
    nucleotide_objects = nucleotide_objects.flat(1)
    dragControls = new THREE.DragControls(nucleotide_objects, camera, true, renderer.domElement);
    dragControls.addEventListener('dragstart', function (event) { controls.enabled = false; }); // prevents rotation of camera
    dragControls.addEventListener('dragend', function (event) { controls.enabled = true; })
}

function getRotObj(i) { //identify selected objects and rotate
    let rotobj;
    let nuctemp = nucleotides[i];
    switch (getScopeMode()) {
        case "Nuc":
            //set rotobj to nucleotide's visual_object
            rotobj = nucleotides[i].visual_object;
            break;
        case "Strand":
            //set rotobj to current nuc's strand's strand_3objects
            rotobj = systems[nuctemp.my_system].strands[nuctemp.my_strand - 1].strand_3objects;
            break;
        case "System":
            //set rotobj to current nuc's system's system_3objects
            rotobj = systems[nuctemp.my_system].system_3objects;
    }
    return rotobj;
}

function rotate() { //rotate according to given angle given in number input
    let angle = (<HTMLInputElement>document.getElementById("rotAngle")).valueAsNumber;
    var rot = false; //rotation success boolean
    for (let i = 0; i < selected_bases.length; i++) { //go through each nucleotide in all systems
        if (selected_bases[i] == 1) { //if nucleotide is selected
            let rotobj = getRotObj(i); //get object to rotate - nucleotide, strand, or system based on mode
            //rotate around user selected axis with user entered angle
            switch(getAxisMode()) {
                case "X": rotobj.rotateX(angle * Math.PI / 180); break;
                case "Y": rotobj.rotateY(angle * Math.PI / 180); break;
                case "Z": rotobj.rotateZ(angle * Math.PI / 180); break;
                default: alert("Unknown rotation axis: "+getAxisMode());
            }
            render();
            rot = true;
        }
        let tempnuc = nucleotides[i];
        if (rot) {
            switch (getScopeMode()) {
                case "Strand":
                    // increment i to get to end of strand;
                    // subtract 1 because add 1 in loop automatically
                    i += systems[tempnuc.my_system].strands[tempnuc.my_strand - 1].nucleotides.length - tempnuc.local_id - 1;
                    break;
                case "System":
                    //gets nucleotide id in relation to system
                    let locsysID = (tempnuc.my_strand - 1) * systems[tempnuc.my_system].strands[tempnuc.my_strand - 1].nucleotides.length + tempnuc.local_id;
                    // increment i to get to end of system;
                    // subtract 1 to undo automatic increment by for loop
                    i += systems[tempnuc.my_system].system_length() - locsysID - 1;
                    break;
            }
        }
    }
    if (!rot) { //if no object has been selected, rotation will not occur and error message displayed
        alert("Please select an object to rotate.");
    }
}

