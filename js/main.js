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
var geometry = new THREE.SphereGeometry(.3,10,10);

// define strand colors 
var materials = [
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

// scene update call definition
function render(){
    renderer.render(scene, camera);
}


// add base index visualistion
var bases = []; 
document.addEventListener('mousedown', event => {
    // magic ... 
    var mouse3D = new THREE.Vector3( ( event.clientX / window.innerWidth ) * 2 - 1,   
                                    -( event.clientY / window.innerHeight ) * 2 + 1,  
                                     0.5 );
    var raycaster =  new THREE.Raycaster();
    // cast a ray from mose to viewpoint of camera 
    raycaster.setFromCamera( mouse3D, camera );
    // callect all objects that are in the vay
    var intersects = raycaster.intersectObjects(bases);
    if (intersects.length > 0){
        // highlite the bases we've clicked 
        intersects[0].object.material = selection_material;
        // give index using global base coordinates 
        console.log(bases.indexOf(intersects[0].object));
        render();
    }
});

// snippet borrowed from three.js examples 
// adding mouse controll to the scene 
var orbit = new THREE.OrbitControls( camera, renderer.domElement );
orbit.addEventListener('change', render);
  

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
        "T" : 1,
        "U" : 1,
        "G" : 2,
        "C" : 3 
    };
    // get the extention of one of the 2 files 
    let ext = files[0].name.slice(-3);
    // space to store the file paths 
    let dat_file = null,
        top_file = null;
    // assign files to the extentions 
    if (ext == "dat"){
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
                // coloring bases according to base id
                base_to_material[i] = materials[base_to_num[base]];
                // coloring bases according to strand id 
                strand_to_material[i] = materials[Math.floor(id % materials.length )];
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
        // for some reason i have None values @ the end of a parsed file
        lines.pop();
        
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
            
            // adds a new "base" to the scene
            URL = document.URL;
            let material = null;
            if (URL.includes("base"))
                material = base_to_material[i];
            else
                material = strand_to_material[i];
            var base = new THREE.Mesh( geometry, material );
            bases.push(base);
            scene.add(base);
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

            base.position.set(x, y, z);
            
        });
        // update the scene
        render();
        
    };
    // execute the read operation 
    dat_reader.readAsText(dat_file);

}, false);

// update the scene
render();
