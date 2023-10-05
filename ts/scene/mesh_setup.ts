/// <reference path="../typescript_definitions/index.d.ts" />

// The initial set up of the instanced objects.
// Objects can be deformed by parameters sent to the instanceScale parameter of the instance
var instancedBackbone = new THREE.InstancedBufferGeometry();
instancedBackbone.copy(new THREE.SphereBufferGeometry(.2,10,10) as unknown as THREE.InstancedBufferGeometry); //don't worry about those type conversion, just trying to keep tsc happy

var instancedNucleoside = new THREE.InstancedBufferGeometry();
instancedNucleoside.copy(new THREE.SphereBufferGeometry(.3,10,10) as unknown as THREE.InstancedBufferGeometry);

var instancedConnector = new THREE.InstancedBufferGeometry();
instancedConnector.copy(new THREE.CylinderBufferGeometry(.1,.1,1, 8) as unknown as THREE.InstancedBufferGeometry);

var instancedBBconnector = new THREE.InstancedBufferGeometry();
instancedBBconnector.copy(new THREE.CylinderBufferGeometry(.1,.02,1, 8) as unknown as THREE.InstancedBufferGeometry);

var instanceMaterial2 = new THREE.MeshPhysicalMaterial( {
   vertexColors: THREE.VertexColors,
	metalness: 0.1,
	roughness: 0.6,
	reflectivity: 1.0,
});

var instanceMaterial = new THREE.MeshLambertMaterial( {
   vertexColors: THREE.VertexColors,
});


// Tell the webGL compiler that meshes using the instanceMaterial should execute the instancing portion of the code.
instanceMaterial["defines"] = instanceMaterial["defines"] || {};
instanceMaterial["defines"][ 'INSTANCED' ] = "";

// Tell the webGL compiler that meshes using the instanceMaterial should execute the instancing portion of the code.
instanceMaterial2["defines"] = instanceMaterial2["defines"] || {};
instanceMaterial2["defines"][ 'INSTANCED' ] = "";

let instanceMaterial3 = instanceMaterial2.clone()
instanceMaterial3["defines"] = instanceMaterial3["defines"] || {};
instanceMaterial3["defines"][ 'INSTANCED' ] = "";

function switchMaterial(material){
   systems.forEach(s=>{
      s.backbone.material = material;
      s.nucleoside.material = material;
      s.connector.material = material;
      s.bbconnector.material = material;
   });
   render();
}

// Default colors for the backbones
var backboneColors = [
    new THREE.Color(0xfdd291), //light yellow
    
    new THREE.Color(0xffb322), //goldenrod

    new THREE.Color(0x437092), //dark blue

    new THREE.Color(0x6ea4cc), //light blue
    ];



// define nucleoside colors
var nucleosideColors = [
    new THREE.Color(0x4747B8), //A or K; Royal Blue

    new THREE.Color(0xFFFF33), //G or C; Medium Yellow
    
     //C or A
        new THREE.Color(0x8CFF8C), //Medium green

     //T/U or T
        new THREE.Color(0xFF3333), //Red

     //E
        new THREE.Color(0x660000), //Dark Brown

     //S
        new THREE.Color(0xFF7042), //Medium Orange

     //D
        new THREE.Color(0xA00042), //Dark Rose

     //N
        new THREE.Color(0xFF7C70), //Light Salmon

     //Q
        new THREE.Color(0xFF4C4C), //Dark Salmon

     //H
        new THREE.Color(0x7070FF), //Medium Blue

     //G
        new THREE.Color(0xEBEBEB), // light GREY

     //P
        new THREE.Color(0x525252), //Dark Grey

     //R
        new THREE.Color(0x00007C), //Dark Blue

     //V
        new THREE.Color(0x5E005E), //Dark Purple

     //I
        new THREE.Color(0x004C00), //Dark Green

     //L
        new THREE.Color(0x455E45), //Olive Green

     //M
        new THREE.Color(0xB8A042), //Light Brown

     //F
        new THREE.Color(0x534C42), //Olive Grey

     //Y
        new THREE.Color(0x8C704C), //Medium Brown

     //W
        new THREE.Color(0x4F4600), //Olive Brown

];

var selectionColor = new THREE.Color(0xFF00FF); //PINK!

//Get a distinct color for each consecutive integer
function colorFromInt(number) {
   const hue = number * 137.508; // use golden angle approximation
   return new THREE.Color(`hsl(${hue},50%,65%)`);
}