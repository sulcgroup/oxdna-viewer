/// <reference path="../typescript_definitions/index.d.ts" />

/**
 * Center given elements (or all, if none is given) and apply
 * periodic boundary conditions to all elements to bring
 * everything within the simulation box.
 * @param elems A list of elements to centre
 */

function centerAndPBCBtnClick(elems?: BasicElement[]){
    window.sessionStorage.centerOption = view.centeringMode.get();
    window.sessionStorage.inboxingOption = view.inboxingMode.get();
    // section responsible for electron interaction
    if(window && window.process && process.versions['electron']) {           
        const settings = require("electron-settings");
        //retrieve settings
        settings.set("BOXCentering", {
            "centerOption"   : window.sessionStorage.centerOption,
            "inboxingOption" : window.sessionStorage.inboxingOption
        });
    }

    centerAndPBC(elems);
}

function shiftWithinBox(v: THREE.Vector3, elems?: BasicElement[], targetBox?: THREE.Vector3) {
    if (!elems) {
        elems = Array.from(elements.values());
    }
    if (!targetBox) {
        targetBox = box;
    }
    translateElements(new Set(elems), v);
    bringInBox(elems, getInboxingMode(), targetBox);
    // Update instances
    let affectedSystems = new Set<System>();
    elems.forEach(e=>{
        if (e.n3) calcsp(e);
        affectedSystems.add(e.getSystem());
    });
    affectedSystems.forEach(s=>s.callUpdates(['instanceOffset']));
    tmpSystems.forEach(s=>s.callUpdates(['instanceOffset']));
    if(forceHandler.forces.length > 0) forceHandler.redrawTraps();
    render();
}

/**
 * Center elements in the simulation box and then apply periodic boundary conditions to bring them all in the same box instance.
 * @param elems Optional parameter defining which particles to apply the centering and PBC to.  Defaults to all particles.
 * @param targetBox Optional parameter defining the size of the box. Defaults to the global box size which is the largest box loaded.
 */
function centerAndPBC(elems?: BasicElement[], targetBox?: THREE.Vector3) {
    if (!elems) {
        elems = Array.from(elements.values());
    }
    if (!targetBox) {
        targetBox = box;
    }
    centerElements(elems, targetBox);
    bringInBox(elems, getInboxingMode(), targetBox);

    // Update instances
    let affectedSystems = new Set<System>();
    elems.forEach(e=>{
        if (e.n3) calcsp(e); 
        affectedSystems.add(e.getSystem());
    });
    affectedSystems.forEach(s=>s.callUpdates(['instanceOffset']));
    tmpSystems.forEach(s=>s.callUpdates(['instanceOffset']));
    if (networks.length > 0) {
        networks.forEach(n => {
            n.recalculateVis();
        })
    }
    render();
}

/**
 * Returns a vector of the position to center on, according to the GUI
 */
function getCenteringGoal(): THREE.Vector3 {
    // Check which point we want as origin
    let centerOption: string; 
    if(window.sessionStorage.centerOption){
        centerOption = window.sessionStorage.centerOption;
    } 
    else{
        centerOption = view.centeringMode.get();
    }
    //let centerOption = 
    switch (centerOption) {
        case "Box": return box.clone().divideScalar(2);
        case "Origin": return new THREE.Vector3();
        default: return undefined;
    }
}

/**
 * Returns a string of the mode to apply Periodic Boundary Conditions, according to the GUI.
 * Either "Monomer" or "Strand"
 */
function getInboxingMode(): string {
    if(window.sessionStorage.inboxingOption){
        return window.sessionStorage.inboxingOption;
    }
    return view.inboxingMode.get();
}

/**
 * Peform the actual inboxing 
 * @param boxOption Whether to bring individual nucleotides into the box or the center of mass of each strand.
 * @param targetBox The size of box to use.
 */
