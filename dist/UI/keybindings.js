/// <reference path="../typescript_definitions/index.d.ts" />
/// <reference path="../typescript_definitions/oxView.d.ts" />
canvas.addEventListener("keydown", event => {
    switch (event.key.toLowerCase()) {
        // Save image on "p" press
        case 'p':
            view.saveCanvasImage();
            break;
        //show/hide menu
        case 'm':
            let menu = document.getElementById('menu');
            menu.hidden = !menu.hidden;
            break;
        // Mapping the next and prev to the arrow keys
        case 'arrowright':
            if (trajReader.lookupReader.readyState != 1)
                trajReader.nextConfig();
            break;
        case 'arrowleft':
            if (trajReader.lookupReader.readyState != 1)
                trajReader.previousConfig();
            break;
        // Copy, cut, paste and delete. Holding shift pastes with preserved location
        case 'c':
            if (event.ctrlKey || event.metaKey) {
                copyWrapper();
            }
            break;
        case 'x':
            if (event.ctrlKey || event.metaKey) {
                cutWrapper();
            }
            else {
                if (event.shiftKey) {
                    shiftWithinBox(new THREE.Vector3(-1, 0, 0));
                }
                else {
                    shiftWithinBox(new THREE.Vector3(1, 0, 0));
                }
            }
            break;
        case 'v':
            if (event.ctrlKey || event.metaKey) {
                pasteWrapper(!event.shiftKey); // Hold down shift to paste in front of camera
                view.transformMode.set('Translate'); // Show translate gizmo
            }
            break;
        // Editing shortcuts
        case 'delete':
            deleteWrapper();
            break;
        case 'l':
            ligateWrapper();
            break;
        case 'n':
            nickWrapper();
            break;
        // Undo: ctrl-z, cmd-z
        // Redo: ctrl-shift-z, ctrl-y, cmd-shift-z, cmd-y
        case 'z':
            if (event.ctrlKey || event.metaKey) {
                if (event.shiftKey) {
                    editHistory.redo();
                }
                else {
                    editHistory.undo();
                }
            }
            else {
                if (event.shiftKey) {
                    shiftWithinBox(new THREE.Vector3(0, 0, -1));
                }
                else {
                    shiftWithinBox(new THREE.Vector3(0, 0, 1));
                }
            }
            break;
        case 'y':
            if (event.ctrlKey || event.metaKey) {
                editHistory.redo();
            }
            else {
                if (event.shiftKey) {
                    shiftWithinBox(new THREE.Vector3(0, -1, 0));
                }
                else {
                    shiftWithinBox(new THREE.Vector3(0, 1, 0));
                }
            }
            break;
        // Select everything not selected:
        case 'i':
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                invertSelection();
            }
            break;
        // Select all elements:
        case 'a':
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                selectAll();
            }
            break;
        // Transform controls:
        case 't': // Toggle translate
            if (view.transformMode.get() == 'Translate') {
                view.transformMode.disable();
            }
            else {
                view.transformMode.set('Translate');
            }
            break;
        case 'r': // Toggle rotate
            if (view.transformMode.get() == 'Rotate') {
                view.transformMode.disable();
            }
            else {
                view.transformMode.set('Rotate');
            }
            break;
        case 'shift':
            transformControls.setTranslationSnap(1);
            transformControls.setRotationSnap(Math.PI / 12);
            break;
        case 'o':
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                Metro.dialog.open('#openFileDialog');
                break;
            }
            break;
        case 's':
            // Save output
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                Metro.dialog.open('#exportOxdnaDialog');
                document.getElementById('idUpdateWarning').hidden = !topologyEdited;
                break;
            }
            // Toggle selection:
            view.selectionMode.toggle();
            break;
        // Toggle dragging:
        case 'd':
            view.transformMode.toggle();
            break;
        case 'f1':
            window.open("https://github.com/sulcgroup/oxdna-viewer/");
            break;
    }
    // Key is value of the key, e.g. '1', while code is the id of
    // the specific key, e.g. 'Numpad1'.
    let stepAngle = Math.PI / 12;
    switch (event.code) {
        case 'Numpad0':
            controls.reset();
            break;
        case 'Numpad1':
            if (event.ctrlKey || event.metaKey) {
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
            if (event.ctrlKey || event.metaKey) {
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
            api.switchCamera();
            break;
        case 'Numpad6':
            controls.stepAroundAxis(new THREE.Vector3(0, -1, 0), stepAngle);
            break;
        case 'Numpad7':
            if (event.ctrlKey || event.metaKey) {
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
            if (event.ctrlKey || event.metaKey) {
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
