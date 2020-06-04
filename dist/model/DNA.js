/**
 * Extends Nuculeotide with DNA-specific properties such as base position relative to backbone, and B-form helix creation
 */
class DNANucleotide extends Nucleotide {
    constructor(gid, strand) {
        super(gid, strand);
        this.elementType = DNA;
        this.bbnsDist = 0.8147053;
    }
    ;
    calcBBPos(x, y, z, xA1, yA1, zA1, xA2, yA2, zA2, xA3, yA3, zA3) {
        const xbb = x - (0.34 * xA1 + 0.3408 * xA2), ybb = y - (0.34 * yA1 + 0.3408 * yA2), zbb = z - (0.34 * zA1 + 0.3408 * zA2);
        return new THREE.Vector3(xbb, ybb, zbb);
    }
    ;
    getA3(xbb, ybb, zbb, x, y, z, xA1, yA1, zA1) {
        let xA2;
        let yA2;
        let zA2;
        xA2 = ((xbb - x) + (0.34 * xA1)) / (-0.3408);
        yA2 = ((ybb - y) + (0.34 * yA1)) / (-0.3408);
        zA2 = ((zbb - z) + (0.34 * zA1)) / (-0.3408);
        const a3 = divAndNeg(cross(xA1, yA1, zA1, xA2, yA2, zA2), dot(xA1, yA1, zA1, xA1, yA1, zA1));
        const xA3 = a3[0];
        let yA3 = a3[1];
        let zA3 = a3[2];
        return new THREE.Vector3(xA3, yA3, zA3);
    }
    ;
    // Uses method from generate-sa.py.  Needs to be relaxed since this is oxDNA1 helix
    extendStrand(len, direction, double) {
        let rot = 35.9 * Math.PI / 180; //0.68940505
        let rise = 0.3897628551303122;
        const startPos = this.getInstanceParameter3("cmOffsets");
        const bbPos = this.getInstanceParameter3("bbOffsets");
        const nsPos = this.getInstanceParameter3("nsOffsets");
        const oldA1 = this.getA1(nsPos.x, nsPos.y, nsPos.z, startPos.x, startPos.y, startPos.z);
        let dir = this.getA3(bbPos.x, bbPos.y, bbPos.z, startPos.x, startPos.y, startPos.z, oldA1.x, oldA1.y, oldA1.z);
        // normalize dir
        const dir_norm = Math.sqrt(dir.clone().dot(dir));
        dir.divideScalar(dir_norm);
        let a1 = oldA1.clone();
        let center = startPos.add(a1.clone().multiplyScalar(0.6));
        ;
        let R = new THREE.Matrix4;
        if (direction == "neighbor3") {
            R.makeRotationAxis(dir.clone().multiplyScalar(-1), rot);
            rise = -rise;
        }
        else { // neighbor5
            R.makeRotationAxis(dir, rot);
        }
        let rb = new THREE.Vector3(0, 0, 0);
        let a3 = dir;
        // a1.applyMatrix4(R);
        let out = [];
        for (let i = 0; i < len; i++) {
            a1.applyMatrix4(R);
            rb.add(a3.clone().multiplyScalar(rise));
            out.push([rb.x + center.x - (a1.x * 0.6), rb.y + center.y - (a1.y * 0.6), rb.z + center.z - (a1.z * 0.6), a1.x, a1.y, a1.z, a3.x, a3.y, a3.z]);
        }
        if (double) {
            a1 = oldA1.clone();
            if (direction == "neighbor5") {
                a1.multiplyScalar(-1);
            }
            // a3.multiplyScalar(-1);
            R.transpose();
            // R.multiplyScalar(-1);
            rb = new THREE.Vector3(0.6, 0, 0);
            for (let i = 0; i < len; i++) {
                a1.applyMatrix4(R);
                rb.add(a3.clone().multiplyScalar(rise)).applyMatrix4(R);
                out.push([rb.x + startPos.x, rb.y + startPos.y, rb.z + startPos.z, a1.x, a1.y, a1.z, a3.x, a3.y, a3.z]);
            }
        }
        return out;
    }
    getComplementaryType() {
        var map = { A: 'T', G: 'C', C: 'G', T: 'A' };
        return map[this.type];
    }
    toJSON() {
        // Get superclass attributes
        let json = super.toJSON();
        json['class'] = 'DNA';
        return json;
    }
}
;
