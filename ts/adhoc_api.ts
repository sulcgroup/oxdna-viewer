/// <reference path="./main.ts" />
// Usefull bits of code simplifying quering the structure


module api{
    export function toggle_strand(strand : Strand): Strand{
        let nucleotides = strand.nucleotides; 
        nucleotides.map( 
            (n:Nucleotide) => n.visual_object.visible = !n.visual_object.visible);
        render();
        return strand;
    }

    // TODO: integrate with the selection mechanism 
    export function mark_stand(strand: Strand) : Strand{
        let nucleotides = strand.nucleotides; 
        nucleotides.map((n: Nucleotide) => toggle(n));
        render();
        return strand;
    };

    export function get_sequence(strand : Strand) : string {
        let seq : string[]; 
        let nucleotides = strand.nucleotides; 
        nucleotides.reverse().map( 
            (n: Nucleotide) => seq.push(<string> n.type));
        return seq.join("");
    };

    // get a dictionary with every strand length : [strand] listed   
    export function count_stand_length({system = systems[0]} = {}) {
        let strand_length : { [index: number]: [Strand] } = {};
        system.strands.map((strand: Strand) =>{
            let l = strand.nucleotides.length;
            if( l in strand_length) 
                strand_length[l].push(strand);
            else
                strand_length[l] = [strand];
        });
        return strand_length;  
    };

    export function highlite5ps({system = systems[0]} = {}){
        system.strands.map((strand)=>{
            toggle(strand.nucleotides[strand.nucleotides.length -1]);
        });
    }

    
}
