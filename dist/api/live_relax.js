/// <reference path="../typescript_definitions/index.d.ts" />
/// <reference path="../typescript_definitions/oxView.d.ts" />
// make sure local storage contains the relevant key 
if (window.localStorage.getItem("oxServeIps") === null) {
    window.localStorage.setItem("oxServeIps", "");
}
function openConnections() {
    const node = document.getElementById("serverList");
    node.textContent = ''; // clear list before construction 
    let val = window.localStorage.getItem("oxServeIps");
    let lst;
    lst = val ? val.split(',') : [];
    //console.log(lst);
    lst.forEach((element, id) => {
        if (element !== "") {
            node.innerHTML += `<p id="oxIP${id}">`;
            node.innerHTML += `<button id="oxIP${id}_1" style="width: 40px; height:30px;" onclick="deleteOXServeCon(${id})" title="Delete entry">x</button> `;
            node.innerHTML += `<button id="oxIP${id}_2"style="width: 40px; height:30px;" onclick="establishConnection(${id})" title="Establish connection">►</button>`;
            node.innerHTML += `<label  id="oxIP${id}_3" for="oxIP${id}_1">${element}</label></p>`;
        }
    });
    //make sure the previous connection is killed before adding a new one  
    if (socket) {
        socket.close();
    }
    toggleModal('socketConnections');
}
function deleteOXServeCon(id) {
    document.getElementById(`oxIP${id}_3`).remove();
    document.getElementById(`oxIP${id}_2`).remove();
    document.getElementById(`oxIP${id}_1`).remove();
    let lst = window.localStorage.oxServeIps.split(',');
    lst.splice(id, 1);
    window.localStorage.setItem("oxServeIps", lst);
}
function addOXServeURL() {
    let host = document.getElementById("newHostText").value; //= window.sessionStorage.inboxingOption ;
    let lst = window.localStorage.oxServeIps.split(',');
    if (host !== "ws://some_host") {
        lst.push(host);
        window.localStorage.setItem("oxServeIps", lst);
        const node = document.getElementById("serverList");
        node.innerHTML += `<p id="oxIP${lst.length - 1}>`;
        node.innerHTML += `<button id="oxIP${lst.length - 1}_1" style="width: 40px; height:30px;" onclick="deleteOXServeCon(${lst.length - 1})" title="Delete entry">x</button> `;
        node.innerHTML += `<button id="oxIP${lst.length - 1}_2"style="width: 40px; height:30px;" onclick="establishConnection(${lst.length - 1})" title="Establish connection">►</button>`;
        node.innerHTML += `<label  id="oxIP${lst.length - 1}_3" for="oxIP$${lst.length}_1">${host}</label></p>`;
        document.getElementById("newHostText").innerText = "";
    }
}
class OXServeSocket extends WebSocket {
    constructor(url) {
        super(url);
        this.onmessage = (response) => {
            let message = JSON.parse(response.data);
            if ("dat_file" in message) {
                let lines = message["dat_file"].split("\n");
                lines = lines.slice(3); // discard the header
                let system = systems[systems.length - 1];
                let numNuc = system.systemLength(); //gets # of nuc in system
                let currentNucleotide, l;
                for (let lineNum = 0; lineNum < numNuc; lineNum++) {
                    currentNucleotide = elements.get(systems[systems.length - 1].globalStartId + lineNum);
                    // consume a new line
                    l = lines[lineNum].split(" ");
                    currentNucleotide.calculateNewConfigPositions(l);
                }
                system.backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
                system.nucleoside.geometry["attributes"].instanceOffset.needsUpdate = true;
                system.nucleoside.geometry["attributes"].instanceRotation.needsUpdate = true;
                system.connector.geometry["attributes"].instanceOffset.needsUpdate = true;
                system.connector.geometry["attributes"].instanceRotation.needsUpdate = true;
                system.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
                system.bbconnector.geometry["attributes"].instanceRotation.needsUpdate = true;
                system.bbconnector.geometry["attributes"].instanceScale.needsUpdate = true;
                system.dummyBackbone.geometry["attributes"].instanceOffset.needsUpdate = true;
                centerAndPBC();
                render();
            }
        };
        this.onopen = (resonse) => {
            console.log(resonse);
            let connect_button = document.getElementById("btnConnect");
            connect_button.style.backgroundColor = "green";
            connect_button.textContent = "Connected!";
            toggleModal('socketConnections');
        };
        this.onclose = (resonse) => {
            let connect_button = document.getElementById("btnConnect");
            connect_button.style.backgroundColor = "";
            connect_button.textContent = "Connect to oxServe";
            notify("lost oxServe Connection");
        };
        this.send_configuration = () => {
            let reorganized, counts, conf = {};
            {
                let { a, b, file_name, file } = makeTopFile(name);
                reorganized = a;
                counts = b;
                conf["top_file"] = file;
            }
            {
                let { file_name, file } = makeDatFile(name, reorganized);
                conf["dat_file"] = file;
            }
            if (ANMs.length > 0) {
                let { file_name, file } = makeParFile(name, reorganized, counts);
                conf["par_file"] = file;
            }
            conf["type"] = "DNA";
            conf["settings"] = {};
            this.send(JSON.stringify(conf));
        };
    }
}
let socket;
function establishConnection(id) {
    let url = window.localStorage.getItem("oxServeIps").split(",")[id];
    socket = new OXServeSocket(url);
}
//var ws = new WebSocket('ws://localhost:8888');
//var ws = new OXServeSocket('ws://9ecc6936.ngrok.io');
