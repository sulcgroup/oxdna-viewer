/// <reference path="../typescript_definitions/index.d.ts" />
let plateDB = {
    "plates": {},
    "free_tubes": {}
};
let startupPlateDB = () => {
    plateDB = JSON.parse(localStorage.getItem("plateDB"));
};
let loadPlateDBimport = () => {
    // register 1st drop event 
    let msg = document.getElementById("parameterDropId");
    msg.addEventListener("drop", (event) => {
        event.preventDefault();
        const files = event.dataTransfer.files;
        console.log(files);
        handlePlateDBDrop(files);
        //document.getElementById("chartContainer").hidden = false;
        //msg.hidden = true;
    }, false);
    msg.addEventListener("dragover", event_plug, false);
    msg.addEventListener("dragenter", event_plug, false);
    msg.addEventListener("dragexit", event_plug, false);
};
let handlePlateDBDrop = (files) => {
    for (let i = 0; i < files.length; i++) {
        console.log(files[i]);
        let reader = new FileReader();
        reader.onload = () => {
            let file_data = reader.result;
            let json_data = JSON.parse(file_data);
            //we do this very conservatively, we only add the data if it is not already in the DB
            //console.log(json_data);
            for (const [plate, seqs] of Object.entries(json_data)) {
                console.log(plate);
                //console.log(seqs);
                if (!(plate in plateDB["plates"])) {
                    console.log("adding plate");
                    plateDB["plates"][plate] = seqs;
                }
            }
            //
            ////update local storage
            localStorage.setItem("plateDB", JSON.stringify(plateDB));
            console.log(plateDB);
        };
        reader.readAsText(files[i]);
    }
};
