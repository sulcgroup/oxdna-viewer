function readScriptFile(file) {
    let reader = new FileReader();
    reader.onload = (e) => {
        handledScript = true;
        eval(e.target.result); // hacky, but should do the trick 
    };
    reader.readAsText(file);
}
