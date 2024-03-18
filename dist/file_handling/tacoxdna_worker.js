importScripts('../../ts/lib/three.js');
var tacoxdna; // Make typescript happy
importScripts('../../ts/lib/tacoxdna.js');
// Only show options for the selected input format
function toggleInputOpts(value) {
    document.getElementById('importCadnanoOpts').hidden = value !== 'cadnano';
    document.getElementById('importRpolyOpts').hidden = value !== 'rpoly';
    document.getElementById('importTiamatOpts').hidden = value !== 'tiamat';
}
// Try to guess format from file ending
function guessInputFormat(files) {
    let from = document.getElementById('importFromSelect');
    for (const f of files) {
        if (f.name.endsWith('.rpoly')) {
            from.value = 'rpoly';
            break;
        }
        else if (f.name.endsWith('.json')) {
            from.value = 'cadnano';
            break;
        }
        else if (f.name.endsWith('.dnajson')) {
            from.value = 'tiamat';
            break;
        }
        else if (f.name.endsWith('.dna')) {
            Metro.infobox.create("<h3>It looks like you are trying to import a tiamat .dna file</h3>Please first open it in Tiamat and export it as .dnajson, which you can then import here.", "alert");
        }
    }
    toggleInputOpts(from.value);
}
onmessage = function (e) {
    const [files, from, to, opts] = e.data;
    const result = tacoxdna.convertFromTo(files, from, to, opts);
    postMessage(result, undefined);
};
