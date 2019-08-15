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
    function count_strand_length({ system = systems[0] } = {}) {
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
    api.count_strand_length = count_strand_length;
    ;
    function highlite5ps({ system = systems[0] } = {}) {
        system.strands.map((strand) => {
            strand.elements[strand.elements.length - 1].toggle();
        });
        render();
    }
    api.highlite5ps = highlite5ps;
    ;
    function toggle_all({ system = systems[0] } = {}) {
        system.strands.map((strand) => {
            let nucleotides = strand.elements;
            nucleotides.map((n) => n.visual_object.visible = !n.visual_object.visible);
        });
        render();
    }
    api.toggle_all = toggle_all;
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
        element.visual_object.remove(element.visual_object.children[element.SP_CON]);
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
    function ligate(element1, element2) {
        console.log("Experimental, does not update strand indices yet and will break with Shuchi's update!");
        if (element1.parent.parent !== element2.parent.parent) {
            return;
        }
        // assume for now that element1 is 5' and element2 is 3' 
        // get the refference to the strands 
        // strand2 will be merged into strand1 
        let strand1 = element1.parent;
        let strand2 = element2.parent;
        // lets orphan strand2 element
        let bases2 = [...strand2.elements]; // clone the refferences to the elements
        strand2.exclude_Elements(strand2.elements);
        //check that it is not the same strand
        if (strand1 !== strand2) {
            //remove strand2 object 
            strand2.parent.system_3objects.remove(strand2.strand_3objects);
            strand2.parent.strands = strand2.parent.strands.filter((ele) => {
                return ele != strand2;
            });
        }
        // and add them back into strand1 
        //create fill and deploy new strand 
        bases2.forEach((n) => {
            strand1.add_basicElement(n);
            strand1.strand_3objects.add(n.visual_object);
        });
        //interconnect the 2 element objects 
        element1.neighbor3 = element2;
        element2.neighbor5 = element1;
        //TODO: CLEAN UP!!!
        //////last, add the sugar-phosphate bond since its not done for the first nucleotide in each strand
        if (element1.neighbor3 != null && element1.neighbor3.local_id < element1.local_id) {
            let p2 = element2.visual_object.children[element2.BACKBONE].position;
            let x_bb = p2.x, y_bb = p2.y, z_bb = p2.z;
            let p1 = element1.visual_object.children[element1.BACKBONE].position;
            let x_bb_last = p1.x, y_bb_last = p1.y, z_bb_last = p1.z;
            let x_sp = (x_bb + x_bb_last) / 2, //sugar phospate position in center of both current and last sugar phosphates
            y_sp = (y_bb + y_bb_last) / 2, z_sp = (z_bb + z_bb_last) / 2;
            let sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
            // easy periodic boundary condition fix  
            // if the bonds are to long just don't add them 
            if (sp_len <= 500) {
                let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize()));
                let sp = new THREE.Mesh(connector_geometry, element1.strand_to_material(element1.parent.strand_id));
                // material); //cylinder - sugar phosphate connector
                sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //set length according to distance between current and last sugar phosphate
                sp.applyMatrix(rotation_sp); //set rotation
                sp.position.set(x_sp, y_sp, z_sp);
                element1.visual_object.add(sp); //add to visual_object
            }
        }
        // Strand id update
        let str_id = 1;
        let sys = element1.parent.parent;
        sys.strands.forEach((strand) => strand.strand_id = str_id++);
        render();
    }
    api.ligate = ligate;
    function strand_add_to_system(strand, system) {
        // api.strand_add_to_system(systems[1].strands[1], systems[0])
        // kill strand in its previous system
        strand.parent.strands = strand.parent.strands.filter((ele) => {
            return ele != strand;
        });
        // add strand to the desired system
        let str_id = system.strands.length + 1;
        system.strands.push(strand);
        strand.strand_id = str_id;
        strand.parent = system;
    }
    api.strand_add_to_system = strand_add_to_system;
    function remove_colorbar() {
        for (let i = 8; i < 20; i++) {
            scene.remove(scene.children[8]);
        }
        render();
    }
    api.remove_colorbar = remove_colorbar;
    function show_colorbar() {
        scene.add(lut.legend.mesh);
        let labels = lut.setLegendLabels({ 'title': lut.legend.labels.title, 'ticks': lut.legend.labels.ticks }); //don't ask, lut stores the values but doesn't actually save the sprites anywhere...
        scene.add(labels["title"]);
        for (let i = 0; i < Object.keys(labels['ticks']).length; i++) {
            scene.add(labels['ticks'][i]);
            scene.add(labels['lines'][i]);
        }
        render();
    }
    api.show_colorbar = show_colorbar;
})(api || (api = {}));
