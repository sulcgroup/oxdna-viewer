/// <reference path="../typescript_definitions/index.d.ts" />
let mouse3D;
let raycaster = new THREE.Raycaster();
;
let intersects;
canvas.addEventListener('mousemove', event => {
    if (boxSelector && selectionMode === "Box") {
        // Box selection
        event.preventDefault();
        boxSelector.redrawBox(new THREE.Vector2(event.clientX, event.clientY));
    }
    else {
        // Change the cursor if you're hovering over something selectable
        let id = gpuPicker(event);
        if (id > -1) {
            canvas.style.cursor = 'pointer';
            view.showHoverInfo(new THREE.Vector2(event.clientX, event.clientY), elements.get(id));
        }
        else {
            canvas.style.cursor = 'auto';
            view.hideHoverInfo();
        }
    }
});
canvas.addEventListener('mousedown', event => {
    canvas.focus(); // Make sure canvas has focus (to capture any keyboard events)
    // If double click, zoom in on element
    if (event.detail == 2) {
        if (!transformControls.isHovered()) {
            let id = gpuPicker(event);
            if (id > -1) {
                api.findElement(elements.get(id));
                event.preventDefault();
            }
            else {
                clearSelection();
            }
        }
        return;
    }
    if (selectionMode != 'Disabled') {
        let id = gpuPicker(event);
        //if something was clicked, toggle the coloration of the appropriate things.
        if (id > -1 && !transformControls.isHovered()) {
            // This runs after the selection is done and the nucleotides are toggled,
            // but it needs to be defined as a callback since the cluster selection
            // can take a while to finish.
            let nucleotide = elements.get(id);
            let sys = nucleotide.getSystem();
            let selecting = selectedBases.has(nucleotide) ? false : true;
            // Select multiple elements my holding down ctrl/command
            if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !selectedBases.has(nucleotide)) {
                clearSelection();
            }
            switch (selectionMode) {
                case "System":
                    sys.strands.forEach(strand => {
                        strand.toggleMonomers();
                    });
                    updateView(sys);
                    break;
                case "Strand":
                    let orderFlag = true ? nucleotide.strand.isNucleicAcid() : false;
                    nucleotide.strand.forEach(e => {
                        e.toggle();
                        if (view.selectPairs()) {
                            if (!nucleotide.isPaired()) {
                                view.longCalculation(findBasepairs, view.basepairMessage, () => { selectPaired(e); updateView(sys); });
                            }
                            else {
                                selectPaired(e);
                            }
                        }
                    }, orderFlag);
                    updateView(sys);
                    break;
                case "Monomer":
                    if (event.shiftKey) {
                        if (view.selectPairs()) {
                            if (!nucleotide.isPaired()) {
                                view.longCalculation(findBasepairs, view.basepairMessage, () => { fancySelectIntermediate(nucleotide); updateView(sys); });
                            }
                            else {
                                fancySelectIntermediate(nucleotide);
                            }
                        }
                        else {
                            if (event.altKey) {
                                fancySelectIntermediate(nucleotide);
                            }
                            else {
                                selectIntermediate(nucleotide, selecting);
                            }
                        }
                    }
                    else if (view.selectPairs()) {
                        if (!nucleotide.isPaired()) {
                            view.longCalculation(findBasepairs, view.basepairMessage, () => { selectPaired(nucleotide); updateView(sys); });
                        }
                        else {
                            selectPaired(nucleotide);
                        }
                    }
                    else {
                        nucleotide.toggle();
                    }
                    updateView(sys);
                    break;
                case "Cluster":
                    sys.strands.forEach(strand => strand.forEach(e => {
                        if (e.clusterId == nucleotide.clusterId) {
                            e.toggle();
                        }
                    }));
                    updateView(sys);
                    break;
            }
            if (tmpSystems.length !== 0) {
                tmpSystems.forEach((sys) => {
                    sys.callUpdates(["instanceColor"]);
                });
            }
            if (selectedBases.size > 0 && view.transformMode.enabled()) {
                transformControls.show();
            }
            else {
                transformControls.hide();
            }
        }
    }
});
function updateView(sys) {
    //tell the GPU to update the colors in the scene
    sys.callUpdates(["instanceColor"]);
    if (tmpSystems.length !== 0) {
        tmpSystems.forEach((sys) => {
            sys.callUpdates(["instanceColor"]);
        });
    }
    let listBases = [];
    let baseInfoStrands = {};
    //sort selection info into respective containers
    selectedBases.forEach((base) => {
        //store global ids for BaseList view
        listBases.push(base.id);
        if (!base.isPatchyParticle) {
            //assign each of the selected bases to a strand
            let strandID = base.strand.id;
            if (strandID in baseInfoStrands)
                baseInfoStrands[strandID].push(base);
            else
                baseInfoStrands[strandID] = [base];
        }
    });
    // Display every selected nucleotide id (top txt box)
    makeTextArea(listBases.join(","), "baseList");
    // Update hierarchy checkboxes to match selected elements
    if (view.isWindowOpen('systemHierarchyWindow')) {
        let recheck = () => {
            let hierarchy = $('#hierarchyContent');
            hierarchy.data('checkboxMap').forEach((checkbox, id) => {
                checkbox.checked = selectedBases.has(elements.get(id));
            });
            hierarchy.data('treeview')._recheck(hierarchy);
        };
        recheck();
    }
    //Brake down info (low txt box)
    let baseInfoLines = [];
    for (let strandID in baseInfoStrands) {
        let sBases = baseInfoStrands[strandID];
        //make a fancy header for each strand
        let header = ["Str#:", strandID, "Sys#:", sBases[0].getSystem().systemID];
        baseInfoLines.push("----------------------");
        baseInfoLines.push(header.join(" "));
        baseInfoLines.push("----------------------");
        //fish out all the required base info
        //one could also sort it if neaded ...
        for (let i = 0; i < sBases.length; i++) {
            baseInfoLines.push([sBases[i].type, "|", "id:", sBases[i].id].join(" "));
        }
    }
    makeTextArea(baseInfoLines.join("\n"), "BaseInfo"); //insert basesInfo into "BaseInfo" text area
    /*
    // Sadly. this seems to be doable only with jquery
    // https://stackoverflow.com/questions/25286488/with-vanilla-javascript-how-can-i-access-data-stored-by-jquerys-data-method
    let table = $('#baseInfo').data()['listview'];

    for (let strandID in baseInfoStrands){
        let sBases = baseInfoStrands[strandID];
        let strand = table.addGroup({
            caption: `Strand ${strandID} (System ${sBases[0].getSystem().systemID})`
        });
        
        for(let i = 0; i < sBases.length; i++){
            let color = sBases[i].elemToColor(sBases[i].type).getHexString();
            table.add(strand, {
                caption: `id: ${sBases[i].id} | lID:  ${sBases[i].lid}`,
                icon: `<span style="background:#${color}4f">${sBases[i].type}</span>`
            });
        }
    }
    */
}
;
function clearSelection() {
    selectedBases.forEach(element => {
        element.toggle();
    });
    systems.forEach(sys => {
        updateView(sys);
    });
    transformControls.hide();
}
function invertSelection() {
    elements.forEach(element => {
        element.toggle();
    });
    systems.forEach(sys => {
        updateView(sys);
    });
    if (selectedBases.size > 0 && view.transformMode.enabled()) {
        transformControls.show();
    }
    else {
        transformControls.hide();
    }
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
    if (selectedBases.size > 0 && view.transformMode.enabled()) {
        transformControls.show();
    }
}
function selectPaired(e) {
    if (e instanceof Nucleotide) {
        let pair = e.pair;
        if (pair) {
            pair.toggle();
        }
    }
}
function fancySelectIntermediate(e) {
    let paired = view.selectPairs();
    let d = new Dijkstra(Array.from(elements.values()), paired);
    let elems = [];
    view.longCalculation(() => {
        elems = d.shortestPath(e, Array.from(selectedBases));
    }, "Calculating intermediate elements...", () => {
        elems.forEach(elem => {
            if (!selectedBases.has(elem)) {
                elem.toggle();
            }
            if (paired && elem instanceof Nucleotide) {
                let pair = elem.pair;
                if (pair && !selectedBases.has(pair)) {
                    pair.toggle();
                }
            }
        });
        updateView(e.getSystem());
    });
}
function selectIntermediate(n, selecting) {
    function selectIdRange(selecting) {
        let n = elements.getNextId();
        let iMin = 0;
        let iMax = n;
        // Find the edges of selectedBases
        while (iMin <= n) {
            if (elements.has(iMin) && selectedBases.has(elements.get(iMin))) {
                break;
            }
            iMin++;
        }
        while (iMax > 0) {
            if (elements.has(iMax) && selectedBases.has(elements.get(iMax))) {
                break;
            }
            iMax--;
        }
        // And select everything in between (this isn't necessarily what we want, but it's how it's been for a long time.)
        for (let i = iMin; i < iMax; i++) {
            if (elements.has(i) && !selectedBases.has(elements.get(i))) {
                selecting ? elements.get(i).select() : elements.get(i).deselect();
            }
        }
    }
    function selectStrandRange(n, selecting) {
        let s5 = n.strand.end5;
        let s3 = n.strand.end3;
        //find the substrand affected
        while (s5 != s3) {
            if (s5 == last || s5 == n) {
                break;
            }
            s5 = s5.n3;
        }
        while (s3 != s5) {
            if (s3 == last || s3 == n) {
                break;
            }
            s3 = s3.n5;
        }
        //Select or deselect it
        let substr = n.strand.getSubstrand(s5, s3);
        substr.forEach(n => selecting ? n.select() : n.deselect());
    }
    let last = selecting ? selectedBases.last : selectedBases.last;
    if (last == undefined) {
        notify("Last selected base undefined! Select something new to use range select.", 'alert');
        return;
    }
    if (last.strand == n.strand && !n.isPatchyParticle()) {
        selectStrandRange(n, selecting);
    }
    else {
        notify("Selections not on same strand! Selecting id range instead", "warning");
        n.toggle();
        selectIdRange(selecting);
    }
}
function makeTextArea(bases, id) {
    let textArea = document.getElementById(id);
    if (textArea !== null) { //as long as text area was retrieved by its ID, id
        textArea.innerHTML = bases; //set innerHTML / content to bases
    }
}
let boxSelector;
canvas.addEventListener('mousedown', event => {
    if (selectionMode === "Box" && !transformControls.isHovered()) {
        // Box selection
        event.preventDefault();
        // Disable trackball controlls
        controls.enabled = false;
        // Select multiple elements my holding down ctrl/command
        if (!event.ctrlKey && !event.metaKey) {
            clearSelection();
        }
        // Create a selection box
        boxSelector = new BoxSelector(new THREE.Vector2(event.clientX, event.clientY), camera, canvas);
    }
}, false);
let onDocumentMouseCancel = event => {
    if (boxSelector && selectionMode === "Box") {
        // Box selection
        event.preventDefault();
        // Calculate which elements are in the drawn box
        let boxSelected = boxSelector.select(new THREE.Vector2(event.clientX, event.clientY));
        // Toggle selected elements (unless they are already selected)
        boxSelected.forEach(element => {
            if (!selectedBases.has(element)) {
                element.toggle();
            }
        });
        if (selectedBases.size > 0 && view.transformMode.enabled()) {
            transformControls.show();
        }
        else {
            transformControls.hide();
        }
        // Remove selection box and update the view
        boxSelector.onSelectOver();
        boxSelector = undefined;
        systems.forEach(sys => {
            updateView(sys);
        });
        // Re-enable trackball controlls
        controls.enabled = true;
    }
};
canvas.addEventListener('mouseup', onDocumentMouseCancel, false);
canvas.addEventListener('mouseleave', onDocumentMouseCancel, false);
/**
 * Modified from SelectionBox code by HypnosNova
 * https://github.com/mrdoob/three.js/blob/master/examples/jsm/interactive
 *
 * Used for box selection functionality in DragControls
 */
