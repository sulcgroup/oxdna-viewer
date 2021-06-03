import * as THREE from 'three';
declare function randint(low: number, high?: number, size?: number): number | number[];
declare function arraysEqual(a: any[], b: any[]): boolean;
declare function get_angle(a: any, b: any): number;
declare function get_orthonormalized_base(v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3): [THREE.Vector3, THREE.Vector3, THREE.Vector3];
declare function get_random_vector_in_sphere(r?: number): THREE.Vector3;
declare function get_random_vector(): THREE.Vector3;
declare function get_random_rotation_matrix(): THREE.Matrix3;
export { randint, arraysEqual, get_angle, get_orthonormalized_base, get_random_vector_in_sphere, get_random_vector, get_random_rotation_matrix };
