function makeOutputFiles(){
	let top : string = "";
	let tot_nuc:number = 0;
	let tot_strands:number = 0;
	let longest_strand_len:number = 0;
	for (let i = 0; i < systems.length; i++){
		for (let j = 0; j < systems[i].strands.length; j++){
			tot_strands++;
			let strand_len:number = 0;
			for (let k = 0; k < systems[i].strands[j].nucleotides.length; k++){
				tot_nuc++;
				strand_len++;
			}
			if (longest_strand_len < strand_len)
				longest_strand_len = strand_len;
		}
	}
	top = tot_nuc + " " + tot_strands + "\n";
	for (let i = 0; i < nucleotides.length; i++){
		top = top + nucleotides[i].my_strand + " " + nucleotides[i].type + " ";
		let neighbor3 = nucleotides[i].neighbor3;
		let neighbor5 = nucleotides[i].neighbor5;
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

	let dat:string = "";
	let box:number = 2*longest_strand_len;
	dat = "t = 0\n" + "b = " + box + " " + box + " " + box
		+ "\n" + "E = 0 0 0 " + dat_fileout + "\n";
	for (let i = 0; i < nucleotides.length; i++){
		let nuc:Nucleotide = nucleotides[i];
		let x:number = nuc.pos.x;
		let y:number = nuc.pos.y;
        let z:number = nuc.pos.z;
        let fx:number, fy:number, fz:number;
		let x_bb:number = nuc.visual_object.children[0].position.x;
		let y_bb:number = nuc.visual_object.children[0].position.y;
		let z_bb:number = nuc.visual_object.children[0].position.z;
		let x_ns:number = nuc.visual_object.children[1].position.x;
		let y_ns:number = nuc.visual_object.children[1].position.y;
		let z_ns:number = nuc.visual_object.children[1].position.z;
		let x_a1:number;
		let y_a1:number;
		let z_a1:number;
		x_a1 = (x_ns - x)/0.4;
		y_a1 = (y_ns - y)/0.4;
		z_a1 = (z_ns - z)/0.4;
		let x_a3:number;
		let y_a3:number;
		let z_a3:number;
		let x_a2:number;
		let y_a2:number;
		let z_a2:number;
		if (RNA_MODE){
			x_a3 = ((x_bb - x)+(0.4*x_a1))/(-0.2);
			y_a3 = ((y_bb - y)+(0.4*y_a1))/(-0.2);
			z_a3 = ((z_bb - z)+(0.4*z_a1))/(-0.2);
		}
		else{
			x_a2 = ((x_bb - x)+(0.34*x_a1))/(-0.3408);
			y_a2 = ((y_bb - y)+(0.34*y_a1))/(-0.3408);
			z_a2 = ((z_bb - z)+(0.34*z_a1))/(-0.3408);

			let Coeff = [[0,-(z_a1),y_a1],[-(z_a1),0,x_a1],[-(y_a1),x_a1,0]];
			let x_matrix = [[x_a2,-(z_a1),y_a1],[y_a2,0,x_a1],[z_a2,x_a1,0]];
			let y_matrix = [[0,x_a2,y_a1],[-(z_a1),y_a2,x_a1],[-(y_a1),z_a2,0]];
			let z_matrix = [[0,-(z_a1),x_a2],[-(z_a1),0,y_a2],[-(y_a1),x_a1,z_a2]];

			console.log(Coeff);
			console.log(det(Coeff));
			console.log(x_matrix);
			console.log(det(x_matrix));
 
			let a3:number[] = divAndNeg(cross(x_a1,y_a1,z_a1,x_a2,y_a2,z_a2),dot(x_a1,y_a1,z_a1,x_a1,y_a1,z_a1));
			x_a3 = a3[0]; y_a3 = a3[1]; z_a3 = a3[2]; 
			let temp;
		}

			dat = dat + x + " " + y + " " + z + " " + x_a1 + " " + y_a1 + " " + z_a1 + " " + x_a3 + " " + y_a3 +
			" " + z_a3 + " 0 0 0 0 0 0" + "\n";
	}

	makeTextFile("sim.top", top);
	makeTextFile("last_conf.dat", dat);
}

function det(mat:number[][]){
	return (mat[0][0] * ((mat[1][1]*mat[2][2]) - (mat[1][2]*mat[2][1]))  - mat[0][1] * ((mat[1][0]*mat[2][2]) -
		(mat[2][0]*mat[1][2])) + mat[0][2] * ((mat[1][0]*mat[2][1]) - (mat[2][0]*mat[1][1])));
}

function dot(x1:number,y1:number,z1:number,x2:number,y2:number,z2:number){
	return x1*x2 + y1*y2 + z1*z2;
}
function divAndNeg(mat:number[],divisor:number){
	return [-mat[0]/divisor, -mat[1]/divisor, -mat[2]/divisor];
}