function nickWrapper() {
    let e = elements[listBases.slice(-1)[0]];
    if (e == undefined) {
        notify("Please select a monomer to nick at");
        return;
    }
    api.nick(e);
}
function ligateWrapper() {
    let ids = listBases.slice(-2);
    let e = [elements[ids[0]], elements[ids[1]]];
    if (e[0] == undefined || e[1] == undefined) {
        notify("Please select two monomers to ligate");
        return;
    }
    api.ligate(e[0], e[1]);
}
function extendWrapper() {
    let e = elements[listBases.slice(-1)[0]];
    let seq = document.getElementById("extendSeq").value;
    if (e == undefined) {
        notify("Please select a monomer to extend from");
        return;
    }
    api.extendStrand(e, seq);
}
function createWrapper() {
}
function deleteWrapper() {
}
