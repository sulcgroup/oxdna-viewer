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
    }

    export function toggle_base_colors() {
        elements.map(
            (n: BasicElement) => {
                let obj = n.visual_object.children[n.NUCLEOSIDE] as any 
                if (obj.material == grey_material){
                    obj.material = n.elem_to_material(n.type);
                }
                else {
                    obj.material = grey_material;
                }
            }
        )
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
        element.visual_object.remove(
            element.visual_object.children[element.SP_CON]
        );

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

    export function ligate(element1 :BasicElement, element2: BasicElement){
        console.log("Experimental, does not update strand indices yet and will break with Shuchi's update!");
        // assume for now that element1 is 5' and element2 is 3' 
        // get the refference to the strands 
        // strand2 will be merged into strand1 
        let strand1 = element1.parent;
        let strand2 = element2.parent;
        // lets orphan strand2 element
        let bases2 = [...strand2.elements]; // clone the refferences to the elements
        strand2.exclude_Elements(strand2.elements);
        
        //remove strand2 object 
        strand2.parent.system_3objects.remove(strand2.strand_3objects);
        strand2.parent.strands = strand2.parent.strands.filter((ele)=>{
            return ele != strand2;
        });

        // and add them back into strand1 
        //create fill and deploy new strand 
        bases2.forEach(
            (n) => {
                strand1.add_basicElement(n);
                strand1.strand_3objects.add(n.visual_object);
            }
        );
        //interconnect the 2 element objects 
        element1.neighbor3 = element2;
        element2.neighbor5 = element1;
        //TODO: CLEAN UP!!!
        //////last, add the sugar-phosphate bond since its not done for the first nucleotide in each strand
        if (element1.neighbor3 != null && element1.neighbor3.local_id < element1.local_id) {
            let p2 = element2.visual_object.children[element2.BACKBONE].position;
            let x_bb = p2.x,
                y_bb = p2.y,
                z_bb = p2.z;
        
            let p1 = element1.visual_object.children[element1.BACKBONE].position;
            let x_bb_last = p1.x,
                y_bb_last = p1.y,
                z_bb_last = p1.z;
        
        
            let x_sp = (x_bb + x_bb_last) / 2, //sugar phospate position in center of both current and last sugar phosphates
                y_sp = (y_bb + y_bb_last) / 2,
                z_sp = (z_bb + z_bb_last) / 2;
                
            let sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
            // easy periodic boundary condition fix  
            // if the bonds are to long just don't add them 
            if (sp_len <= 500) {
                let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(
                    new THREE.Quaternion().setFromUnitVectors(
                        new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize()
                    )
                );
                let sp = new THREE.Mesh(connector_geometry,  element1.strand_to_material(element1.parent.strand_id)); 
                    // material); //cylinder - sugar phosphate connector
                sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //set length according to distance between current and last sugar phosphate
                sp.applyMatrix(rotation_sp); //set rotation
                sp.position.set(x_sp, y_sp, z_sp);
                element1.visual_object.add(sp); //add to visual_object
            }
        }
        render();
    }
}
