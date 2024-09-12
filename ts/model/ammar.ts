type NearestNeighborValues = {
    [key: string]: number;
};

type SantaLucia2004Table1 = {
    dH: NearestNeighborValues; // ∆H° [kcal/mol]
    dS: NearestNeighborValues; // ∆S° [cal/mol•°K]
};

const SantaLucia2004Table1: SantaLucia2004Table1 = {
    dH: {  // Nearest-neighbor enthalpy values ∆H° [kcal/mol]
        'AA': -7.6, 'TT': -7.6, 'AT': -7.2, 'TA': -7.2,
        'CA': -8.5, 'TG': -8.5, 'GT': -8.4, 'AC': -8.4,
        'CT': -7.8, 'AG': -7.8, 'GA': -8.2, 'TC': -8.2,
        'CG': -10.6, 'GC': -9.8, 'GG': -8.0, 'CC': -8.0,
        'Initiation': 0.2, 'Terminal-AT-Penalty': 2.2
    },
    dS: {  // Nearest-neighbor entropy values ∆S° [cal/mol•°K]
        'AA': -21.3, 'TT': -21.3, 'AT': -20.4, 'TA': -21.3,
        'CA': -22.7, 'TG': -22.7, 'GT': -22.4, 'AC': -22.4,
        'CT': -21.0, 'AG': -21.0, 'GA': -22.2, 'TC': -22.2,
        'CG': -27.2, 'GC': -24.4, 'GG': -19.9, 'CC': -19.9,
        'Initiation': -5.7, 'Terminal-AT-Penalty': 6.9
    }
};

// Count number of 'A' or 'T' chars at the start and end of sequence
function count_Terminal_ATs(seq: string): number {
    return (seq[0] === 'A' || seq[0] === 'T' ? 1 : 0) +
           (seq.length > 1 && (seq[seq.length - 1] === 'A' || seq[seq.length - 1] === 'T' ? 1 : 0));
}

// Calculate ∆H, per SantaLucia 2004, Equation 1 and Table 1
function get_dH_SantaLucia2004(seq:string): number {
    let NN_dH_table: NearestNeighborValues = SantaLucia2004Table1['dH']; 
    let end_AT: number = count_Terminal_ATs(seq); 

    let hybseq: number = 0 ; 
    for (let j = 0; j < (seq.length - 1 ); j++){ 
        hybseq += NN_dH_table[seq[j]+seq[j+1]];
    }
    
    let dH: number = NN_dH_table['Initiation'] + hybseq + end_AT*NN_dH_table['Terminal-AT-Penalty']; 
    
    return dH; 

}

// Calculate ∆S, per SantaLucia 2004 Equation 1 and Table 1
function get_dS_SantaLucia2004(seq:string): number {
    let NN_dS_table: NearestNeighborValues = SantaLucia2004Table1['dS']; 
    let end_AT: number = count_Terminal_ATs(seq); 

    let hybseq: number = 0 ; 
    for (let j = 0; j < (seq.length - 1 ); j++){ 
        hybseq += NN_dS_table[seq[j]+seq[j+1]];
    }
    
    let dS: number = NN_dS_table['Initiation'] + hybseq + end_AT*NN_dS_table['Terminal-AT-Penalty']; 
    
    return dS;
}


//Dunn 2015 salt-corrected dS entropy value 
function get_salt_corrected_dS_Dunn2015(seq_length:number,Mg_conc:number=12.5e-3):number{
    // Mg_conc = 12.5 mM (Assumed in Dunn et al 2015)
    let TRIS_CONC:number =  40.0e-3; // 40.0 mM (Assumed in Dunn et al 2015)
    let EQN12_FACTOR:number = 0.368 * Math.log(0.5 * TRIS_CONC + 3.3 * Math.sqrt(Mg_conc));  
    return EQN12_FACTOR*(seq_length-1)
}   


