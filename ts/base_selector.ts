
let listBases: string = ""; //list of bases to download in .txt file
let selList:number[] = [];
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
		let nucleotideID: number;
		var nucleotide: Nucleotide;
		let sys: System; 
		let sysID:number, strandID:number;	

		let scope_mode : string = getScopeMode();
		if (intersects.length > 0) { //if something has been clicked / is in the intersects array / intersects array's length is above 0
			// hence we click only on nucleotides 
			// this section retrives info about the clicked object 
			// !!! this may change in the future 
			nucleotideID = parseInt(intersects[0].object.parent.name); //get selected nucleotide's global id
			nucleotide = nucleotides[nucleotideID];
			sys = nucleotide.parent.parent;
			
			//nucleotide.my_strand
			//strandID = nucleotides[nucleotideID].my_strand; //get selected nucleotide's strand id
			//sysID = nucleotides[nucleotideID].my_system; //get selected nucleotide's system id
			
			switch(scope_mode){
				case "System" : 
					let strand_count = sys.strands.length;
					for (let i = 0; i <  strand_count; i++){  //for every strand in the System
						let strand = sys.strands[i];
						let nuc_count = strand.nucleotides.length;
						for(let j = 0; j < nuc_count; j++) // for every nucleotide on the Strand in the System
							toggle(strand.nucleotides[j]);
					}
				break;
				case "Strand" :
					let strand_length = nucleotide.parent.nucleotides.length;
					for (let i = 0; i < strand_length; i++)  //for every nucleotide in world
						toggle(nucleotide.parent.nucleotides[i]);
				break;
				case "Nuc":
					toggle(nucleotide); //toggle selected nucleotide
				break;

			}

			render(); //update scene;
			
			////Hack to get the selection done in the right order 
			//gSelectedBases.push(nucleotideID);

			//listBases = ""; //reset list of selected bases
			//for (let x: number = 0; x < selected_bases.length; x++) { //for all nucleotides in system/selected_bases array
			//	if (selected_bases[x] == 1) //if nucleotide is selected
			//		listBases = listBases + x + "\n"; //add nucleotide's global id to listBases - list of selected bases
			//}

			//basesInfo = ""; //reset list of selected bases' info
			//let sysPrint: number[] = [], strandPrint: number[] = [], sys, strand; //sysPrint - array of numbers with system ids that have been listed in basesInfo; strandPrint - array of numbers with strand ids that have been listed in basesInfo
			//for (let x: number = 0; x < selected_bases.length; x++) { //for every nucleotide in world / selected_bases array
			//	if (selected_bases[x] == 1) { //if nucleotide is selected
			//		let temp = nucleotides[x]; //get Nucleotide object
			//		sys = temp.my_system; //get nucleotide's system
			//		strand = temp.my_strand - 1; //get nucleotide's strand
			//		if (sysPrint.indexOf(sys) < 0) { //if system id is not already in sysPrint array
			//			basesInfo += "SYSTEM:\n" + //add system's information to basesInfo
			//				"System ID: " + sys + "\n" +
			//				"# of Strands: " + systems[sys].strands.length + "\n" +
			//				"# of Nucleotides: " + systems[sys].system_length() + "\n" +
			//				"System Position:\nx = " + systems[sys].system_3objects.position.x + "\n" +
			//				"y = " + systems[sys].system_3objects.position.y + "\n" +
			//				"z = " + systems[sys].system_3objects.position.z + "\n\n";
			//			sysPrint.push(sys); //add sys id to sysPrint array
			//		}
			//		let nucPrint: boolean = strandPrint.indexOf(strand) < 0;
			//		if (nucPrint) { //if strand id is not already in strandPrint array
			//			basesInfo += "STRAND:\n" + //add strand's information to basesInfo
			//				"System ID: " + sys + "\n" +
			//				"Strand ID: " + strand + "\n" +
			//				"# of Nucleotides: " + systems[sys].strands[strand].nucleotides.length + "\n" +
			//				"Strand Position:\nx = " + systems[sys].strands[strand].strand_3objects.position.x + "\n" +
			//				"y = " + systems[sys].strands[strand].strand_3objects.position.y + "\n" +
			//				"z = " + systems[sys].strands[strand].strand_3objects.position.z + "\n\n";
			//			strandPrint.push(strand); //add strand id to strandPrint array
			//		}
			//		if (nucPrint || getScopeMode() == "Nuc") { //if strand has not been added to basesInfo or scope mode is Nuc
			//			basesInfo += "NUCLEOTIDE:\n" + //add nucleotide info to basesInfo
			//				"Strand ID: " + strand + "\n" +
			//				"Global ID: " + temp.global_id + "\n" +
			//				"Base ID: " + temp.type + "\n" +
			//				"Nucleotide Position:\nx = " + nucleotides[temp.global_id].visual_object.position.x + "\n" +
			//				"y = " + nucleotides[temp.global_id].visual_object.position.y + "\n" +
			//				"z = " + nucleotides[temp.global_id].visual_object.position.z + "\n";
			//		}
			//	}
			//}
			//makeTextArea(listBases, "BaseList"); //insert list of bases into "BaseList" text area
			//makeTextArea(basesInfo, "BaseInfo"); //insert basesInfo into "BaseInfo" text area
		}
	}
});

