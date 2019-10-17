let listBases = []; //list of bases to download in .txt file
let basesInfo = ""; //list of bases' info - location, strand and system ids, etc. - to download in .txt file
let mouse3D;
let raycaster = new THREE.Raycaster();
;
let intersects;
canvas.addEventListener('mousedown', event => {
    if (getActionModes().includes("Select")) {
        let id = gpu_picker(event);
        //if something was clicked, toggle the coloration of the appropriate things.
        if (id > -1) {
            // This runs after the selection is done and the nucleotides are toggled,
            // but it needs to be defined as a callback since the cluster selection
            // can take a while to finish.
            let nucleotide = elements[id];
            let sys = nucleotide.parent.parent;
            // Select multiple elements my holding down ctrl
            if (!event.ctrlKey && !event.shiftKey && !selectedBases.has(nucleotide)) {
                clearSelection();
            }
            let strandCount = sys[strands].length;
            switch (getScopeMode()) {
                case "System":
                    for (let i = 0; i < strandCount; i++) { //for every strand in the System
                        let strand = sys[strands][i];
                        let nucCount = strand[monomers].length;
                        for (let j = 0; j < nucCount; j++) // for every nucleotide on the Strand
                            strand[monomers][j].toggle();
                    }
                    updateView(sys);
                    break;
                case "Strand":
                    let strand_length = nucleotide.parent[monomers].length;
                    for (let i = 0; i < strand_length; i++) //for every nucleotide in strand
                        nucleotide.parent[monomers][i].toggle();
                    updateView(sys);
                    break;
                case "Monomer":
                    nucleotide.toggle();
                    if (event.shiftKey) {
                        selectIntermediate();
                    }
                    updateView(sys);
                    break;
                case "Cluster":
                    if (typeof elements[0].clusterId == 'undefined') {
                        document.getElementById("clusterOptions").hidden = false;
                    }
                    else {
                        for (let i = 0; i < strandCount; i++) {
                            let strand = sys[strands][i];
                            let nucCount = strand[monomers].length;
                            // for every nucleotide on the Strand in the System
                            for (let j = 0; j < nucCount; j++) {
                                let n = strand[monomers][j];
                                if (n.clusterId == nucleotide.clusterId) {
                                    n.toggle();
                                }
                            }
                        }
                        updateView(sys);
                    }
                    break;
            }
        }
    }
});
function updateView(sys) {
    //tell the GPU to update the colors in the scene
    sys.backbone.geometry["attributes"].instanceColor.needsUpdate = true;
    sys.nucleoside.geometry["attributes"].instanceColor.needsUpdate = true;
    sys.connector.geometry["attributes"].instanceColor.needsUpdate = true;
    sys.bbconnector.geometry["attributes"].instanceColor.needsUpdate = true;
    render(); //update scene;
    listBases = [];
    let baseInfoStrands = {};
    //sort selection info into respective containers
    selectedBases.forEach((base) => {
        //store global ids for BaseList view
        listBases.push(base.gid);
        //assign each of the selected bases to a strand
        let strandID = base.parent.strandID;
        if (strandID in baseInfoStrands)
            baseInfoStrands[strandID].push(base);
        else
            baseInfoStrands[strandID] = [base];
    });
    //Display every selected nucleotide id (top txt box)
    makeTextArea(listBases.join(","), "BaseList");
    //Brake down info (low txt box)
    let baseInfoLines = [];
    for (let strandID in baseInfoStrands) {
        let s_bases = baseInfoStrands[strandID];
        //make a fancy header for each strand
        let header = ["Str#:", strandID, "Sys#:", s_bases[0].parent.parent.systemID];
        baseInfoLines.push("----------------------");
        baseInfoLines.push(header.join(" "));
        baseInfoLines.push("----------------------");
        //fish out all the required base info
        //one could also sort it if neaded ...
        for (let i = 0; i < s_bases.length; i++) {
            baseInfoLines.push(["sid:", s_bases[i].gid, "|", "lID:", s_bases[i].lid].join(" "));
        }
    }
    makeTextArea(baseInfoLines.join("\n"), "BaseInfo"); //insert basesInfo into "BaseInfo" text area
}
;
function clearSelection() {
    elements.forEach(element => {
        if (selectedBases.has(element)) {
            element.toggle();
        }
    });
    systems.forEach(sys => {
        updateView(sys);
    });
}
function invertSelection() {
    elements.forEach(element => {
        element.toggle();
    });
    systems.forEach(sys => {
        updateView(sys);
    });
}
function selectAll() {
    elements.forEach(element => {
        if (!selectedBases.has(element)) {
            element.toggle();
        }
    });
    systems.forEach(sys => {
        updateView(sys);
    });
}
function selectIntermediate() {
    let n = elements.length;
    let iMin = 0;
    let iMax = n;
    while (iMin++ <= n) {
        if (selectedBases.has(elements[iMin])) {
            break;
        }
    }
    while (iMax-- > 0) {
        if (selectedBases.has(elements[iMax])) {
            break;
        }
    }
    for (let i = iMin; i < iMax; i++) {
        if (!selectedBases.has(elements[i])) {
            elements[i].toggle();
        }
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
/**
 * Modified from SelectionBox code by HypnosNova
 * https://github.com/mrdoob/three.js/blob/master/examples/jsm/interactive
 *
 * Used for box selection functionality in DragControls
 */
class BoxSelector {
    /**
     * @param startPoint Start position x,y,z
     * @param camera Camera, to calculate frustum
     * @param deep Optional depth of frustum
     */
    constructor(screenStart, camera, domElement, deep) {
        this.frustum = new THREE.Frustum();
        this.startPoint = new THREE.Vector3();
        this.endPoint = new THREE.Vector3();
        this.collection = [];
        this.screenStart = new THREE.Vector2();
        this.screenEnd = new THREE.Vector2();
        this.camera = camera;
        this.domElement = domElement;
        this.deep = deep || Number.MAX_VALUE;
        this.screenStart = screenStart;
        // Setup the drawn box
        this.drawnBox = document.createElement('div');
        this.drawnBox.classList.add('selectBox');
        this.drawnBox.style.pointerEvents = 'none';
        this.drawnBox.style.left = this.screenStart.x + 'px';
        this.drawnBox.style.top = this.screenStart.y + 'px';
        this.drawnBox.style.width = '0px';
        this.drawnBox.style.height = '0px';
        renderer.domElement.parentElement.appendChild(this.drawnBox);
        // Calculate and save start point in scene coords
        this.startPoint = this.fromScreenSpace(this.screenStart);
    }
    ;
    /**
     * Redraw the selection box on the screen (call whenever mouse is moved)
     * @param screenEnd (optional) End position in x,y screen coordinates
     * @param screenStart (optional) Start position in x,y screen coordinates
     */
    redrawBox(screenEnd, screenStart) {
        this.screenStart = screenStart || this.screenStart;
        this.screenEnd = screenEnd || this.screenEnd;
        let pointBottomRight = new THREE.Vector2(Math.max(this.screenStart.x, this.screenEnd.x), Math.max(this.screenStart.y, this.screenEnd.y));
        let pointTopLeft = new THREE.Vector2(Math.min(this.screenStart.x, this.screenEnd.x), Math.min(this.screenStart.y, this.screenEnd.y));
        this.drawnBox.style.left = pointTopLeft.x + 'px';
        this.drawnBox.style.top = pointTopLeft.y + 'px';
        this.drawnBox.style.width = pointBottomRight.x - pointTopLeft.x + 'px';
        this.drawnBox.style.height = pointBottomRight.y - pointTopLeft.y + 'px';
    }
    ;
    /**
     * @param endPoint (optional) End position x,y,z
     * @param startPoint (optional) Start position x,y,z
     * @return Selected elements
     */
    select(screenEnd, screenStart) {
        this.screenStart = screenStart || this.screenStart;
        this.screenEnd = screenEnd || this.screenEnd;
        this.startPoint = this.fromScreenSpace(this.screenStart);
        this.endPoint = this.fromScreenSpace(this.screenEnd);
        // Update selected elements within box
        this.collection = [];
        this.updateFrustum(this.startPoint, this.endPoint);
        elements.forEach(element => {
            let cm_pos = element.getInstanceParameter3("cmOffsets");
            if (this.frustum.containsPoint(cm_pos)) {
                this.collection.push(element);
            }
        });
        return this.collection;
    }
    ;
    onSelectOver() {
        this.drawnBox.parentElement.removeChild(this.drawnBox);
    }
    ;
    fromScreenSpace(pos) {
        var rect = this.domElement.getBoundingClientRect();
        return new THREE.Vector3(((pos.x - rect.left) / rect.width) * 2 - 1, -((pos.y - rect.top) / rect.height) * 2 + 1, 0.5);
    }
    updateFrustum(startPoint, endPoint) {
        startPoint = startPoint || this.startPoint;
        endPoint = endPoint || this.endPoint;
        this.camera.updateProjectionMatrix();
        this.camera.updateMatrixWorld(false);
        let tmpPoint = startPoint.clone();
        tmpPoint.x = Math.min(startPoint.x, endPoint.x);
        tmpPoint.y = Math.max(startPoint.y, endPoint.y);
        endPoint.x = Math.max(startPoint.x, endPoint.x);
        endPoint.y = Math.min(startPoint.y, endPoint.y);
        let vecNear = this.camera.position.clone();
        let vecTopLeft = tmpPoint.clone();
        let vecTopRight = new THREE.Vector3(endPoint.x, tmpPoint.y, 0);
        let vecDownRight = endPoint.clone();
        let vecDownLeft = new THREE.Vector3(tmpPoint.x, endPoint.y, 0);
        vecTopLeft.unproject(this.camera);
        vecTopRight.unproject(this.camera);
        vecDownLeft.unproject(this.camera);
        vecDownRight.unproject(this.camera);
        let vectemp1 = vecTopLeft.clone().sub(vecNear);
        let vectemp2 = vecTopRight.clone().sub(vecNear);
        let vectemp3 = vecDownRight.clone().sub(vecNear);
        vectemp1.normalize();
        vectemp2.normalize();
        vectemp3.normalize();
        vectemp1.multiplyScalar(this.deep);
        vectemp2.multiplyScalar(this.deep);
        vectemp3.multiplyScalar(this.deep);
        vectemp1.add(vecNear);
        vectemp2.add(vecNear);
        vectemp3.add(vecNear);
        var planes = this.frustum.planes;
        planes[0].setFromCoplanarPoints(vecNear, vecTopLeft, vecTopRight);
        planes[1].setFromCoplanarPoints(vecNear, vecTopRight, vecDownRight);
        planes[2].setFromCoplanarPoints(vecDownRight, vecDownLeft, vecNear);
        planes[3].setFromCoplanarPoints(vecDownLeft, vecTopLeft, vecNear);
        planes[4].setFromCoplanarPoints(vecTopRight, vecDownRight, vecDownLeft);
        planes[5].setFromCoplanarPoints(vectemp3, vectemp2, vectemp1);
        planes[5].normal.multiplyScalar(-1);
    }
    ;
}
;
