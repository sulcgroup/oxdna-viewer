function drawSystemHierarchy() {
    let checkboxhtml = (label) => `<input data-role="checkbox" data-caption="${label}">`;
    const includeMonomers = document.getElementById("hierarchyMonomers").checked;
    const content = document.getElementById("hierarchyContent");
    content.innerText = '';
    let hierarchy = Metro.makePlugin(content, "treeview", {
        onCheckClick: (state, check, node, tree) => {
            let n = $(node);
            let element = n.data('monomer');
            if (element) {
                if (check.checked) {
                    element.select();
                }
                else {
                    element.deselect();
                }
                updateView(element.getSystem());
                return;
            }
            let strand = n.data('strand');
            if (strand) {
                if (check.checked) {
                    strand.select();
                }
                else {
                    strand.deselect();
                }
                updateView(strand.system);
                return;
            }
            let system = n.data('system');
            if (system) {
                if (check.checked) {
                    system.select();
                }
                else {
                    system.deselect();
                }
                updateView(system);
                return;
            }
        },
        showChildCount: true
    });
    let treeview = hierarchy.data('treeview');
    let checkboxMap = new Map();
    // Add checkbox nodes for, systems, strands and monomers
    for (const system of systems) {
        let systemNode = treeview.addTo(null, {
            html: checkboxhtml(system.label ? system.label : `System ${system.id}`)
        });
        systemNode.data('system', system);
        for (const strand of system.strands) {
            let monomers = strand.getMonomers();
            let strandNode = treeview.addTo(systemNode, {
                html: checkboxhtml(strand.label ? strand.label : `Strand ${strand.id}` +
                    ` (${monomers.length}${strand.isCircular() ? ' circular' : ''})`)
            });
            strandNode.data('strand', strand);
            if (includeMonomers) {
                let addMonomer = (monomer) => {
                    let color = monomer.elemToColor(monomer.type).getHexString();
                    let monomerNode = treeview.addTo(strandNode, {
                        html: checkboxhtml(`id: ${monomer.id}`.concat(monomer.label ? ` (${monomer.label})` : "")) +
                            `<span style="background:#${color}4f; padding: 5px">${monomer.type}</span>`
                    });
                    monomerNode.data('monomer', monomer);
                    // Save reference for checbox in map:
                    let checkbox = monomerNode.find("input")[0];
                    checkbox.checked = selectedBases.has(monomer);
                    checkboxMap.set(monomer.id, checkbox);
                };
                for (const [i, monomer] of monomers.entries()) {
                    if (i < 20) {
                        addMonomer(monomer);
                    }
                    else {
                        let moreNode = treeview.addTo(strandNode, {
                            caption: `View remaining ${monomers.length - i} monomers`,
                            icon: '<span class="mif-plus"></span>'
                        });
                        moreNode[0].onclick = () => {
                            treeview.del(moreNode);
                            for (let j = i; j < monomers.length; j++) {
                                addMonomer(monomers[j]);
                            }
                        };
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
function handleMenuAction(event) {
    switch (event) {
        case "undo":
            editHistory.undo();
            break;
        case "redo":
            editHistory.redo();
            break;
        case "del":
            deleteWrapper();
            break;
        case "cut":
            cutWrapper();
            break;
        case "copy":
            copyWrapper();
            break;
        case "paste":
            pasteWrapper(false);
            break;
        case "all":
            selectAll();
            break;
        case "invert":
            invertSelection();
            break;
        case "clear":
            clearSelection();
            break;
    }
}
function updateColorPalette() {
    const opt = document.getElementById("colorPaletteContent");
    if (!opt.hidden) {
        opt.innerHTML = ""; //Clear content
        //modifies the backboneColors array
        for (let i = 0; i < backboneColors.length; i++) {
            let m = backboneColors[i];
            let c = document.createElement('input');
            c.type = 'color';
            c.value = "#" + m.getHexString();
            c.onchange = function () {
                backboneColors[i] = new THREE.Color(c.value);
                updateColorPalette();
            };
            //deletes color on right click
            c.oncontextmenu = function (event) {
                event.preventDefault();
                backboneColors.splice(i, 1);
                updateColorPalette();
                return false;
            };
            opt.appendChild(c);
        }
        //actually update things in the scene
        elements.forEach(e => {
            if (!selectedBases.has(e)) {
                e.updateColor();
            }
        });
        systems.forEach(s => {
            s.callUpdates(['instanceColor']);
        });
        tmpSystems.forEach(s => {
            s.callUpdates(['instanceColor']);
        });
        render();
    }
}
;
function initLutCols(systems) {
    for (let i = 0; i < systems.length; i++) {
        const system = systems[i];
        for (let j = 0; j < system.bbColors.length; j += 3) {
            const r = system.bbColors[j];
            const g = system.bbColors[j + 1];
            const b = system.bbColors[j + 2];
            system.lutCols[j / 3] = new THREE.Color(r, g, b);
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
function colorElements(color, elems) {
    if (!color) {
        let colorInput = document.getElementById("customColor");
        color = new THREE.Color(colorInput.value);
    }
    if (!elems) {
        elems = Array.from(selectedBases);
    }
    if (elems.length == 0) {
        notify("Please first select the elements you wish to color");
    }
    if (lut == undefined) {
        lut = new THREE.Lut(defaultColormap, 512);
        // legend needed to set 'color by' to Overlay, gets removed later
        lut.setLegendOn();
        lut.setLegendLabels();
    }
    else {
        const emptyTmpSystems = tmpSystems.filter(tmpSys => tmpSys.lutCols.length == 0);
        if (emptyTmpSystems.length > 0) {
            console.log(emptyTmpSystems);
            initLutCols(emptyTmpSystems);
        }
        view.coloringMode.set("Overlay");
    }
    initLutCols(systems);
    initLutCols(tmpSystems);
    elems.forEach(e => {
        let sid;
        if (e.dummySys) {
            sid = e["id"] - e.dummySys.globalStartId;
            e.dummySys.lutCols[e.sid] = color;
        }
        sid = e["id"] - e.getSystem().globalStartId;
        e.getSystem().lutCols[sid] = color;
    });
    view.coloringMode.set("Overlay");
    if (!systems.some(system => system.colormapFile)) {
        api.removeColorbar();
    }
    clearSelection();
}
//toggles display of coloring by json file / structure modeled off of base selector
function updateColoring(mode) {
    if (!mode) {
        mode = view.coloringMode.get();
    }
    else {
        view.coloringMode.set(mode);
    }
    if (mode === "Overlay") {
        if (lut) {
            if (colorbarScene.children.length == 0 && systems.some(system => system.colormapFile)) {
                api.showColorbar();
            }
        }
        else {
            notify("Please drag and drop the corresponding .json file.");
            view.coloringMode.set("Strand");
            return;
        }
    }
    else if (lut) {
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
        systems.forEach(system => {
            system.strands.forEach(strand => {
                strand.forEach(monomer => {
                    if (monomer.getInstanceParameter3("visibility").x == 0)
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
function notify(message, type, title) {
    let n = Metro.notify;
    if (!type) {
        type = "info";
    }
    n.create(message, title, {
        cls: type,
        timeout: 5000
    });
    console.info(`Notification: ${message}`);
}
function setBackgroundImage() {
    let file = document.getElementById("backgroundInput").files[0];
    let reader = new FileReader();
    reader.onloadend = function () {
        document.getElementById('threeCanvas').style.backgroundImage = "url(" + reader.result + ")";
    };
    if (file) {
        reader.readAsDataURL(file);
    }
}
function setBackgroundColor() {
    let color = document.getElementById("backgroundColor").value;
    document.getElementById('threeCanvas').style.background = color;
}
class ToggleGroup {
    constructor(id, doc, onChange) {
        this.id = id;
        this.doc = doc;
        this.onChange = onChange;
    }
    set(value) {
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
    get() {
        return this.doc.getElementById(this.id).querySelector('.active').querySelector('.caption').innerHTML;
    }
}
class ToggleGroupWithDisable extends ToggleGroup {
    constructor(id, doc, lastActive, disabled, onChange) {
        super(id, doc, onChange);
        this.lastActive = lastActive;
        this.disabled = disabled;
    }
    toggle() {
        this.enabled() ? this.disable() : this.enable();
    }
    disable() {
        if (this.enabled()) {
            this.lastActive = this.get();
            this.set(this.disabled);
        }
    }
    ;
    enable() {
        if (!this.enabled()) {
            this.set(this.lastActive);
        }
    }
    ;
    enabled() {
        return this.get() !== this.disabled;
    }
}
class View {
    constructor(doc) {
        this.basepairMessage = "Locating basepairs, please be patient...";
        this.doc = doc;
        // Initialise toggle groups
        this.coloringMode = new ToggleGroup('coloringMode', doc, () => { updateColoring(); });
        this.centeringMode = new ToggleGroupWithDisable('centering', doc, 'Origin', 'None');
        this.inboxingMode = new ToggleGroupWithDisable('inboxing', doc, 'Monomer', 'None');
        this.selectionMode = new ToggleGroupWithDisable('selectionScope', doc, 'Monomer', 'Disabled');
        this.transformMode = new ToggleGroupWithDisable('transform', doc, 'Translate', 'None', (g) => {
            // If we should show something
            if (g.enabled()) {
                // Make sure something is selected
                if (selectedBases.size > 0) {
                    transformControls.show();
                    transformControls.setMode(g.get().toLowerCase());
                }
                else {
                    notify("Please select elements to transform");
                    g.disable();
                }
            }
            else {
                transformControls.hide();
            }
        });
    }
    sectionClicked() {
        let s = document.getElementsByClassName("section active")[0];
        s.hidden = !s.hidden;
    }
    getRandomHue() {
        return new THREE.Color(`hsl(${Math.random() * 360}, 100%, 50%)`);
    }
    getInputNumber(id) {
        return parseFloat(this.getInputValue(id));
    }
    getInputValue(id) {
        return this.doc.getElementById(id).value;
    }
    getInputBool(id) {
        return document.getElementById(id).checked;
    }
    isWindowOpen(id) {
        let elem = this.doc.getElementById(id);
        if (elem) {
            // Should work but doesn't
            //return Metro.window.isOpen(elem);
            return elem.parentElement.parentElement.style.display != "none";
        }
        else {
            return false;
        }
    }
    toggleWindow(id, oncreate) {
        let elem = this.doc.getElementById(id);
        if (elem) {
            Metro.window.toggle(elem);
        }
        else {
            this.createWindow(id, oncreate);
        }
    }
    createWindow(id, oncreate) {
        fetch(`windows/${id}.json`)
            .then(response => response.json())
            .then(data => {
            let w = Metro.window.create(data);
            w[0].id = id;
            w.load(`windows/${id}.html`).then(oncreate);
        });
    }
    showHoverInfo(pos, e) {
        let hoverInfo = document.getElementById('hoverInfo');
        let color = e.elemToColor(e.type).getHexString();
        hoverInfo.innerHTML = `<span style="background:#${color}4f; padding: 5px">${e.type} ${e.getSystem().id}:${e.strand.id}:${e.id}</span>`;
        hoverInfo.style.left = pos.x + 'px';
        hoverInfo.style.top = pos.y + 20 + 'px';
        hoverInfo.hidden = false;
    }
    hideHoverInfo() {
        document.getElementById('hoverInfo').hidden = true;
    }
    selectPairs() {
        return this.doc.getElementById("selectPairs").checked;
    }
    saveCanvasImage() {
        canvas.toBlob(function (blob) {
            var a = document.createElement('a');
            var url = URL.createObjectURL(blob);
            a.href = url;
            a.download = 'canvas.png';
            a.click();
        }, 'image/png', 1.0);
        //get the colorbar too
        if (colorbarScene.children.length != 0) {
            renderColorbar();
            colorbarCanvas.toBlob(function (blob) {
                var a = document.createElement('a');
                var url = URL.createObjectURL(blob);
                a.href = url;
                a.download = 'colorbar.png';
                a.click();
            }, 'image/png', 1.0);
        }
    }
    longCalculation(calc, message, callback) {
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
            }
            catch (error) {
                notify(`Sorry, something went wrong with the calculation: ${error}`, "alert");
            }
            // Change cursor back and remove modal
            dom['style'].cursor = "auto";
            Metro.activity.close(activity);
            if (callback) {
                callback();
            }
        }));
    }
}
let view = new View(document);
