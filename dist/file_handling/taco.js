/// <reference path="../typescript_definitions/index.d.ts" />
// helper code for the TACOxDNA importer -----
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
// TacoxDNA importer
function importFiles(files) {
    let from = document.getElementById("importFromSelect").value;
    let to = 'oxview';
    let opts = {};
    let progress = document.getElementById("importProgress");
    progress.hidden = false;
    let cancelButton = document.getElementById("importFileDialogCancel");
    document.body.style.cursor = "wait";
    if (from === "cadnano") {
        opts = {
            grid: document.getElementById("importCadnanoLatticeSelect").value,
            sequence: document.getElementById("importCadnanoScaffoldSeq").value,
            default_val: document.getElementById("importCadnanoDefaultVal").value
        };
    }
    else if (from === "rpoly") {
        opts = {
            sequence: document.getElementById("importRpolyScaffoldSeq").value
        };
    }
    else if (from === "tiamat") {
        opts = {
            tiamat_version: parseInt(document.getElementById("importTiamatVersion").value),
            isDNA: document.getElementById("importTiamatIsDNA").value == "DNA",
            default_val: document.getElementById("importTiamatDefaultVal").value
        };
    }
    console.log(`Converting ${[...files].map(f => f.name).join(',')} from ${from} to ${to}.`);
    let readFiles = new Map();
    for (const file of files) {
        const reader = new FileReader();
        reader.onload = function (evt) {
            readFiles.set(file, evt.target.result);
            console.log(`Finished reading ${readFiles.size} of ${files.length} files`);
            if (readFiles.size === files.length) {
                var worker = new Worker('./dist/file_handling/tacoxdna_worker.js');
                let finished = () => {
                    progress.hidden = true;
                    Metro.dialog.close('#importFileDialog');
                    document.body.style.cursor = "auto";
                };
                worker.onmessage = (e) => {
                    let converted = e.data;
                    parseOxViewString(converted); //I am not sure this is right
                    console.log('Conversion finished');
                    finished();
                };
                worker.onerror = (error) => {
                    console.log('Error in conversion');
                    notify(error.message, "alert");
                    finished();
                };
                cancelButton.onclick = () => {
                    worker.terminate();
                    console.log('Conversion aborted');
                    finished();
                };
                worker.postMessage([[...readFiles.values()], from, to, opts]);
            }
        };
        reader.readAsText(file);
    }
}
//-------------------------------
