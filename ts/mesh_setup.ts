/// <reference path="./three/index.d.ts" />

// base geometry 
var backbone_geometry = new THREE.SphereGeometry(.2,10,10);
var nucleoside_geometry = new THREE.SphereGeometry(.3,10,10).applyMatrix(
        new THREE.Matrix4().makeScale( 0.7, 0.3, 0.7 ));
var connector_geometry = new THREE.CylinderGeometry(.1,.1,1, 8);


0xfdd291	
0xffb322	
0x437092	
0x6ea4cc	
0x517dc7

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
    }),];

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
    new THREE.MeshLambertMaterial({ //A or R
        color: 0x3333FF, //neon blue
        //color: 0x888888,//6dc066,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //G or H
        color: 0xFFFF33, //yellow; "gorse"
        //color: 0x888888,//ff6600,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //C or K
        color: 0x33FF33, //lime green
        //color: 0x888888,//0x4286f4,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //T/U or D
        color: 0xFF3333, //red orange
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //E
        color: 0xE60A0A, //bright red
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //S
        color: 0xFA9600, //orange
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //T
        color: 0x3232AA, //mid blue
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //N
        color: 0xE60A0A, //bright red
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //Q
        color: 0x00DCDC, //cyan
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //C
        color: 0xE6E600, //yellow
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //G
        color: 0xEBEBEB, // light grey
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //P
        color: 0xDC9682, //peach
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //A
        color: 0xC8C8C8, //dark grey
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //V
        color: 0x0F820F, //green
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //I
        color: 0x0F820F, //green
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //L
        color: 0x0F820F, //green
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //M
        color: 0xE6E600, //yellow
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //F
        color: 0xFF3333, //red orange
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //Y
        color: 0x3232AA, //mid blue
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    }),
    new THREE.MeshLambertMaterial({ //W
        color: 0xB45AB4, //pink
        //color: 0x888888,//ff0033,
        side: THREE.DoubleSide
    })
];

var selection_material = new THREE.MeshLambertMaterial({
    color: 0x01796F, //pine green //000000, //black - no visible shadow/depth
    side: THREE.DoubleSide,
});

