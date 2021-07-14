const instanceParams = new Map([
    ['cmOffsets', 3], ['bbOffsets', 3], ['nsOffsets', 3],
    ['nsRotation', 4], ['conOffsets', 3], ['conRotation', 4],
    ['bbconOffsets', 3], ['bbconRotation', 4], ['bbColors', 3],
    ['scales', 3], ['nsScales', 3], ['conScales', 3], ['bbconScales', 3],
    ['visibility', 3], ['nsColors', 3], ['bbLabels', 3]
]);
class InstanceCopy {
    constructor(e) {
        instanceParams.forEach((size, attr) => {
            if (size == 3) {
                this[attr] = e.getInstanceParameter3(attr);
            }
            else { // 4
                this[attr] = e.getInstanceParameter4(attr);
            }
        });
        this.type = e.type;
        this.id = e.id;
        this.clusterId = e.clusterId;
        this.color = e.color;
        this.n3id = e.n3 ? e.n3.id : -1;
        this.n5id = e.n5 ? e.n5.id : -1;
        if (e.isPaired()) {
            this.bpid = e.pair.id;
        }
        this.elemType = e.constructor;
        this.system = e.getSystem();
    }
    writeToSystem(sid, sys) {
        instanceParams.forEach((size, attr) => {
            sys.fillVec(attr, size, sid, this[attr].toArray());
        });
    }
}
let copied = [];
function copyWrapper() {
    if (selectedBases.size == 0) {
        notify("Please select monomers to copy");
        return;
    }
    let toCopy = Array.from(selectedBases).map(e => e.id); // Save so that we can clear the selection
    clearSelection();
    copied = toCopy.map(i => new InstanceCopy(elements.get(i)));
}
function cutWrapper() {
    if (selectedBases.size == 0) {
        notify("Please select monomers to copy");
        return;
    }
    let elems = Array.from(selectedBases); // Save so that we can clear the selection
    clearSelection();
    copied = elems.map(e => new InstanceCopy(e));
    editHistory.do(new RevertableDeletion(elems));
    topologyEdited = true;
}
function pasteWrapper(keepPos) {
    if (copied.length == 0) {
        notify("Nothing is copied, so nothing to paste");
        return;
    }
    let pos;
    if (!keepPos) {
        // Set paste destination to 20 units in front of the camera
        const cameraHeading = new THREE.Vector3(0, 0, -1);
        cameraHeading.applyQuaternion(camera.quaternion);
        pos = camera.position.clone().add(cameraHeading.clone().multiplyScalar(20));
    }
    // Add elements to scene
    let elems = edit.addElementsAt(copied, pos);
    // Add to history
    editHistory.add(new RevertableAddition(copied, elems, pos));
    topologyEdited = true;
    api.selectElements(elems);
}
function nickWrapper() {
    let e = Array.from(selectedBases).pop();
    if (e == undefined) {
        notify("Please select a monomer to nick at");
        return;
    }
    editHistory.do(new RevertableNick(e));
    topologyEdited = true;
}
function ligateWrapper() {
    let e = Array.from(selectedBases).slice(-2);
    if (e[0] == undefined || e[1] == undefined) {
        notify("Please select two monomers to ligate");
        return;
    }
    editHistory.do(new RevertableLigation(e[0], e[1]));
    topologyEdited = true;
}
function extendWrapper(double) {
    let e = Array.from(selectedBases).pop();
    let seq = view.getInputValue("sequence").toUpperCase();
    let extendDuplex = view.getInputBool("setCompl");
    if (e == undefined) {
        notify("Please select a monomer to extend from");
        return;
    }
    if (seq == "") {
        notify("Please type a sequence into the box");
        return;
    }
    let elems = extendDuplex ? edit.extendDuplex(e, seq) : edit.extendStrand(e, seq);
    let instanceCopies = elems.map(e => { return new InstanceCopy(e); });
    let pos = new THREE.Vector3();
    elems.forEach(e => pos.add(e.getPos()));
    pos.divideScalar(elems.length);
    // Add to history
    editHistory.add(new RevertableAddition(instanceCopies, elems, pos));
    topologyEdited = true;
}
function createWrapper() {
    let seq = view.getInputValue("sequence").toUpperCase();
    let createDuplex = view.getInputBool("setCompl");
    if (seq == "") {
        notify("Please type a sequence into the box");
        return;
    }
    let elems = edit.createStrand(seq, createDuplex);
    let instanceCopies = elems.map(e => { return new InstanceCopy(e); });
    let pos = new THREE.Vector3();
    elems.forEach(e => pos.add(e.getPos()));
    pos.divideScalar(elems.length);
    // Add to history
    editHistory.add(new RevertableAddition(instanceCopies, elems, pos));
    topologyEdited = true;
}
function deleteWrapper() {
    let e = Array.from(selectedBases);
    clearSelection();
    if (e == []) {
        notify("Please select monomers to delete");
        return;
    }
    editHistory.do(new RevertableDeletion(e));
    topologyEdited = true;
}
function interconnectDuplex3pWrapper() {
    let strands = new Set();
    let seq = view.getInputValue("sequence").toUpperCase();
    selectedBases.forEach(b => strands.add(b.strand));
    if (strands.size != 2 || seq == "") {
        notify("please select 2 strands you want to connect by a duplex and type a sequence into the box.");
    }
    else {
        let [s1, s2] = Array.from(strands);
        edit.interconnectDuplex3p(s1, s2, seq);
    }
}
function interconnectDuplex5pWrapper() {
    let strands = new Set();
    let seq = view.getInputValue("sequence").toUpperCase();
    selectedBases.forEach(b => strands.add(b.strand));
    if (strands.size != 2 || seq == "") {
        notify("please select 2 strands you want to connect by a duplex and type a sequence into the box.");
    }
    else {
        let [s1, s2] = Array.from(strands);
        edit.interconnectDuplex5p(s1, s2, seq);
    }
}
function getSelectedSeqWrapper() {
    let seqInp = view.getInputElement("sequence");
    let seqLen = view.getInputElement("seqLen");
    let seq = "";
    let strands = new Set();
    //generate check for the selection to contain 1 strand
    selectedBases.forEach(b => {
        strands.add(b.strand);
    });
    if (strands.size == 1) {
        //now that we know we have 1 strand we can enumerate the elements 5->3
        Array.from(strands)[0].forEach(b => { if (selectedBases.has(b))
            seq += b.type; });
        seqInp.value = seq;
        seqLen.innerHTML = seq.length.toString();
    }
    else
        notify("Selection only on 1 strand allowed");
}
let complement_dict = { "A": "T", "T": "A", "C": "G", "G": "C" };
function rc(seq) {
    let ret = [];
    for (let i = seq.length - 1; i > 0; i--)
        ret.push(complement_dict[seq[i]]);
    return ret.join("");
}
function reverseComplementWrapper() {
    let seqInp = view.getInputElement("sequence");
    let seq = rc(seqInp.value.toUpperCase());
    seqInp.value = seq;
}
function findDomainWrapper() {
    let seq = view.getInputValue("sequence").toUpperCase();
    const search_func = system => {
        system.strands.forEach(strand => {
            let strand_seq = strand.getSequence();
            let idx = strand_seq.indexOf(seq);
            if (idx >= 0) {
                let monomers = strand.getMonomers();
                api.selectElements(monomers.slice(idx, idx + seq.length + 1), true);
                render();
            }
        });
    };
    systems.forEach(search_func);
    tmpSystems.forEach(search_func);
}
function skipWrapper() {
    let e = Array.from(selectedBases);
    ;
    clearSelection();
    if (e == []) {
        notify("Please select monomers to skip");
        return;
    }
    edit.skip(e);
    topologyEdited = true;
}
function insertWrapper() {
    let seq = view.getInputValue("sequence").toUpperCase();
    if (seq == "") {
        notify("Please type a sequence into the box");
        return;
    }
    let e = Array.from(selectedBases).pop();
    if (e == undefined) {
        notify("Please select a monomer insert after");
        return;
    }
    edit.insert(e, seq);
    topologyEdited = true;
}
function setSeqWrapper() {
    let seq = view.getInputValue("sequence").toUpperCase();
    let setCompl = view.getInputBool("setCompl");
    if (seq == "") {
        notify("Please type a sequence into the box");
        return;
    }
    if (selectedBases.size == 0) {
        notify("Please select nucleotides to apply sequence to");
        return;
    }
    if (selectedBases.size > seq.length) {
        notify("Sequence is shorter than the selection");
        return;
    }
    editHistory.do(new RevertableSequenceEdit(selectedBases, seq, setCompl));
    topologyEdited = true;
}
function moveToWrapper() {
    // assuming last element of the selection is the move to position
    let bases = Array.from(selectedBases);
    let e = bases.pop();
    edit.move_to(e, bases);
}
function createNetworkWrapper() {
    // Makes a Network
    let bases = Array.from(selectedBases);
    // copied = bases.map(e => new InstanceCopy(e)); // this is probably unnecessary
    let nid = networks.length;
    editHistory.do(new RevertableNetworkCreation(bases, nid));
    view.addNetwork(nid); // don't know if it's a good idea to call this here or not?
}
function deleteNetworkWrapper(nid) {
    let net = networks[nid];
    if (net.onscreen) {
        net.toggleVis(); // turn it off
    }
    try {
        view.removeNetworkData(nid);
    }
    catch (e) { }
    networks.splice(nid, 1);
    if (selectednetwork == nid)
        selectednetwork = -1;
    view.removeNetwork(nid);
}
function fillEdgesWrapper(nid, edgecase) {
    // Easy expansion for other edge methods
    if (networks.length == 0 || nid < 0) {
        notify('No Networks Found, Please Create Network');
    }
    else {
        let net = networks[nid];
        switch (edgecase) {
            case 0:
                let cutoff = view.getInputNumber("edgeCutoff");
                if (typeof (cutoff) != "number" || cutoff > 1000 || cutoff <= 0 || isNaN(cutoff)) {
                    notify("Please enter recongized value into 'Edge Cutoff' box");
                }
                else {
                    net.edgesByCutoff(cutoff);
                }
                break;
            case 1:
                net.edgesMWCENM();
                break;
            case 2:
                let cutoffe = view.getInputNumber("edgeCutoff");
                if (typeof (cutoffe) != "number" || cutoffe > 1000 || cutoffe <= 0 || isNaN(cutoffe)) {
                    notify("Please enter recongized value into 'Edge Cutoff' box");
                }
                else {
                    net.edgesANMT(cutoffe);
                }
                break;
        }
    }
}
function visualizeNetworkWrapper(nid) {
    let net = networks[nid];
    if (net.reducedEdges.total == 0) {
        notify("Connections must be assigned prior to Network Visualization");
        return;
    }
    net.toggleVis();
}
function selectNetworkWrapper(nid) {
    clearSelection();
    let net;
    try {
        net = networks[nid];
    }
    catch (e) {
        notify("Network " + (nid + 1).toString() + " Does Not Exist");
        return;
    }
    selectednetwork = nid; // global declared in main
    net.selectNetwork();
}
function discretizeMassWrapper(option) {
    if (selectedBases.size == 0) { // Need Elements
        notify("Please select Bases");
        return;
    }
    let cellSize = view.getInputNumber("cellSize");
    if (cellSize <= 0 || typeof (cellSize) != "number" || isNaN(cellSize)) { //Valid value for cellsize
        notify("Please Enter Valid Cell Size into the Cell Size Box");
        return;
    }
    else {
        let elems = Array.from(selectedBases); // Save so that we can clear the selection
        clearSelection();
        let ret;
        if (option == 0) {
            ret = edit.discretizeMass(elems, cellSize);
        }
        else if (option == 1) {
            // cellsize is the placed particle radius
            ret = edit.discretizeDensity(elems, 0.2, cellSize);
        }
        const InstMassSys = ret["elems"].map(e => new InstanceCopy(e));
        editHistory.add(new RevertableAddition(InstMassSys, ret["elems"]));
        flux.prepIndxButton(ret["indx"]);
    }
}
