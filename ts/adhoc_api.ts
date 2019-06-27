/// <reference path="./main.ts" />
// Usefull bits of code simplifying quering the structure


module api{
    export function toggle_strand(strand : Strand): Strand{
        let nucleotides = strand.elements; 
        nucleotides.map( 
            (n:BasicElement) => n.visual_object.visible = !n.visual_object.visible);
        render();
        return strand;
    }

    // TODO: integrate with the selection mechanism 
    export function mark_stand(strand: Strand) : Strand{
        let nucleotides = strand.elements; 
        nucleotides.map((n: BasicElement) => n.toggle());
        render();
        return strand;
    };

    export function get_sequence(strand : NucleicAcidStrand) : string {
        let seq : string[] = []; 
        let nucleotides = strand.elements; 
        nucleotides.reverse().map( 
            (n: BasicElement) => seq.push(<string> n.type));
        return seq.join("");
    };

    // get a dictionary with every strand length : [strand] listed   
    export function count_stand_length({system = systems[0]} = {}) {
        let strand_length : { [index: number]: [NucleicAcidStrand] } = {};
        system.strands.map((strand: NucleicAcidStrand) =>{
            let l = strand.elements.length;
            if( l in strand_length) 
                strand_length[l].push(strand);
            else
                strand_length[l] = [strand];
        });
        return strand_length;  
    };

    export function highlite5ps({system = systems[0]} = {}){
        system.strands.map((strand)=>{
            strand.elements[strand.elements.length -1].toggle();
        });
        render();
    };

    export function toggle_all({system = systems[0]} = {}){
        system.strands.map(api.toggle_strand);
        render();
    }
    
    export function trace_53(element: BasicElement): BasicElement[]{
        let elements : BasicElement[] = [];
        let c : BasicElement = element; 
        while(c){
            elements.push(c);
            c = c.neighbor3;
        }
        return elements.reverse();
    }

    export function nick(element: BasicElement){
        // we break connection to the 3' neighbor 
        let neighbor =  element.neighbor3;
        element.neighbor3 = null;
        neighbor.neighbor5 = null;
        element.visual_object.children[element.SP_CON].visible = false;

        // initial strand
        let strand = element.parent;
        // nucleotides which are after the nick
        let new_nucleotides : BasicElement[] = trace_53(neighbor);
        strand.exclude_Elements(new_nucleotides);
        
        //create fill and deploy new strand 
        let new_strand = strand.parent.create_Strand(strand.parent.strands.length + 1);
        new_nucleotides.forEach(
            (n) => {
                new_strand.add_basicElement(n);
                new_strand.strand_3objects.add(n.visual_object);
            }
        );
        //voodoo
        strand.parent.add_strand(new_strand);
        strand.parent.system_3objects.add(new_strand.strand_3objects);
        render(); 
    }

}
