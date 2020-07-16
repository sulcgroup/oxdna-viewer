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


class ElementMap extends Map<number, BasicElement>{
    gidCounter: number;

    constructor(){
        super();
        this.gidCounter = 0;
    }

    // Avoid using this unless you really need to set
    // a specific gid.
    set(gid: number, element: BasicElement): this {
        if(this.gidCounter < gid+1){
            this.gidCounter = gid+1;
        }
        // Reading oxDNA files we set elements as undefined for
        // concurrency issues
        if (element) {
            element.gid = gid;
        }
        return super.set(gid, element);
    }

    /**
     * Add an element, keeping track of
     * global id
     * @param element
     * @returns gid
     */
    push(e: BasicElement): number {
        e.gid = this.gidCounter++;
        super.set(e.gid, e);
        return e.gid;
    }
    /**
     * Remove element
     * @param gid
     */
    delete(gid: number): boolean {
        // If we delete the last added, we can decrease the gid counter.
        if(this.gidCounter == gid+1){
            this.gidCounter = gid;
        }
        return super.delete(gid);
    }

    getNextId(): number {
        return this.gidCounter;
    }
}

// store rendering mode RNA  
var RNA_MODE = false; // By default we do DNA base spacing

// add base index visualistion
let elements: ElementMap = new ElementMap(); //contains references to all BasicElements

//initialize the space
const systems: System[] = [];
var tmpSystems: System[] = [] //used for editing
const ANMs: ANM[] = [];
const forces: Force[] = [];
var forceHandler;
var sysCount: number = 0;
var strandCount: number = 0;
var selectedBases = new Set<BasicElement>();
var bbLast: THREE.Vector3;

var lut, devs: number[]; //need for Lut coloring

const DNA: number = 0;
const RNA: number = 1;
const AA: number = 2;

const editHistory = new EditHistory();
let clusterCounter = 0 // Cluster counter

//to keep track of if the topology was edited at any point.
var topologyEdited: Boolean = false;

//Check if there are files provided in the url (and load them if that is the case)
readFilesFromURLParams();

render();

function findBasepairs() {
    elements.forEach(e => {
        if (e instanceof Nucleotide) {
            if(!e.pair) {
                e.pair = e.findPair();
                if(e.pair) {
                    e.pair.pair = e;
                }
            }
        }
    });
};

//Temporary solution to adding configuration storage
//This section sets interface values from the storage 
if (window.sessionStorage.centerOption) {
    view.centeringMode.set(window.sessionStorage.centerOption);
}
if (window.sessionStorage.inboxingOption) {
    view.inboxingMode.set(window.sessionStorage.inboxingOption);
}


