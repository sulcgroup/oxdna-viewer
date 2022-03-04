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
class ElementMap extends Map {
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
}
// store rendering mode RNA  
var RNA_MODE = false; // By default we do DNA base spacing
// add base index visualistion
let elements = new ElementMap(); //contains references to all BasicElements
//initialize the space
const systems = [];
var tmpSystems = []; //used for editing
//const ANMs: ANM[] = [];
let forces = [];
let pdbtemp = []; // stores output from worker, so worker can terminate
var forcesTable = [];
var forceHandler;
var sysCount = 0;
var strandCount = 0;
var selectedBases = new Set();
var selectednetwork = 0; // Only used for networks
const networks = []; // Only used for networks, replaced anms
const graphDatasets = []; // Only used for fluctuation graph
const pdbFileInfo = []; //Stores all PDB Info (Necessary for future Protein Models)
var unfFileInfo = []; // Stores UNF file info (Necessary for writing out UNF files)
var lut, devs; //need for Lut coloring
const editHistory = new EditHistory();
let clusterCounter = 0; // Cluster counter
//to keep track of if the topology was edited at any point.
var topologyEdited = false;
//Check if there are files provided in the url (and load them if that is the case)
readFilesFromURLParams();
render();
// close to
function find_continues2() {
    let angle_tollerance = 0.8; // 25 degrees
    let distance_tollerance = 0.6; // 0.5 nm
    //find the acos value between two vectors
    let acos = (v1, v2) => v1.dot(v2) / (v1.length() * v2.length());
    let check = (n1, n2) => acos(n1.getA3(), n2.getA3()) > angle_tollerance &&
        n1.getA3().distanceTo(n2.getA3()) < distance_tollerance;
    let output = new Set(); // our output
    let output_bp = new Set();
    let start = ([...selectedBases][0]); // our starting point
    let n = start;
    output.add(n);
    // handle 3' end
    while (n.n3 && check(n, n.n3)) {
        n = n.n3;
        output.add(n);
    }
    let last_n3 = n;
    // handle 5' end
    n = start;
    while (n.n5 && check(n, n.n5)) {
        n = n.n5;
        output.add(n);
    }
    let last_n5 = n;
    //now we need to handle the last paired bases (their continuity)
    if (last_n3.pair) {
        n = last_n3.pair;
        // the possible continuity in 5' direction
        if (n.n5) {
            if (n.n5.isPaired() && n.n5.pair.strand == start.strand) {
                let our_found_end = n.n5.pair;
                //the direction of the continuity will be 3'
                n = our_found_end;
                output.add(n);
                // handle 3' end
                while (n.n3 && check(n, n.n3)) {
                    n = n.n3;
                    output.add(n);
                }
            }
        }
    }
    if (last_n5.pair) {
        n = last_n5.pair;
        // the possible continuity in 5' direction
        if (n.n3) {
            if (n.n3.isPaired() && n.n3.pair.strand == start.strand) {
                let our_found_end = n.n3.pair;
                //the direction of the continuity will be 3'
                n = our_found_end;
                output.add(n);
                // handle 5' end
                while (n.n5 && check(n, n.n5)) {
                    n = n.n5;
                    output.add(n);
                }
                let last_n5 = n;
            }
        }
    }
    if (last_n3.pair) {
        n = last_n3.pair;
        // the possible continuity in 5' direction
        if (n.n5) {
            if (n.n5.isPaired() && n.n5.pair.strand == start.strand) {
                let our_found_end = n.n5.pair;
                //the direction of the continuity will be 5'
                n = our_found_end;
                output.add(n);
                // handle 3' end
                while (n.n3 && check(n, n.n3)) {
                    n = n.n3;
                    output.add(n);
                }
                let last_n3 = n;
            }
        }
    }
    //// add all the pairs for the bases we have found
    output.forEach(n => {
        if (n.pair)
            output_bp.add(n.pair);
    });
    // now we still need to add the last baises of n5
    if (last_n5.pair) {
        n = last_n5.pair;
        // but we need to check into 5' direction
        while (n.n3 && check(n, n.n3)) {
            n = n.n3;
            output_bp.add(n);
        }
    }
    api.selectElements([...output]);
    api.selectElements([...output_bp], true);
    render();
}
var Direction;
(function (Direction) {
    Direction[Direction["threePrime"] = 0] = "threePrime";
    Direction[Direction["fivePrime"] = 1] = "fivePrime";
})(Direction || (Direction = {}));
function find_continues() {
    console.log("me here");
    let angle_tollerance = 0.8; // 25 degrees
    let distance_tollerance = 0.6; // 0.5 nm
    //find the acos value between two vectors
    let acos = (v1, v2) => v1.dot(v2) / (v1.length() * v2.length());
    let check = (n1, n2) => acos(n1.getA3(), n2.getA3()) > angle_tollerance &&
        n1.getA3().distanceTo(n2.getA3()) < distance_tollerance;
    let check_direction = (n, direction) => check(n, n.n3) && direction == Direction.threePrime || check(n, n.n5) && direction == Direction.fivePrime;
    let output = new Set(); // our output
    let output_bp = new Set();
    let start = ([...selectedBases][0]); // our starting point
    let n = start;
    let dir = Direction.threePrime;
    while (n) {
        output.add(n);
        if (dir == Direction.threePrime) {
            if (n.n3 && check_direction(n, dir)) {
                n = n.n3;
            }
            else {
                dir = Direction.fivePrime;
                n = n.pair;
            }
        }
        else {
            if (n.n5 && check_direction(n, dir)) {
                n = n.n5;
            }
            else {
                dir = Direction.threePrime;
                n = n.pair;
            }
        }
        if (output.has(n)) {
            break;
        }
    }
    n = start;
    dir = Direction.fivePrime;
    while (n) {
        output.add(n);
        if (dir == Direction.threePrime) {
            if (n.n3 && check_direction(n, dir)) {
                n = n.n3;
            }
            else {
                dir = Direction.fivePrime;
                n = n.pair;
            }
        }
        else {
            if (n.n5 && check_direction(n, dir)) {
                n = n.n5;
            }
            else {
                dir = Direction.threePrime;
                n = n.pair;
            }
        }
        if (output.has(n)) {
            break;
        }
    }
    //// and the bp's 
    output.forEach(n => { if (n.pair)
        output_bp.add(n.pair); });
    api.selectElements([...output]);
    api.selectElements([...output_bp], true);
    render();
}
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
function connectedSelectorWrapper() {
    let strands = new Set();
    let selected_nucleotides = [...selectedBases].filter(e => e instanceof Nucleotide);
    // go over our selection and recheck base pairing for every suspecious nucleotide
    selected_nucleotides.forEach(e => {
        if (e instanceof Nucleotide && !e.strand.system.checkedForBasepairs && !e.pair) {
            e.pair = e.findPair();
            if (e.pair) {
                e.pair.pair = e;
            }
        }
    });
    // decompose nucleotides into strands
    selected_nucleotides.forEach(p => {
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
