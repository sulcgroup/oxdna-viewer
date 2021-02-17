// Use Metro GUI
declare var Metro: any;

function drawSystemHierarchy() {
    let checkboxhtml = (label)=> `<input data-role="checkbox" data-caption="${label}">`;

    const includeMonomers = (document.getElementById("hierarchyMonomers") as HTMLInputElement).checked;

    const content: HTMLElement = document.getElementById("hierarchyContent");
    content.innerText = '';

     let hierarchy = Metro.makePlugin(content, "treeview", {
        onCheckClick: (state, check, node, tree) => {
            let n = $(node);
            let element: BasicElement = n.data('monomer');
            if (element) {
                if (check.checked) {element.select()}
                else {element.deselect()}
                updateView(element.getSystem());
                return;
            }
            let strand: Strand = n.data('strand');
            if (strand) {
                if (check.checked) {strand.select()}
                else {strand.deselect()}
                updateView(strand.system);
                return;
            }
            let system = n.data('system');
            if (system) {
                if (check.checked) {system.select()}
                else {system.deselect()}
                updateView(system);
                return;
            }
        },
        showChildCount: true
    });
    let treeview = hierarchy.data('treeview');

    let checkboxMap: Map<number, HTMLInputElement> = new Map();

    // Add checkbox nodes for, systems, strands and monomers
    for(const system of systems) {
        let systemNode = treeview.addTo(null, {
            html: checkboxhtml(system.label ? system.label : `System ${system.id}`)
        });
        systemNode.data('system', system);
        for(const strand of system.strands) {
            let monomers = strand.getMonomers();
            let strandNode = treeview.addTo(systemNode, {
                html: checkboxhtml(
                    strand.label ? strand.label : `Strand ${strand.id}` +
                    ` (${monomers.length}${strand.isCircular() ? ' circular':''})`
                )
            });
            strandNode.data('strand', strand);
            if (includeMonomers) {
                let addMonomer = (monomer) => {
                    let color = monomer.elemToColor(monomer.type).getHexString();
                    let monomerNode = treeview.addTo(strandNode, {
                        html: checkboxhtml(`id: ${monomer.id}`.concat(
                            monomer.label ? ` (${monomer.label})` : "")) +
                            `<span style="background:#${color}4f; padding: 5px">${monomer.type}</span>`
                    });
                    monomerNode.data('monomer', monomer);
    
                    // Save reference for checbox in map:
                    let checkbox = monomerNode.find("input")[0];
                    checkbox.checked = selectedBases.has(monomer);
                    checkboxMap.set(monomer.id, checkbox);
                }
                for(const [i, monomer] of monomers.entries()) {
                    if (i<20) {
                        addMonomer(monomer);
                    } else {
                        let moreNode = treeview.addTo(strandNode, {
                            caption: `View remaining ${monomers.length-i} monomers`,
                            icon: '<span class="mif-plus"></span>'
                        });
                        moreNode[0].onclick = ()=>{
                            treeview.del(moreNode);
                            for(let j=i; j<monomers.length; j++) {
                                addMonomer(monomers[j]);
                            }
                        }

                        break;
                    }
                }
            }
        }
    }
    //});});});

    treeview._recheck(hierarchy);

    hierarchy.data('checkboxMap', checkboxMap);
    /*
    // Add listeners for if an element is toggled
    document.addEventListener('elementSelectionEvent', event=>{
        checkboxMap.get(event['element'].id).checked = event['selected'];
        //treeview._recheck(tv);
    });
    */
}

function handleMenuAction(event: String) {
    switch (event) {
        case "undo": editHistory.undo(); break;
        case "redo": editHistory.redo(); break;
        case "del": deleteWrapper(); break;
        case "cut": cutWrapper(); break;
        case "copy": copyWrapper(); break;
        case "paste": pasteWrapper(false); break;
        case "all": selectAll(); break;
        case "invert": invertSelection(); break;
        case "clear": clearSelection(); break;
    }
}

