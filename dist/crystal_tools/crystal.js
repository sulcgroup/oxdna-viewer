/// <reference path="../typescript_definitions/index.d.ts" />
const interconnectDuplex3p = (patch_sequence = "GGGGGGGGG") => {
    let strands = new Set();
    selectedBases.forEach(b => {
        strands.add(b.strand);
    }); // filter out strands
    let cmss = [];
    strands.forEach(strand => {
        let cms = new THREE.Vector3();
        let l = 0;
        strand.forEach(base => {
            cms.add(base.getPos());
            l += 1;
        });
        cms.divideScalar(l);
        cmss.push(cms);
    }); // find their cms
    let npos = new THREE.Vector3().copy(cmss[0]);
    npos.add(cmss[1]);
    npos.divideScalar(2);
    let duplex_strands = new Set();
    let elems = edit.createStrand(patch_sequence, true);
    let ecms = new THREE.Vector3();
    elems.forEach(e => {
        ecms.add(e.getPos());
        duplex_strands.add(e.strand);
    });
    ecms.divideScalar(elems.length);
    translateElements(new Set(elems), new THREE.Vector3().copy(npos).sub(ecms));
    edit.ligate(// connect first strand
    [...strands][0].end3, [...duplex_strands][0].end5);
    edit.ligate(// connect second strand
    [...strands][1].end3, [...duplex_strands][1].end5);
};
const get_strand_ends = () => {
    let bases = Array.from(selectedBases);
    let s = new Set();
    bases.forEach(b => s.add(b.strand));
    s.forEach(ss => console.log(ss.end5.sid));
};
const patch_description5p = [
    //red
    [[11858 - 21, 11858],
        [11232 - 21, 11232],
        [7866 - 21, 7866],
        [12968 - 21, 12968]],
    //pink
    [[12904 - 21, 12904],
        [9510 - 21, 9510],
        [6628 - 21, 6628],
        [8962 - 21, 8962]],
    //blue
    [[9446 - 21, 9446],
        [11794 - 21, 11794],
        [11168 - 21, 11168],
        [8414 - 21, 8414]],
    //green
    [[6144 - 21, 6144],
        [10058 - 21, 10058],
        [10606 - 21, 10606],
        [6692 - 21, 6692]],
    //yellow
    [[8350 - 21, 8350],
        [8898 - 21, 8898],
        [10542 - 21, 10542],
        [7802 - 21, 7802]],
    //orange
    [[7318 - 21, 7318],
        [12420 - 21, 12420],
        [9994 - 21, 9994],
        [7254 - 21, 7254]]
];
const patch_description = [
    [[11858, 7866, 11232, 12968]],
    [[8350, 7802, 10542, 8898]],
    [[7318, 12420, 9994, 7254]],
    [[10606, 6144, 6692, 10058]],
    [[9510, 12904, 8962, 6628]],
    [[8414, 11794, 11168, 9446]]
];
const extend_5p_patches = (extend_patch_by = "TTTTTTTTTTTTTTTTTTTTT") => {
    const patch_description = [
        [[11858, 7866, 11232, 12968]],
        [[8350, 7802, 10542, 8898]],
        [[7318, 12420, 9994, 7254]],
        [[10606, 6144, 6692, 10058]],
        [[9510, 12904, 8962, 6628]],
        [[8414, 11794, 11168, 9446]]
    ];
    patch_description.forEach(patch => {
        const ppatch = patch[0]; // because of our patch definition
        ppatch.forEach(pid => {
            let strand = elements.get(pid).strand;
            // callect the 3p overhang
            let vics = [];
            for (let i = pid; i < pid + 21; i++)
                vics.push(elements.get(i));
            // remove them and extend the 3p
            edit.deleteElements(vics);
            edit.extendStrand(strand.end5, extend_patch_by);
        });
    });
    topologyEdited = true;
};
let loadCrystal = () => {
    // register 1st drop event 
    let msg = document.getElementById("crystalDropId");
    msg.addEventListener("drop", (event) => {
        event.preventDefault();
        const files = event.dataTransfer.files;
        handleCrystalDrop(files);
    }, false);
    msg.addEventListener("dragover", event_plug, false);
    msg.addEventListener("dragenter", event_plug, false);
    msg.addEventListener("dragexit", event_plug, false);
};
let crystal_clusters = [];
const crystal_types = [0, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0];
//29
const MYSCALE = 32. / 0.5;
let handleCrystalDrop = (files) => {
    const datFileReader = new FileReader(); //read .json
    datFileReader.onload = () => {
        let file_data = datFileReader.result;
        let lines = file_data.split(/[\n]+/g);
        //box 
        let b_size = parseFloat(lines[1].split(" ")[2]) * MYSCALE;
        //let b_size = 175;
        box.copy(new THREE.Vector3(Math.round(b_size), Math.round(b_size), Math.round(b_size)));
        lines = lines.slice(3); //discard header
        // we assume that the first system is the one we want to copy around
        systems[0].select();
        let cms = new THREE.Vector3(0, 0, 0);
        selectedBases.forEach(base => {
            cms.add(base.getPos());
        });
        cms.divideScalar(selectedBases.size);
        cutWrapper(); // prepare to copy around
        let q = lines.length;
        for (let i = 0; i <= q; i++)
            if (lines[i]) {
                console.log(`pasting ${i}`);
                pasteWrapper(true);
                selectionToCluster(); // make sure every added origami is its own cluster
                crystal_clusters.push(Array.from(selectedBases));
            }
        for (let i = 0; i < crystal_clusters.length; i++)
            if (lines[i]) {
                console.log(`setting ${i}`);
                let line = lines[i].split(" ");
                let ppos = new THREE.Vector3(parseFloat(line[0]), parseFloat(line[1]), parseFloat(line[2]));
                let pa1 = new THREE.Vector3(parseFloat(line[3]), parseFloat(line[4]), parseFloat(line[5]));
                let pa3 = new THREE.Vector3(parseFloat(line[6]), parseFloat(line[7]), parseFloat(line[8]));
                let pa2 = new THREE.Vector3().copy(pa1);
                pa2.cross(pa3);
                ppos.multiplyScalar(MYSCALE);
                align_to_patch_particle(crystal_clusters[i], pa1, pa2, pa3);
                for (let i = 0; i < tmpSystems.length; i++) {
                    tmpSystems[i].callUpdates([
                        'instanceOffset', "instanceScale",
                        "instanceColor", "instanceRotation",
                        "instanceVisibility"
                    ]);
                }
                translateElements(crystal_clusters[i], ppos);
            }
        clearSelection();
        for (let i = 0; i < tmpSystems.length; i++) {
            tmpSystems[i].callUpdates([
                'instanceOffset', "instanceScale",
                "instanceColor", "instanceRotation",
                "instanceVisibility"
            ]);
        }
        step2();
        render();
    };
    datFileReader.readAsText(files[0]);
};
const crystal_bindings = [
    [0, 2, 1, 1], [1, 4, 2, 5], [2, 2, 3, 1], [0, 5, 3, 4], [0, 1, 4, 5],
    [1, 2, 4, 3], [4, 2, 5, 3], [5, 0, 6, 3], [3, 5, 6, 1], [0, 4, 6, 0],
    [0, 0, 7, 4], [1, 0, 7, 3], [4, 4, 7, 5], [7, 1, 8, 5], [8, 2, 9, 3],
    [6, 2, 9, 1], [3, 3, 9, 2], [0, 3, 9, 0], [7, 0, 10, 4], [5, 1, 10, 2],
    [8, 4, 10, 5], [6, 4, 10, 0], [2, 1, 11, 5], [3, 2, 11, 3], [7, 2, 11, 1],
    [10, 3, 11, 0], [8, 3, 11, 2], [5, 2, 12, 3], [10, 1, 12, 5], [6, 5, 12, 4],
    [1, 3, 12, 2], [2, 3, 12, 0], [8, 0, 13, 3], [1, 5, 13, 1], [12, 1, 13, 2],
    [2, 4, 13, 0], [9, 4, 13, 5], [2, 0, 14, 4], [3, 0, 14, 3], [11, 4, 14, 5],
    [4, 1, 14, 2], [5, 5, 14, 1], [4, 0, 15, 3], [14, 0, 15, 4], [8, 1, 15, 2],
    [5, 4, 15, 5], [13, 4, 15, 0], [9, 5, 15, 1]
];
//create traps
let step2 = () => {
    clearSelection();
    topologyEdited = true;
    crystal_bindings.forEach(connection => {
        let from_id = connection[0];
        let from_patch = connection[1];
        let to_id = connection[2];
        let to_patch = connection[3];
        console.log(from_id, from_patch, to_id, to_patch);
        let nucleotide = getPatchLast(crystal_clusters[from_id], from_patch);
        let npos = new THREE.Vector3().copy(nucleotide.getPos());
        npos.add(nucleotide.getA1().multiplyScalar(2));
        //let ecms = new THREE.Vector3();
        //middle.add(
        //    getPatchPosition(crystal_clusters[to_id],to_patch)
        //);
        //middle.divideScalar(2);
        //const geometry = new THREE.SphereGeometry( 5, 32, 32 );
        //const material = new THREE.MeshBasicMaterial( {color: 0xffff00} );
        ////const sphere = new THREE.Mesh( geometry, material );
        ////sphere.position.copy(middle);
        ////scene.add( sphere );    
        //
        let strands = new Set();
        let elems = edit.createStrand("GGGGGGGGG", true);
        let ecms = new THREE.Vector3();
        elems.forEach(e => {
            ecms.add(e.getPos());
            strands.add(e.strand);
        });
        ecms.divideScalar(18); // patch 9 but we have 2 strands
        translateElements(new Set(elems), new THREE.Vector3().copy(npos).sub(ecms));
        edit.ligate(crystal_clusters[from_id][patch_description[from_patch][0][0]].strand.end3, [...strands][0].end5);
        edit.ligate(crystal_clusters[to_id][patch_description[to_patch][0][0]].strand.end3, [...strands][1].end5);
    });
    // as the octahedra have no pairing this gives us the patch forces
    makeTrapsFromPairs();
    //view.longCalculation(findBasepairs, view.basepairMessage, ()=>{
    //    console.log("done searching forces");
    //});
    //makeTrapsFromSelection(); 
};
const PBC_distance = (u, v, L) => {
    let delta = new THREE.Vector3().copy(v);
    delta.sub(u);
    let dL = new THREE.Vector3();
    dL.copy(delta).divideScalar(L);
    dL.set(Math.round(dL.x), Math.round(dL.y), Math.round(dL.z));
    dL.multiplyScalar(L);
    return delta.sub(dL);
};
const rotM = (caxis, angle) => {
    let axis = new THREE.Vector3().copy(caxis);
    axis.normalize();
    let ct = Math.cos(angle);
    let st = Math.sin(angle);
    let olc = 1 - ct;
    let x = axis.x;
    let y = axis.y;
    let z = axis.z;
    const M = new THREE.Matrix3();
    M.fromArray([olc * x * x + ct, olc * x * y - st * z, olc * x * z + st * y,
        olc * x * y + st * z, olc * y * y + ct, olc * y * z - st * x,
        olc * x * z - st * y, olc * y * z + st * x, olc * z * z + ct]);
    M.transpose();
    return M;
};
//{
//    "red"    : [11858,7866,11232,12968],
//    "pink"   : [8350,7802,10542,8898],
//    "blue"   : [7318,12420,9994,7254],
//    "green"  : [10606,6144,6692,10058],
//    "yellow" : [9510,12904,8962,6628],
//    "orange" : [8414,11794,11168,9446]
//}
//old attempt
//const patch_description = [
//    [[10799,10819]], [[9733,9754]], [[8703,8724]], 
//    [[12448,12469]], [[12512,12532]], [[12576,12596]]
//];
//const modify = ()=>{
//    
//}
//const patch_description = [11858,7866,11232,12968,8350 ,7802,10542,8898,7318 ,12420,9994,7254,10606,6144,6692,10058,9510 ,12904,8962,6628,8414 ,11794,11168,9446,
//         11858 +21,7866+21,11232+21,12968+21,8350+21 ,7802+21,10542+21,8898+21,7318+21 ,12420+21,9994+21,7254+21,10606+21,6144+21,6692+21,10058+21,9510 +21 ,12904 +21,8962 +21,6628 +21,8414 +21  ,11794 +21 ,11168 +21,9446+21
//];
//const patch_description = [
//    [[11858]],
//    [[8350]],
//    [[7318]],
//    [[10606]],
//    [[9510]],
//    [[8414]]
//  ];
const getPatchPosition = (cluster, position) => {
    // we assume PBC is always on 
    let mean = new THREE.Vector3(0, 0, 0);
    patch_description[position][0].forEach(idx => mean.add(cluster[idx].getPos()));
    return mean.divideScalar(patch_description[position][0].length);
};
const getPatchLast = (cluster, position) => {
    return cluster[patch_description[position][0][0]];
};
const find_z = (cluster) => {
    let res = getPatchPosition(cluster, 0).add(getPatchPosition(cluster, 1));
    res.normalize();
    return res;
};
const find_yz = (cluster) => {
    let z = find_z(cluster);
    let y = getPatchPosition(cluster, 0).sub(getPatchPosition(cluster, 1));
    y.normalize();
    let dyz = new THREE.Vector3();
    dyz.copy(z);
    dyz.multiplyScalar(y.dot(z));
    y.sub(dyz);
    y.normalize();
    return [y, z];
};
const find_xyz = (cluster) => {
    const [y, z] = find_yz(cluster);
    let x = new THREE.Vector3().copy(y);
    x.cross(z);
    x.normalize();
    return [x, y, z];
};
const rotate = (cluster, R) => {
    const cms = new THREE.Vector3(0, 0, 0);
    let origin = new THREE.Vector3().copy(cms);
    cluster.forEach(base => {
        let move = new THREE.Vector3().copy(origin);
        move.add(base.getPos().sub(cms).applyMatrix3(R));
        base._a1.applyMatrix3(R);
        base._a3.applyMatrix3(R);
        base.calcPositions(move, base._a1, base._a3);
    });
};
const align_to_patch_particle = (cluster, a1, a2, a3) => {
    let [sx, sy, sz] = find_xyz(cluster);
    let angle = Math.acos(sx.dot(a1));
    if (Math.abs(angle) > 0.0001) {
        let raxis = new THREE.Vector3().copy(sx).cross(a1);
        let R = rotM(raxis, angle);
        rotate(cluster, R);
    }
    [sx, sy, sz] = find_xyz(cluster);
    angle = Math.acos(sz.dot(a3));
    if (Math.abs(angle) > 0.0001) {
        let raxis = new THREE.Vector3().copy(sz).cross(a3);
        let R = rotM(raxis, angle);
        rotate(cluster, R);
    }
    //[sx,sy,sz] = find_xyz(cluster);
    //angle = Math.acos(sz.dot(a2));
    //if (Math.abs(angle) > 0.0001){
    //    let raxis =new THREE.Vector3().copy(sz).cross(a2);
    //    let R = rotM(raxis,angle);
    //    rotate(cluster,R)
    //} // it seems there is a bug in the original script here...
};
