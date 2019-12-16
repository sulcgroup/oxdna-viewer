/// <reference path="./three/index.d.ts" />

// The initial set up of the instanced objects.
// Objects can be deformed by parameters sent to the instanceScale parameter of the instance
var instancedBackbone = new THREE.InstancedBufferGeometry();
instancedBackbone.copy(new THREE.SphereBufferGeometry(.2,10,10) as unknown as THREE.InstancedBufferGeometry); //don't worry about those type conversion, just trying to keep tsc happy

var instancedNucleoside = new THREE.InstancedBufferGeometry();
instancedNucleoside.copy(new THREE.SphereBufferGeometry(.3,10,10) as unknown as THREE.InstancedBufferGeometry);

var instancedConnector = new THREE.InstancedBufferGeometry();
instancedConnector.copy(new THREE.CylinderBufferGeometry(.1,.1,1, 8) as unknown as THREE.InstancedBufferGeometry);

var instancedBBconnector = new THREE.InstancedBufferGeometry();
instancedBBconnector.copy(new THREE.CylinderBufferGeometry(.1,.05,1, 8) as unknown as THREE.InstancedBufferGeometry);

var instanceMaterial = new THREE.MeshLambertMaterial( {
    vertexColors: THREE.VertexColors
});

// Tell the webGL compiler that meshes using the instanceMaterial should execute the instancing portion of the code.
instanceMaterial["defines"] = instanceMaterial["defines"] || {};
instanceMaterial["defines"][ 'INSTANCED' ] = "";

// Default colors for the backbones
var backboneColors = [
    new THREE.Color(0xfdd291), //light yellow
    
    new THREE.Color(0xffb322), //goldenrod

    new THREE.Color(0x437092), //dark blue

    new THREE.Color(0x6ea4cc), //light blue
    ];



// define nucleoside colors
var nucleosideColors = [
    new THREE.Color(0x3333FF), //A or R

    new THREE.Color(0xFFFF33), //G or H yellow; "gorse"
    
     //C or K
        new THREE.Color(0x33FF33), //lime green

     //T/U or D
        new THREE.Color(0xFF3333), //red orange

     //E
        new THREE.Color(0xE60A0A), //bright red

     //S
        new THREE.Color(0xFA9600), //orange

     //T
        new THREE.Color(0x3232AA), //mid blue

     //N
        new THREE.Color(0xE60A0A), //bright red

     //Q
        new THREE.Color(0x00DCDC), //cyan

     //C
        new THREE.Color(0xE6E600), //yellow

     //G
        new THREE.Color(0xEBEBEB), // light GREY

     //P
        new THREE.Color(0xDC9682), //peach

     //A
        new THREE.Color(0xC8C8C8), //dark GREY

     //V
        new THREE.Color(0x0F820F), //green

     //I
        new THREE.Color(0x0F820F), //green

     //L
        new THREE.Color(0x0F820F), //green

     //M
        new THREE.Color(0xE6E600), //yellow

     //F
        new THREE.Color(0xFF3333), //red orange

     //Y
        new THREE.Color(0x3232AA), //mid blue

     //W
        new THREE.Color(0xB45AB4), //pink

];

var selectionColor = new THREE.Color(0xFF00FF); //PINK!


