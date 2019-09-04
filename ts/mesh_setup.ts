/// <reference path="./three/index.d.ts" />

// base geometry 
//var intersectsScene = new THREE.Scene()
//var instanced_backbone = new THREE.InstancedBufferGeometry()
//window['instanced_backbone'] = instanced_backbone;
//var instanced_connector = new THREE.InstancedBufferGeometry()
//var backbone_geometry = new THREE.SphereBufferGeometry(.2,10,10);
//var nucleoside_geometry = new THREE.SphereBufferGeometry(.3,10,10).applyMatrix(
//        new THREE.Matrix4().makeScale( 0.7, 0.3, 0.7 ));
//var connector_geometry = new THREE.CylinderBufferGeometry(.1,.1,1, 8);

//Object.keys(backbone_geometry.attributes).forEach(attributeName=>{
//    instanced_backbone.attributes[attributeName] = backbone_geometry.attributes[attributeName]
//})
//instanced_backbone.index = backbone_geometry.index;

var instanced_backbone = new THREE.InstancedBufferGeometry();
instanced_backbone.copy(new THREE.SphereBufferGeometry(.2,10,10));

var instanced_nucleoside = new THREE.InstancedBufferGeometry();
instanced_nucleoside.copy(new THREE.SphereBufferGeometry(.3,10,10));

var instanced_connector = new THREE.InstancedBufferGeometry();
instanced_connector.copy(new THREE.CylinderBufferGeometry(.1,.1,1, 8));

var instanced_bbconnector = new THREE.InstancedBufferGeometry();
instanced_bbconnector.copy(new THREE.CylinderBufferGeometry(.1,.1,1, 8));

var instance_material = new THREE.MeshLambertMaterial( {
    vertexColors: THREE.VertexColors
});

instance_material.defines = instance_material.defines || {};
instance_material.defines[ 'INSTANCED' ] = "";

var backbone_colors = [
    new THREE.Color(0xff00ff),
    
    new THREE.Color(0xffb322),

    new THREE.Color(0x437092),

    new THREE.Color(0x6ea4cc),
    
    new THREE.Color(0x517dc7),
    ];



// define nucleoside colors: grey OR traditional colors
var nucleoside_colors = [
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
        new THREE.Color(0xEBEBEB), // light grey

     //P
        new THREE.Color(0xDC9682), //peach

     //A
        new THREE.Color(0xC8C8C8), //dark grey

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

var selection_color = new THREE.Color(0x01796F); //pine green


var grey_material =  new THREE.Color(0x888888);


