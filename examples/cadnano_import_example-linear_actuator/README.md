# Cadnano import example

In this example you will import a two-component structure using the [Tacoxdna](http://tacoxdna.sissa.it/) Cadnano importer.  The structure in this directory is the linear actuator from [this](https://onlinelibrary.wiley.com/doi/full/10.1002/smll.202007704) paper.

### Files
You need to download the following files to complete this example (GitHub does not like downloading individual files, to download you need to right click these links and select "Save Link As":  
<a href="https://raw.githubusercontent.com/sulcgroup/oxdna-viewer/master/examples/cadnano_import_example-linear_actuator/rail.json" download>rail.json</a>  
<a href="https://raw.githubusercontent.com/sulcgroup/oxdna-viewer/master/examples/cadnano_import_example-linear_actuator/slider.json" download>slider.json</a>  

### Protocol

1.  Import the rail caDNAno design(a)  In the "File" tab, click "Import"(b)  Locate the "rail.json" file(c)  Make sure that "caDNAno" is selected as file format(d)  Select "Hexagonal" as lattice type(e)  Input a scaffold sequence (or leave blank to set a random sequence)(f)  Click "Import and load". The import log is visible in the web console, as seen in Figure 1.a).
2.  Repeat step 1 for "slider.json"
3.  Position the slider on the rail(a)  In the "Select" tab, enable the "System" selection mode and click on the slider to select it.(b)In the "Edit" tab, toggle the "Translate" tool (or press "T" on the keyboard). Use the arrows to position the slideron the rail, as seen in Figure 1.c).
4.  (optional) Select by cluster, translate and rotate the single stranded clusters to avoid the extended backbone bonds seen inFigure 1.c).
5.  (optional) Use the "Create" and "Ligate" tools to join the structures together
