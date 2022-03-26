//THREE quaternions are in (x, y, z, w) order
//GLSL quaternions are in (w, z, y, x) order
//So when you need to convert between them...
function glsl2three(input: THREE.Vector4) {
    let out = new THREE.Quaternion(input.w, input.z, input.y, input.x);
    return out;
}

function rotateElements(elements: Set<BasicElement>, axis: THREE.Vector3, angle: number, about: THREE.Vector3) {
    let q = new THREE.Quaternion();
    q.setFromAxisAngle(axis, angle);
    rotateElementsByQuaternion(elements, q, about);
    if(forceHandler) forceHandler.redraw();
}


function _applyQuaternion(arr,xp,yp,zp, q ) {

    const x = arr[xp], y = arr[yp], z = arr[zp];
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w;

    // calculate quat * vector

    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = - qx * x - qy * y - qz * z;

    // calculate result * inverse quat

    arr[xp] = ix * qw + iw * - qx + iy * - qz - iz * - qy;
    arr[yp] = iy * qw + iw * - qy + iz * - qx - ix * - qz;
    arr[zp] = iz * qw + iw * - qz + ix * - qy - iy * - qx;

    //return this;

}
function _applyV3(arr,xp,yp,zp, v){
    arr[xp]+=v.x;
    arr[yp]+=v.y;
    arr[zp]+=v.z;
}

function rotateElementsByQuaternion(elements: Set<BasicElement>, q: THREE.Quaternion, about: THREE.Vector3, updateScene: Boolean=true) {
    // For some reason, we have to rotate the orientations
    // around an axis with inverted y-value...
    let q2 = q.clone();
    q2.y *= -1;
    console.time("rot");
    elements.forEach((e) => {
        let sys = e.getSystem();
        let sid = e.sid;
        if (e.dummySys !== null) {
            sys = e.dummySys;
        }

        const xp = e.sid*3;
        const yp = e.sid*3+1;
        const zp = e.sid*3+2;
        //the rotation center needs to be (0,0,0)
        let nabout = about.clone().negate();
        _applyV3(sys.cmOffsets,xp,yp,zp,nabout);
        _applyV3(sys.bbOffsets,xp,yp,zp,nabout);
        _applyV3(sys.nsOffsets,xp,yp,zp,nabout);
        _applyV3(sys.conOffsets,xp,yp,zp,nabout);
        _applyV3(sys.bbconOffsets,xp,yp,zp,nabout);

        
        //apply the rotation
        _applyQuaternion(sys.cmOffsets,xp,yp,zp,q);
        _applyQuaternion(sys.bbOffsets,xp,yp,zp,q);
        _applyQuaternion(sys.nsOffsets,xp,yp,zp,q);
        _applyQuaternion(sys.conOffsets,xp,yp,zp,q);
        _applyQuaternion(sys.bbconOffsets,xp,yp,zp,q);
 

        //get current rotations and convert to THREE coordinates
        let nsRotationV = e.getInstanceParameter4("nsRotation");
        let nsRotation =  glsl2three(nsRotationV);
        let conRotationV = e.getInstanceParameter4("conRotation");
        let conRotation = glsl2three(conRotationV);
        let bbconRotationV = e.getInstanceParameter4("bbconRotation");
        let bbconRotation = glsl2three(bbconRotationV);

        //apply individual object rotation
        nsRotation.multiply(q2);
        conRotation.multiply(q2);
        bbconRotation.multiply(q2);

        //move the object back to its original position
        _applyV3(sys.cmOffsets,xp,yp,zp,about);
        _applyV3(sys.bbOffsets,xp,yp,zp,about);
        _applyV3(sys.nsOffsets,xp,yp,zp,about);
        _applyV3(sys.conOffsets,xp,yp,zp,about);
        _applyV3(sys.bbconOffsets,xp,yp,zp,about);

        //update the instancing matrices
        sys.fillVec('nsRotation', 4, sid, [nsRotation.w, nsRotation.z, nsRotation.y, nsRotation.x]);
        sys.fillVec('conRotation', 4, sid, [conRotation.w, conRotation.z, conRotation.y, conRotation.x]);
        sys.fillVec('bbconRotation', 4, sid, [bbconRotation.w, bbconRotation.z, bbconRotation.y, bbconRotation.x]);
    });
    

    if (updateScene){
        // Update backbone connections for bases with neigbours outside the selection set
        elements.forEach((base) => {
            if (base.n3 !== null && base.n3 !== undefined && !elements.has(base.n3)) {
                calcsp(base); //calculate sp between current and n3
            }
            if (base.n5 !== null && base.n5 !== undefined && !elements.has(base.n5)) {
                calcsp(base.n5); //calculate sp between current and n5
            }
        });

        for (let i = 0; i < systems.length; i++){
            systems[i].callUpdates(['instanceOffset', 'instanceRotation'])
        }
        for (let i = 0; i < tmpSystems.length; i++){
            tmpSystems[i].callUpdates(['instanceOffset', 'instanceRotation'])
        }
        for ( let i = 0; i< networks.length; i++){
            let check = [...elements].filter(e => {if(networks[i].particles.indexOf(e) > -1) {return true;}})
            if(check.length != 0){
                networks[i].updatePositions();
                networks[i].updateRotations(q2);
            }
        }
        //render();
    }
    console.timeEnd("rot");
}

