// adjust box
box.set(500,500,500);
// function translating a base index to a connection call
function connect(f, t){
    //receive first strand
    let s1 = elements.get(f).strand; 
    //receive second strand
    let s2 = elements.get(t).strand;
    //connect the 2 strands by a duplex patch
    edit.interconnectDuplex3p(s1,s2);
}
//grid id to index storage
let d = {};
// we assume that the first system is the one we want to copy around
systems[0].select();
// we store the number of bases comprising the system to calculate the offset of the patch positions
const n_elements = selectedBases.size;
// compute the center of mass of the octahedron origami
let cms = new THREE.Vector3(0,0,0);
selectedBases.forEach( base =>{
    cms.add(base.getPos());
});
cms.divideScalar(selectedBases.size);

// prepare to copy around
cutWrapper(); 
// index of the currently generated origami
let idx = 0;
// we construct a grid of 3x3x3
for(let k=0;k < 3; k++){
    for(let j = 0; j < 3; j++){
        for(let i=0; i < 3; i++){
            //build up the index of the origami in the grid to use for offset
            d[`${i},${j},${k}`]= idx++;
            //print progress
            console.log(i,j,k)
            //paste in a new structure, true keeps the position 
            pasteWrapper(true);
            //make sure everything is its own cluster
            selectionToCluster();
            //copy our computed cms value
            let cms_c = new THREE.Vector3().copy(cms);
            //compute the offset position
            cms_c.set(cms.x +80*i,cms.y+80*j,cms.z+80*k);
            //move the origami
            translateElements(selectedBases, cms_c);
        }
    } 
} 
// lets build up the connections in the grid
for(let k=0;k < 3; k++){
    for(let j = 0; j < 3; j++){
        for(let i=0; i < 3; i++){
            // retrieve the index of the origami we are connecting
            const self_idx = d[`${i},${j},${k}`];
            // an origami in a cubic lattice has 3 neighbors 
            // so we get their indexes 
            const right    = d[`${i+1},${j},${k}`];
            const top      = d[`${i},${j+1},${k}`];
            const north    = d[`${i},${j},${k+1}`]; 
            // print progress
            console.log(self_idx, right,top, north);
            // compute offset for the origami we are working on
            const s = self_idx*n_elements; 
            if(right){ // if we have a right neighbor 
                // compute the offset for it 
                const r = right*n_elements;
                // connect all 4 patches to the current origami in the grid
                // indices are derived from the initial origami design, we want to copy around
                connect(s+12420, r+8414);
                connect(s+9994 , r+11794);
                connect(s+7318 , r+11168);
                connect(s+7254 , r+9446);
            }
            if(top){ // if we have a top neighbor 
                // compute the offset for it 
                const t = top*n_elements;
                // connect all 4 patches to the current origami in the grid
                // indices are derived from the initial origami design, we want to copy around
                connect(s+7866 , t+6692);
                connect(s+11858, t+6144);
                connect(s+11232, t+10058);
                connect(s+12968, t+10606);
            }
            if(north){ // if we have a north neighbor
                // compute the offset for it 
                const n = north*n_elements;
                // connect all 4 patches to the current origami in the grid
                // indices are derived from the initial origami design, we want to copy around
                connect(s+8898 , n+6628);
                connect(s+10542, n+9510);
                connect(s+8350 , n+8962);
                connect(s+7802 , n+12904); 
            }
        }
    }
}
