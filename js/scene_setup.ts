// <reference path="./three/index.d.ts" />
// <reference path="./controls/three-trackballcontrols.d.ts" />
// scene update call definition
function render() {
    renderer.render(scene, camera);
}

// animation cycle and control updates
function animate() {
    requestAnimationFrame(animate);
    controls.update();

}

//Fix Resize problems
window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

    controls.handleResize();

    render();

}

//Setup the scene and renderer and camera 
var scene = new THREE.Scene();
// make the background white 
// default is black
scene.background = new THREE.Color();

var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// set camera position 
camera.position.z = 100;


var renderer = new THREE.WebGLRenderer({
    preserveDrawingBuffer: true,
    alpha: true,
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// set scene lighting 
//var light = new THREE.AmbientLight(0x404040);
//light.intensity = 3;
//scene.add(light);
var lights: THREE.PointLight[] = [];
lights[0] = new THREE.PointLight(0xffffff, 1, 0);
lights[1] = new THREE.PointLight(0xffffff, 1, 0);
lights[2] = new THREE.PointLight(0xffffff, 1, 0);

lights[0].position.set(0, 200, 0);
lights[1].position.set(100, 200, 100);
lights[2].position.set(- 100, - 200, - 100);

scene.add(lights[0]);
scene.add(lights[1]);
scene.add(lights[2]);


//Add arrows to scene
let dir = new THREE.Vector3(1, 0, 0);
//normalize the direction vector (convert to vector of length 1)
dir.normalize();
let origin = new THREE.Vector3(0, 0, 0);
var length: number = 10;
let hex = 0x000080;
let arrowHelper = new THREE.ArrowHelper(dir, origin, length, hex);
arrowHelper.name = "x-axis";
scene.add(arrowHelper);
dir = new THREE.Vector3(0, 1, 0);
dir.normalize();
arrowHelper = new THREE.ArrowHelper(dir, origin, length, hex);
arrowHelper.name = "y-axis";
scene.add(arrowHelper);
dir = new THREE.Vector3(0, 0, 1);
dir.normalize();
arrowHelper = new THREE.ArrowHelper(dir, origin, length, hex);
arrowHelper.name = "z-axis";
scene.add(arrowHelper);

function toggleArrows(chkBox) {
    if (chkBox.checked) {
        let arrowHelper = scene.getObjectByName("x-axis");
        arrowHelper.visible = true;
        arrowHelper = scene.getObjectByName("y-axis");
        arrowHelper.visible = true;
        arrowHelper = scene.getObjectByName("z-axis");
        arrowHelper.visible = true;

    }
    else {
        let arrowHelper = scene.getObjectByName("x-axis");
        arrowHelper.visible = false;
        arrowHelper = scene.getObjectByName("y-axis");
        arrowHelper.visible = false;
        arrowHelper = scene.getObjectByName("z-axis");
        arrowHelper.visible = false;
    }
    render();
}

// snippet borrowed from three.js examples 
// adding mouse controll to the scene 
//var orbit = new THREE.OrbitControls( camera, renderer.domElement );
//orbit.addEventListener('change', render);
var controls = new THREE.TrackballControls(camera);
controls.rotateSpeed = 1.5;
controls.zoomSpeed = 1.5;
controls.panSpeed = 1.0;
controls.noZoom = false;
controls.noPan = false;
controls.staticMoving = true;
controls.dynamicDampingFactor = 0.2;
controls.keys = [65, 83, 68];
controls.addEventListener('change', render);

// start animation cycle 
animate();