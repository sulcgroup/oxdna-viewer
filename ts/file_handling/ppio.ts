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
    LORO: boolean;

    constructor(topFile: File, system: System, elems: ElementMap, callback : Function){
        super();
        this.topFile = topFile;
        this.system = system;
        this.elems = elems;
        this.callback = callback;
        this.LORO = false; 
        if(this.topFile.name.toLowerCase().includes("loro")) {
            this.LORO = true;
        }    
    }
    onload = ((f) => {
        return () => {
            let nucCount = this.elems.getNextId();

            let file = this.result as string
            let lines = file.split(/[\n]+/g);

            
            this.configurationLength = parseInt(lines[0].split(" ")[0]);
            lines = lines.slice(1); // discard the header as we have the info now

            if(!this.LORO){
                let currentStrand = this.system.addNewPatchySphereStrand();
                lines[0].split(" ").forEach((t,i)=>{
                    if(t){
                        let sphere = currentStrand.createBasicElement(nucCount+i);
                        sphere.sid = this.sidCounter++;
                        sphere.id = i;
                        this.elems.set(nucCount+i, sphere);

                        sphere.type = t;
                        sphere.clusterId = clusterCounter;

                    }
                });
            }
            else{
                let currentStrand = this.system.addNewPatchySphereStrand();
                lines.forEach((line, t)=>{
                    console.log(line)
                    let info = line.split(" ");
                    const pcount = parseInt(info[0]);
                    for(let i = pcount * t; i < pcount * (t+1); i++){

                        let sphere = currentStrand.createBasicElement(nucCount+i);
                        sphere.sid = this.sidCounter++;
                        sphere.id = nucCount+i;
                        this.elems.set(nucCount+i, sphere);

                        sphere.type = t.toString();
                        sphere.clusterId = clusterCounter;

                    }
                });
            }

            let particle = this.elems.get(nucCount);
            particle.n5 = this.elems.get(nucCount+1);
            for(let i = 1; i < this.configurationLength - 1; i++){
                let particle =  this.elems.get(nucCount+i);
                particle.n3 =  this.elems.get(nucCount + i -1);
                particle.n5 =  this.elems.get(nucCount + i +1);
            }
            particle = this.elems.get(nucCount + this.configurationLength -1);
            particle.n3 = this.elems.get(nucCount + this.configurationLength -2);


            // Create new cluster for loaded structure:
            let cluster = ++clusterCounter;
            nucCount = this.elems.getNextId();
            // usually the place where the DatReader gets fired
            this.callback();

        }})(this.topFile);
    
    read(){
        this.readAsText(this.topFile);
    }
}
