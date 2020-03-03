# Rigid-body relaxation example

## Instructions
Either:
1. Click [here](https://sulcgroup.github.io/oxdna-viewer/?configuration=examples%2Fsquare%2Fsquare.json.oxdna&topology=examples%2Fsquare%2Fsquare.json.top) to load the example structure.

or:
  1. Use [tacoxDNA](http://tacoxdna.sissa.it/cadnano_oxDNA "tacoxDNA") to convert the caDNAno file `square.json` (hexagonal lattice) into the oxDNA file format (or simply use the converted files provided). 
  2. Drag and drop the files `square.json.dat` and `square.json.top` together into the oxView window.

Then:
  1.  Click on the "Cluster" options button (![clusterOptions](https://fonts.gstatic.com/s/i/materialicons/tune/v1/24px.svg)) under the "Selection Mode" header in the sidebar. Click "Start Clustering" to cluster with the default values. Alternatively, you could select the clusters manually using the box selection tool.
  2. Wait for the clustering to finish, this might take a minute. When the clustering is done, you will see each helix colored independently.
  3. Check the "Rigid Cluster Dynamics" checkbox under edit tools in the sidebar and watch the clusters reorient themselves. This should take a few seconds, depending on your computer.
  4. When you are happy with the relaxation, uncheck the  "Rigid Cluster Dynamics" checkbox to stop the dynamics.

Note: unless you have moved the clusters manually while the dynamics were activated, you can undo/redo the changes back to the original configuration.

Click [here](https://sulcgroup.github.io/oxdna-viewer/?configuration=examples%2Fsquare%2Fsquare.json_post_dynamics.oxdna&topology=examples%2Fsquare%2Fsquare.json.top) to load the expected end result.
