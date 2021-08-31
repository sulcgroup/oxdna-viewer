# Design a DNA tetrahedron design from scratch

![](tetra.png)

## Instructions

This example describes how to draw a DNA tetrahedron, from:

> Goodman, R. P., Berry, R. M., & Turberfield, A. J. (2004). The single-step synthesis of a DNA tetrahedron. Chemical communications (Cambridge, England), (12), 1372–1373. https://doi.org/10.1039/b402293a


1. Create a helix (a). To do this, we input a sequence into the sequence text box, make sure "Duplex mode" is selected, then click the create button. The given sequence is not too important, as it can be changed later (using "Set icosahedron.json.top.json.topnce"), but make sure it is the correct length (in this case, 20 base pairs)

2. Duplicate and transform (b).
    1. Go to the "Select" tab, change the selection mode to "Cluster" and click to select the created helix. Then use the copy (or Ctrl+C) and paste (or Ctrl+V) tools in the "Edit" tab to create another helix.

    2. Use the translate (or T) and rotate (or R) tools to position each helix. Although it is possible to move and rotate the helices in 3D, it is easier to keep them in a 2D plane for now. When the translate and rotate tools are active, arrows and planes will appear on the selected object. The red, green, and blue arrows correspond to translation along or rotation around the X, Y and Z axes respectively. In translation mode, clicking the yellow, magenta, and cyan planes allows translation in the XY, XZ, and YZ planes, respectively. The white square at the center of the arrows in translation mode and the yellow arrows in rotation mode correspond to translation and rotation in the plane perpendicular to the orientation vector of the camera.

    3. Repeat steps 2.1 - 2.2 until you have created and oriented all six helices, as shown in (b).

3. Ligate strands. With the monomer selection mode enabled, select exactly one 3’ and one 5’ end and then click ligate (or L on your keyboard) to connect them. Connect the strands as shown in (c). The backbones of the strands ares lightly tapered towards the 3’ end of the strand, which provides a constant visual identification of strand polarity. To make 3’ ends even more visible, enable "3" markers in the "View" tab, as seen in (b).

4. Enable rigid-body dynamics in the "Dynamics" tab. Each helix was automatically assigned to a cluster when created,so it is now easy to toggle rigid-body relaxation to bring everything into a proper tetrahedron.  To bring the clusters closer together, you can decrease the cluster repulsion constant and the connection length while increasing the spring constant, in the rigid-body settings (here we used repulsion = 100, spring = 100, and relaxed length = 1). The end result [should look something like this](https://sulcgroup.github.io/oxdna-viewer/?configuration=https%3A%2F%2Fraw.githubusercontent.com%2Fsulcgroup%2Foxdna-viewer%2Fmaster%2Fexamples%2F2-free-form_design_example-tetrahedron%2Ftetra.dat&topology=https%3A%2F%2Fraw.githubusercontent.com%2Fsulcgroup%2Foxdna-viewer%2Fmaster%2Fexamples%2F2-free-form_design_example-tetrahedron%2Ftetra.top) (d).

5. Finally, spacers of a given sequence can be added in the hinges using the insert tool and, if desired, strands can be cut using the nick tool.
