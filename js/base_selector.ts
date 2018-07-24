class Selected_Base {
	id: number;
	/*b: THREE.Color;
	n: THREE.Color;
	c: THREE.Color;
	sp: THREE.Color;*/
	constructor(idx: number/*, b: THREE.Color, n: THREE.Color, c: THREE.Color, sp?: THREE.Color*/) {
		this.id = idx;
		/*this.b = b;
		this.n = n;
		this.c = c;
		if (sp !== undefined)
			this.sp = sp;*/
	}
}

var selected_bases: Selected_Base[] = [];
let listBases: string = "";
let basesInfo: string = "";

document.addEventListener('mousedown', event => {
	getActionMode();
	getScopeMode();
	if (actionMode.includes("Select")) {
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
		/*let nucleosides: THREE.Object3D[] = [];
		for (let i = 0; i < nucleotides.length; i++) {
			nucleosides.push(nucleotides[i].visual_object.children[1]);
		}
		let con: THREE.Object3D[] = [];
		for (let i = 0; i < nucleotides.length; i++) {
			con.push(nucleotides[i].visual_object.children[2]);
		}
		let sp: THREE.Object3D[] = [];
		for (let i = 0; i < nucleotides.length; i++) {
			sp.push(nucleotides[i].visual_object.children[4]);
		} */
		let intersects = raycaster.intersectObjects(backbones);
		// make note of what's been clicked
		let nucleotideID: number;
		if (intersects.length > 0) {
			if (scopeMode.includes("System")) {
				let sysID;
				nucleotideID = parseInt(intersects[0].object.parent.name);
				//for (let x = 0; x < nucleotides.length; x++) {
				//	if (nucleotides[x].visual_object.children[0] === intersects[0].object) {
				sysID = nucleotides[nucleotideID].my_system;
				//		break;
				//	}
				//}
				for (let i = 0; i < nucleotides.length; i++) {
					if (nucleotides[i].my_system == sysID) {
						console.log(i);
						toggle(i, sysID);//, backbones, nucleosides, con, sp);
					}
				}
			}

			else if (scopeMode.includes("Strand")) {
				let /*sysID,*/ strandID;
				nucleotideID = parseInt(intersects[0].object.parent.name);
				//for (let x = 0; x < nucleotides.length; x++) {
				//	if (nucleotides[x].visual_object.children[0] === intersects[0].object) {
				//sysID = nucleotides[x].my_system;
				strandID = nucleotides[nucleotideID].my_strand;
				//		break;
				//	}
				//}
				for (let i = 0; i < nucleotides.length; i++) {
					if (nucleotides[i].my_strand == strandID) {
						let sysID = nucleotides[i].my_system;
						toggle(i, sysID);//, backbones, nucleosides, con, sp);
					}
				}
			}

			else if (scopeMode.includes("Nuc")) {
				nucleotideID = parseInt(intersects[0].object.parent.name);
				//for (nucleotideID = 0; nucleotideID < nucleotides.length; nucleotideID++) {
				//	if (nucleotides[nucleotideID].visual_object.children[0] === intersects[0].object) {
				let sysID = nucleotides[nucleotideID].my_system;
				toggle(nucleotideID, sysID);//, backbones, nucleosides, con, sp);
				//		break;
				//	}
				//}
			}
			listBases = "";
			for (let x: number = 0; x < selected_bases.length; x++) {
				listBases = listBases + selected_bases[x].id + "\n";
				//console.log(listBases);
			}

			/*basesInfo = "";
			let sysPrint: number[] = [], strandPrint: number[] = [], sys, strand;
			for (let x: number = 0; x < selected_bases.length; x++) {
				let temp = nucleotides[selected_bases[x].id];
				sys = temp.my_system;
				strand = temp.my_strand - 1;
				if (sysPrint.indexOf(sys) < 0) {
					basesInfo += "SYSTEM:\n" +
						"System ID: " + sys + "\n" +
						"# of Strands: " + systems[sys].strands.length + "\n" +
						"# of Nucleotides: " + systems[sys].system_length() + "\n" +
						"System Position:\nx = " + systems[sys].system_3objects.position.x + "\n" +
						"y = " + systems[sys].system_3objects.position.y + "\n" +
						"z = " + systems[sys].system_3objects.position.z + "\n\n";
					sysPrint.push(sys);
				}
				let nucPrint: boolean = strandPrint.indexOf(strand) < 0;
				if (nucPrint) {
					basesInfo += "STRAND:\n" +
						"System ID: " + sys + "\n" +
						"Strand ID: " + strand + "\n" +
						"# of Nucleotides: " + systems[sys].strands[strand].nucleotides.length + "\n" +
						"Strand Position:\nx = " + systems[sys].strands[strand].strand_3objects.position.x + "\n" +
						"y = " + systems[sys].strands[strand].strand_3objects.position.y + "\n" +
						"z = " + systems[sys].strands[strand].strand_3objects.position.z + "\n\n";
					strandPrint.push(strand);
				}
				if (nucPrint) {
					basesInfo += "NUCLEOTIDE:\n" +
						"Strand ID: " + strand + "\n" +
						"Global ID: " + temp.global_id + "\n" +
						"Base ID: " + temp.type + "\n" +
						"Nucleotide Position:\nx = " + nucleotides[temp.global_id].visual_object.children[3].position.x + "\n" +
						"y = " + nucleotides[temp.global_id].visual_object.children[3].position.y + "\n" +
						"z = " + nucleotides[temp.global_id].visual_object.children[3].position.z + "\n";
				}
			}
			makeTextArea(listBases, "BaseList");
			makeTextArea(basesInfo, "BaseInfo");*/
		}
	}
});

