function makeOutputFiles() { //makes .dat and .top files with update position information; includes all systems as 1 system
    let name = (<HTMLInputElement>document.getElementById("outputFilename")).value;
    let top = <NodeListOf<HTMLInputElement>>document.getElementsByName("topDownload");
    let reorganized, counts
    if (top[0].checked == true) {
        let {a, b} = makeTopFile(name);
        reorganized = a;
        counts = b;
    }
    else if (systems.length > 1 || topologyEdited) {
        notify("You have edited the topology of the scene, a new topology file must be generated");
        return
    }
    let dat = <NodeListOf<HTMLInputElement>>document.getElementsByName("datDownload");
    if (dat[0].checked == true) {
        makeDatFile(name, reorganized);	
    }

    if (ANMs.length > 0) {
        makeParFile(name, reorganized, counts);
    }
}



function makeSTLOutput(){ //makes stl export from the scene 
    const name = (<HTMLInputElement>document.getElementById("outputSTLFilename")).value;
    
    const include_backbone = (<NodeListOf<HTMLInputElement>>document.getElementsByName("includeBackbone"))[0].checked;
    const include_nucleoside = (<NodeListOf<HTMLInputElement>>document.getElementsByName("includeNucleoside"))[0].checked;
    const include_connector = (<NodeListOf<HTMLInputElement>>document.getElementsByName("includeConnector"))[0].checked;
    const include_bbconnector = (<NodeListOf<HTMLInputElement>>document.getElementsByName("includeBBconnector"))[0].checked;
    
    const faces_mul = parseFloat((<HTMLInputElement>document.getElementById("facesMul")).value);
    const stl_scale = parseFloat((<HTMLInputElement>document.getElementById("stlScale")).value);

    
    saveSTL(name, include_backbone, include_nucleoside, include_connector, include_bbconnector, stl_scale, faces_mul);   
}


function makeTopFile(name){
    const top: string[] = []; //string of contents of .top file

    let proteinMode: Boolean = false
    let peptides = []
    let nas = []

    //figure out if there are any proteins in the system
    systems.forEach(system => {
        system.strands.forEach(strand => {
            if (strand.getType() == Peptide.name) {
                proteinMode = true;
                peptides.push(strand);
            }
            else {
                nas.push(strand)
            }
        });
    });

    const newStrandIds = new Map();
    const newElementIds = new Map();

    let totParticles = 0;
    let totStrands = 0;
    let firstLine;

    //remove any gaps in the particle numbering
    if (!proteinMode) {
        peptides = undefined;
        nas = undefined;

        let totNuc: number = 0; //total # of elements
        let totNucleic: number = 0; //total # of strands
    
        let sidCounter = 1;    
        let gidCounter = 0;

        systems.forEach(system =>{
            totNucleic += system.strands.length; // Count strands
            system.strands.forEach((strand: Strand) => {
                newStrandIds.set(strand, sidCounter++); //Assign new strandID
                totNuc += strand.monomers.length; // Count elements
                strand.monomers.forEach(e => {
                    newElementIds.set(e, gidCounter++); //Assign new elementID
                });
            });
        });
        totParticles = totNuc;
        totStrands = totNucleic;
        firstLine = [totParticles, totStrands]

    }
    else { //have to rebuild the system to keep all proteins contiguous or else oxDNA will segfault
        let totNuc = 0;
        let totAA = 0;
        let totNucleic = 0;
        let totPeptide = 0;

        let sidCounter = -1;
        let gidCounter = 0;

        peptides.forEach(strand =>{
            newStrandIds.set(strand, sidCounter--);
            totPeptide += 1
            totParticles += strand.monomers.length;
            totAA += strand.monomers.length;
            strand.monomers.forEach(e => {
                newElementIds.set(e, gidCounter++);
            });
        });

        sidCounter = 1;
        nas.forEach(strand => {
            newStrandIds.set(strand, sidCounter++);
            totNucleic += 1;
            totParticles += strand.monomers.length;
            totNuc += strand.monomers.length;
            strand.monomers.forEach(e => {
                newElementIds.set(e, gidCounter++);
            });
        });

        totParticles = totNuc + totAA;
        totStrands = totPeptide + totNucleic;
        firstLine = [totParticles, totStrands, totNuc, totAA, totNucleic]
    }

    top.push(firstLine.join(" "))

    if (totParticles != elements.size) {
        notify(`Length of totNuc (${totParticles}) is not equal to length of elements array (${elements.size})`);
    }

    //needs to be updated to dereference anm connections
    newElementIds.forEach((_gid, e) => { //for each nucleotide
        let neighbor3 = e.neighbor3 ? newElementIds.get(e.neighbor3) : -1;
        let neighbor5 = e.neighbor5 ? newElementIds.get(e.neighbor5) : -1;

        top.push([newStrandIds.get(e.strand), e.type, neighbor3, neighbor5].join(' '));
    });
    makeTextFile(name+".top", top.join("\n")); //make .top 

    //this is absolute abuse of ES6 and I feel a little bad about it
    return {a: newElementIds, b: firstLine};
}
function makeDatFile(name, altNumbering=undefined) {
    // Get largest absolute coordinate:
    let maxCoord = 0;
    elements.forEach(e => { //for all elements
        let p = e.getInstanceParameter3("cmOffsets");
        maxCoord = Math.max(maxCoord, Math.max(
            Math.abs(p.x),
            Math.abs(p.y),
            Math.abs(p.z)
        ))
    });
    let dat: string = "";
    let box: number = Math.ceil(6 * maxCoord);
    dat = [
        `t = 0`,
        `b = ${box} ${box} ${box}`,
        `E = 0 0 0\n`
    ].join('\n');

    // get coordinates for all elements, in the correct order
    if (altNumbering) {
        altNumbering.forEach((_gid, e) => {
            dat += e.getDatFileOutput();
        });
    }
    else {
        systems.forEach(system =>{
            system.strands.forEach((strand: Strand) => {
                strand.monomers.forEach(e => {
                    dat += e.getDatFileOutput();
                });
            });
        });
    }

    makeTextFile(name+".dat", dat); //make .dat file
}

