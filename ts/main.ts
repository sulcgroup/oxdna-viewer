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
var sysCount: number = 0;
var strandCount: number = 0;
var selectedBases = new Set<BasicElement>();
var xbblast: number, ybblast:number, zbblast:number;

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

//toggles display of coloring by json file / structure modeled off of base selector
function coloringChanged() {
    if (getColoringMode() === "Overlay") {
        if (lut) {
            api.showColorbar();
        } else {
            notify("Please drag and drop the corresponding .json file.");
            setColoringMode("Strand");
            return;
        }
    } else if (lut) {
        api.removeColorbar();
    }

    elements.forEach(e => e.updateColor());
    systems.forEach(s => s.callUpdates(['instanceColor']));

    if (tmpSystems.length > 0) {
        tmpSystems.forEach(s => s.callUpdates(['instanceColor']));
    }
    render();
}

function getColoringMode(): string {
    return document.querySelector('input[name="coloring"]:checked')['value'];
}

function setColoringMode(mode: string) {
    const modes = <NodeListOf<HTMLInputElement>>document.getElementsByName("coloring");
    for (let i = 0; i < modes.length; i++) {
        modes[i].checked = (modes[i].value === mode);
    }
    coloringChanged();
};

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

function cross(a1, a2, a3, b1, b2, b3) { //calculate cross product of 2 THREE.Vectors but takes coordinates as (x,y,z,x1,y1,z1)
    return [a2 * b3 - a3 * b2,
    a3 * b1 - a1 * b3,
    a1 * b2 - a2 * b1];
}

function det(mat:number[][]){ //calculate and return matrix's determinant
	return (mat[0][0] * ((mat[1][1]*mat[2][2]) - (mat[1][2]*mat[2][1]))  - mat[0][1] * ((mat[1][0]*mat[2][2]) -
		(mat[2][0]*mat[1][2])) + mat[0][2] * ((mat[1][0]*mat[2][1]) - (mat[2][0]*mat[1][1])));
}

function dot(x1:number,y1:number,z1:number,x2:number,y2:number,z2:number){ //calculate and return dot product of matrix given by list of vector positions
	return x1*x2 + y1*y2 + z1*z2;
}
function divAndNeg(mat:number[],divisor:number){ //divide a matrix by divisor; negate matrix
	return [-mat[0]/divisor, -mat[1]/divisor, -mat[2]/divisor];
}