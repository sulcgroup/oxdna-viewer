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
        let id = gpu_picker(event);
        console.log(id);
        //if something was clicked, toggle the coloration of the appropriate things.
        let scope_mode = scopeMode;
        if (id > -1) {
            let nucleotide = elements[id];
            let sys = nucleotide.parent.parent;
            switch (scope_mode) {
                case "System":
                    let strand_count = sys[strands].length;
                    for (let i = 0; i < strand_count; i++) { //for every strand in the System
                        let strand = sys[strands][i];
                        let nuc_count = strand[monomers].length;
                        for (let j = 0; j < nuc_count; j++) // for every nucleotide on the Strand in the System
                            strand[monomers][j].toggle();
                    }
                    break;
                case "Strand":
                    let strand_length = nucleotide.parent[monomers].length;
                    for (let i = 0; i < strand_length; i++) //for every nucleotide in world
                        nucleotide.parent[monomers][i].toggle();
                    break;
                case "Nuc":
                    nucleotide.toggle(); //toggle selected nucleotide
                    break;
            }
            sys.backbone.geometry["attributes"].instanceColor.needsUpdate = true;
            sys.connector.geometry["attributes"].instanceColor.needsUpdate = true;
            sys.bbconnector.geometry["attributes"].instanceColor.needsUpdate = true;
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
                    baseInfoLines.push(["sid:", s_bases[i].global_id, "|", "lID:", s_bases[i].local_id].join(" "));
                }
            }
            makeTextArea(baseInfoLines.join("\n"), "BaseInfo"); //insert basesInfo into "BaseInfo" text area
        }
    }
});
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
        "stiff = 0.09\n" +
        "r0 = 1.2 \n" +
        "PBC = 1" + "\n}\n\n";
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
