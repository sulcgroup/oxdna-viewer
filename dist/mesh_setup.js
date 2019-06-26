/// <reference path="./three/index.d.ts" />
// base geometry 
var backbone_geometry = new THREE.SphereGeometry(.2, 10, 10);
var nucleoside_geometry = new THREE.SphereGeometry(.3, 10, 10).applyMatrix(new THREE.Matrix4().makeScale(0.7, 0.3, 0.7));
var connector_geometry = new THREE.CylinderGeometry(.1, .1, 1, 8);
0xfdd291;
0xffb322;
0x437092;
0x6ea4cc;
0x517dc7;
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
// define strand colors    
//var backbone_materials = [
//    //new THREE.MeshLambertMaterial({
//    //    color: 0xD44848,
//    //    side: THREE.DoubleSide,
//    //}),
//    new THREE.MeshLambertMaterial({
//        color: 0x4C7489,
//        side: THREE.DoubleSide
//    }),
//    new THREE.MeshLambertMaterial({
//        color: 0x78D984,
//        side: THREE.DoubleSide
//    }),
//    
//    new THREE.MeshLambertMaterial({
//        color: 0xF7D412,
//        side: THREE.DoubleSide
//    }),
//    new THREE.MeshLambertMaterial({
//        color: 0x6AC4D4,
//        side: THREE.DoubleSide
//    }),
//    new THREE.MeshLambertMaterial({
//        color: 0xCE9B47,
//        side: THREE.DoubleSide,
//    })
//];
// define nucleoside colors: grey OR traditional colors
var nucleoside_materials = [
    new THREE.MeshLambertMaterial({
        color: 0x3333FF,
        //color: 0x888888,//6dc066,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xFFFF33,
        //color: 0x888888,//ff6600,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0x33FF33,
        //color: 0x888888,//0x4286f4,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xFF3333,
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xE60A0A,
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xFA9600,
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0x3232AA,
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xE60A0A,
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0x00DCDC,
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xE6E600,
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xEBEBEB,
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xDC9682,
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xC8C8C8,
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0x0F820F,
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0x0F820F,
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0x0F820F,
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xE6E600,
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xFF3333,
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0x3232AA,
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xB45AB4,
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    })
];
var selection_material = new THREE.MeshLambertMaterial({
    color: 0x01796F,
    side: THREE.DoubleSide,
});
