// <reference path="./three/index.d.ts" />
document.addEventListener("keydown", event => {
    switch (event.key) {
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
    }
});
