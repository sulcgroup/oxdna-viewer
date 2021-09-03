// conversion from oxDNA to nanometer 
const nmToOxDNA = 0.8518;
// compute radius of 10 nanometers
const radius = 10 / nmToOxDNA;   
// Threejs functions to create a sphere 
const geometry = new THREE.SphereGeometry( radius, 32, 32 );
// Material defines the color of the Mesh ( we use yellow)                    
const material = new THREE.MeshPhongMaterial( {color: 0xffff00} );
const sphere = new THREE.Mesh( geometry, material );
// move the sphere into position 
sphere.position.set(-10,30,-10);
// add to scene 
scene.add( sphere );
// update screen output
render();
