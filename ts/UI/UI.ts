// Use Metro GUI
declare var Metro: any;
var VRButton: any;


function select3psWrapper() {
    if(selectedBases.size==0){
        api.highlight3ps();
    }
    else{
        let strands = new Set<Strand>();
        selectedBases.forEach(b=>{
            strands.add(b.strand)
        });
        clearSelection();
        api.selectElements(Array.from(strands).map(s=>s.end3));
    }
}

function select5psWrapper() {
    if(selectedBases.size==0){
        api.highlight5ps();
    }
    else{
        let strands = new Set<Strand>();
        selectedBases.forEach(b=>{
            strands.add(b.strand)
        });
        clearSelection();
        api.selectElements(Array.from(strands).map(s=>s.end5));
    }
}


function createTable(dataName: string, header: string[]) {
    let table = document.createElement("table");
    table.id = dataName;
    table.classList.add("table", "striped")
    table.dataset.role = "table";
    table.dataset.static = "false";
    table.dataset.body = dataName;
    table.dataset.check = 'true';
    let thead = document.createElement("thead");
    let tr = document.createElement("tr");
    header.forEach(name => {
        let th = document.createElement("th");
        th.innerHTML = name;
        tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);
    return table;
}

function listForces() {
    let forceDOM = document.getElementById("forces");
    forceDOM.innerHTML = "";
    forcesTable = forces.map(force=>[force.description(), force.type]);
    forceDOM.appendChild(createTable('forcesTable', ['Description', 'Type']));
    if (forceHandler) {
        forceHandler.redraw();
    }
}

function deleteSelectedForces() {
    // Remove all forces selected in the force window
    var table = $('#forcesTable').data('table');
    let removeIndices = table.getSelectedItems().map(s=>forcesTable.indexOf(s));

    forces = forces.filter((f,i)=>!removeIndices.includes(i));
    forcesTable = forcesTable.filter((f,i)=>!removeIndices.includes(i));

    forceHandler.set(forces);

    listForces();
}


function drawSystemHierarchy() {
    let checkboxhtml = (label)=> `<input onchange="render()" data-role="checkbox" data-caption="${label}">`;

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
    } else if (lut && mode !== 'Custom') {
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

function ask(title, content, onYes?, onNo?) {
    Metro.dialog.create({
        title: title,
        content: `<div>${content}</div>`,
        actions: [
            {
                caption: "Yes",
                cls: "js-dialog-close alert",
                onclick: onYes
            },
            {
                caption: "No",
                cls: "js-dialog-close",
                onclick: onNo
            }
        ]
    });
}

function notify(message: string, type?: string, keepOpen=false, title?: string) {
    let n = Metro.notify;
    if(!type) {
        type = "info";
    }
    n.create(message, title, {
        cls: type,
        timeout: 5000,
        keepOpen: keepOpen
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

    centeringElements: BasicElement[];

    basepairMessage = "Locating basepairs, please be patient...";
    vrEnabled = false;
    backboneScale = 1;
    nucleosideScale = 1;
    connectorScale = 1;
    bbconnectorScale = 1;

    constructor(doc: Document) {
        this.doc = doc;

        // Initialise toggle groups
        this.coloringMode = new ToggleGroup('coloringMode', doc, ()=>{updateColoring()});
        this.centeringMode = new ToggleGroupWithDisable('centering', doc, 'Origin', 'None');
        this.inboxingMode = new ToggleGroupWithDisable('inboxing', doc, 'Monomer', 'None');
        this.selectionMode = new ToggleGroupWithDisable('selectionScope', doc, 'Monomer', 'Disabled');
        this.transformMode = new ToggleGroupWithDisable('transform', doc, 'Translate', 'None', (g: ToggleGroupWithDisable)=>{
        // this.fluxSideBarDisplayed = false; // Bool keeping track of status of aside side bar in the fluctuation window
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

    /**
     * Show or hide a geometric component
     * @param name e.g. 'backbone'
     * @param system Specify to update a specific system, defaults to update all
     * @param value true (to show) or false (to hide), defaults to get value from UI
     */
    public setPropertyInScene(name: string, system?: System, value?: boolean) {
        let syslist: System[];
        if (system === undefined) {
            syslist = [systems, tmpSystems].flat();
        } else {
            syslist = [system];
        }
        if (value === undefined) {
            value = this.getInputBool(`${name}_toggle`);
        }
        for (const system of syslist) {
            if (scene.children.includes(system[name])) {
                if (!value) {
                    scene.remove(system[name]);
                }
            } else if (value) {
                scene.add(system[name]);
            }
        }
        render();
    }

    /**
     * Scale a component geometry by a factor
     * @param name e.g. 'backbone'
     * @param factor e.g. 0.8
     */
    public scaleComponent(name: string, factor: number) {
        // Keep track of scales
        switch (name) {
            case 'backbone': this.backboneScale *= factor; break;
            case 'nucleoside': this.nucleosideScale *= factor; break;
            case 'connector': this.connectorScale *= factor; break;
            case 'bbconnector': this.bbconnectorScale*= factor; break;
            default: console.error("Unknown component name: "+name); break;
        }
        // Scale components in all systems
        for (const system of [systems, tmpSystems].flat()) {
            const g = system[name].geometry;
            if (['backbone', 'nucleoside'].includes(name)) {
                // Scale spheres proportionally along all axes
                g.scale(factor, factor, factor);
            } else if (['connector', 'bbconnector'].includes(name)) {
                // Don't scale the length of connectors
                g.scale(factor, 1, factor);
            } else {
                console.error("Unknown component name: "+name);
            }
        }
        render();
    }

    public update3pMarker(e: BasicElement, diameter=5, length=1, spacing=.25) {
        //console.assert, "Not a 3' end!");
        if (e !== e.strand.end3)
            return;

        if ((document.getElementById("marker3pToggle") as HTMLInputElement).checked) {
            // Place in front of backbone, pointing in the A3 direction
            const p = e.getInstanceParameter3("bbOffsets").sub(e.getA3().multiplyScalar(length/2 + spacing));
            const q = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, -1, 0),
                e.getA3()
            );
            e.setInstanceParameter('bbconOffsets', p.toArray());
            e.setInstanceParameter('bbconRotation', [q.w, q.z, q.y, q.x]);
            e.setInstanceParameter('bbconScales', [diameter, length, diameter]);
        } else {
            e.setInstanceParameter("bbconScales", [0, 0, 0]);
        }
        let sys = e.dummySys ? e.dummySys : e.getSystem();
        sys.callUpdates(['instanceOffset', 'instanceRotation', 'instanceScale']);
    }

    /**
     * Reset component geometry scale
     * @param name Geometry name, e.g. 'backbone'
     */
    public resetComponentScale(name: string) {
        this.setComponentScale(name);
    }

    /**
     * Set component geometry scale
     * @param name Geometry name, e.g. 'backbone'
     * @param scale New scale of component, leave blank to reset scale to 1
     */
    public setComponentScale(name: string, scale=1) {
        switch (name) {
            case 'backbone': scale /= this.backboneScale; break;
            case 'nucleoside': scale /= this.nucleosideScale; break;
            case 'connector': scale /= this.connectorScale; break;
            case 'bbconnector': scale /= this.bbconnectorScale; break;
            default: console.error("Unknown component name: "+name); break;
        }
        this.scaleComponent(name, scale);
    }

    public setCenteringElementsFromSelection() {
        this.setCenteringElements([...selectedBases]);
        clearSelection();
    }

    public setCenteringElements(centeringElements) {
        if (centeringElements.length > 0) {
            this.centeringElements = centeringElements;
        } else {
            this.centeringElements = undefined;
        }
    }

    public enableVR() {
        if (!this.vrEnabled) {
            let vrRenderer: any;
            vrRenderer = renderer;

            // Create rig to be able to rotate the camera
            // in code. Otherwise, the camera is fixed
            var rig = new THREE.PerspectiveCamera();
            rig.add(camera);
            scene.add(rig);

            // Add vr button to document
            document.body.appendChild(VRButton.createButton(vrRenderer));

            // Enamble VR in vrRenderer
            vrRenderer.vr.enabled = true;

            // Make the camera go around the scene
            // (looks like the model is rotating)
            // Perhaps not needed for 6-DoF devices
            var rotation = 0;
            vrRenderer.setAnimationLoop(function(){
                rotation += 0.001;
                rig.position.x = Math.sin(rotation) * 5;
                rig.position.z = Math.cos(rotation) * 5;
                rig.lookAt(new THREE.Vector3(0,0,0));
                vrRenderer.render(scene, camera);
            });

            // Make controller click go to next config
            const selectListener = (event) => {
                trajReader.nextConfig();
            };
            const controller = vrRenderer.vr.getController(0);
            controller.addEventListener('select', selectListener);

            this.vrEnabled = true;
        }
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

    public getSliderInputNumber(id: string): number {
        let e = document.getElementById(id);
        if (e === null) {
            throw `Could not find slider with id "${id}"`;
        } else {
            return Metro.getPlugin(document.getElementById(id)).slider.value;
        }
    }

    public getInputValue(id: string): string {
        return (<HTMLInputElement>this.doc.getElementById(id)).value;
    }

    public  getInputElement(id: string):HTMLInputElement{
        return <HTMLInputElement>this.doc.getElementById(id);
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

    public toggleFluxWindow(id: string, oncreate?: ()=>void){
        let elem = this.doc.getElementById(id);
        if (elem) {
            Metro.window.toggle(elem);
            // flux.fluxWindowOpen = !flux.fluxWindowOpen;
            flux.toggleDatasetsandNetworks()
            // flux.flushDatasetsandNetworks();
        } else {
            this.createWindow(id, oncreate);
            // flux.fluxWindowOpen = true;
            flux.toggleDatasetsandNetworks();
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
        if (e.isPatchyParticle()) {
            hoverInfo.innerHTML = `<span style="background:#${color}4f; padding: 5px">${e.type} ${e.getSystem().id}:${e.id}</span>`;
        } else {
            hoverInfo.innerHTML = `<span style="background:#${color}4f; padding: 5px">${e.type} ${e.getSystem().id}:${e.strand.id}:${e.id}</span>`;
        }
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

    public updateImageResolutionText() {
        // Utility function to display the image resolution for saving canvas images
        let factor = parseFloat((document.getElementById('saveImageScalingFactor') as HTMLInputElement).value);
        const width = canvas.width * factor;
        const height = canvas.height * factor;

        let elem = document.getElementById('saveImageResolution');
        elem.innerHTML = `${width} x ${height}`;
    }

    public scaleCanvas(scalingFactor=2) {
        const width = canvas.width;
        const height = canvas.height;
        canvas.width = width*scalingFactor;
        canvas.height = height*scalingFactor;
        const ctx = canvas.getContext('webgl');
        ctx.viewport(0, 0, canvas.width, canvas.height);
        render();
    }

    public saveCanvasImage(scaleFactor?: number) {
        if (scaleFactor === undefined) {
            scaleFactor = parseFloat((document.getElementById('saveImageScalingFactor') as HTMLInputElement).value);
        }
        function saveImage() {
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
        new Promise((resolve) => {
            this.scaleCanvas(scaleFactor);
            resolve('success');
        }).then(() => {
            try {
                saveImage();
            } catch (error) {
                notify("Canvas is too large to save, please try a smaller scaling factor", "alert");
            }
            this.scaleCanvas(1/scaleFactor);
        });
        
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
                var t0 = performance.now();
                calc();
                var t1 = performance.now();
            console.log("Long calculation took " + (t1 - t0) + " milliseconds.")
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

    //Network Selector Methods (Protein tab)
    public addNetwork(nid : number){
        let name = "Network " + (nid+1).toString();
        let id = "Network " + (nid+1).toString() + " Select";
        let exists = !!document.getElementById(id);
        if(!exists){
            let ul = document.getElementById("networks")
            let li = document.createElement("li");
            li.setAttribute('id', id);
            li.appendChild(document.createTextNode(name));
            li.setAttribute("onclick", "selectNetworkWrapper(" + nid.toString() + ")"); // yikes
            ul.appendChild(li);
        }
    }

    public removeNetwork(nid: number){
        let id = "Network " + (nid+1).toString() + " Select";
        let exists = !!document.getElementById(id);

        if(exists) {
            let ul = document.getElementById("networks");
            let item = document.getElementById(id);
            ul.removeChild(item);
        }
    }

    public toggleDataset(gid: number){
        let GD = graphDatasets[gid];
        let name = "Dataset: " + GD.label + " Format: " + GD.datatype;
        let exists = !!document.getElementById(name);
        if(!exists){
            //exists
            this.removeGraphData(gid);
        } else {
            this.addGraphData(gid);
        }
    }

    // UI methods for adding and removing info from lists in Fluctuation tab
    public addGraphData(gid : number){
        let GD = graphDatasets[gid];
        let name = "Dataset: " + GD.label + " Format: " + GD.oDatatype; // Main label
        let elementExists = !!document.getElementById(name); // boolean return if element exists
        if(!elementExists){
            let ul = document.getElementById("datalist") //In fluctuation Window
            let li = document.createElement("li");
            let sp1 = document.createElement("span");
            let sp2 = document.createElement("span")
            sp1.setAttribute('class', 'label');
            sp2.setAttribute('class', 'second-label');
            sp1.appendChild(document.createTextNode(GD.label));
            sp2.appendChild(document.createTextNode(GD.oDatatype));
            li.setAttribute('id', name);
            li.setAttribute('value', String(gid));
            li.appendChild(sp1);
            li.appendChild(sp2);
            li.onclick = function() {flux.toggleData(li.value)};
            ul.appendChild(li);
        }
    }

    public addNetworkData(nid: number){
        let name = "Network " + (nid+1).toString();
        let exists = !!document.getElementById(name);
        if(!exists) {
            if (networks[nid].fittingReady) { // only adds networks if they are ready (edges filled basically)
                let ul = document.getElementById("readynetlist") //In fluctuation Window
                let li = document.createElement("li");
                let sp1 = document.createElement("span");
                let sp2 = document.createElement("span")
                sp1.setAttribute('class', 'label');
                sp2.setAttribute('class', 'second-label');
                let name = "Network " + (nid + 1).toString();
                sp1.appendChild(document.createTextNode(name));
                sp2.appendChild(document.createTextNode(networks[nid].networktype));
                li.setAttribute('id', name);
                li.setAttribute('value', String(nid));
                li.appendChild(sp1);
                li.appendChild(sp2);
                li.onclick = function () {
                    flux.fitData(li.value)
                };
                ul.appendChild(li);
            }
        }
    }

    public removeGraphData(gid : number){
        let GD = graphDatasets[gid];
        let name = "Dataset: " + GD.label + " Format: " + GD.oDatatype;
        let elementExists = !!document.getElementById(name); // boolean return if element exists
        if(elementExists) {
            let ul = document.getElementById("datalist");
            let li = document.getElementById(name);
            ul.removeChild(li);
        }
    }

    public removeNetworkData(nid : number){
        if(networks[nid].fittingReady){
            let ul = document.getElementById("readynetlist");
            let name = "Network " + (nid+1).toString();
            let li = document.getElementById(name);
            ul.removeChild(li);
        }
    }

}

let view = new View(document);

// This Class is basically a giant container to deal with all the graphing for the FluctuationWindow
class fluxGraph {
    title: string;
    xaxislabel: string;
    yaxislabel: string;
    data: graphData[];
    fluxWindowOpen: boolean;
    type: string;
    temp: number;
    chart; // chartjs main chart object
    units: string;
    colors;
    colorarr; // just stores colors for the graph
    charttype: string;
    chartdata;
    chartoptions;
    chartconfig; // Controls all the settings for the graph, made up of the chartdata and chartoptions variables, see chartjs for more info
    datasetCount: number; // how many datasets are currently displayed on the graph
    gids: number[]; // stores graph data indices of the datasets in global graphDatasets currently displayed on the graph
    currentindexinfo: number[][]; // stores indexing information to generate rmsf datasets, mass discretization outputs here

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
        this.currentindexinfo = [];
        this.fluxWindowOpen = false;

        // Specific to the chart
        this.charttype = 'line';
        this.chartdata = {
            labels: [],
            datasets: []
        }
        this.chartoptions = {
            elements: {
                line: {
                    tension: 0 // disables bezier curves
                }
            },
            animation: {
                duration: 0 // general animation time
                //onComplete: function () {
                //    this.chart.toBase64Image();
                //}
            },
            responsiveAnimationDuration: 0, // animation duration after a resize
            responsive: true,
            title: {
                display: true,
                text: [this.title, this.type]
            },
            tooltips: {
                mode: 'index',
                intersect: false
            },
            hover: {
                animationDuration: 0,
                mode: 'nearest',
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

    initChart() {
        const delay = ms => new Promise(res => setTimeout(res, ms));
        const wait = async () => {
            await delay(250);
            try {
                let ctx = (document.getElementById("flux") as HTMLCanvasElement).getContext('2d');
                this.chart = new Chart(ctx, this.chartconfig);
            } catch {
                notify("Graph could not be Initialized");
            }
        };
        wait();
    }

    toggleDatasetsandNetworks(){
        const delay = ms => new Promise(res => setTimeout(res, ms));
        const wait = async () => {
            await delay(300);
            try {
                flux.fluxWindowOpen = !flux.fluxWindowOpen;
                if(flux.fluxWindowOpen){
                    flux.loadDatasetsandNetworks();
                } else {
                    flux.flushDatasetsandNetworks();
                }
            } catch {
                notify("Dataset and Network Data could not be Initialized");
            }
        };
        wait();
    }

    loadDatasetsandNetworks() {
        if(graphDatasets.length > 0) graphDatasets.forEach((g, gid) => {view.addGraphData(gid);})
        if(networks.length > 0) networks.forEach((n, nid) => {if(n.fittingReady) {view.addNetworkData(nid);}})
    }

    flushDatasetsandNetworks() {
        if(graphDatasets.length > 0) graphDatasets.forEach((g, gid) => {
            try{
                view.removeGraphData(gid);
            } catch (e) {}
        })
        if(networks.length > 0) networks.forEach((n, nid) => {
            if (n.fittingReady) {
                try {
                    view.removeNetworkData(nid);
                } catch (e) {}
            }
        })
    }

    clearGraph() {
        if(this.gids.length != 0) this.gids.forEach(g => this.toggleData(g));
    }

    getYaxis(units: string) {
        return {'A_sqr': "A^2", "nm_sqr": "nm^2"}[units]; //quick conversion key
    }

    loadFluxData(){
        let input = <HTMLInputElement>document.querySelector('#fluxfile');
        let files = input.files;
        let filearr = Array.from(files)
        filearr.reverse(); // Since we use pop to access elements
        const jsonReader = new FileReader(); //read .json
        let oldGDIndx = graphDatasets.length;
        jsonReader.onload = () => {
            this.loadjson(jsonReader); //loads single dataset
        };
        jsonReader.onloadend = () => {
            let num_gds = graphDatasets.length - oldGDIndx;
            if(num_gds > 0){
                let filename = (filearr.pop().name).split(".")[0];
                for(let i = 0; i < num_gds; i++) {
                    let old_label = graphDatasets[oldGDIndx + i].label;
                    graphDatasets[oldGDIndx + i].label = old_label + filename; //rename
                    if(this.fluxWindowOpen) view.addGraphData(oldGDIndx + i); //add to flux window sidebar if its displayed
                }
                oldGDIndx = graphDatasets.length;
            }
        }

        if(files.length == 0) notify('Please Select a File');
        else {
            for (let i = 0; i < files.length; i++) { //added to graphDatasets
                jsonReader.readAsText(files[i]);
            }
        }
    }

    loadjson(jsonReader: FileReader){ //Creates Fluctuation Dataset from file
        const file = jsonReader.result as string;
        const data = JSON.parse(file);
        // const data = JSON.parse(jsonfile);
        let rmsfkey = "RMSF (nm)";
        let rmsdkey = "RMSD (nm)"
        let masskey = "simMasses";
        let coordkey = "coordinates";
        let radiikey = "radii";
        let cgkeys = ["Bfactor", "Bfactor (exp)", "Masses (ox units)", coordkey, "temp", "force constant matrix (ox units)", radiikey];
        if(rmsfkey in data){
            this.loadfluxjson(data[rmsfkey])
        } else if(rmsdkey in data) {
            this.loadfluxjson(data[rmsdkey])
        } else if(masskey in data && coordkey in data && radiikey in data){
            this.loadnetworkjson(data[masskey], data[coordkey], data[radiikey])
        } else if(cgkeys[0] in data && cgkeys[5] in data) {
            this.loadcgjson(data[cgkeys[0]], data[cgkeys[1]], data[cgkeys[2]], data[cgkeys[3]], data[cgkeys[4]], data[cgkeys[5]], data[cgkeys[6]])
        } else {
            notify('Could Not Load Json File');
        }
    }

    loadcgjson(bfactors, bfactors_exp, masses, coords, temp, fc_matrix, radii){
        this.loadnetworkjson(masses, coords, radii);
        let monomers = systems[systems.length-1].getMonomers();
        const net = new Network(networks.length, monomers);

        let N = masses.length;
        for(let i = 0; i < N; i++){
            for(let j = i+1; j < N; j++){
                if(fc_matrix[i*N+j] != null && fc_matrix[i*N+j] != 0.){
                    net.reducedEdges.addEdge(i, j, net.elemcoords.distance(i, j), 's', fc_matrix[i*N+j]);
                }
            }
        }

        // Create and Fill Vectors
        net.initInstances(net.reducedEdges.total);
        net.initEdges();
        net.fillConnections(); // fills connection array for

        net.prepVis(); // Creates Mesh for visualization
        networks.push(net); // Any network added here shows up in UI network selector
        selectednetwork = net.nid; // auto select network just loaded
        view.addNetwork(net.nid);

        let xdata = bfactors.map((val, ind) => ind+1);
        let GD = new graphData('cg_analytical', bfactors, xdata, 'bfactor', 'A_sqr'); //label needs to be re written
        graphDatasets.push(GD);

        GD = new graphData('cg_target', bfactors_exp, xdata, 'bfactor', 'A_sqr'); //label needs to be re written
        graphDatasets.push(GD);

        notify("Coarse Grained System Loaded");
    }


    loadfluxjson(fluxdata){
        let msddata = fluxdata.map(x => x**2); //rmsf to msf
        let xdata = msddata.map((val, ind) => ind+1);
        let GD = new graphData('flux', msddata, xdata, 'msf', 'nm_sqr'); //label needs to be re written
        graphDatasets.push(GD);
    }

    loadnetworkjson(masses, coordinates, radii){
        coordinates = coordinates.map(x => x.map(y => y/ 8.518)); //convert to simulation units
        radii = radii.map(x => x/ 8.518); //convert to simulation units
        //find center of mass
        let com = coordinates.reduce((a, b) => {return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]});
        com = com.map(x=>x/masses.length)
        // shift coordinates so com is dead center
        coordinates = coordinates.map(x => {
            x[0] -= com[0];
            x[1] -= com[1];
            x[2] -= com[2];
            return x;
        })

        let xpos = coordinates.map((info) => {return info[0];});
        let ypos = coordinates.map((info) => {return info[1];});
        let zpos = coordinates.map((info) => {return info[2];});
        let xmax = xpos.reduce((a,b) => {return Math.max(a, b)})
        let xmin = xpos.reduce((a,b) => {return Math.min(a, b)})
        let ymax = ypos.reduce((a,b) => {return Math.max(a, b)})
        let ymin = ypos.reduce((a,b) => {return Math.min(a, b)})
        let zmax = zpos.reduce((a,b) => {return Math.max(a, b)})
        let zmin = zpos.reduce((a,b) => {return Math.min(a, b)})
        let xdim= xmax - xmin;
        let ydim= ymax - ymin;
        let zdim= zmax - zmin;
        if(xdim < 2) xdim = 2.5;
        if(ydim < 2) ydim = 2.5;
        if(zdim < 2) zdim = 2.5;

        if(box.x < xdim) box.x = xdim*1.25;
        if(box.y < ydim) box.y = ydim*1.25;
        if(box.z < zdim) box.z = zdim*1.25;
        redrawBox();

        let dumb = new System(tmpSystems.length, 0);
        dumb.initInstances(masses.length);
        tmpSystems.push(dumb);

        let currentelemsize = elements.size;
        let realSys = new System(sysCount++, currentelemsize);
        realSys.initInstances(0);
        systems.push(realSys);
        addSystemToScene(realSys);

        let gstrand = realSys.addNewGenericSphereStrand();
        let newElems: GenericSphere[] = [];
        let last;
        for(let i: number = 0; i < masses.length; i++) {
            let be = gstrand.createBasicElement(currentelemsize + i);
            elements.push(be);
            be.sid = i;
            be.dummySys = dumb;
            be.type = 'gs';
            be.n5 = null;
            if(i != 0) {
                let prev = newElems[i-1];
                be.n3 = prev;
                prev.n5 = be;
            } else {
                be.n3 = null;
            }
            be.strand = gstrand;
            be.mass = masses[i];
            be.radius = radii[i];
            newElems.push(be);
            last = be;
        }
        gstrand.setFrom(last);

        let pos = new THREE.Vector3(0., 0., 0.);
        newElems.forEach((e, eid) => {
            let tmp = coordinates[eid]
            pos.x = tmp[0];
            pos.y = tmp[1];
            pos.z = tmp[2];
            e.calcPositions(pos);
        })

        addSystemToScene(dumb); // add tmpSys to scene

        const InstMassSys = newElems.map(e => new InstanceCopy(e));
        editHistory.add(new RevertableAddition(InstMassSys, newElems));

        // flux.prepIndxButton(ret["indx"]);
    }

    initializeGraph() {
        // onCreate parameter of toggleWindow won't initialize this correctly
        // taken from https://stackoverflow.com/questions/14226803/wait-5-seconds-before-executing-next-line
        // wait 75 ms then initialize chart
        const delay = ms => new Promise(res => setTimeout(res, ms));
        const wait = async () => {
            await delay(75);
            try {
                let ctx = (document.getElementById("flux") as HTMLCanvasElement).getContext('2d');
                this.chart = new Chart(ctx, this.chartconfig);
            } catch {
                notify("Graph could not be Initialized");
            }
        };
        wait();
    }

    setType(type: string) { //type can be bfactor or msf
        this.type = type;
    };

    setTemp(temp: number) { // Kelvin
        this.temp = temp;
    };

    addDatatoGraph(gid: number) {
        let GD = graphDatasets[gid];
        if (this.chart == null) {
            this.initializeGraph();
        }
        // Rewrites graph width with the chart.data.labels
        let currlens = this.gids.map(g => {return graphDatasets[g].xdata.length});
        let longest = Math.max(...currlens) > GD.xdata.length ? Math.max(...currlens) : GD.xdata.length;
        if (longest != this.chart.data.labels.length) {
            this.chart.data.labels = [...Array(longest).keys()]; // Rewrites x data to always start from 0 and go up
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

    applyCurrentIndx(mode:string = "avg") {
        if(this.gids.length != 1){
            notify("Please Select a Single Dataset to Apply Indexing To");
            return;
        }
        let gid = this.gids[0];
        let GD = graphDatasets[gid];
        this.toggleData(gid);
        try {
            let newData = [];
            let newXData = [];
            if(mode == 'avg'){
                let currentYdata =  this.currentindexinfo.map(d => { //get particle numbers same as index
                    return d.map(x => {return GD.data[x]});
                })
                for(let i = 0; i < this.currentindexinfo.length; i++){
                    let parents = this.currentindexinfo[i]; //list of particle ids representing each particle i
                    let parentvals = currentYdata[i].slice();
                    let avg = parentvals.reduce((a, b) => a+b)/parents.length; //average
                    newData.push(avg);
                    newXData.push(i);
                }
                GD.xdata = newXData.slice();
                GD.data = newData.slice();
                GD.label += ' avg_indexed';
            }
        } catch (e) {
            notify("Indexing could not be applied")
        }
        this.toggleData(gid);
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

        // make format msf for fitting
        let Targetmsf;
        if(GD.datatype == "bfactor") {
            Targetmsf = GD.data.slice().map(b => b*(3/(8*Math.pow(Math.PI, 2))));
        } else {
            Targetmsf = GD.data.slice(); //must be msf
        }

        // get network, make sure edges are there, otherwise nothing to calculate
        let net = networks[nid];

        if(net.particles.length > 1500){
            notify("Large Networks (n>1500) cannot be solved here. Please use the Python scripts provided at https://github.com/sulcgroup/anm-oxdna");
            return;
        }

        if(net.reducedEdges.total == 0) {
            notify("Network's Edges must be filled prior to Fitting");
            return;
        }

        // checks data you are fitting is exact same length, might need to make changes to this later
        if(net.particles.length != Targetmsf.length) {
            notify("Target Data is a different length than network, will not Fit");
            return;
        }

        // ANM Solving, only one for a little bit
        if(net.networktype == 'ANM' || net.networktype == 'ANMT'){
            let msf = [];
            if (window.Worker) {
                const mainWorker = new Worker('./dist/model/anm_worker.js');
                notify("Fitting Network " + (nid+1).toString() + " to " + " Dataset " + GD.label);
                let temp = view.getInputNumber('temp');

                function activate() {
                    var promise = new Promise(function (resolve, reject) {
                        var counter = 0;
                        // var array = [];
                        var callback = function (message) {
                            counter++;

                            msf = msf.concat(message.data);
                            //And when all workers ends, resolve the promise
                            if (counter >= 1 && msf.length > 0) {
                                //We resolve the promise with the array of results.
                                let fit = findLineByLeastSquaresNoIntercept(msf, Targetmsf);
                                let xvals = fit[0];
                                let fitval = fit[1];
                                let m = <number> fit[2];
                                let k = 1/m; //N*10^-10/A (k*100 = pN/A)
                                let sim_k = k/net.simFC; //convert force constant to simulation reduced units for force constants 1 pN/A = 0.05709

                                // msf is returned currently to check the Hessian inversion process
                                let gendata = new graphData(GD.label + " Fit " + net.cutoff.toString() + "A", fitval, GD.xdata, "msf", "A_sqr");
                                gendata.gammaSim = sim_k;
                                net.reducedEdges.ks = net.reducedEdges.ks.map(k => {return sim_k;});
                                let ngid = graphDatasets.length;
                                graphDatasets.push(gendata);
                                view.addGraphData(ngid);
                                notify("ANM Fitting Complete, Please check under Available Datasets in the Fluctuation Solver");
                                resolve(message.data);
                            }
                        }

                        mainWorker.onmessage = callback;
                        mainWorker.postMessage([net.elemcoords.xI.slice(), net.elemcoords.yI.slice(), net.elemcoords.zI.slice(),
                            net.reducedEdges.p1.slice(), net.reducedEdges.p2.slice(), net.reducedEdges.ks.slice(),
                            net.masses.slice(), temp]);

                    });
                    return promise;
                }

                activate().then(r => mainWorker.terminate());

            } else {
                console.log("No Webworker Found");
                return;
            }
            // This should be interesting
        }
    };

    downloadChart(){
        var a = document.createElement('a');
        a.href = this.chart.toBase64Image(); //declared in chart.options.animate
        a.download = 'fluxchart.png';
        // Trigger the download
        a.click();
    };

    downloadGraphDatasets(){
        this.gids.forEach(g => {
            makeFluctuationFile(g);
        });
    };

    prepIndxButton(indx){
        let ib = document.getElementById('indxbutton');
        ib.onclick = function(){makeIndxFile(indx)};
        flux.currentindexinfo = indx.slice();
        // $('indxbutton').on("click", function() {
        //     makeIndxFile(indx);
        // })
    };

    prepJSONButton(nid){ // this function doesn't really belong here
        let jb = document.getElementById('jsonbutton');
        jb.onclick = function(){makeNetworkJSONFile(nid)};
    };

}

// Fluctuation Chart Manager
const flux = new fluxGraph("msf", "A_sqr");
