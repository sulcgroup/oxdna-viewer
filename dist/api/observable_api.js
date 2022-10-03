/// <reference path="../typescript_definitions/index.d.ts" />
/// <reference path="../model/basicElement.ts" />
/// <reference path="../scene/scene_setup.ts" />
//import { Vector3 } from "../typescript_definitions/index";
//import * as THREE from "../typescript_definitions/index";
// example code calculating different properties from the scene 
// and displaying the results 
var api;
(function (api) {
    var observable;
    (function (observable) {
        class CMS extends THREE.Mesh {
            constructor(elements, size, color) {
                var geometry = new THREE.SphereGeometry(size, 32, 32);
                var material = new THREE.MeshPhongMaterial({ color: color });
                super(geometry, material);
                this.elements = Array.from(elements);
                this.calculate();
                scene.add(this);
            }
            calculate() {
                // function can be used for updates in a given trajectory
                let v = new THREE.Vector3(0, 0, 0);
                this.elements.forEach(element => {
                    v.add(element.getInstanceParameter3('nsOffsets'));
                });
                v = v.divideScalar(this.elements.length);
                this.position.set(v.x, v.y, v.z);
            }
        }
        observable.CMS = CMS;
        class Track extends THREE.Line {
            constructor(particle) {
                let points = [];
                let pos = particle.position;
                points.push(new THREE.Vector3(pos.x, pos.y, pos.z));
                //let geometry = 
                super(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x0000ff }));
                this.points = points;
                this.particle = particle;
                scene.add(this);
            }
            calculate() {
                let pos = this.particle.position;
                this.points.push(new THREE.Vector3(pos.x, pos.y, pos.z));
                this.geometry = new THREE.BufferGeometry().setFromPoints(this.points);
            }
        }
        observable.Track = Track;
        class MeanOrientation extends THREE.ArrowHelper {
            constructor(bases, len = 10, color = 0xFF0000) {
                // as we inheret from Arrow helper we need to set dummy values
                super(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0), len, color);
                this.bases = bases;
                this.update();
                scene.add(this);
            }
            update() {
                let origin = new THREE.Vector3();
                let dir = new THREE.Vector3();
                let l = this.bases.length;
                //get the mean value
                for (let i = 0; i < l; i++) {
                    origin.add(this.bases[i].getInstanceParameter3('nsOffsets'));
                    dir.add(this.bases[i].getInstanceParameter3('bbOffsets'));
                }
                origin.divideScalar(l);
                //direction goes from ori and needs to be normalized
                dir.divideScalar(l).sub(origin).normalize();
                this.position.copy(origin);
                this.setDirection(dir);
            }
        }
        observable.MeanOrientation = MeanOrientation;
        function wrap(fn, fn_wrap) {
            https: //dzone.com/articles/javascript-wrap-all-methods 
             return function () {
                let result = fn.apply(this, arguments);
                fn_wrap();
                return result;
            };
        }
        observable.wrap = wrap;
    })(observable = api.observable || (api.observable = {}));
})(api || (api = {}));
