class ANM {
    constructor(sys, id, size) {
        this.system = sys;
        this.id = id;
        this.initInstances(size);
    }
    initInstances(nInstances) {
        this.INSTANCES = nInstances;
        this.offsets = new Float32Array(this.INSTANCES * 3);
        this.rotations = new Float32Array(this.INSTANCES * 4);
        this.colors = new Float32Array(this.INSTANCES * 3);
        this.scales = new Float32Array(this.INSTANCES * 3);
        this.visibility = new Float32Array(this.INSTANCES * 3);
    }
    ;
    getSystem() {
        return (this.system);
    }
    fillVec(vecName, unitSize, pos, vals) {
        for (let i = 0; i < unitSize; i++) {
            this[vecName][pos * unitSize + i] = vals[i];
        }
    }
    ;
}
class ANMConnection {
    constructor(parent, id, p1, p2, eqDist, type, strength) {
        this.parent = parent;
        this.id = id;
        this.p1 = p1;
        this.p2 = p2;
        this.eqDist = eqDist;
        this.type = type;
        this.strength = strength;
    }
    init() {
        const end1 = this.p1.getInstanceParameter3('bbOffsets');
        const x1 = end1.x, y1 = end1.y, z1 = end1.z;
        const end2 = this.p2.getInstanceParameter3('bbOffsets');
        const x2 = end2.x, y2 = end2.y, z2 = end2.z;
        const x = (x1 + x2) / 2, y = (y1 + y2) / 2, z = (z1 + z2) / 2;
        const len = end1.distanceTo(end2);
        const rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x1 - x2, y1 - y2, z1 - z2).normalize());
        const col = backboneColors[this.parent.id % backboneColors.length];
        this.parent.fillVec('offsets', 3, this.id, [x, y, z]);
        this.parent.fillVec('rotations', 4, this.id, [rot.w, rot.z, rot.y, rot.x]);
        this.parent.fillVec('colors', 3, this.id, [col.r, col.g, col.b]);
        this.parent.fillVec('scales', 3, this.id, [1, len, 1]);
        this.parent.fillVec('visibility', 3, this.id, [1, 1, 1]);
    }
    getParent() {
        return this.parent;
    }
    getInstanceParameter3(name) {
        let anm = this.getParent();
        const x = anm[name][this.id * 3], y = anm[name][this.id * 3 + 1], z = anm[name][this.id * 3 + 2];
        return new THREE.Vector3(x, y, z);
    }
    //retrieve this element's values in a 4-parameter instance array
    //only rotations
    getInstanceParameter4(name) {
        let anm = this.getParent();
        const x = anm[name][this.id * 4], y = anm[name][this.id * 4 + 1], z = anm[name][this.id * 4 + 2], w = anm[name][this.id * 4 + 3];
        return new THREE.Vector4(x, y, z, w);
    }
    //set this element's parameters in the anmtem's instance arrays
    //doing this is slower than anm.fillVec(), but makes cleaner code sometimes
    setInstanceParameter(name, data) {
        let anm = this.getParent();
        anm.fillVec(name, data.length, this.id, data);
    }
}
