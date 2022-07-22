class CaseHandler {
    constructor() {
        this.cases = new Array();
    }
    addCase(c) {
        this.cases.push(c);
    }
    handle(files) {
        this.cases.filter(c => c.check(files)).forEach(c => c.handle(files));
        // potentially fix overlapping cases
    }
}
class Case {
    getExtension(file) {
        const fileName = file.name.toLowerCase();
        return fileName.split('.').pop();
    }
}
class OxViewHandler extends Case {
    check(files) {
        return files.length == 1 && this.getExtension(files[0]) === "oxview";
    }
    handle(files) {
        let reader = new FileReader();
        reader.onload = (e) => {
            readOxViewString(e.target.result);
        };
        reader.readAsText(files[0]);
    }
}
class DatTopHandler extends Case {
    check(files) {
        return false; //for s
    }
    handle(files) {
        let reader = new FileReader();
        reader.onload = (e) => {
            readOxViewString(e.target.result);
        };
        reader.readAsText(files[0]);
    }
}
class FilesInfo {
    constructor(files) {
        this.files = files;
    }
}
