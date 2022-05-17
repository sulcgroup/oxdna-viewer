/// <reference path="../typescript_definitions/index.d.ts" />
/// <reference path="../main.ts" />

class SelectionListHandler{
    selectionList = new Array<ViewSelection>();

    delete(caller:ViewSelection){
        const index = this.selectionList.indexOf(caller);
        if (index > -1) {
            this.selectionList.splice(index, 1);
        }
    }

    getHTML(){
        return this.selectionList.map(s=>s.html);
    }
    append(selectedBases:Set<BasicElement>, name = ""){
        let s = Array.from(selectedBases);
        let name_string : string;
        if(name === "")
            name_string = `\t${s[0].sid}-${s[s.length-1].sid}`;
        else
            name_string = name;
        this.selectionList.push(
            new ViewSelection(name_string, s, this)
        )
    }
    serialize(){
        return this.selectionList.map(
            entry=>[`${entry.name}`, entry.selectedBases.map(e=>e.sid)]
        );
    }
}




class ViewSelection{
    parent : SelectionListHandler;
    name : string;
    selectedBases : Array<BasicElement>;

    html : HTMLDivElement;
    label : HTMLLabelElement;
    selNameInput : HTMLInputElement;

    constructor(name: string, selectedBases:Array<BasicElement>, parent : SelectionListHandler){
        this.parent = parent;
        this.name = name;
        this.selectedBases = selectedBases;
        this.init();
    }

    private init(){
        this.html = document.createElement('div');
        let delete_button = document.createElement('button');
        this.label = document.createElement('label');
        this.label.style.width="90%";

        this.label.ondblclick = ()=>{
            this.label.hidden=true;
            if (!this.selNameInput){
                this.selNameInput = document.createElement('input');
                this.selNameInput.type="text";
                this.html.append(
                    this.selNameInput
                );
                const handle = ()=>{
                    this.label.innerHTML = "\t"+this.selNameInput.value;
                    this.name = this.label.innerHTML; 
                    this.label.hidden = false;
                    this.selNameInput.hidden = true;
                };
                this.selNameInput.onblur = handle;
                // Execute a function when the user presses a key on the keyboard
                this.selNameInput.addEventListener("keypress", function(event) {
                    // If the user presses the "Enter" key on the keyboard
                    if (event.key === "Enter") {
                      // Cancel the default action, if needed
                      event.preventDefault();
                      handle();
                    }
                  });
            }
            else
                this.selNameInput.hidden= false;
        };

        this.label.onclick = ()=>{
            api.selectElements(this.selectedBases,true);
            render();
        }

        this.label.innerText = this.name;
        delete_button.innerText ="x";
        delete_button.onclick = () =>{
            this.parent.delete(this);
            listSelections();
        }
        this.html.append(delete_button);
        this.html.append(this.label);
    }

} 


const selectionListHandler = new SelectionListHandler();


function selectionsSetup(){
    listSelections();
};

function listSelections() {
    const selectionsDOM = document.getElementById("selectionLST");
    selectionsDOM.innerText = "";
    selectionListHandler.getHTML().forEach(
        s => selectionsDOM.appendChild(s)
    );
}


function addSelectionToList(){
    let s = Array.from(selectedBases);
    selectionListHandler.append(selectedBases);
    listSelections();
}