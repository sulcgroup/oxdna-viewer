/// <reference path="../typescript_definitions/index.d.ts" />

//Handles every possible combination of applying PBC conditions and centering
function PBCswitchbox() {
    cleverCentering();
    cleverBoxing();

    // Update instances
    elements.forEach(e=>{if (e.neighbor3) calcsp(e);})
    systems.forEach(s=>s.callUpdates(['instanceOffset']));
    tmpSystems.forEach(s=>s.callUpdates(['instanceOffset']));
    render();
}

function getCenteringGoal(): THREE.Vector3 {
    // Check which point we want as origin
    let centerOption = (document.getElementById("centering") as HTMLSelectElement).value;
    switch (centerOption) {
        case "Box Center": return box.clone().divideScalar(2);
        case "Origin": return new THREE.Vector3();
        default: return undefined;
    }
}

// Not sure if much more clever...
function cleverBoxing() {
    let realMod = (n: number, m:number)=>((n % m) + m) % m;
    let center = getCenteringGoal();
    if(!center) {
        center = box.clone().divideScalar(2);
    }
    let coordInBox = (coord: THREE.Vector3)=>{
        let p = coord.clone();
        let shift = box.clone().divideScalar(2).sub(center);
        p.add(shift);
        p.x = realMod(p.x, box.x);
        p.y = realMod(p.y, box.y);
        p.z = realMod(p.z, box.z);
        p.sub(shift);
        return p;
    };

    let boxOption = (document.getElementById("inboxing") as HTMLSelectElement).value;
    if (boxOption == "Monomer") {
        elements.forEach(e=>{
            let pOld = e.getInstanceParameter3("cmOffsets");
            let pNew = coordInBox(pOld);
            e.translatePosition(pNew.sub(pOld));
        });
    } else if (boxOption == "Strand") {
        systems.forEach(system=>{
            system.strands.forEach(strand=>{
                let pOld = strand.getCom();;
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
}

// Calculate center of mass taking periodic boundary conditions into account:
// https://doi.org/10.1080/2151237X.2008.10129266
// https://en.wikipedia.org/wiki/Center_of_mass#Systems_with_periodic_boundary_conditions
function calcCOM(elems: BasicElement[]): THREE.Vector3 {
    // Create one averaging variable for each dimension, representing that 1D
    // interval as a unit circle in 2D (with the circumference being the
    // bounding box side length)
    let cm_x = new THREE.Vector2(),
        cm_y = new THREE.Vector2(),
        cm_z = new THREE.Vector2();

    elems.forEach((e: BasicElement)=>{
        let p = e.getInstanceParameter3("cmOffsets");

        // Calculate positions on unit circle for each dimension and that to the
        // sum.
        let angle = new THREE.Vector3(
            (p.x * 2 * Math.PI) / box.x,
            (p.y * 2 * Math.PI) / box.y,
            (p.z * 2 * Math.PI) / box.z
        );

        cm_x.add(new THREE.Vector2(Math.cos(angle.x), Math.sin(angle.x)));
        cm_y.add(new THREE.Vector2(Math.cos(angle.y), Math.sin(angle.y)));
        cm_z.add(new THREE.Vector2(Math.cos(angle.z), Math.sin(angle.z)));
    });

    // Divide center of mass sums to get the averages
    cm_x.divideScalar(elems.length);
    cm_y.divideScalar(elems.length);
    cm_z.divideScalar(elems.length);

    // Convert back from unit circle coordinates into x,y,z
    let cms = new THREE.Vector3(
        box.x / (2 * Math.PI) * (Math.atan2(-cm_x.y, -cm_x.x) + Math.PI),
        box.y / (2 * Math.PI) * (Math.atan2(-cm_y.y, -cm_y.x) + Math.PI),
        box.z / (2 * Math.PI) * (Math.atan2(-cm_z.y, -cm_z.x) + Math.PI)
    );

    return cms;
}