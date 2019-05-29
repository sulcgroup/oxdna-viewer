//let listBases: string = ""; //list of bases to download in .txt file
let listBases = []; //list of bases to download in .txt file
//let selList:number[] = [];
let basesInfo = ""; //list of bases' info - location, strand and system ids, etc. - to download in .txt file
// magic ... 
let mouse3D;
let raycaster = new THREE.Raycaster();
;
let intersects;
//let gSelectedBases = [];
document.addEventListener('mousedown', event => {
    if (getActionModes().includes("Select")) {
        // magic ... 
        mouse3D = new THREE.Vector3((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1, //get mouse position
        0.5);
        // cast a ray from mose to viewpoint of camera 
        raycaster.setFromCamera(mouse3D, camera);
        // collect all objects that are in the way
        intersects = raycaster.intersectObjects(backbones);
        // make note of what's been clicked
        let nucleotideID;
        var nucleotide;
        let sys;
        let sysID, strandID;
        let scope_mode = scopeMode;
        if (intersects.length > 0) { //if something has been clicked / is in the intersects array / intersects array's length is above 0
            // hence we click only on nucleotides 
            // this section retrives info about the clicked object 
            // !!! this may change in the future 
            nucleotideID = parseInt(intersects[0].object.parent.name); //get selected nucleotide's global id
            nucleotide = elements[nucleotideID];
            sys = nucleotide.parent.parent;
            switch (scope_mode) {
                case "System":
                    let strand_count = sys.strands.length;
                    for (let i = 0; i < strand_count; i++) { //for every strand in the System
                        let strand = sys.strands[i];
                        let nuc_count = strand.elements.length;
                        for (let j = 0; j < nuc_count; j++) // for every nucleotide on the Strand in the System
                            toggle(strand.elements[j]);
                    }
                    break;
                case "Strand":
                    let strand_length = nucleotide.parent.elements.length;
                    for (let i = 0; i < strand_length; i++) //for every nucleotide in world
                        toggle(nucleotide.parent.elements[i]);
                    break;
                case "Nuc":
                    toggle(nucleotide); //toggle selected nucleotide
                    break;
            }
            render(); //update scene;
            listBases = [];
            let baseInfoStrands = {};
            //sort selection info into respective containers 
            selected_bases.forEach((base) => {
                //store global ids for BaseList view 
                listBases.push(base.global_id);
                //assign each of the selected bases to a strand 
                let strand_id = base.parent.strand_id;
                if (strand_id in baseInfoStrands)
                    baseInfoStrands[strand_id].push(base);
                else
                    baseInfoStrands[strand_id] = [base];
            });
            //Display every selected nucleotide id (top txt box)
            makeTextArea(listBases.join(","), "BaseList");
            //Brake down info (low txt box)
            let baseInfoLines = [];
            for (let strand_id in baseInfoStrands) {
                let s_bases = baseInfoStrands[strand_id];
                //make a fancy header for each strand
                let header = ["Str#:", strand_id, "Sys#:", s_bases[0].parent.parent.system_id];
                baseInfoLines.push("----------------------");
                baseInfoLines.push(header.join(" "));
                baseInfoLines.push("----------------------");
                //fish out all the required base info 
                //one could also sort it if neaded ...
                for (let i = 0; i < s_bases.length; i++) {
                    baseInfoLines.push(["gID:", s_bases[i].global_id, "|", "lID:", s_bases[i].local_id].join(" "));
                }
            }
            makeTextArea(baseInfoLines.join("\n"), "BaseInfo"); //insert basesInfo into "BaseInfo" text area
        }
    }
});
function toggle(nucleotide) {
    // highlight/remove highlight the bases we've clicked 
    let selected = false;
    let nucleotideID = nucleotide.global_id;
    let sysID = nucleotide.parent.parent.system_id;
    let back_Mesh = nucleotide.visual_object.children[BACKBONE]; //get clicked nucleotide's Meshes
    let nuc_Mesh = nucleotide.visual_object.children[NUCLEOSIDE];
    let con_Mesh = nucleotide.visual_object.children[BB_NS_CON];
    let sp_Mesh = nucleotide.visual_object.children[SP_CON];
    if (selected_bases.has(nucleotide)) { //if clicked nucleotide is already selected
        // figure out what that base was before you painted it black and revert it
        //recalculate Mesh's proper coloring and set Mesh material on scene to proper material
        if (back_Mesh instanceof THREE.Mesh) { //necessary for proper typing
            if (back_Mesh.material instanceof THREE.MeshLambertMaterial) {
                back_Mesh.material = systems[sysID].strand_to_material(nucleotide.parent.strand_id);
            }
        }
        if (nuc_Mesh instanceof THREE.Mesh) {
            if (nuc_Mesh.material instanceof THREE.MeshLambertMaterial) {
                nuc_Mesh.material = systems[sysID].elem_to_material(nucleotide.type);
            }
        }
        if (con_Mesh instanceof THREE.Mesh) {
            if (con_Mesh.material instanceof THREE.MeshLambertMaterial) {
                con_Mesh.material = systems[sysID].strand_to_material(nucleotide.parent.strand_id);
            }
        }
        if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
            if (sp_Mesh.material instanceof THREE.MeshLambertMaterial) {
                sp_Mesh.material = systems[sysID].strand_to_material(nucleotide.parent.strand_id);
            }
        }
        selected_bases.delete(nucleotide); //"unselect" nucletide by setting value in selected_bases array at nucleotideID to 0
    }
    else {
        //set all materials to selection_material color - currently aqua
        if (back_Mesh instanceof THREE.Mesh) {
            if (back_Mesh.material instanceof THREE.MeshLambertMaterial)
                back_Mesh.material = selection_material;
        }
        if (nuc_Mesh instanceof THREE.Mesh) {
            if (nuc_Mesh.material instanceof THREE.MeshLambertMaterial)
                nuc_Mesh.material = selection_material;
        }
        if (con_Mesh instanceof THREE.Mesh) {
            if (con_Mesh.material instanceof THREE.MeshLambertMaterial)
                con_Mesh.material = selection_material;
        }
        if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
            if (sp_Mesh.material instanceof THREE.MeshLambertMaterial)
                sp_Mesh.material = selection_material;
        }
        //selList.push(nucleotideID);
        selected_bases.add(nucleotide); //"select" nucletide by setting value in selected_bases array at nucleotideID to 1
    }
}
function makeTextArea(bases, id) {
    let textArea = document.getElementById(id);
    if (textArea !== null) { //as long as text area was retrieved by its ID, id
        textArea.innerHTML = bases; //set innerHTML / content to bases
    }
}
function writeMutTrapText(base1, base2) {
    return "{\n" + "type = mutual_trap\n" +
        "particle = " + base1 + "\n" +
        "ref_particle = " + base2 + "\n" +
        "stiff = 1.\n" +
        "r0 = 1.2" + "\n}\n\n";
}
function makeMutualTrapFile() {
    let x, count = 0;
    let mutTrapText = "";
    for (x = 0; x < listBases.length; x = x + 2) { //for every selected nucleotide in listBases string
        if (listBases[x + 1] !== undefined) { //if there is another nucleotide in the pair
            mutTrapText = mutTrapText + writeMutTrapText(listBases[x], listBases[x + 1]) + writeMutTrapText(listBases[x + 1], listBases[x]); //create mutual trap data for the 2 nucleotides in a pair - selected simultaneously
        }
        else { //if there is no 2nd nucleotide in the pair
            alert("The last selected base does not have a pair and thus cannot be included in the Mutual Trap File."); //give error message
        }
    }
    makeTextFile("mutTrapFile", mutTrapText); //after addding all mutual trap data, make mutual trap file
}
function makeSelectedBasesFile() {
    makeTextFile("baseListFile", listBases.join(", "));
}
let textFile;
function makeTextFile(filename, text) {
    let blob = new Blob([text], { type: 'text' });
    var elem = window.document.createElement('a');
    elem.href = window.URL.createObjectURL(blob);
    elem.download = filename;
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
}
;
function openTab(evt, tabName) {
    let i;
    let tabcontent;
    let tablinks;
    tabcontent = document.getElementsByClassName("tabcontent"); //get tab's content
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    let tab = document.getElementById(tabName);
    if (tab !== null) {
        tab.style.display = "block";
    }
    evt.currentTarget.className += " active";
}
