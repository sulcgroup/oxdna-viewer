/**
 * Create a level in the System Hierarchy; Either system, strand or monomer.
 * @param parent Parent HTML container
 * @param label Text to display for this item
 * @param onClick Function to call if text is clicked
 * @param onEdit Function to call if edit button is clicked
 * @param onVisibilityToggle Function to call if the visibility button is clicked
 * @param expanded If true, automatically show child elements
 * @param isBottom If true, don't add any child elements
 * @returns Returns the child container, unless isBottom is true
 */
function drawHierarchyLevel(parent, label, onClick, onEdit, onVisibilityToggle, expanded, isBottom) {
    // Create level div
    const level = document.createElement('div');
    level.style.paddingLeft = "10px";
    const levelLabel = document.createElement('i');
    levelLabel.innerHTML = label;
    levelLabel.onclick = onClick;
    levelLabel.style.cursor = 'pointer';
    // Create edit label icon
    const editIcon = document.createElement('i');
    editIcon.classList.add('material-icons');
    editIcon.innerHTML = 'edit';
    editIcon.onclick = onEdit;
    // Create visibility toggle icon
    const toggleVisIcon = document.createElement('i');
    toggleVisIcon.classList.add('material-icons');
    toggleVisIcon.innerHTML = 'visibility';
    toggleVisIcon.onclick = () => {
        let visible = toggleVisIcon.innerHTML == 'visibility';
        toggleVisIcon.innerHTML = visible ? 'visibility_off' : 'visibility';
        onVisibilityToggle(visible);
    };
    if (isBottom) {
        level.appendChild(levelLabel);
        parent.appendChild(level);
        level.appendChild(editIcon);
        level.appendChild(toggleVisIcon);
        return;
    }
    else {
        // Create container and buttons for child elements
        const expandButton = document.createElement('i');
        expandButton.classList.add('material-icons');
        expandButton.innerHTML = "arrow_right";
        const childContainer = document.createElement('div');
        childContainer.hidden = !expanded;
        expandButton.onclick = (event) => {
            if (childContainer.hidden) {
                expandButton.innerHTML = 'arrow_drop_down';
            }
            else {
                expandButton.innerHTML = 'arrow_right';
            }
            childContainer.hidden = !childContainer.hidden;
        };
        level.appendChild(expandButton);
        level.appendChild(levelLabel);
        level.appendChild(editIcon);
        level.appendChild(toggleVisIcon);
        level.appendChild(childContainer);
        parent.appendChild(level);
        return childContainer;
    }
}
/**
 * Draw the system hierarchy option content
 */
