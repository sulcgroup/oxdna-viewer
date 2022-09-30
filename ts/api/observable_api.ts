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
            var material = new THREE.MeshPhongMaterial( {color: color} );
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

    export class MeanOrientation extends THREE.ArrowHelper{
        // let orientation =  new api.observable.MeanOrientation([...selectedBases]);
        // render = api.observable.wrap(render, () => {orientation.update()});
        bases : BasicElement[];
        constructor(bases: BasicElement[], len=10, color =0xFF0000){
            // as we inheret from Arrow helper we need to set dummy values
            super(new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0), len,color);
            this.bases = bases;
            this.update()
            scene.add(this);
        }

        update(){
            let origin   = new THREE.Vector3();
            let dir = new THREE.Vector3();
            let l = this.bases.length;

            //get the mean value
            for(let i = 0; i < l; i++){
                origin.add(
                    this.bases[i].getInstanceParameter3('nsOffsets')
                );
                dir.add(this.bases[i].getInstanceParameter3('bbOffsets'));
            }
            origin.divideScalar(l);
            //direction goes from ori and needs to be normalized
            dir.divideScalar(l).sub(origin).normalize();

            this.position.copy(origin);
            this.setDirection(dir);
        }
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