function updateColorPalette() {
    const opt: HTMLElement = document.getElementById("colorPaletteContent");
    if (!opt.hidden) {
        opt.innerHTML = "";  //Clear content

        //modifies the backboneColors array
        for (let i = 0; i < backboneColors.length; i++) {
            let m = backboneColors[i];
            let c = document.createElement('input');
            c.type = 'color';
            c.value = "#" + m.getHexString();
            c.onchange = function () {
                backboneColors[i] = new THREE.Color(c.value);
                updateColorPalette();
            }
            
            //deletes color on right click
            c.oncontextmenu = function (event) {
                event.preventDefault();
                backboneColors.splice(i, 1);
                updateColorPalette();
                return false;
            }
            opt.appendChild(c);
        }

        //actually update things in the scene
        elements.forEach(e=>{
            if (!selectedBases.has(e)) {
                e.updateColor();
            }
        });
        systems.forEach(s=> {
            s.callUpdates(['instanceColor'])
        });

        tmpSystems.forEach(s => {
            s.callUpdates(['instanceColor'])
        });

        render();
    }
};

function initLutCols(systems: System[]) {
    for (let i = 0; i < systems.length; i++) {
        const system = systems[i];
        for (let j = 0; j < system.bbColors.length; j += 3) {
            const r = system.bbColors[j];
            const g = system.bbColors[j + 1];
            const b = system.bbColors[j + 2];
            
            system.lutCols[j/3] = new THREE.Color(r,g,b);
        }
    }
}

function resetCustomColoring() {
    view.coloringMode.set("Strand");
    initLutCols(systems);
    initLutCols(tmpSystems);
    clearSelection();
}

// create color map with selected color
function colorElements(color?: THREE.Color, elems?: BasicElement[]) {
    if (!color) {
        let colorInput = (document.getElementById("customColor") as HTMLInputElement);
        color = new THREE.Color(colorInput.value);
    }
    if (!elems) {
        elems = Array.from(selectedBases);
    }

    if(elems.length == 0) {
        notify("Please first select the elements you wish to color");
    }

    elems.forEach(e=>{
        e.color = color;
    });

    view.coloringMode.set("Custom");

    clearSelection();
}

//toggles display of coloring by json file / structure modeled off of base selector
function updateColoring(mode?: string) {
    if(!mode) {
        mode = view.coloringMode.get()
    } else {
        view.coloringMode.set(mode);
    }
    if (mode === "Overlay") {
        if (lut) {
            if (colorbarScene.children.length == 0 && systems.some(system => system.colormapFile)) {
                api.showColorbar();
            }
        } else {
            notify("Please drag and drop the corresponding .json file.");
            view.coloringMode.set("Strand");
            return;
        }
    } else if (lut) {
        api.removeColorbar();
    }

    elements.forEach(e => e.updateColor());
    systems.forEach(s => s.callUpdates(['instanceColor']));

    if (tmpSystems.length > 0) {
        tmpSystems.forEach(s => s.callUpdates(['instanceColor']));
    }
    render();
}

function toggleVisArbitrary() {
    // arbitrary visibility toggling
    // toggle hidden monomers
    if (selectedBases.size == 0) {
        systems.forEach(system=>{
            system.strands.forEach(strand=>{
                strand.forEach(monomer=>{
                    if(monomer.getInstanceParameter3("visibility").x == 0)
                        monomer.toggleVisibility();
                });
            });
        });
    }
    // toggle selected monomers
    else {
        selectedBases.forEach(e => e.toggleVisibility());
    }
    
    systems.forEach(sys => sys.callUpdates(['instanceVisibility']));
    tmpSystems.forEach(tempSys => tempSys.callUpdates(['instanceVisibility']));
    clearSelection();
}

function notify(message: string, type?: string, title?: string) {
    let n = Metro.notify;
    if(!type) {
        type = "info";
    }
    n.create(message, title, {
        cls: type,
        timeout: 5000
    });
    console.info(`Notification: ${message}`);
}

function setBackgroundImage() {
    let file = (document.getElementById("backgroundInput") as HTMLInputElement).files[0];
    let reader = new FileReader();
    reader.onloadend = function() {
        document.getElementById('threeCanvas').style.backgroundImage = "url(" + reader.result + ")";
    }
    if (file) {
        reader.readAsDataURL(file);
    }
}

function setBackgroundColor() {
    let color = (document.getElementById("backgroundColor") as HTMLInputElement).value;
    document.getElementById('threeCanvas').style.background = color;
}

class ToggleGroup {
    private id: string;
    private doc: Document;
    private onChange: (toggleGroup: ToggleGroup)=>void;

