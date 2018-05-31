// <reference path="./three/index.d.ts" />

//Save image on "p" press 
document.addEventListener("keypress", event =>{
    if(event.keyCode === 112){
        renderer.domElement.toBlob(function(blob){
        var a = document.createElement('a');
        var url = URL.createObjectURL(blob);
        a.href = url;
        a.download = 'canvas.png';
        a.click();
        }, 'image/png', 1.0);
    }
});