/// <reference path="../typescript_definitions/index.d.ts" />
// Based on https://github.com/mrdoob/three.js/blob/a72347515fa34e892f7a9bfa66a34fdc0df55954/examples/js/exporters/STLExporter.js

class STLExporter{

    elements : ElementMap;
    vector = new THREE.Vector3();
    normalMatrixWorld = new THREE.Matrix3();
    
    Backbone: THREE.SphereGeometry;
    Nucleoside: THREE.SphereGeometry;
    Connector: THREE.CylinderGeometry;
    BBconnector: THREE.CylinderGeometry;
    
    include_backbone : boolean;
    include_nucleoside : boolean;
    include_connector : boolean;
    include_bbconnector : boolean;

    constructor(elements : ElementMap,
        include_backbone : boolean, include_nucleoside: boolean,
        include_connector: boolean, include_bbconnector: boolean,
        backboneScale: number, nucleosideScale: number,
        connectorScale: number, bbconnectorScale: number,
        faces_mul : number
    ) {
        this.elements = elements;

        //this.Backbone    = new THREE.SphereGeometry(.2,10,10);
        //this.Nucleoside  = new THREE.SphereGeometry(.3,10,10);      
        //this.Connector   = new THREE.CylinderGeometry(.1,.1,1, 8);  
        //this.BBconnector = new THREE.CylinderGeometry(.1,.05,1, 8); 

        this.Backbone    = new THREE.SphereGeometry(.2 * backboneScale ,5 * faces_mul,5* faces_mul);
        this.Nucleoside  = new THREE.SphereGeometry(.3 * nucleosideScale ,5 * faces_mul,5* faces_mul);
        this.Connector   = new THREE.CylinderGeometry(.1 * connectorScale, .1  * connectorScale, 1, 4* faces_mul);
        this.BBconnector = new THREE.CylinderGeometry(.1 * bbconnectorScale, .05 * bbconnectorScale, 1, 4* faces_mul);

        this.include_backbone = include_backbone;
        this.include_bbconnector = include_bbconnector;
        this.include_connector = include_connector;
        this.include_nucleoside = include_nucleoside;
    }

    extract_vertices(object : THREE.Mesh):string{
        var output = '';
        
        if ( object instanceof THREE.Mesh ) {

            var geometry = object.geometry;
            var matrixWorld = object.matrixWorld;

            if ( geometry instanceof THREE.Geometry ) {

                var vertices = geometry.vertices;
                var faces = geometry.faces;

                this.normalMatrixWorld.getNormalMatrix( matrixWorld );

                for ( var i = 0, l = faces.length; i < l; i ++ ) {

                    var face = faces[ i ];

                    this.vector.copy( face.normal ).applyMatrix3( this.normalMatrixWorld ).normalize();

                    output += '\tfacet normal ' + this.vector.x + ' ' + this.vector.y + ' ' + this.vector.z + '\n';
                    output += '\t\touter loop\n';

                    var indices = [ face.a, face.b, face.c ];

                    for ( var j = 0; j < 3; j ++ ) {

                        this.vector.copy( vertices[ indices[ j ] ] ).applyMatrix4( matrixWorld );

                        output += '\t\t\tvertex ' + this.vector.x + ' ' + this.vector.y + ' ' + this.vector.z + '\n';

                    }
                    output += '\t\tendloop\n';
                    output += '\tendfacet\n';
                }

            }
        }
        return output;
    }

    parse() : string{
        var vector = new THREE.Vector3();
		var normalMatrixWorld = new THREE.Matrix3();
        var output = 'solid exported\n';

        this.elements.forEach((el) => {

            let bbOffsets = el.getInstanceParameter3('bbOffsets');          // !
            let nsOffsets = el.getInstanceParameter3('nsOffsets');          // !
            let nsRotation = el.getInstanceParameter4('nsRotation');        // !
            let conOffsets = el.getInstanceParameter3('conOffsets');        // !
            let conRotation = el.getInstanceParameter4('conRotation');      // !
            let bbconOffsets = el.getInstanceParameter3('bbconOffsets');    // !
            let bbconRotation = el.getInstanceParameter4('bbconRotation');  // !
            let nsScales = el.getInstanceParameter3('nsScales');            // !
            let conScales = el.getInstanceParameter3('conScales');          // !
            let bbconScales = el.getInstanceParameter3('bbconScales');      // !
            
            let Backbone    = this.Backbone.clone();
            let Nucleoside  = this.Nucleoside.clone().applyMatrix(new THREE.Matrix4().makeScale( nsScales.x,nsScales.y,nsScales.z ));
            let Connector   = this.Connector.clone().applyMatrix(new THREE.Matrix4().makeScale( conScales.x,conScales.y,conScales.z ));
            let BBconnector = this.BBconnector.clone().applyMatrix(new THREE.Matrix4().makeScale( bbconScales.x,bbconScales.y,bbconScales.z ));
            
            let material = new THREE.MeshBasicMaterial({color: 0x7777ff});

            let backbone_mesh = new THREE.Mesh(Backbone, material);
            let nucleoside_mesh = new THREE.Mesh(Nucleoside, material);
            let connector_mesh = new THREE.Mesh(Connector, material);
            let bbconnector_mesh = new THREE.Mesh(BBconnector, material);	
            
            backbone_mesh.matrixWorld.setPosition(bbOffsets);		
            nucleoside_mesh.matrixWorld.makeRotationFromQuaternion(glsl2three(nsRotation));
            nucleoside_mesh.matrixWorld.setPosition(nsOffsets);
            connector_mesh.matrixWorld.makeRotationFromQuaternion(glsl2three(conRotation));
            connector_mesh.matrixWorld.setPosition(conOffsets);
		    bbconnector_mesh.matrixWorld.makeRotationFromQuaternion(glsl2three(bbconRotation));
            bbconnector_mesh.matrixWorld.setPosition(bbconOffsets);
            
            if(this.include_backbone)
                output += this.extract_vertices(backbone_mesh);
            if(this.include_nucleoside)
                output += this.extract_vertices(nucleoside_mesh);
            if(this.include_connector)
                output += this.extract_vertices(connector_mesh);
            if(this.include_bbconnector)
                output += this.extract_vertices(bbconnector_mesh);
        });
        
        return output + 'endsolid exported\n';
    }

}


function saveSTL(name : string,
    include_backbone : boolean, include_nucleoside: boolean,
    include_connector: boolean, include_bbconnector: boolean,
    backboneScale: number, nucleosideScale: number,
    connectorScale: number, bbconnectorScale: number,
    faces_mul: number
) {
    console.log('Note: The mesh accuracy is set down because js has a limitation on the string length.');
    console.log('on large scenes play with the included objects');
    var exporter = new STLExporter(
        elements, include_backbone, include_nucleoside,
        include_connector, include_bbconnector,
        backboneScale, nucleosideScale,
        connectorScale, bbconnectorScale,
        faces_mul
    );
    var stlString = exporter.parse();
    makeTextFile( name + '.stl', stlString);
  }