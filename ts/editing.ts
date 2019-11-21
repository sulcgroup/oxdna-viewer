function nickWrapper() {
    let e: BasicElement = elements[listBases.slice(-1)[0]]
    if (e == undefined) {
        notify("Please select a monomer to nick at")
        return
    }
    api.nick(e)
}

function ligateWrapper() {
    let ids = listBases.slice(-2);
    let e: BasicElement[] = [elements[ids[0]], elements[ids[1]]]
    if (e[0] == undefined || e[1] == undefined) {
        notify("Please select two monomers to ligate")
        return
    }
    api.ligate(e[0], e[1])
}

function extendWrapper() {
    let e: BasicElement = elements[listBases.slice(-1)[0]];
    let seq: string = (<HTMLInputElement>document.getElementById("extendSeq")).value;
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

function createWrapper() {
    let seq: string = (<HTMLInputElement>document.getElementById("extendSeq")).value;
    if (seq == "") {
        notify("Please type a sequence into the box");
        return
    }
    api.createStrand(seq);
}

function deleteWrapper() {
    let e: BasicElement[] = listBases.map(i => elements[i])
    clearSelection();
    if (e == []) {
        notify("Please select monomers to delete");
        return
    }
    api.del(e);
}