import { Camera, EventDispatcher, Vector3 } from "../lib/three-core";

export class DragControls extends EventDispatcher {
    constructor(_objects: THREE.Group[] ,camera: Camera, individ : boolean, domElement?: HTMLElement);

    object: Camera;
    domElement: HTMLElement;

    // API
    _plane : THREE.Plane;
	_raycaster : THREE.Raycaster;

	_mouse : THREE.Vector2;
	_offset : THREE.Vector3;
	_intersection : THREE.Vector3;

    _selected;
    _hovered;

	scope;

    setObjects() : void;
    on(type, listener) : void;
    off(type, listener) : void;
    notify(type) : void;
}
