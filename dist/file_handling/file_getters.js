/// <reference path="../typescript_definitions/index.d.ts" />
function handleDrop(event) {
    // cancel default actions
    target.classList.remove('dragging');
    const files = event.dataTransfer.files;
    handleFiles(files);
}
