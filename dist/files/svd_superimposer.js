/// <reference path="../ts/typescript_definitions/index.d.ts" />
/// <reference path="../ts/typescript_definitions/oxView.d.ts" />
class SVDSuperimposer {
    constructor() {
        this.clear();
    }
    clear() {
        this.coords = null;
        this.reference_coords = null;
        //this.transformed_coords = None;
        //this.rot = None;
        //this.tran = None;
        //this.rms = None;
        //this.init_rms = None;
    }
    rms() {
        // Return rms deviations between coords1 and coords2 (PRIVATE).
    }
    set(reference_coords, coords) {
        /*
            Set the coordinates to be superimposed.
            coords will be put on top of reference_coords.
            - reference_coords: an NxDIM array
            - coords: an NxDIM array
            DIM is the dimension of the points, N is the number
            of points to be superimposed.
        */
        this.coords = coords;
        this.reference_coords = reference_coords;
    }
    run() {
        // Superimpose the coordinate sets.
        //    coords = self.coords
        //    reference_coords = self.reference_coords
        //    
        //    // center on centroid
        //    av1 = sum(coords) / self.n
        //    av2 = sum(reference_coords) / self.n
        //    coords = coords - av1
        //    reference_coords = reference_coords - av2
        //
        //    // correlation matrix
        //    a = dot(transpose(coords), reference_coords)
        //    u, d, vt = svd(a)
        //    self.rot = transpose(dot(transpose(vt), transpose(u)))
        //    // check if we have found a reflection
        //    if det(self.rot) < 0:
        //        vt[2] = -vt[2]
        //        self.rot = transpose(dot(transpose(vt), transpose(u)))
        //    self.tran = av2 - dot(av1, self.rot)
    }
    get_transformed() {
        // Get the transformed coordinate set.
    }
    get_rotran() {
        // Right multiplying rotation matrix and translation.
    }
    get_init_rms() {
        // Root mean square deviation of untransformed coordinates.
    }
    get_rms() {
        // Root mean square deviation of superimposed coordinates."""
    }
}
//def _rms(self, coords1, coords2):
//"""Return rms deviations between coords1 and coords2 (PRIVATE)."""
//    diff = coords1 - coords2
//    return sqrt(sum(sum(diff * diff)) / coords1.shape[0])
//def run(self):
//"""Superimpose the coordinate sets."""
//if self.coords is None or self.reference_coords is None:
//    raise Exception("No coordinates set.")
//coords = self.coords
//reference_coords = self.reference_coords
//# center on centroid
//av1 = sum(coords) / self.n
//av2 = sum(reference_coords) / self.n
//coords = coords - av1
//reference_coords = reference_coords - av2
//# correlation matrix
//a = dot(transpose(coords), reference_coords)
//u, d, vt = svd(a)
//self.rot = transpose(dot(transpose(vt), transpose(u)))
//# check if we have found a reflection
//if det(self.rot) < 0:
//    vt[2] = -vt[2]
//    self.rot = transpose(dot(transpose(vt), transpose(u)))
//self.tran = av2 - dot(av1, self.rot)
