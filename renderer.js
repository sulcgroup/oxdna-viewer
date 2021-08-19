// section responsible for electron interaction
if(typeof require !== undefined) {
    const remote = require('electron').remote;
    let arguments = remote.getGlobal('sharedObject').argv;
    console.log(arguments);
    notify("Loading file from arguments.");
    arguments = arguments.filter(s=>!s.startsWith("--")); //filtering out the flags
    readFilesFromPathArgs(arguments);
}