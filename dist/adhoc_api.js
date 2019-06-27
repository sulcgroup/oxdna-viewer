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
    }
    api.highlite5ps = highlite5ps;
    ;
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
})(api || (api = {}));
