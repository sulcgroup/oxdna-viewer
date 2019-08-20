/// <reference path="./three/index.d.ts" />
function translate(shift) {
    let box_option = document.getElementById("inboxing").value;
    let center_option = document.getElementById("centering").value;
    switch (box_option) {
        case "Nucleotide":
            for (let i = 0; i < systems[sys_count][strands].length; i++) {
                for (let j = 0; j < systems[sys_count][strands][i][monomers].length; j++) {
                    let n_pos = elements[i][objects][elements[i].COM].position;
                    n_pos.add(shift);
                    let diff = new THREE.Vector3;
                    diff.addVectors(shift, n_pos.multiplyScalar(1 / box).floor().multiplyScalar(box * -1));
                    if (center_option === "Origin") {
                        diff.add(new THREE.Vector3(box * -0.5, box * -0.5, box * -0.5));
                    }
                    for (let k = 0; k < systems[sys_count][strands][i][monomers][j][objects].length; k++) {
                        systems[sys_count][strands][i][monomers][j][objects][k].position.add(diff);
                    }
                }
            }
            break;
        case "Strand":
            for (let i = 0; i < systems[sys_count][strands].length; i++) {
                let n_pos = systems[sys_count][strands][i].get_com();
                n_pos.add(shift);
                let diff = new THREE.Vector3;
                diff.addVectors(shift, n_pos.multiplyScalar(1 / box).floor().multiplyScalar(box * -1));
                if (center_option === "Origin") {
                    diff.add(new THREE.Vector3(box * -0.5, box * -0.5, box * -0.5));
                }
                for (let j = 0; j < systems[sys_count][strands][i][monomers].length; j++) {
                    for (let k = 0; k < systems[sys_count][strands][i][monomers][j][objects].length; k++)
                        systems[sys_count][strands][i][monomers][j][objects][k].position.add(diff);
                }
            }
            break;
    }
}
function get_box_parameters() {
    let wrt = new THREE.Vector3(0, 0, 0);
    let new_com = new THREE.Vector3(box, box, box).multiplyScalar(0.5);
    for (let i = 0; i < systems[sys_count][strands].length; i++) {
        wrt.add(systems[sys_count][strands][i].get_com());
    }
    wrt.multiplyScalar(1 / systems[sys_count][strands].length);
    let my_shift = new THREE.Vector3;
    my_shift.addVectors(wrt.multiplyScalar(-1), new_com);
    return my_shift;
}
//translates everything equally so that the center of mass is at the origin
function dumb_centering() {
    let sum = new THREE.Vector3(0, 0, 0);
    elements.forEach((e) => {
        sum.add(e[objects][e.COM].position);
    });
    sum.multiplyScalar(-1 / elements.length);
    //Are we centering to the origin (default) or to the box center?
    if (document.getElementById("centering").value === "Box Center") {
        sum.add(new THREE.Vector3(box * 0.5, box * 0.5, box * 0.5));
    }
    elements.forEach((e) => {
        e[objects].forEach((o) => {
            o.position.add(sum);
        });
    });
}
function dumb_boxing(box_option) {
    let diff;
    for (let i = 0; i < systems[sys_count][strands].length; i++) { //for each strand in current system
        if (box_option === "Strand") {
            let cms = systems[sys_count][strands][i].get_com();
            diff = cms.multiplyScalar(-1 / box).floor().multiplyScalar(box);
        }
        for (let j = 0; j < systems[sys_count][strands][i][monomers].length; j++) { //for every nucleotide in strand
            if (box_option === "Nucleotide") {
                let cms = new THREE.Vector3; //vector3s are objects, and everything in JavaScript is a pointer.
                cms.copy(systems[sys_count][strands][i][monomers][j][objects][systems[sys_count][strands][i][monomers][j].COM].position);
                diff = cms.multiplyScalar(-1 / box).floor().multiplyScalar(box);
            }
            for (let k = 0; k < systems[sys_count][strands][i][monomers][j][objects].length; k++) { //for every Mesh in nucleotide
                systems[sys_count][strands][i][monomers][j][objects][k].position.add(diff);
            }
        }
    }
}
function PBC_switchbox() {
    let box_option = document.getElementById("inboxing").value;
    let center_option = document.getElementById("centering").value;
    let my_shift;
    switch (box_option) {
        case "Nucleotide":
            switch (center_option) {
                case "Origin":
                    my_shift = get_box_parameters();
                    translate(my_shift);
                case "Box Center":
                    my_shift = get_box_parameters();
                    translate(my_shift);
                case "None":
                    dumb_boxing(box_option);
            }
            break;
        case "Strand":
            switch (center_option) {
                case "Origin":
                    my_shift = get_box_parameters();
                    translate(my_shift);
                case "Box Center":
                    my_shift = get_box_parameters();
                    translate(my_shift);
                case "None":
                    dumb_boxing(box_option);
                    break;
            }
            break;
        case "None":
            switch (center_option) {
                case "Origin":
                    dumb_centering();
                    break;
                case "Box Center":
                    dumb_centering();
                    break;
                case "None":
                    break;
            }
            break;
    }
}