function bringInBox(elems: BasicElement[], boxOption: string, targetBox) {
    if (boxOption == "None") {
        return;
    }
    // We need actual modulus
    let realMod = (n: number, m:number)=>((n % m) + m) % m;

    // Find out which center we use, or just use box center
    let center = getCenteringGoal();
    if(!center) {
        center = targetBox.clone().divideScalar(2);
    }

    // If boxing is strand we need to find which systems contain target elems
    let sys2Box:Set<System> = new Set()
    elems.forEach(e => {
        let s = e.getSystem();
        if (!sys2Box.has(s)) {
            sys2Box.add(s)
        }
    });


    // Define function to calculate a coordinates position
    // withing periodic boundaries
    let coordInBox = (coord: THREE.Vector3)=>{
        let p = coord.clone();
        let shift = targetBox.clone().divideScalar(2).sub(center);
        p.add(shift);
        p.x = realMod(p.x, targetBox.x);
        p.y = realMod(p.y, targetBox.y);
        p.z = realMod(p.z, targetBox.z);
        p.sub(shift);
        return p;
    };

    // Apply to either monomers, or whole strands
    if (boxOption == "Monomer") {
        elems.forEach(e=>{
            let pOld = e.getPos();
            let pNew = coordInBox(pOld);
            e.translatePosition(pNew.sub(pOld));
        });
    } else if (boxOption == "Strand") {
        sys2Box.forEach(system=>{
            system.strands.forEach(strand=>{
                let pOld = strand.getPos();;
                let pNew = coordInBox(pOld);
                strand.translateStrand(pNew.sub(pOld));
            });
        });
    } else {
        notify(`"${boxOption}" is not a valid inboxing option. Please use either "Monomer" or "Strand"`, "alert");
    }
}

/**
 * Center a list of elements around a specified point.
 * @param elems List of elements to center
 * @param origin Optional point to center to, will be read from GUI options if not provided
 */
function centerElements(elems: BasicElement[], targetBox, origin?: THREE.Vector3) {
    if (!origin) {
        origin = getCenteringGoal();
        if (!origin) {
            return; // Nothing to center to
        }
    }

    // Calculate Centre of mass, taking periodic boundary conditions into account
    let com: THREE.Vector3
    if (view.centeringElements !== undefined) {
        // If defined, only calc COM of these specific elements
        com = calcCOM(view.centeringElements, targetBox);
    } else {
        com = calcCOM(elems, targetBox);
    }

    // Move COM to desired origin point
    translateElements(new Set(elems), origin.clone().sub(com));
}

// Calculate center of mass taking periodic boundary conditions into account:
// https://doi.org/10.1080/2151237X.2008.10129266
// https://en.wikipedia.org/wiki/Center_of_mass#Systems_with_periodic_boundary_conditions
function calcCOM(elems: BasicElement[], targetBox): THREE.Vector3 {
    // Create one averaging variable for each dimension, representing that 1D
    // interval as a unit circle in 2D (with the circumference being the
    // bounding box side length)
    let cm_x = new THREE.Vector2(),
        cm_y = new THREE.Vector2(),
        cm_z = new THREE.Vector2();

    elems.forEach((e: BasicElement)=>{
        let p = e.getPos();

        // Calculate positions on unit circle for each dimension and that to the
        // sum.
        let angle = new THREE.Vector3(
            (p.x * 2 * Math.PI) / targetBox.x,
            (p.y * 2 * Math.PI) / targetBox.y,
            (p.z * 2 * Math.PI) / targetBox.z
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
        targetBox.x / (2 * Math.PI) * (Math.atan2(-cm_x.y, -cm_x.x) + Math.PI),
        targetBox.y / (2 * Math.PI) * (Math.atan2(-cm_y.y, -cm_y.x) + Math.PI),
        targetBox.z / (2 * Math.PI) * (Math.atan2(-cm_z.y, -cm_z.x) + Math.PI)
    );

    return cms;
}