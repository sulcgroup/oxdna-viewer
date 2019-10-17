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
var GREY =  new THREE.Color(0x888888);
var BLACK = new THREE.Color(0x000000);
var WHITE = new THREE.Color();
var scene = new THREE.Scene();
scene.background = WHITE

var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); //create camera

// set camera position 
camera.position.x = 100;

// import canvas capture library
declare var CCapture: any;

var canvas = <HTMLCanvasElement> document.getElementById("threeCanvas");
var renderer = new THREE.WebGLRenderer({ //create renderer
    preserveDrawingBuffer: true,
    alpha: true,
    antialias: true,
    canvas: canvas
});

renderer.setSize(window.innerWidth, window.innerHeight); //set size of renderer - where actions are recognized
document.body.appendChild(renderer.domElement); //add renderer to document body

const colorbarCanvas = <HTMLCanvasElement> document.getElementById("colorbarCanvas");
const colorbarRenderer = new THREE.WebGLRenderer({
    canvas: colorbarCanvas,
    alpha: true
});
colorbarRenderer.setClearColor(0x000000, 0);
const colorbarCamera = new THREE.OrthographicCamera(-7, 7, 1.8, -2.5, -1, 1);
const colorbarScene = new THREE.Scene();

// set scene lighting 
let hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.5 );
scene.add( hemiLight );

let pointlight = new THREE.PointLight(0xffffff, 0.5, 0);
pointlight.position.set(0, 50, 0);
camera.add(pointlight);
scene.add(camera);

//Add coordinate axes to scene
let dir = new THREE.Vector3(1, 0, 0);
let Origin = new THREE.Vector3(0, 0, 0);
var length: number = 10;
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

function toggleArrows(chkBox) { //make arrows visible or invisible based on checkbox - functionality added to allow for cleaner images
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