function drawSystemHierarchy() {
    const opt = document.getElementById("hierarchyContent");
    if (!opt.hidden) {
        opt.innerHTML = ""; // Clear
        // Add each system
        systems.forEach(system => {
            let strands = drawHierarchyLevel(opt, system.label ? system.label : `System: ${system.systemID}`, (event) => { system.toggleStrands(); updateView(system); }, () => { system.label = prompt("Please enter system label"); drawSystemHierarchy(); }, (visible) => api.toggleElements(system.getMonomers()), true);
            // Add each strand in system
            system.strands.forEach(strand => {
                let monomers = drawHierarchyLevel(strands, strand.label ? strand.label : `Strand: ${strand.strandID}`, (event) => { strand.toggleMonomers(); updateView(system); }, () => { strand.label = prompt("Please enter strand label"); drawSystemHierarchy(); }, (visible) => api.toggleStrand(strand));
                // Add each monomer in strand
                strand.monomers.forEach(monomer => {
                    drawHierarchyLevel(monomers, `${monomer.gid}: ${monomer.type}`.concat(monomer.label ? ` (${monomer.label})` : ""), (event) => { monomer.toggle(); updateView(system); }, () => { monomer.label = prompt("Please enter monomer label"); drawSystemHierarchy(); }, () => api.toggleElements([monomer]), false, true);
                });
            });
        });
    }
}
function toggleFieldSet(elem) {
    let elems = elem.parentElement.children;
    for (let i = 0; i < elems.length; i++) {
        if (elems[i] !== elem) {
            elems[i]['hidden'] = !elems[i]['hidden'];
        }
    }
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
function toggleModal(id) {
    let modal = document.getElementById(id);
    modal.classList.toggle("show-modal");
}
function toggleOptions(id) {
    let opt = document.getElementById(id);
    opt.hidden = !opt.hidden;
}
function colorOptions() {
    const opt = document.getElementById("colorOptionContent");
    if (!opt.hidden) {
        opt.innerHTML = ""; //Clear content
        const addButton = document.createElement('button');
        addButton.innerText = "Add Color";
        // Append new color to the end of the color list and reset colors
        addButton.onclick = function () {
            backboneColors.push(new THREE.Color(0x0000ff));
            colorOptions();
        };
        //modifies the backboneColors array
        for (let i = 0; i < backboneColors.length; i++) {
            let m = backboneColors[i];
            let c = document.createElement('input');
            c.type = 'color';
            c.value = "#" + m.getHexString();
            c.onchange = function () {
                backboneColors[i] = new THREE.Color(c.value);
                colorOptions();
            };
            //deletes color on right click
            c.oncontextmenu = function (event) {
                event.preventDefault();
                backboneColors.splice(i, 1);
                colorOptions();
                return false;
            };
            opt.appendChild(c);
        }
        opt.appendChild(addButton);
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
function colorSelection() {
    const opt = document.getElementById("colorSelectionContent");
    if (!opt.hidden) {
        opt.innerHTML = ""; // clear content
        const setButton = document.createElement('button');
        setButton.innerText = "Set Color";
        // create color map with selected color
        setButton.onclick = () => {
            setColoringMode("Overlay");
            const colorSelect = new THREE.Color(colorInput.value);
            if (lut == undefined) {
                lut = new THREE.Lut(defaultColormap, 512);
                // legend is necessary to set 'color by' to Overlay, gets removed later
                lut.setLegendOn({ 'layout': 'horizontal', 'position': { 'x': 0, 'y': 0, 'z': 0 }, 'dimensions': { 'width': 2, 'height': 12 } });
                lut.setLegendLabels({ 'title': "hide me please", 'ticks': 1 });
            }
            // initialize lutCols to existing colors
            for (let i = 0; i < systems.length; i++) {
                const system = systems[i];
                const end = system.bbColors.length;
                for (let j = 0; j < end; j += 3) {
                    const r = system.bbColors[j];
                    const g = system.bbColors[j + 1];
                    const b = system.bbColors[j + 2];
                    system.lutCols[j / 3] = new THREE.Color(r, g, b);
                }
            }
            // set lutCols to selected color
            selectedBases.forEach(e => {
                let sid = e["gid"] - e.getSystem().globalStartId;
                e.getSystem().lutCols[sid] = colorSelect;
            });
            setColoringMode("Overlay");
            if (!systems.some(system => system.colormapFile)) {
                api.removeColorbar();
            }
        };
        let colorInput = document.createElement('input');
        colorInput.type = 'color';
        opt.appendChild(colorInput);
        opt.appendChild(setButton);
    }
}
;
function toggleVisArbitrary() {
    // arbitrary visibility toggling
    // toggle hidden monomers
    if (selectedBases.size == 0) {
        systems.forEach(system => {
            system.strands.forEach(strand => {
                strand.monomers.forEach(monomer => {
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
    clearSelection();
}
function notify(message) {
    const noticeboard = document.getElementById('noticeboard');
    // Remove any identical notifications from the board
    for (let notification of noticeboard.children) {
        if (notification.innerHTML === message) {
            noticeboard.removeChild(notification);
        }
    }
    // Create a new notification
    const notification = document.createElement('div');
    notification.className = "notification";
    notification.innerHTML = message;
    // Add it to the board and remove it on mouseover
    // or after 5 seconds
    const remove = function () {
        try {
            noticeboard.removeChild(notification);
        }
        catch (e) { } // Notification already removed
    };
    notification.onmouseover = remove;
    noticeboard.appendChild(notification);
    setTimeout(remove, 5000);
}
let basepairMessage = "Locating basepairs, please be patient...";
function longCalculation(calc, message, callback) {
    // Create an information modal
    const modal = document.getElementById('pause');
    const notification = document.createElement('div');
    notification.className = "modal-content";
    notification.innerHTML = message;
    modal.appendChild(notification);
    modal.classList.add("show-modal");
    // Set wait cursor and request an animation frame to make sure
    // that it gets changed before starting calculation:
    let dom = document.activeElement;
    dom['style'].cursor = "wait";
    requestAnimationFrame(() => requestAnimationFrame(() => {
        try {
            calc();
        }
        catch (error) {
            notify(`Sorry, something went wrong with the calculation: ${error}`);
        }
        // Change cursor back and remove modal
        dom['style'].cursor = "auto";
        modal.removeChild(notification);
        modal.classList.remove("show-modal");
        if (callback) {
            callback();
        }
    }));
}
