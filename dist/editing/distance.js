/// <reference path="../typescript_definitions/index.d.ts" />
/// <reference path="../api/observable_api.ts" />
/// <reference path="../file_handling/file_reading.ts" />
/// <reference path="../main.ts" />
class DistanceHandler {
    constructor() {
        this.distances = new Array();
    }
    getHTML() {
        return this.distances.map(d => d.getHtml());
    }
    append(e1, e2) {
        this.distances.push(new DistanceObservable(e1, e2, this));
    }
    delete(caller) {
        const index = this.distances.indexOf(caller);
        if (index > -1) {
            this.distances.splice(index, 1);
        }
    }
    update() {
        this.distances.forEach(d => d.compute());
    }
}
let distanceHandler = new DistanceHandler();
let boundDistanceUpdate = false;
function distanceSetup() {
    if (!boundDistanceUpdate) {
        trajReader.lookupReader.callback = api.observable.wrap(trajReader.lookupReader.callback, () => {
            listDistances();
        });
        boundDistanceUpdate = true;
    }
    listDistances();
}
;
function listDistances() {
    distanceHandler.update();
    let distanceDOM = document.getElementById("distances");
    distanceDOM.innerText = "";
    distanceHandler.getHTML().forEach(d => distanceDOM.appendChild(d));
}
function measureDistanceFromSelection() {
    let s = Array.from(selectedBases);
    if (s.length != 2) {
        notify("please use 2 elements for distance selection");
        return;
    }
    distanceHandler.append(s[0], s[1]);
    clearSelection();
}
class DistanceObservable {
    constructor(e1, e2, parent) {
        this.e1 = e1;
        this.e2 = e2;
        this.parent = parent;
        this.compute();
    }
    compute() {
        this.dist = this.e1.getPos().distanceTo(this.e2.getPos());
    }
    getHtml() {
        let container_div = document.createElement('div');
        let delete_button = document.createElement('button');
        let label = document.createElement('label');
        delete_button.innerText = "x";
        delete_button.onclick = () => {
            this.parent.delete(this);
            listDistances();
        };
        label.innerText = `${this.e1.id}\t-\t${this.e2.id}\t:\t${this.dist}`;
        container_div.appendChild(delete_button);
        container_div.appendChild(label);
        return container_div;
    }
}