// Calculate changes in free energy of given sequence @ a given temp. Defualt is 323.15
function get_dG_dS_hyb(seq:string,temp:number=323.15,Mg_conc:number=12.5e-3):number[]{
    let dH:number = get_dH_SantaLucia2004(seq);   // get dH for the seq
    let dS_base:number = get_dS_SantaLucia2004(seq);  // get dS for the seq

    let dS_saltCorr:number = get_salt_corrected_dS_Dunn2015(seq.length,Mg_conc);  // get correction for salt
    let dS_base_corr:number = (dS_base + dS_saltCorr) / 1000 ;  // get resultant dS after correction 

    let dG = dH - temp*dS_base_corr;  // determine dG at specified temperature(K) 

    return [dG,dS_base_corr]; 
}


// Given a ssDNA length, calculate the end-to-end distance in [nm^2]
function loop_endtoend(num_bases:number):number{
    if (num_bases <= 0){
        return 0
    }
    else{
    let L_base:number = 0.6 // nm
    let L_c:number = num_bases * L_base ; 
    let L_p:number = 0.9 // nm 

    return 2*L_p*L_c*(1 - (L_p/L_c)*(1-Math.exp(-L_c/L_p)));
    }

}

// Calculate loop-closure penalty for given end-to-end distance
function get_dG_dS_loop(dist_sq:number,temp:number=323.15):number[]{
    if (dist_sq <= 0){ // if no distance no penalty
        return [0,0]; 
    }

    else{    
        let R:number = 0.0019872 ; // kcal/mol K

        // Divide by 1000 to convert cal/(mol.K) to kcal/(mol.K) 
        let effective_conc:number =1.0 / (6.02E23) * Math.pow((3.0 / (2 * Math.PI * dist_sq * 1E-18)), (3 / 2.0)) / 1000;
        let dS_loop = R*Math.log(effective_conc); 
        let dG_loop = -temp * dS_loop;
    
        return [dG_loop,dS_loop]; 
    }
}
  

/*
*  this returns the sid of center nucleotide of the domain
*  assumes odered , in the sense that, the end points of the list are the maximas or minima
*/ 
function mean_domain_position(domain:number[]):number{  
    // add a check if domain is empty
 
    let start_idx = domain[0] ;                 
    let end_idx = domain[domain.length-1]; 
    let min_val:number = Math.min(start_idx,end_idx);
    let diff:number = Math.abs((start_idx - end_idx) / 2 ); 
    
    // this is what douglas does, doesn't look good, but does matter that much
    // if (diff%2 != 0){ // if even len domain
    //     return Math.ceil(diff) + min_val - min_val%2; // counts from smaller number end basesd on even or odd
    // }
    // else
    //     return Math.ceil(diff) + min_val; 

    return Math.ceil(diff) + min_val;
}

// function to get the score for the design, based on Douglas, just for debugging purposes
function getScore(Mg_conc:number=12.5e-3,staple_conc:number=200e-9,scaf_conc:number=50e-9,temp:number=323.15){ 
    let scaf_len:number = systems[0].MAX_strandLen(); 

    for (let s = 0; s < systems.length; s++){ // calc for all systems
        let a = systems[0].strands.filter(s=>s.getLength() < scaf_len); 
        let Q:number = 0 ; // score
        let L:number = 0 ; // divide it by the total length

        for(let j = 0; j < a.length; j++){
            let indv_strand = a[j]; 
            let prob = indv_strand.get_prob(temp,Mg_conc,staple_conc,scaf_conc);
            let dup_len = indv_strand.get_pairedLength(); // duplex length
            Q += Math.log(prob); 
            L += dup_len; 
        }
        
        console.log('Q: ', Q);
        console.log("the score is: ", parseFloat((Q/L).toFixed(6)));
    }
}

// random function 
function AvgMelting(){ // gives the average melting temp in celcius relative to 50
    let a = systems[0].strands.filter(s=>s.getLength() < 1000); // ASSUMING ONLY one system
    let total_temp:number = 0;
    for(let j = 0; j < a.length; j++){
        total_temp += a[j].get_Tm(); 
    }
    let avg_temp = total_temp / a.length; 
    console.log(avg_temp - 50);
}