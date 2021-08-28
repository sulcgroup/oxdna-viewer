function extend_overhang(strand){
    if(strand.getLength() < 150){
        // select 5' end of the strand
        const p5 = strand.end5;
        // fetch 5' orientation vector
        const a = p5.getA1();
        // extend the strand with provided sequence
        const bases =  edit.extendStrand( p5 , "TTTTTTTTTTTTTTTTTTTTTTTTT");
        // figure out offset position 
        const npos = new THREE.Vector3().copy(a).multiplyScalar(-1.5);
        // translate the extension bases in the desired direction 
        bases.forEach(b => b.translatePosition(npos));
        // rotate the extension bases 90 degrees away from the structure plane
        rotateElements(new Set(bases), bases[0].getA2(),Math.PI/2, bases[0].getPos());
    }
}
// apply extension function to all strands in origami
systems[0].strands.forEach(extend_overhang);
// update the screen
render();
