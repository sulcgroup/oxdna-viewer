/// <reference path="../typescript_definitions/index.d.ts" />

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////          Something happened!  Call handleFiles()           ////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

// Catch files drag n dropped in
function handleDrop (event) {
    // cancel default actions
    target.classList.remove('dragging');
    const files = event.dataTransfer.files;
    handleFiles(files);
}

// Files can also be retrieved from a URL path
function readFilesFromURLPath(paths: string[]) {
    const promises = paths.map(p => new Promise (resolve => {
        let req = new XMLHttpRequest();
        req.open("GET", p);
        req.responseType = "blob";
        req.onload = () => {
            let f = req.response;
            f.name = p.split('/')
            f.name = f.name[f.name.length -1]
            f.type = ''
            resolve(f);
        }
        req.send();
    }));

    Promise.all(promises).then((files:File[]) => {
        handleFiles(files)
    })
}

// And from the URL of oxView itself (can be used to read local files if you host oxView yourself)
function readFilesFromURLParams() {
    let paths = []
    const url = new URL(window.location.href);

    url.searchParams.forEach((k, v) => {
        paths.push(k)
    })

    if (paths.length > 0) {
        readFilesFromURLPath(paths)
    }
}

// Get a file from the PDB
function readPDBFromId(pdbID: string) {
    readFilesFromURLPath([`https://files.rcsb.org/download/${pdbID}.pdb`]);
}

// Get files from messages
function handleMessage(data) {
    if (data.message === 'drop') {
        handleFiles(data.files);
    }
    else if (data.message === 'download') {
        makeOutputFiles();
    }
    else if (data.message === 'remove-event') {
        target.removeEventListener("drop", handleDrop);
        target.addEventListener("drop", function () {notify("Dragging onto embedded viewer does not allow form completion")});
        const openButton : HTMLInputElement = <HTMLInputElement>document.getElementById('open-button')
        openButton.disabled = true;
    }
    else if(data.message === 'iframe_drop'){
        let files = data.files;
        let ext = data.ext;
        let inbox_settings = data.inbox_settings;
        let view_settings = data.view_settings;
        if(files.length != ext.length){
            notify("make sure you pass all files with extenstions");
            return
        }
        //if present change the preference for inboxing
        if(inbox_settings){
            view.inboxingMode.set(inbox_settings[0]);
            view.centeringMode.set(inbox_settings[1]);
            centerAndPBCBtnClick();
        }
        // if present, change the preferences for the visiblity of box, arrows and fog
        if(view_settings) {
            if("Box" in view_settings) {
                redrawBox();
                boxObj.visible = view_settings["Box"];
            }
            if("Arrows" in view_settings) {
                setArrowsVisibility(view_settings["Arrows"]);
            }
            if("Background" in view_settings) {
                api.setBackgroundColor(view_settings["Background"])
            }
        }
        //set the names and extensions for every passed file
        for(let i =0; i< files.length; i++){
            files[i].name = `${i}.${ext[i]}`;
            
        }
        handleFiles(files);
        return
    }

    else {
        console.log(data.message, "is not a recognized message")
        return
    }
}

// Get files from Electron parameters
function readFilesFromPathArgs(args){

    let activity = Metro.activity.open({
        type: 'square',
        overlayColor: '#fff',
        overlayAlpha: 1,
        text: "Loading files from arguments."
    });

    // Set wait cursor and request an animation frame to make sure
    // that it gets changed before starting calculation:
    let dom = document.activeElement;
    dom['style'].cursor = "wait";

    const done = () => {
        // Change cursor back and remove modal
        dom['style'].cursor = "auto";
        Metro.activity.close(activity);
    }

    const get_request = (paths:string[]) => {
        let files:File[] = [];

        while(paths) {
            let path = paths.pop();
            let req = new XMLHttpRequest();
            const fileName = path.toLowerCase();

            console.log("get_request://",fileName);
            req.open("GET", path);
            req.responseType = "blob";

            req.onload = () => {
                const file = new File([req.response], fileName);
                files.push(file)
                }

            req.onerror = () => {done()};
            req.send();
        }
        return(files)
    }

    if(args.length > 0) {
        let files = get_request(args);
        //FileList isn't actually a type with a constructor, but there's nothing in handleFiles() where it doesn't behave like an array.
        handleFiles(files)
    }
    else {
        activity.text = "ERROR: No files provided"
    }
}
