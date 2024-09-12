// / <reference path="./ammar.ts" />

/**
 * Defines a collection of linearly connected BasicElements.  
 * Is extended by NuclicAcidStrand and Peptide.
 * @param strandID - The strand's id within the system
 * @param system - The strand's parent system
 */

abstract class Strand {

    id: number; //system location
    system: System;
    pos: THREE.Vector3;
    label: string;
    end3: BasicElement;
    end5: BasicElement;
    kwdata: Object;
    pair: Nucleotide | null;
    domains: Nucleotide[][] | null; 


    constructor(id: number, system: System) {
        this.id = id;
        this.system = system;
        this.kwdata = {}
    };

    setFrom(e: BasicElement) {
        if (e) {
            this.end3 = this.end5 = e;
            this.updateEnds();
            this.forEach(e=>{
                e.strand = this;
            })
        } else {
            throw new Error("Cannot set empty strand end");
        }
    }

    isCircular() {
        return this.end3.n3 != null && this.end3.n3 == this.end5;
    }

    createBasicElement(id?: number): BasicElement {
        throw "Cannot create a basic element, need to be a nucleotide, amino acid, etc.";
    }

    getSequence() {
        return this.map(e=>e.type).join('');
    }

    getLength() {
        let e = this.end3;
        let i = 0;
        while(e) {
            e = e.n5;
            i++;
            if(e === this.end3) break;
        }
        return i;
    }

    getKwdataString(dni: string[]) { //dni stands for "do not include"
        let outStr: string[] = []
        for (const [key, value] of Object.entries(this.kwdata)) {
            if (!dni.includes(key)) { outStr.push(key+"="+value) }
        }
        return (outStr.join (" "))
    }  

    updateEnds() {
        let start = this.end3;
        while(this.end3.n3 && this.end3.n3 != this.end5) {
            this.end3 = this.end3.n3;
            // Avoid infinite loop on circular strand
            if (this.end3 == start) {
                this.end5 = this.end3.n3;
                return;
            }
        };
        start = this.end5;
        while(this.end5.n5  && this.end3.n5 != this.end3) {
            this.end5 = this.end5.n5;
            // Avoid infinite loop on circular strand
            if (this.end5 == start) {
                this.end3 = this.end5.n5;
                return;
            }
        };
    }

    /**
     * Return a list of all monomers in strand, in 5' to 3' order
     * @param reverse If set to true, return list in 3' to 5' order instead
     */
    getMonomers(reverse?:boolean): BasicElement[] {
        return this.map(e=>e, reverse);
    }

    /**
     * Return a list of all domains in strand, in 5' to 3' order  by nucleotide
     * Also sets the this.domain
     */
    getDomains():Array<Nucleotide[]> {
        if (this.domains == null){
            let strand_bases:Nucleotide[] = this.map(e=>e); // can't use getMonomers, since it returns basicElment which does not have pair.
            
            //filter for overhangs or upaired staples
            strand_bases = strand_bases.filter(base => base.makePair());


            let pair_ids: number[] = strand_bases.map(base=> base.pair.sid);  // no check as alreday filtered

            // storing domains as nucleotide object
            let domainSubNuc: Array<Nucleotide[]> =[]; 
            let domaintempNuc: Nucleotide[] =[]; 

            let scaffold_len = this.system.MAX_strandLen(); 

            for (let j = 0; j < (pair_ids.length - 1 ); j++){  // len = 49, j<48 mean j goes to 47, 

                let monomerID: number  = pair_ids[j];  // scaffold pair sid
                let nextID: number = pair_ids[j+1];    // scaffold pair sid
                let baseID: number  = strand_bases[j].sid;  // base sid
                let nextbaseID: number = strand_bases[j+1].sid;    // base sid

                // check scaf and staple id within 1; check domain covers scaf start-end point;
                if (
                    (Math.abs(monomerID-nextID) == 1 || Math.abs(monomerID-nextID) == (scaffold_len-1)) 
                   && 
                    (Math.abs(baseID-nextbaseID) == 1) // incase middle staple regions are not paired
                ){
                    domaintempNuc.push(strand_bases[j]) ; 

                    // to account for the last domain 
                    if (j == (pair_ids.length-2)){
                        domaintempNuc.push(strand_bases[j+1]) ;  // by nuc
                        domainSubNuc.push(domaintempNuc); 
                    }
                }
                else{
                    domaintempNuc.push(strand_bases[j]) ; 
                    domainSubNuc.push(domaintempNuc); 
                    domaintempNuc = [] ;  // restart for the next domain

                    // incase the last two nucleotides are not in same domain. 
                    if (j == (pair_ids.length-2)){
                        domaintempNuc.push(strand_bases[j+1]) ;  
                        domainSubNuc.push(domaintempNuc); 
                    }
                }
            }
            this.domains = domainSubNuc; 
            return domainSubNuc ;
        }
        else{return this.domains;}
    }