//adjust the backbone after the move. Copied from DragControls
function calcsp(currentNuc) {
    
    let sys = currentNuc.getSystem();
    if (currentNuc.dummySys !== null) {
        sys = currentNuc.dummySys
    }
    let temp: THREE.Vector3
    try {
        temp = currentNuc.n3.getInstanceParameter3("bbOffsets");
    } catch (error) {
        notify("Can't calculate backbone connection for particle " + currentNuc.id + " because there is no upstream connection");
        return
    }
    
    let xbbLast = temp.x,
        ybbLast = temp.y,
        zbbLast = temp.z;
    temp = currentNuc.getInstanceParameter3("bbOffsets"); //get currentNuc's backbone world position
    let xbb = temp.x;
    let ybb = temp.y;
    let zbb = temp.z;

    //calculate sp location, length and orientation
    let xsp = (xbb + xbbLast) / 2,
        ysp = (ybb + ybbLast) / 2,
        zsp = (zbb + zbbLast) / 2;
    let spLen = Math.sqrt(Math.pow(xbb - xbbLast, 2) + Math.pow(ybb - ybbLast, 2) + Math.pow(zbb - zbbLast, 2));
    let spRotation = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), new THREE.Vector3(xsp - xbb, ysp - ybb, zsp - zbb).normalize());

    currentNuc.setInstanceParameter('bbconOffsets', [xsp, ysp, zsp]);
    currentNuc.setInstanceParameter('bbconRotation', [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
    //introduce distance based cutoff of the backbone connectors
    if (spLen>=box.x*.9 ||spLen>=box.y*.9 ||spLen>=box.z*.9 || currentNuc.isGS() ){
        currentNuc.setInstanceParameter('bbconScales', [0, 0, 0]);
    }else{
        currentNuc.setInstanceParameter('bbconScales', [1, spLen, 1]);
    }
    sys.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
    sys.bbconnector.geometry["attributes"].instanceRotation.needsUpdate = true;
    sys.bbconnector.geometry["attributes"].instanceScale.needsUpdate = true;
    
}

function translateElements(elements: Set<BasicElement>, v: THREE.Vector3) {
    console.time("tran");
    let affected_elements = new Array<BasicElement>();
    let affected_systems = new Set<System>();
    elements.forEach((e)=>{
        let sys = e.getSystem();
        if (e.dummySys !== null) {
            sys = e.dummySys;
        }
        const xp = e.sid*3;
        const yp = e.sid*3+1;
        const zp = e.sid*3+2;

        _applyV3(sys.cmOffsets,xp,yp,zp,v);
        _applyV3(sys.bbOffsets,xp,yp,zp,v);
        _applyV3(sys.nsOffsets,xp,yp,zp,v);
        _applyV3(sys.conOffsets,xp,yp,zp,v);
        _applyV3(sys.bbconOffsets,xp,yp,zp,v);

        if (e.n3 !== null && e.n3 !== undefined) {
            if(e.n3.getSystem()!==sys) {
                affected_elements.push(e);
                affected_systems.add(sys);
            } //calculate sp between current and n3
        }
        if (e.n5 !== null && e.n5 !== undefined ) {
            //calculate sp between current and n5
            if(e.n5.getSystem()!==sys){
                affected_elements.push(e.n5);
                affected_systems.add(e.n5.getSystem());
            }
        }
    });
    // Update backbone connections (is there a more clever way to do this than
    // to loop through all? We only need to update bases with neigbours
    // outside the selection set)
    affected_elements.forEach(e=>{
        calcsp(e); 
    }); //better way, but there's still more room at the bottom

    affected_systems.forEach((sys) => {
        sys.callUpdates(['instanceOffset'])
    });
    for (let i = 0; i < tmpSystems.length; i++){
        tmpSystems[i].callUpdates(['instanceOffset'])
    }
    for ( let i = 0; i< networks.length; i++){
        let check = [...elements].filter(e => {if(networks[i].particles.indexOf(e) > -1) {return true;}})
        if(check.length != 0) {
            networks[i].updatePositions();
        }
    }
    if(forceHandler) forceHandler.redraw();
   
    //render();
    console.timeEnd("tran");
}

//dragControls.activate();
//dragControls.enabled = true;