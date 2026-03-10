importScripts("../../ts/lib/three.js")
importScripts("../model/basicElement.js")
importScripts("../model/nucleotide.js")
importScripts("../model/aminoAcid.js")
importScripts("../model/DNA.js")
importScripts("../model/RNA.js")
importScripts("../model/strand.js")
importScripts("../model/system.js")
importScripts('./pdb_lib.js');
importScripts('./mmcif_lib.js');

this.onmessage = function(e) {
    let mmcifText       = e.data[0];
    let pdbFileInfoIndx = e.data[1];
    let elemIndx        = e.data[2];

    let pdata = parseMMCIF(mmcifText);
    if (pdata === null) {
        postMessage([], undefined);
        return;
    }
    let ret = addPDBToScene(pdata, pdbFileInfoIndx, elemIndx);
    mmcifText = undefined;
    pdata = undefined;
    postMessage(ret, undefined);
}
