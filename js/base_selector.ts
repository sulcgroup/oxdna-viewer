

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

var selected_bases: Selected_Base[] = [];

document.addEventListener('mousedown', event => {
	// magic ... 
	var mouse3D = new THREE.Vector3((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1,
		0.5);
	var raycaster = new THREE.Raycaster();
	// cast a ray from mose to viewpoint of camera 
	raycaster.setFromCamera(mouse3D, camera);
	// callect all objects that are in the vay
	var backbones: THREE.Object3D[] = [];
	for (var i = 0; i < nucleotides.length; i++) {
		backbones.push(nucleotides[i].visual_object.children[0]);
	}
	var nucleosides: THREE.Object3D[] = [];
	for (var i = 0; i < nucleotides.length; i++) {
		nucleosides.push(nucleotides[i].visual_object.children[1]);
	}
	var intersects = raycaster.intersectObjects(backbones);

	// make note of what's been clicked
	var nucleotideID: number = -1;
	if (intersects.length > 0) {
		for (var i = 0; i < nucleotides.length; i++) {
			if (nucleotides[i].visual_object.children[0] === intersects[0].object)
				nucleotideID = i;
		}
		// highlight/remove highlight the bases we've clicked 
		var selected: boolean = false;
		var index: number = 0;
		for (var i: number = 0; i < selected_bases.length; i++) {
			if (selected_bases[i].id == nucleotideID) {
				selected = true;
				index = i;
			}
		}
		var back_Mesh: THREE.Object3D = backbones[nucleotideID];
		var nuc_Mesh: THREE.Object3D = nucleosides[nucleotideID];
		if (selected) {
			// figure out what that base was before you painted it black and revert it
			var baseArr = selected_bases.slice(0, index + 1);
			var baseArr2 = selected_bases.slice(index + 1, selected_bases.length);
			var prevBack_Mesh: THREE.Mesh = baseArr[index].b;
			if (back_Mesh instanceof THREE.Mesh) {
				back_Mesh.material = prevBack_Mesh.material;
			}
			var prevNuc_Mesh: THREE.Mesh = baseArr[index].n;
			if (nuc_Mesh instanceof THREE.Mesh) {
				nuc_Mesh.material = prevNuc_Mesh.material;
			}
			baseArr.pop();
			selected_bases = baseArr.concat(baseArr2);
			render();
		} 
		else { 
			if (back_Mesh instanceof THREE.Mesh && nuc_Mesh instanceof THREE.Mesh) {
				var back_MeshCopy : THREE.Mesh = back_Mesh.clone();
				var nuc_MeshCopy : THREE.Mesh = nuc_Mesh.clone();
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
		var listBases = "";
		for (var x: number = 0; x < selected_bases.length; x++) {
			listBases = listBases + selected_bases[x].id + "\n";
			console.log(listBases);
		}
		makeTextArea(listBases);
	}

});

function makeTextArea(bases: string) {
	var textArea: HTMLElement | null = document.getElementById("BASES");
	if (textArea !== null) {
		textArea.innerHTML = "Bases currently selected:\n" + bases;
	}
}

function makeMutualTrapFile() {
	var x: number, count: number = 0;
	var base1: number = -1, base2: number = -1;
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
		var mutTrapText: string = writeMutTrapText(base1, base2) + writeMutTrapText(base2, base1);
		var mutTrapFile = makeTextFile(mutTrapText);
		alert(mutTrapFile);
	}
}

function writeMutTrapText(base1: number, base2: number): string {
	return "{\n" + "type = mutual_trap\n" +
		"particle = " + base1 + "\n" +
		"ref_particle = " + base2 + "\n" +
		"stiff = 1.\n" +
		"r0 = 1.2" + "\n}\n\n";
}

function makeOutputFiles(){
	var top : string = "";
	var tot_nuc:number = 0;
	var tot_strands:number = 0;
	var longest_strand_len:number = 0;
	for (var i = 0; i < systems.length; i++){
		for (var i2 = 0; i2 < systems[i].strands.length; i2++){
			tot_strands++;
			var strand_len:number = 0;
			for (var i3 = 0; i3 < systems[i].strands[i2].nucleotides.length; i3++){
				tot_nuc++;
				strand_len++;
			}
			if (longest_strand_len < strand_len)
				longest_strand_len = strand_len;
		}
	}
	top = tot_nuc + " " + tot_strands + "\n";
	for (var i = 0; i < nucleotides.length; i++){
		top = top + nucleotides[i].my_strand + " " + nucleotides[i].type + " ";
		var neighbor3 = nucleotides[i].neighbor3;
		var neighbor5 = nucleotides[i].neighbor5;
		if (neighbor3 === null || neighbor3 === undefined){
			top = top + -1 + " ";
		}
		else if (neighbor3 !== null) {
			top = top + neighbor3.global_id + " ";
		}
		if (neighbor5 === null || neighbor5 === undefined){
			top = top + -1 + "\n";
		}
		else {
			top = top + neighbor5.global_id + "\n";
		}
	}

	var dat:string = "";
	var box:number = 2*longest_strand_len;
	dat = "t = 0\n" + "b = " + box + " " + box + " " + box
		+ "\n" + "E = 0 0 0 " + dat_fileout + "\n";
	for (var i = 0; i < nucleotides.length; i++){
		var nuc:Nucleotide = nucleotides[i];
		var x:number = nuc.pos.x;
		var y:number = nuc.pos.y;
		var z:number = nuc.pos.z;
		var x_bb:number = nuc.visual_object[0];
		var y_bb:number = nuc.visual_object[0].y_bb;
		var z_bb:number = nuc.visual_object[0].z_bb;
		var x_ns:number = nuc.visual_object[1].x_ns;
		var y_ns:number = nuc.visual_object[1].y_ns;
		var z_ns:number = nuc.visual_object[1].z_ns;
		var x_a1:number = 0;
		var y_a1:number = 0;
		var z_a1:number = 0;
		x_a1 = (x_ns - x)/0.4;
		y_a1 = (y_ns - y)/0.4;
		z_a1 = (z_ns - z)/0.4;
		var x_a3:number = 0;
		var y_a3:number = 0;
		var z_a3:number = 0;
		var x_a2:number = 0;
		var y_a2:number = 0;
		var z_a2:number = 0;
		if (RNA_MODE){
			x_a3 = ((x_bb - x)+(0.4*x_a1))/(-0.2);
			y_a3 = ((y_bb - y)+(0.4*y_a1))/(-0.2);
			z_a3 = ((z_bb - z)+(0.4*z_a1))/(-0.2);
		}
		else{
			x_a2 = ((x_bb - x)+(0.34*x_a1))/(-0.3408);
			y_a2 = ((y_bb - y)+(0.34*y_a1))/(-0.3408);
			z_a2 = ((z_bb - z)+(0.34*z_a1))/(-0.3408);
			
			var Coeff = [[0,-z_a1,y_a1],[-z_a1,0,x_a1],[-y_a1,x_a1,0]];
			var x_matrix = [[x_a2,-z_a1,y_a1],[y_a2,0,x_a1],[z_a2,x_a1,0]];
			var y_matrix = [[0,x_a2,y_a1],[-z_a1,y_a2,x_a1],[-y_a1,z_a2,0]];
			var z_matrix = [[0,-z_a1,x_a2],[-z_a1,0,y_a2],[-y_a1,x_a1,z_a2]];

			x_a3 = det(x_matrix)/det(Coeff);
			y_a3 = det(y_matrix)/det(Coeff);
			z_a3 = det(z_matrix)/det(Coeff);

			var temp;

			dat = dat + x_a1 + " " + y_a1 + " " + z_a1 + " " + x_a3 + " " + y_a3 + " " + z_a3 + "\n";
		}
	}

	alert(".top file:\n" + makeTextFile(top) + "\n.dat file:\n" + makeTextFile(dat));
}

function det(mat:number[][]){
	return mat[0][0]* ((mat[1][1]*mat[2][2]) - (mat[1][2]*mat[2][1]))  - mat[0][1] * ((mat[1][0]*mat[2][2]) -
		(mat[2][0]*mat[1][2])) + mat[0][2] * ((mat[1][0]*mat[2][1]) - (mat[2][0]*mat[1][1]));
}

var textFile: string;
function makeTextFile(text: string) {
	var data = new Blob([text], {
		type: 'text/plain'
	});

	// If we are replacing a previously generated file we need to
	// manually revoke the object URL to avoid memory leaks.
	if (textFile !== null) {
		window.URL.revokeObjectURL(textFile);
	}

	textFile = window.URL.createObjectURL(data);

	// returns a URL you can use as a href
	return textFile;
};

function openTab(evt, tabName) {
	var i: number;
	var tabcontent;
	var tablinks;
	tabcontent = document.getElementsByClassName("tabcontent");
	for (i = 0; i < tabcontent.length; i++) {
		tabcontent[i].style.display = "none";
	}
	tablinks = document.getElementsByClassName("tablinks");
	for (i = 0; i < tablinks.length; i++) {
		tablinks[i].className = tablinks[i].className.replace(" active", "");
	}
	var tab: HTMLElement | null = document.getElementById(tabName);
	if (tab !== null) {
		tab.style.display = "block";
	}
	evt.currentTarget.className += " active";
}

