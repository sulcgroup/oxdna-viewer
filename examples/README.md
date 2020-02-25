# Examples
Included in this directory is a set of example structures and tutorials to help you get started. Structures used in our [paper](https://doi.org/10.1101/2020.01.24.917419 "paper") are also included to help you reproduce them.

## Rigid-body relaxation
![](../img/icosahedron.png)

As described [earlier](https://github.com/sulcgroup/oxdna-viewer#rigid-body-simulations "main README"),  caDNAno files exported to oxDNA using conversion tools will be planar and near impossible to relax using the usual relaxation methods in oxDNA. The following examples showcases our rigid-body simulator that attempts to automatically rearrange these flat CaDNAno designs to a configuration that can be relaxed using traditional molecular dynamics methods.

**[1. Rigid-body triangle](https://github.com/sulcgroup/oxdna-viewer/tree/master/examples/triangle)**
This is a minimal example of a triangle (well, technically a circle) drawn as three parallel helices in cadnano. Clustering and applying rigid-body dynamics rearanges the helices into a triangular shape.

**[2. Rigid-body icosahedron](https://github.com/sulcgroup/oxdna-viewer/tree/master/examples/icosahedron)**
This is a large two-scaffold structure from [Douglas, et al 2009](https://www.nature.com/articles/nature08016 "Douglas, et al 2009"). Clustering and applying rigid-body dynamics rearanges the initially parallel helices into the intended icosahedron.