    /**
     * Return a hybridization energy (kcal/mol) of the strand at the specificed temperature
     *      */
    getHybrid_dG_dS(temp:number=323.15):number[]{
        let seq = this.getSequence(); 
        return get_dG_dS_hyb(seq,temp); 
    }

    getDomainedHybrid_dG_dS_old(temp:number=323.15):number[]{
        let domain = this.getDomains(); 
        let sum_hybrid_g:number = 0; 
        let sum_hybrid_s:number = 0; 

        for (let i = 0; i < domain.length; i++){
            let seq:string = "" ;  // initialize seq
            for (let j =0 ; j < domain[i].length ; j++){
                seq += domain[i][j].type;  // add each nucleotide to form a sequence
            }

            let temporary = get_dG_dS_hyb(seq,temp); 
            sum_hybrid_g += temporary[0]; 
            sum_hybrid_s += temporary[1]; 
        }

        return [sum_hybrid_g,sum_hybrid_s]
    }

    getDomainedHybrid_dG_dS(temp:number=323.15,Mg_conc=12.5e-3):number[]{
        let seqs:string[] = this.get_domainSeq();  
        let sum_hybrid_g:number = 0; 
        let sum_hybrid_s:number = 0; 

        for (let i = 0; i < seqs.length; i++){
            let temporary = get_dG_dS_hyb(seqs[i],temp,Mg_conc); 
            sum_hybrid_g += temporary[0]; 
            sum_hybrid_s += temporary[1]; 
        }

        return [sum_hybrid_g,sum_hybrid_s]
    }

    get_pairedLength():number{
        let strand_doms = this.getDomains();
        let L_paired:number = 0; 

        for (let j = 0 ; j < strand_doms.length ; j++){
            L_paired += strand_doms[j].length; 
        }

        return L_paired;
    }

    getLoopSizes():number[] {
        let domains_staple: Array<Nucleotide[]> = this.getDomains() ;
        let loopLengths: number[] = [] ; 
        let staple_points: number[] = [];  // stores domain start and end points as on scaffold. 

        // get a list of staple start and end points as sid of scaffold 
        for (let j = 0; j < domains_staple.length ; j++){
            let domain_size:number = domains_staple[j].length; 
            let begStap1:number ;
            let endStap1:number ;

            begStap1 = domains_staple[j][0].pair.sid;
            endStap1 = domains_staple[j][domain_size-1].pair.sid; 

            staple_points.push(begStap1);
            staple_points.push(endStap1); 
        }

        // NOTE that staple binds 3' to 5', which is 5' to 3' for scaffold, so for each domain endpoint has to be greater than startpoint!!
        // following douglas, take mean position of domains, and simple end - start, also use the smaller loop
        
        let mean_domainPoint:number[] = []; 
        let scaffold_len = this.system.MAX_strandLen(); 

        if (staple_points.length%2 == 0 && staple_points.length >= 4){ // atleast 2 domains needed for loop penalty
            // add center bases of the domain to the list
            for (let j = 0 ; j < (staple_points.length-1) ; j+=2){ 
                let indx_domain:number  =  Math.floor((j+1)/2) // mapping to domain index

                if (Math.abs(staple_points[j]-staple_points[j+1]) > domains_staple[indx_domain].length){ // incase the domain is where scaffold start and ends
                    // take middle index of domains_staple, and get sid for that base
                    let middle_idx:number = Math.floor(domains_staple[indx_domain].length / 2); 
                    let middle_base:Nucleotide = domains_staple[indx_domain][middle_idx]; 
                 
                    mean_domainPoint.push(middle_base.pair.sid)
                
                }
                else{
                mean_domainPoint.push(mean_domain_position([staple_points[j],staple_points[j+1]]));
                }
            }
            
            // get the loop sizes
            for (let j = 0; j < (mean_domainPoint.length-1); j++){
                let num_bases:number = Math.abs(mean_domainPoint[j]-mean_domainPoint[j+1]);  
                loopLengths.push(Math.min(num_bases,scaffold_len-num_bases));  // pick the smaller loop
            }

            return loopLengths; 
        }
        else { // if only one domain than no loop penalty
            loopLengths.push(0);
            return loopLengths;
        }
    }

