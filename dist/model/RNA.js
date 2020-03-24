/**
 * Extends Nuculeotide with RNA-specific properties such as base position relative to backbone, and A-form helix creation
 */
class RNANucleotide extends Nucleotide {
    constructor(gid, strand) {
        super(gid, strand);
        this.elementType = RNA;
        this.bbnsDist = 0.8246211;
    }
    ;
    calcBBPos(x, y, z, xA1, yA1, zA1, xA2, yA2, zA2, xA3, yA3, zA3) {
        const xbb = x - (0.4 * xA1 + 0.2 * xA3), ybb = y - (0.4 * yA1 + 0.2 * yA3), zbb = z - (0.4 * zA1 + 0.2 * zA3);
        return new THREE.Vector3(xbb, ybb, zbb);
    }
    ;
    getA3(xbb, ybb, zbb, x, y, z, xA1, yA1, zA1) {
        const xA3 = ((xbb - x) + (0.4 * xA1)) / (-0.2);
        const yA3 = ((ybb - y) + (0.4 * yA1)) / (-0.2);
        const zA3 = ((zbb - z) + (0.4 * zA1)) / (-0.2);
        return new THREE.Vector3(xA3, yA3, zA3);
    }
    ;
    // Uses the method from generate_RNA.py found in the oxDNA UTILS directory
    extendStrand(len, direction) {
        const inclination = 15.5 * Math.PI / 180;
        const bp_backbone_distance = 2;
        const diameter = 2.35;
        const base_base_distance = 0.3287;
        const rot = 32.7 * Math.PI / 180;
        const cord = Math.cos(inclination) * bp_backbone_distance;
        const center_to_cord = Math.sqrt(Math.pow(diameter / 2, 2) - Math.pow(cord / 2, 2));
        //We just set the direction the the orientation of the a3 vector
        const start_pos = this.getInstanceParameter3("cmOffsets");
        const bb_pos = this.getInstanceParameter3("bbOffsets");
        const ns_pos = this.getInstanceParameter3("nsOffsets");
        const old_A1 = this.getA1(ns_pos.x, ns_pos.y, ns_pos.z, start_pos.x, start_pos.y, start_pos.z);
        let dir = this.getA3(bb_pos.x, bb_pos.y, bb_pos.z, start_pos.x, start_pos.y, start_pos.z, old_A1.x, old_A1.y, old_A1.z);
        if (direction == "neighbor5") {
            dir.multiplyScalar(-1);
        }
        const dir_norm = Math.sqrt(dir.dot(dir));
        dir.divideScalar(dir_norm);
        const x2 = center_to_cord;
        const y2 = -cord / 2;
        const z2 = (bp_backbone_distance / 2) * Math.sin(inclination);
        const x1 = center_to_cord;
        const y1 = cord / 2;
        const z1 = -(bp_backbone_distance / 2) * Math.sin(inclination);
        let r1 = new THREE.Vector3(x1, y1, z1);
        let r2 = new THREE.Vector3(x2, y2, z2);
        let r1_to_r2 = r2.clone().sub(r1);
        let R = new THREE.Matrix4;
        R.makeRotationAxis(dir, rot);
        let a1;
        let a1proj = new THREE.Vector3;
        let a1projnorm;
        let a3;
        let out = [];
        let RNA_fudge;
        for (let i = 0; i < len; i++) {
            r1.applyMatrix4(R).add(dir.clone().multiplyScalar(base_base_distance));
            r2.applyMatrix4(R).add(dir.clone().multiplyScalar(base_base_distance));
            r1_to_r2 = r2.clone().sub(r1);
            a1 = r1_to_r2.clone().divideScalar(Math.sqrt(r1_to_r2.dot(r1_to_r2)));
            a1proj.set(a1[0], a1[1], 0);
            a1projnorm = Math.sqrt(a1proj.dot(a1proj));
            a1proj.divideScalar(a1projnorm);
            a3 = dir.clone().multiplyScalar(-Math.cos(inclination)).multiplyScalar(-1).add(a1proj.clone().multiplyScalar(Math.sin(inclination)));
            RNA_fudge = a1.clone().multiplyScalar(0.6);
            out.push([r1.x + start_pos.x + RNA_fudge.x, r1.y + start_pos.y + RNA_fudge.y, r1.z + start_pos.z + RNA_fudge.z, a1.x, a1.y, a1.z, a3.x, a3.y, a3.z]); //r1 needs to have a fudge factor from the RNA model added
        }
        return out;
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
