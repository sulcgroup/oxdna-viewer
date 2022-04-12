/**
 * Extends Nuculeotide with RNA-specific properties such as base position relative to backbone, and A-form helix creation
 */
class RNANucleotide extends Nucleotide {
    constructor(id, strand) {
        super(id, strand);
        this.bbnsDist = 0.8246211;
    }
    ;
    calcBBPos(p, a1, a2, a3) {
        return new THREE.Vector3(p.x - (0.4 * a1.x + 0.2 * a3.x), p.y - (0.4 * a1.y + 0.2 * a3.y), p.z - (0.4 * a1.z + 0.2 * a3.z));
    }
    ;
    getA2() {
        const a1 = this.getA1();
        const a3 = this.getA3();
        const a2 = a1.clone().cross(a3).normalize();
        return a2;
    }
    getA3() {
        const cm = this.getPos();
        const bb = this.getInstanceParameter3("bbOffsets");
        const a1 = this.getA1();
        const a3 = bb.clone().sub(cm).add(a1.clone().multiplyScalar(0.4)).divideScalar(-0.2).normalize();
        return a3;
    }
    ;
    // Uses the method from generate_RNA.py found in the oxDNA UTILS directory
    /**
     * Extend the current strand with addtional RNA bases in an ideal A-form helix
     * @param len Number of bases to create
     * @param direction Either "n3" or "n5" corresponding to the direction to create
     * @returns Array[] of [position, A1, A3]
     */
    extendStrand(len, direction, double) {
        // Model constants
        let inclination = -15.5 * Math.PI / 180;
        const bp_backbone_distance = 2;
        const diameter = 2.35;
        const base_base_distance = 0.3287;
        const rot = 32.7 * Math.PI / 180;
        const cord = Math.cos(inclination) * bp_backbone_distance;
        const center_to_cord = Math.sqrt(Math.pow(diameter / 2, 2) - Math.pow(cord / 2, 2));
        const fudge = 0.4;
        // Current nucleotide information
        const oldA1 = this.getA1();
        const oldA3 = this.getA3();
        // You can define the helix axis based on a1 and a3.  This is the inverse of how a3 is assigned below.
        dir = (oldA3.clone().sub(oldA1.clone().multiplyScalar(Math.sin(inclination))).divideScalar(-(Math.cos(inclination) - Math.pow(Math.sin(inclination), 2))));
        dir.normalize();
        // Correctly orient the helix for the direction you're going
        if (direction == "n5") {
            dir.multiplyScalar(-1);
        }
        //when extending from the n5 side, do I need to set the target position to r2 instead of r1?
        // RNA does not form a helix with bases pointed at a central axis like DNA does
        // instead, you have a chord between two points on a circle which defines the cm positions and the a1 vectors
        // This is the chord if the helix axis is the Z-axis
        // The y (and the inclination, above) are inverted from generate-RNA.py because this generates 5'-3' while it generates 3'-5'.
        const x1 = center_to_cord;
        const y1 = -cord / 2;
        const z1 = -(bp_backbone_distance / 2) * Math.sin(inclination);
        const x2 = center_to_cord;
        const y2 = cord / 2;
        const z2 = (bp_backbone_distance / 2) * Math.sin(inclination);
        let r1 = new THREE.Vector3(x1, y1, z1);
        let r2 = new THREE.Vector3(x2, y2, z2);
        // there are two assumptions made by the previously defined r1 and r2:
        // 1. the helix axis is the z-axis
        // 2. a1 of the initial nucleotide is  (0, -0.9636304532086232, 0.2672383760782569).
        // so first, we need to set the axis to the correct one
        let q1 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        r1.applyQuaternion(q1);
        r2.applyQuaternion(q1);
        // then set a1 to the correct orientation
        //r1_to_r2 = r2.clone().sub(r1);
        let r1_to_r2;
        if (direction == "n3") {
            r1_to_r2 = r2.clone().sub(r1);
        }
        else {
            r1_to_r2 = r1.clone().sub(r2);
        }
        r1_to_r2.normalize();
        let rotAxis2 = dir.clone();
        rotAxis2.normalize();
        let rotAngle2 = r1_to_r2.clone().projectOnPlane(dir).angleTo(oldA1.clone().projectOnPlane(dir));
        let cross2 = r1_to_r2.clone().cross(oldA1);
        if (cross2.dot(dir) < 0) {
            rotAngle2 = -rotAngle2;
        }
        let q2 = new THREE.Quaternion();
        q2.setFromAxisAngle(rotAxis2, rotAngle2);
        r1.applyQuaternion(q2);
        r2.applyQuaternion(q2);
        // center point of the helix axis
        // below, pos = r1 + start_pos + A1*0.4
        let start_pos;
        if (direction == "n3") {
            start_pos = this.getPos().sub(r1).sub(oldA1.clone().multiplyScalar(fudge));
        }
        else {
            start_pos = this.getPos().sub(r2).sub(oldA1.clone().multiplyScalar(fudge));
        }
        // create per-step rotation matrix
        let R = new THREE.Quaternion();
        R.setFromAxisAngle(dir, rot);
        // initialize properties of new nucleotide
        let a1;
        let a1proj = new THREE.Vector3;
        let a3;
        let out;
        let RNA_fudge;
        if (double) {
            out = new Array(len * 2);
        }
        else {
            out = new Array(len);
        }
        // generate nucleotide positions and orientations
        for (let i = 0; i < len; i++) {
            //calculate rotation around central axis and step along axis
            r1.applyQuaternion(R).add(dir.clone().multiplyScalar(base_base_distance));
            r2.applyQuaternion(R).add(dir.clone().multiplyScalar(base_base_distance));
            // calculate a1 orientation
            r1_to_r2 = r2.clone().sub(r1);
            a1 = r1_to_r2.clone().normalize();
            // calculate a3 orientation
            a1proj = a1.clone().projectOnPlane(dir);
            a1proj.normalize();
            a3 = dir.clone().multiplyScalar(-Math.cos(inclination)).add(a1proj.clone().multiplyScalar(Math.sin(inclination)));
            a3.normalize();
            // the COM is 0.4 off from r1
            // also need to offset to account for the helix axis not being (0,0,0)
            let p;
            if (direction == "n3") {
                RNA_fudge = a1.clone().multiplyScalar(fudge);
                p = r1.clone().add(RNA_fudge).add(start_pos);
            }
            else {
                a1.negate();
                a3.negate();
                RNA_fudge = a1.clone().multiplyScalar(fudge);
                p = r2.clone().add(RNA_fudge).add(start_pos);
            }
            out[i] = [p, a1.clone(), a3.clone()];
            // Do it all again if there's a double helix.
            if (double) {
                a1 = r1_to_r2.clone().normalize().multiplyScalar(-1);
                a1proj = a1.clone().projectOnPlane(dir.clone().multiplyScalar(-1));
                a1proj.normalize();
                a3 = dir.clone().multiplyScalar(Math.cos(inclination)).add(a1proj.clone().multiplyScalar(Math.sin(inclination)));
                a3.normalize();
                RNA_fudge = a1.clone().multiplyScalar(fudge);
                let p;
                if (direction == "n3") {
                    RNA_fudge = a1.clone().multiplyScalar(fudge);
                    p = r2.clone().add(RNA_fudge).add(start_pos);
                }
                else {
                    a1.negate();
                    a3.negate();
                    RNA_fudge = a1.clone().multiplyScalar(fudge);
                    p = r1.clone().add(RNA_fudge).add(start_pos);
                }
                out[len * 2 - (i + 1)] = [p, a1.clone(), a3.clone()]; // yes, topology is backwards.  See comment in addDuplexBySeq() 
            }
        }
        console.log(' ');
        return out;
    }
    isRNA() {
        return true;
    }
    weakPyrimindine() {
        return 'U';
    }
    getComplementaryType() {
        var map = { A: 'U', G: 'C', C: 'G', U: 'A' };
        return map[this.type];
    }
    toJSON() {
        // Get superclass attributes
        let json = super.toJSON();
        json['class'] = 'RNA';
        return json;
    }
}
;
