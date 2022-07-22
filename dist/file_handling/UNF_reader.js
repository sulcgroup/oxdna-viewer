function readUNFString(s) {
    //the peptide and nucleic acid strands actually have almost the same structure, but different names...
    function isNa(obj) {
        if (obj.naType === 'DNA' || obj.naType === 'RNA' || obj.naType === 'XNA') {
            return true;
        }
        else {
            return false;
        }
    }
    function startName(obj) {
        if (isNa(obj)) {
            return 'fivePrimeId';
        }
        else {
            return 'nTerm';
        }
    }
    function endName(obj) {
        if (isNa(obj)) {
            return 'threePrimeId';
        }
        else {
            return 'cTerm';
        }
    }
    function monomerName(obj) {
        if (isNa(obj)) {
            return 'nucleotides';
        }
        else {
            return 'aminoAcids';
        }
    }
    function setCenter(s) {
        let position = new THREE.Vector3();
        s.forEach((e) => {
            position.add(e.getPos());
        });
        position.divideScalar(s.size);
        return position;
    }
    // geometry parameters
    const HELIX_RADIUS = 1 / 0.8518;
    const BP_RISE = 0.332 / 0.8518; //0.332 nm in SU
    const BP_ROTATION = 34.3 * Math.PI / 180; // 34.3 deg in radians
    const CM_CENTER_DIST = 0.6; //from base.py
    //Calcuate helix position based on cadnano lattice type
    function getLatticePos(row, col, z, layout, oPos) {
        let pos = new THREE.Vector3();
        if (layout === 'honeycomb') {
            pos.fromArray([
                col * HELIX_RADIUS * 1.7320508 + HELIX_RADIUS,
                ((row + Math.floor((row + 1 - col % 2) / 2)) * HELIX_RADIUS * 2 + HELIX_RADIUS * 2 * (0.5 + (col % 2) * 0.5)),
                z * BP_RISE
            ]);
        }
        else if (layout === 'square') {
            pos.fromArray([
                col * HELIX_RADIUS * 2 + HELIX_RADIUS,
                (row * HELIX_RADIUS * 2 + HELIX_RADIUS),
                z * BP_RISE
            ]);
        }
        pos.add(oPos);
        return pos;
    }
    // Find the end of a json file
    function findJsonEnd(s, startId) {
        let closeStatus = 1;
        let i = startId + 1;
        while (closeStatus) {
            if (s.charAt(i) == '{') {
                closeStatus += 1;
            }
            else if (s.charAt(i) == '}') {
                closeStatus -= 1;
            }
            else if (s.charAt(i) == '') {
                notify('Unable to find end of json.  Please check format', 'alert');
                return (-1);
            }
            i += 1;
        }
        return (i);
    }
    //create mapping between ids in the UNF file and the scene
    const newElementIds = new Map();
    // Find which parts are json and which are additional files
    let jsonStart = s.indexOf('{');
    let jsonEnd = findJsonEnd(s, jsonStart);
    if (jsonEnd == -1) {
        return;
    }
    let jsonData = s.substr(jsonStart, jsonEnd - jsonStart);
    let appendedData = s.substr(jsonEnd);
    // Parse json string
    const data = JSON.parse(jsonData);
    // Keep a copy of the file around to be able to save the parts that aren't visualized
    unfFileInfo.push(data);
    // Update metadata in the HTML
    view.getInputElement('unfStructureName').value = data.name;
    view.getInputElement('unfAuthorName').value = data.author;
    view.getInputElement('unfDOI').value = data.doi;
    //view.getInputElement('unfMisc').value = data.misc;
    // UNF allows the user to specify the length scale
    const lengthUnitsString = data.lengthUnits;
    let lenFactor;
    switch (lengthUnitsString) {
        case 'A':
            lenFactor = 1 / 8.518;
            break;
        case 'nm':
            lenFactor = 1 / 0.8518;
            break;
        case 'pm':
            lenFactor = 1 / 851.8;
            break;
        default:
            notify(`Unrecognized length factor ${lengthUnitsString}.  Defaulting to Angstrom`, "alert");
            lenFactor = 1 / 8.518;
    }
    // anglular units as well, convert everything to radians
    const angularUnitsString = data.angularUnits;
    let angleFactor;
    switch (angularUnitsString) {
        case 'deg':
            angleFactor = Math.PI / 180;
            break;
        case 'rad':
            angleFactor = 1;
            break;
        default:
            notify(`Unrecognized angle units ${angularUnitsString}.  Defaulting to degrees`, "alert");
            angleFactor = Math.PI / 180;
    }
    // Update box data, if provided.  I have seen it be [], which does exist but isn't useful.
    // Should update this to be more intelligent at some point.
    if (data.simData.boxSize[0]) {
        // Don't make smaller than current
        box.x = Math.max(box.x, data.simData.boxSize[0]);
        box.y = Math.max(box.y, data.simData.boxSize[1]);
        box.z = Math.max(box.z, data.simData.boxSize[2]);
    }
    else {
        box.x = 1000;
        box.y = 1000;
        box.z = 1000;
    }
    // flag if there are custom colors
    let customColors = false;
    data.structures.forEach((struct, i) => {
        // Create a system for our file
        let sys = new System(sysCount, elements.getNextId());
        sys.label = struct.name;
        let sidCounter = 0;
        let strandCounter = 0;
        // Create all the nucleotide objects
        struct.naStrands.forEach((s) => {
            //parse the strand header
            //This will be a NucleicAcidStrand since it's in the naStrand section.
            let strand = new NucleicAcidStrand(strandCounter++, sys); //UNF has been known to not have sequential strand ids.
            strand.label = s.name;
            let naType = s.naType;
            if (naType == 'XNA') {
                notify(`Warning: XNA not supported by the oxDNA model.  Strand ${s.name} will be represented as an RNA for visualization purposes.`);
                naType = 'RNA';
            }
            let strandColor;
            if (s.color != '') {
                strandColor = new THREE.Color(s.color);
                customColors = true;
            }
            sys.addStrand(strand);
            s.nucleotides.forEach((n) => {
                let e = strand.createBasicElementTyped(naType.toLowerCase(), elements.getNextId());
                newElementIds.set(n.id, e.id);
                e.type = n.nbAbbrev;
                if (strandColor) {
                    e.color = strandColor;
                }
                e.sid = sidCounter++;
                elements.push(e);
            });
        });
        //start reading in proteins
        //eventually these should be moved into clusters.
        let chainCount = -1;
        struct.aaChains.forEach((s) => {
            s.naType = 'peptide'; //this is a giant mess because I need all the strands, but can't actually tell what they are without some sort of label.
            let strand = new Peptide(chainCount--, sys);
            strand.label = s.name;
            let strandColor;
            if (s.color) {
                strandColor = new THREE.Color(s.color);
                customColors = true;
            }
            sys.addStrand(strand);
            s.aminoAcids.forEach((a) => {
                let e = strand.createBasicElement(elements.getNextId());
                newElementIds.set(a.id, e.id);
                e.type = proelem[a.aaAbbrev];
                if (strandColor) {
                    e.color = strandColor;
                }
                e.sid = sidCounter++;
                elements.push(e);
            });
        });
        // Now we know how many nucleotides there are, allocate the memory
        sys.initInstances(sidCounter);
        systems.push(sys);
        sysCount++;
        // Create a list of all strands of all the nucleotides and peptides
        // Really not great practice to be messing with the object, but I need to be able to come back to it later.
        struct.allStrands = struct.naStrands;
        struct.aaChains.forEach((p) => {
            struct.allStrands = struct.allStrands.concat(p);
        });
        //now that all the nucleotides have been created and the instances initialized, we can create the topology.
        struct.allStrands.forEach((s, i) => {
            let strand = sys.strands[i];
            //set strand ends
            strand.end5 = elements.get(newElementIds.get(s[startName(s)]));
            strand.end3 = elements.get(newElementIds.get(s[endName(s)]));
            s[monomerName(s)].forEach((n) => {
                let e = elements.get(newElementIds.get(n.id));
                //set neighbor connections
                e.n3 = elements.get(newElementIds.get(n.next));
                e.n5 = elements.get(newElementIds.get(n.prev));
                if (n.pair) {
                    e.pair = elements.get(newElementIds.get(n.pair));
                }
            });
        });
    });
    data.lattices.forEach((l) => {
        //position the nucleotides based on virtual helix position, if available
        let layout = l.type;
        let oPos = new THREE.Vector3().fromArray(l.position).multiplyScalar(lenFactor);
        let latOrient = new THREE.Euler().setFromVector3(new THREE.Vector3().fromArray(l.orientation).multiplyScalar(angleFactor)); //convert the array to a euler in radians
        let latticeElements = new Set();
        l.virtualHelices.forEach((helix) => {
            let latticePos = helix.latticePosition;
            let row = latticePos[0];
            let col = latticePos[1];
            let orient = helix.initialAngle * angleFactor;
            helix.cells.forEach((cell) => {
                let z = cell.number;
                let id1 = cell.fiveToThreeNts;
                let id2 = cell.threeToFiveNts;
                //calculate the position of the cell edges
                let ntCenter = getLatticePos(row, col, z, layout, oPos);
                let prevEdge = ntCenter.clone().sub(new THREE.Vector3(0, 0, BP_RISE / 2));
                let nextEdge = ntCenter.clone().add(new THREE.Vector3(0, 0, BP_RISE / 2));
                //This method of setting positions accounts for skips and deletions
                id1.forEach((e, i) => {
                    // set position as edge of last cell + a linear interpolation of how many nucleotides are in the current cell
                    let ePos = prevEdge.clone().add((nextEdge.clone().sub(prevEdge)).divideScalar(id1.length + 1).multiplyScalar(i + 1));
                    // like position, set rotation as a linear interpolation between the rotations of the neighboring cells
                    let eRot = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), orient + (z * (0.5 - (-(1 / (id1.length + 1)) * (i + 1))) * BP_ROTATION));
                    //offset each nucleotide from the helix center\
                    ePos.sub(eRot.clone().multiplyScalar(CM_CENTER_DIST));
                    let eA1 = eRot.clone();
                    let sceneE = elements.get(newElementIds.get(e));
                    latticeElements.add(sceneE);
                    sceneE.calcPositions(ePos, eA1, new THREE.Vector3(0, 0, 1), true);
                });
                //I hate doing it this way but there are so many add -> sub in here it kinda makes sense.
                id2.forEach((e, i) => {
                    let ePos = nextEdge.clone().sub((nextEdge.clone().sub(prevEdge)).divideScalar(id2.length + 1).multiplyScalar(i + 1));
                    let eRot = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), orient + (z * (0.5 + ((1 / (id2.length + 1)) * (i + 1))) * BP_ROTATION));
                    ePos.add(eRot.clone().multiplyScalar(CM_CENTER_DIST));
                    let eA1 = eRot.clone().multiplyScalar(-1);
                    let sceneE = elements.get(newElementIds.get(e));
                    latticeElements.add(sceneE);
                    sceneE.calcPositions(ePos, eA1, new THREE.Vector3(0, 0, -1), true);
                });
            });
        });
        // if the lattice has an orientation, rotate the system
        let q = new THREE.Quaternion;
        q.setFromEuler(latOrient);
        rotateElementsByQuaternion(latticeElements, q, setCenter(latticeElements), false);
    });
    // go back to the structures and set positions via alt positions
    data.structures.forEach((struct, i) => {
        //we put each structure in a different system, need to find the right one via this horrible dereference
        let sys = elements.get(struct.allStrands[0][monomerName(struct.allStrands[0])][0].id).getSystem();
        // lastly, position the nucleotides based off alt positions
        struct.allStrands.forEach((s) => {
            s[monomerName(s)].forEach((n) => {
                let e = elements.get(newElementIds.get(n.id));
                if (isNa(s) && n.altPositions[0]) {
                    let a1 = new THREE.Vector3().fromArray(n.altPositions[0].hydrogenFaceDir);
                    let a3 = new THREE.Vector3().fromArray(n.altPositions[0].baseNormal);
                    let bb = new THREE.Vector3().fromArray(n.altPositions[0].backboneCenter);
                    let ns = new THREE.Vector3().fromArray(n.altPositions[0].nucleobaseCenter);
                    //apply length factor
                    bb.multiplyScalar(lenFactor);
                    ns.multiplyScalar(lenFactor);
                    // calculate a2
                    let a2 = a1.clone().cross(a3);
                    //calculate real COM position
                    let cm = new THREE.Vector3().copy(bb);
                    if (e.isDNA()) {
                        cm.add(a1.clone().multiplyScalar(0.34).add(a2.clone().multiplyScalar(0.3408)));
                    }
                    else if (e.isRNA()) {
                        cm.add(a1.clone().multiplyScalar(0.4).add(a3.clone().multiplyScalar(0.2)));
                    }
                    else {
                        notify("How did you make something that wasn't DNA or RNA?", 'alert');
                    }
                    //since bb and ns are explicitally defined rather than having a COM, I just copied this from Nucleotide.calcPositions.
                    let sid = e.sid;
                    // compute nucleoside rotation
                    const baseRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), a3);
                    //compute connector position
                    const con = bb.clone().add(ns).divideScalar(2);
                    // compute connector rotation
                    const rotationCon = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), con.clone().sub(ns).normalize());
                    // compute connector length
                    let conLen = bb.distanceTo(ns);
                    // compute sugar-phosphate positions/rotations, or set them all to 0 if there is no sugar-phosphate.
                    let sp, spLen, spRotation;
                    if (e.n3) {
                        let bbLast = e.n3.getInstanceParameter3('bbOffsets');
                        sp = bb.clone().add(bbLast).divideScalar(2);
                        spLen = bb.distanceTo(bbLast);
                        //introduce distance based cutoff of the backbone connectors
                        if (spLen >= box.x * .9 || spLen >= box.y * .9 || spLen >= box.z * .9)
                            spLen = 0;
                        spRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), sp.clone().sub(bb).normalize());
                    }
                    else {
                        sp = new THREE.Vector3();
                        spLen = 0;
                        spRotation = new THREE.Quaternion(0, 0, 0, 0);
                    }
                    e.handleCircularStrands(sys, sid, bb);
                    // determine the mesh color, either from a supplied colormap json or by the strand ID.
                    const bbColor = e.strandToColor(e.strand.id);
                    sys.fillVec('bbColors', 3, sid, [bbColor.r, bbColor.g, bbColor.b]);
                    const nsColor = e.elemToColor(e.type);
                    sys.fillVec('nsColors', 3, sid, [nsColor.r, nsColor.g, nsColor.b]);
                    let idColor = new THREE.Color();
                    idColor.setHex(e.id + 1); //has to be +1 or you can't grab nucleotide 0
                    sys.fillVec('bbLabels', 3, sid, [idColor.r, idColor.g, idColor.b]);
                    //fill the instance matrices with data
                    sys.fillVec('cmOffsets', 3, sid, cm.toArray());
                    sys.fillVec('bbOffsets', 3, sid, bb.toArray());
                    sys.fillVec('nsOffsets', 3, sid, ns.toArray());
                    sys.fillVec('nsRotation', 4, sid, [baseRotation.w, baseRotation.z, baseRotation.y, baseRotation.x]);
                    sys.fillVec('conOffsets', 3, sid, con.toArray());
                    sys.fillVec('conRotation', 4, sid, [rotationCon.w, rotationCon.z, rotationCon.y, rotationCon.x]);
                    sys.fillVec('bbconOffsets', 3, sid, sp.toArray());
                    sys.fillVec('bbconRotation', 4, sid, [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
                    sys.fillVec('scales', 3, sid, [1, 1, 1]);
                    sys.fillVec('nsScales', 3, sid, [0.7, 0.3, 0.7]);
                    sys.fillVec('conScales', 3, sid, [1, conLen, 1]);
                    if (spLen == 0) {
                        sys.fillVec('bbconScales', 3, sid, [0, 0, 0]);
                    }
                    else {
                        sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);
                    }
                    sys.fillVec('visibility', 3, sid, [1, 1, 1]);
                }
                else if (n.altPositions[0]) { //e must be a protein so we just need the a-carbon position
                    let p = new THREE.Vector3().fromArray(n.altPositions[0]);
                    p.multiplyScalar(lenFactor);
                    e.calcPositions(p, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0), true);
                }
            });
        });
        // Finally, we can add the system to the scene
        addSystemToScene(sys);
        centerAndPBC(sys.getMonomers());
    });
    if (customColors) {
        view.coloringMode.set("Custom");
    }
    // Should probably change the PDB reader to have a function which takes a string...
    // But whatever, this works
    if (appendedData != '') {
        let blob = new Blob([appendedData], { type: 'text/plain' });
        let f = new File([blob], 'tmp.pdb', { type: 'text/plain' });
        readPdbFile(f);
    }
}
