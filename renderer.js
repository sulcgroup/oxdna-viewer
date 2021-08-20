// section responsible for electron interaction
if(typeof require !== undefined) {
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