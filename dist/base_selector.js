let listBases = ""; //list of bases to download in .txt file
let selList = [];
let basesInfo = ""; //list of bases' info - location, strand and system ids, etc. - to download in .txt file
// magic ... 
let mouse3D;
let raycaster = new THREE.Raycaster();
;
let intersects;
document.addEventListener('mousedown', event => {
    // magic ... 
    mouse3D = new THREE.Vector3((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1, 0.5); //get mouse position
    // cast a ray from mose to viewpoint of camera 
    raycaster.setFromCamera(mouse3D, camera);
    // collect all objects that are in the way
    intersects = raycaster.intersectObjects(backbones);
    // make note of what's been clicked
    let nucleotideID;
    if (intersects.length > 0) { //if something has been clicked / is in the intersects array / intersects array's length is above 0
        nucleotideID = parseInt(intersects[0].object.parent.name); //get selected nucleotide's global id
        let sysID = nucleotides[nucleotideID].my_system; //get selected nucleotide's system id
        toggle(nucleotideID, sysID); //toggle selected nucleotide
        render(); //update scene;
        listBases = ""; //reset list of selected bases
        for (let x = 0; x < selected_bases.length; x++) { //for all nucleotides in system/selected_bases array
            if (selected_bases[x] == 1) //if nucleotide is selected
                listBases = listBases + x + "\n"; //add nucleotide's global id to listBases - list of selected bases
        }
        makeTextArea(listBases, "BaseList"); //insert list of bases into "BaseList" text area
    }
});
function toggle(nucleotideID, sysID) {
    // highlight/remove highlight the bases we've clicked 
    let selected = false;
    let index = 0;
    if (selected_bases[nucleotideID] == 1) { //if clicked nucleotide is selected, set selected boolean to true 
        selected = true;
    }
    let back_Mesh = nucleotides[nucleotideID].visual_object.children[0]; //get clicked nucleotide's Meshes
    let nuc_Mesh = nucleotides[nucleotideID].visual_object.children[1];
    let con_Mesh = nucleotides[nucleotideID].visual_object.children[2];
    let sp_Mesh = nucleotides[nucleotideID].visual_object.children[4];
    if (selected) { //if clicked nucleotide is already selected
        // figure out what that base was before you painted it black and revert it
        let nuc = nucleotides[nucleotideID]; //get Nucleotide object
        let locstrandID = (nuc.my_strand - 1) * systems[sysID].strands[nuc.my_strand - 1].nucleotides.length + nuc.local_id; //get nucleotide's id with respect to its strand only
        //recalculate Mesh's proper coloring and set Mesh material on scene to proper material
        if (back_Mesh instanceof THREE.Mesh) { //necessary for proper typing
            if (back_Mesh.material instanceof THREE.MeshLambertMaterial) {
                back_Mesh.material = (systems[sysID].strand_to_material[locstrandID]);
            }
        }
        if (nuc_Mesh instanceof THREE.Mesh) {
            if (nuc_Mesh.material instanceof THREE.MeshLambertMaterial) {
                nuc_Mesh.material = (systems[sysID].base_to_material[locstrandID]);
            }
        }
        if (con_Mesh instanceof THREE.Mesh) {
            if (con_Mesh.material instanceof THREE.MeshLambertMaterial) {
                con_Mesh.material = (systems[sysID].strand_to_material[locstrandID]);
            }
        }
        if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
            if (sp_Mesh.material instanceof THREE.MeshLambertMaterial) {
                sp_Mesh.material = (systems[sysID].strand_to_material[locstrandID]);
            }
        }
        let x = selList.indexOf(nucleotideID);
        let sel1 = selList.slice(0, x + 1);
        let sel2 = selList.slice(x + 1, selList.length);
        sel1.pop();
        selList = sel1.concat(sel2);
        selected_bases[nucleotideID] = 0; //"unselect" nucletide by setting value in selected_bases array at nucleotideID to 0
    }
    else {
        //set all materials to selection_material color - currently aqua
        if (back_Mesh instanceof THREE.Mesh) {
            if (back_Mesh.material instanceof THREE.MeshLambertMaterial) {
                back_Mesh.material = (selection_material);
            }
        }
        if (nuc_Mesh instanceof THREE.Mesh) {
            if (nuc_Mesh.material instanceof THREE.MeshLambertMaterial) {
                nuc_Mesh.material = (selection_material);
            }
        }
        if (con_Mesh instanceof THREE.Mesh) {
            if (con_Mesh.material instanceof THREE.MeshLambertMaterial) {
                con_Mesh.material = (selection_material);
            }
        }
        if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
            if (sp_Mesh.material instanceof THREE.MeshLambertMaterial) {
                sp_Mesh.material = (selection_material);
            }
        }
        selList.push(nucleotideID);
        selected_bases[nucleotideID] = 1; //"select" nucletide by setting value in selected_bases array at nucleotideID to 1
    }
}
function makeTextArea(bases, id) {
    let textArea = document.getElementById(id);
    if (textArea !== null) { //as long as text area was retrieved by its ID, id
        textArea.innerHTML = "Bases currently selected:\n" + bases; //set innerHTML / content to bases
    }
}
