function makeOutputFiles() { //makes .dat and .top files with update position information; includes all systems as 1 system
    let clean = <NodeListOf<HTMLInputElement>>document.getElementsByName("cleanFirst");
    if (clean[0].checked == true) {
        api.cleanOrder();
    }
    let top = <NodeListOf<HTMLInputElement>>document.getElementsByName("topDownload");
    if (top[0].checked == true) {
        makeTopFile();
    }
    let dat = <NodeListOf<HTMLInputElement>>document.getElementsByName("datDownload");
    if (dat[0].checked == true) {
        makeDatFile();	
    }
}

function makeTopFile(){
    let top: string[] = []; //string of contents of .top file
    let totNuc: number = 0; //total # of elements
    let totStrands: number = 0; //total # of strands

    for (let i = 0; i < systems.length; i++) { //for each system
        totStrands += systems[i][strands].length;
        for (let j = 0; j < systems[i][strands].length; j++) { //for each strand in current system
            totNuc += systems[i][strands][j][monomers].length;
        }
    }

    top.push(totNuc + " " + totStrands);

    for (let i = 0; i < elements.length; i++) { //for each nucleotide in the system
        let tl = [elements[i].parent.strandID , elements[i].type ]; //strand id in global world + base type
        let neighbor3 = elements[i].neighbor3;
        let neighbor5 = elements[i].neighbor5;
        if (neighbor3 === null || neighbor3 === undefined) 
            tl.push(-1); // if no neigbor3, neighbor3's global id = -1
        else if (neighbor3 !== null) 
            tl.push(neighbor3.gid); //if neighbor3 exists, append neighbor3's global id
        if (neighbor5 === null || neighbor5 === undefined) 
            tl.push(-1); //if neighbor5 doesn't exist, append neighbor5's position = -1
        else  
            tl.push(neighbor5.gid); //if neighbor5 exists, append neighbor5's position
        top.push(tl.join(" "));
    }
    makeTextFile("sim.top", top.join("\n")); //make .top file
}
function makeDatFile() {
    // Get largest absolute coordinate:
    let maxCoord = 0;
    for (let i = 0; i < elements.length; i++) { //for all elements
        let p = elements[i].getInstanceParameter3("cmOffsets");
        maxCoord = Math.max(maxCoord, Math.max(
            Math.abs(p.x),
            Math.abs(p.y),
            Math.abs(p.z)
        ))
    }
    let dat: string = "";
    let box: number = Math.ceil(5 * maxCoord);
    dat = "t = 0\n" + "b = " + box + " " + box + " " + box
        + "\n" + "E = 0 0 0 " + datFileout + "\n";
    for (let i = 0; i < elements.length; i++) { //for all elements
        let nuc: BasicElement = elements[i];
        dat += nuc.getDatFileOutput();
    }
    makeTextFile("last_conf.dat", dat); //make .dat file
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