    /**
     * Return the delG_lopp (kcal/mol) for the strand at the specified temperature (in K)
     */
    get_Loop_dG_dS(temp:number = 323.15):number[] {
        let loopLengths = this.getLoopSizes() ; 
        let dG_loop:number = 0; 
        let dS_loop:number = 0; 

        for ( let j = 0; j < loopLengths.length; j++){
            let num_bases: number = loopLengths[j];
            let distance_sq = loop_endtoend(num_bases)
            let dG_dS:number[] = get_dG_dS_loop(distance_sq,temp); 
            dG_loop += dG_dS[0];
            dS_loop += dG_dS[1]; 
        }
        return [dG_loop,dS_loop];
    }

    /**
     * Return melting temp in celcius for the strand using douglas eq, 
     * takes in the output of getDomains
     */
    get_Tm(Mg_conc:number=12.5e-3,staple_conc:number=200e-9,scaf_conc:number=50e-9,temp:number=323.15):number{
        let dS_conc = 0.0019872*Math.log(staple_conc-0.5*scaf_conc); 

        let delH_total = 0; 
        let seq_list:string[] = this.get_domainSeq();
        for (let j = 0 ; j < seq_list.length ; j++){
            delH_total += get_dH_SantaLucia2004(seq_list[j]);
        }

        let delS_total = this.getDomainedHybrid_dG_dS(temp,Mg_conc)[1] + this.get_Loop_dG_dS(temp)[1] + dS_conc; 
        let Tm:number = (delH_total/delS_total) - 273.15
        return Tm; 
    }

    /**
     * Return list of domain sequences
     * takes in the output of getDomains
     */
    get_domainSeq():string[]{
        let dom = this.getDomains(); 
        let num_dom = dom.length; 
        let seq_list:string[] = []; 

        for (let j = 0 ; j < num_dom ; j++){
            let seq:string = dom[j].map(e=>e.type).join(''); 
            seq_list.push(seq);
        }

        return seq_list;
    }

    /**
    * Return probability using douglas eq, 
    * @param temp temp in Kelvin, defualt = 323.15 
    */
    get_prob(temp:number=323.15,Mg_conc:number=12.5e-3,staple_conc:number=200e-9,scaf_conc:number=50e-9):number{
        let RT = 0.0019872 * temp; 
        let dG_conc = -RT*Math.log(staple_conc-0.5*scaf_conc);   // kcal/mol
        let dg_total = this.getDomainedHybrid_dG_dS(temp,Mg_conc)[0]+this.get_Loop_dG_dS(temp)[0] + dG_conc; 
        return (Math.exp(-dg_total/RT) / (1 + Math.exp(-dg_total/RT))); 
    }

    /**
     * Return an array containing part of the strand
     * @param n5 5' element to start at
     * @param n3 3' element to end at
     */
    getSubstrand(n5:BasicElement, n3:BasicElement): BasicElement[] {
        let out:BasicElement[] = []
        let curr = n5;
        while (curr != n3) {
            out.push(curr);
            curr = curr.n3;
        }
        out.push(curr);
        return out
    }

    /**
     * Performs the specified action for each element of the strand.
     * @param callbackfn A function that accepts up to two arguments
     * @param reverse Iterate in 3' to 5' direction, instead of the default 5' to 3'
     * @param condition If provided, only continue looping while condition is true
     */
    forEach(callbackfn: (value: BasicElement, index: number)=>void, reverse?:boolean, condition?: (value: BasicElement, index: number)=>boolean) {
        const start = reverse ? this.end3 : this.end5;
        let e = start;
        let i = 0;
        while(e && (!condition || condition(e,i))) {
            callbackfn(e, i);
            e = reverse ? e.n5 : e.n3;
            i++;
            if(e === start) break;
        }
    }

    /**
     * Calls a defined callback function on each monomer of the strand, and returns an array that contains the results
     * @param callbackfn A function that accepts up to two arguments
     * @param reverse Iterate in 3' to 5' direction, instead of the default 5' to 3'
     */
    map(callbackfn: (value: BasicElement, index: number)=>void, reverse?:boolean) {
        let list = [];
        this.forEach((e,i)=>{list.push(callbackfn(e, i))}, reverse);
        return list;
    }

