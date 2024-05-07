function readScriptFile(scriptFile) {
    return parseFileWith(scriptFile, parseScript);
}
function parseScript(script) {
    return eval(script);
}
