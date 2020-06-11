/// <reference path="../typescript_definitions/index.d.ts" />
/// <reference path="../model/basicElement.ts" />
/// <reference path="../scene/scene_setup.ts" />

//import { Vector3 } from "../typescript_definitions/index";
//import * as THREE from "../typescript_definitions/index";

// example code calculating different properties from the scene 
// and displaying the results 
module api.observable{
    export class CMS extends THREE.Mesh{
        // displayes the CMS of a given array of basic elements 
        elements:BasicElement[]; 

        constructor(elements:BasicElement[], size:number, color:number){
            var geometry = new THREE.SphereGeometry( size, 32, 32 );
            var material = new THREE.MeshBasicMaterial( {color: color} );
            super(geometry, material);
            this.elements = Array.from(elements);
            this.calculate();
            scene.add( this );
        
        }
        calculate(){
            // function can be used for updates in a given trajectory
            let v =  new THREE.Vector3(0,0,0);
            this.elements.forEach(element => {
                v.add(element.getInstanceParameter3('nsOffsets'));
            });
            v = v.divideScalar(this.elements.length);
            this.position.set(v.x, v.y, v.z);
        }
    }

    export class Track extends THREE.Line{
        // draw displacements of a selected mesh 
        // Example usage, assuming one creates as CMS object from selected bases to track:
        //
        // let cms = new api.observable.CMS(selectedBases, 1, 0xFF0000);
        // let track =  new api.observable.Track(cms);
        // let update_func =()=>{
        //     cms.calculate();
        //     track.calculate(); 
        // };
        // trajReader.nextConfig = api.observable.wrap(trajReader.nextConfig, update_func);
        // trajReader.previousConfig = api.observable.wrap(trajReader.previousConfig, update_func);
        // render();
        points: THREE.Vector3[];
        particle: THREE.Mesh; 
        constructor(particle : THREE.Mesh){
            
            let points = [];
            let pos = particle.position;
            points.push( new THREE.Vector3( pos.x, pos.y, pos.z) );
            //let geometry = 
            super(new THREE.BufferGeometry().setFromPoints( points ),
                  new THREE.LineBasicMaterial( { color: 0x0000ff } ));
            this.points   = points;
            this.particle = particle;
            scene.add(this);
        }
        calculate(){
            let pos = this.particle.position;
            this.points.push(
                new THREE.Vector3( pos.x, pos.y, pos.z)
            );
            this.geometry = new THREE.BufferGeometry().setFromPoints( this.points );
        }
    }

    export class NickOrientation extends THREE.ArrowHelper{
        // orientation of a nick defined by 2 consecutive bases
        // has aligning problems when hooked to trajReader.nextConfig
        // works when hooked to render 
        // TODO: possibly fix this behavior at some point 
        //
        // Example usage, assuming 2 nick bases are selected type in the dev console:
        //
        // let nick =  new api.observable.NickOrientation(Array.from(selectedBases));
        // render = api.observable.wrap(render, () => {nick.calculate()});
        bases : BasicElement[];
        constructor(bases : BasicElement[]){
            if (bases.length != 2){
                throw new Error("Nick Orientation requiles 2 bases to work");
            } 
            let b1 = bases[0]; 
            let b2 = bases[1];
            let origin = mean_point([
                b1.getInstanceParameter3('nsOffsets'),
                b2.getInstanceParameter3('nsOffsets')
            ]);
            let dir = mean_point([
                b1.getInstanceParameter3('bbOffsets'),
                b2.getInstanceParameter3('bbOffsets'),
            ]).sub(origin).normalize();
            super(dir, origin, 10,0x000000);
            this.bases = bases;
            scene.add(this);
            
        }
        calculate(){
            let b1 = this.bases[0]; 
            let b2 = this.bases[1];
            let origin = mean_point([
                b1.getInstanceParameter3('nsOffsets'),
                b2.getInstanceParameter3('nsOffsets')
            ]);
            let dir = mean_point([
                b1.getInstanceParameter3('bbOffsets'),
                b2.getInstanceParameter3('bbOffsets'),
            ]).sub(origin).normalize();
            this.position.set(origin.x, origin.y, origin.z);
            this.setDirection(dir);

        }

    }
    function mean_point(vs :THREE.Vector3 []):THREE.Vector3{
        let mean = new THREE.Vector3(0,0,0);
        vs.forEach(v => {
            mean.add(v);
            
        });
        return mean.divideScalar(vs.length);
    }
    
    export function wrap (fn, fn_wrap : Function)
    {
        https://dzone.com/articles/javascript-wrap-all-methods 
        return function ()
        {   
            let result =  fn.apply(this, arguments);
            fn_wrap();
            return result;
        };
    
    }

}