    constructor(id: string, doc: Document, onChange?:(toggleGroup: ToggleGroup)=>void) {
        this.id = id;
        this.doc = doc;
        this.onChange = onChange;
    }

    public set(value: string) {
        let toggleGroup = this.doc.getElementById(this.id);
        let active = toggleGroup.querySelector('.active');
        if (active) {
            active.classList.remove('active');
        }
        for (let opt of toggleGroup.children) {
            if (opt.querySelector('.caption').innerHTML == value) {
                opt.classList.add('active');
                break;
            }
        }
        if (this.onChange) {
            this.onChange(this);
        }
    }

    public get() {
        return this.doc.getElementById(this.id).querySelector('.active').querySelector('.caption').innerHTML;
    }
}

class ToggleGroupWithDisable extends ToggleGroup {
    private lastActive: string;
    private disabled: string;

    constructor(id: string, doc: Document, lastActive: string, disabled: string, onChange?: (toggleGroup: ToggleGroupWithDisable)=>void) {
        super(id, doc, onChange);
        this.lastActive = lastActive;
        this.disabled = disabled;
    }

    public toggle() {
        this.enabled() ? this.disable() : this.enable();
    }

    public disable() {
        if (this.enabled()) {
            this.lastActive = this.get();
            this.set(this.disabled);
        }
    };

    public enable() {
        if (!this.enabled()) {
            this.set(this.lastActive)
        }
    };

    public enabled(): boolean {
        return this.get() !== this.disabled;
    }
}

class View {
    private doc: Document;

    coloringMode: ToggleGroup;
    centeringMode: ToggleGroupWithDisable;
    inboxingMode: ToggleGroupWithDisable;
    selectionMode: ToggleGroupWithDisable;
    transformMode: ToggleGroupWithDisable;
    fluxSideBarDisplayed: boolean;

    basepairMessage = "Locating basepairs, please be patient...";


    constructor(doc: Document) {
        this.doc = doc;

        // Initialise toggle groups
        this.coloringMode = new ToggleGroup('coloringMode', doc, ()=>{updateColoring()});
        this.centeringMode = new ToggleGroupWithDisable('centering', doc, 'Origin', 'None');
        this.inboxingMode = new ToggleGroupWithDisable('inboxing', doc, 'Monomer', 'None');
        this.selectionMode = new ToggleGroupWithDisable('selectionScope', doc, 'Monomer', 'Disabled');
        this.transformMode = new ToggleGroupWithDisable('transform', doc, 'Translate', 'None', (g: ToggleGroupWithDisable)=>{
        this.fluxSideBarDisplayed = false; //
            // If we should show something
            if (g.enabled()) {
                // Make sure something is selected
                if (selectedBases.size > 0) {
                    transformControls.show();
                    transformControls.setMode(g.get().toLowerCase());
                } else {
                    notify("Please select elements to transform");
                    g.disable();
                }
            } else {
                transformControls.hide()
            }
        });
    }

    public sectionClicked() {
        let s = document.getElementsByClassName("section active")[0] as HTMLElement;
        s.hidden = !s.hidden;
    }

    public getRandomHue(): THREE.Color {
        return new THREE.Color(`hsl(${Math.random()*360}, 100%, 50%)`);
    }

    public getInputNumber(id: string): number {
        return parseFloat(this.getInputValue(id));
    }

    public getInputValue(id: string): string {
        return (<HTMLInputElement>this.doc.getElementById(id)).value;
    }

    public getInputBool(id: string): boolean {
        return (<HTMLInputElement>document.getElementById(id)).checked;
    }

    public isWindowOpen(id: string): boolean {
        let elem = this.doc.getElementById(id);
        if (elem) {
            // Should work but doesn't
            //return Metro.window.isOpen(elem);
            return elem.parentElement.parentElement.style.display != "none";
        } else {
            return false;
        }
        
    }

    public toggleWindow(id: string, oncreate?: ()=>void) {
        let elem = this.doc.getElementById(id);
        if (elem) {
            Metro.window.toggle(elem);
        } else {
            this.createWindow(id, oncreate);
        }
    }

    public createWindow(id: string, oncreate?: ()=>void) {
        fetch(`windows/${id}.json`)
            .then(response => response.json())
            .then(data => {
                let w = Metro.window.create(data);
                w[0].id = id;
                w.load(`windows/${id}.html`).then(oncreate);
            }
        );
    }

