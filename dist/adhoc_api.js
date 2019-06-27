/// <reference path="./main.ts" />
// Usefull bits of code simplifying quering the structure
var api;
(function (api) {
    function toggle_strand(strand) {
        let nucleotides = strand.elements;
        nucleotides.map((n) => n.visual_object.visible = !n.visual_object.visible);
        render();
        return strand;
    }
    api.toggle_strand = toggle_strand;
    // TODO: integrate with the selection mechanism 
    function mark_stand(strand) {
        let nucleotides = strand.elements;
        nucleotides.map((n) => n.toggle());
        render();
        return strand;
    }
    api.mark_stand = mark_stand;
    ;
    function get_sequence(strand) {
        let seq = [];
        let nucleotides = strand.elements;
        nucleotides.reverse().map((n) => seq.push(n.type));
        return seq.join("");
    }
    api.get_sequence = get_sequence;
    ;
    // get a dictionary with every strand length : [strand] listed   
    function count_stand_length({ system = systems[0] } = {}) {
        let strand_length = {};
        system.strands.map((strand) => {
            let l = strand.elements.length;
            if (l in strand_length)
                strand_length[l].push(strand);
            else
                strand_length[l] = [strand];
        });
        return strand_length;
    }
    api.count_stand_length = count_stand_length;
    ;
    function highlite5ps({ system = systems[0] } = {}) {
        system.strands.map((strand) => {
            strand.elements[strand.elements.length - 1].toggle();
        });
        render();
    }
    api.highlite5ps = highlite5ps;
    ;
<<<<<<< HEAD
    function toggle_all({ system = systems[0] } = {}) {
        system.strands.map(api.toggle_strand);
        render();
    }
    api.toggle_all = toggle_all;
    function trace_53(element) {
        let elements = [];
        let c = element;
        while (c) {
            elements.push(c);
            c = c.neighbor3;
        }
        return elements.reverse();
    }
    api.trace_53 = trace_53;
    function nick(element) {
        // we break connection to the 3' neighbor 
        let neighbor = element.neighbor3;
        element.neighbor3 = null;
        neighbor.neighbor5 = null;
        element.visual_object.children[element.SP_CON].visible = false;
        // initial strand
        let strand = element.parent;
        // nucleotides which are after the nick
        let new_nucleotides = trace_53(neighbor);
        strand.exclude_Elements(new_nucleotides);
        //create fill and deploy new strand 
        let new_strand = strand.parent.create_Strand(strand.parent.strands.length + 1);
        new_nucleotides.forEach((n) => {
            new_strand.add_basicElement(n);
            new_strand.strand_3objects.add(n.visual_object);
        });
        //voodoo
        strand.parent.add_strand(new_strand);
        strand.parent.system_3objects.add(new_strand.strand_3objects);
        render();
    }
    api.nick = nick;
=======
    function toggle_base_colors() {
        elements.map((n) => {
            let obj = n.visual_object.children[n.NUCLEOSIDE];
            if (obj.material == grey_material) {
                obj.material = n.elem_to_material(n.type);
            }
            else {
                obj.material = grey_material;
            }
        });
        render();
    }
    api.toggle_base_colors = toggle_base_colors;
>>>>>>> 8a95e2a8744ca2b522fc31f5052b53822302aee9
})(api || (api = {}));
