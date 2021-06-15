importScripts('../../ts/lib/three.js');
var tacoxdna; // Make typescript happy
importScripts('../../ts/lib/tacoxdna.js');

onmessage = function(e) {
    const [files, from, to, opts] = e.data;
    const result = tacoxdna.convertFromTo(files, from, to, opts);
    postMessage(result, undefined);
}