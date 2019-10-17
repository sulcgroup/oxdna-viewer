/// <reference path="./three/index.d.ts" />

var instanced_backbone = new THREE.InstancedBufferGeometry();
instanced_backbone.copy(new THREE.SphereBufferGeometry(.2,10,10) as unknown as THREE.InstancedBufferGeometry); //don't worry about those type conversion, just trying to keep tsc happy

var instanced_nucleoside = new THREE.InstancedBufferGeometry();
instanced_nucleoside.copy(new THREE.SphereBufferGeometry(.3,10,10) as unknown as THREE.InstancedBufferGeometry);

var instanced_connector = new THREE.InstancedBufferGeometry();
instanced_connector.copy(new THREE.CylinderBufferGeometry(.1,.1,1, 8) as unknown as THREE.InstancedBufferGeometry);

var instanced_bbconnector = new THREE.InstancedBufferGeometry();
instanced_bbconnector.copy(new THREE.CylinderBufferGeometry(.1,.1,1, 8) as unknown as THREE.InstancedBufferGeometry);

var instance_material = new THREE.MeshLambertMaterial( {
    vertexColors: THREE.VertexColors
});

instance_material["defines"] = instance_material["defines"] || {};
instance_material["defines"][ 'INSTANCED' ] = "";

var backboneColors = [
    new THREE.Color(0xfdd291), //light yellow
    
    new THREE.Color(0xffb322), //goldenrod

    new THREE.Color(0x437092), //dark blue

    new THREE.Color(0x6ea4cc), //light blue
    ];



// define nucleoside colors: GREY OR traditional colors
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


