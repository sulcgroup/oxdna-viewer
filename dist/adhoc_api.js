/// <reference path="./main.ts" />
// Usefull bits of code simplifying quering the structure
var api;
(function (api) {
    function toggleStrand(strand) {
        let sys = strand.parent;
        let nucleotides = strand[monomers];
        nucleotides.map((n) => n.toggleVisibility());
        sys.callUpdates(['instanceVisibility']);
        if (tmpSystems.length > 0) {
            tmpSystems.forEach((s) => {
                s.callUpdates(['instanceVisibility']);
            });
        }
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
        system.callUpdates(['instanceVisibility']);
        if (tmpSystems.length > 0) {
            tmpSystems.forEach((s) => {
                s.callUpdates(['instanceVisibility']);
            });
        }
        render();
    }
    api.toggleAll = toggleAll;
    //toggles the nuceloside colors on and off
    function toggleBaseColors() {
        elements.map((n) => {
            let sys = n.parent.parent;
            let sid = n.gid - sys.globalStartId;
            if (n.dummySys !== null) {
                sys = n.dummySys;
                sid = n.lid;
            }
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
    function trace35(element) {
        let elements = [];
        let c = element;
        while (c) {
            elements.push(c);
            c = c.neighbor5;
        }
        return elements.reverse();
    }
    api.trace35 = trace35;
    function splitStrand(element) {
        let sys = element.parent.parent, strand = element.parent;
        // nucleotides which are after the nick
        let orphans = trace35(element);
        strand.excludeElements(orphans);
        //create fill and deploy new strand 
        let new_strand = strand.parent.createStrand(strand.parent[strands].length + 1);
        strand.parent.addStrand(new_strand);
        orphans.forEach((e) => {
            new_strand.addBasicElement(e);
            e.updateColor();
        });
        //update local ids in the remnant strand
        // if there are dummy systems, you need to rebuild anyway and they need static local IDs
        if (tmpSystems.length == 0) {
            let i = 0;
            strand[monomers].forEach((n) => {
                n.lid = i++;
            });
        }
        sys.callUpdates(['instanceColor']);
    }
    function nick(element) {
        let sys = element.parent.parent, sid = element.gid - sys.globalStartId;
        if (element.dummySys !== null) {
            sys = element.dummySys;
            sid = element.lid;
        }
        // we break connection to the 3' neighbor 
        let neighbor = element.neighbor3;
        element.neighbor3 = null;
        neighbor.neighbor5 = null;
        splitStrand(element);
        sys.fillVec('bbconScales', 3, sid, [0, 0, 0]);
        sys.bbconnector.geometry["attributes"].instanceScale.needsUpdate = true;
        render();
    }
    api.nick = nick;
    function ligate(element1, element2) {
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
            notify("please select one nucleotide with an available 3' connection and one with an available 5'");
            return;
        }
        // strand1 will have an open 5' and strand2 will have an open 3' end
        // strand2 will be merged into strand1
        let sys5 = end5.parent.parent, sys3 = end3.parent.parent, strand1 = end5.parent, strand2 = end3.parent;
        // handle strand1 and strand2 not being in the same system
        if (sys5 !== sys3) {
            let tmpSys = new System(tmpSystems.length, 0);
            tmpSys.initInstances(strand2[monomers].length);
            for (let i = 0, len = strand2[monomers].length; i < len; i++) {
                copyInstances(strand2[monomers][i], i, tmpSys);
                strand2[monomers][i].setInstanceParameter('visibility', [0, 0, 0]);
                strand2[monomers][i].dummySys = tmpSys;
            }
            sys3.callUpdates(['instanceVisibility']);
            addSystemToScene(tmpSys);
            tmpSystems.push(tmpSys);
        }
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
            n.lid = i;
            i++;
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
        end3.setInstanceParameter('bbconOffsets', [xsp, ysp, zsp]);
        end3.setInstanceParameter('bbconRotation', [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
        end3.setInstanceParameter('bbconScales', [1, spLen, 1]);
        sys5.callUpdates(["instanceOffset"]);
        sys5.callUpdates(["instanceScale"]);
        sys5.callUpdates(["instanceColor"]);
        sys5.callUpdates(["instanceRotation"]);
        if (tmpSystems.length > 0) {
            tmpSystems.forEach((s) => {
                s.callUpdates(['instanceOffset', 'instanceRotation', 'instanceScale', 'instanceColor', 'instanceVisibility']);
            });
        }
        // Strand id update
        let strID = 1;
        sys5[strands].forEach((strand) => strand.strandID = strID++);
        if (sys3 !== sys5) {
            sys3[strands].forEach((strand) => strand.strandID = strID++);
        }
        render();
    }
    api.ligate = ligate;
    /**
     *
     * @param victims
     */
    function del(victims) {
        let needsUpdateList = new Set;
        victims.forEach((e) => {
            let sys;
            if (e.dummySys !== null) {
                sys = e.dummySys;
            }
            else {
                sys = e.parent.parent;
            }
            if (!needsUpdateList.has(sys)) {
                needsUpdateList.add(sys);
            }
            splitStrand(e);
            e.neighbor3.neighbor5 = null;
            e.neighbor5.neighbor3 = null;
            e.neighbor5.setInstanceParameter("bbconScales", [0, 0, 0]);
            e.neighbor3 = null;
            e.neighbor5 = null;
            e.toggleVisibility();
            e.parent.excludeElements([e]);
        });
        needsUpdateList.forEach((s) => {
            s.callUpdates(['instanceVisibility', 'instanceScale']);
        });
        render();
    }
    api.del = del;
    function addElements(end, sequence, tmpSys, direction, inverse, lidCounter, gidCounter) {
        // add monomers to the strand
        const strand = end.parent;
        const lines = end.extendStrand(sequence.length, inverse);
        let last = end;
        //create topology
        for (let i = 0, len = sequence.length; i < len; i++) {
            let e = strand.createBasicElement(gidCounter);
            elements[gidCounter] = e;
            e.lid = lidCounter;
            e.dummySys = tmpSys;
            last[direction] = e;
            e[inverse] = last;
            e.type = sequence[i];
            strand.addBasicElement(e);
            last = e;
            gidCounter++;
            lidCounter++;
        }
        elements.slice(-1)[0][direction] = null;
        let e = end[direction];
        //position new monomers
        for (let i = 0, len = sequence.length; i < len; i++) {
            e.calculatePositions(lines[i]);
            e = e[direction];
        }
        strand.circular = false;
        addSystemToScene(tmpSys);
        //putting this in one loop would slow down loading systems
        //would require dereferencing the backbone position of every nucleotide
        //its not worth slowing down everything to avoid this for loop
        //which is much more of an edge case anyway.
        e = end;
        while (e !== null) {
            calcsp(e);
            e = e[direction];
        }
    }
    /**
     * Create new monomers extending from the provided one.
     * @param end
     * @param sequence
     */
    function extendStrand(end, sequence) {
        // figure out which way we're going
        let direction;
        let inverse;
        if (end.neighbor5 == null) {
            direction = "neighbor5";
            inverse = "neighbor3";
        }
        else if (end.neighbor3 == null) {
            direction = "neighbor3";
            inverse = "neighbor5";
        }
        else {
            notify("please select a monomer that has an open neighbor");
            return;
        }
        // initialize a dummy system to put the monomers in
        const tmpSys = new System(tmpSystems.length, 0);
        tmpSys.initInstances(sequence.length);
        tmpSystems.push(tmpSys);
        addElements(end, sequence, tmpSys, direction, inverse, 0, elements.length);
        render();
    }
    api.extendStrand = extendStrand;
    function createStrand(sequence) {
        //initialize a dummy system to put the monomers in 
        const tmpSys = new System(tmpSystems.length, 0);
        tmpSys.initInstances(sequence.length);
        tmpSystems.push(tmpSys);
        let gidCounter = elements.length;
        //the strand gets added to the last-added system
        const realSys = systems.slice(-1)[0];
        // create the first monomer
        let strand = realSys.createStrand(1);
        realSys.addStrand(strand);
        let e = strand.createBasicElement(gidCounter);
        gidCounter++;
        e.dummySys = tmpSys;
        e.lid = 0;
        e.type = sequence[0];
        e.neighbor3 = null;
        strand.addBasicElement(e);
        elements.push(e);
        // place the new strand 10 units in front of the camera
        // with its a1 vector parallel to the camera heading
        // and a3 the cross product of the a1 vector and the z-axis
        let cameraHeading = new THREE.Vector3(0, 0, -1);
        cameraHeading.applyQuaternion(camera.quaternion);
        let pos = camera.position.clone().add(cameraHeading.clone().multiplyScalar(20));
        let a3 = new THREE.Vector3;
        a3.crossVectors(cameraHeading, new THREE.Vector3(0, 0, 1));
        let line = [pos.x, pos.y, pos.z, cameraHeading.x, cameraHeading.y, cameraHeading.z, a3.x, a3.y, a3.z];
        e.calculatePositions(line);
        e.dummySys = tmpSys;
        // extends the strand 3'-5' with the sequence 
        addElements(e, sequence.substring(1), tmpSys, "neighbor5", "neighbor3", 1, gidCounter);
    }
    api.createStrand = createStrand;
    // copies the instancing data from a particle to a new system
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
        function insertElement(e, s, gidCounter, lidCounter, sidCounter) {
            // copy nucleotide data values
            copyInstances(e, sidCounter, s.parent);
            //update id numbers and add to storage
            e.lid = lidCounter;
            e.gid = gidCounter;
            s.addBasicElement(e);
            e.dummySys = null;
            e.updateColor();
            let idCol = new THREE.Color();
            idCol.setHex(gidCounter + 1);
            e.setInstanceParameter("bbLabels", idCol.toArray());
            e.name = gidCounter + "";
            elements.push(e);
        }
        //nuke the elements array
        elements = [];
        let gidCounter = 0, systemCounter = 0;
        systems.forEach((sys) => {
            //find longest strand
            const d = countStrandLength(sys);
            const lens = Object.keys(d).map(Number);
            lens.sort(function (a, b) { return b - a; });
            //Copy everything from current to a new system in sorted order
            let newSys = new System(systemCounter, elements.length), sidCounter = 0, strandCounter = 1;
            //create the instancing arrays for newSys
            //systemLength counts the number of particles, does not use the instancing array
            newSys.initInstances(sys.systemLength());
            // Sort by strands length
            for (let i = 0, len = lens.length; i < len; i++) {
                let l = lens[i];
                if (l == 0) {
                    break;
                }
                d[l].forEach((strand) => {
                    let newStrand;
                    if (strand.constructor.name == "NucleicAcidStrand") {
                        newStrand = new NucleicAcidStrand(strandCounter, newSys);
                    }
                    if (strand.constructor.name == "Peptide") {
                        newStrand = new Peptide(strandCounter, newSys);
                    }
                    let lidCounter = 0;
                    // Find 3' end of strand and initialize the new strand
                    if (strand[monomers][0].neighbor3 !== null && strand.circular !== true) {
                        for (let i = 0, len = strand[monomers].length; i < len; i++) {
                            const n = strand[monomers][i];
                            if (n.neighbor3 == null) {
                                insertElement(n, newStrand, gidCounter, lidCounter, sidCounter);
                                break;
                            }
                        }
                    }
                    // If the strand is circular or the first nucleotide is already the 3' end, 
                    // we're just going use whatever is first in the data structure
                    if (newStrand[monomers].length == 0) {
                        insertElement(strand[monomers][0], newStrand, gidCounter, lidCounter, sidCounter);
                    }
                    //trace the 5' connections to the strand end and copy to new strand
                    let startElem = newStrand[monomers][0], curr = startElem;
                    while (curr.neighbor5 !== null && curr.neighbor5 !== startElem) {
                        curr = curr.neighbor5;
                        lidCounter++;
                        gidCounter++;
                        sidCounter++;
                        insertElement(curr, newStrand, gidCounter, lidCounter, sidCounter);
                    }
                    gidCounter++;
                    sidCounter++;
                    newSys.addStrand(newStrand);
                    strandCounter++;
                });
            }
            //attempting to free memory
            scene.remove(...[sys.backbone, sys.nucleoside, sys.connector, sys.bbconnector]);
            pickingScene.remove(sys.dummyBackbone);
            sys = {}; //this is a terrible hack, but I'm trying to drop all references
            systems[newSys.systemID] = newSys;
            // add the new system to the scene
            const boxOption = document.getElementById("inboxing").value, centerOption = document.getElementById("centering").value;
            document.getElementById("inboxing").value = "None";
            document.getElementById("centering").value = "None";
            addSystemToScene(newSys);
            document.getElementById("inboxing").value = boxOption;
            document.getElementById("centering").value = centerOption;
            systemCounter++;
        });
        // remove the temporary systems
        tmpSystems.forEach((s) => {
            scene.remove(...[s.backbone, s.nucleoside, s.connector, s.bbconnector]);
            pickingScene.remove(s.dummyBackbone);
            s = {};
        });
        tmpSystems = [];
    }
    api.cleanOrder = cleanOrder;
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
            systems[i].callUpdates(['instanceScale']);
        }
        for (let i = 0; i < tmpSystems.length; i++) {
            tmpSystems[i].callUpdates(['instanceScale']);
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
            systems[i].callUpdates(['instanceScale']);
        }
        for (let i = 0; i < tmpSystems.length; i++) {
            tmpSystems[i].callUpdates(['instanceScale']);
        }
        render();
    }
    api.showEverything = showEverything;
})(api || (api = {}));
