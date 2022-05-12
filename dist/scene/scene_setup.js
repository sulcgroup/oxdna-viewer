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
    pointlight.position.copy(camera.position);
    renderer.render(scene, camera);
    //renderer.render(pickingScene, camera);
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
    if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    }
    if (camera instanceof THREE.OrthographicCamera) {
        let frustumSize = camera.left / aspect * -2;
        aspect = window.innerWidth / window.innerHeight;
        camera.left = frustumSize * aspect / -2;
        camera.right = frustumSize * aspect / 2;
        camera.top = frustumSize / 2;
        camera.bottom = -frustumSize / 2;
        camera.updateProjectionMatrix();
    }
    // updates the visible scene 
    renderer.setSize(window.innerWidth, window.innerHeight);
    // updates the picker texture to match the renderer 
    pickingTexture.setSize(window.innerWidth, window.innerHeight);
    controls.handleResize();
    view.updateImageResolutionText();
    render();
}
let camera;
let aspect = window.innerWidth / window.innerHeight;
function createPerspectiveCamera(fov, near, far, pos) {
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(pos[0], pos[1], pos[2]);
    return camera;
}
function createOrthographicCamera(left, right, top, bottom, near, far, pos) {
    const camera = new THREE.OrthographicCamera(left, right, top, bottom, near, far);
    camera.position.set(pos[0], pos[1], pos[2]);
    return camera;
}
//Setup the scene and renderer and camera 
const GREY = new THREE.Color(0x888888);
const BLACK = new THREE.Color(0x000000);
const WHITE = new THREE.Color();
const scene = new THREE.Scene();
camera = createPerspectiveCamera(45, 0.1, 999999, [100, 0, 0]); //create camera
const refQ = camera.quaternion.clone();
// Create canvas and renderer
const canvas = document.getElementById("threeCanvas");
var renderer = new THREE.WebGLRenderer({
    preserveDrawingBuffer: true,
    alpha: true,
    antialias: true,
    canvas: canvas
});
renderer.setClearColor(0x000000, 0);
renderer.setSize(window.innerWidth, window.innerHeight); //set size of renderer - where actions are recognized
document.body.appendChild(canvas); //add renderer to document body
// Colorbars are rendered on a second canvas
const colorbarCanvas = document.getElementById("colorbarCanvas");
const colorbarRenderer = new THREE.WebGLRenderer({
    canvas: colorbarCanvas,
    alpha: true
});
colorbarRenderer.setClearColor(0x000000, 0);
const colorbarCamera = new THREE.OrthographicCamera(-7, 7, 1.8, -2.5, -1, 1);
const colorbarScene = new THREE.Scene();
// set scene lighting 
// The point light follows the camera so lighting is always uniform.
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.1);
scene.add(hemiLight);
const pointlight = new THREE.PointLight(0xffffff, 1.1, 0);
pointlight.position.copy(camera.position);
//pointlight.position.set(0, 50, 0);
//camera.add(pointlight);
scene.add(pointlight);
scene.add(camera);
// Add coordinate axes to scene
let dir = new THREE.Vector3(1, 0, 0);
const Origin = new THREE.Vector3(0, 0, 0);
const len = 10;
let arrowHelper = new THREE.ArrowHelper(dir, Origin, len, 0x800000); //create x-axis arrow
arrowHelper.name = "x-axis";
scene.add(arrowHelper); //add x-axis arrow to scene
dir = new THREE.Vector3(0, 1, 0);
arrowHelper = new THREE.ArrowHelper(dir, Origin, len, 0x008000);
arrowHelper.name = "y-axis";
scene.add(arrowHelper); //add y-axis arrow to scene
dir = new THREE.Vector3(0, 0, 1);
arrowHelper = new THREE.ArrowHelper(dir, Origin, len, 0x000080);
arrowHelper.name = "z-axis";
scene.add(arrowHelper); //add z-axis to scene
// Declare bounding box object
let boxObj;
function toggleBox(chkBox) {
    if (chkBox.checked) {
        // Redraw from scratch, in case it has changed size
        redrawBox();
    }
    if (boxObj) {
        boxObj.visible = chkBox.checked;
    }
    render();
}
function redrawBox() {
    let visible;
    if (boxObj) {
        visible = boxObj.visible;
        scene.remove(boxObj);
    }
    else {
        visible = false;
    }
    boxObj = drawBox(box, getCenteringGoal());
    boxObj.visible = visible;
}
// Remove coordinate axes from scene.  Hooked to "Display Arrows" checkbox on sidebar.
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
function setFog(near, far) {
    near = near | view.getInputNumber("fogNear");
    far = near | view.getInputNumber("fogFar");
    let color = new THREE.Color(view.getInputValue('backgroundColor')).getHex();
    scene.fog = new THREE.Fog(color, near, far);
    render();
}
function toggleFog(near, far) {
    if (scene.fog == null) {
        setFog(near, far);
    }
    else {
        scene.fog = null;
    }
    render();
}
function drawBox(size, position) {
    if (!position) {
        position = box.clone().divideScalar(2);
    }
    let material = new THREE.LineBasicMaterial({ color: GREY });
    let points = [];
    let a = position.clone().sub(size.clone().divideScalar(2));
    let b = size.clone().add(a);
    let f = (xComp, yComp, zComp) => {
        return new THREE.Vector3(xComp.x, yComp.y, zComp.z);
    };
    // I'm sure there's a clever way to do this in a loop...
    points.push(f(a, a, a));
    points.push(f(b, a, a));
    points.push(f(a, a, b));
    points.push(f(b, a, b));
    points.push(f(a, b, a));
    points.push(f(b, b, a));
    points.push(f(a, b, b));
    points.push(f(b, b, b));
    points.push(f(a, a, a));
    points.push(f(a, b, a));
    points.push(f(a, a, b));
    points.push(f(a, b, b));
    points.push(f(b, a, a));
    points.push(f(b, b, a));
    points.push(f(b, a, b));
    points.push(f(b, b, b));
    points.push(f(a, a, b));
    points.push(f(a, a, a));
    points.push(f(a, b, b));
    points.push(f(a, b, a));
    points.push(f(b, a, b));
    points.push(f(b, a, a));
    points.push(f(b, b, b));
    points.push(f(b, b, a));
    var geometry = new THREE.BufferGeometry().setFromPoints(points);
    var boxObj = new THREE.LineSegments(geometry, material);
    scene.add(boxObj);
    return boxObj;
}
// adding mouse control to the scene 
const controls = new THREE.TrackballControls(camera, canvas);
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
const transformControls = new THREE.TransformControls(camera, renderer.domElement);
transformControls.addEventListener('change', render);
scene.add(transformControls);
transformControls.addEventListener('dragging-changed', function (event) {
    controls.enabled = !event['value'];
});
// start animation cycle / actually control update cycle 
// requestAnimationFrame could be replaced with a 
// timer event as it is misleading. 
animate();
