/// <reference path="../typescript_definitions/index.d.ts" />
/// <reference path="../model/basicElement.ts" />
/// <reference path="../scene/scene_setup.ts" />
// example code calculating different properties from the scene 
// and displaying the results 
var api;
(function (api) {
    var observable;
    (function (observable) {
        class CMS extends THREE.Mesh {
            constructor(elements, size, color) {
                var geometry = new THREE.SphereGeometry(size, 32, 32);
                var material = new THREE.MeshBasicMaterial({ color: color });
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
    })(observable = api.observable || (api.observable = {}));
})(api || (api = {}));
