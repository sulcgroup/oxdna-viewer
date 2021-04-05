// class ANM {
//     id: number
//     system: System;
//     INSTANCES: number;
//     offsets: Float32Array;
//     rotations: Float32Array;
//     colors: Float32Array;
//     scales: Float32Array;
//     visibility: Float32Array;
//     children: ANMConnection[];
//
//     geometry: THREE.InstancedBufferGeometry;
//
//     network: THREE.Mesh;
//
//     constructor(sys: System, id: number, size: number) {
//         this.system = sys;
//         this.id = id;
//         this.initInstances(size);
//         this.children = [];
//     }
//
//     initInstances(nInstances: number) {
//         this.INSTANCES = nInstances;
//         this.offsets = new Float32Array(this.INSTANCES * 3);
//         this.rotations = new Float32Array(this.INSTANCES * 4);
//         this.colors = new Float32Array(this.INSTANCES * 3);
//         this.scales = new Float32Array(this.INSTANCES * 3);
//         this.visibility = new Float32Array(this.INSTANCES * 3);
//     };
//
//     getSystem(): System {
//         return(this.system)
//     }
//
//     fillVec(vecName, unitSize, pos, vals) {
//         for (let i = 0; i < unitSize; i++) {
//             this[vecName][pos * unitSize + i] = vals[i]
//         }
//     };
//
//     createConnection(p1: BasicElement, p2: BasicElement, eqDist: number, type: string, strength: number, extraParams:any[]): ANMConnection {
//         const con = new ANMConnection(this, this.children.length, p1, p2, eqDist, type, strength, extraParams)
//         con.init();
//         this.children.push(con);
//         p1.connections.push(con)
//         p2.connections.push(con);
//         return con
//     }
//
// }
//
// class ANMConnection {
//     parent: ANM;
//     id: number;
//     p1: BasicElement;
//     p2: BasicElement;
//     eqDist: number;
//     type: string;
//     strength: number;
//     extraParams: any[]
//
//     constructor(parent: ANM, id: number, p1: BasicElement, p2: BasicElement, eqDist: number, type: string, strength: number, extraParams: any[]) {
//         this.parent = parent;
//         this.id = id;
//         this.p1 = p1;
//         this.p2 = p2;
//         this.eqDist = eqDist;
//         this.type = type;
//         this.strength = strength;
//         this.extraParams = extraParams //the ANMT model sometimes has additional torsional terms in the parfile
//     }
//
//     init() {
//         //calculate the center of the connection
//         const end1 = this.p1.getInstanceParameter3('bbOffsets');
//         const x1 = end1.x,
//             y1 = end1.y,
//             z1 = end1.z;
//
//         const end2 = this.p2.getInstanceParameter3('bbOffsets');
//         const x2 = end2.x,
//             y2 = end2.y,
//             z2 = end2.z;
//
//         const x = (x1 + x2) / 2,
//             y = (y1 + y2) / 2,
//             z = (z1 + z2) / 2;
//
//         //calculate the length of the connection
//         const len = end1.distanceTo(end2);
//
//         //calculate the orientation of the connection
//         const rot = new THREE.Quaternion().setFromUnitVectors(
//             new THREE.Vector3(0, 1, 0), new THREE.Vector3(x1 - x2, y1 - y2, z1 - z2).normalize()
//         );
//
//         //Assign a color from the backboneColors array
//         const col = backboneColors[this.parent.id % backboneColors.length];
//
//         //Fill in the instancing arrays
//         this.parent.fillVec('offsets', 3, this.id, [x, y, z]);
//         this.parent.fillVec('rotations', 4, this.id,[rot.w, rot.z, rot.y, rot.x]);
//         this.parent.fillVec('colors', 3, this.id, [col.r, col.g, col.b]);
//         this.parent.fillVec('scales', 3, this.id, [1, len, 1]);
//         this.parent.fillVec('visibility', 3, this.id, [1, 1, 1]);
//     }
//
//     getParent() {
//         return this.parent
//     }
//
//     getInstanceParameter3(name: string) {
//         let anm = this.getParent();
//
//         const x: number = anm[name][this.id * 3],
//             y: number = anm[name][this.id * 3 + 1],
//             z: number = anm[name][this.id * 3 + 2];
//
//         return new THREE.Vector3(x, y, z);
//     }
//
//     //retrieve this element's values in a 4-parameter instance array
//     //only rotations
//     getInstanceParameter4(name: string) {
//         let anm = this.getParent();
//
//         const x: number = anm[name][this.id * 4],
//             y: number = anm[name][this.id * 4 + 1],
//             z: number = anm[name][this.id * 4 + 2],
//             w: number = anm[name][this.id * 4 + 3];
//
//         return new THREE.Vector4(x, y, z, w);
//     }
//
//     //set this element's parameters in the anm's instance arrays
//     //doing this is slower than anm.fillVec(), but makes cleaner code sometimes
//     setInstanceParameter(name:string, data) {
//         let anm = this.getParent();
//
//         anm.fillVec(name, data.length, this.id, data);
//     }
//
//
// }
