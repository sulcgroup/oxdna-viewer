// section responsible for electron interaction
if(typeof require !== undefined) {
    const remote = require('electron').remote;
    const arguments = remote.getGlobal('sharedObject').argv;
    console.log(arguments);
    notify("Loading file from arguments.");
    readFilesFromPathArgs(arguments);
}