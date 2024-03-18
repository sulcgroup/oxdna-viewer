function readScriptFile(file: File){

    let reader = new FileReader();
    reader.onload=(e)=>{
        handledScript=true;
        eval(e.target.result as string); // hacky, but should do the trick 
    };
    reader.readAsText(file);
}