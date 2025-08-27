/// <reference path="./typescript_definitions/index.d.ts" />
/// <reference path="./typescript_definitions/oxView.d.ts" />
/*
Hello my dear snooper, welcome to the source code for oxView!
I assume if you're reading this file, you're probably either a developer or looking for something in the code.
The main file here isn't super helpful at explaining what's going on, so I will try to give you a bit of a roadmap here.
main contains a few definitions of functions and data structures that the rest of the code uses.  Also a few functions that don't have a home yet.
The canvas, camera, renderer, periodic boundary condition handler and shader code can be found in the scene folder.
The file reading code, including the event listeners that handle drag/drop events are in file_handling
There you can also find the output options, including oxDNA files and videos.
Controls contains slightly modified stock Three.js control schemes.  These handle moving the camera and dragging objects.
Api and editing have most of the functions that let you control how things look and edit the actual structure.
Everything in the api can be called through the browser console by typing <apiName>.function(arguments) if you want to script some edits or visuals.
UI has all the functions relating to things that happen when you press buttons or hit the keyboard.
lib contains three.js and associated files.
typescript_definitions contains references between files to keep typescript editors happy.

If you add new files to your own copy of the viewer, you need to add it to tsconfig.json so the compiler knows to compile it.
The .js file will then appear in dist and you must add it to the script list at the bottom of index.html before it will take effect.

If you have any questions, feel free to open an issue on the GitHub page.
*/
// The ElementMap provies a mapping between particle ID in the simulation and JS objects here
class ElementMap extends Map {
    idCounter;
    constructor() {
        super();
        this.idCounter = 0;
    }
    // Avoid using this unless you really need to set
    // a specific id.
    set(id, element) {
        if (this.idCounter < id + 1) {
            this.idCounter = id + 1;
        }
        // Reading oxDNA files we set elements as undefined for
        // concurrency issues
        if (element) {
            element.id = id;
        }
        return super.set(id, element);
    }
    /**
     * Add an element, keeping track of
     * global id
     * @param element
     * @returns id
     */
    push(e) {
        e.id = this.idCounter++;
        super.set(e.id, e);
        return e.id;
    }
    /**
     * Remove element
     * @param id
     */
    delete(id) {
        // If we delete the last added, we can decrease the id counter.
        if (this.idCounter == id + 1) {
            this.idCounter = id;
        }
        return super.delete(id);
    }
    getNextId() {
        return this.idCounter;
    }
    reset() {
        this.clear();
        this.idCounter = 0;
    }
}
class smartSet extends Set {
    last;
    constructor() {
        super();
        this.last = undefined;
    }
    /**
     * Add an element to the set and remember the last added element
     * @param value
     * @returns void
     */
    add(value) {
        this.last = value;
        return super.add(value);
    }
    /**
     * Delete an element from the set and forget it if it was the last element added.
     * @param value
     * @returns
     */
    delete(value) {
        this.last = value;
        return super.delete(value);
    }
}
///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////                  oxView's global variables                 ////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
// Particle indexing stuff
const elements = new ElementMap(); //contains references to all BasicElements
const systems = []; // contains references to all systems
const selectedBases = new smartSet(); // contains the set of currently selected BasicElements
var clusterCounter = 0; //idk about this one...
// File reading stuff
var pdbtemp = []; // stores output from worker, so worker can terminate
const pdbFileInfo = []; //Stores all PDB Info (Necessary for future Protein Models)
const unfFileInfo = []; // Stores UNF file info (Necessary for writing out UNF files)
var confNum = 0; // Current configuration number in a trajectory
var box = new THREE.Vector3(); // Box size of the current scene
// BaseSelector stuff
var selectionMode = 'Monomer';
// ANM stuff
const networks = []; // Only used for networks, replaced anms
var selectednetwork = 0; // Only used for networks
const graphDatasets = []; // Only used for fluctuation graph
// Forces stuff
var forceHandler = new ForceHandler();
// color overlay stuff
var defaultColormap = "cooltowarm";
var lut, devs;
// Editing stuff
const editHistory = new EditHistory(); // Track do/undo
var tmpSystems = []; // Track memory for newly created systems
var topologyEdited = false; // to keep track of if the topology was edited at any point.
function resetScene(resetCamera = true) {
    elements.reset();
    while (systems.length > 0) {
        systems[systems.length - 1].backbone.parent.remove(systems[systems.length - 1].backbone);
        systems[systems.length - 1].nucleoside.parent.remove(systems[systems.length - 1].nucleoside);
        systems[systems.length - 1].connector.parent.remove(systems[systems.length - 1].connector);
        systems[systems.length - 1].bbconnector.parent.remove(systems[systems.length - 1].bbconnector);
        systems[systems.length - 1].dummyBackbone.parent.remove(systems[systems.length - 1].dummyBackbone);
        systems.pop();
    }
    while (tmpSystems.length > 0) {
        tmpSystems[tmpSystems.length - 1].backbone.parent.remove(tmpSystems[tmpSystems.length - 1].backbone);
        tmpSystems[tmpSystems.length - 1].nucleoside.parent.remove(tmpSystems[tmpSystems.length - 1].nucleoside);
        tmpSystems[tmpSystems.length - 1].connector.parent.remove(tmpSystems[tmpSystems.length - 1].connector);
        tmpSystems[tmpSystems.length - 1].bbconnector.parent.remove(tmpSystems[tmpSystems.length - 1].bbconnector);
        tmpSystems[tmpSystems.length - 1].dummyBackbone.parent.remove(tmpSystems[tmpSystems.length - 1].dummyBackbone);
        tmpSystems.pop();
    }
    selectedBases.clear();
    clusterCounter = 0; //idk about this one...
    // File reading stuff
    pdbtemp = []; // stores output from worker, so worker can terminate
    while (pdbFileInfo.length > 0) {
        pdbFileInfo.pop();
    }
    while (unfFileInfo.length > 0) {
        unfFileInfo.pop();
    }
    confNum = 0; // Current configuration number in a trajectory
    box = new THREE.Vector3(); // Box size of the current scene
    // BaseSelector stuff
    selectionMode = 'Monomer';
    // ANM stuff
    while (networks.length > 0) {
        networks.pop();
    }
    while (graphDatasets.length > 0) {
        graphDatasets.pop();
    }
    selectednetwork = 0; // Only used for networks
    // Forces stuff
    forceHandler.clearForcesFromScene();
    forceHandler = new ForceHandler();
    if (document.getElementById("forces")) {
        listForces();
    }
    // color overlay stuff
    if (colorbarScene.children.length > 0) {
        // copy-paste of removeColorbar to avoid circular imports
        let l = colorbarScene.children.length;
        for (let i = 0; i < l; i++) {
            if (colorbarScene.children[i].type == "Sprite" || colorbarScene.children[i].type == "Line") {
                colorbarScene.remove(colorbarScene.children[i]);
                i -= 1;
                l -= 1;
            }
        }
        colorbarScene.remove(lut.legend.mesh);
        //reset light to default
        pointlight.intensity = 1.1;
        renderColorbar();
    }
    defaultColormap = "cooltowarm";
    lut = undefined;
    devs = [];
    // Editing stuff
    editHistory.clear();
    tmpSystems = [];
    topologyEdited = false;
    if (resetCamera) {
        controls.reset();
    }
    render();
}
///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////                       File input                           ////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
//Check if there are files provided in the url (and load them if that is the case)
readFilesFromURLParams();
// define the drag and drop behavior of the scene
const target = renderer.domElement;
target.addEventListener("dragover", function (event) {
    event.preventDefault();
    target.classList.add('dragging');
}, false);
target.addEventListener("dragenter", function (event) {
    event.preventDefault();
    target.classList.add('dragging');
}, false);
target.addEventListener("dragexit", function (event) {
    event.preventDefault();
    target.classList.remove('dragging');
}, false);
// What to do if a file is dropped
target.addEventListener("drop", function (event) { event.preventDefault(); });
target.addEventListener("drop", handleDrop, false);
// Define message passing behavior
window.addEventListener("message", (event) => {
    if (event.data.message) { // do we have a message ?
        handleMessage(event.data);
    }
}, false);
render();
///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////                      Random functions                      ////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
// These should probably be moved somewhere else...
function findBasepairs(min_length = 0) {
    systems.forEach(system => {
        if (!system.checkedForBasepairs) {
            system.strands.forEach(strand => {
                if (strand.getLength() >= min_length)
                    strand.forEach(e => {
                        if (e instanceof Nucleotide) {
                            if (!e.pair) {
                                e.pair = e.findPair();
                                if (e.pair) {
                                    e.pair.pair = e;
                                }
                            }
                        }
                    });
            });
        }
        system.checkedForBasepairs = true;
    });
}
;
// Utility function to pick a random element from list
function randomChoice(l) {
    return l[Math.floor(Math.random() * l.length)];
}
function findBasepairsOrigami(min_length = 1000) {
    findBasepairs(min_length);
}
// Ugly hacks for testing
function getElements() {
    return elements;
}
function getSystems() {
    return systems;
}
//Temporary solution to adding configuration storage
//This section sets interface values from the storage 
if (window.sessionStorage.centerOption) {
    view.centeringMode.set(window.sessionStorage.centerOption);
}
if (window.sessionStorage.inboxingOption) {
    view.inboxingMode.set(window.sessionStorage.inboxingOption);
}
//https://stackoverflow.com/questions/326069/how-to-identify-if-a-webpage-is-being-loaded-inside-an-iframe-or-directly-into-t
function inIframe() {
    try {
        return window.self !== window.top;
    }
    catch (e) {
        return true;
    }
}
