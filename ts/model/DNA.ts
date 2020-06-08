/**
 * Extends Nuculeotide with DNA-specific properties such as base position relative to backbone, and B-form helix creation
 */

class DNANucleotide extends Nucleotide {
    constructor(gid: number, strand: Strand) {
        super(gid, strand);
        this.elementType = DNA;
        this.bbnsDist = 0.8147053;
    };
    calcBBPos(x: number, y: number, z: number, xA1: number, yA1: number, zA1: number, xA2: number, yA2: number, zA2: number, xA3: number, yA3: number, zA3: number): THREE.Vector3 {
        const xbb = x - (0.34 * xA1 + 0.3408 * xA2),
            ybb = y - (0.34 * yA1 + 0.3408 * yA2),
            zbb = z - (0.34 * zA1 + 0.3408 * zA2);
        return new THREE.Vector3(xbb, ybb, zbb);
    };
    getA3(xbb: number, ybb: number, zbb: number, x: number, y: number, z: number, xA1: number, yA1: number, zA1: number): THREE.Vector3 {
        let xA2: number;
        let yA2: number;
        let zA2: number;
        xA2 = ((xbb - x) + (0.34 * xA1)) / (-0.3408);
        yA2 = ((ybb - y) + (0.34 * yA1)) / (-0.3408);
        zA2 = ((zbb - z) + (0.34 * zA1)) / (-0.3408);

        const a3: number[] = divAndNeg(cross(xA1, yA1, zA1, xA2, yA2, zA2), dot(xA1, yA1, zA1, xA1, yA1, zA1));
        const xA3 = a3[0]; let yA3 = a3[1]; let zA3 = a3[2];
        return new THREE.Vector3(xA3, yA3, zA3);
    };

    // Uses method from generate-sa.py.  Needs to be relaxed since this is oxDNA1 helix
    extendStrand(len: number, direction: string, double: boolean) {
        const rot = 35.9*Math.PI/180 // 0.68940505
        let rise = 0.3897628551303122;
        const startPos = this.getInstanceParameter3("cmOffsets");
        const bbPos = this.getInstanceParameter3("bbOffsets");
        const nsPos = this.getInstanceParameter3("nsOffsets");
        const oldA1 = this.getA1(nsPos.x, nsPos.y, nsPos.z, startPos.x, startPos.y, startPos.z);
        let dir = this.getA3(bbPos.x, bbPos.y, bbPos.z, startPos.x, startPos.y, startPos.z, oldA1.x, oldA1.y, oldA1.z);

        // normalize dir
        const dir_norm = Math.sqrt(dir.clone().dot(dir));
        dir.divideScalar(dir_norm);
        const a1 = oldA1.clone();
        const center = startPos.add(a1.clone().multiplyScalar(0.6));
        
        // create rotational matrix
        let R = new THREE.Matrix4;
        if (direction == "neighbor3") {
            R.makeRotationAxis(dir.clone().negate(), rot);
            rise = -rise;
        }
        else { // neighbor5
            R.makeRotationAxis(dir, rot);
        }

        let rb = new THREE.Vector3(0, 0, 0);
        const a3 = dir;
        const rbShift = a3.clone().multiplyScalar(rise);
        const out = [];

        // add single strand
        for (let i = 0; i < len; i++) {
            a1.applyMatrix4(R);
            rb.add(rbShift);
            out.push([rb.x + center.x - (a1.x * 0.6), rb.y + center.y - (a1.y * 0.6), rb.z + center.z - (a1.z * 0.6), a1.x, a1.y, a1.z, a3.x, a3.y, a3.z]);
        }

        // add complementary strand in the opposite direction
        if (double) {
            a1.negate();
            a3.negate();
            rbShift.negate();
            R.transpose();
            out.push([rb.x + center.x - (a1.x * 0.6), rb.y + center.y - (a1.y * 0.6), rb.z + center.z - (a1.z * 0.6), a1.x, a1.y, a1.z, a3.x, a3.y, a3.z]);
            for (let i = 0; i < len - 1; i++) {
                a1.applyMatrix4(R);
                rb.add(rbShift);
                out.push([rb.x + center.x - (a1.x * 0.6), rb.y + center.y - (a1.y * 0.6), rb.z + center.z - (a1.z * 0.6), a1.x, a1.y, a1.z, a3.x, a3.y, a3.z]);
            }
        }
        return out;
    }

    getComplementaryType(): string {
        var map = {A:'T',G:'C',C:'G', T:'A'}
        return map[this.type];
    }

    toJSON() {
        // Get superclass attributes
        let json = super.toJSON();

        json['class'] = 'DNA';
        return json;
    }
};