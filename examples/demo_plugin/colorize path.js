//This is a demo plugin that highlights overstretched positions in red.

let plugin_name = "COLORIZE_PATH";

// The actual plugin code has to be a string, so we will define it here
let plugin_code = `
    // Let's write the plugin

    function colorisePath(){
        // the path is stored in the selected bases
        let path = [...selectedBases];
        // we set the color based on the path length as HSL
        let len = path.length;
        for (let i = 0; i < len; i++){
            let base = path[i];
            const color = new THREE.Color(\`hsl(\${i/len*360}, 100%, 50%)\`);
            
            colorElements(color, [base]);
        }
    }
    function ColorizePath_Plugin() {
        let button = document.createElement("button");
        button.innerText = "HSL Colorize Path";
        button.addEventListener("click", colorisePath)
        document.querySelector("#plugin-pane").appendChild(button);
    }
    ColorizePath_Plugin();
    `;

// register the plugin with view
addPlugin(plugin_name, plugin_code);
