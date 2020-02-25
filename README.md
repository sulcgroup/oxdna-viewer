[Try it!](https://sulcgroup.github.io/oxdna-viewer/)

# oxdna-viewer

![oxdna-viewer interface](img/editing.gif)

A browser-based visualization tool that uses the [Three.js](https://threejs.org/) JavaScript library to create a smooth, seamless oxDNA configuration viewing and editing experience, even for very large configuration files (current record is 1.2 million nucleotides). To begin, either hit the "Try it" link above, or clone the repository and open index.html in a browser window. To use, simply drag and drop a topology and configuration/trajectory file pair into the browser window. If you have JSON overlay files, they can be dragged in together with the topology and configuration, or dragged separately later.

---

## Examples
You can find a set of example structures and tutorials in the [example directory](https://github.com/sulcgroup/oxdna-viewer/tree/master/examples), including structures used in our [paper](https://doi.org/10.1101/2020.01.24.917419).

---

## Editing Features  
The viewer can load multiple structures at the same time. You can then select (`S`) and transform (`D`) components using the "Select" and "Transform" options in the sidebar. Press `R` on your keyboard to toggle rotation and `T` to toggle translation. Hold down the `shift` key to snap to grid. Selected components can also be rotated around the x,y and z axis through the sidebar. Selections can be copied and pasted using `ctrl+C` and `ctrl+V`, `ctrl+shift+V` pastes in-place. Strands can be created, extended, nicked, or ligated. Edits can be undone and redone using `ctrl+Z`/`ctrl+Y` or the ![undo](https://fonts.gstatic.com/s/i/materialicons/undo/v1/24px.svg) and ![redo](https://fonts.gstatic.com/s/i/materialicons/redo/v1/24px.svg) buttons. To download your edited and now perfectly assembled structure, click the "Download Output Files" button.  Note that this new file now represents a single structure and will behave as a single system if re-loaded into the viewer.

Please provide feedback if you encounter any bugs or have suggestions for how to make the editing features better.

Edited strands can also be exported for ordering purposes in CSV format by clicking the "Download Sequences" button.

---

## Video Options  
If you would like to make a video of a trajectory, load a trajectory and click the "Create Video" button.  This will open an interactive panel where you can choose video type and output format.  

### Video types  
**Trajectory**: Will run through the provided trajectory, saving every configuration as a frame.  Will play back at the provided frame rate.  If you want to stop the capture early, click the "Stop" button and the video will download as-is.  If the camera is moved during trajectory capture this will appear in the final video, allowing you to easily show different angles.  
**Lemniscate**: The camera will make a figure-8 around the structure at the current distance, creating a 360° view of the currently loaded configuration.

### Output Formats
**Webm**: The preferred type for most modern video players, though note that older versions of PowerPoint do not play nice with it. If this is an issue, either save a Gif or convert the Webm to a different format using other software (note that this will not work in Firefox).  
**Gif**: Larger file size, but highly portable (note that this will not work in Chrome while running locally).  
**PNG/JPEG**: Will download a .zip file with every frame saved as a image of the specified type.  Can be converted to video formats using other software such as ffmpeg or ImageJ.

### Input Format
The topology and trajectory/configuration have to be in oxDNA format. You can convert from other formats (such as PDB, LAMMPS, caDNAno) using TacoxDNA converter: http://tacoxdna.sissa.it/

---

## Console Commands
In addition to the visualization and editing features highlighted in the sidebar, there is a browser console-based text API with the following functions:  
 * `toggleStrand(<strand object>)`: Toggles visibility of the given strand.  
 * `markStrand(<strand object>)`: Highlight the given strand.  
 * `getSequence(<strand object>)`: Returns the sequence of the given strand.  
 * `countStrandLength(optional(<system object>))`: Returns a dictionary of strand indices with their associated length. If no system is provided, defaults to the first system loaded into the scene.  Very useful for finding the id of the scaffold strand in an origami.  
 * `hilight5ps(optional(<system object>))`: Highlights the 5' ends of every strand in the given system. If no system is provided, defaults to the first system loaded into the scene.  
 * `toggleAll(optional(<system object>))`: Toggles visibility of the given system. If no system is provided, defaults to the first system loaded into the scene.  
 * `toggleBaseColors()`: Toggles the bases between type-defined colors (A = blue, T/U = red, G = yellow, C = green) and grey.  
 * `trace53(<monomer object>)`: Returns an array of nucleotides beginning with the provided nucleotide and proceeding 5'-3' down the strand. (Remember that oxDNA files are 3'-5'). 
 * `trace35(<monomer object>)`: Same as trace53, but traces up the strand instead.
 * `nick(<monomer object>)`: Removes the 3' connection from the provided monomer and creates a new strand containing the selected object and its 5' neighbors.  Hooked up to the "Nick" button on the sidebar.
 * `ligate(<monomer object> <monomer object>)`: Ligates the two selected monomers together, creating a single strand contining all the monomers in the parent strands of the input particles. Hooked up to the "Ligate" button on the sidebar.
 * `del(<array of monomer objects>)`: Loops through the array, deleting each object from the scene. Also handles the separation of strand objects. Hooked up to the "Delete" button on the sidebar.
 * `extendStrand(<monomer object> <string>)`: Extends the parent strand of the provided monomer with the given sequence.  The string must be in ALL CAPS to correspond to particle types. The new monomers will appear in a helix with an axis corresponding to the a3 vector of the provided monomer.  These will most likley need to be relaxed prior to production simulations with edited files. Hooked up to the "Extend" button on the sidebar
 * `createStrand(<string>)`: Same as extendStrand, except a new strand is created 20 units in front of the camera. Hooked up to the "Create" button on the sidebar.
 * `removeColorbar()`: Hide the colorbar if an overlay is loaded.  
 * `showColorbar()`: Show the colorbar if an overlay is loaded and the colorbar was previously hidden.  
 * `changeColormap(<map name>)`: Change the color map used for data overlays. All full-sized [Matplotlib colormaps](https://matplotlib.org/3.1.1/gallery/color/colormap_reference.html) are available in addition to the Three.js defaults ('rainbow', 'cooltowarm', 'blackbody', and 'grayscale').  Default is cooltowarm.  
 * `setColorBounds(<min>, <max>)`: Change the upper and lower limits of the colorbar to min/max.  Defaults are the upper and lower bounds of the provided dataset.  
 * `spOnly()`: remove all objects from the scene except the backbone cyllinders.  Creates an effect similar to licorice display options in other molecular viewers.  
 * `showEverything()`: Resets all visibility parameters to default values.  
 * `switchCamera()`: Toggles between perspective and orthographic camera.  Note that orbit controls does not support zooming in orthographic camera mode.  Hooked up to the "Orthographic"/"Perspective" button in the sidebar.

Note that many of these require system, strand or nucleotide objects. The viewer has a simple object hierarchy where systems are made of strands which are made of elements. Arrays in JavaScript are 0-indexed, so to access the 2nd nucleotide of the 6th strand in the 1st system, you would type systems[0].strands[5].monomers[1].  There is also an array of all monomers indexed by global id (shown when an element is selected), so the 1000th monomer can be accessed by elements.get(999).

---

## Rigid Body Simulations  
CaDNAno files exported to oxDNA using [conversion tools](http://tacoxdna.sissa.it/) will be planar and near impossible to relax using the usual relaxation methods in oxDNA. This software includes a rigid-body simulator that attempts to automatically rearrange these flat CaDNAno designs to a configuration that can be relaxed using traditional molecular dynamics methods.

To use, first click on the "Cluster" options button (![clusterOptions](https://fonts.gstatic.com/s/i/materialicons/tune/v1/24px.svg)) under the "Selection Mode" header in the sidebar. This will bring up a UI for selecting clusters. Either allow the software to automatically choose clusters using a DBSCAN algorithm (works quite well for most CaDNAno designs), or select them yourself. Once clusters are defined, click the "Rigid cluster dynamics" checkbox to initiate simulation.  Click it again to stop.  You can drag clusters around during simulation to help the relaxation along or correct topological inaccuracies by switching to drag mode.

---

## Updates and writing your own extensions
This software is still in active development, so features remain in high flux.  If you would like to make a feature request or to report a bug, please let us know in the Issues tab!  Remember to pull often if you're running the viewer locally to get the newest features.

If you want to extend the code for your own purposes, you will also need to install Typescript, Three.js and Typescript bindings for Three.  Full download instructions:

1) "git clone -b master https://github.com/sulcgroup/oxdna-viewer.git"  
2) Download Typescript and Node.js 
   ts and npm ask for different name of node.js: one is node and another is nodejs, you may need to change the name of it accordingly or get an extra copy  
3) "npm install --save @types/three"  
   If it goes wrong, open the package.json file and change "name", into "types/three-test" and try again  
   Refer to https://thisdavej.com/node-newbie-error-npm-refusing-to-install-package-as-a-dependency-of-itself  
4) Go to oxdna-viewer folder  
5) npm install --save @types/webvr-api  
   These previous two steps install the necessary Typescript bindings for Three.js  
6) tsc  
   This is the command to run the typescript compiler.  Output directory and adding new files to the compiler can be found in tsconfig.json  
   tsc needs to be run every time you make changes to the Typescript.  If you run tsc with the -w flag it will continuously watch for file changes.  
7) The compiled Javascript will be in the dist/ directory  
8) Open index.html in any browser (Chrome works best)

## Citation
If you use oxView or our oxDNA analysis package in your research, please cite:  
Erik Poppleton, Joakim Bohlin, Michael Matthies, Shuchi Sharma, Fei Zhang, Petr Sulc: Design, optimization, and analysis of large DNA and RNA nanostructures through interactive visualization, editing, and molecular simulation (bioarxiv preprint: https://doi.org/10.1101/2020.01.24.917419)
