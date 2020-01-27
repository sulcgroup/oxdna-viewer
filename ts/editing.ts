function nickWrapper() {
    let e: BasicElement = elements.get(listBases.slice(-1)[0])
    if (e == undefined) {
        notify("Please select a monomer to nick at")
        return
    }
    editHistory.do(new RevertableNick(e))
}

function ligateWrapper() {
    let ids = listBases.slice(-2);
    let e: BasicElement[] = [elements.get(ids[0]), elements.get(ids[1])]
    if (e[0] == undefined || e[1] == undefined) {
        notify("Please select two monomers to ligate")
        return
    }
    editHistory.do(new RevertableLigation(e[0], e[1]))
}

function extendWrapper() {
    let e: BasicElement = elements.get(listBases.slice(-1)[0]);
    let seq: string = (<HTMLInputElement>document.getElementById("sequence")).value.toUpperCase();
    if (e == undefined) {
        notify("Please select a monomer to extend from");
        return
    }
    if (seq == "") {
        notify("Please type a sequence into the box");
        return
    }
    api.extendStrand(e, seq)
}

function setSeqWrapper() {
    let seq: string = (<HTMLInputElement>document.getElementById("sequence")).value.toUpperCase();
    let setCompl = (<HTMLInputElement>document.getElementById("setCompl")).checked;
    if (seq == "") {
        notify("Please type a sequence into the box");
        return;
    }
    let e: BasicElement[] = listBases.map(i => elements.get(i));
    let n: Nucleotide[] = [];
    e.forEach(elem => {
        if (elem instanceof Nucleotide) {
            n.push(<Nucleotide> elem);
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
    let seq: string = (<HTMLInputElement>document.getElementById("sequence")).value.toUpperCase();
    if (seq == "") {
        notify("Please type a sequence into the box");
        return
    }
    api.createStrand(seq);
}

function deleteWrapper() {
    let e: BasicElement[] = listBases.map(i => elements.get(i))
    clearSelection();
    if (e == []) {
        notify("Please select monomers to delete");
        return
    }
    api.del(e);
}