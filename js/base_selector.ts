//let math = require('mathjs');

class Selected_Base {
	id: number;
	b: THREE.Mesh;
	n: THREE.Mesh;
	constructor(idx: number, b: THREE.Mesh, n: THREE.Mesh) {
		this.id = idx;
		this.b = b;
		this.n = n;
	}
}

let selected_bases: Selected_Base[] = [];

document.addEventListener('mousedown', event => {
	// magic ... 
	let mouse3D = new THREE.Vector3((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1,
		0.5);
	let raycaster = new THREE.Raycaster();
	// cast a ray from mose to viewpoint of camera 
	raycaster.setFromCamera(mouse3D, camera);
	// callect all objects that are in the vay
	let backbones: THREE.Object3D[] = [];
	for (let i = 0; i < nucleotides.length; i++) {
		backbones.push(nucleotides[i].visual_object.children[0]);
	}
	let nucleosides: THREE.Object3D[] = [];
	for (let i = 0; i < nucleotides.length; i++) {
		nucleosides.push(nucleotides[i].visual_object.children[1]);
	}
	let intersects = raycaster.intersectObjects(backbones);

	// make note of what's been clicked
	let nucleotideID: number = -1;
	if (intersects.length > 0) {
		for (let i = 0; i < nucleotides.length; i++) {
			if (nucleotides[i].visual_object.children[0] === intersects[0].object)
				nucleotideID = i;
		}
		// highlight/remove highlight the bases we've clicked 
		let selected: boolean = false;
		let index: number = 0;
		for (let i: number = 0; i < selected_bases.length; i++) {
			if (selected_bases[i].id == nucleotideID) {
				selected = true;
				index = i;
			}
		}
		let back_Mesh: THREE.Object3D = backbones[nucleotideID];
		let nuc_Mesh: THREE.Object3D = nucleosides[nucleotideID];
		if (selected) {
			// figure out what that base was before you painted it black and revert it
			let baseArr = selected_bases.slice(0, index + 1);
			let baseArr2 = selected_bases.slice(index + 1, selected_bases.length);
			let prevBack_Mesh: THREE.Mesh = baseArr[index].b;
			if (back_Mesh instanceof THREE.Mesh) {
				back_Mesh.material = prevBack_Mesh.material;
			}
			let prevNuc_Mesh: THREE.Mesh = baseArr[index].n;
			if (nuc_Mesh instanceof THREE.Mesh) {
				nuc_Mesh.material = prevNuc_Mesh.material;
			}
			baseArr.pop();
			selected_bases = baseArr.concat(baseArr2);
			render();
		} 
		else { 
			if (back_Mesh instanceof THREE.Mesh && nuc_Mesh instanceof THREE.Mesh) {
				let back_MeshCopy : THREE.Mesh = back_Mesh.clone();
				let nuc_MeshCopy : THREE.Mesh = nuc_Mesh.clone();
				selected_bases.push(new Selected_Base(nucleotideID, back_MeshCopy, nuc_MeshCopy));
			}
			if (back_Mesh instanceof THREE.Mesh) {
				back_Mesh.material = selection_material;
			}
			if (nuc_Mesh instanceof THREE.Mesh) {
				nuc_Mesh.material = selection_material;
			}
			// give index using global base coordinates 
			console.log(nucleotideID); //I can't remove outputs from the console log...maybe open a popup instead?
			render();
		}
		let listBases = "";
		for (let x: number = 0; x < selected_bases.length; x++) {
			listBases = listBases + selected_bases[x].id + "\n";
			console.log(listBases);
		}
		makeTextArea(listBases);
	}

});

function makeTextArea(bases: string) {
	let textArea: HTMLElement | null = document.getElementById("BASES");
	if (textArea !== null) {
		textArea.innerHTML = "Bases currently selected:\n" + bases;
	}
}

function makeMutualTrapFile() {
	let x: number, count: number = 0;
	let base1: number = -1, base2: number = -1;
	for (x = 0; x < selected_bases.length; x++) {
		if (selected_bases[x] !== undefined) {
			count++;
			if (count == 1) base1 = x;
			else if (count == 2) base2 = x;
		}
	}
	if (count != 2) {
		alert("Please select only 2 bases to create a Mutual Trap File.");
	} else {
		let mutTrapText: string = writeMutTrapText(base1, base2) + writeMutTrapText(base2, base1);
		makeTextFile("mutTrapFile", mutTrapText);
	}
}

function writeMutTrapText(base1: number, base2: number): string {
	return "{\n" + "type = mutual_trap\n" +
		"particle = " + base1 + "\n" +
		"ref_particle = " + base2 + "\n" +
		"stiff = 1.\n" +
		"r0 = 1.2" + "\n}\n\n";
}

let textFile: string;
function makeTextFile(filename: string,text: string) {
	/*let data = new Blob([text], {
		type: 'text/plain'
	});

	// If we are replacing a previously generated file we need to
	// manually revoke the object URL to avoid memory leaks.
	if (textFile !== null) {
		window.URL.revokeObjectURL(textFile);
	}

	textFile = window.URL.createObjectURL(data);

	// returns a URL you can use as a href
	return textFile;*/
	var element = document.createElement('a');
	element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
	element.setAttribute('download', filename);
  
	element.style.display = 'none';
	document.body.appendChild(element);
  
	element.click();
  
	document.body.removeChild(element);
};

function openTab(evt, tabName) {
	let i: number;
	let tabcontent;
	let tablinks;
	tabcontent = document.getElementsByClassName("tabcontent");
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

