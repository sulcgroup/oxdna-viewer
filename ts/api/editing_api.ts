/**
 * Bits of code that handle structure editing
 */
module edit{
/**
     * Split the element's strand at the element provided
     * @param e Element to split at
     * @returns new strand created in split
     */
    function splitStrand(e: BasicElement): Strand {
        const strand = e.strand;

        // Splitting a circular strand doesn't make more strands.
        // We only need to update endpoints.
        if (strand.isCircular()) {
            e.n3.n5 = null;
            e.n3 = null;
            strand.setFrom(e);
            // Remove connector geometry.
            view.update3pMarker(e);
            return;
        }

        // No need to split if one half will be empty
        if(!e.n3) {
            console.assert(e == e.strand.end3, "Incorrect endpoint");
            return;
        }

        // Create, fill and deploy new strand
        let newStrand: Strand;
        if (strand.isPeptide()) {
            newStrand = strand.system.addNewPeptideStrand();
        }
        else {
            newStrand = strand.system.addNewNucleicAcidStrand();
        }

        let tmpn3 = e.n3; // Save 3' neighbour temporarly.

        // Fix endpoints
        // 3'--strand--e.n3 | e--newStrand--5'
        e.n3.n5 = null;
        e.n3 = null;

        strand.setFrom(e);
        newStrand.setFrom(tmpn3);

        [strand, newStrand].forEach(s=>{
            console.assert(!s.end3.n3, "Incorrect endpoint after split")
            console.assert(!s.end5.n5, "Incorrect endpoint after split")
        });

        newStrand.forEach(i=>{
            console.assert(i.strand == newStrand, "Incorrect strand reference");
            i.updateColor();
        });

        if (strand.label) {
            newStrand.label = `${strand.label}_2`;
            strand.label = `${strand.label}_1`;
        }

        // Remove connector geometry.
        view.update3pMarker(e);
        let sys = e.dummySys ? e.dummySys : e.getSystem();
        sys.callUpdates(['instanceColor']);

        return newStrand;
    }

    export function move_to(e:BasicElement, to_displace: BasicElement[]){
        //displace a list of elements tovards the position of e
        let origin= to_displace[0].getPos();
        let displace_by = e.getPos().sub(origin);
        to_displace.forEach(p=>{
           p.translatePosition(displace_by);
        });
        systems.forEach((s) => s.callUpdates(['instanceOffset']));
        tmpSystems.forEach((s) => s.callUpdates(['instanceOffset']));
        render();
    }

    export function insert(e :BasicElement, sequence: string): BasicElement[] {
        let edits = [];

        let end5 = e;
        let end3 = e.n3;
        if (!end3) {
            notify("Cannot insert at the end of a strand, use extend instead");
            return;
        }

        // Shorthand to get the backbone position
        const getPos = e => {return e.getInstanceParameter3("bbOffsets");};

        // Nick between the elements
        let nicking = new RevertableNick(end5);
        edits.push(nicking);
        nicking.do()

        // Extend, move and make sure to be revertable
        const added = extendStrand(end5, sequence);
        
        const firstPos = getPos(end5);
        const lastPos = getPos(end3);
        added.forEach((e, i)=>{
            // Position on line between e1 and e2
            let newPos = firstPos.clone().lerp(lastPos, (i+1)/(added.length+1));
            translateElements(new Set<BasicElement>([e]), newPos.sub(getPos(e)));
        })

        let instanceCopies = added.map(e=>{return new InstanceCopy(e)});

        // Get center of mass so that we can place them back if reverted
        let pos = new THREE.Vector3();
        added.forEach(e=>pos.add(getPos(e)));
        pos.divideScalar(added.length);
        let addition = new RevertableAddition(instanceCopies, added, pos);
        edits.push(addition);

        // Finally, ligate the last added element to e2
        const lastAdded = added[added.length - 1];
        let ligation = new RevertableLigation(lastAdded, end3);
        edits.push(ligation);
        ligation.do();

        editHistory.add(new RevertableMultiEdit(edits));
        return added;
    }

    export function skip(elems: BasicElement[]) {
        let edits = [];
        elems.forEach(e=>{
            let e3 = e.n3;
            let e5 = e.n5;

            let deletion = new RevertableDeletion([e])
            edits.push(deletion);
            deletion.do();

            // Only ligate if it has both neighbors
            if (e3 && e5) {
                let ligation = new RevertableLigation(e3, e5);
                edits.push(ligation);
                ligation.do();
            }
        })
        editHistory.add(new RevertableMultiEdit(edits));
    }

    export function nick(element: BasicElement){
        splitStrand(element);
        render(); 
    }

