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
            
            let l0 = lines[0].split(" "); //split the file and read each column, format is: "str_id base n3 n5"
            let str_id = parseInt(l0[0]);
            this.last_strand = str_id;
            let current_strand: Strand = this.system.create_Strand(str_id);
            this.system.add_strand(current_strand);
            
            // create empty list of elements with length equal to the topology
            // Note: this is implemented such that we have the elements for the DAT reader 
            let nuc: BasicElement;//DNANucleotide | RNANucleotide | AminoAcid;
            for (let j = 0; j < lines.length; j++)  this.elements.push(nuc);
            
            lines.forEach((line, i) => {
                if (line == "") {
                    this.elements.pop();
                    return;
                }
                let l = line.split(" "); //split the file and read each column, format is: "str_id base n3 n5"
                str_id = parseInt(l[0]);
                    
                if (str_id != this.last_strand) { //if new strand id, make new strand                        
                    current_strand = this.system.create_Strand(str_id);
                    this.system.add_strand(current_strand);
                    this.nuc_local_id = 0;
                };
                    
                if (this.elements[nuc_count + i] == null || this.elements[nuc_count + i] == undefined)
                    this.elements[nuc_count + i] = current_strand.create_basicElement(nuc_count + i);
                let nuc = this.elements[nuc_count + i];
                nuc.local_id = this.nuc_local_id;
                    
                let neighbor3 = parseInt(l[2]);
                if (neighbor3 != -1) {
                    if (this.elements[nuc_count + neighbor3] == null || this.elements[nuc_count + neighbor3] == undefined) {
                        this.elements[nuc_count + neighbor3] = current_strand.create_basicElement(nuc_count + neighbor3);
                    }
                    nuc.neighbor3 = this.elements[nuc_count + neighbor3];
                }
                else 
                    nuc.neighbor3 = null;
        
                let neighbor5 = parseInt(l[3]);
                if (neighbor5 != -1) {
                    if (this.elements[nuc_count + neighbor5] == null || this.elements[nuc_count + neighbor5] == undefined) {
                        this.elements[nuc_count + neighbor5] = current_strand.create_basicElement(nuc_count + neighbor5);
                    }
                    nuc.neighbor5 = this.elements[nuc_count + neighbor5];
                }
                else nuc.neighbor5 = null;
                    
                let base = l[1]; // get base id
                nuc.type = base;
                //if we meet a U, we have an RNA (its dumb, but its all we got)
                if (base === "U") RNA_MODE = true;
                    
                current_strand.add_basicElement(nuc); //add nuc into Strand object
                this.nuc_local_id += 1;
                this.last_strand = str_id;
                    
                if (i == lines.length - 1) {
                    return;
                }; 
            });
            this.system.setDatFile(dat_file); //store dat_file in current System object
            systems.push(this.system); //add system to Systems[]
            nuc_count = this.elements.length;
            conf_len = nuc_count + 3;

            //set up instancing data arrays
            INSTANCES = nuc_count;
            bb_offsets = new Float32Array(INSTANCES * 3);
            bb_rotation = new Float32Array(INSTANCES * 4);
            ns_offsets = new Float32Array(INSTANCES * 3);
            ns_rotation = new Float32Array(INSTANCES * 4)
            con_offsets = new Float32Array(INSTANCES * 3);
            con_rotation = new Float32Array(INSTANCES * 4);
            bbcon_offsets = new Float32Array(INSTANCES * 3);
            bbcon_rotation = new Float32Array(INSTANCES * 4);
            bbcon_scales = new Float32Array(INSTANCES * 3); //we're going to set this to 0 if the con shouldn't exist. 
            bb_colors = new Float32Array(INSTANCES * 3);
            ns_colors = new Float32Array(INSTANCES * 3)
            scales = new Float32Array( INSTANCES * 3 );
            con_scales = new Float32Array(INSTANCES * 3)

        }})(this.top_file);
    
    read(){
        this.readAsText(this.top_file);
    }
}