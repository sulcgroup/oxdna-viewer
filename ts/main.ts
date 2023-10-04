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

// store rendering mode RNA  
var RNA_MODE = false; // By default we do DNA base spacing

// add base index visualistion
let elements: ElementMap = new ElementMap(); //contains references to all BasicElements

//initialize the space
const systems: System[] = [];
var tmpSystems: System[] = [] //used for editing
//const ANMs: ANM[] = [];
let forces: Force[] = [];
let pdbtemp = []; // stores output from worker, so worker can terminate
var forcesTable: string[][] = [];
var forceHandler;
var sysCount: number = 0;
var strandCount: number = 0;
var selectedBases = new Set<BasicElement>();

var selectednetwork: number = 0; // Only used for networks
const networks: Network[] = []; // Only used for networks, replaced anms
const graphDatasets: graphData[] = []; // Only used for fluctuation graph
const pdbFileInfo: pdbinfowrapper[] = []; //Stores all PDB Info (Necessary for future Protein Models)
var unfFileInfo: Record<string, any>[] = []; // Stores UNF file info (Necessary for writing out UNF files)

var lut, devs: number[]; //need for Lut coloring

const editHistory = new EditHistory();
let clusterCounter = 0; // Cluster counter

//to keep track of if the topology was edited at any point.
var topologyEdited: Boolean = false;

//Check if there are files provided in the url (and load them if that is the case)
readFilesFromURLParams();

render();

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

function colorSelectorWrapper(){
    let colors = new Set();
    //go through selectedBases and fetch our reference colors
    selectedBases.forEach(b =>{
        if(b.color)
            colors.add(b.color.getHex());
    });
    console.log(colors);
    const match_color = (b:Nucleotide)=>{
      if(b.color)
        return colors.has(b.color.getHex());
      return false;
    };
    let toSelect= [];
    systems.forEach(system=>{
        system.strands.forEach(strand=>{
            strand.filter(match_color).forEach(b=>toSelect.push(b));
        });
    });
    tmpSystems.forEach(system=>{
        system.strands.forEach(strand=>{
            strand.filter(match_color).forEach(b=>toSelect.push(b));
        });
    });
    api.selectElements(toSelect);
    render();
}

function connectedSelectorWrapper():void{
    let strands = new Set<Strand>();
    let selected_nucleotides  = [... selectedBases].filter(e=>e instanceof Nucleotide);
    // go over our selection and recheck base pairing for every suspecious nucleotide
    selected_nucleotides.forEach(e =>{
        if(e instanceof Nucleotide && !e.strand.system.checkedForBasepairs && !e.pair) {
            e.pair = e.findPair();
                if(e.pair) {
                    e.pair.pair = e;
            }
        }
    });
    // decompose nucleotides into strands
    selected_nucleotides.forEach(p  =>{
        if (p instanceof Nucleotide && p.pair)
            strands.add(p.pair.strand);
    });
    // now we have all the strands that are making up the selected bases
    // if we don't have base pairs in the fist strand, we have to search for pairs
    strands.forEach(strand => {
        strand.forEach(p => p.select());
    });
    //update the visuals 
    systems.forEach(updateView);
    tmpSystems.forEach(updateView);
    
}



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

