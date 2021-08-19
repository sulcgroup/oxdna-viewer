// section responsible for electron interaction
if(typeof require !== undefined) {
    const remote = require('electron').remote;
    let arguments = remote.getGlobal('sharedObject').argv;
    
    //filter out only file arguments
    let input_files = arguments.filter(s=>!s.startsWith("--"));
    if(input_files.length > 0) {
        readFilesFromPathArgs(input_files);
    }
}