/// <reference path="../typescript_definitions/index.d.ts" />

class PatchyTopReader extends FileReader{
    topFile: File = null;
    system: System;
    elems: ElementMap;

    sidCounter = 0;
    nucLocalID: number = 0;
    lastStrand: number; //strands are 1-indexed in oxDNA .top files
    n3: number;
    callback : Function;
    configurationLength : number;

    constructor(topFile: File, system: System, elems: ElementMap, callback : Function){
        super();
        this.topFile = topFile;
        this.system = system;
        this.elems = elems;
        this.callback = callback;

    }
    onload = ((f) => {
        return () => {
            let nucCount = this.elems.getNextId();
            let file = this.result as string
            let lines = file.split(/[\n]+/g);
            
            this.configurationLength = parseInt(lines[0].split(" ")[0]);
            lines = lines.slice(1); // discard the header as we have the info now

            
            let currentStrand = this.system.addNewGenericSphereStrand();

            lines[0].split(" ").forEach((t,i)=>{
                if(t){
                    let sphere = currentStrand.createBasicElement(nucCount+i);
                    sphere.sid = this.sidCounter++;
                    sphere.id = i;
                    this.elems.set(nucCount+i, sphere);

                    if(!currentStrand.end3)
                        currentStrand.end3 = sphere;
                    currentStrand.end5 = sphere;

                    sphere.type = t;
                    sphere.mass = 10; //TODO : figure out a nice way to reason about the scale of the patchy particles
                    sphere.clusterId = clusterCounter;

                }
            });

            let particle = this.elems.get(nucCount);
            particle.n5 = this.elems.get(nucCount+1);
            for(let i = 1; i < this.configurationLength - 1; i++){
                let particle =  this.elems.get(nucCount+i);
                particle.n3 =  this.elems.get(nucCount + i -1);
                particle.n5 =  this.elems.get(nucCount + i +1);
            }
            particle = this.elems.get(nucCount + this.configurationLength -1);
            particle.n3 = this.elems.get(nucCount + this.configurationLength -2);



            //let strID = parseInt(l0[0]); //proteins are negative indexed
            //this.lastStrand = strID;
            //let currentStrand: Strand = this.system.createStrand(strID);
            //this.system.addStrand(currentStrand);
            
            // create empty list of elements with length equal to the topology
            // Note: this is implemented such that we have the elements for the DAT reader 
            //let nuc: BasicElement;//DNANucleotide | RNANucleotide | AminoAcid;
            //for (let j = 0; j < lines.length; j++) {
            //    this.elems.set(nucCount+j, nuc);
            //}

            // Create new cluster for loaded structure:
            let cluster = ++clusterCounter;
            
//            lines.forEach((line, i) => {
//            if (line == "") {
//                    // Delete last element
//                    this.configurationLength -= 1;
//                    this.elems.delete(this.elems.getNextId()-1);
//                    return;
//                }
//                //split the file and read each column, format is: "strID base n3 n5"
//                let l = line.split(" "); 
//                strID = parseInt(l[0]);
//                    
//                if (strID != this.lastStrand) { //if new strand id, make new strand                        
//                    currentStrand = this.system.createStrand(strID);
//                    this.system.addStrand(currentStrand);
//                    this.nucLocalID = 0;
//                };
//                    
//                //create a new element
//                if (!this.elems.get(nucCount + i))
//                    this.elems.set(nucCount + i, currentStrand.createBasicElement(nucCount + i));
//                let nuc = this.elems.get(nucCount + i);
//
//                // Set systemID
//                nuc.sid = this.sidCounter++;
//
//                // Set cluster id;
//                nuc.clusterId = cluster;
//
//                //create neighbor 3 element if it doesn't exist
//                let n3 = parseInt(l[2]);
//                if (n3 != -1) {
//                    if (!this.elems.get(nucCount + n3)) {
//                        this.elems.set(nucCount + n3, currentStrand.createBasicElement(nucCount + n3));
//                    }
//                    nuc.n3 = this.elems.get(nucCount + n3);
//                }
//                else {
//                    nuc.n3 = null;
//                    currentStrand.end3 = nuc;
//                }
//
//                //create neighbor 5 element if it doesn't exist
//                let n5 = parseInt(l[3]);
//                if (n5 != -1) {
//                    if (!this.elems.get(nucCount + n5)) {
//                        this.elems.set(nucCount + n5, currentStrand.createBasicElement(nucCount + n5));
//                    }
//                    nuc.n5 = this.elems.get(nucCount + n5);
//                }
//                else {
//                    nuc.n5 = null;
//                    currentStrand.end5 = nuc;
//                }
//
//                let base = l[1]; // get base id
//                nuc.type = base;
//                //if we meet a U, we have an RNsibleA (its dumb, but its all we got)
//                //this has an unfortunate side effect that the first few nucleotides in an RNA strand are drawn as DNA (before the first U)
//                if (base === "U") RNA_MODE = true;
//                    
//                this.nucLocalID += 1;
//                this.lastStrand = strID;
//            });
            nucCount = this.elems.getNextId();
            // usually the place where the DatReader gets fired
            this.callback();

        }})(this.topFile);
    
    read(){
        this.readAsText(this.topFile);
    }
}
