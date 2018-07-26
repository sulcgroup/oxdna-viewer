let listBases = "";
let basesInfo = "";
document.addEventListener('mousedown', event => {
    getActionMode();
    getScopeMode();
    if (actionMode.includes("Select")) {
        // magic ... 
        let mouse3D = new THREE.Vector3((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1, 0.5);
        let raycaster = new THREE.Raycaster();
        // cast a ray from mose to viewpoint of camera 
        raycaster.setFromCamera(mouse3D, camera);
        // callect all objects that are in the vay
        let backbones = [];
        for (let i = 0; i < nucleotides.length; i++) {
            backbones.push(nucleotides[i].visual_object.children[0]);
        }
        let intersects = raycaster.intersectObjects(backbones);
        // make note of what's been clicked
        let nucleotideID;
        if (intersects.length > 0) {
            if (scopeMode.includes("System")) {
                let sysID;
                nucleotideID = parseInt(intersects[0].object.parent.name);
                sysID = nucleotides[nucleotideID].my_system;
                for (let i = 0; i < nucleotides.length; i++) {
                    if (nucleotides[i].my_system == sysID) {
                        toggle(i, sysID);
                    }
                }
            }
            else if (scopeMode.includes("Strand")) {
                let strandID;
                nucleotideID = parseInt(intersects[0].object.parent.name);
                strandID = nucleotides[nucleotideID].my_strand;
                for (let i = 0; i < nucleotides.length; i++) {
                    if (nucleotides[i].my_strand == strandID) {
                        let sysID = nucleotides[i].my_system;
                        toggle(i, sysID);
                    }
                }
            }
            else if (scopeMode.includes("Nuc")) {
                nucleotideID = parseInt(intersects[0].object.parent.name);
                let sysID = nucleotides[nucleotideID].my_system;
                toggle(nucleotideID, sysID);
            }
            render();
            listBases = "";
            for (let x = 0; x < selected_bases.length; x++) {
                if (selected_bases[x] == 1)
                    listBases = listBases + x + "\n";
            }
            basesInfo = "";
            let sysPrint = [], strandPrint = [], sys, strand;
            for (let x = 0; x < selected_bases.length; x++) {
                let temp = nucleotides[x];
                sys = temp.my_system;
                strand = temp.my_strand - 1;
                if (sysPrint.indexOf(sys) < 0) {
                    basesInfo += "SYSTEM:\n" +
                        "System ID: " + sys + "\n" +
                        "# of Strands: " + systems[sys].strands.length + "\n" +
                        "# of Nucleotides: " + systems[sys].system_length() + "\n" +
                        "System Position:\nx = " + systems[sys].system_3objects.position.x + "\n" +
                        "y = " + systems[sys].system_3objects.position.y + "\n" +
                        "z = " + systems[sys].system_3objects.position.z + "\n\n";
                    sysPrint.push(sys);
                }
                let nucPrint = strandPrint.indexOf(strand) < 0;
                if (nucPrint) {
                    basesInfo += "STRAND:\n" +
                        "System ID: " + sys + "\n" +
                        "Strand ID: " + strand + "\n" +
                        "# of Nucleotides: " + systems[sys].strands[strand].nucleotides.length + "\n" +
                        "Strand Position:\nx = " + systems[sys].strands[strand].strand_3objects.position.x + "\n" +
                        "y = " + systems[sys].strands[strand].strand_3objects.position.y + "\n" +
                        "z = " + systems[sys].strands[strand].strand_3objects.position.z + "\n\n";
                    strandPrint.push(strand);
                }
                if (nucPrint || scopeMode.includes("Nuc")) {
                    basesInfo += "NUCLEOTIDE:\n" +
                        "Strand ID: " + strand + "\n" +
                        "Global ID: " + temp.global_id + "\n" +
                        "Base ID: " + temp.type + "\n" +
                        "Nucleotide Position:\nx = " + nucleotides[temp.global_id].visual_object.children[3].position.x + "\n" +
                        "y = " + nucleotides[temp.global_id].visual_object.children[3].position.y + "\n" +
                        "z = " + nucleotides[temp.global_id].visual_object.children[3].position.z + "\n";
                }
            }
            makeTextArea(listBases, "BaseList");
            makeTextArea(basesInfo, "BaseInfo");
        }
    }
});
function toggle(nucleotideID, sysID) {
    // highlight/remove highlight the bases we've clicked 
    let selected = false;
    let index = 0;
    if (selected_bases[nucleotideID] == 1) {
        selected = true;
    }
    let back_Mesh = nucleotides[nucleotideID].visual_object.children[0];
    let nuc_Mesh = nucleotides[nucleotideID].visual_object.children[1];
    let con_Mesh = nucleotides[nucleotideID].visual_object.children[2];
    let sp_Mesh = nucleotides[nucleotideID].visual_object.children[4];
    if (selected) {
        // figure out what that base was before you painted it black and revert it
        if (back_Mesh instanceof THREE.Mesh) {
            if (back_Mesh.material instanceof THREE.MeshLambertMaterial) {
                back_Mesh.material = (systems[sysID].strand_to_material[nucleotides[nucleotideID].global_id]);
            }
        }
        if (nuc_Mesh instanceof THREE.Mesh) {
            if (nuc_Mesh.material instanceof THREE.MeshLambertMaterial || nuc_Mesh.material instanceof THREE.MeshLambertMaterial) {
                nuc_Mesh.material = (systems[sysID].base_to_material[nucleotides[nucleotideID].global_id]);
            }
        }
        if (con_Mesh instanceof THREE.Mesh) {
            if (con_Mesh.material instanceof THREE.MeshLambertMaterial) {
                con_Mesh.material = (systems[sysID].strand_to_material[nucleotides[nucleotideID].global_id]);
            }
        }
        if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
            if (sp_Mesh.material instanceof THREE.MeshLambertMaterial) {
                sp_Mesh.material = (systems[sysID].strand_to_material[nucleotides[nucleotideID].global_id]);
            }
        }
        selected_bases[nucleotideID] = 0;
    }
    else {
        selected_bases[nucleotideID] = 1;
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
    }
}
function makeTextArea(bases, id) {
    let textArea = document.getElementById(id);
    if (textArea !== null) {
        textArea.innerHTML = "Bases currently selected:\n" + bases;
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
    for (x = 0; x < selected_bases.length; x = x + 2) {
        if (selected_bases[x + 1] !== undefined) {
            mutTrapText = mutTrapText + writeMutTrapText(x, x + 1) + writeMutTrapText(x + 1, x);
        }
        else {
            alert("The last selected base does not have a pair and thus cannot be included in the Mutual Trap File.");
        }
    }
    makeTextFile("mutTrapFile", mutTrapText);
}
function makeSelectedBasesFile() {
    makeTextFile("baseListFile", listBases);
}
let textFile;
function makeTextFile(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}
;
function openTab(evt, tabName) {
    let i;
    let tabcontent;
    let tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
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
