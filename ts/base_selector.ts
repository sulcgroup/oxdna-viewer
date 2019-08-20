
//let listBases: string = ""; //list of bases to download in .txt file
let listBases: number[] = []; //list of bases to download in .txt file
//let selList:number[] = [];
let basesInfo: string = ""; //list of bases' info - location, strand and system ids, etc. - to download in .txt file
// magic ... 
let mouse3D;
let raycaster = new THREE.Raycaster();;
let intersects;

//let gSelectedBases = [];
			

document.addEventListener('mousedown', event => { //if mouse is pressed down
	if (getActionModes().includes("Select")) {
		// magic ... 
		mouse3D = new THREE.Vector3((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1, //get mouse position
			0.5);
		// cast a ray from mose to viewpoint of camera 
		raycaster.setFromCamera(mouse3D, camera);
		// collect all objects that are in the way
		intersects = raycaster.intersectObjects(backbones);
		// make note of what's been clicked
		var nucleotide: BasicElement;
		let sys: System; 

        let scope_mode: string = scopeMode;
		if (intersects.length > 0) { //if something has been clicked / is in the intersects array / intersects array's length is above 0
			// hence we click only on nucleotides 
			// this section retrives info about the clicked object 
			// !!! this may change in the future 
			//nucleotideID = parseInt(intersects[0].object.parent.name); //get selected nucleotide's global id
            nucleotide = intersects[0].object.parent; //elements[nucleotideID];
			sys = nucleotide.parent.parent;
			
			// note: it is not enough to use the intersects[0].object.visible property %)
			if(!nucleotide.visible) return; // exclude invisible objects  
			
			switch(scope_mode){
				case "System" : 
					let strand_count = sys[strands].length;
					for (let i = 0; i <  strand_count; i++){  //for every strand in the System
						let strand = sys[strands][i];
						let nuc_count = strand[monomers].length;
                        for (let j = 0; j < nuc_count; j++) // for every nucleotide on the Strand in the System
                            strand[monomers][j].toggle();
					}
				break;
				case "Strand" :
					let strand_length = nucleotide.parent[monomers].length;
                    for (let i = 0; i < strand_length; i++)  //for every nucleotide in world
                        nucleotide.parent[monomers][i].toggle();
				break;
                case "Nuc":
                    nucleotide.toggle(); //toggle selected nucleotide
				break;

			}

			render(); //update scene;

            listBases = [];
			let baseInfoStrands = {};

			//sort selection info into respective containers 
			selected_bases.forEach(
				(base) => {
					//store global ids for BaseList view 
					listBases.push(base.global_id);

					//assign each of the selected bases to a strand 
					let strand_id = base.parent.strand_id;
					if(strand_id in baseInfoStrands)
						baseInfoStrands[strand_id].push(base);
					else
						baseInfoStrands[strand_id] = [base];
				}
			);

			//Display every selected nucleotide id (top txt box)
			makeTextArea(listBases.join(","), "BaseList");
			
			//Brake down info (low txt box)
			let baseInfoLines = [];
			for (let strand_id in baseInfoStrands){
				let s_bases = baseInfoStrands[strand_id];
				//make a fancy header for each strand
				let header = ["Str#:", strand_id, "Sys#:", s_bases[0].parent.parent.system_id];
				baseInfoLines.push("----------------------");
				baseInfoLines.push(header.join(" "));
				baseInfoLines.push("----------------------");
				
				//fish out all the required base info 
				//one could also sort it if neaded ...
				for(let i = 0; i < s_bases.length; i++){
					baseInfoLines.push(["gID:", s_bases[i].global_id, "|", "lID:", s_bases[i].local_id].join(" "));
				}
			}
			makeTextArea(baseInfoLines.join("\n"), "BaseInfo"); //insert basesInfo into "BaseInfo" text area
		}
	}
});

function makeTextArea(bases: string, id) { //insert "bases" string into text area with ID, id
	let textArea: HTMLElement | null = document.getElementById(id);
	if (textArea !== null) { //as long as text area was retrieved by its ID, id
		textArea.innerHTML =  bases; //set innerHTML / content to bases
	}
}

function writeMutTrapText(base1: number, base2: number): string { //create string to be inserted into mutual trap file
	return "{\n" + "type = mutual_trap\n" +
		"particle = " + base1 + "\n" +
		"ref_particle = " + base2 + "\n" +
		"stiff = 0.09\n" +
		"r0 = 1.2 \n" + 
		"PBC = 1" + "\n}\n\n";
}

function makeMutualTrapFile() { //make / allow download of mutual trap file
	let x: number, count: number = 0;
    let mutTrapText: string = "";
    for (x = 0; x < listBases.length; x = x + 2) { //for every selected nucleotide in listBases string
        if (listBases[x+1] !== undefined) { //if there is another nucleotide in the pair
            mutTrapText = mutTrapText + writeMutTrapText(listBases[x], listBases[x + 1]) + writeMutTrapText(listBases[x + 1], listBases[x]); //create mutual trap data for the 2 nucleotides in a pair - selected simultaneously
		}
		else { //if there is no 2nd nucleotide in the pair
			alert("The last selected base does not have a pair and thus cannot be included in the Mutual Trap File."); //give error message
		}
	}
	makeTextFile("mutTrapFile", mutTrapText); //after addding all mutual trap data, make mutual trap file
}

function makeSelectedBasesFile() { //make selected base file by addign listBases to text area
    makeTextFile("baseListFile", listBases.join(", "));
}

let textFile: string;
function makeTextFile(filename: string, text: string) { //take the supplied text and download it as filename
	let blob = new Blob([text], {type:'text'});
	var elem = window.document.createElement('a');
                elem.href = window.URL.createObjectURL(blob);
                elem.download = filename;
                document.body.appendChild(elem);
                elem.click();
                document.body.removeChild(elem);
};

function openTab(evt, tabName) { //open clicked tab - Idk how this works
	let i: number;
	let tabcontent;
	let tablinks;
	tabcontent = document.getElementsByClassName("tabcontent"); //get tab's content
	for (i = 0; i < tabcontent.length; i++) {
		tabcontent[i].style.display = "none";
	}
	tablinks = document.getElementsByClassName("tablinks");
	for (i = 0; i < tablinks.length; i++) {
		tablinks[i].className = tablinks[i].className.replace(" active", "");
	}
	let tab: HTMLElement | null = document.getElementById(tabName);
	if (tab !== null) {
		tab.style.display = "block";
	}
	evt.currentTarget.className += " active";
}

