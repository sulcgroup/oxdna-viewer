/// <reference path="../typescript_definitions/index.d.ts" />
let dbinfo = localStorage.getItem("plateDB");
let plateDB = dbinfo ? JSON.parse(dbinfo) : { plates: {}, sequences: {} };
//let startupPlateDB = ()=>{
//    plateDB = JSON.parse(localStorage.getItem("plateDB"));
//}
let loadPlateDBimport = () => {
    // register 1st drop event 
    let msg = document.getElementById("parameterDropId");
    msg.addEventListener("drop", (event) => {
        event.preventDefault();
        const files = event.dataTransfer.files;
        handlePlateDBDrop(files);
    }, false);
    msg.addEventListener("dragover", event_plug, false);
    msg.addEventListener("dragenter", event_plug, false);
    msg.addEventListener("dragexit", event_plug, false);
};
let handlePlateDBDrop = (files) => {
    for (let i = 0; i < files.length; i++) {
        let reader = new FileReader();
        reader.onload = () => {
            let file_data = reader.result;
            let json_data = JSON.parse(file_data);
            //we do this very conservatively, we only add the data if it is not already in the DB
            for (const [plate, seqs] of Object.entries(json_data)) {
                if (!(plate in plateDB["plates"])) {
                    console.log("adding plate");
                    plateDB["plates"][plate] = seqs;
                }
            }
            ////update local storage
            localStorage.setItem("plateDB", JSON.stringify(plateDB));
            console.log("plateDB updated");
        };
        reader.readAsText(files[i]);
    }
};
