/// <reference path="./three/index.d.ts" />
// base geometry 
var backbone_geometry = new THREE.SphereBufferGeometry(.2, 10, 10);
var nucleoside_geometry = new THREE.SphereBufferGeometry(.3, 10, 10).applyMatrix(new THREE.Matrix4().makeScale(0.7, 0.3, 0.7));
var connector_geometry = new THREE.CylinderBufferGeometry(.1, .1, 1, 8);
var backbone_materials = [
    new THREE.MeshLambertMaterial({
        color: 0xfdd291,
        side: THREE.DoubleSide,
    }),
    new THREE.MeshLambertMaterial({
        color: 0xffb322,
        side: THREE.DoubleSide,
    }),
    new THREE.MeshLambertMaterial({
        color: 0x437092,
        side: THREE.DoubleSide,
    }),
    new THREE.MeshLambertMaterial({
        color: 0x6ea4cc,
        side: THREE.DoubleSide,
    }),
    new THREE.MeshLambertMaterial({
        color: 0x517dc7,
        side: THREE.DoubleSide,
    }),
];
// define nucleoside colors: grey OR traditional colors
var nucleoside_materials = [
    new THREE.MeshLambertMaterial({
        color: 0x3333FF,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xFFFF33,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0x33FF33,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xFF3333,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xE60A0A,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xFA9600,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0x3232AA,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xE60A0A,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0x00DCDC,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xE6E600,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xEBEBEB,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xDC9682,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xC8C8C8,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0x0F820F,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0x0F820F,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0x0F820F,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xE6E600,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xFF3333,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0x3232AA,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xB45AB4,
        side: THREE.DoubleSide
    })
];
var selection_material = new THREE.MeshLambertMaterial({
    color: 0x01796F,
    side: THREE.DoubleSide,
});
var grey_material = new THREE.MeshLambertMaterial({
    color: 0x888888,
    side: THREE.DoubleSide
});
