//let math = require('mathjs');
class Selected_Base {
    constructor(idx, b, n, c, sp) {
        this.id = idx;
        this.b = b;
        this.n = n;
        this.c = c;
        this.sp = sp;
    }
}
let selected_bases = [];
document.addEventListener('mousedown', event => {
    getMode();
    if (mode == "baseSelect") {
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
        let nucleosides = [];
        for (let i = 0; i < nucleotides.length; i++) {
            nucleosides.push(nucleotides[i].visual_object.children[1]);
        }
        let con = [];
        for (let i = 0; i < nucleotides.length; i++) {
            con.push(nucleotides[i].visual_object.children[2]);
        }
        let sp = [];
        for (let i = 0; i < nucleotides.length; i++) {
            sp.push(nucleotides[i].visual_object.children[3]);
        }
        let intersects = raycaster.intersectObjects(backbones);
        // make note of what's been clicked
        let nucleotideID = -1;
        if (intersects.length > 0) {
            for (let i = 0; i < nucleotides.length; i++) {
                if (nucleotides[i].visual_object.children[0] === intersects[0].object)
                    nucleotideID = i;
            }
            // highlight/remove highlight the bases we've clicked 
            let selected = false;
            let index = 0;
            for (let i = 0; i < selected_bases.length; i++) {
                if (selected_bases[i].id == nucleotideID) {
                    selected = true;
                    index = i;
                }
            }
            let back_Mesh = backbones[nucleotideID];
            let nuc_Mesh = nucleosides[nucleotideID];
            let con_Mesh = con[nucleotideID];
            let sp_Mesh = sp[nucleotideID];
            if (selected) {
                // figure out what that base was before you painted it black and revert it
                let baseArr = selected_bases.slice(0, index + 1);
                let baseArr2 = selected_bases.slice(index + 1, selected_bases.length);
                let prevBack_Mesh = baseArr[index].b;
                if (back_Mesh instanceof THREE.Mesh) {
                    back_Mesh.material = prevBack_Mesh.material;
                }
                let prevNuc_Mesh = baseArr[index].n;
                if (nuc_Mesh instanceof THREE.Mesh) {
                    nuc_Mesh.material = prevNuc_Mesh.material;
                }
                let prevCon_Mesh = baseArr[index].c;
                if (con_Mesh instanceof THREE.Mesh) {
                    con_Mesh.material = prevCon_Mesh.material;
                }
                let prevSP_Mesh = baseArr[index].sp;
                if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
                    sp_Mesh.material = prevSP_Mesh.material;
                }
                baseArr.pop();
                selected_bases = baseArr.concat(baseArr2);
                render();
            }
            else {
                if (back_Mesh instanceof THREE.Mesh && nuc_Mesh instanceof THREE.Mesh && con_Mesh instanceof THREE.Mesh) {
                    let back_MeshCopy = back_Mesh.clone();
                    let nuc_MeshCopy = nuc_Mesh.clone();
                    let con_MeshCopy = con_Mesh.clone();
                    let sp_MeshCopy;
                    if (sp_Mesh instanceof THREE.Mesh) {
                        sp_MeshCopy = sp_Mesh.clone();
                        selected_bases.push(new Selected_Base(nucleotideID, back_MeshCopy, nuc_MeshCopy, con_MeshCopy, sp_MeshCopy));
                    }
                    else if (sp_Mesh === undefined) {
                        selected_bases.push(new Selected_Base(nucleotideID, back_MeshCopy, nuc_MeshCopy, con_MeshCopy, sp_Mesh));
                    }
                }
                if (back_Mesh instanceof THREE.Mesh) {
                    back_Mesh.material = selection_material;
                }
                if (nuc_Mesh instanceof THREE.Mesh) {
                    nuc_Mesh.material = selection_material;
                }
                if (con_Mesh instanceof THREE.Mesh) {
                    con_Mesh.material = selection_material;
                }
                if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
                    sp_Mesh.material = selection_material;
                }
                // give index using global base coordinates 
                //console.log(nucleotideID); //I can't remove outputs from the console log...maybe open a popup instead?
                render();
            }
            let listBases = "";
            for (let x = 0; x < selected_bases.length; x++) {
                listBases = listBases + selected_bases[x].id + "\n";
                //console.log(listBases);
            }
            makeTextArea(listBases);
        }
    }
});
function makeTextArea(bases) {
    let textArea = document.getElementById("BASES");
    if (textArea !== null) {
        textArea.innerHTML = "Bases currently selected:\n" + bases;
    }
}
function makeMutualTrapFile() {
    let x, count = 0;
    let base1 = -1, base2 = -1;
    for (x = 0; x < selected_bases.length; x++) {
        if (selected_bases[x] !== undefined) {
            count++;
            if (count == 1)
                base1 = x;
            else if (count == 2)
                base2 = x;
        }
    }
    if (count != 2) {
        alert("Please select only 2 bases to create a Mutual Trap File.");
    }
    else {
        let mutTrapText = writeMutTrapText(base1, base2) + writeMutTrapText(base2, base1);
        makeTextFile("mutTrapFile", mutTrapText);
    }
}
function writeMutTrapText(base1, base2) {
    return "{\n" + "type = mutual_trap\n" +
        "particle = " + base1 + "\n" +
        "ref_particle = " + base2 + "\n" +
        "stiff = 1.\n" +
        "r0 = 1.2" + "\n}\n\n";
}
let textFile;
function makeTextFile(filename, text) {
    /*let data = new Blob([text], {
        type: 'text/plain'
    });

    // If we are replacing a previously generated file we need to
    // manually revoke the object URL to avoid memory leaks.
    if (textFile !== null) {
        window.URL.revokeObjectURL(textFile);
    }

    textFile = window.URL.createObjectURL(data);

    // returns a URL you can use as a href
    return textFile;*/
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
