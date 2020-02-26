// Add VR functionalities
// ...should be rewritten to typescript when
// renderer.vr definitions are there

// Create rig to be able to rotate the camera
// in code. Otherwise, the camera is fixed 
var rig = new THREE.PerspectiveCamera();
rig.add(camera);
scene.add(rig);

// Add vr button to document
document.body.appendChild(VRButton.createButton(renderer));

// Enamble VR in renderer
renderer.vr.enabled = true;

// Make the camera go around the scene
// (looks like the model is rotating)
// Perhaps not needed for 6-DoF devices
var rotation = 0;
renderer.setAnimationLoop(function(){
    rotation += 0.001;
    rig.position.x = Math.sin(rotation) * 5;
    rig.position.z = Math.cos(rotation) * 5;
    rig.lookAt(new THREE.Vector3(0,0,0));
    renderer.render(scene, camera);
});

// Make controller click go to next config
const selectListener = (event) => {
    trajReader.nextConfig();
};
const controller = renderer.vr.getController(0);
controller.addEventListener('select', selectListener);