/// <reference path="./three/index.d.ts" />

//translation and centering functions inspired by Cogli
function translate(system, boxOption, centerOption) {
    let wrt = system.strandUnweightedCom(); //this is actually a crude approximation, but needed to handle the fix_diffusion strands
    let targetCoM = box.clone().multiplyScalar(0.5); //because of the previous line, it will miss the target like Cogli does.
    let actualCoM = new THREE.Vector3(0, 0, 0); //so at the end we're going to correct for this
    let shift = new THREE.Vector3;
    shift.addVectors(wrt.multiplyScalar(-1), targetCoM);
    let diff = new THREE.Vector3;
    //for (let i = 0; i < system.strands.length; i++) {
        system.strands.forEach(s => {
        switch (boxOption) { //the cases are exactly the same, but the calculation takes place at a different point in the for loop nest
            case "Monomer":
                //for (let j = 0; j < system.strands[i].monomers.length; j++) {
                s.monomers.forEach(n => {
                    
                    //let n = system.strands[i].monomers[j];
                    let sys = n.getSystem(),
                    sid = n.gid - sys.globalStartId;
                    if (n.dummySys !== null) {
                        sys = n.dummySys
                        sid = n.sid;
                    }
                    //calculate how many boxes the inboxed structure needs to be moved over
                    diff = new THREE.Vector3(system.cmOffsets[sid * 3], system.cmOffsets[sid * 3 + 1], system.cmOffsets[sid * 3 + 2]);
                    diff.add(shift);
                    diff.divide(box).floor().multiply(box).multiplyScalar(-1);
                    //add the centering to the boxing
                    diff.add(shift);
                    //If you want centering to anywhere other than the box center, it needs to be added here
                    if (centerOption === "Origin") { 
                        diff.add(box.clone().multiplyScalar(-0.5))
                    }

                    //actually move things.
                    n.translatePosition(diff);
                    
                    actualCoM.add(new THREE.Vector3(system.cmOffsets[sid * 3], system.cmOffsets[sid * 3 + 1], system.cmOffsets[sid * 3 + 2]).multiplyScalar(1/system.INSTANCES));
                });
                break;
            case "Strand":
                diff = s.getCom()
                diff.add(shift);
                diff.divide(box).floor().multiply(box).multiplyScalar(-1);
                diff.add(shift);
                if (centerOption === "Origin") {
                    diff.add(box.clone().multiplyScalar(-0.5))
                }
                s.translateStrand(diff);
                actualCoM.add(s.getCom().multiplyScalar(s.monomers.length).multiplyScalar(1/system.INSTANCES));
                break;
        }
    });
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
    system.strands.forEach(s => {
        let diff = new THREE.Vector3;
        if (boxOption === "Strand") {
            diff = s.getCom();
            diff.divide(box);
            diff.floor()
            diff.multiply(box).multiplyScalar(-1);
            s.translateStrand(diff);
        }
        s.monomers.forEach(n => {
            if (boxOption === "Monomer"){
                diff = new THREE.Vector3(system.cmOffsets[n.gid*3], system.cmOffsets[n.gid*3+1], system.cmOffsets[n.gid*3+2]);
                diff.divide(box).floor().multiply(box).multiplyScalar(-1);
                n.translatePosition(diff);
            }
        });
    });
}

//Handles every possible combination of applying PBC conditions and centering
function PBCswitchbox(system: System) {
    let boxOption = (document.getElementById("inboxing") as HTMLSelectElement).value
    let centerOption = (document.getElementById("centering") as HTMLSelectElement).value

    if (boxOption !== "None" && centerOption !== "None"){
        //This two-step in-boxing process seems to work in all cases I can find
        translate(system, boxOption, "None");
        translate(system, boxOption, centerOption);
    }
    else if (boxOption !== "None" && centerOption === "None"){
        dumbBoxing(system, boxOption);
    }
    else if (boxOption === "None" && centerOption !== "None"){
        dumbCentering(system, centerOption);
    }
}