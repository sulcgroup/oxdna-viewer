function drawLevel(parent: HTMLElement, label: string, onclick: (event)=>void, isBottom?: Boolean): HTMLElement {
    const level = document.createElement('div');
    level.style.paddingLeft ="10px";
    const levelLabel = document.createElement('i');
    levelLabel.innerHTML = label;
    levelLabel.onclick = onclick;
    levelLabel.style.cursor = 'pointer';

    if (isBottom) {
        level.appendChild(levelLabel);
        parent.appendChild(level);
        return;
    } else {
        const expandButton = document.createElement('i');
        expandButton.classList.add('material-icons');
        expandButton.innerHTML = "arrow_right";
        const childContainer = document.createElement('div');
        childContainer.hidden = true;

        expandButton.onclick = (event: MouseEvent)=> {
            if(childContainer.hidden) {
                expandButton.innerHTML = 'arrow_drop_down';
            } else {
                expandButton.innerHTML = 'arrow_right';
            }
            childContainer.hidden = !childContainer.hidden;
        };
        const editText = document.createElement('i');
        editText.classList.add('material-icons');
        editText.innerHTML = 'edit';
        level.appendChild(expandButton);
        level.appendChild(levelLabel);
        level.appendChild(editText);
        level.appendChild(childContainer);
        parent.appendChild(level);
        return childContainer;
    }
}

function hierarchy() {
    const opt: HTMLElement = document.getElementById("hierarchyContent");
    if (!opt.hidden) {
        opt.innerHTML = ""; // Clear
        systems.forEach(system=>{
            let strands = drawLevel(opt, `System: ${system.systemID}`, (event)=>{system.toggleStrands(); updateView(system)});
            system.strands.forEach(strand=>{
                let monomers = drawLevel(strands, `Strand: ${strand.strandID}`, (event)=>{strand.toggleMonomers(); updateView(system)});
                strand.monomers.forEach(monomer=>{
                    drawLevel(monomers, `${monomer.gid}: ${monomer.type}`, (event)=>{monomer.toggle(); updateView(system)}, true);
                });
            });
        });
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
    const opt: HTMLElement = document.getElementById("colorOptionContent");
    if (!opt.hidden) {
        opt.innerHTML = "";  //Clear content
        const addButton = document.createElement('button');
        addButton.innerText = "Add Color";
        // Append new color to the end of the color list and reset colors
        addButton.onclick = function () {
            backboneColors.push(new THREE.Color(0x0000ff));
            colorOptions();
        }

        //modifies the backboneColors array
        for (let i = 0; i < backboneColors.length; i++) {
            let m = backboneColors[i];
            let c = document.createElement('input');
            c.type = 'color';
            c.value = "#" + m.getHexString();
            c.onchange = function () {
                backboneColors[i] = new THREE.Color(c.value);
                colorOptions();
            }
            
            //deletes color on right click
            c.oncontextmenu = function (event) {
                event.preventDefault();
                backboneColors.splice(i, 1);
                colorOptions();
                return false;
            }
            opt.appendChild(c);
        }
        opt.appendChild(addButton);

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

function notify(message: string) {
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
    const remove = function() {
        try {noticeboard.removeChild(notification);}
        catch (e) {} // Notification already removed
    }
    notification.onmouseover = remove;
    noticeboard.appendChild(notification);
    setTimeout(remove, 5000);
}

let basepairMessage = "Locating basepairs, please be patient...";
function longCalculation(calc: () => void, message: string, callback?: () => void) {
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
        } catch (error) {
           notify(`Sorry, something went wrong with the calculation: ${error}`);
        }

        // Change cursor back and remove modal
        dom['style'].cursor = "auto";
        modal.removeChild(notification);
        modal.classList.remove("show-modal");
        if(callback) {
            callback();
        }
    }));
}