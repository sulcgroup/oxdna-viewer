// <reference path="./three/index.d.ts" />
canvas.addEventListener("keydown", event => {
    switch (event.key.toLowerCase()) {
        //Save image on "p" press
        case 'p':
            renderer.domElement.toBlob(function (blob) {
                var a = document.createElement('a');
                var url = URL.createObjectURL(blob);
                a.href = url;
                a.download = 'canvas.png';
                a.click();
            }, 'image/png', 1.0);
            break;
        // Mapping the next and prev to the arrow keys
        case 'arrowright':
            trajReader.nextConfig();
            break;
        case 'arrowleft':
            trajReader.previousConfig();
            break;
        // Copy, cut, paste and delete. Holding shift pastes with preserved location
        case 'c':
            if (event.ctrlKey) {
                copyWrapper();
            }
            break;
        case 'x':
            if (event.ctrlKey) {
                cutWrapper();
            }
            break;
        case 'v':
            if (event.ctrlKey) {
                pasteWrapper(event.shiftKey);
            }
            break;
        case 'delete':
            deleteWrapper();
            break;
        // Undo: ctrl-z
        // Redo: ctrl-shift-z or ctrl-y
        case 'z':
            if (event.ctrlKey) {
                if (event.shiftKey) {
                    editHistory.redo();
                }
                else {
                    editHistory.undo();
                }
            }
            break;
        case 'y':
            if (event.ctrlKey) {
                editHistory.redo();
            }
            break;
        // Select everything not selected:
        case 'i':
            if (event.ctrlKey) {
                event.preventDefault();
                invertSelection();
            }
            break;
        // Select all elements:
        case 'a':
            if (event.ctrlKey) {
                event.preventDefault();
                selectAll();
            }
            break;
        // Transform controls:
        case 't':
            transformControls.setMode('translate');
            break;
        case 'r':
            transformControls.setMode('rotate');
            break;
        case 'shift':
            transformControls.setTranslationSnap(1);
            transformControls.setRotationSnap(Math.PI / 12);
            break;
        case 's':
            // Save output
            if (event.ctrlKey) {
                event.preventDefault();
                makeOutputFiles();
                break;
            }
            // Toggle selection:
            let selectToggle = document.getElementById("selectToggle");
            selectToggle.checked = !selectToggle.checked;
            break;
        // Toggle dragging:
        case 'd':
            let transformToggle = document.getElementById("transformToggle");
            transformToggle.checked = !transformToggle.checked;
            showTransformControl(transformToggle);
            break;
        case 'f1':
            toggleModal("keyboardShortcuts");
            break;
    }
    // Key is value of the key, e.g. '1', while code is the id of
    // the specific key, e.g. 'Numpad1'.
    let stepAngle = Math.PI / 12;
    switch (event.code) {
        case 'Numpad1':
            if (event.ctrlKey) {
                controls.setToAxis(new THREE.Vector3(-1, 0, 0));
                break;
            }
            else {
                controls.setToAxis(new THREE.Vector3(1, 0, 0));
                break;
            }
        case 'Numpad2':
            controls.stepAroundAxis(new THREE.Vector3(-1, 0, 0), stepAngle);
            break;
        case 'Numpad3':
            if (event.ctrlKey) {
                controls.setToAxis(new THREE.Vector3(0, -1, 0));
                break;
            }
            else {
                controls.setToAxis(new THREE.Vector3(0, 1, 0));
                break;
            }
        case 'Numpad4':
            controls.stepAroundAxis(new THREE.Vector3(0, 1, 0), stepAngle);
            break;
        case 'Numpad5':
            controls.reset();
            break;
        case 'Numpad6':
            controls.stepAroundAxis(new THREE.Vector3(0, -1, 0), stepAngle);
            break;
        case 'Numpad7':
            if (event.ctrlKey) {
                controls.setToAxis(new THREE.Vector3(0, 0, -1));
                break;
            }
            else {
                controls.setToAxis(new THREE.Vector3(0, 0, 1));
                break;
            }
        case 'Numpad8':
            controls.stepAroundAxis(new THREE.Vector3(1, 0, 0), stepAngle);
            break;
        case 'Numpad9':
            if (event.ctrlKey) {
                controls.setToAxis(new THREE.Vector3(0, 0, 1));
                break;
            }
            else {
                controls.setToAxis(new THREE.Vector3(0, 0, -1));
                break;
            }
    }
});
canvas.addEventListener("keyup", event => {
    switch (event.key.toLowerCase()) {
        case "shift":
            transformControls.setTranslationSnap(null);
            transformControls.setRotationSnap(null);
            break;
    }
});