function toggle(nucleotideID, sysID/*, backbones, nucleosides, con, sp*/) {
	// highlight/remove highlight the bases we've clicked 
	let selected: boolean = false;
	let index: number = 0;
	for (let i: number = 0; i < selected_bases.length; i++) {
		if (selected_bases[i].id == nucleotideID) {
			selected = true;
			index = i;
			break;
		}
	}
	/*let back_Mesh: THREE.Object3D = backbones[nucleotideID];
	let nuc_Mesh: THREE.Object3D = nucleosides[nucleotideID];
	let con_Mesh: THREE.Object3D = con[nucleotideID];
	let sp_Mesh: THREE.Object3D = sp[nucleotideID];*/
	let back_Mesh: THREE.Object3D = nucleotides[nucleotideID].visual_object.children[0];
	let nuc_Mesh: THREE.Object3D = nucleotides[nucleotideID].visual_object.children[1];
	let con_Mesh: THREE.Object3D = nucleotides[nucleotideID].visual_object.children[2];
	let sp_Mesh: THREE.Object3D = nucleotides[nucleotideID].visual_object.children[4];
	if (selected) {
		// figure out what that base was before you painted it black and revert it
		let baseArr = selected_bases.slice(0, index + 1);
		baseArr.pop();
		let baseArr2 = selected_bases.slice(index + 1, selected_bases.length);
		/* let prevBack_MeshCol: THREE.Color = baseArr[index].b;
		if (back_Mesh instanceof THREE.Mesh) {
			if (back_Mesh.material instanceof THREE.MeshLambertMaterial) {
				back_Mesh.material.color = prevBack_MeshCol;
			}
		}
		let prevNuc_MeshCol: THREE.Color = baseArr[index].n;
		if (nuc_Mesh instanceof THREE.Mesh) {
			if (nuc_Mesh.material instanceof THREE.MeshLambertMaterial || nuc_Mesh.material instanceof THREE.MeshLambertMaterial) {
				nuc_Mesh.material.color = prevNuc_MeshCol;
			}
		}
		let prevCon_MeshCol: THREE.Color = baseArr[index].c;
		if (con_Mesh instanceof THREE.Mesh) {
			if (con_Mesh.material instanceof THREE.MeshLambertMaterial) {
				con_Mesh.material.color = prevCon_MeshCol;
			}
		}
		let prevSP_MeshCol: THREE.Color = baseArr[index].sp;
		if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
			if (sp_Mesh.material instanceof THREE.MeshLambertMaterial) {
				sp_Mesh.material.color = prevSP_MeshCol;
			}
		} */
		if (back_Mesh instanceof THREE.Mesh) {
			if (back_Mesh.material instanceof THREE.MeshLambertMaterial) {
				back_Mesh.material = (systems[sysID].strand_to_material[nucleotides[nucleotideID].global_id]);
			}
		}
		if (nuc_Mesh instanceof THREE.Mesh) {
			if (nuc_Mesh.material instanceof THREE.MeshLambertMaterial || nuc_Mesh.material instanceof THREE.MeshLambertMaterial) {
				nuc_Mesh.material = (systems[sysID].base_to_material[nucleotides[nucleotideID].global_id]);
			}
		}
		if (con_Mesh instanceof THREE.Mesh) {
			if (con_Mesh.material instanceof THREE.MeshLambertMaterial) {
				con_Mesh.material = (systems[sysID].strand_to_material[nucleotides[nucleotideID].global_id]);
			}
		}
		if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
			if (sp_Mesh.material instanceof THREE.MeshLambertMaterial) {
				sp_Mesh.material = (systems[sysID].strand_to_material[nucleotides[nucleotideID].global_id]);
			}
		}
		selected_bases = baseArr.concat(baseArr2);
		render();
	}
	else {
		if (back_Mesh instanceof THREE.Mesh && nuc_Mesh instanceof THREE.Mesh && con_Mesh instanceof THREE.Mesh) {
			/*let back_MeshColCopy: THREE.Color = new THREE.Color();
			let nuc_MeshColCopy: THREE.Color = new THREE.Color();
			let con_MeshColCopy: THREE.Color = new THREE.Color();
			let sp_MeshColCopy: THREE.Color = new THREE.Color();
			if (back_Mesh.material instanceof THREE.MeshLambertMaterial) {
				back_MeshColCopy.copy(back_Mesh.material.color);
			}
			if (nuc_Mesh.material instanceof THREE.MeshBasicMaterial || nuc_Mesh.material instanceof THREE.MeshLambertMaterial) {
				nuc_MeshColCopy.copy(nuc_Mesh.material.color);
			}
			if (con_Mesh.material instanceof THREE.MeshLambertMaterial) {
				con_MeshColCopy.copy(con_Mesh.material.color);
			}*/
			if (sp_Mesh instanceof THREE.Mesh) {
				/*if (sp_Mesh.material instanceof THREE.MeshLambertMaterial) {
					sp_MeshColCopy.copy(sp_Mesh.material.color);
				}*/
				selected_bases.push(new Selected_Base(nucleotideID/*, back_MeshColCopy, nuc_MeshColCopy, con_MeshColCopy,
				sp_MeshColCopy*/));
			}
			else if (sp_Mesh === undefined) {
				selected_bases.push(new Selected_Base(nucleotideID/*, back_MeshColCopy, nuc_MeshColCopy, con_MeshColCopy*/));
			}
		}
		if (back_Mesh instanceof THREE.Mesh) {
			if (back_Mesh.material instanceof THREE.MeshLambertMaterial) {
				back_Mesh.material = (selection_material);
			}
		}
		if (nuc_Mesh instanceof THREE.Mesh) {
			if (nuc_Mesh.material instanceof THREE.MeshLambertMaterial) {
				nuc_Mesh.material = (selection_material);
			}
		}
		if (con_Mesh instanceof THREE.Mesh) {
			if (con_Mesh.material instanceof THREE.MeshLambertMaterial) {
				con_Mesh.material = (selection_material);
			}
		}
		if (sp_Mesh !== undefined && sp_Mesh instanceof THREE.Mesh) {
			if (sp_Mesh.material instanceof THREE.MeshLambertMaterial) {
				sp_Mesh.material = (selection_material);
			}
		}
		// give index using global base coordinates 
		//console.log(nucleotideID); //I can't remove outputs from the console log...maybe open a popup instead?
		render();
	}
}

function makeTextArea(bases: string, id) {
	let textArea: HTMLElement | null = document.getElementById(id);
	if (textArea !== null) {
		textArea.innerHTML = "Bases currently selected:\n" + bases;
	}
}

function writeMutTrapText(base1: number, base2: number): string {
	return "{\n" + "type = mutual_trap\n" +
		"particle = " + base1 + "\n" +
		"ref_particle = " + base2 + "\n" +
		"stiff = 1.\n" +
		"r0 = 1.2" + "\n}\n\n";
}

function makeMutualTrapFile() {
	let x: number, count: number = 0;
	let mutTrapText: string = "";
	for (x = 0; x < selected_bases.length; x = x + 2) {
		if (selected_bases[x + 1] !== undefined) {
			mutTrapText = mutTrapText + writeMutTrapText(x, x + 1) + writeMutTrapText(x + 1, x);
		}
		else {
			alert("The last selected base does not have a pair and thus cannot be included in the Mutual Trap File.");
		}
	}
	makeTextFile("mutTrapFile", mutTrapText);
}

function makeSelectedBasesFile() {
	makeTextFile("baseListFile", listBases);
}

let textFile: string;
function makeTextFile(filename: string, text: string) {
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

