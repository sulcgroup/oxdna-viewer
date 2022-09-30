[Try it!](https://sulcgroup.github.io/oxdna-viewer/)

# oxdna-viewer

![oxdna-viewer interface](img/editing.gif)

A browser-based visualization tool that uses the [Three.js](https://threejs.org/) JavaScript library to create a smooth, seamless oxDNA configuration viewing and editing experience, even for very large configuration files (current record is 1.2 million nucleotides). To begin, either hit the "Try it" link above, or clone the repository and   [follow these steps](#updates-and-writing-your-own-extensions-or-running-oxView-locally). To use, simply drag and drop a topology and configuration/trajectory file pair into the browser window. If you have JSON overlay files, they can be dragged in together with the topology and configuration, or dragged separately later.

---

 ## Table of Contents
  * [Examples](#examples)
  * [Editing Features](#editing-features)
  * [Video Options](#video-options)
    + [Video types](#video-types)
    + [Output Formats](#output-formats)
    + [Input Format](#input-format)
  * [Console Commands](#console-commands)
    + [Scene API](#scene-api)
    + [Edit API](#edit-api)
    + [Observable API](#observable-api)
  * [Rigid Body Simulations](#rigid-body-simulations)
  * [3D Printing Export](#3d-printing-export)
  * [Live relaxation of oxDNA configurations](#live-relaxation-of-oxdna-configurations)
  * [Known issues](#known-issues)
  * [Updates and writing your own extensions](#updates-and-writing-your-own-extensions-or-running-oxView-locally)
  * [Citation](#citation)
  * [Acknowledgements](#acknowledgements)

---

## Examples
You can find a set of example structures and tutorials in the [example directory](https://github.com/sulcgroup/oxdna-viewer/tree/master/examples), including structures used in our [paper](https://doi.org/10.1101/2020.01.24.917419).

---

## Editing Features  
The viewer can load multiple structures at the same time. You can then select (`S`) and transform (`D`) components using the "Select" and "Transform" options in the menu. Press `R` on your keyboard to toggle rotation and `T` to toggle translation. Hold down the `shift` key to snap to grid. Selections can be copied and pasted using `ctrl+C` and `ctrl+V` (`ctrl+shift+V` pastes in-place). Strands can be created, extended, nicked, or ligated. Edits can be undone and redone using `ctrl+Z`/`ctrl+Y` or the ![undo](https://fonts.gstatic.com/s/i/materialicons/undo/v1/24px.svg) and ![redo](https://fonts.gstatic.com/s/i/materialicons/redo/v1/24px.svg) buttons. To download your edited and now perfectly assembled structure, click the "Download Output Files" button.  Note that this new file now represents a single structure and will behave as a single system if re-loaded into the viewer. There is also an experimental .oxview format which you can download to save cluster and base-pairing information, but make sure to also save your designs as oxdna files.

Please provide feedback if you encounter any bugs or have suggestions for how to make the editing features better.

Edited strands can also be exported for ordering purposes in CSV format by clicking the "Download Sequences" button.

See a tutorial [here](https://www.youtube.com/watch?v=arhmT0LStUQ).

---

## Video Options  
If you would like to make a video of a trajectory, load a trajectory and click the "Create Video" button.  This will open an interactive panel where you can choose video type and output format.

You can also watch the tutorial: [Creating oxDNA videos in oxView](https://www.youtube.com/watch?v=yKAD07NoZpc).

### Video types  
**Trajectory**: Will run through the provided trajectory, saving every configuration as a frame.  Will play back at the provided frame rate.  If you want to stop the capture early, click the "Stop" button and the video will download as-is.  If the camera is moved during trajectory capture this will appear in the final video, allowing you to easily show different angles.  
**Lemniscate**: The camera will make a figure-8 around the structure at the current distance, creating a 360° view of the currently loaded configuration.

### Output Formats
**Webm**: The preferred type for most modern video players, though note that older versions of PowerPoint do not play nice with it. If this is an issue, either save a Gif or convert the Webm to a different format using other software, such as ffmpeg (note that webm export will not work in Firefox).  
**Gif**: Larger file size, but highly portable (note that this will not work in Chrome while running locally).  
**PNG/JPEG**: Will download a .zip file with every frame saved as a image of the specified type.  Can be converted to video formats using other software such as ffmpeg or ImageJ.

### Input Format
The topology and trajectory/configuration have to be in oxDNA format. You can convert from other formats (such as PDB, LAMMPS, caDNAno) using TacoxDNA converter: http://tacoxdna.sissa.it/

---

## Console Commands
In addition to the visualization and editing features highlighted in the menu, oxView is scriptable through the browser console.  To facilitate use, there are two APIs containing useful functions for changing visuals and for editing.

### Scene API  
The scene API can be accessed by typing `api.<command>(<arguments>)` in the browser console.  The following functions are currently available:  
 * `toggleStrand(<strand object>)`: Toggles visibility of the given strand.  
 * `markStrand(<strand object>)`: Highlight the given strand in the selection color.    
 * `countStrandLength(optional(<system object>))`: Returns a dictionary of strand indices with their associated length. If no system is provided, defaults to the first system loaded into the scene.  Very useful for finding the id of the scaffold strand in an origami.  
 * `highlight5ps(optional(<system object>))`: Highlights the 5' ends of every strand in the given system. If no system is provided, defaults to the first system loaded into the scene.  
 * `toggleElements(<array of elements>)`: Toggles visibility of the listed monomers.
 * `toggleAll(optional(<system object>))`: Toggles visibility of the given system. If no system is provided, defaults to the first system loaded into the scene.  
 * `toggleBaseColors()`: Toggles the bases between type-defined colors (A = blue, T/U = red, G = yellow, C = green) and grey.  
 * `trace53(<monomer object>)`: Returns an array of nucleotides beginning with the provided nucleotide and proceeding 5'-3' down the strand. (Remember that oxDNA files are 3'-5'). 
 * `trace35(<monomer object>)`: Same as trace53, but traces up the strand instead.  
 * `getElements(<array of integers>)`: Returns an array of elements with global IDs corresponding to the provided integer list.  
 * `getSequence(<strand object>)`: Returns the sequence of the given strand.
 * `removeColorbar()`: Hide the colorbar if an overlay is loaded.  
 * `showColorbar()`: Show the colorbar if an overlay is loaded and the colorbar was previously hidden.  
 * `changeColormap(<map name>)`: Change the color map used for data overlays. All full-sized [Matplotlib colormaps](https://matplotlib.org/3.1.1/gallery/color/colormap_reference.html) are available in addition to the Three.js defaults ('rainbow', 'cooltowarm', 'blackbody', and 'grayscale').  Default is cooltowarm.  
 * `setColorBounds(<min>, <max>)`: Change the upper and lower limits of the colorbar to min/max.  Defaults are the upper and lower bounds of the provided dataset.  
 * `spOnly()`: remove all objects from the scene except the backbone cyllinders.  Creates an effect similar to licorice display options in other molecular viewers.  
 * `showEverything()`: Resets all visibility parameters to default values.  
 * `switchCamera()`: Toggles between perspective and orthographic camera.  Note that orbit controls does not support zooming in orthographic camera mode.  Hooked up to the "Orthographic"/"Perspective" button in the menu.
   
### Edit API
The edit API can be accessed by typing `edit.<command>(<arguments>)` in the browser console.  The following functions are currently available:
 * `nick(<monomer object>)`: Removes the 3' connection from the provided monomer and creates a new strand containing the selected object and its 5' neighbors.  Hooked up to the "Nick" button on the menu.
 * `ligate(<monomer object> <monomer object>)`: Ligates the two selected monomers together, creating a single strand contining all the monomers in the parent strands of the input particles. Hooked up to the "Ligate" button in the menu.
 * `del(<array of monomer objects>)`: Loops through the array, deleting each object from the scene. Also handles the separation of strand objects. Hooked up to the "Delete" button in the menu.
 * `extendStrand(<monomer object> <string>)`: Extends the parent strand of the provided monomer with the given sequence.  The string must be in ALL CAPS to correspond to particle types. The new monomers will appear in a helix with an axis corresponding to the a3 vector of the provided monomer.  These will most likley need to be relaxed prior to production simulations with edited files. Hooked up to the "Extend" button in the menu
 * `extendDuplex(<monomer object> <string>)`: Similar to extendStrand—extends the parent strand of a given monomer and creates a complement strand. If the given monomer does not have a base pair, it will create one and extend from it. Hooked up to the "Extend" button in the menu while "Duplex mode" is selected.
 * `createStrand(<string>)`: Same as extendStrand, except a new strand is created 20 units in front of the camera. Hooked up to the "Create" button in the menu.
 * `interconnectDuplex3p(<Strand1>,<Strand2>,<string>)` : connects 2 strands with a duplex patch using their 3-primes.
 * `interconnectDuplex5p(<Strand1>,<Strand2>,<string>)` : connects 2 strands with a duplex patch using their 5-primes.

Note that many of these require system, strand or nucleotide objects. The viewer has a simple object hierarchy where systems contain strands which contain elements. The elements are organised as a double-linked lists within the strands and can be iterated: `strand.forEach` or listed: `strand.getMonomers()`. Arrays in JavaScript are 0-indexed, so to access the 2nd nucleotide of the 6th strand in the 1st system, you would type systems[0].strands[5].getMonomers()[1].  There is also an array of all monomers indexed by global id (shown when an element is selected), so the 1000th monomer can be accessed by elements.get(999). If you hover above an element, you will see its system ID, its strand ID and its element ID respectively.

Please see examples 5a and 5b in the [examples](https://github.com/sulcgroup/oxdna-viewer/tree/master/examples) directory for some examples of using the editing API to perform algorithmic mass edits on structures prior to simulation.

### Observable API
The observable API can be accessed by typing `api.observable.(observable)` in the browser console.
Following observables are currently availabe:
* `api.observable.CMS(elements:BasicElement[], size:number, color:number)` this creates a sphere of the
given `size` and `color` at the center of mass of a group of bases. 
* `api.observable.Track(particle : THREE.Mesh)` this creates a line track following the provided mesh object during trajectory update. 

#### Combined example: 
Compute the CMS of a given set of bases and follow its track through the trajectory. 
Type following lines in the browser console, assuming a group of bases is selected.
```js
let cms = new api.observable.CMS(selectedBases, 1, 0xFF0000);
let track =  new api.observable.Track(cms);
let update_func =()=>{
    cms.calculate();
    track.calculate();
};
trajReader.nextConfig = api.observable.wrap(trajReader.nextConfig, update_func);
trajReader.previousConfig = api.observable.wrap(trajReader.previousConfig, update_func);
render();
```

* `api.observable.MeanOrientation(bases: BasicElement[], len=10, color =0xFF0000)` provided two flanking bases at a nick site
this observable draws a vector, emphasizing the orientation of the nick.
#### Example: 
Type following lines in the browser console, assuming two bases are selected.
```js
let strands = edit.createStrand("NNNNNNNNNNNNNNNNNNNNN",true);
 
let ori =  new api.observable.MeanOrientation(strands.slice(2,4));
render = api.observable.wrap(render, () => {ori.update()});
render();
```

---

## Rigid Body Simulations  
CaDNAno files exported to oxDNA using [conversion tools](http://tacoxdna.sissa.it/) will be planar and near impossible to relax using the usual relaxation methods in oxDNA. This software includes a rigid-body simulator that attempts to automatically rearrange these flat CaDNAno designs to a configuration that can be relaxed using traditional molecular dynamics methods.

To use, first click on the "Cluster" options button (![clusterOptions](https://fonts.gstatic.com/s/i/materialicons/tune/v1/24px.svg)) under the "Selection Mode" header in the sidebar. This will bring up a UI for selecting clusters. Either allow the software to automatically choose clusters using a DBSCAN algorithm (works quite well for most CaDNAno designs), or select them yourself. Once clusters are defined, click the "Rigid cluster dynamics" checkbox to initiate simulation.  Click it again to stop.  You can drag clusters around during simulation to help the relaxation along or correct topological inaccuracies by switching to drag mode.

For more information, watch the tutorial: [Arranging a tetrahedron from caDNAno in oxView](https://www.youtube.com/watch?v=yKAD07NoZpc) and have a look at [our examples](https://github.com/sulcgroup/oxdna-viewer/tree/master/examples#rigid-body-relaxation).

---

## 3D Export 
The viewer supports scene export in both the modern gltf format and the the common 3D printing format STL. To use click file > 3D Export. 
For memory reasons one has the option to include just parts of the oxDNA model into the output mesh file,
choosing from:
* `Backbone mesh` 
* `Nucleoside mesh`
* `Connector mesh`
* `Backbone connector mesh`

The smoothness of the exported model is controlled via the `faces multiplier` setting. Note that additional smoothness results in very large STL files which not every browser can handle. 
By increasing the `scaling` of the model objects can be made to overlap, which is benefitial for sturdy printed models.  
To 3D print the exported STL, the file has to be imported in a processing program such as Autodesk NetFab.
The resulting STL can than be imported into the 3D printer software.

The exported gltf can be imported in software such as Blender to create photorealistic illustrations. See a tutorial [here](https://www.youtube.com/watch?v=nkKSbeOm0N8).

---

## Live relaxation of oxDNA configurations
The viewer supports live relaxation of loaded configurations using [ox-serve](https://github.com/sulcgroup/ox-serve) nodes.
To connect to an existing node open the `Connect` menu in the `OX-Serve` tab and input the url and port of the respective 
server. Note that communication between the server and ox-view is established via web sockets, so a typical url looks like: `ws://127.0.0.1:8888`. Further on one can open the `Settings` menu and run the relaxation simulations. 
It is assumed that the [ox-serve](https://github.com/sulcgroup/ox-serve) server runs on a machine with cuda support.
See a tutorial [here](https://www.youtube.com/watch?v=FtU-Sr3aLdI).

---

## Known issues
oxView relies on WebGL hardware acceleration, if you have turned this feature off, oxView will run very slowly.  [Here's an example](https://www.howtogeek.com/412738/how-to-turn-hardware-acceleration-on-and-off-in-chrome/) of how to check if you have hardware acceleration disabled and how to enable it on Chrome.

## Updates and writing your own extensions or running oxView locally 
This software is still in active development, so features remain in high flux.  If you would like to make a feature request or to report a bug, please let us know in the Issues tab!  Remember to pull often if you're running the viewer locally to get the newest features.

If you want to extend the code for your own purposes, you will also need to install Typescript, Three.js and Typescript bindings for Three.  Full download instructions:

1) `git clone -b master https://github.com/sulcgroup/oxdna-viewer.git`
2) Download Typescript and Node.js 
   ts and npm ask for different name of node.js: one is node and another is nodejs, you may need to change the name of it accordingly or get an extra copy  
3) Go to oxdna-viewer folder  
4) `npm install` will install the rest dependencies.
5) `tsc`  
   This is the command to run the typescript compiler.  Output directory and adding new files to the compiler can be found in tsconfig.json  
   tsc needs to be run every time you make changes to the Typescript.  If you run tsc with the -w flag it will continuously watch for file changes.  
6) The compiled Javascript will be in the dist/ directory  
7) use your favorite development webserver to access the page:
* https://www.npmjs.com/package/reload is a server with live update of the page (detecting compiled code changes)  
  after installation usage is `reload -b` run in the oxView intallation directory. The server will output a the link to 
  the page on the command line. 
* alternatively if you have python installed on your system you can use (https://docs.python.org/3/library/http.server.html)
  usage is `python -m http.server 8000`, providing access to the page on localhost:8000  

Alternatively if you are just interested in using oxView locally, do step 1 and proceed straight to step 7. 
Or check out the release section 
 
## Citation
If you use oxView or our oxDNA analysis package in your research, please cite:  

Erik Poppleton, Joakim Bohlin, Michael Matthies, Shuchi Sharma, Fei Zhang, Petr Šulc: Design, optimization and analysis of large DNA and RNA nanostructures through interactive visualization, editing and molecular simulation, *Nucleic Acids Research*, Volume 48, Issue 12, Page e72 (2020).
(https://doi.org/10.1093/nar/gkaa417)

and

Joakim Bohlin, Michael Matthies, Jonah Procyk, Erik Poppleton, Aatmik Mallya, Hao Yan, Petr Šulc: Design and simulation of DNA, RNA and hybrid protein–nucleic acid nanostructures with oxView. *Nature Protocols*, (2022). [https://doi.org/10.1038/s41596-022-00688-5](https://doi.org/10.1038/s41596-022-00688-5) 

## Acknowledgements
We gratefully acknowledge support from NSF grant no 1931487, ONR grant no N000142012094 and MSCA grant no 765703. We thank to all the users for submitting their feedback, bug reports and feature requests, as well as all members of Sulc, Yan, Doye, Turberfield, and Louis groups who participate in testing of the tool.
