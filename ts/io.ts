/// <reference path="./three/index.d.ts" />

class TopReader extends FileReader{
    top_file: File;
    system: System;
    elements: BasicElement[];

    nuc_local_id: number = 0;
    last_strand: number; //strands are 1-indexed in oxDNA .top files
    neighbor3: number;


    constructor(top_file: File, system: System, elements: BasicElement[]){
        super();
        this.top_file = top_file;
        this.system = system;
        this.elements = elements;
    }
    onload = ((f) => {
        return (e) => {
            let file = this.result as string
            let lines = file.split(/[\n]+/g);
            lines = lines.slice(1); // discard the header
            
            let l0 = lines[0].split(" "); 
            let strID = parseInt(l0[0]); //proteins are negative indexed
            this.last_strand = strID;
            let current_strand: Strand = this.system.createStrand(strID);
            this.system.addStrand(current_strand);
            
            // create empty list of elements with length equal to the topology
            // Note: this is implemented such that we have the elements for the DAT reader 
            let nuc: BasicElement;//DNANucleotide | RNANucleotide | AminoAcid;
            for (let j = 0; j < lines.length; j++)  this.elements.push(nuc);
            
            lines.forEach((line, i) => {
                if (line == "") {
                    this.elements.pop();
                    return;
                }
                //split the file and read each column, format is: "strID base n3 n5"
                let l = line.split(" "); 
                strID = parseInt(l[0]);
                    
                if (strID != this.last_strand) { //if new strand id, make new strand                        
                    current_strand = this.system.createStrand(strID);
                    this.system.addStrand(current_strand);
                    this.nuc_local_id = 0;
                };
                    
                //create a new element
                if (this.elements[nucCount + i] == null || this.elements[nucCount + i] == undefined)
                    this.elements[nucCount + i] = current_strand.createBasicElement(nucCount + i);
                let nuc = this.elements[nucCount + i];
                nuc.lid = this.nuc_local_id;
                    
                //create neighbor 3 element if it doesn't exist
                let neighbor3 = parseInt(l[2]);
                if (neighbor3 != -1) {
                    if (this.elements[nucCount + neighbor3] == null || this.elements[nucCount + neighbor3] == undefined) {
                        this.elements[nucCount + neighbor3] = current_strand.createBasicElement(nucCount + neighbor3);
                    }
                    nuc.neighbor3 = this.elements[nucCount + neighbor3];
                }
                else 
                    nuc.neighbor3 = null;
        
                //create neighbor 5 element if it doesn't exist
                let neighbor5 = parseInt(l[3]);
                if (neighbor5 != -1) {
                    if (this.elements[nucCount + neighbor5] == null || this.elements[nucCount + neighbor5] == undefined) {
                        this.elements[nucCount + neighbor5] = current_strand.createBasicElement(nucCount + neighbor5);
                    }
                    nuc.neighbor5 = this.elements[nucCount + neighbor5];
                }
                else nuc.neighbor5 = null;
                    
                let base = l[1]; // get base id
                nuc.type = base;
                //if we meet a U, we have an RNA (its dumb, but its all we got)
                //this has an unfortunate side effect that the first few nucleotides in an RNA strand are drawn as DNA (before the first U)
                if (base === "U") RNA_MODE = true;
                    
                current_strand.addBasicElement(nuc);
                this.nuc_local_id += 1;
                this.last_strand = strID;
                    
                if (i == lines.length - 1) {
                    return;
                }; 
            });
            this.system.setDatFile(datFile); //store datFile in current System object
            systems.push(this.system); //add system to Systems[]
            nucCount = this.elements.length;
            conf_len = nucCount + 3;

            //set up instancing data arrays
            this.system.INSTANCES = this.system.systemLength();
            this.system.bbOffsets = new Float32Array(this.system.INSTANCES * 3);
            this.system.bbRotation = new Float32Array(this.system.INSTANCES * 4);
            this.system.nsOffsets = new Float32Array(this.system.INSTANCES * 3);
            this.system.nsRotation = new Float32Array(this.system.INSTANCES * 4)
            this.system.conOffsets = new Float32Array(this.system.INSTANCES * 3);
            this.system.conRotation = new Float32Array(this.system.INSTANCES * 4);
            this.system.bbconOffsets = new Float32Array(this.system.INSTANCES * 3);
            this.system.bbconRotation = new Float32Array(this.system.INSTANCES * 4);
            this.system.bbconScales = new Float32Array(this.system.INSTANCES * 3); 
            this.system.cmOffsets = new Float32Array(this.system.INSTANCES * 3);
            this.system.bbColors = new Float32Array(this.system.INSTANCES * 3);
            this.system.nsColors = new Float32Array(this.system.INSTANCES * 3)
            this.system.scales = new Float32Array(this.system.INSTANCES * 3);
            this.system.nsScales = new Float32Array(this.system.INSTANCES * 3);
            this.system.conScales = new Float32Array(this.system.INSTANCES * 3);
            this.system.visibility = new Float32Array(this.system.INSTANCES * 3);

            this.system.bbLabels = new Float32Array(this.system.INSTANCES * 3);


        }})(this.top_file);
    
    read(){
        this.readAsText(this.top_file);
    }
}