    public showHoverInfo(pos: THREE.Vector2, e: BasicElement) {
        let hoverInfo = document.getElementById('hoverInfo');
        let color = e.elemToColor(e.type).getHexString();
        hoverInfo.innerHTML = `<span style="background:#${color}4f; padding: 5px">${e.type} ${e.getSystem().id}:${e.strand.id}:${e.id}</span>`;
        hoverInfo.style.left = pos.x  + 'px';
        hoverInfo.style.top =  pos.y + 20 + 'px';
        hoverInfo.hidden = false;
    }
    public hideHoverInfo() {
        document.getElementById('hoverInfo').hidden = true;
    }

    public selectPairs(): boolean {
        return (<HTMLInputElement>this.doc.getElementById("selectPairs")).checked;
    }

    public saveCanvasImage(){
        canvas.toBlob(function(blob){
            var a = document.createElement('a');
            var url = URL.createObjectURL(blob);
            a.href = url;
            a.download = 'canvas.png';
            a.click();
        }, 'image/png', 1.0);
        //get the colorbar too
        if (colorbarScene.children.length != 0) {
            renderColorbar();
            colorbarCanvas.toBlob(function(blob) {
                var a = document.createElement('a');
                var url = URL.createObjectURL(blob);
                a.href = url;
                a.download = 'colorbar.png';
                a.click();
            }, 'image/png', 1.0);
        }
    }

    public longCalculation(calc: () => void, message: string, callback?: () => void) {
        let activity = Metro.activity.open({
            type: 'square',
            overlayColor: '#fff',
            overlayAlpha: 1,
            text: message
        });

        // Set wait cursor and request an animation frame to make sure
    // that it gets changed before starting calculation:
    let dom = document.activeElement;
    dom['style'].cursor = "wait";
    requestAnimationFrame(() => requestAnimationFrame(() => {
        try {
           calc(); 
        } catch (error) {
           notify(`Sorry, something went wrong with the calculation: ${error}`, "alert");
        }

        // Change cursor back and remove modal
        dom['style'].cursor = "auto";
        Metro.activity.close(activity);
        if(callback) {
            callback();
        }
    }));
    }

    //Network Selector Methods
    public addNetwork(nid : number){
        let ul = document.getElementById("networks")
        let li = document.createElement("li");
        let name = "Network " + (nid+1).toString();
        li.setAttribute('id', name);
        li.appendChild(document.createTextNode(name));
        li.setAttribute("onclick", String(selectednetwork = nid));
        ul.appendChild(li);
    }

    public removeNetwork(nid: number){
        let ul = document.getElementById("networks");
        let name = "Network " + (nid+1).toString();
        let item = document.getElementById(name);
        ul.removeChild(item);
    }

    public toggleDataset(gid: number){
        let GD = graphDatasets[gid];
        let name = "Dataset: " + GD.label + " Format: " + GD.datatype;
        let x = document.getElementById(name);
        if(typeof(x) != 'undefined' && x != null){
            //exists
            this.removeGraphData(gid);
        } else {
            this.addGraphData(gid);
        }
    }

        // NOT USED WILL PROBABLY REMOVE
    public toggleSpanColor(sp: HTMLElement){
        let currentcolor = sp.getAttribute("style");
        if(currentcolor == "color:red") sp.setAttribute("style", "color:black");
        if(currentcolor == "color:black") sp.setAttribute("style", "color:red");
    }

    public toggleSideBarDatasets(){
        if(this.fluxSideBarDisplayed){
            for(let i = 0; i< graphDatasets.length; i++){
                this.removeGraphData(i);
            }
            for(let i = 0; i< networks.length; i++){
                this.removeNetworkData(i);
            }
            this.fluxSideBarDisplayed = false;
        } else {
            for(let i = 0; i < networks.length; i++){
                this.addNetworkData(i);
            }
            for(let i = 0; i < graphDatasets.length; i++){
                this.addGraphData(i);
            }
            this.fluxSideBarDisplayed = true;
        }
    }