class BoxSelector {
    frustum = new THREE.Frustum();
    startPoint = new THREE.Vector3();
    endPoint = new THREE.Vector3();
    collection = [];
    camera;
    domElement;
    deep;
    drawnBox;
    screenStart = new THREE.Vector2();
    screenEnd = new THREE.Vector2();
    /**
     * @param startPoint Start position x,y,z
     * @param camera Camera, to calculate frustum
     * @param deep Optional depth of frustum
     */
    constructor(screenStart, camera, domElement, deep) {
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
            // check if element is visible, before adding to selection
            if (element.getInstanceParameter3('visibility').x) {
                let cmPos = element.getInstanceParameter3("bbOffsets");
                if (this.frustum.containsPoint(cmPos)) {
                    this.collection.push(element);
                }
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
// Selection menu
let selectionMode = 'Monomer';
function changeSelectionMode(mode) {
    for (let button of document.getElementById("selection-modes").children) {
        if (mode != button.getAttribute('title')) {
            button.classList.remove('active');
        }
        else if (selectionMode != mode) {
            button.classList.add('active');
        }
        else {
            selectionMode = 'Disabled';
            // view.selectionMode.set(selectionMode);
            document.getElementById('selection-modes').querySelector('.active').classList.remove('active');
            return;
        }
    }
    selectionMode = mode;
    // view.selectionMode.set(selectionMode)
}
function toggleSelectionDropper() {
    const selectionDropper = document.getElementById("selection-options-dropper");
    if (document.getElementById("selection-options-drop").classList.contains("show")) {
        selectionDropper.getElementsByClassName('icon')[0].children[0].className = "mif-arrow-drop-up mif-2x";
        selectionDropper.style.backgroundColor = "#c9c9ca";
    }
    else {
        selectionDropper.getElementsByClassName('icon')[0].children[0].className = "mif-arrow-drop-down mif-2x";
        selectionDropper.style.backgroundColor = "#ebebeb";
    }
}
document.addEventListener('keydown', function (event) {
    const target = event.target;
    if (target && target.tagName === 'INPUT') {
        return;
    }
    if (event.code === "Digit1") {
        changeSelectionMode('Monomer');
    }
    else if (event.code === "Digit2") {
        changeSelectionMode('Strand');
    }
    else if (event.code === "Digit3") {
        changeSelectionMode('System');
    }
    else if (event.code === "Digit4") {
        changeSelectionMode('Cluster');
    }
    else if (event.code === "Digit5") {
        changeSelectionMode('Box');
    }
    else if (event.code === "Digit6") {
        document.getElementById('selectPairs').classList.toggle('active');
    }
});
function colorSelectorWrapper() {
    let colors = new Set();
    //go through selectedBases and fetch our reference colors
    selectedBases.forEach(b => {
        if (b.color)
            colors.add(b.color.getHex());
    });
    console.log(colors);
    const match_color = (b) => {
        if (b.color)
            return colors.has(b.color.getHex());
        return false;
    };
    let toSelect = [];
    systems.forEach(system => {
        system.strands.forEach(strand => {
            strand.filter(match_color).forEach(b => toSelect.push(b));
        });
    });
    tmpSystems.forEach(system => {
        system.strands.forEach(strand => {
            strand.filter(match_color).forEach(b => toSelect.push(b));
        });
    });
    api.selectElements(toSelect);
    render();
}
function connectedSelectorWrapper() {
    let strands = new Set();
    let selected_nucleotides = [...selectedBases].filter(e => e instanceof Nucleotide);
    // go over our selection and recheck base pairing for every suspecious nucleotide
    selected_nucleotides.forEach(e => {
        if (e instanceof Nucleotide && !e.strand.system.checkedForBasepairs && !e.pair) {
            e.pair = e.findPair();
            if (e.pair) {
                e.pair.pair = e;
            }
        }
    });
    // decompose nucleotides into strands
    selected_nucleotides.forEach(p => {
        if (p instanceof Nucleotide && p.pair)
            strands.add(p.pair.strand);
    });
    // now we have all the strands that are making up the selected bases
    // if we don't have base pairs in the fist strand, we have to search for pairs
    strands.forEach(strand => {
        strand.forEach(p => p.select());
    });
    //update the visuals 
    systems.forEach(updateView);
    tmpSystems.forEach(updateView);
}
