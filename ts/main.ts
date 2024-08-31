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
class ElementMap extends Map<number, BasicElement>{
    idCounter: number;

    constructor(){
        super();
        this.idCounter = 0;
    }

    // Avoid using this unless you really need to set
    // a specific id.
    set(id: number, element: BasicElement): this {
        if(this.idCounter < id+1){
            this.idCounter = id+1;
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
    push(e: BasicElement): number {
        e.id = this.idCounter++;
        super.set(e.id, e);
        return e.id;
    }
    /**
     * Remove element
     * @param id
     */
    delete(id: number): boolean {
        // If we delete the last added, we can decrease the id counter.
        if(this.idCounter == id+1){
            this.idCounter = id;
        }
        return super.delete(id);
    }

    getNextId(): number {
        return this.idCounter;
    }
}

class smartSet<Type> extends Set<Type> {
    last
    constructor(){
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
        this.last = value
        return super.delete(value)
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////                  oxView's global variables                 ////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

// Particle indexing stuff
const elements: ElementMap = new ElementMap(); //contains references to all BasicElements
const systems: System[] = [];  // contains references to all systems
const selectedBases = new smartSet<BasicElement>(); // contains the set of currently selected BasicElements
var clusterCounter = 0; //idk about this one...

// File reading stuff
var pdbtemp = []; // stores output from worker, so worker can terminate
const pdbFileInfo: pdbinfowrapper[] = []; //Stores all PDB Info (Necessary for future Protein Models)
const unfFileInfo: Record<string, any>[] = []; // Stores UNF file info (Necessary for writing out UNF files)
var confNum: number = 0; // Current configuration number in a trajectory
var box = new THREE.Vector3(); // Box size of the current scene

// BaseSelector stuff
var selectionMode = 'Monomer'

// ANM stuff
const networks: Network[] = []; // Only used for networks, replaced anms
var selectednetwork: number = 0; // Only used for networks
const graphDatasets: graphData[] = []; // Only used for fluctuation graph

// Forces stuff
var forces: Force[] = [];  // Can't be const because of the current implementation of removing forces.
var forcesTable: string[][] = [];
var forceHandler;

// color overlay stuff
var defaultColormap: string = "cooltowarm";
var lut, devs: number[];

// Editing stuff
const editHistory = new EditHistory(); // Track do/undo
var tmpSystems: System[] = [] // Track memory for newly created systems
var topologyEdited: Boolean = false; // to keep track of if the topology was edited at any point.

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
target.addEventListener("drop", function (event) {event.preventDefault();})
target.addEventListener("drop", handleDrop, false);

// Define message passing behavior
window.addEventListener("message", (event) => {
    if(event.data.message){ // do we have a message ?
        handleMessage(event.data);
    }
}, false);

render();

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////                      Random functions                      ////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

// These should probably be moved somewhere else...

function findBasepairs(min_length=0) {
    systems.forEach(system=>{
        if (!system.checkedForBasepairs) {
            system.strands.forEach(strand=>{
                if(strand.getLength() >= min_length ) 
                strand.forEach(e=>{
                    if (e instanceof Nucleotide) {
                        if(!e.pair) {
                            e.pair = e.findPair();
                            if(e.pair) {
                                e.pair.pair = e;
                            }
                        }
                    }
                });
            });
        }
        system.checkedForBasepairs = true;
    });
};

// Utility function to pick a random element from list
function randomChoice(l: any[]): any {
    return l[Math.floor(Math.random()*l.length)];
}

function findBasepairsOrigami(min_length=1000) {
    findBasepairs(min_length);
}

// Ugly hacks for testing
function getElements(): ElementMap {
    return elements;
}
function getSystems(): System[] {
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
function inIframe () {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

