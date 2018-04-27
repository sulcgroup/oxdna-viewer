//Setup the scene and renderer and camera 
var scene = new THREE.Scene();
// make the background white 
// default is black
scene.background = new THREE.Color();

var camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );

// set camera position 
camera.position.z = 100;


var renderer = new THREE.WebGLRenderer({
    preserveDrawingBuffer : true, 
    alpha : true,
    antialias : true
});
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );


// set scene lighting 
//var light = new THREE.AmbientLight(0x404040);
//light.intensity = 3;
//scene.add(light);
var lights = [];
lights[0] = new THREE.PointLight( 0xffffff, 1, 0 );
lights[1] = new THREE.PointLight( 0xffffff, 1, 0 );
lights[2] = new THREE.PointLight( 0xffffff, 1, 0 );

lights[0].position.set( 0, 200, 0 );
lights[1].position.set( 100, 200, 100 );
lights[2].position.set( - 100, - 200, - 100 );

scene.add( lights[0] );
scene.add( lights[1] );
scene.add( lights[2] );

// base geometry 
var backbone_geometry = new THREE.SphereGeometry(.4,10,10);
var nucleoside_geometry = new THREE.SphereGeometry(.3,10,10).applyMatrix(
        new THREE.Matrix4().makeScale( 1.0, 0.5, 1.0 ));

// define strand colors 
var backbone_materials = [
    new THREE.MeshLambertMaterial({
        color: 0x156289,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
        //flatShading: true
    }),
    new THREE.MeshLambertMaterial({
        color: 0xFF0089,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
        //flatShading: true
    }),
    new THREE.MeshLambertMaterial({
        color: 0xFFFF00,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
        //flatShading: true
    }),
    new THREE.MeshLambertMaterial({
        color: 0x00FF00,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
        //flatShading: true
    }),
    new THREE.MeshLambertMaterial({
        color: 0x00FFFF,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
        //flatShading: true
    }),
    new THREE.MeshLambertMaterial({
        color: 0xDA9100,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
        //flatShading: true
    })
];

// define nucleoside colors
var nucleoside_materials = [
    new THREE.MeshLambertMaterial({
        //color: 0x3333FF,
        color: 0x888888,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
        //flatShading: true
    }),
    new THREE.MeshLambertMaterial({
        //color: 0xFFFF33,
        color: 0x888888,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
        //flatShading: true
    }),
    new THREE.MeshLambertMaterial({
        //color: 0x33FF33,
        color: 0x888888,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
        //flatShading: true
    }),
    new THREE.MeshLambertMaterial({
        //color: 0xFF3333,
        color: 0x888888,
        //emissive: 0x072534,
        side: THREE.DoubleSide,
        //flatShading: true
    })
];

var selection_material = new THREE.MeshLambertMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
});





// add base index visualistion
var backbones = []; 
var nucleosides = [];
var selected_bases = {};

document.addEventListener('mousedown', event => {
    // magic ... 
    var mouse3D = new THREE.Vector3( ( event.clientX / window.innerWidth ) * 2 - 1,   
                                    -( event.clientY / window.innerHeight ) * 2 + 1,  
                                     0.5 );
    var raycaster =  new THREE.Raycaster();
    // cast a ray from mose to viewpoint of camera 
    raycaster.setFromCamera( mouse3D, camera );
    // callect all objects that are in the vay
    var intersects = raycaster.intersectObjects(backbones);

    // make note of what's been clicked
    if (intersects.length > 0){
        let idx = backbones.indexOf(intersects[0].object);
        
        // highlight/remove highlight the bases we've clicked 
        if ( intersects[0].object.material != selection_material){
            selected_bases[idx] = {b_m:intersects[0].object.material, n_m:nucleosides[idx].material};
            intersects[0].object.material = selection_material;
            nucleosides[idx].material = selection_material;
            // give index using global base coordinates 
            console.log(idx); //I can't remove outputs from the console log...maybe open a popup instead?
            render();
        }
        else{
            // figure out what that base was before you painted it black and revert it
            intersects[0].object.material = selected_bases[idx].b_m;
            nucleosides[idx].material = selected_bases[idx].n_m;
            render();
        }
    }
});

// snippet borrowed from three.js examples 
// adding mouse controll to the scene 
//var orbit = new THREE.OrbitControls( camera, renderer.domElement );
//orbit.addEventListener('change', render);
controls = new THREE.TrackballControls( camera );
controls.rotateSpeed = 1.0;
controls.zoomSpeed = 1.2;
controls.panSpeed = 0.8;
controls.noZoom = false;
controls.noPan = false;
controls.staticMoving = true;
controls.dynamicDampingFactor = 0.3;
controls.keys = [ 65, 83, 68 ];
controls.addEventListener( 'change', render );

// start animation cycle 
animate();



