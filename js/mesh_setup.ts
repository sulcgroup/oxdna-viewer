/// <reference path="./three/index.d.ts" />

// base geometry 
var backbone_geometry = new THREE.SphereGeometry(.2,10,10);
var nucleoside_geometry = new THREE.SphereGeometry(.3,10,10).applyMatrix(
        new THREE.Matrix4().makeScale( 0.7, 0.3, 0.7 ));
var connector_geometry = new THREE.CylinderGeometry(.1,.1,1, 8);


// define strand colors //Grey for testing
var backbone_materials = [
    new THREE.MeshLambertMaterial({
        color: 0x156289,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xFF0089,
        side: THREE.DoubleSide,
    }),
    new THREE.MeshLambertMaterial({
        color: 0xFFFF00,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0x00FF00,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0x00FFFF,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xDA9100,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
        //flatShading: true
    })
];

// define nucleoside colors: grey OR traditional colors
var nucleoside_materials = [
    new THREE.MeshLambertMaterial({ //A
        //color: 0x3333FF, //neon blue
        color: 0x888888,//6dc066,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //G
        //color: 0xFFFF33, //yellow; "gorse"
        color: 0x888888,//ff6600,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //C
        //color: 0x33FF33, //lime green
        color: 0x888888,//0x4286f4,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //T/U
        //color: 0xFF3333, //red orange
        color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    })
];

var selection_material = new THREE.MeshLambertMaterial({
    color: 0x01796F, //pine green //000000, //black - no visible shadow/depth
    side: THREE.DoubleSide,
});

