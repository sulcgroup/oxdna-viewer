/// <reference path="../typescript_definitions/index.d.ts" />
/// <reference path="../typescript_definitions/oxView.d.ts" />
/// <reference path="./relax_scenarios.ts" />



// make sure local storage contains the relevant key 
if (window.localStorage.getItem("oxServeIps") === null){
    window.localStorage.setItem("oxServeIps","");   
}

function openConnections() {
    const node = document.getElementById("serverList");
    node.textContent = ''; // clear list before construction 
    let val = window.localStorage.getItem("oxServeIps") ;
    let lst : string[];
    lst = val ? val.split(',') : [] ;
    //console.log(lst);


    lst.forEach(addConnectionDom);
            
    //make sure the previous connection is killed before adding a new one  
    if(socket){
        socket.close();
    }
    Metro.dialog.open('#socketConnectionsDialog');
}

function addConnectionDom(element: string, id: number) {
    if (element !== "") {
        let item = document.createElement('div');
        //item.classList.add('item');
        item.id = `oxIp${id}`;

        let del = document.createElement('button');
        del.classList.add('square', 'button');
        del.innerHTML = "<span class='mif-cross'></span>"
        del.onclick = ()=>{
            item.remove();
            let lst = window.localStorage.oxServeIps.split(',');
            lst.splice(id, 1);
            window.localStorage.setItem("oxServeIps",lst);
        };
        del.title = "Delete entry";

        let connect = document.createElement('button');
        connect.classList.add('square', 'button', 'secondary');
        connect.innerHTML = "<span class='mif-play'></span>";
        connect.onclick = () => {establishConnection(id)};
        connect.title = "Establish connection";

        let label = document.createElement('span');
        label.classList.add('label');
        label.innerHTML = element;

        item.appendChild(del);
        item.appendChild(connect);
        item.appendChild(label);

        document.getElementById("serverList").appendChild(item);
    } 
}


function addOXServeURL(){
    let host = (document.getElementById("newHostText") as HTMLSelectElement).value;//= window.sessionStorage.inboxingOption ;
    let lst = window.localStorage.oxServeIps.split(',');
    
    if (host !== "ws://some_host"){
        lst.push(host);    
        window.localStorage.setItem("oxServeIps",lst);
        addConnectionDom(host, lst.length -1);
        (document.getElementById("newHostText") as HTMLSelectElement).innerText =  "";
    }

}





class OXServeSocket extends WebSocket{
    constructor(url : string){
        super(url);
    }
    onmessage = (response) => {
        let message = JSON.parse(response.data);
        if ("console_log" in message){
            console.log(message["console_log"]);
        }
        if ("dat_file" in message) {
            let lines = message["dat_file"].split("\n");
            lines =  lines.slice(3) // discard the header
            let system = systems[systems.length-1];
            let numNuc: number = system.systemLength(); //gets # of nuc in system
            let currentNucleotide: BasicElement,
            l: string[];
            for (let lineNum = 0; lineNum < numNuc; lineNum++) {
                currentNucleotide = elements.get(systems[systems.length-1].globalStartId+lineNum);
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


    onopen = (resonse) => {
        console.log(resonse);
        let connect_button =  (document.getElementById("btnConnect") as HTMLSelectElement);
        connect_button.style.backgroundColor = "green";
        connect_button.textContent = "Connected!";
        Metro.dialog.close('#socketConnectionsDialog');
    }

    onclose = (resonse) => {
        let connect_button =  (document.getElementById("btnConnect") as HTMLSelectElement);
        connect_button.style.backgroundColor = "";
        connect_button.textContent = "Connect to oxServe";
        notify("lost oxServe Connection", "warn");
    }

    
    stop_simulation = () =>{
        this.send("abort");
    }

    start_simulation = () => {
        // TEMPORARY  
        // TODO: Add update code 
        //forces.forEach(force=>{
        //    force.clearDrawn();
        //})
        if (forceHandler) forceHandler.clearDrawn();

        let reorganized, counts, conf = {};
        {
            let {a, b, file_name, file} = makeTopFile(name);
            reorganized = a;
            counts = b;
            conf["top_file"] = file;
        }
        {
            let {file_name, file} = makeDatFile(name, reorganized);
            conf["dat_file"] = file;	
        }
        if (networks.length > 0) {
            let {file_name, file} = makeParFile(name, reorganized, counts);
            conf["par_file"] = file;
        }

        conf["settings"] = {};
        let sim_type = "";
        let backend = (document.getElementsByName("relaxBackend") as NodeListOf<HTMLInputElement>);
        for(let i = 0; i < backend.length; i++) { 
                  
            if(backend[i].type="radio") { 
              
                if(backend[i].checked) 
                     sim_type = backend[i].value;  
            } 
        } 
        console.log(`Simulation type is ${sim_type}`);
        let settings_list = relax_scenarios[sim_type];

        if(forces.length > 0){
            conf["trap_file"] = forcesToString();
        }

        //set all var fields 
        for (let [key, value] of Object.entries(settings_list["var"])) {
            
            conf["settings"][key] = (document.getElementById(value["id"]) as HTMLInputElement).value;
            if(key === "T") conf["settings"][key] += "C";
        }  
        
        //set all const fields 
        for (let [key, value] of Object.entries(settings_list["const"])) {
            conf["settings"][key] = value["val"];    
        }
        
        this.send(
            JSON.stringify(conf)
        );
    }
}


let socket : OXServeSocket;
function establishConnection(id){
    let url = window.localStorage.getItem("oxServeIps").split(",")[id];
    socket = new OXServeSocket(url);   

}