    export function ligate(a :BasicElement, b: BasicElement) {
        let end5: BasicElement,
            end3: BasicElement;
        //find out which is the 5' end and which is 3'
        if (!a.n5 && !b.n3) {
            end5 = a;
            end3 = b;
        }
        else if (!a.n3 && !b.n5) {
            end5 = b;
            end3 = a;
        }
        else {
            notify("Please select one nucleotide with an available 3' connection and one with an available 5'");
            return;
        }

        // strand5 will have an open 5' and strand3 will have an open 3' end
        // strand3 will be merged into strand5
        let sys5 = end5.getSystem(),
        sys3 = end3.getSystem(),
        strand5 = end5.strand,
        strand3 = end3.strand;

        // handle strand1 and strand2 not being in the same system
        if (sys5 !== sys3) {
            let tmpSys = new System(tmpSystems.length, 0);
            tmpSystems.push(tmpSys);
            tmpSys.initInstances(strand3.getLength());

            strand3.forEach((e, i)=>{
                copyInstances(e, i, tmpSys)
                e.setInstanceParameter('visibility', [0,0,0])
                e.sid = i;
                e.dummySys = tmpSys;
            })

            addSystemToScene(tmpSys);
        }

        //connect the 2 element objects 
        end5.n5 = end3;
        end3.n3 = end5;

        // Update the strand to have the correct end
        strand5.end5 = strand3.end5;

        // Update 5' end to include the new elements
        strand3.forEach(e=>{
            e.strand = strand5;
        })
        
        //check that it is not the same strand
        if (strand5 !== strand3) {
            //remove strand3 object 
            strand3.system.removeStrand(strand3);

            //since strand IDs were updated, we also need to update the coloring
            updateColoring();
        }

        //last, add the sugar-phosphate bond
        let p2 = end3.getInstanceParameter3("bbOffsets");
        let p1 = end5.getInstanceParameter3("bbOffsets");

        let sp = p2.clone().add(p1).divideScalar(2);
        let spLen = p2.distanceTo(p1);

        let spRotation = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), sp.clone().sub(p2).normalize()
        );

        end3.setInstanceParameter('bbconOffsets', sp.toArray());
        end3.setInstanceParameter('bbconRotation', [spRotation.w, spRotation.z, spRotation.y, spRotation.x]);
        end3.setInstanceParameter('bbconScales', [1, spLen, 1]);

        sys5.callUpdates(["instanceOffset", "instanceScale", "instanceColor", "instanceRotation", "instanceVisibility"]);
        sys3.callUpdates(["instanceOffset", "instanceScale", "instanceColor", "instanceRotation", "instanceVisibility"]);

        tmpSystems.forEach((s) => {
            s.callUpdates(['instanceOffset', 'instanceRotation', 'instanceScale', 'instanceColor', 'instanceVisibility'])
        });
        render();
    }

    /**
     * 
     * @param victims 
     */
    export function deleteElements (victims: BasicElement[]) {
        let needsUpdateList = new Set<System>();
        victims.forEach((e) => {
            e = elements.get(e.id); // If we add element, then remove it, then undo both edits
            let sys = e.dummySys ? e.dummySys : e.getSystem();
            let strand = e.strand;
            let n3 = e.n3;
            let n5 = e.n5;
            needsUpdateList.add(sys);
            // Hide element
            e.toggleVisibility();
            // Remove connector geometry.
            if (n5) {
                view.update3pMarker(n5);
            }

            let strand3, strand5;
            // Split strand if we won't also delete further downstream
            if (n3) {
                strand3 = splitStrand(e);
            }
            // Split strand if we won't also delete further downstream
            if (n5) {
                strand5 = splitStrand(n5);
            }

            // Remove pairing
            if(e.isPaired()) {
                if ((e as Nucleotide).pair.pair === e) {
                    (e as Nucleotide).pair.pair = undefined
                } else {
                    console.warn("Non-mutual basepair!")
                }
            }

            // Remove e from element map and selection
            elements.delete(e.id);
            selectedBases.delete(e);

            // Strand 5 should now contain e (and any other neighbours to delete).
            // Remove the strand it only contains e.
            [strand, strand3, strand5].forEach(s=>{
                if (s && e == s.end3 && e == s.end5) {
                    let system = s.system;
                    system.removeStrand(s);
                    // Remove system if empty
                    if (system.isEmpty()) {
                        systems.splice(systems.indexOf(system), 1);
                        sysCount--;
                    }
                }
            });
        });
        needsUpdateList.forEach((s) => {
            s.callUpdates(['instanceVisibility', 'instanceScale', 'instanceColor']);
        });
        render();
    }

    /**
     * Add elements from saved instance copies, at specified position
     * @param instCopies Instance copies of elements to add
     * @param pos Intended position of elements center of mass
     */
    export function addElementsAt(instCopies: InstanceCopy[], pos?: THREE.Vector3): BasicElement[] {
        // Add elems
        let elems = addElements(instCopies);

        if (pos) {
            // Calculate elems center of mass
            let com = new THREE.Vector3();
            elems.forEach(e=>{
                let p = e.getPos();
                com.add(p);
            });
            com.divideScalar(elems.length);

            // Move elements to position
            translateElements(new Set(elems), pos.clone().sub(com));
        }
        return elems;
    }

    /**
     * Add elements from saved instance copies
     * @param instCopies Instance copies of elements to add
     */
    export function addElements(instCopies: InstanceCopy[]): BasicElement[] {
        // Initialize a dummy system to put the monomers in
        const tmpSys = new System(systems.length, 0);
        tmpSys.initInstances(instCopies.length);
        tmpSystems.push(tmpSys);

        let newClusterMap: Map<number, number> = new Map();

        let oldids = instCopies.map(c=>{return c.id});
        let elems = instCopies.map((c,sid)=>{
            // Create new element
            let e: BasicElement = new c.elemType(undefined, undefined);
            // Give back the old copied id if it's not already in use,
            // otherwise, create a new one
            if(!elements.has(c.id)) {
                elements.set(c.id, e);
            } else {
                elements.push(e);
            }
            c.writeToSystem(sid, tmpSys)
            e.dummySys = tmpSys;
            e.sid = sid;
            e.setType(c.type);
            e.color = c.color;

            // Add pasted elements to new cluster
            // (or clusters, if the copied elements had more than one cluster)
            if (c.clusterId !== undefined && c.clusterId > 0) {
                if (!newClusterMap.has(c.clusterId)) {
                    newClusterMap.set(c.clusterId, ++clusterCounter);
                }
                e.clusterId = newClusterMap.get(c.clusterId);
            }

            // Assign a picking color
            let idColor = new THREE.Color();
            idColor.setHex(e.id + 1); //has to be +1 or you can't grab nucleotide 0
            tmpSys.fillVec('bbLabels', 3, sid, [idColor.r, idColor.g, idColor.b]);

            return e;
        });

        addSystemToScene(tmpSys);

        let toLigate = [];

        // Sort out neighbors
        elems.forEach((e, sid)=>{
            let c = instCopies[sid];
            // Add neighbors to new copies in list, or to existing elements
            // if they don't already have neighbors
            if(c.n3id >= 0) { // If we have a 3' neighbor
                let i3 = oldids.findIndex(id=>{return id == c.n3id});
                // If the 3' neighbor is also about to be added, we link to
                // the new object instead
                if (i3 >= 0) {
                    e.n3 = elems[i3];
                    elems[i3].n5 = e;
                // Otherwise, if the indicated neighbor exists and we can link
                // the new element to it without overwriting anything
                } else if (
                    elements.has(c.n3id) &&
                    elements.get(c.n3id) &&
                    !elements.get(c.n3id).n5)
                {
                    e.n3 = null;
                    toLigate.push([e, elements.get(c.n3id)]);
                    //e.neighbor3 = elements.get(c.n3id);
                    //e.neighbor3.neighbor5 = e;
                // If not, we don't set any neighbor
                } else {
                    e.n3 = null;
                }
            }
            // Same as above, but for 5'
            if(c.n5id >= 0) { // If we have a 5' neighbor
                let i5 = oldids.findIndex(id=>{return id == c.n5id});
                // If the 5' neighbor is also about to be added, we link to
                // the new object instead
                if (i5 >= 0) {
                    e.n5 = elems[i5];
                    elems[i5].n3 = e;
                // Otherwise, if the indicated neighbor exists and we can link
                // the new element to it without overwriting anything
                } else if (
                    elements.has(c.n5id) &&
                    elements.get(c.n5id) &&
                    !elements.get(c.n5id).n3)
                {
                    e.n5 = null;
                    toLigate.push([e, elements.get(c.n5id)]);
                // If not, we don't set any neighbor
                } else {
                    e.n5 = null;
                }
            }
            // Same but for basepairs
            if(c.bpid >= 0) {
                let bp = oldids.findIndex(id=>{return id == c.bpid});
                // If the paired base is also about to be added, we link to
                // the new object instead
                if (bp >= 0) {
                    e['pair'] = elems[bp];
                    elems[bp]['pair'] = e;
                // Otherwise, if the indicated basepair exists and we can pair
                // the new element to it without overwriting anything
                } else if (
                    elements.has(c.bpid) &&
                    elements.get(c.bpid) &&
                    !elements.get(c.bpid).isPaired())
                {
                    e['pair'] = elements.get(c.bpid);
                    elements.get(c.bpid)['pair'] = e;
                }
            }
        });

        // Sort out strands
        elems.forEach((e, sid)=>{
            let c = instCopies[sid];
            let sys = c.system;
            // Do we have a strand assigned already?
            if(!e.strand) {
                // Does any of our neighbors know what strand this is?
                let i = e;
                while(!i.strand) { // Look in 3' dir
                    if (e === i.n3) {
                        break
                    }
                    if (i.n3) i = i.n3;
                    else break;
                }
                if(!i.strand) { // If nothing, look in 5' dir
                    i = e;
                    while(!i.strand) {
                        if (e === i.n5) {
                            break
                        }
                        if (i.n5) i = i.n5;
                        else break;
                    }
                }
                // If we found something
                if (i.strand) {
                    // Add us to the strand
                    e.strand = i.strand;
                    // And update endpoints
                    e.strand.updateEnds();
                } else {
                    // Create a new strand
                    let strand: Strand;
                    if (e.isAminoAcid()) {
                        strand = sys.addNewPeptideStrand();
                    } else if (e.type == 'gs') {
                        strand = sys.addNewGenericSphereStrand();
                    } else {
                        strand = sys.addNewNucleicAcidStrand();
                    }
                    e.strand = strand;
                    strand.setFrom(e);
                }
            }
            // If the whole system has been removed we have to add it back again
            if (!systems.includes(sys)) {
                systems.push(sys);
            }
        });

        // Update bonds
        elems.forEach(e=>{
            // Do we still have a 3' neighbor?
            if(e.n3) {
                // Update backbone bond
                calcsp(e);
            } else {
                // Set explicitly to null
                e.n3 = null;
                // Remove backbone bond
                view.update3pMarker(e);
            }
            if(!e.n5) {
                // Set explicitly to null
                e.n5 = null;
            }
            e.updateColor();
        });

        tmpSys.callUpdates(['instanceColor']);

        toLigate.forEach(p=>{
            ligate(p[0], p[1]);
        });

        return elems;
    }

    function addElementsBySeq (end: BasicElement, sequence, tmpSys, direction, inverse, sidCounter): BasicElement[] {
        // add monomers to the strand
        const strand: Strand = end.strand;
        const positions = end.extendStrand(sequence.length, direction, false);
        let last = end;

        let addedElems = [];
        //create topology
        for (let i = 0, len = sequence.length; i < len; i++) {
            let e = strand.createBasicElement();
            elements.push(e); // Add element and assign id
            e.sid = sidCounter; //You're always adding to a tmpSys so this is needed
            e.dummySys = tmpSys;
            last[direction] = e;
            e[inverse] = last;
            e.setType(sequence[i]);
            e.strand = strand;
            last = e;
            sidCounter++;
            addedElems.push(e);
        }
        // Make last element end of strand
        last[direction] = null;
        strand.setFrom(last);

        let e: BasicElement = end[direction];
        //position new monomers
        for (let i = 0, len = sequence.length; i < len; i++) {
            let [p, a1, a3] = positions[i]
            e.calcPositions(p, a1, a3, true);
            e = e[direction];
        }

        addSystemToScene(tmpSys);
        //putting this in one loop would slow down loading systems
        //would require dereferencing the backbone position of every nucleotide
        //its not worth slowing down everything to avoid this for loop
        //which is much more of an edge case anyway.
        e = end;
        while (e && e[direction]) {
            // Backbone must be drawn from 5' end
            if (direction == "n5") {
                calcsp(e.n5);
            } else {
                calcsp(e);
            }
            e = e[direction];
        }

        return addedElems;
    }

    function addDuplexBySeq (end:Nucleotide, sequence: String, tmpSys, direction, inverse, sidCounter): BasicElement[] {
        // variables ending in "2" correspond to complement strand
        let end2: Nucleotide;
        if (!end.pair) {
            end2 = end.findPair();
        } else {
            end2 = end.pair;
        }
        const strand: Strand = end.strand;
        const strand2: Strand = end2.strand;
        const l = sequence.length;
        
        const positions = end.extendStrand(l, direction, true); // true = double strand

        let last1 = end;
        let last2 = end2;
        let addedElems = [];

        for (let i = 0; i < l; i++) {
            let e1 = <Nucleotide>strand.createBasicElement();
            elements.push(e1);
            e1.sid = sidCounter + i;
            e1.dummySys = tmpSys;
            last1[direction] = e1;
            e1[inverse] = last1;
            e1.setType(sequence[i]);
            e1.strand = strand;
            last1 = e1;
            addedElems.push(e1);
        }

        // the one thing about this is that it makes the second strand backwards
        // this is generally fine because of the pre-export cleanup step
        // however it is a little spooky...
        // It is this way because otherwise it would require a lot of conditionals
        // to correctly assign end2's neighbor
        for (let i = 0; i < l; i++) {
            let e1 = addedElems[i] as Nucleotide;
            let e2 = strand2.createBasicElement() as Nucleotide;
            elements.push(e2);
            e2.sid = sidCounter + l + i;
            e2.dummySys = tmpSys;
            last2[inverse] = e2;
            e2[direction] = last2;
            e2.setType(e1.getComplementaryType());
            e2.strand = strand2;
            last2 = e2;
            addedElems.push(e2);

            e1.pair = e2;
            e2.pair = e1;
        }

        last1[direction] = null;
        last2[inverse] = null;
        let e1: BasicElement = end[direction];
        let e2: BasicElement = end2[inverse];

        for (let i = 0; i < l; i++) {
            let [p, a1, a3] = positions[i]
            e1.calcPositions(p, a1, a3, true);
            e1 = e1[direction];
        }
        // complementary strand adds elements in reverse direction
        for (let i = l * 2 - 1; i >= l; i--) {
            let [p, a1, a3] = positions[i];
            e2.calcPositions(p, a1, a3, true);
            e2 = e2[inverse];
        }

        strand.updateEnds();
        strand2.updateEnds();

        addSystemToScene(tmpSys);
        e1 = end;
        e2 = end2;
        while (e1 && e1[direction]) {
            if (direction == "n5") {
                calcsp(e1.n5);
            } else {
                calcsp(e1);
            }
            e1 = e1[direction];
        }
        while (e2 && e2[inverse]) {
            if (inverse == "n5") {
                calcsp(e2.n5);
            } else {
                calcsp(e2);
            }
            e2 = e2[inverse];
        }
        render();

        return addedElems;
    }

    /**
     * Create new monomers extending from the provided one.
     * @param end 
     * @param sequence 
     */
    export function extendStrand(end: BasicElement, sequence: string): BasicElement[] {
        // figure out which way we're going
        let direction: string;
        let inverse: string;

        if (end.n3 == null) {
            direction = "n3";
            inverse = "n5";
        }
        else if (end.n5 == null) {
            direction = "n5";
            inverse = "n3";
        }
        else {
            notify("Please select a monomer that has an open neighbor");
            return
        }

        // initialize a dummy system to put the monomers in
        const tmpSys = new System(tmpSystems.length, 0);
        tmpSys.initInstances(sequence.length);
        tmpSystems.push(tmpSys);

        let addedElems = addElementsBySeq(end, sequence, tmpSys, direction, inverse, 0);

        render();
        return addedElems;
    }

    /**
     * Create double helix of monomers extending from provided helix
     * @param end Nucleotide to extend
     * @param sequence String of base types
     * @returns addedElems Nucleotide[]
     */
    export function extendDuplex(end: Nucleotide, sequence: string): BasicElement[] {
        let end2: Nucleotide;
        if (!end.pair) {
            end2 = end.findPair();
        } 
        else {
            end2 = end.pair;
        }

        // create base pair if end doesn't have one already
        let addedElems = [];
        if (!end2) {
            end2 = createBP(end);
            addedElems.push(end2);
        }
        let direction: string;
        let inverse: string;
        if (end.n5 == null && end2.n3 == null) {
            direction = "n5";
            inverse = "n3";
        }
        else if (end.n3 == null && end2.n5 == null) {
            direction = "n3";
            inverse = "n5";
        }
        else {
            notify("Please select a monomer that has an open neighbor");
            return;
        }

        // initialize dummy systems to put each sequence in
        const tmpSys = new System(tmpSystems.length, 0);
        tmpSys.initInstances(sequence.length * 2);
        tmpSystems.push(tmpSys);

        addedElems = addedElems.concat(addDuplexBySeq(end, sequence, tmpSys, direction, inverse, 0));
        render();
        return addedElems;
    }


    export function getSequence(elems: Set<BasicElement>) : string {
        // Sort elements in 5' to 3' order
        let strands = new Set<Strand>();
        elems.forEach(e=>{strands.add(e.strand)});
        let orderedElems = [];
        Array.from(strands).sort((a,b)=>{return a.id<b.id ? 1:-1}).forEach(strand=>{
            orderedElems.push(...strand.filter(e=>elems.has(e)));
        });

        return orderedElems.map(e=>{return e.type}).join('');
    };

    export function setSequence(elems: Set<BasicElement>, sequence: string, setComplementaryBases?: boolean) {
        setComplementaryBases = setComplementaryBases || false;
        if (elems.size != sequence.length) {
            notify(`You have ${elems.size} particles selected and ${sequence.length} letters in the sequence...doing my best`);
        }

        // Sort elements in 5' to 3' order
        let strands = new Set<Strand>();
        elems.forEach(e=>{strands.add(e.strand)});
        let orderedElems = [];
        Array.from(strands).sort((a,b)=>{return a.id<b.id ? 1:-1}).forEach(strand=>{
            orderedElems.push(...strand.filter(e=>elems.has(e)));
        });

        console.log("set", orderedElems)

        // Define a function to satisfy view.longCalculation callback
        let set = function(){
            let len = Math.min(orderedElems.length, sequence.length);
            for(let i=0; i<len; i++) {
                let e = orderedElems[i];
                e.changeType(sequence[i]);
                if (setComplementaryBases) {
                    if(e.isPaired()) {
                        let n = e as Nucleotide;
                        n.pair.changeType(n.getComplementaryType());
                    }
                }
            }
            systems.concat(tmpSystems).forEach(system=>{
                system.nucleoside.geometry["attributes"].instanceColor.needsUpdate = true;
                system.callUpdates(['instanceColor'])
            });
            render();
        }

        // If we need to find basepairs, do that first and wait
        // for the calculation to finish. Otherwise, set the
        // sequence immediately.
        if (setComplementaryBases && ![...elems][0].isPaired()) {
            view.longCalculation(findBasepairs, view.basepairMessage, set);
        } else {
            set();
        }
    }

    /**
     * Creates a new strand with the provided sequence
     * @param sequence
     * @param createDuplex (optional) Create a duplex?
     * @param isRNA (optional) Is this an RNA strand?
     */
    export function createStrand(sequence: string, createDuplex?: boolean, isRNA?: Boolean) {
        if (sequence.includes('U')) {
            isRNA = true;
            RNA_MODE = true;
        }

        // Initialize a dummy system to put the monomers in 
        const tmpSys = new System(tmpSystems.length, 0);
        // This looks weird, but createBP() makes that nucleotide in its own tmpSys so it's 2n-1 for the duplex case.
        tmpSys.initInstances(sequence.length * (createDuplex ? 2:1) + (createDuplex ? -1:0));
        tmpSystems.push(tmpSys);

        // The strand gets added to the last-added system.
        // Or make a new system if you're crazy and trying to build something from scratch
        let realSys: System;
        let blank = false;
        if (systems.length > 0) {
            realSys = systems.slice(-1)[0];
        }
        else {
            blank = true;
            realSys = new System(sysCount++, elements.getNextId())
            realSys.initInstances(0);
            systems.push(realSys);
            addSystemToScene(realSys);
            // This is ugly, but if we don't have a box, everything will be
            // squashed into the origin when centering.
            box = new THREE.Vector3(1000,1000,1000);
        }

        // Create a new strand
        let strand = realSys.createStrand(realSys.strands.length);
        realSys.addStrand(strand);

        // Initialise proper nucleotide
        let e = isRNA ? new RNANucleotide(undefined, strand):new DNANucleotide(undefined, strand);

        let addedElems = [];

        elements.push(e); // Add element and assign id
        e.dummySys = tmpSys;
        e.sid = 0;
        e.setType(sequence[0]);
        e.n3 = null;
        e.strand = strand;
        strand.setFrom(e);

        addedElems.push(e);

        let pos:THREE.Vector3, a1: THREE.Vector3, a3: THREE.Vector3;
        if (blank) {
            // Place new strand at origin if the scene is empty
            pos = new THREE.Vector3(0, 0, 0);
            if (isRNA) {
                // This puts the helix axis up the Z axis
                a1 = new THREE.Vector3(0, 0.9636304532086232, -0.2672383760782569);
                a3 = a1.clone().cross(new THREE.Vector3(1, 0, 0));
            }
            else {
                // DNA is so easy
                a1 = new THREE.Vector3(0,1,0);
                a3 = new THREE.Vector3(0,0,-1);
            }
        } else {
            // Otherwise, place the new strand 10 units in front of the camera
            // with its a1 vector parallel to the camera heading
            // and a3 the cross product of the a1 vector and the camera's up vector
            a1 = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            pos = camera.position.clone().add(a1.clone().multiplyScalar(20));
            a3 = a1.clone().cross(camera.up);
        }
        e.calcPositions(pos, a1, a3, true);
        e.dummySys = tmpSys;

        // Extends the strand 3'->5' with the rest of the sequence
        // and return all added elements.

        if (createDuplex) {
            // create base pair if end doesn't have one already
            if (!e.findPair()) {
                e.pair = createBP(e);
                addedElems.push(e.pair);
            }
            addedElems = addedElems.concat(addDuplexBySeq(e, sequence.substring(1),tmpSys, "n3", "n5", 1));
        } else {
            addedElems = addedElems.concat(addElementsBySeq(e, sequence.substring(1), tmpSys, "n3", "n5", 1));
        }
        strand.updateEnds();

        // Make created strand(s) a new cluster, for convenience.
        clusterCounter++;
        addedElems.forEach(e=>e.clusterId=clusterCounter);

        return addedElems;
    }

    /**
     * Experimental Function that Discretizes Density of system (every selected particle has same mass currently 1)
     */
    export function discretizeDensity(elems: BasicElement[], dd: number, cellsize: number) {
        //cellsize must be in Angstroms as we convert it here
        cellsize /= 8.518; //Angstrom to sim unit length
        // get positions from Three Vector returned from getPos()
        let Positions : THREE.Vector3[] = elems.map(e => e.getPos());
        let [xPositions, yPositions, zPositions] = [elems.map(e => e.getPos().x), elems.map(e => e.getPos().y), elems.map(e => e.getPos().z)]
        // let xPositions : number[] = elems.map(e => e.getPos().x);
        // let yPositions : number[] = elems.map(e => e.getPos().y);
        // let zPositions : number[] = elems.map(e => e.getPos().z);

        // let xmax : number = 0, xmin : number = 0;
        // let ymax : number = 0, ymin : number = 0;
        // let zmax : number = 0, zmin : number = 0;

        // Useful for building 3d Grid
        let [xmax, xmin, ymax, ymin, zmax, zmin] = [Math.max(...xPositions),  Math.min(...xPositions), Math.max(...yPositions),
                                                    Math.min(...yPositions), Math.max(...zPositions), Math.min(...zPositions)];
        // xmin = Math.min(...xPositions);
        // ymax = Math.max(...yPositions);
        // ymin = Math.min(...yPositions);
        // zmax = Math.max(...zPositions);
        // zmin = Math.min(...zPositions);

        // // Assign boxids based off position in the grid
        // let xboxids : number[] = [];
        // let yboxids : number[] = [];
        // let zboxids : number[] = [];
        // let elemids : number[] = [];
        // let xGridNum: number = Math.ceil((xmax - xmin)/dd);
        // let yGridNum: number = Math.ceil((ymax - ymin)/dd);
        // let zGridNum: number = Math.ceil((zmax - zmin)/dd);

        // let dd = 0.1; //step size of density box in sim units
        // Numbers for looping through boxids
        let [xGridNum, yGridNum, zGridNum] = [Math.ceil((xmax - xmin)/dd),  Math.ceil((ymax - ymin)/dd), Math.ceil((zmax - zmin)/dd)]
        let griddim = [xGridNum, yGridNum, zGridNum];



        let density_grid = new Array(xGridNum);
        for(let i = 0; i < xGridNum; i++){
            density_grid[i] = new Array(yGridNum);
        }
        for(let i = 0; i < xGridNum; i++){
            for(let j = 0; j < yGridNum; j++){
                density_grid[i][j] = new Array(zGridNum);
            }
        }
        for(let i = 0; i < xGridNum; i++){
            for(let j = 0; j < yGridNum; j++){
                for(let k = 0; k < zGridNum; k++) {
                    density_grid[i][j][k] = 0;
                }
            }
        }

        // density_grid.map(x => {return new Array(yGridNum)}); // 2nd dim
        // density_grid.forEach(x=> x.map(y=> {return new Array(zGridNum)})) //3rd dim
        // 3d grid density_grid[xbin][ybin][zbin] = x

        // default particle density for particles of the selected system
        let defRadius = 1;
        let defDensity = 1; // sim units

        // get 3d slice as well as coordinates
        let get_subbox = function(xc, yc, zc, rad) : [number[], number[], number[]]{ //returns slice of density_array (rad**3) and its center
            // minimum of subbox
            let n = [xc, yc, zc].map((e, eid) => {
                if (e-rad < 0) {
                    return 0;
                }else {
                    return e - rad;
                }
            });
            // maximum of subbox
            let m = [xc, yc, zc].map((e, eid)=>{
                if (e+rad>griddim[eid]-1) {
                    return griddim[eid]-1;
                } else {
                    return e+rad;
                }
            })

            // center
            let center = [(m[0]-n[0])/2, (m[1]-n[1])/2, (m[2]-n[2])/2]
            // let subbox = density_grid.slice(n[0], m[0]).map(y => y.slice(n[1], m[1]).map(z => z.slice(n[2], m[2])));
            return [center, n, m]
        }

        // Fill grid Function, adds 1 density for any point in sphere of default radius/ default spacing
        let add_density = function(xc, yc, zc){
            let bn_rad = defRadius/dd; // simunits/simunits
            let [center, min, max] = get_subbox(xc, yc, zc, bn_rad);
            let [cx, cy, cz] = center;
            for(let i = min[0]; i < max[0]; i++){
                for(let j = min[1]; j < max[1]; j++){
                    for(let k = min[2]; k < max[2]; k++){
                        let dist = Math.sqrt((i-cx)**2 + (j-cy)**2 + (k-cz)**2)
                        if(dist <= bn_rad){
                            density_grid[min[0]+i][min[1]+j][min[2]+k] += defDensity
                        }
                    }
                }
            }
            // subbox.forEach(x => x.forEach(y => y.forEach(z => { //for each x,y,z in subbox
            //     // get distance of each point from center
            //     let dist = Math.sqrt((x-cx)**2 + (y-cy)**2 + (z-cz)**2)
            //     if(dist <= bn_rad){
            //         density_grid[min[0]+x][min[1]+y][min[2]+z] += defDensity
            //     }
            // })))
        }

        let elem_boxids = Positions.map(V=>{
            return [Math.floor((V.x-xmin)/dd), Math.floor((V.y-ymin)/dd), Math.floor((V.z-zmin)/dd)];
        })

        // fill density grid with particles
        elem_boxids.forEach(eid => add_density(eid[0], eid[1], eid[2]))

        // make 1d representation for easier looping and working with large arrays
        let density_flat = new Array(xGridNum*yGridNum*zGridNum);
        for (let i = 0; i < xGridNum; i+=1) {
            for (let j = 0; j < yGridNum; j += 1) {
                for (let k = 0; k < zGridNum; k += 1) {
                    density_flat[i + xGridNum * j + xGridNum * yGridNum * k]=density_grid[i][j][k];
                }
            }
        }


        // convert 1d to 3d index
        let onetothree = function(index){
            let zv = Math.floor(index/(xGridNum*yGridNum));
            let tmp = index - (zv*xGridNum*yGridNum);
            let yv = Math.floor(tmp/ xGridNum);
            let xv = tmp % xGridNum;
            return [xv, yv, zv];
        }
        // convert 3d to 1d index
        let threetoone = function(xi, yi, zi){
            return xi + xGridNum * yi + xGridNum * yGridNum * zi;
        }

        let test = 1024;
        let [xt, yt, zt] = onetothree(test);
        let ret = threetoone(xt, yt, zt);



        let placeParticle1D =  function(placementindex, particle_radius, value){
            let effrad = Math.floor(particle_radius/dd)
            let tworad = effrad*2;
            let [xc, yc, zc] = onetothree(placementindex);

            let [center, min, max] = get_subbox(xc, yc, zc, tworad);
            let [cx, cy, cz] = center;
            for(let i = min[0]; i < max[0]; i++){
                for(let j = min[1]; j < max[1]; j++){
                    for(let k = min[2]; k < max[2]; k++){
                        let dist = Math.sqrt((i-cx)**2 + (j-cy)**2 + (k-cz)**2)
                        if(dist <= effrad){
                            density_flat[threetoone(min[0]+i,min[1]+j, min[2]+k)] -= value;
                        } else if (dist > tworad) {
                            // density_flat[threetoone(min[0]+x,min[1]+y, min[2]+z)] -= 0.2*1;
                        } else { // [effrad, tworad]
                            density_flat[threetoone(min[0]+1,min[1]+2, min[2]+3)] -= 0.25*value;
                        }
                    }
                }
            }
        }


        let pos = density_flat.filter(function (a) {return a>= 0;})
        let postotal = pos.reduce(function(a,b) {return a+b;})

        let tol = 10;
        // use the 3d grid to iterate through
        // use the 1d for finding highest density
        let placedParticles = [];
        while (postotal > tol){
            let target_rad = cellsize;
            // find max
            let max = density_flat.reduce(function(a, b) {return Math.max(a, b);});
            // get index of max
            let oned = density_flat.indexOf(max);
            //Place particle in grid, subtracts density from density flat
            placeParticle1D(oned, target_rad, max)
            // get 3d index
            let threeD = onetothree(oned);
            // get max val of placement
            threeD.push(max)
            placedParticles.push(threeD);

            pos = density_flat.filter(function (a) {return a>= 0;})
            postotal = pos.reduce(function(a,b) {return a+b;})
        }

        // sphere on density_grid indices, anything in placed particle sphere get indexed for that particle
        // need to back out which particles are represented by the placed particles
        let assignIndices = function(placed){
            let indices = placed.map(function (a) {return [];});
            placed.forEach((a, aindx) => {
                let [x, y, z, d] = a;
                let target_rad = cellsize;
                let [center, min, max] = get_subbox(x, y, z, target_rad)
                let in_rad = elem_boxids.filter(function(indx){
                    if(min[0]<=indx[0] && indx[0]<=max[0]) { // keep elements with correct x dim index
                        if(min[1]<=indx[1] && indx[1]<=max[1]){ // keep elements with correct y dim index
                            if(min[2]<=indx[2] && indx[2]<=max[2]){ // keep elements with correct z dim index
                                // keeps elements within radius of the placed particle
                                return (indx[0] - center[0]) ** 2 + (indx[1] - center[1]) ** 2 + (indx[2] - center[2]) ** 2 < target_rad;
                            } else return false;
                        } else return false;
                    } else {
                        return false;
                    }
                })

                // get indices of filtered bases
                indices[aindx] = in_rad.map(function(indx){
                    return elem_boxids.indexOf(indx);
                })
            })

            return indices;
        }

        let indexfile = assignIndices(placedParticles)


        let gPositions = placedParticles.map(indx => {
            return new THREE.Vector3(indx[0]*dd, indx[1]*dd, indx[2]*dd)
        });
        let gMasses = placedParticles.map(indx => {
            return indx[3];
        })

        // let elemIndx : number = 0;
        // elems.forEach(elem => {
        //         let xbid : number = Math.floor((elem.getPos().x - xmin)/cellsize);
        //         let ybid : number = Math.floor((elem.getPos().y - ymin)/cellsize);
        //         let zbid : number = Math.floor((elem.getPos().z - zmin)/cellsize);
        //         xboxids.push(xbid);
        //         yboxids.push(ybid);
        //         zboxids.push(zbid);
        //         elemids.push(elemIndx);
        //         elemIndx +=1;
        //     }
        // )

        // // Numbers for looping through boxids
        // let xGridNum: number = Math.ceil((xmax - xmin)/cellsize);
        // let yGridNum: number = Math.ceil((ymax - ymin)/cellsize);
        // let zGridNum: number = Math.ceil((zmax - zmin)/cellsize);

        // New Particle Arrays
        // let gPositions : THREE.Vector3[] = [];

        // let gMasses: number [] = [];
        // let indexfile = [];
        // let currentBox: number[] = [];

        // //Sort through boxids and generate array for intialization of new particles
        // for (let i = 0; i < xGridNum; i+=1) {
        //     for (let j = 0; j < yGridNum; j += 1) {
        //         for (let k = 0; k < zGridNum; k += 1) {
        //             //returns only boxid entries matching the current i, j, k
        //             currentBox = [];
        //
        //             for(let p: number = 0; p < xboxids.length; p++){
        //                 if(xboxids[p]==i && yboxids[p]==j && zboxids[p]==k){
        //                     currentBox.push(elemids[p])
        //                 }
        //             }
        //
        //             //If any particle in this section of the grid
        //             if (currentBox.length > 0) {
        //                 indexfile.push(currentBox);
        //                 let m = currentBox.length;
        //                 let com = new THREE.Vector3(0, 0, 0);
        //                 for (let l = 0; l < m; l += 1) {
        //                     com.add(elems[currentBox[l]].getPos());
        //                 }
        //                 com = com.divideScalar(m);
        //                 gPositions.push(com.clone());
        //                 gMasses.push(m);
        //             }
        //         }
        //     }
        // }

        // Now I need to Return the New System
        //dummy system
        let dumb = new System(tmpSystems.length, 0);
        dumb.initInstances(gPositions.length);
        tmpSystems.push(dumb);

        let currentelemsize = elements.size;
        let realSys = new System(sysCount++, currentelemsize);
        realSys.initInstances(0);
        systems.push(realSys);
        addSystemToScene(realSys);

        let gstrand = realSys.addNewGenericSphereStrand();
        let newElems: GenericSphere[] = [];
        let last;
        for(let i: number = 0; i < gPositions.length; i++) {
            let be = gstrand.createBasicElement(currentelemsize + i);
            elements.push(be);
            be.sid = i;
            be.dummySys = dumb;
            be.setType('gs');
            be.n5 = null;
            if(i != 0) {
                let prev = newElems[i-1];
                be.n3 = prev;
                prev.n5 = be;
            } else {
                be.n3 = null;
            }
            be.strand = gstrand;
            be.mass = gMasses[i];
            newElems.push(be);
            last = be;
        }
        gstrand.setFrom(last);

        newElems.forEach((e, eid) => {
            e.calcPositions(gPositions[eid]);
        })

        addSystemToScene(dumb); // add tmpSys to scene

        return {elems: newElems, indx: indexfile};
    }

    /**
     * Experimental Function that Discretizes Mass of system (every particle has same mass currently 1)
     */
    export function discretizeMass(elems: BasicElement[], cellsize: number) {
        //cellsize must be in Angstroms as we convert it here
        cellsize /= 8.518; //Angstrom to sim unit length
        // get positions from Three Vector returned from getPos()
        let xPositions : number[] = elems.map(e => e.getPos().x);
        let yPositions : number[] = elems.map(e => e.getPos().y);
        let zPositions : number[] = elems.map(e => e.getPos().z);

        let xmax : number = 0, xmin : number = 0;
        let ymax : number = 0, ymin : number = 0;
        let zmax : number = 0, zmin : number = 0;

        // Useful for building 3d Grid
        xmax = Math.max(...xPositions);
        xmin = Math.min(...xPositions);
        ymax = Math.max(...yPositions);
        ymin = Math.min(...yPositions);
        zmax = Math.max(...zPositions);
        zmin = Math.min(...zPositions);

        // Assign boxids based off position in the grid
        let xboxids : number[] = [];
        let yboxids : number[] = [];
        let zboxids : number[] = [];
        let elemids : number[] = [];

        let elemIndx : number = 0;
        elems.forEach(elem => {
                let xbid : number = Math.floor((elem.getPos().x - xmin)/cellsize);
                let ybid : number = Math.floor((elem.getPos().y - ymin)/cellsize);
                let zbid : number = Math.floor((elem.getPos().z - zmin)/cellsize);
                xboxids.push(xbid);
                yboxids.push(ybid);
                zboxids.push(zbid);
                elemids.push(elemIndx);
                elemIndx +=1;
            }
        )

        // Numbers for looping through boxids
        let xGridNum: number = Math.ceil((xmax - xmin)/cellsize);
        let yGridNum: number = Math.ceil((ymax - ymin)/cellsize);
        let zGridNum: number = Math.ceil((zmax - zmin)/cellsize);

        // New Particle Arrays
        let gPositions : THREE.Vector3[] = [];
        let gMasses: number [] = [];
        let indexfile = [];
        let currentBox: number[] = [];

        //Sort through boxids and generate array for intialization of new particles
        for (let i = 0; i < xGridNum; i+=1) {
            for (let j = 0; j < yGridNum; j += 1) {
                for (let k = 0; k < zGridNum; k += 1) {
                    //returns only boxid entries matching the current i, j, k
                    currentBox = [];

                    for(let p: number = 0; p < xboxids.length; p++){
                        if(xboxids[p]==i && yboxids[p]==j && zboxids[p]==k){
                            currentBox.push(elemids[p])
                        }
                    }

                    //If any particle in this section of the grid
                    if (currentBox.length > 0) {
                        indexfile.push(currentBox);
                        let m = currentBox.length;
                        let com = new THREE.Vector3(0, 0, 0);
                        for (let l = 0; l < m; l += 1) {
                            com.add(elems[currentBox[l]].getPos());
                        }
                        com = com.divideScalar(m);
                        gPositions.push(com.clone());
                        gMasses.push(m);
                    }
                }
            }
        }

        // Now I need to Return the New System
        //dummy system
        let dumb = new System(tmpSystems.length, 0);
        dumb.initInstances(gPositions.length);
        tmpSystems.push(dumb);

        let currentelemsize = elements.size;
        let realSys = new System(sysCount++, currentelemsize);
        realSys.initInstances(0);
        systems.push(realSys);
        addSystemToScene(realSys);

        let gstrand = realSys.addNewGenericSphereStrand();
        let newElems: GenericSphere[] = [];
        let last;
        for(let i: number = 0; i < gPositions.length; i++) {
            let be = gstrand.createBasicElement(currentelemsize + i);
            elements.push(be);
            be.sid = i;
            be.dummySys = dumb;
            be.setType('gs');
            be.n5 = null;
            if(i != 0) {
                let prev = newElems[i-1];
                be.n3 = prev;
                prev.n5 = be;
            } else {
                be.n3 = null;
            }
            be.strand = gstrand;
            be.mass = gMasses[i];
            newElems.push(be);
            last = be;
        }
        gstrand.setFrom(last);

        newElems.forEach((e, eid) => {
            e.calcPositions(gPositions[eid]);
        })

        addSystemToScene(dumb); // add tmpSys to scene

        return {elems: newElems, indx: indexfile};
    }

    /**
     * Creates complementary base pair for an element.
     * @param elem
     */
    export function createBP(elem: Nucleotide, undoable?: boolean): Nucleotide {
        if (elem.findPair()) {
            notify("Element already has a base pair")
            return;
        }
        // Similar to createStrand
        // Initialize dummy system to put the monomer in
        const tmpSys = new System(tmpSystems.length, 0);
        tmpSys.initInstances(1);
        tmpSystems.push(tmpSys);
        
        const strand = elem.getSystem().addNewNucleicAcidStrand();

        // Add element and assign id
        let e: Nucleotide;
        if (elem.isDNA()) {
            e = new DNANucleotide(undefined, strand);
        } else if (elem.isRNA()) {
            e = new RNANucleotide(undefined, strand);
        }
        elements.push(e);
        e.dummySys = tmpSys;
        e.sid = 0;
        e.setType(elem.getComplementaryType());
        e.n3 = null;
        e.n5 = null;
        e.pair = elem;
        elem.pair = e;
        e.strand = strand;
        strand.setFrom(e);
        
        const cm = elem.getPos();
        const a1 = elem.getA1();
        const a3 = elem.getA3();

        // calculate position of base pair
        a1.negate();
        a3.negate();
        const pos: THREE.Vector3 = cm.clone().sub(a1.clone().multiplyScalar(1.2));
        e.calcPositions(pos, a1, a3, true);
        e.dummySys = tmpSys;

        addSystemToScene(tmpSys);

        // Add to history, but we only want this if it is a atomic edit
        if (undoable) {
            const instanceCopy = [new InstanceCopy(e)];
            const newCm = e.getPos();
            const position = new THREE.Vector3(newCm.x, newCm.y, newCm.z);
            editHistory.add(new RevertableAddition(instanceCopy, [e], position));
        }
        topologyEdited = true;

        return e;
    }

    /**
     * Copies the instancing data from a particle to a new system
     * @param source Element to copy from
     * @param id The element's system ID
     * @param destination Destination system
     */
    function copyInstances(source:BasicElement, id:number, destination:System) {
        destination.fillVec('cmOffsets', 3, id, source.getInstanceParameter3('cmOffsets').toArray());
        destination.fillVec('bbOffsets', 3, id, source.getInstanceParameter3('bbOffsets').toArray()); 
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

    /**
     * Connects two 3' handles by a duplex of provided sequence.
     * @param strand1 first  strand having the overhang
     * @param strand2 second strand having the overhang
     * @param the sequence of the duplex strand
     */
    export function interconnectDuplex3p(strand1: Strand, strand2 : Strand, patch_sequence = "GGGGGGGGG"){
        let cmss = [];
        [strand1,strand2].forEach(strand=>{
            let cms = new THREE.Vector3();
            let l=0
            strand.forEach(base =>{
                cms.add(base.getPos());
                l+=1;
            });
            cms.divideScalar(l);
            cmss.push(cms);
        }); // find their cms
     
        let npos = new THREE.Vector3().copy(cmss[0]);
        npos.add(cmss[1]);
        npos.divideScalar(2);
        
        let duplex_strands = new Set();
        let elems =  edit.createStrand(patch_sequence, true) ;
        let ecms = new THREE.Vector3();
        elems.forEach(e =>{
            ecms.add(e.getPos());
            duplex_strands.add(e.strand);
        });
        ecms.divideScalar(elems.length); 
     
        translateElements(new Set(elems),  new THREE.Vector3().copy(npos).sub(ecms));
     
        edit.ligate( // connect first strand
            strand2.end3,
            ([... duplex_strands][0] as Strand).end5
        );
        
        edit.ligate( // connect second strand
            strand1.end3,
            ([... duplex_strands][1] as Strand).end5
        );
    }

    /**
     * Connects two 5' handles by a duplex of provided sequence.
     * @param strand1 first  strand having the overhang
     * @param strand2 second strand having the overhang
     * @param the sequence of the duplex strand
     */
         export function interconnectDuplex5p(strand1: Strand, strand2 : Strand, patch_sequence = "GGGGGGGGG"){
            let cmss = [];
            [strand1,strand2].forEach(strand=>{
                let cms = new THREE.Vector3();
                let l=0
                strand.forEach(base =>{
                    cms.add(base.getPos());
                    l+=1;
                });
                cms.divideScalar(l);
                cmss.push(cms);
            }); // find their cms
         
            let npos = new THREE.Vector3().copy(cmss[0]);
            npos.add(cmss[1]);
            npos.divideScalar(2);
            
            let duplex_strands = new Set();
            let elems =  edit.createStrand(patch_sequence, true) ;
            let ecms = new THREE.Vector3();
            elems.forEach(e =>{
                ecms.add(e.getPos());
                duplex_strands.add(e.strand);
            });
            ecms.divideScalar(elems.length); 
         
            translateElements(new Set(elems),  new THREE.Vector3().copy(npos).sub(ecms));
         
            edit.ligate( // connect first strand
                strand1.end5,
                ([... duplex_strands][0] as Strand).end3
            );
            
            edit.ligate( // connect second strand
                strand2.end5,
                ([... duplex_strands][1] as Strand).end3
            );
        }
}