// scene update call definition
function render(){
    renderer.render(scene, camera);

}
// animation cycle and control updates
function animate() {
    requestAnimationFrame( animate );
    controls.update();

}



// define the drag and drop behavior of the scene 
var target = renderer.domElement;
target.addEventListener("dragover", function(event) {
    event.preventDefault();
}, false);
// the actual code to drop in the config files 
target.addEventListener("drop", function(event) {

    // cancel default actions
    event.preventDefault();

    var i = 0,
        files = event.dataTransfer.files,
        len = files.length;
    
    var strand_to_material = {};
    var base_to_material = {};
    var base_to_num = {
        "A" : 0,
        "G" : 1,
        "C" : 2,
        "T" : 3,
        "U" : 3 
    };
    // get the extention of one of the 2 files 
    let ext = files[0].name.slice(-3);
    // space to store the file paths 
    let dat_file = null,
        top_file = null;
    // assign files to the extentions 
    if (ext === "dat"){
        dat_file = files[0];    
        top_file = files[1];    
    }
    else{
        dat_file = files[1];
        top_file = files[0];
    }
    
    //read topology file
    let top_reader = new FileReader();
    top_reader.onload = ()=> {
        // parse file into lines 
        var lines = top_reader.result.split(/[\r\n]+/g);
        lines = lines.slice(1); // discard the header  
        lines.forEach(
            (line, i) => {
                let l = line.split(" "); 
                let id = parseInt(l[0]); // get the strand id 
                let base = l[1]; // get base id
                // create a lookup for
                // coloring base according to base id
                base_to_material[i] = nucleoside_materials[base_to_num[base]];
                // coloring bases according to strand id 
                strand_to_material[i] = backbone_materials[Math.floor(id % backbone_materials.length )];
            });
    };
    top_reader.readAsText(top_file);

    // read a configuration file 
    let dat_reader = new FileReader();
    dat_reader.onload = ()=>{
        // parse file into lines 
        var lines = dat_reader.result.split(/[\r\n]+/g);
        
        //get the simulation box size 
        let box = parseFloat(lines[1].split(" ")[3])

        // everything but the header 
        lines = lines.slice(3);
        
        // calculate offset to have the first strand @ the scene origin 
        let first_line = lines[0].split(" ");
        // parse the coordinates
        let fx = parseFloat(first_line[0]), 
            fy = parseFloat(first_line[1]),
            fz = parseFloat(first_line[2]);
        
        // add the bases to the scene
        lines.forEach((line, i) => {
            // consume a new line 
            l = line.split(" ");
            
            // adds a new "backbone" and new "nucleoside" to the scene
            var backbone = new THREE.Mesh( backbone_geometry, strand_to_material[i] );
            var nucleoside = new THREE.Mesh( nucleoside_geometry, base_to_material[i])
            backbones.push(backbone);
            scene.add(backbone);
            nucleosides.push(nucleoside);
            scene.add(nucleoside);
            // shift coordinates such that the 1st base of the  
            // 1st strand is @ origin 
            let x = parseFloat(l[0])- fx, 
                y = parseFloat(l[1])- fy,
                z = parseFloat(l[2])- fz;
            
            // compute offset to bring strand in box
            let dx = Math.round(x / box) * box,
                dy = Math.round(x / box) * box,
                dz = Math.round(x / box) * box;
            
            //fix coordinates 
            x = x - dx;
            y = y - dx;
            z = z - dx;

            // extract axis vector a1 and a3 
            let x_a1 = parseFloat(l[3]),
                y_a1 = parseFloat(l[4]),
                z_a1 = parseFloat(l[5]), // 6, 7, 8 
                x_a3 = parseFloat(l[6]),
                y_a3 = parseFloat(l[7]),
                z_a3 = parseFloat(l[8]);
    

            // according to base.py a2 is the cross of a1 and a3
            let [x_a2,y_a2, z_a2] = cross(x_a1, y_a1, z_a1, x_a3, y_a3, z_a3);

            // compute backbone cm
            let x_bb = x - 0.34 * x_a1 + 0.3408 * x_a2,
                y_bb = y - 0.34 * y_a1 + 0.3408 * y_a2,
                z_bb = z - 0.34 * z_a1 + 0.3408 * z_a2;

            backbone.position.set(x_bb, y_bb, z_bb); 
            

            // get nucleoside cm
            let x_ns = x + 0.4 * x_a1,
                y_ns = y + 0.4 * y_a1,
                z_ns = z + 0.4 * z_a1;

            nucleoside.position.set(x_ns, y_ns, z_ns);

        });
        // update the scene
        render();
        
    };
    // execute the read operation 
    dat_reader.readAsText(dat_file);

}, false);

// update the scene
render();


function cross (a1,a2,a3,b1,b2,b3) {
    return [ a2 * b3 - a3 * b2, 
             a3 * b1 - a1 * b3, 
             a1 * b2 - a2 * b1 ];
}