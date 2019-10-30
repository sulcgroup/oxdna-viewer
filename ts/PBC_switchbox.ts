/// <reference path="./three/index.d.ts" />

//translation and centering functions inspired by Cogli
function translate(system, boxOption, centerOption) {
    let wrt = system.strandUnweightedCom(); //this is actually a crude approximation, but needed to handle the fix_diffusion strands
    let targetCoM = box.clone().multiplyScalar(0.5); //because of the previous line, it will miss the target like Cogli does.
    let actualCoM = new THREE.Vector3(0, 0, 0); //so at the end we're going to correct for this
    let shift = new THREE.Vector3;
    shift.addVectors(wrt.multiplyScalar(-1), targetCoM);
    let diff = new THREE.Vector3;
    for (let i = 0; i < system[strands].length; i++) {
        switch (boxOption) { //the cases are exactly the same, but the calculation takes place at a different point in the for loop nest
            case "Monomer":
                for (let j = 0; j < system[strands][i][monomers].length; j++) {
                    //calculate how many boxes the inboxed structure needs to be moved over
                    diff = new THREE.Vector3(system.cmOffsets[(system[strands][i][monomers][j].gid - system.globalStartId) * 3], system.cmOffsets[(system[strands][i][monomers][j].gid - system.globalStartId) * 3 + 1], system.cmOffsets[(system[strands][i][monomers][j].gid - system.globalStartId) * 3 + 2]);
                    diff.add(shift);
                    diff.divide(box).floor().multiply(box).multiplyScalar(-1);
                    //add the centering to the boxing
                    diff.add(shift);
                    //If you want centering to anywhere other than the box center, it needs to be added here
                    if (centerOption === "Origin") { 
                        diff.add(box.clone().multiplyScalar(-0.5))
                    }

                    //actually move things.
                    system[strands][i][monomers][j].translatePosition(diff);
                    actualCoM.add(new THREE.Vector3(system.cmOffsets[(system[strands][i][monomers][j].gid - system.globalStartId) * 3], system.cmOffsets[(system[strands][i][monomers][j].gid - system.globalStartId) * 3 + 1], system.cmOffsets[(system[strands][i][monomers][j].gid  - system.globalStartId) * 3 + 2]).multiplyScalar(1/system.INSTANCES));
                };
                break;
            case "Strand":
                diff = system[strands][i].getCom()
                diff.add(shift);
                diff.divide(box).floor().multiply(box).multiplyScalar(-1);
                diff.add(shift);
                if (centerOption === "Origin") {
                    diff.add(box.clone().multiplyScalar(-0.5))
                }
                system[strands][i].translateStrand(diff);
                actualCoM.add(system[strands][i].getCom().multiplyScalar(system[strands][i][monomers].length).multiplyScalar(1/system.INSTANCES));
                break;
        }
    }
    //correct the inaccurate centering.
    if (centerOption !== "Origin") { 
        actualCoM.add(targetCoM.multiplyScalar(-1));
    }
    system.translateSystem(actualCoM.multiplyScalar(-1));
}

//translates everything equally so that the center of mass is at the origin
function dumbCentering(system, centerOption) {
    let amount = system.getCom();
    amount.multiplyScalar(-1);

    //Are we centering to the origin (default) or to the box center?
    if (centerOption === "Box Center") {
        amount.add(box.clone().divideScalar(2));
    }

    system.translateSystem(amount);
}

//Applies PBC at the scale specified.  Will break structures if they go through the box
function dumbBoxing(system, boxOption) {
    for (let i = 0; i < system[strands].length; i++) {
        let diff = new THREE.Vector3;
        if (boxOption === "Strand") {
            diff = system[strands][i].getCom();
            diff.divide(box);
            diff.floor()
            diff.multiply(box).multiplyScalar(-1);
            system[strands][i].translateStrand(diff);
        }
        for (let j = 0; j < system[strands][i][monomers].length; j++) {
            if (boxOption === "Monomer"){
                diff = new THREE.Vector3(system.cmOffsets[system[strands][i][monomers][j].gid*3], system.cmOffsets[system[strands][i][monomers][j].gid*3+1], system.cmOffsets[system[strands][i][monomers][j].gid*3+2]);
                diff.divide(box).floor().multiply(box).multiplyScalar(-1);
                system[strands][i][monomers][j].translatePosition(diff);
            }
        }
    }
}

//Handles every possible combination of applying PBC conditions and centering
function PBCswitchbox(system: System) {
    let boxOption = (document.getElementById("inboxing") as HTMLSelectElement).value
    let centerOption = (document.getElementById("centering") as HTMLSelectElement).value

    if (boxOption !== "None" && centerOption !== "None"){
        translate(system, boxOption, centerOption);
    }
    else if (boxOption !== "None" && centerOption === "None"){
        dumbBoxing(system, boxOption);
    }
    else if (boxOption === "None" && centerOption !== "None"){
        dumbCentering(system, centerOption);
    }
}