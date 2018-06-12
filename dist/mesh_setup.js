// <reference path="./three/index.d.ts" />
// base geometry 
var backbone_geometry = new THREE.SphereGeometry(.2, 10, 10);
var nucleoside_geometry = new THREE.SphereGeometry(.3, 10, 10).applyMatrix(new THREE.Matrix4().makeScale(0.7, 0.3, 0.7));
var connector_geometry = new THREE.CylinderGeometry(.1, .1, 1, 8);
// define strand colors 
var backbone_materials = [
    new THREE.MeshLambertMaterial({
        color: 0x156289,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
    }),
    new THREE.MeshLambertMaterial({
        color: 0xFF0089,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
    }),
    new THREE.MeshLambertMaterial({
        color: 0xFFFF00,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
    }),
    new THREE.MeshLambertMaterial({
        color: 0x00FF00,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
    }),
    new THREE.MeshLambertMaterial({
        color: 0x00FFFF,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
    }),
    new THREE.MeshLambertMaterial({
        color: 0xDA9100,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
    })
];
// define nucleoside colors
var nucleoside_materials = [
    new THREE.MeshLambertMaterial({
        //color: 0x3333FF,
        color: 0x888888,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
    }),
    new THREE.MeshLambertMaterial({
        //color: 0xFFFF33,
        color: 0x888888,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
    }),
    new THREE.MeshLambertMaterial({
        //color: 0x33FF33,
        color: 0x888888,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
    }),
    new THREE.MeshLambertMaterial({
        //color: 0xFF3333,
        color: 0x888888,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
    })
];
var selection_material = new THREE.MeshLambertMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
});
