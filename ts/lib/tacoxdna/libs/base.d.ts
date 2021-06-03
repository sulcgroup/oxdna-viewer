import * as THREE from 'three';
declare const base_to_number: {
    A: number;
    a: number;
    G: number;
    g: number;
    C: number;
    c: number;
    T: number;
    t: number;
    U: number;
    u: number;
    D: number;
};
declare let FLT_EPSILON: number;
declare const POS_BACK = -0.4;
declare const POS_STACK = 0.34;
declare const POS_BASE = 0.4;
declare const CM_CENTER_DS: number;
declare const FENE_R0_OXDNA = 0.7525;
declare const FENE_EPS = 2;
declare const LENGTH_FACT = 8.518;
declare const BASE_BASE = 0.3897628551303122;
declare const INT_HYDR = 4;
declare const INT_STACK = 2;
declare const INT_CROSS_STACK = 5;
declare const INT_COAX_STACK = 6;
declare const INT_FENE = 0;
declare const INT_EXC_BONDED = 1;
declare const INT_EXC_NONBONDED = 3;
declare const H_CUTOFF = -0.1;
declare const MM_GROOVING = false;
declare class Logger {
    static DEBUG: number;
    static INFO: number;
    static WARNING: number;
    static CRITICAL: number;
    static debug_level: number;
    static messages: string[];
    static logFunction: (msg: string) => void;
    static log(msg: string, level?: number, additional?: string): void;
    static die(msg: any): void;
}
declare class Nucleotide {
    static index: number;
    index: number;
    cm_pos: THREE.Vector3;
    cm_pos_box: THREE.Vector3;
    _a1: THREE.Vector3;
    _a3: THREE.Vector3;
    _base: number;
    _L: any;
    _v: any;
    n3: number;
    next: number;
    pair: Nucleotide;
    cluster: number;
    color: number;
    strand: number;
    constructor(cm_pos: any, a1: any, a3: any, base: number | string, v?: THREE.Vector3, L?: THREE.Vector3, n3?: number, pair?: any, cluster?: any, color?: any);
    /**
     * Get position of the base centroid
     * Note that cm_pos is the centrod of the backbone and base.
     * @returns the position of the base centroid
     */
    get pos_base(): THREE.Vector3;
    get pos_stack(): THREE.Vector3;
    get pos_back(): THREE.Vector3;
    /**
     * Get the position of the backbone centroid relative to the centre of mass
        i.e. it will be a vector pointing from the c.o.m. to the backbone
     * @returns position of the backbone centroid relative to the centre of mass
     */
    get pos_back_rel(): THREE.Vector3;
    get a2(): THREE.Vector3;
    copy(disp?: THREE.Vector3, rot?: THREE.Matrix3): Nucleotide;
    translate(disp: THREE.Vector3): void;
    rotate(R: THREE.Matrix3, origin?: THREE.Vector3): void;
    distance(other: Nucleotide, PBC?: boolean, box?: THREE.Vector3): THREE.Vector3;
    get_base(): string;
    _get_lorenzo_output(): string;
}
declare class Strand {
    index: number;
    _first: number;
    _last: number;
    _nucleotides: Nucleotide[];
    _sequence: number[];
    _circular: boolean;
    constructor();
    static index: number;
    get N(): number;
    get sequence(): string | number[];
    _prepare(si: number, ni: number): number;
    copy(): Strand;
    get cm_pos(): THREE.Vector3;
    set cm_pos(new_pos: THREE.Vector3);
    translate(amount: any): void;
    rotate(R: THREE.Matrix3, origin?: THREE.Vector3): void;
    append(other: Strand): Strand;
    get_slice(start?: number, end?: number): Strand;
    set sequence(seq: string | number[]);
    bring_in_box_nucleotides(box: any): void;
    add_nucleotide(n: Nucleotide): void;
    _get_lorenzo_output(): string[];
    get_lammps_N_of_bonds_strand(): number;
    get_lammps_bonds(): string[];
    make_circular(check_join_len?: boolean): void;
    make_noncircular(): void;
    is_circular(): boolean;
    cut_in_two(copy?: boolean): Strand[];
}
declare class System {
    _time: number;
    _ready: boolean;
    _box: THREE.Vector3;
    _N: number;
    _N_strands: number;
    _strands: Strand[];
    _nucleotide_to_strand: number[];
    _N_cells: THREE.Vector3;
    _cellsides: THREE.Vector3;
    E_pot: number;
    E_kin: number;
    E_tot: number;
    constructor(box: THREE.Vector3, time?: number, E_pot?: number, E_kin?: number);
    get sequences(): number[][];
    get N(): number;
    get N_strands(): number;
    _prepare(): void;
    copy(): System;
    join(other: System, box: THREE.Vector3): System;
    add_strand(s: Strand): boolean;
    add_strands(ss: Strand | Strand[]): boolean;
    rotate(amount: any, origin: any): void;
    translate(amount: any): void;
    print_lorenzo_output(): [string, string];
    print_oxview_output(): string;
    get _nucleotides(): any[];
    map_nucleotides_to_strands(): void;
    print_dot_bracket_output(): string;
}
export { System, Strand, Nucleotide, Logger, base_to_number, FLT_EPSILON, POS_BACK, POS_STACK, POS_BASE, CM_CENTER_DS, FENE_R0_OXDNA, FENE_EPS, LENGTH_FACT, BASE_BASE, INT_HYDR, INT_STACK, INT_CROSS_STACK, INT_COAX_STACK, INT_FENE, INT_EXC_BONDED, INT_EXC_NONBONDED, H_CUTOFF, MM_GROOVING, };