    public addGraphData(gid : number){
        let GD = graphDatasets[gid];
        let ul = document.getElementById("datalist") //In fluctuation Window
        let li = document.createElement("li");
        let sp1 = document.createElement("span");
        let sp2 = document.createElement("span")
        sp1.setAttribute('class', 'label');
        sp2.setAttribute('class', 'second-label');
        sp1.appendChild(document.createTextNode(GD.label));
        sp2.appendChild(document.createTextNode(GD.datatype));
        let name = "Dataset: " + GD.label + " Format: " + GD.datatype;
        li.setAttribute('id', name);
        li.setAttribute('value', String(gid));
        li.appendChild(sp1);
        li.appendChild(sp2);
        li.onclick = function() {flux.toggleData(li.value)};

        ul.appendChild(li);
    }

    public addNetworkData(nid: number){
        let ul = document.getElementById("readynetlist") //In fluctuation Window
        let li = document.createElement("li");
        let sp1 = document.createElement("span");
        let sp2 = document.createElement("span")
        sp1.setAttribute('class', 'label');
        sp2.setAttribute('class', 'second-label');
        let name = "Network " + (nid+1).toString();
        sp1.appendChild(document.createTextNode(name));
        sp2.appendChild(document.createTextNode(networks[nid].networktype));
        li.setAttribute('id', name);
        li.setAttribute('value', String(nid));
        li.appendChild(sp1);
        li.appendChild(sp2);
        li.onclick = function() {flux.fitData(li.value)};
        ul.appendChild(li);
    }

    public removeGraphData(gid : number){
        let GD = graphDatasets[gid];
        let ul = document.getElementById("datalist");
        let name = "Dataset: " + GD.label + " Format: " + GD.datatype;
        let li = document.getElementById(name);
        ul.removeChild(li);
    }

    public removeNetworkData(nid : number){
        let ul = document.getElementById("readynetlist");
        let name = "Network " + (nid+1).toString();
        let li = document.getElementById(name);
        ul.removeChild(li);
    }



}

let view = new View(document);


class graphData {
    label: string;
    data: number[];
    xdata: number[];
    datatype: string;
    units: string;
    gammaSim: number; // Spring force constant only used if graphData is generated as a Fit
    cutoff: number; // Cutoff (A) for edges, only used if graphData is generated as a Fit
    constructor(l, d, x, dt, u){
        this.label = l;
        this.data = d;
        this.xdata = x;
        this.datatype = dt;
        this.units = u;
        this.gammaSim = 0;
        this.cutoff = 0;
    };
    convertType(format:string) {
        if(['rmsf', 'bfactor'].indexOf(format) < 0) return; // TODO: Add error throw here and convertUnits
        if (this.datatype == format) return; //Already in the right format gang gang
        // Conversion needs to know both formats and direction to do anything useful
        if (this.datatype == 'rmsf' && format == 'bfactor'){
            this.data = this.data.map(e => e * ((8 * Math.pow(Math.PI, 2)) / 3));
        } else if (this.datatype == 'bfactor' && format == 'rmsf'){
            this.data = this.data.map(e => e * (3 / (8 * Math.pow(Math.PI, 2))));
        }
        this.datatype = format; // assumes successful conversion
    };
    convertUnits(units:string) {
        if(['A_sqr', 'nm_sqr'].indexOf(units) < 0) return;
        if(this.units == 'A_sqr' && units == "nm_sqr"){
            this.data = this.data.map(e => e / 100);
        } else if(this.units == 'nm_sqr' && units == "A_sqr"){
            this.data = this.data.map(e => e * 100);
        }
        this.units = units; // assumes successful conversion
    };
}

// This Class is basically a giant container to deal with all the graphing for the FluctuationWindow
class fluxGraph {
    title: string;
    xaxislabel: string;
    yaxislabel: string;
    data: graphData[];
    type: string;
    temp: number;
    chart;
    targetdata: string;
    units: string;
    colors;
    colorarr;
    charttype: string;
    chartdata;
    chartoptions;
    chartconfig;
    datasetCount: number;
    gids: number[];

