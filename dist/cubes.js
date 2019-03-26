
var camera, scene, renderer;
var geometry, material, mesh, mesh1;

init();
animate();
function render() {
    renderer.render(scene, camera);

}
function init() {

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);
    camera.position.z = 1;

    scene = new THREE.Scene();

    geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    material = new THREE.MeshNormalMaterial();

    mesh = new THREE.Mesh(geometry, material);
    //scene.add( mesh );
    mesh1 = new THREE.Mesh(geometry, material);
    mesh1.position = new THREE.Vector3(30, 30, 30);
    //scene.add(mesh1);
    let group = new THREE.Group();
    group.add(mesh);
    group.add(mesh1);
    scene.add(group);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    render();

}

function animate() {

    requestAnimationFrame( animate );

    //mesh.rotation.x += 0.01;
    //mesh.rotation.y += 0.02;

    renderer.render( scene, camera ); 
    /*var meshGroup:THREE.Group[] = [];
    meshGroup.push(mesh);
    meshGroup.push(mesh1);
    var meshG:THREE.Group = new THREE.Group;
    meshG.children.push(mesh);
    meshG.children.push(mesh1);
    var meshG2:THREE.Group = new THREE.Group;
    meshG2.add(meshG);
   // dragControls = new THREE.DragControls(meshGroup, camera, true, renderer.domElement);*/
} 