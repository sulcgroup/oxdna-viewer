import * as base from "./base";
import * as THREE from 'three';
declare class StrandGenerator {
    generate(bp: any, sequence?: any, start_pos?: THREE.Vector3, direction?: THREE.Vector3, perp?: any, rot?: number, double?: boolean, circular?: boolean, DELTA_LK?: number, BP_PER_TURN?: number, ds_start?: any, ds_end?: any, force_helicity?: boolean): base.Strand | base.Strand[];
    generate_or_sq(bp: number, sequence?: any, start_pos?: THREE.Vector3, direction?: THREE.Vector3, perp?: any, double?: boolean, rot?: number, angle?: number | number[], length_change?: any[], region_begin?: any[], region_end?: any[]): base.Strand | base.Strand[];
    generate_double_offset(seqA: string | number[], seqB: string | number[], offset: any, start_pos?: THREE.Vector3, direction?: THREE.Vector3, perp?: any, rot?: number): base.Strand[];
    generate_rw(sequence: any, start_pos?: THREE.Vector3): base.Strand;
}
declare class PairMap {
    map: Map<string, any>;
    constructor();
    set(key: [number, number], val: any): void;
    get(key: [number, number]): any;
    has(key: [number, number]): boolean;
    get size(): number;
    keys(): Generator<number[], void, unknown>;
    entries(): Generator<any[], void, unknown>;
    values(): IterableIterator<any>;
}
declare class vhelix_vbase_to_nucleotide extends PairMap {
    _scaf: PairMap;
    _stap: PairMap;
    nuc_count: number;
    strand_count: number;
    constructor();
    add_scaf(vh: any, vb: any, strand: any, nuc: any): void;
    add_stap(vh: any, vb: any, strand: any, nuc: any): void;
    add_scaf_strand(add_strand: any, reference: any, continue_join?: boolean): 0 | 1;
    add_stap_strand(add_strand: any, reference: any, continue_join?: boolean): 0 | 1;
    add_strand(add_strand: any, reference: any, continue_join?: boolean): 0 | 1;
}
export { StrandGenerator, vhelix_vbase_to_nucleotide, PairMap };
