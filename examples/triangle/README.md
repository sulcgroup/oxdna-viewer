# Minimal rigid-body relaxation example

## Instructions
Either:
1. Click [here](https://sulcgroup.github.io/oxdna-viewer/?configuration=examples%2Ftriangle%2Ftri.json.oxdna&topology=examples%2Ftriangle%2Ftri.json.top) to load the example structure.

or:
  1. Use [tacoxDNA](http://tacoxdna.sissa.it/cadnano_oxDNA "tacoxDNA") to convert the caDNAno file `tri.json` into the oxDNA file format (or simply use the converted files provided). 
  2. Drag and drop the files `tri.json.oxdna` and `tri.json.top` together into the oxView window.

Then:
  1.  Click on the "Cluster" options button (![clusterOptions](https://fonts.gstatic.com/s/i/materialicons/tune/v1/24px.svg))     under the "Selection Mode" header in the sidebar.  Click "Start Clustering" to cluster with the default values.
  2. Wait for the clustering to finish. Since this structure is very small, it should be almost instant. When the clustering is done, you will see each helix colored independently.
  3. Check the "Rigid Cluster Dynamics" checkbox under edit tools in the sidebar and watch the clusters reorient themselves. This should take a few seconds, depending on your computer. The helices first line up and pause for a moment near a local plateau, but soon find a better minimum. You may sometimes need to give the clusters a nudge manually, using the transform tool, but that is not necessary for this example.
  4. When you are happy with the relaxation, uncheck the  "Rigid Cluster Dynamics" checkbox to stop the dynamics.

Note: unless you have moved the clusters manually while the dynamics were activated, you can undo/redo the changes back to the original configuration.

Click [here](https://sulcgroup.github.io/oxdna-viewer/?configuration=examples%2Ftriangle%2Ftri.json_post_dynamics.oxdna&topology=examples%2Ftriangle%2Ftri.json.top) to load the expected end result.
