/**
 * The abstract class that all drawn monomers inherit from
 * @param gid - The global id of the element.  Also its key in the elements map
 * @param strand - The parent Strand of the monomer
 * @param dummySys - If created during editing, the data arrays for instancing are stored in a dummy system
 */
class BasicElement {
    constructor(gid, strand) {
        this.connections = [];
        this.elementType = -1; // 0:A 1:G 2:C 3:T/U OR 1 of 20 amino acids
        this.gid = gid;
        this.strand = strand;
        this.dummySys = null;
    }
    ;
    //abstract rotate(quat: THREE.Quaternion): void;
    // highlight/remove highlight the bases we've clicked from the list and modify color
    toggle() {
        if (selectedBases.has(this)) {
            selectedBases.delete(this);
        }
        else {
            selectedBases.add(this);
        }
        this.updateColor();
    }
    ;
    updateSP(num) {
        return new THREE.Object3D();
    }
    ;
    getSystem() {
        return this.strand.system;
    }
    strandToColor(strandIndex) {
        return backboneColors[(Math.abs(strandIndex) + this.getSystem().systemID) % backboneColors.length];
    }
    ;
    elemToColor(type) {
        return new THREE.Color();
    }
    ;
    isPaired() {
        return false;
    }
    //retrieve this element's values in a 3-parameter instance array
    //positions, scales, colors
    getInstanceParameter3(name) {
        let sys = this.getSystem(), sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys;
            sid = this.sid;
        }
        const x = sys[name][sid * 3], y = sys[name][sid * 3 + 1], z = sys[name][sid * 3 + 2];
        return new THREE.Vector3(x, y, z);
    }
    //retrieve this element's values in a 4-parameter instance array
    //only rotations
    getInstanceParameter4(name) {
        let sys = this.getSystem(), sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys;
            sid = this.sid;
        }
        const x = sys[name][sid * 4], y = sys[name][sid * 4 + 1], z = sys[name][sid * 4 + 2], w = sys[name][sid * 4 + 3];
        return new THREE.Vector4(x, y, z, w);
    }
    //set this element's parameters in the system's instance arrays
    //doing this is slower than sys.fillVec(), but makes cleaner code sometimes
    setInstanceParameter(name, data) {
        let sys = this.getSystem(), sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys;
            sid = this.sid;
        }
        sys.fillVec(name, data.length, sid, data);
    }
    //poof
    toggleVisibility() {
        let sys = this.getSystem(), sid = this.gid - sys.globalStartId;
        if (this.dummySys !== null) {
            sys = this.dummySys;
            sid = this.sid;
        }
        const visibility = this.getInstanceParameter3('visibility');
        visibility.addScalar(-1);
        sys.fillVec('visibility', 3, sid, [Math.abs(visibility.x), Math.abs(visibility.y), Math.abs(visibility.z)]);
    }
    handleCircularStrands(sys, sid, xbb, ybb, zbb) {
        if (this.neighbor5 != null && this.neighbor5.lid < this.lid) { //handle circular strands
            this.strand.circular = true;
            const xbbLast = sys.bbOffsets[this.neighbor5.gid * 3], ybbLast = sys.bbOffsets[this.neighbor5.gid * 3 + 1], zbbLast = sys.bbOffsets[this.neighbor5.gid * 3 + 2];
            const xsp = (xbb + xbbLast) / 2, ysp = (ybb + ybbLast) / 2, zsp = (zbb + zbbLast) / 2;
            const spLen = Math.sqrt(Math.pow(xbb - xbbLast, 2) + Math.pow(ybb - ybbLast, 2) + Math.pow(zbb - zbbLast, 2));
            const spRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(xsp - xbb, ysp - ybb, zsp - zbb).normalize());
            const sid5 = this.neighbor5.gid - sys.globalStartId;
            sys.fillVec('bbconOffsets', 3, sid5, [xsp, ysp, zsp]);
            sys.fillVec('bbconRotation', 4, sid5, [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
            sys.fillVec('bbconScales', 3, sid5, [1, spLen, 1]);
        }
    }
    toJSON() {
        // Specify required attributes
        let json = {
            id: this.gid,
            type: this.type,
            class: 'monomer'
        };
        // Specify optional attributes
        if (this.neighbor3)
            json['n3'] = this.neighbor3.gid;
        if (this.neighbor5)
            json['n5'] = this.neighbor5.gid;
        if (this.label)
            json['label'] = this.label;
        if (this.clusterId)
            json['cluster'] = this.clusterId;
        json['conf'] = {};
        instanceParams.forEach((size, attr) => {
            if (size == 3) {
                json['conf'][attr] = this.getInstanceParameter3(attr).toArray();
            }
            else { // 4
                json['conf'][attr] = this.getInstanceParameter4(attr).toArray();
            }
        });
        return json;
    }
}
;
