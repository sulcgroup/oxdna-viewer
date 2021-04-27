/// <reference path="../typescript_definitions/index.d.ts" />



let loadCrystal = ()=>{
    // register 1st drop event 
    let msg = document.getElementById("crystalDropId");
    msg.addEventListener("drop", (event)=>{
        event.preventDefault();
        const files = event.dataTransfer.files;
        handleCrystalDrop(files);
    }, false);

    msg.addEventListener("dragover", event_plug, false);
    msg.addEventListener("dragenter",event_plug, false);
    msg.addEventListener("dragexit", event_plug, false);

}

let crystal_clusters = [];
const crystal_types = [0, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0];
const MYSCALE = 34./0.5 
        
let handleCrystalDrop = (files)=>{
    const datFileReader = new FileReader(); //read .json
    datFileReader.onload = () => {
        let file_data = datFileReader.result as string;
        
        let lines = file_data.split(/[\n]+/g);
        //box 
        let b_size = parseFloat(lines[1].split(" ")[2]) * MYSCALE;
        box.copy(new THREE.Vector3(
            b_size, b_size, b_size
        ));

        lines = lines.slice(3); //discard header

        // we assume that the first system is the one we want to copy around
        systems[0].select();

        let cms = new THREE.Vector3(0,0,0);
        selectedBases.forEach( base =>{
            cms.add(
                base.getPos()
            );
        });
        cms.divideScalar(selectedBases.size);

        cutWrapper(); // prepare to copy around
        let q=lines.length;
        for(let i=0; i<=q; i++)
            if(lines[i]){
            console.log(`pasting ${i}`);
            pasteWrapper(true);
            selectionToCluster(); // make sure every added origami is its own cluster
            crystal_clusters.push(
                Array.from(selectedBases)
            );
        }
        for(let i=0; i<crystal_clusters.length;i++)
            if(lines[i]){
            console.log(`setting ${i}`);
            let line = lines[i].split(" ");
                let ppos = new THREE.Vector3(
                    parseFloat(line[0]),
                    parseFloat(line[1]),
                    parseFloat(line[2]),
                );
                let pa1 = new THREE.Vector3(
                    parseFloat(line[3]),
                    parseFloat(line[4]),
                    parseFloat(line[5]),
                );
                let pa3 = new THREE.Vector3(
                    parseFloat(line[6]),
                    parseFloat(line[7]),
                    parseFloat(line[8]),
                );
                let pa2 = new THREE.Vector3().copy(pa1);
                pa2.cross(pa3);
                ppos.multiplyScalar(MYSCALE);

                align_to_patch_particle(crystal_clusters[i], pa1,pa2,pa3);

                for (let i = 0; i < tmpSystems.length; i++){
                    tmpSystems[i].callUpdates([
                        'instanceOffset',"instanceScale", 
                        "instanceColor", "instanceRotation", 
                        "instanceVisibility"]);
                }

                translateElements(crystal_clusters[i], ppos);      
        }
        clearSelection();

        for (let i = 0; i < tmpSystems.length; i++){
            tmpSystems[i].callUpdates([
                'instanceOffset',"instanceScale", 
                "instanceColor", "instanceRotation", 
                "instanceVisibility"]);
        }
        centerAndPBCBtnClick();  
        step2(); 
        render();
    }

    datFileReader.readAsText(files[0]);
}

const crystal_bindings = [
    [0,  2 ,   1,   1], [1 ,  4 ,  2,    5], [2 ,  2 ,  3,  1],   [0 ,  5 ,  3,  4], [0 ,  1 ,  4,  5], 
    [1 ,  2 ,  4,   3], [4 ,  2 ,  5,    3], [5 ,  0 ,  6,  3],   [3 ,  5 ,  6,  1], [0 ,  4 ,  6,  0], 
    [0 ,  0 ,  7,   4], [1 ,  0 ,  7,    3], [4 ,  4 ,  7,  5],   [7 ,  1 ,  8,  5], [8 ,  2 ,  9,  3], 
    [6 ,  2 ,  9,   1], [3 ,  3 ,  9,    2], [0 ,  3 ,  9,  0],   [7 ,  0 , 10,  4], [5 ,  1 , 10,  2], 
    [8 ,  4 , 10,   5], [6 ,  4 , 10,    0], [2 ,  1 ,  11, 5],   [3 ,  2 ,  11, 3], [7 ,  2 ,11,  1], 
    [10 ,  3 ,11,   0], [8 ,  3 , 11,    2], [5 ,  2 ,  12, 3],   [10 ,  1 ,12,  5], [6 ,  5 ,12,  4], 
    [1 ,  3 ,  12,  2], [2 ,  3 , 12,    0], [8 ,  0 ,  13, 3],   [1 ,  5 , 13,  1], [12 ,  1,13,  2],
    [2 ,  4 ,  13,  0], [9 ,  4 ,  13,   5], [2 ,  0 ,  14, 4],   [3 ,  0 ,  14, 3], [11 ,4 ,14, 5],
    [4 ,  1 ,  14,  2], [5 ,  5 ,  14,   1], [4 ,  0 ,  15, 3],   [14 ,  0 , 15, 4], [8 ,1 ,15,  2], 
    [5 ,  4 ,  15,  5], [13 ,  4 ,  15,  0], [9 ,  5 ,  15, 1]];
