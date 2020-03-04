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

    // Uses method from generators.py.  Needs to be relaxed since this is oxDNA1 helix
    extendStrand(len: number, direction:string) {
        let rot = 35.9*Math.PI/180
        let rise = 0.3897628551303122
        
        const start_pos = this.getInstanceParameter3("cmOffsets");
        const bb_pos = this.getInstanceParameter3("bbOffsets");
        const ns_pos = this.getInstanceParameter3("nsOffsets");
        const old_A1 = this.getA1(ns_pos.x, ns_pos.y, ns_pos.z, start_pos.x, start_pos.y, start_pos.z)
        let dir = this.getA3(bb_pos.x, bb_pos.y, bb_pos.z, start_pos.x, start_pos.y, start_pos.z, old_A1.x, old_A1.y, old_A1.z);
        if (direction == "neighbor3") {
            dir.multiplyScalar(-1);
        }
        let R = new THREE.Matrix4;
        R.makeRotationAxis(dir, rot)
        let rb = new THREE.Vector3(0.6, 0, 0)
        let a1 = old_A1.clone()
        let a3 = dir;
        let out = [];

        for (let i = 0; i < len; i++) {
            a1.applyMatrix4(R);
            rb.add(a3.clone().multiplyScalar(rise)).applyMatrix4(R);
            out.push([rb.x+start_pos.x, rb.y+start_pos.y, rb.z+start_pos.z, a1.x, a1.y, a1.z, a3.x, a3.y, a3.z]);
        }

        return out
    }

    getComplementaryType(): string {
        var map = {A:'T',G:'C',C:'G', T:'A'}
        return map[this.type];
    }
};