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

    basepairMessage = "Locating basepairs, please be patient...";


    constructor(doc: Document) {
        this.doc = doc;

        // Initialise toggle groups
        this.coloringMode = new ToggleGroup('coloringMode', doc, ()=>{updateColoring()});
        this.centeringMode = new ToggleGroupWithDisable('centering', doc, 'Origin', 'None');
        this.inboxingMode = new ToggleGroupWithDisable('inboxing', doc, 'Monomer', 'None');
        this.selectionMode = new ToggleGroupWithDisable('selectionScope', doc, 'Monomer', 'Disabled');
        this.transformMode = new ToggleGroupWithDisable('transform', doc, 'Translate', 'None', (g: ToggleGroupWithDisable)=>{
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

    public toggleDataset(GD: graphData){
        let cid = currentDatasets.indexOf(GD);
        if(cid > 0) {
            currentDatasets.splice(cid, 1);
        } else {
            currentDatasets.push(GD);
        }
    }

    public addGraphData(GD :graphData){ //Generates HTML Tile Element in Fluctuation Window
        graphDatasets.push(GD);
        let tileg = document.getElementById("tileg");
        let tile = document.createElement("div");
        tile.setAttribute("id", GD.label);
        tile.setAttribute("data-role", "tile");
        tile.setAttribute("data-size", "small");
        tile.setAttribute("onclick", String(this.toggleDataset(GD)));
        let closebutton = document.createElement("button");
        closebutton.setAttribute("class", "badge-top")
        closebutton.setAttribute("onclick", String(this.removeGraphData(GD)))
        let span = document.createElement("span");
        span.setAttribute("branding-label", GD.label);
        tile.appendChild(span);
        tile.append(closebutton);
        tileg.appendChild(tile);
    }

    public removeGraphData(GD: graphData){
        let gid = graphDatasets.indexOf(GD);
        graphDatasets.splice(gid, 1);
        let cid = currentDatasets.indexOf(GD);
        if(cid > 0) {
            currentDatasets.splice(cid, 1);
        }
        let tileg = document.getElementById("tileg");
        let tile = document.getElementById(GD.label);
        tileg.removeChild(tile);
    }

}

let view = new View(document);


class graphData {
    label: string;
    data: number[];
    datatype: string;
    constructor(l, d, dt){
        this.label = l;
        this.data = d;
        this.datatype = dt;
    }
}

function drawFluctuationGraph(graphDataArr :graphData[]) { //Feed currentDatasets to draw all selected
    let colors = {
        red: 'rgb(255, 99, 132)',
        orange: 'rgb(255, 159, 64)',
        yellow: 'rgb(255, 205, 86)',
        green: 'rgb(75, 192, 192)',
        blue: 'rgb(54, 162, 235)',
        purple: 'rgb(153, 102, 255)',
        grey: 'rgb(201, 203, 207)'
    }

    let datasets = [];

    // Get Graph Type still need to make this



    for (var i = 0; i < graphDataArr.length; i++) {
        // Per Dataset
        let data = {
            label: graphDataArr[i].label,
            fill: false,
            backgroundColor: colors[i%7],
            borderColor: colors[i%7],
            data: graphDataArr[i].data,
        }
        datasets.push(data);
    }

    let labels = datasets.map(d => d.label)

    let title = "Comparison";
    let xaxislabel = 'hi';
    let yaxislabel = 'bye';

    let GraphSettings = {
        type: 'line',
        data: {
            labels: ["Predicted", "Experimental"],
            datasets: [{
                // Per Dataset
                label: 'Predicted',
                fill: false,
                backgroundColor: window.chartColors.blue,
                borderColor: window.chartColors.blue,
                data: [],
            }, {
                label: 'Experimental',
                fill: false,
                backgroundColor: window.chartColors.green,
                borderColor: window.chartColors.green,
                borderDash: [5, 5],
                data: [],
            }]
        },
        options: {
            responsive: true,
            title: {
                display: true,
                text: title
            },
            tooltips: {
                mode: 'index',
                intersect: false,
            },
            hover: {
                mode: 'nearest',
                intersect: true
            },
            scales: {
                xAxes: [{
                    display: true,
                    scaleLabel: {
                        display: true,
                        labelString: xaxislabel
                    }
                }],
                yAxes: [{
                    display: true,
                    scaleLabel: {
                        display: true,
                        labelString: yaxislabel
                    }
                }]
            }
        }
    };

    let ctx = document.getElementById('Fluctuations');
    var fluctuations = new Chart(ctx, GraphSettings);
}

class fluctuationGraph{
   getLineColor(ctx) {
        return utils.color(ctx.datasetIndex);
   }
   ;

}



window.onload = function() {
    var ctx = document.getElementById('canvas').getContext('2d');
    window.myLine = new Chart(ctx, config);
};
</script>}

window.chartColors = {

};

(function(global) {
    var MONTHS = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
    ];

    var COLORS = [
        '#4dc9f6',
        '#f67019',
        '#f53794',
        '#537bc4',
        '#acc236',
        '#166a8f',
        '#00a950',
        '#58595b',
        '#8549ba'
    ];

    var Samples = global.Samples || (global.Samples = {});
    var Color = global.Color;

    Samples.utils = {
        // Adapted from http://indiegamr.com/generate-repeatable-random-numbers-in-js/
        srand: function(seed) {
            this._seed = seed;
        },

        rand: function(min, max) {
            var seed = this._seed;
            min = min === undefined ? 0 : min;
            max = max === undefined ? 1 : max;
            this._seed = (seed * 9301 + 49297) % 233280;
            return min + (this._seed / 233280) * (max - min);
        },

        numbers: function(config) {
            var cfg = config || {};
            var min = cfg.min || 0;
            var max = cfg.max || 1;
            var from = cfg.from || [];
            var count = cfg.count || 8;
            var decimals = cfg.decimals || 8;
            var continuity = cfg.continuity || 1;
            var dfactor = Math.pow(10, decimals) || 0;
            var data = [];
            var i, value;

            for (i = 0; i < count; ++i) {
                value = (from[i] || 0) + this.rand(min, max);
                if (this.rand() <= continuity) {
                    data.push(Math.round(dfactor * value) / dfactor);
                } else {
                    data.push(null);
                }
            }

            return data;
        },

        labels: function(config) {
            var cfg = config || {};
            var min = cfg.min || 0;
            var max = cfg.max || 100;
            var count = cfg.count || 8;
            var step = (max - min) / count;
            var decimals = cfg.decimals || 8;
            var dfactor = Math.pow(10, decimals) || 0;
            var prefix = cfg.prefix || '';
            var values = [];
            var i;

            for (i = min; i < max; i += step) {
                values.push(prefix + Math.round(dfactor * i) / dfactor);
            }

            return values;
        },

        months: function(config) {
            var cfg = config || {};
            var count = cfg.count || 12;
            var section = cfg.section;
            var values = [];
            var i, value;

            for (i = 0; i < count; ++i) {
                value = MONTHS[Math.ceil(i) % 12];
                values.push(value.substring(0, section));
            }

            return values;
        },

        color: function(index) {
            return COLORS[index % COLORS.length];
        },

        transparentize: function(color, opacity) {
            var alpha = opacity === undefined ? 0.5 : 1 - opacity;
            return Color(color).alpha(alpha).rgbString();
        }
    };

    // DEPRECATED
    window.randomScalingFactor = function() {
        return Math.round(Samples.utils.rand(-100, 100));
    };

    // INITIALIZATION

    Samples.utils.srand(Date.now());

}(this));

