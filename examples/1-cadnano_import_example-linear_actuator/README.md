# Cadnano import example

In this example you will import and assemble a two-component caDNAno structure (using the integrated [tacoxdna.js](http://tacoxdna.sissa.it/) importer).  The structure in this directory is the linear actuator from  the following paper: 
> Benson, E., Carrascosa, R., Bath, J., Turberfield, A. J., Strategies for Constructing and Operating DNA Origami Linear Actuators. Small 2021, 17, 2007704. https://doi.org/10.1002/smll.202007704.

### Files
You need to download the following files to complete this example (GitHub does not like downloading individual files, to download you need to right click these links and select "Save Link As"):  
 * <a href="https://raw.githubusercontent.com/sulcgroup/oxdna-viewer/master/examples/1-cadnano_import_example-linear_actuator/rail.json" download>rail.json</a>  
 * <a href="https://raw.githubusercontent.com/sulcgroup/oxdna-viewer/master/examples/1-cadnano_import_example-linear_actuator/slider.json" download>slider.json</a>  

### Protocol

1.  Import the rail caDNAno design
    1. In the "File" tab, click "Import"
    2. Locate the "rail.json" file
    3. Make sure that "caDNAno" is selected as file format
    4. Select "Hexagonal" as lattice type
    5. Input a scaffold sequence (or leave blank to set a random sequence)
    6. Click "Import and load". The import log is visible in the web console.
3.  Repeat step 1 for "slider.json". The structure should now look [like this](https://sulcgroup.github.io/oxdna-viewer/?configuration=https%3A%2F%2Fraw.githubusercontent.com%2Fsulcgroup%2Foxdna-viewer%2Fmaster%2Fexamples%2F1-cadnano_import_example-linear_actuator%2Flinact.dat&topology=https%3A%2F%2Fraw.githubusercontent.com%2Fsulcgroup%2Foxdna-viewer%2Fmaster%2Fexamples%2F1-cadnano_import_example-linear_actuator%2Flinact.top).
4.  Position the slider on the rail(a)
    1. In the "Select" tab, enable the "System" selection mode and click on the slider to select it.
    2. In the "Edit" tab, toggle the "Translate" tool (or press "T" on the keyboard). Use the arrows to position the slider on the rail.
6.  (optional) Select by cluster, translate and rotate the single stranded clusters to avoid the extended backbone bonds. The structure should now look [like this](https://sulcgroup.github.io/oxdna-viewer/?configuration=https%3A%2F%2Fraw.githubusercontent.com%2Fsulcgroup%2Foxdna-viewer%2Fmaster%2Fexamples%2F1-cadnano_import_example-linear_actuator%2Flinact_positioned.dat&topology=https%3A%2F%2Fraw.githubusercontent.com%2Fsulcgroup%2Foxdna-viewer%2Fmaster%2Fexamples%2F1-cadnano_import_example-linear_actuator%2Flinact.top).
7.  (optional) To connect the slider to a specific position on the rail, you can create mutual trap forces between the complementary single strands to pull them together (make sure to set their sequences accordingly). Alternatively, remove the single strands and replace them with new duplexes of the correct length.

Using oxServe dynamics, you can now relax the structure, which will look something [like this](https://sulcgroup.github.io/oxdna-viewer/?configuration=https%3A%2F%2Fraw.githubusercontent.com%2Fsulcgroup%2Foxdna-viewer%2Fmaster%2Fexamples%2F1-cadnano_import_example-linear_actuator%2Flinact_relaxed.dat&topology=https%3A%2F%2Fraw.githubusercontent.com%2Fsulcgroup%2Foxdna-viewer%2Fmaster%2Fexamples%2F1-cadnano_import_example-linear_actuator%2Flinact.top).
