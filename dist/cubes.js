/* var camera:THREE.PerspectiveCamera, scene:THREE.Scene, renderer:THREE.WebGLRenderer;
var geometry:THREE.BoxGeometry, material:THREE.MeshNormalMaterial, mesh:THREE.Mesh, mesh1:THREE.Mesh;

init();
animate();
function render(){
    renderer.render(scene, camera);

}
function init() {

    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 10 );
    camera.position.z = 1;

    scene = new THREE.Scene();

    geometry = new THREE.BoxGeometry( 0.2, 0.2, 0.2 );
    material = new THREE.MeshNormalMaterial();

    mesh = new THREE.Mesh( geometry, material );
    scene.add( mesh );
    mesh1 = new THREE.Mesh(geometry, material);
    scene.add(mesh1);

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );

}

function animate() {

    // requestAnimationFrame( animate );

    //mesh.rotation.x += 0.01;
    //mesh.rotation.y += 0.02;

    renderer.render( scene, camera );
    var meshGroup:THREE.Group[] = [];
    meshGroup.push(mesh);
    meshGroup.push(mesh1);
    var meshG:THREE.Group = new THREE.Group;
    meshG.children.push(mesh);
    meshG.children.push(mesh1);
    var meshG2:THREE.Group = new THREE.Group;
    meshG2.add(meshG);
    dragControls = new THREE.DragControls(meshGroup, camera, true, renderer.domElement);
} */ 