//create traps
let step2 = ()=>{
    clearSelection();
    centerAndPBCBtnClick();   // adjust PBC

    crystal_bindings.forEach( connection => {
        let from_id = connection[0];
        let from_patch = connection[1];
        let to_id = connection[2];
        let to_patch = connection[3];
        console.log(from_id, from_patch, to_id, to_patch);

        let middle = getPatchPosition(crystal_clusters[from_id],from_patch);
        middle.add(
            getPatchPosition(crystal_clusters[to_id],to_patch)
        );
        middle.divideScalar(2);
        const geometry = new THREE.SphereGeometry( 5, 32, 32 );
        const material = new THREE.MeshBasicMaterial( {color: 0xffff00} );
        const sphere = new THREE.Mesh( geometry, material );
        sphere.position.copy(middle);
        scene.add( sphere );    
        

        //api.selectElements([
        //    getPatchPosition(crystal_clusters[from_id],from_patch),
        //    getPatchPosition(crystal_clusters[to_id],to_patch),
        //],true);
    });
    //makeTrapsFromSelection(); 
}


const PBC_distance= (u:THREE.Vector3, v:THREE.Vector3, L:number)=>{
    let delta = new THREE.Vector3().copy(v);
    delta.sub(u);
    let dL = new THREE.Vector3();
    dL.copy(delta).divideScalar(L);
    dL.set(
        Math.round(dL.x),
        Math.round(dL.y),
        Math.round(dL.z)
    );
    dL.multiplyScalar(L);
    return delta.sub(dL);
}

const rotM = (caxis: THREE.Vector3, angle:number) =>{
    let axis = new THREE.Vector3().copy(caxis);
    axis.normalize();
    let ct = Math.cos(angle);
    let st = Math.sin(angle);
    let olc = 1 - ct;
    let x = axis.x;
    let y = axis.y;
    let z = axis.z;
    const M = new THREE.Matrix3();


    M.fromArray([olc*x*x+ct,   olc*x*y-st*z, olc*x*z+st*y,
                 olc*x*y+st*z, olc*y*y+ct,   olc*y*z-st*x,
                 olc*x*z-st*y, olc*y*z+st*x, olc*z*z+ct]
    );
    M.transpose();
    return M;
};


const getPatchPosition = (cluster, position)=>{
    // we assume PBC is always on 
    let mean = new THREE.Vector3(0,0,0); 
    const patch_description = [
        [[10799,10819]], [[9733,9754]], [[8703,8724]], 
        [[12448,12469]], [[12512,12532]], [[12576,12596]]
    ];
    patch_description[position][0].forEach(
        idx=> mean.add(cluster[idx].getPos())
    );
    return mean.divideScalar(patch_description[position][0].length);
}


const find_z = (cluster:BasicElement[])=>{
    let res = getPatchPosition(cluster, 0).add(getPatchPosition(cluster,1));
    res.normalize();
    return res;
}
const find_yz = (cluster:BasicElement[])=>{
    let z = find_z(cluster);
    let y = getPatchPosition(cluster, 0).sub(getPatchPosition(cluster,1));
    y.normalize();
    let dyz = new THREE.Vector3();
    dyz.copy(z);
    dyz.multiplyScalar(y.dot(z));
    y.sub(dyz);
    y.normalize();
    return [y,z];
}
const find_xyz = (cluster:BasicElement[])=>{
    const [y, z] = find_yz(cluster);
    let x = new THREE.Vector3().copy(y);
    x.cross(z);
    x.normalize();
    return [x,y,z];
}

const rotate = (cluster:Nucleotide[], R:THREE.Matrix3)=>{
    const cms = new THREE.Vector3(0,0,0);
    let origin = new THREE.Vector3().copy(cms);

    cluster.forEach(base =>{
        let move =  new THREE.Vector3().copy(origin);
        move.add(
            base.getPos().sub(cms).applyMatrix3(R)
        );
        base._a1.applyMatrix3(R);
        base._a3.applyMatrix3(R);
        base.calcPositions(move, base._a1, base._a3);
        
    });
}

const align_to_patch_particle = (cluster:Nucleotide[], a1,a2,a3)=>{
    let [sx,sy,sz] = find_xyz(cluster);
    let angle = Math.acos(
        sx.dot(a1)
    );
    if (Math.abs(angle) > 0.0001){
        let raxis =new THREE.Vector3().copy(sx).cross(a1);
        let R = rotM(raxis,angle);
        rotate(cluster,R)
    }

    [sx,sy,sz] = find_xyz(cluster);
    angle = Math.acos(sz.dot(a3));
    if (Math.abs(angle) > 0.0001){
        let raxis =new THREE.Vector3().copy(sz).cross(a3);
        let R = rotM(raxis,angle);
        rotate(cluster,R)
    }

    //[sx,sy,sz] = find_xyz(cluster);
    //angle = Math.acos(sz.dot(a2));
    //if (Math.abs(angle) > 0.0001){
    //    let raxis =new THREE.Vector3().copy(sz).cross(a2);
    //    let R = rotM(raxis,angle);
    //    rotate(cluster,R)
    //} // it seems there is a bug in the original script here...
}
