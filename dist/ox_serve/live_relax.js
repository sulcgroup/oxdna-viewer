/// <reference path="../typescript_definitions/index.d.ts" />
/// <reference path="../typescript_definitions/oxView.d.ts" />
/// <reference path="./relax_scenarios.ts" />
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
    lst.forEach(addConnectionDom);
    //make sure the previous connection is killed before adding a new one  
    if (socket) {
        socket.close();
    }
    Metro.dialog.open('#socketConnectionsDialog');
}
function addConnectionDom(element, id) {
    if (element !== "") {
        let item = document.createElement('div');
        //item.classList.add('item');
        item.id = `oxIp${id}`;
        let del = document.createElement('button');
        del.classList.add('square', 'button');
        del.innerHTML = "<span class='mif-cross'></span>";
        del.onclick = () => {
            item.remove();
            let lst = window.localStorage.oxServeIps.split(',');
            lst.splice(id, 1);
            window.localStorage.setItem("oxServeIps", lst);
        };
        del.title = "Delete entry";
        let connect = document.createElement('button');
        connect.classList.add('square', 'button', 'secondary');
        connect.innerHTML = "<span class='mif-play'></span>";
        connect.onclick = () => { establishConnection(id); };
        connect.title = "Establish connection";
        let label = document.createElement('span');
        label.classList.add('label');
        label.setAttribute("style", "padding-left:2px;");
        label.innerHTML = element;
        item.appendChild(del);
        item.appendChild(connect);
        item.appendChild(label);
        document.getElementById("serverList").appendChild(item);
    }
}
function addOXServeURL() {
    let host = document.getElementById("newHostText").value; //= window.sessionStorage.inboxingOption ;
    let lst = window.localStorage.oxServeIps.split(',');
    if (host !== "ws://some_host") {
        lst.push(host);
        window.localStorage.setItem("oxServeIps", lst);
        addConnectionDom(host, lst.length - 1);
        document.getElementById("newHostText").innerText = "";
    }
}
class OXServeSocket extends WebSocket {
    constructor(url) {
        super(url);
        this.abort = true;
        this.stop_simulation = () => {
            this.send("abort");
            this.abort = true;
        };
        this.start_simulation = () => {
            this.abort = false;
            const name = 'out';
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
            if (networks.length > 0) {
                let { file_name, file } = makeParFile(name, reorganized, counts);
                conf["par_file"] = file;
            }
            conf["settings"] = {};
            let sim_type = "";
            let backend = document.getElementsByName("relaxBackend");
            for (let i = 0; i < backend.length; i++) {
                if (backend[i].type = "radio") {
                    if (backend[i].checked)
                        sim_type = backend[i].value;
                }
            }
            console.log(`Simulation type is ${sim_type}`);
            let settings_list = relax_scenarios[sim_type];
            if (forces.length > 0) {
                conf["trap_file"] = forcesToString();
            }
            //set all var fields 
            for (let [key, value] of Object.entries(settings_list["var"])) {
                conf["settings"][key] = document.getElementById(value["id"]).value;
                if (key === "T")
                    conf["settings"][key] += "C";
            }
            //set all const fields 
            for (let [key, value] of Object.entries(settings_list["const"])) {
                conf["settings"][key] = value["val"];
            }
            //set all relax fields
            let useRelax = false;
            if (sim_type === "MC")
                useRelax = view.getInputBool("mcUseRelax");
            if (sim_type === "MD_GPU")
                useRelax = view.getInputBool("mdUseRelax");
            if (useRelax) {
                for (let [key, value] of Object.entries(settings_list["relax"])) {
                    conf["settings"][key] = document.getElementById(value["id"]).value;
                }
            }
            this.send(JSON.stringify(conf));
        };
        this.onmessage = (response) => {
            if (!this.abort) { //ignore all incomming messages when we stop the simulation
                let message = JSON.parse(response.data);
                if ("console_log" in message) {
                    console.log(message["console_log"]);
                }
                if ("dat_file" in message) {
                    updateConfFromFile(message["dat_file"]);
                    if (forceHandler)
                        forceHandler.redraw();
                }
            }
        };
        this.onopen = (resonse) => {
            console.log(resonse);
            let connect_button = document.getElementById("btnConnect");
            connect_button.style.backgroundColor = "green";
            connect_button.textContent = "Connected!";
            Metro.dialog.close('#socketConnectionsDialog');
            this.abort = false;
        };
        this.onclose = (resonse) => {
            let connect_button = document.getElementById("btnConnect");
            connect_button.style.backgroundColor = "";
            connect_button.textContent = "Connect to oxServe";
            notify("lost oxServe Connection", "warn");
            this.abort = true;
        };
    }
}
let socket;
function establishConnection(id) {
    let url = window.localStorage.getItem("oxServeIps").split(",")[id];
    socket = new OXServeSocket(url);
}
function establishNanobaseConnection() {
    socket = new OXServeSocket("wss://nanobase.org:8989");
}
