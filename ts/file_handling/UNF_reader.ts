function readUNFString(s: string) {

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
            return 'fivePrimeId'
        }
        else {
            return 'nTerm'
        }
    }

    function endName(obj) {
        if (isNa(obj)) {
            return 'threePrimeId'
        }
        else {
            return 'cTerm'
        }
    }

    function monomerName(obj) {
        if (isNa(obj)) {
            return 'nucleotides'
        }
        else {
            return 'aminoAcids'
        }
    }

    const newElementIds = new Map()

    // Parse json string
    const data = JSON.parse(s);

    // UNF allows the user to specify the length scale
    const lengthUnitsString = data.lengthUnits
    let lenFactor: number
    switch(lengthUnitsString) {
        case 'A':
            lenFactor = 1/8.518;
            break;
        case 'nm':
            lenFactor = 1/0.8518;
            break;
        case 'pm':
            lenFactor = 1/851.8;
            break;
        default:
            notify(`Unrecognized length factor ${lengthUnitsString}.  Defaulting to Angstrom`, "alert");
            lenFactor = 1/8.518;
    }

    // Update box data, if provided
    if (data.box) {
        // Don't make smaller than current
        box.x = Math.max(box.x, data.box[0]);
        box.y = Math.max(box.y, data.box[1]);
        box.z = Math.max(box.z, data.box[2]);
    }
    else {
        box.x = 1000;
        box.y = 1000;
        box.z = 1000;
    }

    // flag if there are custom colors
    let customColors: boolean = false;

    // Create a system for our file
    let sys = new System(sysCount, elements.getNextId());
    sys.label = data.name;
    let sidCounter = 0;

    let strandCounter = 0;
    data.naStrands.forEach((s) => {
        //parse the strand header
        //This will be a NucleicAcidStrand since it's in the naStrand section.
        let strand = new NucleicAcidStrand(strandCounter++, sys); //UNF has been known to not have sequential strand ids.
        
        strand.label = s.name
        let naType: string = s.naType;
        if (naType == 'XNA') {
            notify(`Warning: XNA not supported by the oxDNA model.  Strand ${s.name} will be represented as an RNA for visualization purposes.`);
            naType = 'RNA';
        }

        let strandColor: THREE.Color;
        if(s.color) {
            strandColor = new THREE.Color(s.color);
            customColors = true;
        }

        sys.addStrand(strand)

        s.nucleotides.forEach((n) => {
            let e = strand.createBasicElementTyped(naType.toLowerCase(), elements.getNextId())
            newElementIds.set(n.id, e.id);

            e.type = n.nbAbbrev;
            if (strandColor){
                e.color = strandColor;
            }
            
            e.sid = sidCounter++;

            elements.push(e);

        });
    });

    //start reading in proteins
    //eventually these should be moved into clusters.
    let chainCount = -1
    data.proteins.forEach((p) => {
        p.chains.forEach((s) =>{
            s.naType = 'peptide' //this is a giant mess because I need all the strands, but can't actually tell what they are.

            let strand = new Peptide(chainCount--, sys); //does this need to be -1?

            strand.label = s.name

            let strandColor: THREE.Color;
            if(s.color) {
                strandColor = new THREE.Color(s.color);
                customColors = true;
            }

            sys.addStrand(strand)

            s.aminoAcids.forEach((a) => {
                let e = strand.createBasicElement(elements.getNextId());
                newElementIds.set(a.id, e.id);

                e.type = proelem[a.aaAbbrev];
                if (strandColor){
                    e.color = strandColor;
                }

                e.sid = sidCounter++;

                elements.push(e);
            });

        });
    });

    sys.initInstances(sidCounter);
    systems.push(sys);
    sysCount++;

    let allStrands = data.naStrands
    data.proteins.forEach((p) =>{
        allStrands = allStrands.concat(p.chains)
    })

    //now that all the nucleotides have been created and the instances initialized, we can create the topology.
    allStrands.forEach((s, i) => {
        let strand = sys.strands[i];

        //set strand ends
        strand.end5 = elements.get(newElementIds.get(s[startName(s)]));
        strand.end3 = elements.get(newElementIds.get(s[endName(s)]));

        s[monomerName(s)].forEach((n) => {
            let e = elements.get(newElementIds.get(n.id))
            
            //set interactions
            e.n3 = elements.get(newElementIds.get(n.next));
            e.n5 = elements.get(newElementIds.get(n.prev));
            if (n.pair) {
                (e as any).pair = elements.get(newElementIds.get(n.pair))
            }
            
        });
    });

    // lastly, position the nucleotides
    allStrands.forEach((s) => {
        s[monomerName(s)].forEach((n) => {
            let e = elements.get(newElementIds.get(n.id))
            if (isNa(s)) {

                let a1 = new THREE.Vector3().fromArray(n.altPositions[0].hydrogenFaceDir);
                let a3 = new THREE.Vector3().fromArray(n.altPositions[0].baseNormal);
                let bb = new THREE.Vector3().fromArray(n.altPositions[0].backboneCenter);
                let ns = new THREE.Vector3().fromArray(n.altPositions[0].nucleobaseCenter);

                //apply length factor
                bb.multiplyScalar(lenFactor);
                ns.multiplyScalar(lenFactor);

                //since bb and ns are explicitally defined rather than having a COM, I just copied this from Nucleotide.calcPositions.

                let sid = e.sid

                // compute nucleoside rotation
                const baseRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), a3);

                //compute connector position
                const con = bb.clone().add(ns).divideScalar(2);

                // compute connector rotation
                const rotationCon = new THREE.Quaternion().setFromUnitVectors(
                    new THREE.Vector3(0, 1, 0),
                    con.clone().sub(ns).normalize());

                // compute connector length
                let conLen = bb.distanceTo(ns);

                // compute sugar-phosphate positions/rotations, or set them all to 0 if there is no sugar-phosphate.
                let sp: THREE.Vector3, spLen: number, spRotation;
                if (e.n3) {
                    let bbLast = e.n3.getInstanceParameter3('bbOffsets');
                    sp = bb.clone().add(bbLast).divideScalar(2);
                    spLen = bb.distanceTo(bbLast);
                    //introduce distance based cutoff of the backbone connectors
                    if (spLen >= box.x * .9 || spLen >= box.y * .9 || spLen >= box.z * .9) spLen = 0;
                    spRotation = new THREE.Quaternion().setFromUnitVectors(
                        new THREE.Vector3(0, 1, 0), sp.clone().sub(bb).normalize()
                    );
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
                sys.fillVec('cmOffsets', 3, sid, bb.toArray()); //this is silly and bad.
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
                } else {
                    sys.fillVec('bbconScales', 3, sid, [1, spLen, 1]);
                }
                sys.fillVec('visibility', 3, sid, [1, 1, 1]);
            }
            else { //e must be a protein so we just need the a-carbon position
                let p = new THREE.Vector3().fromArray(n.altPositions[0])
                p.multiplyScalar(lenFactor);
                e.calcPositions(p, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0), true)
            }
        });
    });

    // Finally, we can add the system to the scene
    addSystemToScene(sys);

    if (customColors) {
        view.coloringMode.set("Custom");
    }

    // Center the newly added systems as one
    // Needs to be done after all systems are added to the scene
    centerAndPBC(sys.getMonomers())
}