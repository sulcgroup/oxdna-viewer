# import the libraries needed for this computation
# I added a symlink to oxdna_analysis_tools in a directory on my Python installation's PATH so I could import it like this.
# You could also write this script inside the oxdna_analysis_tools directory or add the path to your PYTHONPATH system variable to make the functions available for import.
import numpy as np
from oxdna_analysis_tools.UTILS.readers import LorenzoReader2
from oxdna_analysis_tools import output_bonds

# Define a function that calculates my quantity of interest.  
# In this example, its the dot products of the a1 orientation vectors.
def get_orientation(mysystem, inp):
    # This function uses DNAnalysis to calculate the interaction energies between the particles in the system.
    energies = output_bonds.output_bonds(inp, mysystem)
    
    # These methods of the system object assigns each nucleotide to a strand and provides a reference to its paired nucleotide if one exists.
    mysystem.map_nucleotides_to_strands()
    mysystem.read_H_bonds_output_bonds(energies)
    
    # Create a list of a1 vectors of interacting nucleotides
    v1s = []
    v2s = []
    for s in mysystem._strands:
            for n in s._nucleotides:
                if len(n.interactions) == 1:
                    v1s.append(n._a1) 
                    v2s.append(mysystem._nucleotides[n.interactions[0]]._a1)
    
    # Convert the list of a1 vectors to a Numpy array, which allows for faster computation.
    v1s = np.array(v1s)
    v2s = np.array(v2s)
    
    # Einstein summation is a compact matrix math representation which is faster than using for loops or broadcasting, both of which would also work here.
    dots = np.einsum('ij,ij->i', v1s, v2s)

    return dots

if __name__ == "__main__":
    # Use Argparse to retrieve command line arguments
    import argparse
    parser = argparse.ArgumentParser(description="Calculates the dot product between a1 vectors of bonded nucleotides")
    parser.add_argument('trajectory', type=str, nargs=1, help="The trajectory file to analyze")
    parser.add_argument('topology', type=str, nargs=1, help="The topology file corresponding to the trajectory")
    parser.add_argument('input', type=str, nargs=1, help="the input file used to run the simulation")
    args = parser.parse_args()
    
    top_file  = args.topology[0]
    traj_file = args.trajectory[0]
    inp = args.input[0]

    # Create a reader object
    myreader = LorenzoReader2(traj_file,top_file)
    mysystem = myreader._get_system()
    all_orientations = []
    
    # This was a simple program not intended for re-use so it was not parallelized.  Please see compute_mean.py for a good example of how to set up parallelization.
    # Iterate through the trajectory and compute the quantity of interest for each configuration.
    while mysystem:
        print(mysystem._time)
        all_orientations.extend(get_orientation(mysystem, inp))
        mysystem = myreader._get_system()
        
    # The goal of this exercise was to find out how far from directly antiparallel the vectors could be for oxDNA to still consider them paired
    print(max(all_orientations))
        
    # Create a simple plot to visualize the result
    import matplotlib.pyplot as plt
    bins = np.linspace(-1, max(all_orientations), 60)

    plt.hist(all_orientations, bins)
    plt.ylabel('count')
    plt.xlabel('dot product')
    plt.show()
