/// <reference path="./three/index.d.ts" />
//translation and centering functions inspired by Cogli
function translate(system, box_option, center_option) {
    let wrt = system.strand_unweighted_com(); //this is actually a crude approximation, but needed to handle the fix_diffusion strands
    let target_com = new THREE.Vector3(box, box, box).multiplyScalar(0.5); //because of the previous line, it will miss the target like Cogli does.
    let actual_com = new THREE.Vector3(0, 0, 0); //so at the end we're going to correct for this
    let shift = new THREE.Vector3;
    shift.addVectors(wrt.multiplyScalar(-1), target_com);
    let diff = new THREE.Vector3;
    for (let i = 0; i < system[strands].length; i++) {
        switch (box_option) { //the cases are exactly the same, but the calculation takes place at a different point in the for loop nest
            case "Monomer":
                for (let j = 0; j < system[strands][i][monomers].length; j++) {
                    //calculate how many boxes the inboxed structure needs to be moved over
                    diff = new THREE.Vector3(system.cm_offsets[system[strands][i][monomers][j].global_id * 3], system.cm_offsets[system[strands][i][monomers][j].global_id * 3 + 1], system.cm_offsets[system[strands][i][monomers][j].global_id * 3 + 2]);
                    diff.add(shift);
                    diff.multiplyScalar(1 / box).floor().multiplyScalar(box * -1);
                    //add the centering to the boxing
                    diff.add(shift);
                    //If you want centering to anywhere other than the box center, it needs to be added here
                    if (center_option === "Origin") {
                        diff.add(new THREE.Vector3(box * -0.5, box * -0.5, box * -0.5));
                    }
                    //actually move things.
                    system[strands][i][monomers][j].translate_position(diff);
                    actual_com.add(new THREE.Vector3(system.cm_offsets[system[strands][i][monomers][j].global_id * 3], system.cm_offsets[system[strands][i][monomers][j].global_id * 3 + 1], system.cm_offsets[system[strands][i][monomers][j].global_id * 3 + 2]).multiplyScalar(1 / system.INSTANCES));
                }
                break;
            case "Strand":
                diff = system[strands][i].get_com();
                diff.add(shift);
                diff.multiplyScalar(1 / box).floor().multiplyScalar(box * -1);
                diff.add(shift);
                if (center_option === "Origin") {
                    diff.add(new THREE.Vector3(box * -0.5, box * -0.5, box * -0.5));
                }
                system[strands][i].translate_strand(diff);
                actual_com.add(system[strands][i].get_com().multiplyScalar(system[strands][i][monomers].length).multiplyScalar(1 / system.INSTANCES));
                break;
        }
    }
    //correct the inaccurate centering.
    if (center_option !== "Origin") {
        actual_com.add(target_com.multiplyScalar(-1));
    }
    system.translate_system(actual_com.multiplyScalar(-1));
}
//translates everything equally so that the center of mass is at the origin
function dumb_centering(system, center_option) {
    let amount = system.get_com();
    amount.multiplyScalar(-1);
    //Are we centering to the origin (default) or to the box center?
    if (center_option === "Box Center") {
        amount.add(new THREE.Vector3(box * 0.5, box * 0.5, box * 0.5));
    }
    system.translate_system(amount);
}
//Applies PBC at the scale specified.  Will break structures.
function dumb_boxing(system, box_option) {
    for (let i = 0; i < system[strands].length; i++) {
        let diff = new THREE.Vector3;
        if (box_option === "Strand") {
            diff = system[strands][i].get_com();
            diff.multiplyScalar(1 / box);
            diff.floor();
            diff.multiplyScalar(box * -1);
            system[strands][i].translate_strand(diff);
        }
        for (let j = 0; j < system[strands][i][monomers].length; j++) {
            if (box_option === "Monomer") {
                diff = new THREE.Vector3(system.cm_offsets[system[strands][i][monomers][j].global_id * 3], system.cm_offsets[system[strands][i][monomers][j].global_id * 3 + 1], system.cm_offsets[system[strands][i][monomers][j].global_id * 3 + 2]);
                diff.multiplyScalar(1 / box).floor().multiplyScalar(box * -1);
                system[strands][i][monomers][j].translate_position(diff);
            }
        }
    }
}
//Handles every possible combination of applying PBC conditions and centering
function PBC_switchbox(system) {
    let box_option = document.getElementById("inboxing").value;
    let center_option = document.getElementById("centering").value;
    if (box_option !== "None" && center_option !== "None") {
        translate(system, box_option, center_option);
    }
    else if (box_option !== "None" && center_option === "None") {
        dumb_boxing(system, box_option);
    }
    else if (box_option === "None" && center_option !== "None") {
        dumb_centering(system, center_option);
    }
}
