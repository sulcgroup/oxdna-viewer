// <reference path="./three/index.d.ts" />
document.addEventListener("keydown", event => {
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
        //mapping the next and prev to the arrow keys
        case 'ArrowRight':
            nextConfig();
            break;
        case 'ArrowLeft':
            previousConfig();
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
            let dragToggle = document.getElementById("dragToggle");
            dragToggle.checked = !dragToggle.checked;
            drag();
            break;
    }
});