    constructor(type, units) {
        this.title = 'Flux Chart';
        this.xaxislabel = 'Particle ID';
        this.units = units;
        this.yaxislabel = this.getYaxis(units); // A2 or nm2
        this.datasetCount = 0;
        this.gids = [];
        this.colors = {
            red: 'rgb(255, 99, 132)',
            green: 'rgb(75, 192, 192)',
            yellow: 'rgb(255, 205, 86)',
            blue: 'rgb(54, 162, 235)',
            purple: 'rgb(153, 102, 255)',
            hotpink: 'rgb(255, 0, 127)',
            grey: 'rgb(201, 203, 207)',
            lightgreen: 'rgb(204, 255, 204)',
            lavender: 'rgb(229, 204, 255)',
            lightblue: 'rgb(153, 255, 255)',
            orange: 'rgb(255, 159, 64)',
            armygreen: 'rgb(135, 156, 102)',
            flatblue: 'rgb(102, 131, 156)',
        }
        this.colorarr = [this.colors.red, this.colors.green, this.colors.yellow, this.colors.blue,
            this.colors.purple, this.colors.hotpink, this.colors.grey, this.colors.lightgreen,
            this.colors.lavender, this.colors.lightblue, this.colors.armygreen, this.colors.flatblue];
        this.type = type;
        this.temp = 0;
        this.chart = null;

        // Specific to the chart
        this.charttype = 'line';
        this.chartdata = {
            labels: [],
            datasets: []
        }
        this.chartoptions = {
            responsive: true,
            title: {
                display: true,
                text: [this.title, this.type]
            },
            tooltips: {
                mode: 'x',
                intersect: false
            },
            hover: {
                mode: 'x',
                intersect: false
            },
            scales: {
                xAxes: [{
                    display: true,
                    scaleLabel: {
                        display: true,
                        labelString: this.xaxislabel
                    }
                }],
                yAxes: [{
                    display: true,
                    scaleLabel: {
                        display: true,
                        labelString: this.yaxislabel
                    }
                }]
            }
        }
        this.chartconfig = {
            type: this.charttype,
            options: this.chartoptions,
            data: this.chartdata
        }
    };

    toggleGraph() {
        if (this.chart == null) {
            this.initializeGraph();
        }
    }

    clearGraph() {
        if(this.gids.length != 0) this.gids.forEach(g => this.toggleData(g));
    }

    getYaxis(units: string) {
        return {'A_sqr': "A^2", "nm_sqr": "nm^2"}[units]; //quick conversion key
    }

    initializeGraph() {
        try {
            let ctx = (document.getElementById("flux") as HTMLCanvasElement).getContext('2d');
            this.chart = new Chart(ctx, this.chartconfig);
        } catch {
            notify("Graph could not be Initialized");
        }
    }

    setType(type: string) { //type can be bfactor or rmsf
        this.type = type;
    };

    setTemp(temp: number) { // Kelvin
        this.temp = temp;
    };

    addTestSet() {
        let label = 'test';
        let units = "A_sqr";
        let datatype = "bfactor";
        let xdata = [0, 1, 2, 3, 4, 5];
        let ydata = [10, 23, 18, 5, 11, 35];
        let gdata = new graphData(label, ydata, xdata, datatype, units);
        graphDatasets.push(gdata);
        let gid = graphDatasets.indexOf(gdata);
        this.addDatatoGraph(gid);
    }

    setTargetData(gid) {
        this.chart.data = {
            labels: [],
            datasets: []
        };

        this.addDatatoGraph(gid);
    };

    addDatatoGraph(gid: number) {
        let GD = graphDatasets[gid];
        if (this.chart == null) {
            this.initializeGraph();
        }
        if (GD.xdata.length > this.chart.data.labels.length) {
            this.chart.data.labels = [...Array(GD.xdata.length).keys()]; // Rewrites x data to always start from 0 and go up
        } // else just use the current sized container, will be indexed off largest dataset in array
        if (GD.units != this.units) GD.convertUnits(this.units);
        if (GD.datatype != this.type) GD.convertType(this.type);


        if (GD.cutoff > 0) { // If it's data that's been fit it get's dashed
            this.chart.data.datasets.push({
                label: GD.label,
                backgroundColor: this.colorarr[gid%this.colorarr.length],
                borderColor: this.colorarr[gid%this.colorarr.length],
                borderDash: [5, 5],
                data: GD.data,
                fill: false,
            })
        } else {
            this.chart.data.datasets.push({
                label: GD.label,
                backgroundColor: this.colorarr[gid%this.colorarr.length],
                borderColor: this.colorarr[gid%this.colorarr.length],
                data: GD.data,
                fill: false,
            })
        }

        this.datasetCount += 1;
        this.chart.update();
        this.gids.push(gid);
        //Still Need a chart update call to see changes
    };

