/// <reference path="../typescript_definitions/index.d.ts" />

let dbinfo = localStorage.getItem("plateDB")
let plateDB = dbinfo? JSON.parse(dbinfo): {};
dbinfo=null; //free pointer


const loadPlateDBimport = ()=>{
    // register 1st drop event 
    let msg = document.getElementById("parameterDropId");
    msg.addEventListener("drop", (event)=>{
        event.preventDefault();
        const files = event.dataTransfer.files;
        handlePlateDBDrop(files);
    }, false);

    msg.addEventListener("dragover", event_plug, false);
    msg.addEventListener("dragenter",event_plug, false);
    msg.addEventListener("dragexit", event_plug, false);
}

const handlePlateDBDrop = (files)=>{
    for(let i = 0; i < files.length; i++){
        let reader = new FileReader();
        reader.onload = () => {
            let file_data = reader.result as string;
            let json_data = JSON.parse(file_data);
            //we do this very conservatively, we only add the data if it is not already in the DB
            for(const [plate, seqs] of Object.entries(json_data)){
                if(!(plate in plateDB)){
                    console.log("adding plate");
                    plateDB[plate] = seqs;
                }
            }
            ////update local storage
            localStorage.setItem("plateDB", JSON.stringify(plateDB));
            console.log("plateDB updated");
        };
        reader.readAsText(files[i]);
    }
}

// we'll follow the following logic
// - if we have anything in selectedBases fetch this as the info
// - if by origami flag is passed we'll handle the split by origami
// - dump the info for the entire scene 
// note, we have to preserve stochiometry

const fetchStrandInfo = (strands:Strand[])=>{
    let positions = [];
    strands.forEach(strand=>{
        // we check the strand sequence
        let seq = strand.getSequence();
        let position = [];
        // against any record in the db
        for(const [plate, seqs] of Object.entries(plateDB)){
            if(seqs.hasOwnProperty(seq)){
                position.push(
                    [plate, seqs[seq]]
                );
            }
        }
        // as a result orphaned sequences will have [] as their position 
        // and we have to sort out multiple hits later  
        positions.push(position);
    });
    return positions;
}

const highlightOrfans = (strands:Strand[], positions)=>{
    for(let i=0; i<strands.length; i++){
        // we leave out the scaffolds for now 
        if(positions[i].length==0 && strands[i].getLength()<1000){
            api.selectElements(strands[i].getMonomers(),true);
        }
    }
    //propagate to scene
    render();
}

const groupByPlate = (strands:Strand[], positions)=>{
    let plate_list = {};
    let orphan_list : Strand[]= new Array<Strand>();
    for(let i=0; i<strands.length;i++){
        let strand = strands[i];
        let position = positions[i]; 
        // if we at least one position to handle
        if(position.length>0){
            let [plate,location] = position[0]; // for now we are not handling alternative locations
            if(!plate_list.hasOwnProperty(plate)) // define the plate if not in our list
                plate_list[plate]={};
            if(!plate_list[plate].hasOwnProperty(location)) // add a location
                plate_list[plate][location] = 1;
            else
                plate_list[plate][location]++;
        }
        else//we found an orphan 
            orphan_list.push(strand);
    }
    return [plate_list, orphan_list];
}


const formatPlate = (plate)=>{
    //plate_list {plate_name:locations}
    //locations {A : count}
    const letters = ["A","B","C","D","E","F","G","H"];
    const indices =[1,2,3,4,5,6,7,8,9,10,11,12];  
    let out_lines = [];
    //define header
    out_lines.push('<table class="plate96"><tr> <th> &nbsp; </th>');
    out_lines.push('<th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th><th>11</th><th>12</th></tr>')
    
    letters.forEach(l=>{
        out_lines.push('<tr>');
        out_lines.push('<td> <b>'+l+'</b> </td>');
        indices.forEach(i=>{
            let key=l+i.toString();
            //set either full or empty with count
            if(plate.hasOwnProperty(key)){
                let count = plate[key];
                let filler = count>1 ? count.toString() : '&nbsp;';
                out_lines.push(
                    '<td class="full">'+filler+'</td>'
                );
            }
            else
                out_lines.push(
                    '<td class="empty">&nbsp;</td>'
                );

            
        });
        out_lines.push('</tr>');
    });

    //cloasing footer 
    out_lines.push('</table>');

    return out_lines.join("");
};

const formatPlateList = (plate_list)=>{
    let out = [];
    for(const [plate_name, plate] of Object.entries(plate_list)){
        out.push('<p><b>'+plate_name+'</b></p>');
        out.push(
            formatPlate(plate)
        );
    }
    return out.join("");
}
const formatOrphanList = (orphans)=>{
    let out = [];
    out.push('<p><b>Orphans:</b><p>');
    clearSelection();
    out.push('<ul>');
    orphans.forEach(orf => {
        // exclude scaffolds for now
        if(orf.getLength()<250){
            out.push('<li>'+orf.getSequence()+'</li>');
            api.selectElements(orf.getMonomers(),true);
        }
    });
    out.push('</ul>');
    return out.join("");
}

const reportSummary = ()=>{
    let reportWindow = document.getElementById("reportWindow");
    let selectedStrands = new Set<Strand>();
    selectedBases.forEach(b=>{
        selectedStrands.add(b.strand);
    });
    let strands = Array.from(selectedStrands);
    strands = strands.length>0 ? strands:systems[0].strands;
    let positions = fetchStrandInfo(strands);
    let [plate_list,orphans] = groupByPlate(strands,positions);
    let plate_info = formatPlateList(plate_list);
    let orph_info = formatOrphanList(orphans);
    reportWindow.innerHTML = plate_info+orph_info;
}

const printReport = (elem:string)=>{
    //https://stackoverflow.com/questions/2255291/print-the-contents-of-a-div
    const plate_style = `
    <style>
    /* 96 well plate table definitions */
    table.plate96{
        width: 390px;   /* needs to be number of colls multiplied by cell width */
        height:270px;   /* needs to be number or rows multiplied by cell height */
        table-layout: fixed;
        border-collapse: expand;
        /*border: 1px solid black;*/
    
    }
    
    /* make table with fixed cell size */
    table.plate96 td tr th {
        width: 30px;
        height:30px;
        overflow: hidden;
        display: inline-block;
        white-space: nowrap;
    }
    
    /* filled wells color*/
    td.full {
        background : #00FF00;
        border-radius: 15px;
    }
    /* empty wells color */
    td.empty {
        background : lightgrey;
        border-radius: 15px;
    }
    </style>
    `;

    var report = window.open('', 'PRINT', 'height=400,width=600');
    report.document.write(plate_style);
    report.document.write('<html><head><title>' + document.title  + '</title>');
    report.document.write('</head><body >');
    report.document.write('<h1>' + document.title  + '</h1>');
    report.document.write(document.getElementById(elem).innerHTML);
    report.document.write('</body></html>');
    report.document.close(); // necessary for IE >= 10
    report.focus(); // necessary for IE >= 10*/
    report.print();
    report.close();
    return true;
}