/// <reference path="./three/index.d.ts" />
var instancedBackbone = new THREE.InstancedBufferGeometry();
instancedBackbone.copy(new THREE.SphereBufferGeometry(.2, 10, 10)); //don't worry about those type conversion, just trying to keep tsc happy
var instancedNucleoside = new THREE.InstancedBufferGeometry();
instancedNucleoside.copy(new THREE.SphereBufferGeometry(.3, 10, 10));
var instancedConnector = new THREE.InstancedBufferGeometry();
instancedConnector.copy(new THREE.CylinderBufferGeometry(.1, .1, 1, 8));
var instancedBBconnector = new THREE.InstancedBufferGeometry();
instancedBBconnector.copy(new THREE.CylinderBufferGeometry(.1, .1, 1, 8));
var instanceMaterial = new THREE.MeshLambertMaterial({
    vertexColors: THREE.VertexColors
});
instanceMaterial["defines"] = instanceMaterial["defines"] || {};
instanceMaterial["defines"]['INSTANCED'] = "";
var backboneColors = [
    new THREE.Color(0xfdd291),
    new THREE.Color(0xffb322),
    new THREE.Color(0x437092),
    new THREE.Color(0x6ea4cc),
];
// define nucleoside colors: GREY OR traditional colors
var nucleosideColors = [
    new THREE.Color(0x3333FF),
    new THREE.Color(0xFFFF33),
    //C or K
    new THREE.Color(0x33FF33),
    //T/U or D
    new THREE.Color(0xFF3333),
    //E
    new THREE.Color(0xE60A0A),
    //S
    new THREE.Color(0xFA9600),
    //T
    new THREE.Color(0x3232AA),
    //N
    new THREE.Color(0xE60A0A),
    //Q
    new THREE.Color(0x00DCDC),
    //C
    new THREE.Color(0xE6E600),
    //G
    new THREE.Color(0xEBEBEB),
    //P
    new THREE.Color(0xDC9682),
    //A
    new THREE.Color(0xC8C8C8),
    //V
    new THREE.Color(0x0F820F),
    //I
    new THREE.Color(0x0F820F),
    //L
    new THREE.Color(0x0F820F),
    //M
    new THREE.Color(0xE6E600),
    //F
    new THREE.Color(0xFF3333),
    //Y
    new THREE.Color(0x3232AA),
    //W
    new THREE.Color(0xB45AB4),
];
var selectionColor = new THREE.Color(0xFF00FF); //PINK!