var DATA_COUNT = 12;
var utils = Samples.utils;

utils.srand(110);



function alternatePointStyles(ctx) {
    var index = ctx.dataIndex;
    return index % 2 === 0 ? 'circle' : 'rect';
}

function makeHalfAsOpaque(ctx) {
    return utils.transparentize(getLineColor(ctx));
}

function adjustRadiusBasedOnData(ctx) {
    var v = ctx.dataset.data[ctx.dataIndex];
    return v < 10 ? 5
        : v < 25 ? 7
            : v < 50 ? 9
                : v < 75 ? 11
                    : 15;
}

function generateData() {
    return utils.numbers({
        count: DATA_COUNT,
        min: 0,
        max: 100
    });
}

var data = {
    labels: utils.months({count: DATA_COUNT}),
    datasets: [{
        data: generateData()
    }]
};

var options = {
    legend: false,
    tooltips: true,
    elements: {
        line: {
            fill: false,
            backgroundColor: getLineColor,
            borderColor: getLineColor,
        },
        point: {
            backgroundColor: getLineColor,
            hoverBackgroundColor: makeHalfAsOpaque,
            radius: adjustRadiusBasedOnData,
            pointStyle: alternatePointStyles,
            hoverRadius: 15,
        }
    }
};

var chart = new Chart('chart-0', {
    type: 'line',
    data: data,
    options: options
});


// eslint-disable-next-line no-unused-vars
function addDataset() {
    chart.data.datasets.push({
        data: generateData()
    });
    chart.update();
}

// eslint-disable-next-line no-unused-vars
function randomize() {
    chart.data.datasets.forEach(function(dataset) {
        dataset.data = generateData();
    });
    chart.update();
}

// eslint-disable-next-line no-unused-vars
function removeDataset() {
    chart.data.datasets.shift();
    chart.update();
}