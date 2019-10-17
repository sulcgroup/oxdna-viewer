/// <reference path="./main.ts" />
// Usefull bits of code simplifying quering the structure
var api;
(function (api) {
    function toggle_strand(strand) {
        let sys = strand.parent;
        let nucleotides = strand[monomers];
        nucleotides.map((n) => n.toggleVisibility());
        sys.backbone.geometry["attributes"].instanceVisibility.needsUpdate = true;
        sys.nucleoside.geometry["attributes"].instanceVisibility.needsUpdate = true;
        sys.connector.geometry["attributes"].instanceVisibility.needsUpdate = true;
        sys.bbconnector.geometry["attributes"].instanceVisibility.needsUpdate = true;
        sys.dummyBackbone.geometry["attributes"].instanceVisibility.needsUpdate = true;
        render();
        return strand;
    }
    api.toggle_strand = toggle_strand;
    // TODO: integrate with the selection mechanism 
    function mark_stand(strand) {
        let nucleotides = strand[monomers];
        nucleotides.map((n) => n.toggle());
        render();
        return strand;
    }
    api.mark_stand = mark_stand;
    ;
    function get_sequence(strand) {
        let seq;
        let nucleotides = strand[monomers];
        nucleotides.reverse().map((n) => seq.push(n.type));
        return seq.join("");
    }
    api.get_sequence = get_sequence;
    ;
    // get a dictionary with every strand length : [strand] listed   
    function count_stand_length({ system = systems[0] } = {}) {
        let strand_length = {};
        system[strands].map((strand) => {
            let l = strand[monomers].length;
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
        system[strands].map((strand) => {
            strand[monomers][strand[monomers].length - 1].toggle();
        });
        render();
    }
    api.highlite5ps = highlite5ps;
    function toggle_all({ system = systems[0] } = {}) {
        system[strands].map((strand) => {
            let nucleotides = strand[monomers];
            nucleotides.map((n) => n.toggleVisibility());
        });
        system.backbone.geometry["attributes"].instanceVisibility.needsUpdate = true;
        system.nucleoside.geometry["attributes"].instanceVisibility.needsUpdate = true;
        system.connector.geometry["attributes"].instanceVisibility.needsUpdate = true;
        system.bbconnector.geometry["attributes"].instanceVisibility.needsUpdate = true;
        system.dummyBackbone.geometry["attributes"].instanceVisibility.needsUpdate = true;
        render();
    }
    api.toggle_all = toggle_all;
    //toggles the nuceloside colors on and off
    function toggle_base_colors() {
        elements.map((n) => {
            let sys = n.parent.parent;
            let sid = n.gid - sys.globalStartId;
            //because the precision of the stored color value (32-bit) and defined color value (64-bit) are different,
            //you have to do some weird casting to get them to be comparable.
            let tmp = n.getInstanceParameter3("nsColors"); //maybe this shouldn't be a vector3...
            let c = [tmp.x.toPrecision(6), tmp.y.toPrecision(6), tmp.z.toPrecision(6)];
            let g = [GREY.r.toPrecision(6), GREY.g.toPrecision(6), GREY.b.toPrecision(6)];
            if (JSON.stringify(c) == JSON.stringify(g)) {
                let new_c = n.elemToColor(n.type);
                sys.fillVec('nsColors', 3, sid, [new_c.r, new_c.g, new_c.b]);
            }
            else {
                sys.fillVec('nsColors', 3, sid, [GREY.r, GREY.g, GREY.b]);
            }
        });
        for (i = 0; i < systems.length; i++) {
            systems[i].nucleoside.geometry["attributes"].instanceColor.needsUpdate = true;
        }
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
    /*export function nick(element: BasicElement){
        // we break connection to the 3' neighbor
        let neighbor =  element.neighbor3;
        element.neighbor3 = null;
        neighbor.neighbor5 = null;
        element.remove(
            element[objects][element.SP_CON]
        );

        let strand = element.parent;
        // nucleotides which are after the nick
        let new_nucleotides : BasicElement[] = trace_53(neighbor);
        strand.excludeElements(new_nucleotides);
        
        //create fill and deploy new strand
        let new_strand = strand.parent.createStrand(strand.parent[strands].length + 1);
        new_nucleotides.forEach(
            (n) => {
                new_strand.addBasicElement(n);
            }
        );
        //voodoo
        strand.parent.addStrand(new_strand);
        render();
    }

    export function ligate(element1 :BasicElement, element2: BasicElement){
        console.log("Experimental, does not update strand indices yet and will break with Shuchi's update!");
        if(element1.parent.parent !== element2.parent.parent){
            return;
        }
        // assume for now that element1 is 5' and element2 is 3'
        // get the reference to the strands
        // strand2 will be merged into strand1
        let strand1 = element1.parent;
        let strand2 = element2.parent;
        // lets orphan strand2 element
        let bases2 = [...strand2[monomers]]; // clone the refferences to the elements
        strand2.excludeElements(strand2[monomers]);
        
        //check that it is not the same strand
        if (strand1 !== strand2){
            //remove strand2 object
            strand2.parent.remove(strand2);
            //strand2.parent[strands] = strand2.parent[strands].filter((ele)=>{
            //    return ele != strand2;
            //});
        }

        // and add them back into strand1
        //create fill and deploy new strand
        bases2.forEach(
            (n) => {
                strand1.addBasicElement(n);
            }
        );
        //interconnect the 2 element objects
        element1.neighbor5 = element2;
        element2.neighbor3 = element1;
        //TODO: CLEAN UP!!!
        //////last, add the sugar-phosphate bond since its not done for the first nucleotide in each strand
        let p2 = element2[objects][element2.BACKBONE].position;
        let xbb = p2.x,
            ybb = p2.y,
            zbb = p2.z;

        let p1 = element1[objects][element1.BACKBONE].position;
        let xbbLast = p1.x,
            ybbLast = p1.y,
            zbbLast = p1.z;


        let xsp = (xbb + xbbLast) / 2, //sugar phospate position in center of both current and last sugar phosphates
            ysp = (ybb + ybbLast) / 2,
            zsp = (zbb + zbbLast) / 2;

        let spLen = Math.sqrt(Math.pow(xbb - xbbLast, 2) + Math.pow(ybb - ybbLast, 2) + Math.pow(zbb - zbbLast, 2));
        // easy periodic boundary condition fix
        // if the bonds are to long just don't add them
        if (spLen <= 500) {
            let spRotation = new THREE.Matrix4().makeRotationFromQuaternion(
                new THREE.Quaternion().setFromUnitVectors(
                    new THREE.Vector3(0, 1, 0), new THREE.Vector3(xsp - xbb, ysp - ybb, zsp - zbb).normalize()
                )
            );
            let sp = new THREE.Mesh(connector_geometry, element1.strand_to_material(strand2.strandID));
            sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, spLen, 1.0)); //set length according to distance between current and last sugar phosphate
            sp.applyMatrix(spRotation); //set rotation
            sp.position.set(xsp, ysp, zsp);
            element1.add(sp); //add to visual_object
        }
        // Strand id update
        let strID = 1;
        let sys = element1.parent.parent;
        sys[strands].forEach((strand) =>strand.strandID = strID++);
        render();
    }
    
    export function strand_add_to_system(strand:Strand, system: System){
        // kill strand in its previous system
        strand.parent[strands] = strand.parent[strands].filter((ele)=>{
            return ele != strand;
        });

        // add strand to the desired system
        let strID = system[strands].length + 1;
        system[strands].push(strand);
        strand.strandID = strID;
        strand.parent = system;
    }*/
    //there's probably a less blunt way to do this...
    function removeColorbar() {
        let l = colorbarScene.children.length;
        for (let i = 0; i < l; i++) {
            if (colorbarScene.children[i].type == "Sprite" || colorbarScene.children[i].type == "Line") {
                colorbarScene.remove(colorbarScene.children[i]);
                i -= 1;
                l -= 1;
            }
        }
        colorbarScene.remove(lut.legend.mesh);
        //reset light to default
        pointlight.intensity = 0.5;
        renderColorbar();
    }
    api.removeColorbar = removeColorbar;
    //turns out that lut doesn't save the sprites so you have to completley remake it
    function showColorbar() {
        colorbarScene.add(lut.legend.mesh);
        let labels = lut.setLegendLabels({ 'title': lut.legend.labels.title, 'ticks': lut.legend.labels.ticks }); //don't ask, lut stores the values but doesn't actually save the sprites anywhere so you have to make them again...
        colorbarScene.add(labels["title"]);
        for (let i = 0; i < Object.keys(labels['ticks']).length; i++) {
            colorbarScene.add(labels['ticks'][i]);
            colorbarScene.add(labels['lines'][i]);
        }
        //colormap doesn't look right unless the light is 100%
        pointlight.intensity = 1.0;
        renderColorbar();
    }
    api.showColorbar = showColorbar;
    function changeColormap(name) {
        if (lut != undefined) {
            api.removeColorbar();
            let key = lut.legend.labels.title;
            let min = lut.minV;
            let max = lut.maxV;
            lut = lut.changeColorMap(name);
            lut.setMax(max);
            lut.setMin(min);
            lut.setLegendOn({ 'layout': 'horizontal', 'position': { 'x': 0, 'y': 0, 'z': 0 }, 'dimensions': { 'width': 2, 'height': 12 } }); //create legend
            lut.setLegendLabels({ 'title': key, 'ticks': 5 });
            for (let i = 0; i < systems.length; i++) {
                let system = systems[i];
                let end = system.systemLength();
                for (let i = 0; i < end; i++) { //insert lut colors into lutCols[] to toggle Lut coloring later
                    system.lutCols[i] = lut.getColor(Number(system.colormapFile[key][i]));
                }
            }
            coloringChanged();
        }
        else {
            default_colormap = name;
        }
    }
    api.changeColormap = changeColormap;
    function sp_only() {
        elements.map((n) => {
            n.setInstanceParameter('scales', [0, 0, 0]);
            n.setInstanceParameter('nsScales', [0, 0, 0]);
            n.setInstanceParameter('conScales', [0, 0, 0]);
        });
        for (let i = 0; i < systems.length; i++) {
            systems[i].backbone.geometry["attributes"].instanceScale.needsUpdate = true;
            systems[i].nucleoside.geometry["attributes"].instanceScale.needsUpdate = true;
            systems[i].connector.geometry["attributes"].instanceScale.needsUpdate = true;
        }
        render();
    }
    api.sp_only = sp_only;
    function show_everything() {
        elements.map((n) => {
            n.setInstanceParameter('scales', [1, 1, 1]);
            n.setInstanceParameter('nsScales', [0.7, 0.3, 0.7]);
            n.setInstanceParameter('conScales', [1, n.bbnsDist, 1]);
        });
        for (let i = 0; i < systems.length; i++) {
            systems[i].backbone.geometry["attributes"].instanceScale.needsUpdate = true;
            systems[i].nucleoside.geometry["attributes"].instanceScale.needsUpdate = true;
            systems[i].connector.geometry["attributes"].instanceScale.needsUpdate = true;
        }
        render();
    }
    api.show_everything = show_everything;
})(api || (api = {}));
