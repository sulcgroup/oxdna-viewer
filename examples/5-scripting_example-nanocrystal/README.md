# Creating a 3x3x3 cubic lattice from a DNA origami

This example demonstrates how to set up a 3x3x3 lattice of DNA origami octahedrons as experimentally demonstrated in [this paper](https://www.nature.com/articles/s41563-019-0550-x).  Please note that this sets up a very large scene and will take a long time to complete, even on a high end computer.

### Files
You need to download the following files to complete this example (GitHub does not like downloading individual files, to download you need to right click the links and select "Save Link As"):  
<a href="https://raw.githubusercontent.com/sulcgroup/oxdna-viewer/master/examples/5-scripting_example-nanocrystal/tian_octahedron_ext.dat" download>tian_octahedron_ext.dat</a>  
<a href="https://raw.githubusercontent.com/sulcgroup/oxdna-viewer/master/examples/5-scripting_example-nanocrystal/tian_octahedron_ext.top" download>tian_octahedron_ext.top</a>

You will also need this JavaScript script, however it can just be copy and pasted when you get to it in the example:  
<a href="https://raw.githubusercontent.com/sulcgroup/oxdna-viewer/master/examples/5-scripting_example-nanocrystal/crystal_script3x3.js">crystal_script3x3.js</a>

Or you can run this example from a pre-loaded file. Click [here](https://sulcgroup.github.io/oxdna-viewer/?configuration=https://raw.githubusercontent.com/sulcgroup/oxdna-viewer/master/examples/5-scripting_example-nanocrystal/tian_octahedron_ext.dat&topology=https://raw.githubusercontent.com/sulcgroup/oxdna-viewer/master/examples/5-scripting_example-nanocrystal/tian_octahedron_ext.top) to begin (you will still need the script).

### Protocol
1.   Click [here](https://sulcgroup.github.io/oxdna-viewer/?configuration=https://raw.githubusercontent.com/sulcgroup/oxdna-viewer/master/examples/5-scripting_example-nanocrystal/tian_octahedron_ext.dat&topology=https://raw.githubusercontent.com/sulcgroup/oxdna-viewer/master/examples/5-scripting_example-nanocrystal/tian_octahedron_ext.top) (or drag and drop tian_octahedron_ext.dat and tian_octahedron_ext.top into OxView to load the structure).
2.  Open a JavaScript console. It is usually accessible through the browser menu or through a keyboard shortcut which varies by browser and operating system.
3.  Paste the crystal_script3x3.js into the opened console and press Enter. This will take a long time and you might get a notification from your browser that this tab is slowing down your browser. Don’t stop the page, let it complete.
4.  The final result should look something like [this](https://sulcgroup.github.io/oxdna-viewer/?configuration=https://raw.githubusercontent.com/sulcgroup/oxdna-viewer/master/examples/5-scripting_example-nanocrystal/lattice_min.dat&topology=https://raw.githubusercontent.com/sulcgroup/oxdna-viewer/master/examples/5-scripting_example-nanocrystal/lattice.top).  We do not recommend trying to run a simulation with this example configuration file, it is extremely compressed to get it to fit into GitHub's 25 MB file limit so the positions and orientations are not quite correct.  If you are interested in simulating this system, please generate an uncompressed version on your own machine.


![lattice](lattice.png)
