// section responsible for electron interaction
if(window && window.process && process.versions['electron']) {
    
    const settings = require("electron-settings");
    //retrieve settings
    settings.get("BOXCentering").then(BOXCentering => {
        if(BOXCentering) {
            window.sessionStorage.centerOption   = BOXCentering.centerOption;
            window.sessionStorage.inboxingOption = BOXCentering.inboxingOption;
        }
    });
    
    const resolve = require('path').resolve;
    //we are in electron
    //ccCapture is not working ;(
    let btn = document.getElementById("videoCreateButton");
    btn.disabled = true; 
    btn.style.visibility="hidden";

    const remote = require('electron').remote;
    let arguments = remote.getGlobal('sharedObject').argv;
    
    //filter out only file arguments
    let input_files = arguments.filter(s=>!s.startsWith("--"))
    
    let resolved =[];
    input_files.forEach(s=>{
        let p = resolve(s);
        console.log(p);
        resolved.push(p);
    });
    if(input_files.length > 0) {
        readFilesFromPathArgs(resolved);
    }

}
else{
    //we are in browser
    let btn = document.getElementById("videoCreateButton");
    btn.disabled = false; 
    btn.style.visibility="visible";
    //so we also need to import CCapture
    //<script src="./ts/lib/CCapture.all.min.js"></script>
    var head = document.getElementsByTagName('head')[0];
    var js = document.createElement("script");
    js.type = "text/javascript";
    js.src = "./ts/lib/CCapture.all.min.js";
    head.appendChild(js);
}