    /**
     * Returns the monomers of the strand that meet the condition specified in a callback function.
     * @param callbackfn — A function that accepts up to two arguments, returning a boolean
     * @param reverse Retur filtered list in 3' to 5' direction, instead of the default 5' to 3'
     */
    filter(callbackfn: (value: BasicElement, index: number)=>boolean, reverse?:boolean) {
        let list = [];
        this.forEach((e,i)=>{
            if(callbackfn(e,i)){
                list.push(e);
            }
        }, reverse);
        return list;
    }

    //reverse is set to true so things select in standard oxDNA d3'-5' order
    toggleMonomers() {
        this.forEach(e=>e.toggle(), true);
    }

    select() {
        this.forEach(e=>e.select(), true);
        updateColoring();
    }

    deselect() {
        this.forEach(e=>e.deselect(), true);
        updateColoring();
    }

    isEmpty(): Boolean {
        //console.assert(this.end3 ? true : !this.end5, "Stand incorrectly empty");
        return !this.end3 && !this.end5;
    }

    getPos() {
        let com = new THREE.Vector3();
        let length = 0;
        this.forEach(e=>{
            com.add(e.getPos());
            length ++;
        })
        return com.divideScalar(length);
    };

    abstract translateStrand(amount: THREE.Vector3): void;

    isPeptide(): boolean{
        return false;
    }

    isNucleicAcid(): boolean {
        return false;
    }

    isGS(): boolean {
        return false;
    }

    toJSON() {
        // Specify required attributes
        let json = {
            id: this.id,
            monomers: this.getMonomers(),
            end3: this.end3.id,
            end5: this.end5.id
        };
        // Specify optional attributes
        if (this.label) json['label'] = this.label;

        return json;
    };
};

class NucleicAcidStrand extends Strand {
    constructor(id: number, system: System) {
        super(id, system);
    };

    createBasicElement(id?: number) {
        if (this.kwdata['type'] == 'RNA')
            return new RNANucleotide(id, this);
        else
            return new DNANucleotide(id, this);
    };

    createBasicElementTyped(type: string, id?: number) {
        if (type.toLowerCase() == 'rna')
            return new RNANucleotide(id, this);
        else if (type.toLowerCase() == 'dna')
            return new DNANucleotide(id, this);
        else{
            notify(type+" is not a recognized nucleic acid type, oxView only supports 'dna' or 'rna' at the moment.")
            return
        }
    };

    /**
     * Translate the strand by a given amount
     * @param amount Vector3 with the amount to translate the strand
     */
    translateStrand(amount: THREE.Vector3) {
        const s = this.system;
        const monomers = this.getMonomers(true);
        monomers.forEach(e => e.translatePosition(amount));
        
        s.callUpdates(['instanceOffset'])
        if (tmpSystems.length > 0) {
            tmpSystems.forEach((s) => {
                s.callUpdates(['instanceOffset'])
            })
        }
    }

    /**
     * Find all domains in the strand matching the provided sequence.
     * @param sequence
     * @returns List of list of nucleotides (empty if no match)
     */
    search(sequence: string) {
        let matching: Nucleotide[] = [];
        let matchings: Nucleotide[][] = [];
        this.forEach((e: Nucleotide)=> {
            if (matching.length === sequence.length) {
                // One full domain found, start looking for more
                matchings.push(matching);
                matching = [];
            }
            if (e.isType(sequence[matching.length])) {
                // Add elements while they match the sequence
                matching.push(e);
            } else {
                // Not a match
                matching = [];
                // Maybe it matches the first element?
                if (e.isType(sequence[matching.length])) {
                    matching.push(e);
                }
            }
        });
        // Don't forget that the last one might be a match
        if (matching.length === sequence.length) {
            matchings.push(matching);
        }
        //console.log(matchings.map(m=>m.map(e=>e.type).join('')).join('|'));
        return matchings;
    }

    isNucleicAcid(): boolean {
        return true;
    }

    isDNA(): boolean {
        return this.kwdata['type'] == 'DNA' ? true : false
    }

    isRNA(): boolean {
    return this.kwdata['type'] == 'RNA' ? true : false
    }

    toJSON() {
        // Get superclass attributes
        let json = super.toJSON();
        json['class'] = 'NucleicAcidStrand';
        return json;
    };
}
class Peptide extends Strand {
    constructor(id: number, system: System) {
        super(id, system);
    };

    createBasicElement(id?: number) {
        return new AminoAcid(id, this);
    };

