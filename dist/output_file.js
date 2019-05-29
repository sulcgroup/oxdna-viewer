function makeOutputFiles() {
    let tempVec = new THREE.Vector3(0, 0, 0);
    let top = ""; //string of contents of .top file
    let tot_nuc = 0; //total # of elements
    let tot_strands = 0; //total # of strands
    let longest_strand_len = 0;
    let uncorrected_strand_id;
    let old_system;
    let current_strand = 1;
    for (let i = 0; i < systems.length; i++) { //for each system
        for (let j = 0; j < systems[i].strands.length; j++) { //for each strand in current system
            tot_strands++;
            let strand_len = 0; //current strand length
            for (let k = 0; k < systems[i].strands[j].elements.length; k++) { //for each nucleotide in current strand
                tot_nuc++;
                strand_len++;
            }
            if (longest_strand_len < strand_len) //set longest_strand_len to largest strand length
                longest_strand_len = strand_len;
        }
    }
    top = tot_nuc + " " + tot_strands + "\n";
    uncorrected_strand_id = elements[0].parent.strand_id;
    old_system = elements[0].parent.parent.system_id;
    for (let i = 0; i < elements.length; i++) { //for each nucleotide in the system
        if (elements[i].parent.strand_id != uncorrected_strand_id || elements[i].parent.parent.system_id != old_system) {
            current_strand += 1;
            uncorrected_strand_id = elements[i].parent.strand_id;
            old_system = elements[i].parent.parent.system_id;
        }
        top = top + current_strand + " " + elements[i].type + " "; //strand id in global world + base type
        let neighbor3 = elements[i].neighbor3;
        let neighbor5 = elements[i].neighbor5;
        if (neighbor3 === null || neighbor3 === undefined) { // if no neigbor3, neighbor3's global id = -1
            top = top + -1 + " ";
        }
        else if (neighbor3 !== null) { //if neighbor3 exists, append neighbor3's global id
            top = top + neighbor3.global_id + " ";
        }
        if (neighbor5 === null || neighbor5 === undefined) { //if neighbor5 doesn't exist, append neighbor5's position = -1
            top = top + -1 + "\n";
        }
        else { //if neighbor5 exists, append neighbor5's position
            top = top + neighbor5.global_id + "\n";
        }
    }
    let dat = "";
    let box = 2 * longest_strand_len;
    dat = "t = 0\n" + "b = " + box + " " + box + " " + box
        + "\n" + "E = 0 0 0 " + dat_fileout + "\n";
    for (let i = 0; i < elements.length; i++) { //for all elements
        let nuc = elements[i];
        nuc.visual_object.children[3].getWorldPosition(tempVec); //nucleotide's center of mass in world
        let x = tempVec.x;
        let y = tempVec.y;
        let z = tempVec.z;
        let fx, fy, fz;
        nuc.visual_object.children[0].getWorldPosition(tempVec); //nucleotide's sugar phosphate backbone's world position
        let x_bb = tempVec.x;
        let y_bb = tempVec.y;
        let z_bb = tempVec.z;
        nuc.visual_object.children[1].getWorldPosition(tempVec); //nucleotide's nucleoside's world position
        let x_ns = tempVec.x;
        let y_ns = tempVec.y;
        let z_ns = tempVec.z;
        let x_a1;
        let y_a1;
        let z_a1;
        //calculate axis vector a1 (backbone vector) and a3 (stacking vector)
        x_a1 = (x_ns - x) / 0.4;
        y_a1 = (y_ns - y) / 0.4;
        z_a1 = (z_ns - z) / 0.4;
        let x_a3;
        let y_a3;
        let z_a3;
        let x_a2;
        let y_a2;
        let z_a2;
        if (RNA_MODE) { //if RNA
            x_a3 = ((x_bb - x) + (0.4 * x_a1)) / (-0.2);
            y_a3 = ((y_bb - y) + (0.4 * y_a1)) / (-0.2);
            z_a3 = ((z_bb - z) + (0.4 * z_a1)) / (-0.2);
        }
        else { //if DNA
            x_a2 = ((x_bb - x) + (0.34 * x_a1)) / (-0.3408);
            y_a2 = ((y_bb - y) + (0.34 * y_a1)) / (-0.3408);
            z_a2 = ((z_bb - z) + (0.34 * z_a1)) / (-0.3408);
            let Coeff = [[0, -(z_a1), y_a1], [-(z_a1), 0, x_a1], [-(y_a1), x_a1, 0]];
            let x_matrix = [[x_a2, -(z_a1), y_a1], [y_a2, 0, x_a1], [z_a2, x_a1, 0]];
            let y_matrix = [[0, x_a2, y_a1], [-(z_a1), y_a2, x_a1], [-(y_a1), z_a2, 0]];
            let z_matrix = [[0, -(z_a1), x_a2], [-(z_a1), 0, y_a2], [-(y_a1), x_a1, z_a2]];
            let a3 = divAndNeg(cross(x_a1, y_a1, z_a1, x_a2, y_a2, z_a2), dot(x_a1, y_a1, z_a1, x_a1, y_a1, z_a1));
            x_a3 = a3[0];
            y_a3 = a3[1];
            z_a3 = a3[2];
            let temp;
        }
        dat = dat + x + " " + y + " " + z + " " + x_a1 + " " + y_a1 + " " + z_a1 + " " + x_a3 + " " + y_a3 +
            " " + z_a3 + " 0 0 0 0 0 0" + "\n"; //add all locations to dat file string
    }
    makeTextFile("sim.top", top); //make .top file
    makeTextFile("last_conf.dat", dat); //make .dat file
}
function det(mat) {
    return (mat[0][0] * ((mat[1][1] * mat[2][2]) - (mat[1][2] * mat[2][1])) - mat[0][1] * ((mat[1][0] * mat[2][2]) -
        (mat[2][0] * mat[1][2])) + mat[0][2] * ((mat[1][0] * mat[2][1]) - (mat[2][0] * mat[1][1])));
}
function dot(x1, y1, z1, x2, y2, z2) {
    return x1 * x2 + y1 * y2 + z1 * z2;
}
function divAndNeg(mat, divisor) {
    return [-mat[0] / divisor, -mat[1] / divisor, -mat[2] / divisor];
}