function toggle(nucleotide: Nucleotide) { //toggle clicked nucleotide coloring
	// highlight/remove highlight the bases we've clicked 
	let selected: boolean = false;
	let nucleotideID: number = nucleotide.global_id;
	let sysID: number = nucleotide.parent.parent.system_id;

	if (selected_bases[nucleotideID] == 1) { //if clicked nucleotide is selected, set selected boolean to true 
		selected = true;
	}
	let back_Mesh: THREE.Object3D = nucleotides[nucleotideID].visual_object.children[BACKBONE]; //get clicked nucleotide's Meshes
	let nuc_Mesh: THREE.Object3D = nucleotides[nucleotideID].visual_object.children[NUCLEOSIDE];
	let con_Mesh: THREE.Object3D = nucleotides[nucleotideID].visual_object.children[BB_NS_CON];
	let sp_Mesh: THREE.Object3D = nucleotides[nucleotideID].visual_object.children[SP_CON];
	if (selected) { //if clicked nucleotide is already selected
		// figure out what that base was before you painted it black and revert it
		let nuc = nucleotides[nucleotideID]; //get Nucleotide object
		//recalculate Mesh's proper coloring and set Mesh material on scene to proper material
		if (back_Mesh instanceof THREE.Mesh) { //necessary for proper typing
			if (back_Mesh.material instanceof THREE.MeshLambertMaterial) {
				back_Mesh.material = systems[sysID].strand_to_material(nuc.parent.strand_id);
			}
		}
		if (nuc_Mesh instanceof THREE.Mesh) {
			if (nuc_Mesh.material instanceof THREE.MeshLambertMaterial) {
				nuc_Mesh.material = systems[sysID].base_to_material(nuc.type);
			}
		}
		if (con_Mesh instanceof THREE.Mesh) {
			if (con_Mesh.material instanceof THREE.MeshLambertMaterial) {
				con_Mesh.material = systems[sysID].strand_to_material(nuc.parent.strand_id);
			}
		}
		if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
			if (sp_Mesh.material instanceof THREE.MeshLambertMaterial) {
				sp_Mesh.material = systems[sysID].strand_to_material(nuc.parent.strand_id);
			}
		}
		let x = selList.indexOf(nucleotideID);
		let sel1 = selList.slice(0,x+1);
		let sel2 = selList.slice(x+1,selList.length);
		sel1.pop();
		selList = sel1.concat(sel2);

		selected_bases[nucleotideID] = 0; //"unselect" nucletide by setting value in selected_bases array at nucleotideID to 0
	}
	else {
		//set all materials to selection_material color - currently aqua
		if (back_Mesh instanceof THREE.Mesh) {
			if (back_Mesh.material instanceof THREE.MeshLambertMaterial)
				back_Mesh.material = selection_material;
		}
		if (nuc_Mesh instanceof THREE.Mesh) {
			if (nuc_Mesh.material instanceof THREE.MeshLambertMaterial) 
				nuc_Mesh.material = selection_material;
		}
		if (con_Mesh instanceof THREE.Mesh) {
			if (con_Mesh.material instanceof THREE.MeshLambertMaterial) 
				con_Mesh.material = selection_material;
		}
		if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
			if (sp_Mesh.material instanceof THREE.MeshLambertMaterial) 
				sp_Mesh.material = selection_material;
		}
		selList.push(nucleotideID);
		selected_bases[nucleotideID] = 1; //"select" nucletide by setting value in selected_bases array at nucleotideID to 1
	}
}




function makeTextArea(bases: string, id) { //insert "bases" string into text area with ID, id
	let textArea: HTMLElement | null = document.getElementById(id);
	if (textArea !== null) { //as long as text area was retrieved by its ID, id
		textArea.innerHTML = "Bases currently selected:\n" + bases; //set innerHTML / content to bases
	}
}

function writeMutTrapText(base1: number, base2: number): string { //create string to be inserted into mutual trap file
	return "{\n" + "type = mutual_trap\n" +
		"particle = " + base1 + "\n" +
		"ref_particle = " + base2 + "\n" +
		"stiff = 1.\n" +
		"r0 = 1.2" + "\n}\n\n";
}

function makeMutualTrapFile() { //make / allow download of mutual trap file
	let x: number, count: number = 0;
	let mutTrapText: string = "";
	for (x = 0; x < selList.length; x = x + 2) { //for every selected nucleotide in listBases string
		if (selList[x+1] !== undefined) { //if there is another nucleotide in the pair
			mutTrapText = mutTrapText + writeMutTrapText(selList[x], selList[x + 1]) + writeMutTrapText(selList[x + 1], selList[x]); //create mutual trap data for the 2 nucleotides in a pair - selected simultaneously
		}
		else { //if there is no 2nd nucleotide in the pair
			alert("The last selected base does not have a pair and thus cannot be included in the Mutual Trap File."); //give error message
		}
	}
	makeTextFile("mutTrapFile", mutTrapText); //after addding all mutual trap data, make mutual trap file
}

function makeSelectedBasesFile() { //make selected base file by addign listBases to text area
	makeTextFile("baseListFile", listBases);
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