    translateStrand(amount: THREE.Vector3) {
        const s = this.system;
        const monomers = this.getMonomers();
        for (
            let i = monomers[0].sid * 3;
            i <= monomers[monomers.length-1].sid * 3;
            i+=3)
        {

            s.nsOffsets[i] += amount.x;
            s.nsOffsets[i + 1] += amount.y;
            s.nsOffsets[i + 2] += amount.z;

            s.bbOffsets[i] += amount.x;
            s.bbOffsets[i + 1] += amount.y;
            s.bbOffsets[i + 2] += amount.z;

            s.bbconOffsets[i] += amount.x;
            s.bbconOffsets[i + 1] += amount.y;
            s.bbconOffsets[i + 2] += amount.z;

            s.cmOffsets[i] += amount.x;
            s.cmOffsets[i + 1] += amount.y;
            s.cmOffsets[i + 2] += amount.z;
        } 
        s.callUpdates(['instanceOffset'])
        if (tmpSystems.length > 0) {
            tmpSystems.forEach((s) => {
                s.callUpdates(['instanceOffset'])
            })
        }
    };

    isPeptide(): boolean{
        return true;
    }

    toJSON() {
        // Get superclass attributes
        let json = super.toJSON();
        json['class'] = 'Peptide';
        return json;
    };

    //the default for DNA/RNA reflects that DNA/RNA are written backwards in oxDNA, but proteins are written the normal way.
    getMonomers(reverse?:boolean): BasicElement[] {
        return super.getMonomers(!reverse)
    }

    forEach(callbackfn: (value: BasicElement, index: number)=>void, reverse?:boolean, condition?: (value: BasicElement, index: number)=>boolean) {
        super.forEach(callbackfn, !reverse, condition);
    }

    map(callbackfn: (value: BasicElement, index: number)=>void, reverse?:boolean) {
        return super.map(callbackfn, !reverse);
    }

    filter(callbackfn: (value: BasicElement, index: number)=>boolean, reverse?:boolean) {
        return super.filter(callbackfn, !reverse)
    }

    toggleMonomers() {
        this.forEach(e=>e.toggle());
    }

    select() {
        this.forEach(e=>e.select());
    }

    deselect() {
        this.forEach(e=>e.deselect());
    }

}

// Meant to hold multi-sized generic spheres representing arbitrary particle types
class Generic extends Strand {
    constructor(id: number, system: System) {
        super(id, system);
    };

    createBasicElement(id?: number) {
        return new GenericSphere(id, this);
    };


    translateStrand(amount: THREE.Vector3) {
        const s = this.system;
        const monomers = this.getMonomers();
        for (
            let i = monomers[0].sid * 3;
            i <= monomers[monomers.length-1].sid * 3;
            i+=3)
        {

            s.nsOffsets[i] += amount.x;
            s.nsOffsets[i + 1] += amount.y;
            s.nsOffsets[i + 2] += amount.z;

            s.bbOffsets[i] += amount.x;
            s.bbOffsets[i + 1] += amount.y;
            s.bbOffsets[i + 2] += amount.z;

            s.bbconOffsets[i] += amount.x;
            s.bbconOffsets[i + 1] += amount.y;
            s.bbconOffsets[i + 2] += amount.z;

            s.cmOffsets[i] += amount.x;
            s.cmOffsets[i + 1] += amount.y;
            s.cmOffsets[i + 2] += amount.z;
        }
        s.callUpdates(['instanceOffset'])
        if (tmpSystems.length > 0) {
            tmpSystems.forEach((s) => {
                s.callUpdates(['instanceOffset'])
            })
        }
    };

    isGS(): boolean{
        return true;
    }

    toJSON() {
        // Get superclass attributes
        let json = super.toJSON();
        json['class'] = 'GS';
        return json;
    }

    //the default for DNA/RNA reflects that DNA/RNA are written backwards in oxDNA, but proteins are written the normal way.
    getMonomers(reverse?:boolean): BasicElement[] {
        return super.getMonomers(!reverse)
    }

    forEach(callbackfn: (value: BasicElement, index: number)=>void, reverse?:boolean, condition?: (value: BasicElement, index: number)=>boolean) {
        super.forEach(callbackfn, !reverse, condition);
    }

    map(callbackfn: (value: BasicElement, index: number)=>void, reverse?:boolean) {
        return super.map(callbackfn, !reverse);
    }

    filter(callbackfn: (value: BasicElement, index: number)=>boolean, reverse?:boolean) {
        return super.filter(callbackfn, !reverse)
    }

    toggleMonomers() {
        this.forEach(e=>e.toggle());
    }

    select() {
        this.forEach(e=>e.select());
    }

    deselect() {
        this.forEach(e=>e.deselect());
    }

}