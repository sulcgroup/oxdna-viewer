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
                    let sys = n.getSystem(), sid = n.gid - sys.globalStartId;
                    if (n.dummySys !== null) {
                        sys = n.dummySys;
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
                        diff.add(box.clone().multiplyScalar(-0.5));
                    }
                    //actually move things.
                    n.translatePosition(diff);
                    actualCoM.add(new THREE.Vector3(system.cmOffsets[sid * 3], system.cmOffsets[sid * 3 + 1], system.cmOffsets[sid * 3 + 2]).multiplyScalar(1 / system.INSTANCES));
                });
                break;
            case "Strand":
                diff = s.getCom();
                diff.add(shift);
                diff.divide(box).floor().multiply(box).multiplyScalar(-1);
                diff.add(shift);
                if (centerOption === "Origin") {
                    diff.add(box.clone().multiplyScalar(-0.5));
                }
                s.translateStrand(diff);
                actualCoM.add(s.getCom().multiplyScalar(s.monomers.length).multiplyScalar(1 / system.INSTANCES));
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
            diff.floor();
            diff.multiply(box).multiplyScalar(-1);
            s.translateStrand(diff);
        }
        s.monomers.forEach(n => {
            if (boxOption === "Monomer") {
                diff = new THREE.Vector3(system.cmOffsets[n.gid * 3], system.cmOffsets[n.gid * 3 + 1], system.cmOffsets[n.gid * 3 + 2]);
                diff.divide(box).floor().multiply(box).multiplyScalar(-1);
                n.translatePosition(diff);
            }
        });
    });
}
//Handles every possible combination of applying PBC conditions and centering
function PBCswitchbox(system) {
    let boxOption = document.getElementById("inboxing").value;
    let centerOption = document.getElementById("centering").value;
    if (boxOption !== "None" && centerOption !== "None") {
        //This two-step in-boxing process seems to work in all cases I can find
        translate(system, boxOption, "None");
        translate(system, boxOption, centerOption);
    }
    else if (boxOption !== "None" && centerOption === "None") {
        dumbBoxing(system, boxOption);
    }
    else if (boxOption === "None" && centerOption !== "None") {
        dumbCentering(system, centerOption);
    }
}
function getCenteringGoal() {
    // Check which point we want as origin
    let centerOption = document.getElementById("centering").value;
    switch (centerOption) {
        case "Box Center": return box.clone().divideScalar(2);
        case "Origin": return new THREE.Vector3();
        default: return undefined;
    }
}
// Not sure if much more clever...
function cleverBoxing() {
    let realMod = (n, m) => ((n % m) + m) % m;
    let center = getCenteringGoal();
    let coordInBox = (coord) => {
        let p = coord.clone();
        let shift = box.clone().divideScalar(2).sub(center);
        p.add(shift);
        p.x = realMod(p.x, box.x);
        p.y = realMod(p.y, box.y);
        p.z = realMod(p.z, box.z);
        p.sub(shift);
        return p;
    };
    let boxOption = document.getElementById("inboxing").value;
    if (boxOption == "Monomer") {
        elements.forEach(e => {
            let pOld = e.getInstanceParameter3("cmOffsets");
            let pNew = coordInBox(pOld);
            e.translatePosition(pNew.sub(pOld));
        });
    }
    else if (boxOption == "Strand") {
        systems.forEach(system => {
            system.strands.forEach(strand => {
                let pOld = strand.getCom();
                ;
                let pNew = coordInBox(pOld);
                strand.translateStrand(pNew.sub(pOld));
            });
        });
    }
}
function cleverCentering() {
    let origin = getCenteringGoal();
    if (!origin) {
        return; // Nothing to center to
    }
    // Calculate Centre of mass, taking periodic boundary conditions into account
    let com = calcCOM(Array.from(elements.values()));
    // Move COM to desired origin point
    translateElements(new Set(elements.values()), origin.clone().sub(com));
    // Bring elements inside box
    cleverBoxing();
    // Update instances
    elements.forEach(e => { if (e.neighbor3)
        calcsp(e); });
    systems.forEach(s => s.callUpdates(['instanceOffset']));
    tmpSystems.forEach(s => s.callUpdates(['instanceOffset']));
    render();
}
// Calculate center of mass taking periodic boundary conditions into account:
// https://doi.org/10.1080/2151237X.2008.10129266
// https://en.wikipedia.org/wiki/Center_of_mass#Systems_with_periodic_boundary_conditions
function calcCOM(elems) {
    // Create one averaging variable for each dimension, representing that 1D
    // interval as a unit circle in 2D (with the circumference being the
    // bounding box side length)
    let cm_x = new THREE.Vector2(), cm_y = new THREE.Vector2(), cm_z = new THREE.Vector2();
    elems.forEach((e) => {
        let p = e.getInstanceParameter3("cmOffsets");
        // Calculate positions on unit circle for each dimension and that to the
        // sum.
        let angle = new THREE.Vector3((p.x * 2 * Math.PI) / box.x, (p.y * 2 * Math.PI) / box.y, (p.z * 2 * Math.PI) / box.z);
        cm_x.add(new THREE.Vector2(Math.cos(angle.x), Math.sin(angle.x)));
        cm_y.add(new THREE.Vector2(Math.cos(angle.y), Math.sin(angle.y)));
        cm_z.add(new THREE.Vector2(Math.cos(angle.z), Math.sin(angle.z)));
    });
    // Divide center of mass sums to get the averages
    cm_x.divideScalar(elems.length);
    cm_y.divideScalar(elems.length);
    cm_z.divideScalar(elems.length);
    // Convert back from unit circle coordinates into x,y,z
    let cms = new THREE.Vector3(box.x / (2 * Math.PI) * (Math.atan2(-cm_x.y, -cm_x.x) + Math.PI), box.y / (2 * Math.PI) * (Math.atan2(-cm_y.y, -cm_y.x) + Math.PI), box.z / (2 * Math.PI) * (Math.atan2(-cm_z.y, -cm_z.x) + Math.PI));
    return cms;
}
