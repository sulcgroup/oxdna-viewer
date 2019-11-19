function makeOutputFiles() {
    let clean = document.getElementsByName("cleanFirst");
    let name = document.getElementById("outputFilename").value;
    if (clean[0].checked == true) {
        api.cleanOrder();
    }
    let top = document.getElementsByName("topDownload");
    if (top[0].checked == true) {
        makeTopFile(name);
    }
    let dat = document.getElementsByName("datDownload");
    if (dat[0].checked == true) {
        makeDatFile(name);
    }
}
function makeTopFile(name) {
    let top = []; //string of contents of .top file
    let totNuc = 0; //total # of elements
    let totStrands = 0; //total # of strands
    for (let i = 0; i < systems.length; i++) { //for each system
        totStrands += systems[i][strands].length;
        for (let j = 0; j < systems[i][strands].length; j++) { //for each strand in current system
            totNuc += systems[i][strands][j][monomers].length;
        }
    }
    top.push(totNuc + " " + totStrands);
    for (let i = 0; i < elements.length; i++) { //for each nucleotide in the system
        let tl = [elements[i].parent.strandID, elements[i].type]; //strand id in global world + base type
        let neighbor3 = elements[i].neighbor3;
        let neighbor5 = elements[i].neighbor5;
        if (neighbor3 === null || neighbor3 === undefined)
            tl.push(-1); // if no neigbor3, neighbor3's global id = -1
        else if (neighbor3 !== null)
            tl.push(neighbor3.gid); //if neighbor3 exists, append neighbor3's global id
        if (neighbor5 === null || neighbor5 === undefined)
            tl.push(-1); //if neighbor5 doesn't exist, append neighbor5's position = -1
        else
            tl.push(neighbor5.gid); //if neighbor5 exists, append neighbor5's position
        top.push(tl.join(" "));
    }
    makeTextFile(name + ".top", top.join("\n")); //make .top file
}
function makeDatFile(name) {
    // Get largest absolute coordinate:
    let maxCoord = 0;
    for (let i = 0; i < elements.length; i++) { //for all elements
        let p = elements[i].getInstanceParameter3("cmOffsets");
        maxCoord = Math.max(maxCoord, Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)));
    }
    let dat = "";
    let box = Math.ceil(5 * maxCoord);
    dat = "t = 0\n" + "b = " + box + " " + box + " " + box
        + "\n" + "E = 0 0 0 " + datFileout + "\n";
    for (let i = 0; i < elements.length; i++) { //for all elements
        let nuc = elements[i];
        dat += nuc.getDatFileOutput();
    }
    makeTextFile(name + ".dat", dat); //make .dat file
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
    let mutTrapText = "";
    for (let x = 0; x < listBases.length; x = x + 2) { //for every selected nucleotide in listBases string
        if (listBases[x + 1] !== undefined) { //if there is another nucleotide in the pair
            mutTrapText = mutTrapText + writeMutTrapText(listBases[x], listBases[x + 1]) + writeMutTrapText(listBases[x + 1], listBases[x]); //create mutual trap data for the 2 nucleotides in a pair - selected simultaneously
        }
        else { //if there is no 2nd nucleotide in the pair
            notify("The last selected base does not have a pair and thus cannot be included in the Mutual Trap File."); //give error message
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
