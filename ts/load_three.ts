import * as THREE from "../dist/lib/three.module.js"
import { TrackballControls } from "../dist/controls/TrackballControls.js"
import { TransformControls } from "../dist/controls/TransformControls.js"

declare global {
    interface Window {
        THREE;
        TransformControls;
        TrackballControls;
    }
}

window.THREE = THREE
window.TrackballControls = TrackballControls
window.TransformControls = TransformControls