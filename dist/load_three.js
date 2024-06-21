import * as THREE from "dist/lib/three.module.js";
import * as nodes from "dist/lib/nodes/nodes.js";
import { TrackballControls } from "dist/lib/controls/TrackballControls.js";
import { TransformControls } from "dist/lib/controls/TransformControls.js";
import { ConvexGeometry } from "dist/lib/geometries/ConvexGeometry.js";
// Actually expose everything so that it can be used
window.THREE = THREE;
window.nodes = nodes;
window.TrackballControls = TrackballControls;
window.TransformControls = TransformControls;
window.ConvexGeometry = ConvexGeometry;
