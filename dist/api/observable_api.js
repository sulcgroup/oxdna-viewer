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
    })(observable = api.observable || (api.observable = {}));
})(api || (api = {}));