    removeDatafromGraph(gid: number) {
        let GD = graphDatasets[gid];
        let chartlabels = this.chart.data.datasets.map(d => d.label);
        let lid = chartlabels.indexOf(GD.label); //label index and dataset index must be identical
        if (lid > -1) {
            this.chart.data.labels.splice(lid, 1);
            this.chart.data.datasets.splice(lid, 1);
        }
        this.datasetCount -= 1;
        this.chart.update();
        let gindx = this.gids.indexOf(gid);
        this.gids.splice(gindx, 1);
    };

    toggleData(gid: number) { // Simple function for buttons to call
        let GD = graphDatasets[gid];
        let chartlabels = this.chart.data.datasets.map(d => d.label);
        if (chartlabels.indexOf(GD.label) < 0) {
            this.addDatatoGraph(gid);
        } else {
            this.removeDatafromGraph(gid);
        }
    };

    writeConfig() {

    };

    toggleSidebar() {
        let sb = document.getElementById('fluxbar');
        // sb.toggle
    };

    changeUnits(newunits: string) {
        if (this.gids.length > 0) {
            let copyids = this.gids.slice();
            copyids.forEach(g => this.toggleData(g)); // turn off
            this.units = newunits;
            this.chart.options.scales.yAxes[0].scaleLabel.labelString = this.getYaxis(this.units); //set y axes text
            copyids.forEach(g => this.toggleData(g)); // re- added, will automatically convert units
        } else {
            this.units = newunits;
            this.chart.options.scales.yAxes[0].scaleLabel.labelString = this.getYaxis(this.units); //set y axes text
        }
    };

    changeType(newtype: string) {
        if (this.gids.length > 0) {
            let copyids = this.gids.slice(); //currently loaded datasets
            copyids.forEach(g => this.toggleData(g)); // turn off
            this.chart.options.title.text[1] = newtype; // set sub title which is the graph type
            this.type = newtype;
            copyids.forEach(g => this.toggleData(g)); // re- added, will automatically convert types
        } else {
            this.chart.options.title.text[1] = newtype; // set sub title which is the graph type
            this.type = newtype;
        }
    };

    fitData(nid: number) {
        if(this.gids.length != 1){
            notify("Please Select only One Dataset to Begin Fitting");
            return;
        }

        // get that one and only graph dataset
        let gid = this.gids[0];
        let GD = graphDatasets[gid];

        // make format rmsf for fitting
        let Targetrmsf;
        if(GD.datatype == "bfactor") {
            Targetrmsf = GD.data.slice().map(b => b*(3/(8*Math.pow(Math.PI, 2))));
        } else {
            Targetrmsf = GD.data.slice(); //must be rmsf
        }

        // get network, make sure edges are there, otherwise nothing to calculate
        let net = networks[nid];
        if(net.reducedEdges.total == 0) {
            notify("Network's Edges must be filled prior to Fitting");
            return;
        }

        // checks data you are fitting is exact same length, might need to make changes to this later
        if(net.particles.length != Targetrmsf.length) {
            notify("Target Data is a different length than network, will not Fit");
            return;
        }

        // ANM Solving, only one for a little bit
        if(net.networktype == 'ANM'){
            let hess = net.generateHessian();
            let invH = net.invertHessian(hess);
            let temp = view.getInputNumber('temp');
            let rmsf = net.getRMSF(invH, temp);

            let fit = findLineByLeastSquaresNoIntercept(rmsf, Targetrmsf);
            let xvals = fit[0];
            let fitval = fit[1];
            let m = <number> fit[2];
            let k = 1/m; //N*10^-10/A (k*100 = pN/A)
            let sim_k = k/net.simFC; //convert force constant to simulation reduced units for force constants 1 pN/A = 0.05709

            // rmsf is returned currently to check the Hessian inversion process
            let gendata = new graphData(GD.label + " Fit", fitval, GD.xdata, "rmsf", "A_sqr");
            gendata.gammaSim = sim_k;
            let ngid = graphDatasets.length;
            graphDatasets.push(gendata);
            view.addGraphData(ngid);
            this.clearGraph();
            this.toggleData(ngid);
            this.toggleData(gid);
        }
    };
}


const flux = new fluxGraph("rmsf", "A_sqr");