function makeParFile(name: string, altNumbering, counts) {
    const par: string[] = [];
    par.push(counts[3]);

    ANMs.forEach ((anm: ANM) => {
        //ANMs can be huge so we need to use a traditional for loop here
        const l = anm.children.length
        console.log(anm.children[0]);
        for (let i = 0; i < l; i++) {
            const curCon = anm.children[i]
            const p1ID: number = altNumbering.get(curCon.p1);
            const p2ID: number = altNumbering.get(curCon.p2);

            const line = [p1ID, p2ID, curCon.eqDist, curCon.type, curCon.strength];
            par.push(line.join(" "));
        } 
    });

    makeTextFile(name+".par", par.join('\n'));
}

function writeMutTrapText(base1: number, base2: number): string { //create string to be inserted into mutual trap file
	return "{\n" + "type = mutual_trap\n" +
		"particle = " + base1 + "\n" +
		"ref_particle = " + base2 + "\n" +
		"stiff = 0.09\n" +
		"r0 = 1.2 \n" + 
		"PBC = 1" + "\n}\n\n";
}

function makeMutualTrapFile() { //make download of mutual trap file from selected bases
    let mutTrapText: string = "";
    for (let x = 0; x < listBases.length; x = x + 2) { //for every selected nucleotide in listBases string
        if (listBases[x+1] !== undefined) { //if there is another nucleotide in the pair
            mutTrapText = mutTrapText + writeMutTrapText(listBases[x], listBases[x + 1]) + writeMutTrapText(listBases[x + 1], listBases[x]); //create mutual trap data for the 2 nucleotides in a pair - selected simultaneously
		}
		else { //if there is no 2nd nucleotide in the pair
			notify("The last selected base does not have a pair and thus cannot be included in the Mutual Trap File."); //give error message
		}
	}
	makeTextFile("mutTrapFile", mutTrapText); //after addding all mutual trap data, make mutual trap file
}

function makePairTrapFile() {
    let write = () => {
        let mutTrapText: string = "";
        elements.forEach(e=>{
            // If element is paired, add a trap
            if (e.isPaired()) {
                mutTrapText += writeMutTrapText(
                    e.gid, (e as Nucleotide).pair.gid
                );
            }
        });
        makeTextFile("pairTrapFile", mutTrapText); //after addding all mutual trap data, make mutual trap file
    }
    // Find out if we have calculated pairs already
    let pairsCalculated = false;
    for (let element of elements) {
        if (element[1].isPaired()) {
            pairsCalculated = true;
            break;
        }
    }
    if (!pairsCalculated) {
        longCalculation(findBasepairs, basepairMessage, write);
    } else {
        write();
    }
}

function makeSelectedBasesFile() { //make selected base file by addign listBases to text area
    makeTextFile("baseListFile", listBases.join(" "));
}

function makeSequenceFile() {
    let seqTxts = [];
    systems.forEach((sys: System)=>{
        sys.strands.forEach((strand: Strand)=>{
            let label = strand.label ? strand.label : `strand_${strand.strandID}`;
            seqTxts.push(`${label}, ${api.getSequence(strand.monomers)}`);
      })
    });
    makeTextFile("sequences.csv", seqTxts.join("\n"));
}

function makeOxViewJsonFile(space?: string | number) {
    makeTextFile("output.oxview", JSON.stringify({
        date: new Date(),
        box: box.toArray(),
        systems: systems
    }, null, space));
}

//let textFile: string;
function makeTextFile(filename: string, text: string) { //take the supplied text and download it as filename
    let blob = new Blob([text], {type:'text'});
    var elem = window.document.createElement('a'); //
    elem.href = window.URL.createObjectURL(blob); //
    elem.download = filename; //
    document.body.appendChild(elem); //
    elem.click(); //
    document.body.removeChild(elem); //
    //window.parent.FakeDataDownload(blob, filename);
};