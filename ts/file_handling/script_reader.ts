function readScriptFile(scriptFile:File) {
    return parseFileWith(scriptFile, parseScript)
}

function parseScript(script:string) {
    return eval(script);
}