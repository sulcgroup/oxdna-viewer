/**
 * Extends Nuculeotide with RNA-specific properties such as base position relative to backbone, and A-form helix creation
 */

class RNANucleotide extends Nucleotide {
    constructor(gid: number, strand: Strand) {
        super(gid, strand);
        this.elementType = RNA;
        this.bbnsDist = 0.8246211;

    };

    calcBBPos(p: THREE.Vector3, a1: THREE.Vector3, a2: THREE.Vector3, a3: THREE.Vector3): THREE.Vector3 {
        return new THREE.Vector3(
            p.x - (0.4 * a1.x + 0.2 * a3.x),
            p.y - (0.4 * a1.y + 0.2 * a3.y),
            p.z - (0.4 * a1.z + 0.2 * a3.z)
        );
    };

    getA2(): THREE.Vector3 {
        const a1 = this.getA1();
        const a3 = this.getA3();
        const a2 = a1.clone().cross(a3);

        return a2;
    }

    getA3(): THREE.Vector3 {
        const cm = this.getInstanceParameter3("cmOffsets");
        const bb = this.getInstanceParameter3("bbOffsets");
        const a1 = this.getA1();
        const a3 = bb.clone().sub(cm).add(a1.clone().multiplyScalar(0.4)).divideScalar(-0.2);

        return a3;
    };

    // Uses the method from generate_RNA.py found in the oxDNA UTILS directory
    extendStrand(len: number, direction:string) {
        const inclination = 15.5*Math.PI/180;
        const bp_backbone_distance = 2;
        const diameter = 2.35;
        const base_base_distance = 0.3287;
        const rot = 32.7*Math.PI/180;
        const cord = Math.cos(inclination) * bp_backbone_distance;
        const center_to_cord = Math.sqrt(Math.pow(diameter/2, 2) - Math.pow(cord/2, 2));
        
        //We just set the direction the the orientation of the a3 vector
        const start_pos = this.getInstanceParameter3("cmOffsets");
        let dir = this.getA3();
        if (direction == "neighbor5") {
            dir.multiplyScalar(-1);
        }
        const dir_norm = Math.sqrt(dir.dot(dir));
        dir.divideScalar(dir_norm);
        const x2 = center_to_cord;
        const y2 = -cord/2;
        const z2 = (bp_backbone_distance/2) * Math.sin(inclination);
        const x1 = center_to_cord;
        const y1 = cord/2;
        const z1 = -(bp_backbone_distance/2) * Math.sin(inclination);
        let r1 = new THREE.Vector3(x1, y1, z1);
        let r2 = new THREE.Vector3(x2, y2, z2);
        let r1_to_r2 = r2.clone().sub(r1);
        let R = new THREE.Matrix4;
        R.makeRotationAxis(dir, rot);
        let a1: THREE.Vector3;
        let a1proj = new THREE.Vector3;
        let a1projnorm: number;
        let a3: THREE.Vector3;
        let out = [];
        let RNA_fudge: THREE.Vector3;

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
            out.push([r1.x+start_pos.x+RNA_fudge.x, r1.y+start_pos.y+RNA_fudge.y, r1.z+start_pos.z+RNA_fudge.z, a1.x, a1.y, a1.z, a3.x, a3.y, a3.z]) //r1 needs to have a fudge factor from the RNA model added
            }

        return out;
    }

    getComplementaryType(): string {
        var map = {A:'U',G:'C',C:'G', U:'A'}
        return map[this.type];
    }

    toJSON() {
        // Get superclass attributes
        let json = super.toJSON();

        json['class'] = 'RNA';
        return json;
    }
};