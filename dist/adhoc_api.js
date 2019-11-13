/// <reference path="./main.ts" />
// Usefull bits of code simplifying quering the structure
var api;
(function (api) {
    function toggleStrand(strand) {
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
    api.toggleStrand = toggleStrand;
    // TODO: integrate with the selection mechanism 
    function markStrand(strand) {
        let nucleotides = strand[monomers];
        nucleotides.map((n) => n.toggle());
        render();
        return strand;
    }
    api.markStrand = markStrand;
    ;
    function getSequence(strand) {
        let seq;
        let nucleotides = strand[monomers];
        nucleotides.reverse().map((n) => seq.push(n.type));
        return seq.join("");
    }
    api.getSequence = getSequence;
    ;
    // get a dictionary with every strand length : [strand] listed   
    function countStrandLength(system = systems[0]) {
        let strandLength = {};
        system[strands].map((strand) => {
            let l = strand[monomers].length;
            if (l in strandLength)
                strandLength[l].push(strand);
            else
                strandLength[l] = [strand];
        });
        return strandLength;
    }
    api.countStrandLength = countStrandLength;
    ;
    function highlite5ps(system = systems[0]) {
        system[strands].map((strand) => {
            strand[monomers][strand[monomers].length - 1].toggle();
        });
        render();
    }
    api.highlite5ps = highlite5ps;
    function toggleAll(system = systems[0]) {
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
    api.toggleAll = toggleAll;
    //toggles the nuceloside colors on and off
    function toggleBaseColors() {
        elements.map((n) => {
            let sys = n.parent.parent;
            let sid = n.gid - sys.globalStartId;
            //because the precision of the stored color value (32-bit) and defined color value (64-bit) are different,
            //you have to do some weird casting to get them to be comparable.
            let tmp = n.getInstanceParameter3("nsColors"); //maybe this shouldn't be a vector3...
            let c = [tmp.x.toPrecision(6), tmp.y.toPrecision(6), tmp.z.toPrecision(6)];
            let g = [GREY.r.toPrecision(6), GREY.g.toPrecision(6), GREY.b.toPrecision(6)];
            if (JSON.stringify(c) == JSON.stringify(g)) {
                let newC = n.elemToColor(n.type);
                sys.fillVec('nsColors', 3, sid, [newC.r, newC.g, newC.b]);
            }
            else {
                sys.fillVec('nsColors', 3, sid, [GREY.r, GREY.g, GREY.b]);
            }
        });
        for (let i = 0; i < systems.length; i++) {
            systems[i].nucleoside.geometry["attributes"].instanceColor.needsUpdate = true;
        }
        render();
    }
    api.toggleBaseColors = toggleBaseColors;
    function trace53(element) {
        let elements = [];
        let c = element;
        while (c) {
            elements.push(c);
            c = c.neighbor3;
        }
        return elements.reverse();
    }
    api.trace53 = trace53;
    function nick(element) {
        let sys = element.parent.parent, sid = element.gid - sys.globalStartId;
        // we break connection to the 3' neighbor 
        let neighbor = element.neighbor3;
        element.neighbor3 = null;
        neighbor.neighbor5 = null;
        sys.fillVec('bbconScales', 3, sid, [0, 0, 0]);
        sys.bbconnector.geometry["attributes"].instanceScale.needsUpdate = true;
        let strand = element.parent;
        // nucleotides which are after the nick
        let new_nucleotides = trace53(neighbor);
        strand.excludeElements(new_nucleotides);
        //create fill and deploy new strand 
        let new_strand = strand.parent.createStrand(strand.parent[strands].length + 1);
        strand.parent.addStrand(new_strand);
        new_nucleotides.forEach((n) => {
            new_strand.addBasicElement(n);
            n.updateColor();
        });
        //update local ids in the remnant strand
        let i = 0;
        strand[monomers].forEach((n) => {
            n.lid = i++;
        });
        sys.connector.geometry["attributes"].instanceColor.needsUpdate = true;
        sys.backbone.geometry["attributes"].instanceColor.needsUpdate = true;
        sys.bbconnector.geometry["attributes"].instanceColor.needsUpdate = true;
        render();
    }
    api.nick = nick;
    function ligate(element1, element2) {
        if (element1.parent.parent !== element2.parent.parent) {
            console.log("cannot currently ligate strands between systems!");
            return;
        }
        let end5, end3;
        //find out which is the 5' end and which is 3'
        if (element1.neighbor5 == null && element2.neighbor3 == null) {
            end5 = element1;
            end3 = element2;
        }
        else if (element1.neighbor3 == null && element2.neighbor5 == null) {
            end5 = element2;
            end3 = element1;
        }
        else {
            console.log("please select one nucleotide with an available 3' connection and one with an available 5'");
            return;
        }
        let sys5 = end5.parent.parent, sys3 = end3.parent.parent, sid5 = end5.gid - sys5.globalStartId, sid3 = end3.gid - sys3.globalStartId;
        // strand1 will have an open 5' and strand2 will have an open 3' end
        // get the reference to the strands 
        // strand2 will be merged into strand1 
        let strand1 = end5.parent;
        let strand2 = end3.parent;
        // lets orphan strand2 element
        let bases2 = [...strand2[monomers]]; // clone the references to the elements
        strand2.excludeElements(strand2[monomers]);
        //check that it is not the same strand
        if (strand1 !== strand2) {
            //remove strand2 object 
            strand2.parent.remove(strand2);
        }
        // and add them back into strand1 
        //create fill and deploy new strand 
        let i = 0;
        bases2.forEach((n) => {
            strand1.addBasicElement(n);
            n.updateColor();
            n.lid = 0;
        });
        //connect the 2 element objects 
        end5.neighbor5 = end3;
        end3.neighbor3 = end5;
        //last, add the sugar-phosphate bond
        let p2 = end3.getInstanceParameter3("bbOffsets");
        let xbb = p2.x, ybb = p2.y, zbb = p2.z;
        let p1 = end5.getInstanceParameter3("bbOffsets");
        let xbbLast = p1.x, ybbLast = p1.y, zbbLast = p1.z;
        let xsp = (xbb + xbbLast) / 2, //sugar phospate position in center of both current and last sugar phosphates
        ysp = (ybb + ybbLast) / 2, zsp = (zbb + zbbLast) / 2;
        let spLen = Math.sqrt(Math.pow(xbb - xbbLast, 2) + Math.pow(ybb - ybbLast, 2) + Math.pow(zbb - zbbLast, 2));
        let spRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(xsp - xbb, ysp - ybb, zsp - zbb).normalize());
        sys3.fillVec('bbconOffsets', 3, sid3, [xsp, ysp, zsp]);
        sys3.fillVec('bbconRotation', 4, sid3, [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
        sys3.fillVec('bbconScales', 3, sid3, [1, spLen, 1]);
        sys3.bbconnector.geometry["attributes"].instanceScale.needsUpdate = true;
        sys3.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
        sys3.bbconnector.geometry["attributes"].instanceRotation.needsUpdate = true;
        sys3.connector.geometry["attributes"].instanceColor.needsUpdate = true;
        sys3.backbone.geometry["attributes"].instanceColor.needsUpdate = true;
        sys3.bbconnector.geometry["attributes"].instanceColor.needsUpdate = true;
        // Strand id update
        let strID = 1;
        sys3[strands].forEach((strand) => strand.strandID = strID++);
        if (sys3 !== sys5) {
            sys5[strands].forEach((strand) => strand.strandID = strID++);
        }
        render();
    }
    api.ligate = ligate;
    function copyInstances(source, id, destination) {
        destination.fillVec('cmOffsets', 3, id, source.getInstanceParameter3('cmOffsets').toArray());
        destination.fillVec('bbOffsets', 3, id, source.getInstanceParameter3('bbOffsets').toArray());
        destination.fillVec('nsOffsets', 3, id, source.getInstanceParameter3('nsOffsets').toArray());
        destination.fillVec('nsOffsets', 3, id, source.getInstanceParameter3('nsOffsets').toArray());
        destination.fillVec('nsRotation', 4, id, source.getInstanceParameter4('nsRotation').toArray());
        destination.fillVec('conOffsets', 3, id, source.getInstanceParameter3('conOffsets').toArray());
        destination.fillVec('conRotation', 4, id, source.getInstanceParameter4('conRotation').toArray());
        destination.fillVec('bbconOffsets', 3, id, source.getInstanceParameter3('bbconOffsets').toArray());
        destination.fillVec('bbconRotation', 4, id, source.getInstanceParameter4('bbconRotation').toArray());
        destination.fillVec('bbColors', 3, id, source.getInstanceParameter3('bbColors').toArray());
        destination.fillVec('scales', 3, id, source.getInstanceParameter3('scales').toArray());
        destination.fillVec('nsScales', 3, id, source.getInstanceParameter3('nsScales').toArray());
        destination.fillVec('conScales', 3, id, source.getInstanceParameter3('conScales').toArray());
        destination.fillVec('bbconScales', 3, id, source.getInstanceParameter3('bbconScales').toArray());
        destination.fillVec('visibility', 3, id, source.getInstanceParameter3('visibility').toArray());
        destination.fillVec('nsColors', 3, id, source.getInstanceParameter3('nsColors').toArray());
        destination.fillVec('bbLabels', 3, id, source.getInstanceParameter3('bbLabels').toArray());
    }
    //rebuild systems from the ground-up to correct for weird stuff that happens during editing
    function cleanOrder() {
        //nuke the elements array
        const elements = [];
        let gidCounter = 0, systemCounter = 0;
        systems.forEach((sys) => {
            //find longest strand
            const d = countStrandLength(sys);
            const lens = Object.keys(d).map(Number);
            lens.sort(function (a, b) { return b - a; });
            //Copy everything from current to a new system in sorted order
            let newSys = new System(systemCounter, elements.length), sidCounter = 0, strandCounter = 0;
            //create the instancing arrays for newSys
            //systemLength counts the number of particles, does not use the instancing array
            newSys.INSTANCES = sys.systemLength();
            newSys.bbOffsets = new Float32Array(newSys.INSTANCES * 3);
            newSys.bbRotation = new Float32Array(newSys.INSTANCES * 4);
            newSys.nsOffsets = new Float32Array(newSys.INSTANCES * 3);
            newSys.nsRotation = new Float32Array(newSys.INSTANCES * 4);
            newSys.conOffsets = new Float32Array(newSys.INSTANCES * 3);
            newSys.conRotation = new Float32Array(newSys.INSTANCES * 4);
            newSys.bbconOffsets = new Float32Array(newSys.INSTANCES * 3);
            newSys.bbconRotation = new Float32Array(newSys.INSTANCES * 4);
            newSys.bbconScales = new Float32Array(newSys.INSTANCES * 3);
            newSys.cmOffsets = new Float32Array(newSys.INSTANCES * 3);
            newSys.bbColors = new Float32Array(newSys.INSTANCES * 3);
            newSys.nsColors = new Float32Array(newSys.INSTANCES * 3);
            newSys.scales = new Float32Array(newSys.INSTANCES * 3);
            newSys.nsScales = new Float32Array(newSys.INSTANCES * 3);
            newSys.conScales = new Float32Array(newSys.INSTANCES * 3);
            newSys.visibility = new Float32Array(newSys.INSTANCES * 3);
            newSys.bbLabels = new Float32Array(newSys.INSTANCES * 3);
            // Sort by strand length
            lens.forEach((l) => {
                d[l].forEach((strand) => {
                    let newStrand = new Strand(strandCounter, newSys);
                    // Find 3' end of strand and initialize the new strand
                    if (strand[monomers][0].neighbor3 !== null && strand.circular !== true) {
                        for (let i = 0, len = strand[monomers].length; i < len; i++) {
                            const n = strand[monomers][i];
                            if (n.neighbor3 == null) {
                                copyInstances(strand[monomers][0], sidCounter, newSys);
                                newStrand.addBasicElement(n);
                                break;
                            }
                        }
                    }
                    if (newStrand[monomers].length == 0) {
                        copyInstances(strand[monomers][0], sidCounter, newSys);
                        newStrand.addBasicElement(strand[monomers][0]);
                    }
                    //trace the 5' connections to the strand end and copy to new strand
                    let startElem = newStrand[monomers][0], curr = startElem, lidCounter = 0;
                    newStrand[monomers][0].lid = lidCounter;
                    newStrand[monomers][0].gid = gidCounter;
                    newStrand[monomers][0].updateColor();
                    while (curr.neighbor5 !== null && curr.neighbor5 !== startElem) {
                        curr = curr.neighbor5;
                        lidCounter++;
                        gidCounter++;
                        sidCounter++;
                        // copy nucleotide data values
                        copyInstances(curr, sidCounter, newSys);
                        //update id numbers and add to storage
                        curr.lid = lidCounter;
                        curr.gid = gidCounter;
                        newStrand.addBasicElement(curr);
                        curr.updateColor();
                        elements.push(curr);
                    }
                    gidCounter++;
                    sidCounter++;
                    newSys.addStrand(newStrand);
                    strandCounter++;
                });
            });
            //attempting to free memory
            scene.remove(...[sys.backbone, sys.nucleoside, sys.connector, sys.bbconnector]);
            sys = {}; //this is a terrible hack, but I'm trying to drop all references
            systems[newSys.systemID] = newSys;
            addSystemToScene(newSys);
            systemCounter++;
        });
    }
    api.cleanOrder = cleanOrder;
    /*export function strand_add_to_system(strand:Strand, system: System){
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
            defaultColormap = name;
        }
    }
    api.changeColormap = changeColormap;
    function setColorBounds(min, max) {
        let key = lut.legend.labels.title;
        lut.setMax(max);
        lut.setMin(min);
        api.removeColorbar();
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
    api.setColorBounds = setColorBounds;
    function spOnly() {
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
    api.spOnly = spOnly;
    function showEverything() {
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
    api.showEverything = showEverything;
})(api || (api = {}));
