//This is a demo plugin that highlights overstretched positions in red.

let plugin_name = "HOS";

// The actual plugin code has to be a string, so we will define it here
let plugin_code = `
//let's write a test plugin, adding a button to the UI
// this function will add a button to the UI
function HSO_Plugin() {
    let button = document.createElement("button");
    // we will set the inner text of the button
    button.innerText = "Highlight Overstretched DNA";
    // we will add an event listener to the button
    button.addEventListener("click", () => {
        // we go over all the elements, collecting the strands of the ones that are overstretched
        // you can change the threshold to a different value but say anything which is longer than .6 is overstretched
        const delta = 0.6;

            // find everything that is more than 5 ox units away from its n3
            let p3_extended = new Set();
            elements.forEach((b,id) => {
                if(b.n3){
                    let p1 = b.getPos();
                    let p2 = b.n3.getPos();
                    let dist = p1.distanceTo(p2);
                    if(dist > delta){ 
                        p3_extended.add(b);
                        p3_extended.add(b.n3);
                    }
            }});
            if(p3_extended.size == 0){
                notify("No overstretched DNA found");
                return;
            }
            colorElements(new THREE.Color(1,0,0),[... p3_extended])
    });
    // we will add the button to the UI
    document.querySelector("#plugin-pane").appendChild(button);
}
HSO_Plugin();
`;

// register the plugin with view
addPlugin(plugin_name, plugin_code);
