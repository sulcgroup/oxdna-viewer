// <reference path="./three/index.d.ts" />
// <reference path="./controls/three-trackballcontrols.d.ts" />
// <reference path="./lib/stats.js" />
// stats code 
//var stats = new stats();
//document.body.append(
//    stats.dom
//);
// scene update call definition
function render() {
    renderer.render(scene, camera);
}
function renderColorbar() {
    colorbarRenderer.render(colorbarScene, colorbarCamera);
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
var GREY = new THREE.Color(0x888888);
var BLACK = new THREE.Color(0x000000);
var WHITE = new THREE.Color();
var scene = new THREE.Scene();
scene.background = WHITE;
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); //create camera
// set camera position 
camera.position.x = 100;
var canvas = document.getElementById("threeCanvas");
var renderer = new THREE.WebGLRenderer({
    preserveDrawingBuffer: true,
    alpha: true,
    antialias: true,
    canvas: canvas
});
renderer.setSize(window.innerWidth, window.innerHeight); //set size of renderer - where actions are recognized
document.body.appendChild(renderer.domElement); //add renderer to document body
const colorbarCanvas = document.getElementById("colorbarCanvas");
const colorbarRenderer = new THREE.WebGLRenderer({
    canvas: colorbarCanvas,
    alpha: true
});
colorbarRenderer.setClearColor(0x000000, 0);
const colorbarCamera = new THREE.OrthographicCamera(-7, 7, 1.8, -2.5, -1, 1);
const colorbarScene = new THREE.Scene();
// set scene lighting 
// Lights are in a tetrahedron of side length 200 around the origin.
var lights = [];
lights[0] = new THREE.PointLight(0xffffff, 0.85, 0);
lights[1] = new THREE.PointLight(0xffffff, 0.85, 0);
lights[2] = new THREE.PointLight(0xffffff, 0.85, 0);
lights[3] = new THREE.PointLight(0xffffff, 0.85, 0);
lights[0].position.set(0, 0, 4 * -200);
lights[1].position.set(4 * 94, 4 * 163, 4 * 67);
lights[2].position.set(4 * 94, 4 * -163, 4 * 67);
lights[3].position.set(4 * -189, 0, 4 * 67);
scene.add(lights[0]);
scene.add(lights[1]);
scene.add(lights[2]);
scene.add(lights[3]);
//Add coordinate axes to scene
let dir = new THREE.Vector3(1, 0, 0);
let Origin = new THREE.Vector3(0, 0, 0);
var length = 10;
let arrowHelper = new THREE.ArrowHelper(dir, Origin, length, 0x800000); //create x-axis arrow
arrowHelper.name = "x-axis";
scene.add(arrowHelper); //add x-axis arrow to scene
dir = new THREE.Vector3(0, 1, 0);
arrowHelper = new THREE.ArrowHelper(dir, Origin, length, 0x008000);
arrowHelper.name = "y-axis";
scene.add(arrowHelper); //add y-axis arrow to scene
dir = new THREE.Vector3(0, 0, 1);
arrowHelper = new THREE.ArrowHelper(dir, Origin, length, 0x000080);
arrowHelper.name = "z-axis";
scene.add(arrowHelper); //add z-axis to scene
function toggleArrows(chkBox) {
    if (chkBox.checked) {
        let arrowHelper = scene.getObjectByName("x-axis");
        arrowHelper.visible = true;
        arrowHelper = scene.getObjectByName("y-axis");
        arrowHelper.visible = true;
        arrowHelper = scene.getObjectByName("z-axis");
        arrowHelper.visible = true;
    }
    else { //if not checked, set all axes to invisible
        let arrowHelper = scene.getObjectByName("x-axis");
        arrowHelper.visible = false;
        arrowHelper = scene.getObjectByName("y-axis");
        arrowHelper.visible = false;
        arrowHelper = scene.getObjectByName("z-axis");
        arrowHelper.visible = false;
    }
    render(); //update scene
}
// snippet borrowed from three.js examples 
// adding mouse control to the scene 
//var orbit = new THREE.OrbitControls( camera, renderer.domElement );
//orbit.addEventListener('change', render);
var controls = new THREE.TrackballControls(camera, canvas);
controls.rotateSpeed = 1.5;
controls.zoomSpeed = 2; //frequently structures are large so turned this up
controls.panSpeed = 1.5;
controls.noZoom = false;
controls.noPan = false;
controls.staticMoving = true;
controls.dynamicDampingFactor = 0.2;
controls.keys = [65, 83, 68];
// following the logic of updating the scene only when the scene changes 
// controlls induce change so we update the scene when we move it  
controls.addEventListener('change', render);
// Set up DragControls - allows dragging of DNA - if action mode includes "drag"
// Also handles box selection
let dragControls = new THREE.DragControls(camera, renderer.domElement);
// start animation cycle / actually control update cycle 
// requestAnimationFrame could be replaced with a 
// timer event as it is misleading. 
animate();
