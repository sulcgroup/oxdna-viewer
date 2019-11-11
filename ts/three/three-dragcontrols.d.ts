import { Camera, EventDispatcher, Vector3 } from "../lib/three-core";

export class DragControls extends EventDispatcher {
    constructor(camera: Camera, domElement?: HTMLElement);

    object: Camera;
    domElement: HTMLElement;

    // API
    _plane : THREE.Plane;
	_raycaster : THREE.Raycaster;

    _mouse : THREE.Vector2;
    _movePos : THREE.Vector3;
    _mousePos : THREE.Vector3;
    _startPos : THREE.Vector3;
	_oldPos : THREE.Vector3;
    _newPos : THREE.Vector3;
    _move : THREE.Vector3;
    _boxSelector;

    _selected;

    scope;
    
    enabled;

    setObjects() : void;
    activate() : void;
    deactivate() : void;
    on(type, listener) : void;
    off(type, listener) : void;
    notify(type) : void;
}
