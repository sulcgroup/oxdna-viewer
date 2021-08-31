# Running oxDNA Simulations

This example extends the [freeform design](https://github.com/sulcgroup/oxdna-viewer/tree/master/examples/free-form_design_example-tetrahedron) example with
simulation and analysis of the desiged structure.

### Files
 * <a href="https://raw.githubusercontent.com/sulcgroup/oxdna-viewer/master/examples/4-external_simulation-tetrahedron/input_relax_MD" download>input_relax_MD</a>
 * <a href="https://raw.githubusercontent.com/sulcgroup/oxdna-viewer/master/examples/4-external_simulation-tetrahedron/input_run" download>input_run</a>

### Protocol
1. The structure from the other example is not quite relaxed.  You can view it 
  [here](https://sulcgroup.github.io/oxdna-viewer/?configuration=https%3A%2F%2Fraw.githubusercontent.com%2Fsulcgroup%2Foxdna-viewer%2Fmaster%2Fexamples%2F4-external_simulation-tetrahedron%2Ftetra.dat&topology=https%3A%2F%2Fraw.githubusercontent.com%2Fsulcgroup%2Foxdna-viewer%2Fmaster%2Fexamples%2F4-external_simulation-tetrahedron%2Ftetra.top)
2. In order to relax it, you will first perform a relaxation with input_relax_MD.  Move the two structure files and the input files to the same directory, and 
   with oxDNA added to your path, type:
   ```
   oxDNA input_relax_MD
    ```
   This will only take a few minutes to finish.
  
3. Once it is completed, you should see that the potential energy (first column of the print out) is below -1.4 and the
  structure looks something like [this](https://sulcgroup.github.io/oxdna-viewer/?configuration=https%3A%2F%2Fraw.githubusercontent.com%2Fsulcgroup%2Foxdna-viewer%2Fmaster%2Fexamples%2F4-external_simulation-tetrahedron%2Flast_conf_MD.dat&topology=https%3A%2F%2Fraw.githubusercontent.com%2Fsulcgroup%2Foxdna-viewer%2Fmaster%2Fexamples%2F4-external_simulation-tetrahedron%2Ftetra.top)
  Note that simulation is a stochastic process so your structure will not be exactly the same.
4. You are now ready for the production simulation with input_run.  This one is much longer, so we highly recommend running the simulation either on your own HPC
  facility or on [oxdna.org](oxdna.org).  Create a submit script for your cluster in the same directory as before or fill out the input form on oxdna.org (the defaults there are very similar to the input_run file here).
  In your submit script, you should have the line
   ```
   oxDNA input_run
   ```
  to begin the simulation.  This simulation will take some time to finish.  It took about 12 hours to run on an NVIDIA V100 card (although note that this is a very small example system so it gets minimal improvment from a powerful GPU over a smaller GPU or a simple CPU)

5. Use [oxDNA_analysis_tools](https://github.com/sulcgroup/oxdna_analysis_tools) to perform alignment.  This will make for a better visualization experience as well as shrink the file size for downloading.  
   Assuming the package has been added to your path, call the alignment script with 
    ```
    python align_trajectory.py trajectory_trap.dat aligned.dat
    ```
6. Download the aligned file and load it in oxView and use the Create Video button to create a video of the trajectory.  It will be somewhat choppy because you    generally do not want to save
  configurations too often for analysis.
7. Compute the mean structure and RMSF of the structure.
   ```
   python compute_mean.py -p 4 -d devs.json aligned.dat
   ```
   This will produce a [mean structure](https://sulcgroup.github.io/oxdna-viewer/?configuration=https%3A%2F%2Fraw.githubusercontent.com%2Fsulcgroup%2Foxdna-viewer%2Fmaster%2Fexamples%2F4-external_simulation-tetrahedron%2Fmean.dat&topology=https%3A%2F%2Fraw.githubusercontent.com%2Fsulcgroup%2Foxdna-viewer%2Fmaster%2Fexamples%2F4-external_simulation-tetrahedron%2Ftetra.top&overlay=https%3A%2F%2Fraw.githubusercontent.com%2Fsulcgroup%2Foxdna-viewer%2Fmaster%2Fexamples%2F4-external_simulation-tetrahedron%2Fdevs.json)
   with deviations, a deviations data file which can be loaded using the order parameter selector in the Trajectory tab alongside aligned.dat, and a plot of the RMSD over time:
   
 ![devs](devs_rmsd.png)
