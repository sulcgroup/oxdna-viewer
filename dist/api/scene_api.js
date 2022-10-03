/**
 * Bits of code to facilitate querying structures from the browser console
 */
var api;
(function (api) {
    function toggleStrand(strand) {
        strand.map((n) => n.toggleVisibility());
        strand.system.callUpdates(['instanceVisibility']);
        if (tmpSystems.length > 0) {
            tmpSystems.forEach(s => s.callUpdates(['instanceVisibility']));
        }
        render();
        return strand;
    }
    api.toggleStrand = toggleStrand;
    // get a dictionary with every strand length : [strand] listed   
    function countStrandLength(system = systems[0]) {
        let strandLength = {};
        system.strands.map((strand) => {
            let l = strand.getLength();
            if (l in strandLength)
                strandLength[l].push(strand);
            else
                strandLength[l] = [strand];
        });
        return strandLength;
    }
    api.countStrandLength = countStrandLength;
    ;
    //highlight
    function highlight5ps(system = systems[0]) {
        system.strands.forEach(strand => strand.end5.select());
        updateView(system);
        render();
    }
    api.highlight5ps = highlight5ps;
    //highlight
    function highlight3ps(system = systems[0]) {
        system.strands.forEach(strand => strand.end3.select());
        updateView(system);
        render();
    }
    api.highlight3ps = highlight3ps;
    /**
     * Show geometries to mark 3' ends
     * @param enable Set to true to show markers, false to hide them
     * @param diameter Marker diameter
     * @param length Marker length
     * @param spacing Distance from backbone sphere
     */
    function update3primeMarkers(diameter, length, spacing) {
        systems.forEach(sys => {
            sys.strands.forEach(s => view.update3pMarker(s.end3, diameter, length, spacing));
            //updateView(sys);
        });
        render();
    }
    api.update3primeMarkers = update3primeMarkers;
    function toggleElements(elems) {
        let sys = new Set();
        let tmpSys = new Set();
        elems.forEach(e => {
            e.toggleVisibility();
            sys.add(e.getSystem());
            if (e.dummySys) {
                tmpSys.add(e.dummySys);
            }
        });
        sys.forEach(s => s.callUpdates(['instanceVisibility']));
        tmpSys.forEach(s => s.callUpdates(['instanceVisibility']));
        render();
    }
    api.toggleElements = toggleElements;
    function toggleAll(system = systems[0]) {
        system.strands.forEach(strand => strand.forEach(n => n.toggleVisibility()));
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
        elements.forEach((e) => {
            if (e.strand == null)
                return;
            let sys = e.getSystem();
            let sid = e.sid;
            if (e.dummySys !== null) {
                sys = e.dummySys;
                sid = e.sid;
            }
            //because the precision of the stored color value (32-bit) and defined color value (64-bit) are different,
            //you have to do some weird casting to get them to be comparable.
            let tmp = e.getInstanceParameter3("nsColors"); //maybe this shouldn't be a vector3...
            let c = [tmp.x.toPrecision(6), tmp.y.toPrecision(6), tmp.z.toPrecision(6)];
            let g = [GREY.r.toPrecision(6), GREY.g.toPrecision(6), GREY.b.toPrecision(6)];
            if (JSON.stringify(c) == JSON.stringify(g)) {
                let newC = e.elemToColor(e.type);
                sys.fillVec('nsColors', 3, sid, [newC.r, newC.g, newC.b]);
            }
            else {
                sys.fillVec('nsColors', 3, sid, [GREY.r, GREY.g, GREY.b]);
            }
        });
        for (let i = 0; i < systems.length; i++) {
            systems[i].nucleoside.geometry["attributes"].instanceColor.needsUpdate = true;
        }
        if (tmpSystems.length > 0) {
            tmpSystems.forEach((s) => {
                s.nucleoside.geometry["attributes"].instanceColor.needsUpdate = true;
            });
        }
        render();
    }
    api.toggleBaseColors = toggleBaseColors;
    function trace53(element) {
        let elems = [];
        let c = element;
        while (c) {
            elems.push(c);
            c = c.n3;
        }
        return elems;
    }
    api.trace53 = trace53;
    function trace35(element) {
        let elems = [];
        let c = element;
        while (c) {
            elems.push(c);
            c = c.n5;
        }
        return elems;
    }
    api.trace35 = trace35;
    function getElements(targets) {
        let out = [];
        targets.forEach((n) => {
            out.push(elements.get(n));
        });
        return (out);
    }
    api.getElements = getElements;
    function selectElementIDs(targets, keepPrevious) {
        selectElements(getElements(targets), keepPrevious);
    }
    api.selectElementIDs = selectElementIDs;
    function selectPDBIDs(targetPDBNumber, chainids, keepPrevious) {
        if (!keepPrevious) {
            clearSelection();
        }
        if (chainids == undefined) {
            for (let i = 0; i < targetPDBNumber.length; i++) {
                elements.forEach((e, idx) => {
                    if (e.isAminoAcid()) {
                        let f = e;
                        if (parseInt(f.pdbindices[2]) == targetPDBNumber[i]) {
                            selectElements([e], true);
                        }
                    }
                });
            }
        }
        else {
            if (chainids.length == 0 && chainids.length != targetPDBNumber.length)
                notify("Please provide both residue and PDB number for all queries");
            for (let i = 0; i < targetPDBNumber.length; i++) {
                elements.forEach((e, idx) => {
                    if (e.isAminoAcid()) {
                        let f = e;
                        if (chainids.length != 0 && parseInt(f.pdbindices[2]) == targetPDBNumber[i]) {
                            if (chainids[i] == f.pdbindices[1]) {
                                selectElements([e], true);
                            }
                        }
                    }
                });
            }
        }
        if (selectedBases.size == 0) {
            notify("No Matching PDB Identifiers Found");
        }
    }
    api.selectPDBIDs = selectPDBIDs;
    /**
     * Show the specified element in the viewport
     * @param element Element to center view at
     */
    function findElement(element, steps = 20) {
        let targetPos;
        if (element.isNucleotide()) {
            targetPos = element.getInstanceParameter3('bbOffsets');
        }
        else {
            targetPos = element.getPos();
        }
        // Target trackball controls at element position
        //controls.target = targetPos;
        // Move in close to the element
        let targetDist = 10;
        let dist = (camera.position.distanceTo(targetPos));
        let endPos = camera.position.clone().sub(targetPos).setLength(targetDist).add(targetPos);
        if (steps > 1) {
            camera.position.lerp(endPos, 1 / steps);
            controls.target.lerp(targetPos, 1 / steps);
        }
        else {
            camera.position.lerp(endPos, 1 - (targetDist / dist));
            controls.target = targetPos;
        }
        if (steps > 1) {
            requestAnimationFrame(() => {
                api.findElement(element, steps - 1);
            });
        }
    }
    api.findElement = findElement;
    function selectElements(elems, keepPrevious) {
        if (!keepPrevious) {
            clearSelection();
        }
        elems.forEach(e => {
            if (!selectedBases.has(e)) {
                e.toggle();
            }
        });
        systems.forEach(sys => {
            updateView(sys);
        });
        if (selectedBases.size > 0 && view.transformMode.enabled()) {
            transformControls.show();
        }
    }
    api.selectElements = selectElements;
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
        let notation, decimal;
        lut.maxV - lut.minV > 0.09 ? notation = 'decimal' : notation = 'scientific';
        notation == 'scientific' ? decimal = 1 : decimal = 2;
        let labels = lut.setLegendLabels({ 'title': lut.legend.labels.title, 'ticks': lut.legend.labels.ticks, 'notation': notation, 'decimal': decimal }); //don't ask, lut stores the values but doesn't actually save the sprites anywhere so you have to make them again...
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
            let notation, decimal;
            lut = lut.changeColorMap(name);
            console.log(max - min);
            max - min > 0.09 ? notation = 'decimal' : notation = 'scientific'; //if max and min are too close together, nothing shows up.
            notation == 'scientific' ? decimal = 1 : decimal = 2; //scientific notation is too big for the colorbar scene, so make it smaller.
            lut.setMax(max);
            lut.setMin(min);
            lut.setLegendOn({ 'layout': 'horizontal', 'position': { 'x': 0, 'y': 0, 'z': 0 }, 'dimensions': { 'width': 2, 'height': 12 } }); //create legend
            lut.setLegendLabels({ 'title': key, 'ticks': 5, 'notation': notation, 'decimal': decimal });
            for (let i = 0; i < systems.length; i++) {
                let system = systems[i];
                let end = system.systemLength();
                for (let i = 0; i < end; i++) { //insert lut colors into lutCols[] to toggle Lut coloring later
                    system.lutCols[i] = lut.getColor(Number(system.colormapFile[key][i]));
                }
            }
            updateColoring();
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
        updateColoring();
    }
    api.setColorBounds = setColorBounds;
    function showEverything() {
        elements.forEach((n) => {
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
    function switchCamera() {
        if (camera instanceof THREE.PerspectiveCamera) {
            //get camera parameters
            const far = camera.far;
            const near = camera.near;
            const focus = controls.target;
            const fov = camera.fov * Math.PI / 180; //convert to radians
            const pos = camera.position;
            let width = 2 * Math.tan(fov / 2) * focus.distanceTo(pos);
            let height = width / camera.aspect;
            const up = camera.up;
            const quat = camera.quaternion;
            let cameraHeading = new THREE.Vector3(0, 0, -1);
            cameraHeading.applyQuaternion(quat);
            //if the camera is upside down, you need to flip the corners of the orthographic box
            if (quat.dot(refQ) < 0 && quat.w > 0) {
                width *= -1;
                height *= -1;
            }
            //create a new camera with same properties as old one
            let newCam = createOrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, near, far, pos.toArray());
            newCam.up = up;
            newCam.lookAt(focus);
            scene.remove(camera);
            camera = newCam;
            controls.object = camera;
            scene.add(camera);
            document.getElementById("cameraSwitch").innerHTML = "Perspective";
        }
        else if (camera instanceof THREE.OrthographicCamera) {
            //get camera parameters
            const far = camera.far;
            const near = camera.near;
            const focus = controls.target;
            const pos = camera.position;
            const up = camera.up;
            let fov = 2 * Math.atan((((camera.right - camera.left) / 2)) / focus.distanceTo(pos)) * 180 / Math.PI;
            //if the camera is upside down, you need to flip the fov for the perspective camera
            if (camera.left > camera.right) {
                fov *= -1;
            }
            //create a new camera with same properties as old one
            let newCam = createPerspectiveCamera(fov, near, far, pos.toArray());
            newCam.up = up;
            newCam.lookAt(focus);
            scene.remove(camera);
            camera = newCam;
            controls.object = camera;
            scene.add(camera);
            document.getElementById("cameraSwitch").innerHTML = "Orthographic";
        }
        render();
    }
    api.switchCamera = switchCamera;
    //export function flipConnectors() {
    //    instancedBBconnector.
    //}
})(api || (api = {}));
