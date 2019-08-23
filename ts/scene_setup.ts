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
    console.log(renderer.info.render.calls)
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
// default is white
var BLACK = new THREE.Color(0x000000);
var WHITE = new THREE.Color();
scene.background = WHITE

var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); //create camera

// set camera position 
camera.position.x = 100;

// import canvas capture library
declare var CCapture: any;

var canvas = <HTMLCanvasElement> document.getElementById("threeCanvas");
var renderer = new THREE.WebGLRenderer({ //create renderer
    alpha: true,
    antialias: true,
    canvas: canvas
});

renderer.setSize(window.innerWidth, window.innerHeight); //set size of renderer - where actions are recognized
document.body.appendChild(renderer.domElement); //add renderer to document body

// set scene lighting 

//var light = new THREE.AmbientLight(0x404040);
//light.intensity = 3;
//scene.add(light);
var lights: THREE.PointLight[] = [];
lights[0] = new THREE.PointLight(0xffffff, 0.85, 0);
lights[1] = new THREE.PointLight(0xffffff, 0.85, 0);
lights[2] = new THREE.PointLight(0xffffff, 0.85, 0);
lights[3] = new THREE.PointLight(0xffffff, 0.85, 0);

lights[0].position.set(0, 0, 4*-200);
lights[1].position.set(4*94, 4*163, 4*67);
lights[2].position.set(4*94, 4*-163, 4*67);
lights[3].position.set(4*-189, 0, 4*67);

scene.add(lights[0]);
scene.add(lights[1]);
scene.add(lights[2]);
scene.add(lights[3]);


//Add arrows to scene to add reference location for DNA/RNA in scene
let dir = new THREE.Vector3(1, 0, 0); //direction for x-axis
dir.normalize(); //normalize the direction vector (convert to vector of length 1) - although already length 1
let Origin = new THREE.Vector3(0, 0, 0);
var length: number = 10;
let hex = 0x000080; //arrow colors
let arrowHelper = new THREE.ArrowHelper(dir, Origin, length, hex); //create x-axis arrow
arrowHelper.name = "x-axis";
scene.add(arrowHelper); //add x-axis arrow to scene
dir = new THREE.Vector3(0, 1, 0); //direction for y-axis
dir.normalize(); //normalize the direction vector (convert to vector of length 1) - although already length 1
arrowHelper = new THREE.ArrowHelper(dir, Origin, length, hex);
arrowHelper.name = "y-axis";
scene.add(arrowHelper); //add y-axis arrow to scene
dir = new THREE.Vector3(0, 0, 1); //direction for z-axis
dir.normalize(); //normalize the direction vector (convert to vector of length 1) - although already length 1
arrowHelper = new THREE.ArrowHelper(dir, Origin, length, hex);
arrowHelper.name = "z-axis";
scene.add(arrowHelper); //add z-axis to scene

function toggleArrows(chkBox) { //make arrows visible or invisible based on checkbox - functionality added to allow for cleaner images
    if (chkBox.checked) { //if checked, set all axes to visible
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
controls.zoomSpeed = 1.5;
controls.panSpeed = 1.0;
controls.noZoom = false;
controls.noPan = false;
controls.staticMoving = true;
controls.dynamicDampingFactor = 0.2;
controls.keys = [65, 83, 68];
// following the logic of updating the scene only when the scene changes 
// controlls induce change so we update the scene when we move it  
controls.addEventListener('change', render);

// start animation cycle / actually control update cycle 
// requestAnimationFrame could be replaced with a 
// timer event as it is misleading. 
animate();
