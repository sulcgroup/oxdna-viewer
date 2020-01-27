function nickWrapper() {
    let e = elements.get(listBases.slice(-1)[0]);
    if (e == undefined) {
        notify("Please select a monomer to nick at");
        return;
    }
    editHistory.do(new RevertableNick(e));
}
function ligateWrapper() {
    let ids = listBases.slice(-2);
    let e = [elements.get(ids[0]), elements.get(ids[1])];
    if (e[0] == undefined || e[1] == undefined) {
        notify("Please select two monomers to ligate");
        return;
    }
    editHistory.do(new RevertableLigation(e[0], e[1]));
}
function extendWrapper() {
    let e = elements.get(listBases.slice(-1)[0]);
    let seq = document.getElementById("sequence").value.toUpperCase();
    if (e == undefined) {
        notify("Please select a monomer to extend from");
        return;
    }
    if (seq == "") {
        notify("Please type a sequence into the box");
        return;
    }
    api.extendStrand(e, seq);
}
function setSeqWrapper() {
    let seq = document.getElementById("sequence").value.toUpperCase();
    let setCompl = document.getElementById("setCompl").checked;
    if (seq == "") {
        notify("Please type a sequence into the box");
        return;
    }
    let e = listBases.map(i => elements.get(i));
    let n = [];
    e.forEach(elem => {
        if (elem instanceof Nucleotide) {
            n.push(elem);
        }
    });
    if (n == []) {
        notify("Please select nucleotides to edit");
        return;
    }
    if (n.length > seq.length) {
        notify("Sequence is shorter than the selection");
        return;
    }
    editHistory.do(new RevertableSequenceEdit(n, seq, setCompl));
}
function createWrapper() {
    let seq = document.getElementById("sequence").value.toUpperCase();
    if (seq == "") {
        notify("Please type a sequence into the box");
        return;
    }
    api.createStrand(seq);
}
function deleteWrapper() {
    let e = listBases.map(i => elements.get(i));
    clearSelection();
    if (e == []) {
        notify("Please select monomers to delete");
        return;
    }
    api.del(e);
}
