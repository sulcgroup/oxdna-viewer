//This is a demo plugin that highlights overstretched positions in red.

let plugin_name = "LOS";

// The actual plugin code has to be a string, so we will define it here
let plugin_code = `
    // Let's write a test plugin, adding a button to the UI
    function LOS_Plugin() {
        let button = document.createElement("button");
        button.innerText = "List of Strands and Counts";
        button.addEventListener("click", () => {
            let strands = {};

            systems.forEach(s => s.strands.forEach(strand => {
                let seq = strand.getSequence();
                if (seq in strands)
                    strands[seq] += 1;
                else
                    strands[seq] = 1;
            }));
            tmpSystems.forEach(s => s.strands.forEach(strand => {
                let seq = strand.getSequence();
                if (seq in strands)
                    strands[seq] += 1;
                else
                    strands[seq] = 1;
            }));

            makeTextFile("seqs.txt", Object.entries(strands)
                .map(([key, value]) => \`\${key}: \${value}\`).join("\\n"));
        });
        document.querySelector("#plugin-pane").appendChild(button);
    }
    LOS_Plugin();
    `;

// register the plugin with view
addPlugin(plugin_name, plugin_code);
