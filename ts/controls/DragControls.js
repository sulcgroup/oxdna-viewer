/*
 * @author zz85 / https://github.com/zz85
 * @author mrdoob / http://mrdoob.com
 * Running this will allow you to drag three.js objects around the screen.
 * Heavily rewritten by Erik Poppleton to accomodate instanced objects
 */

/*To include anything such as DragControls.js, TrackballControls.js, etc., do the following:
1. Add .js file from GitHub to controls
2. Add three-dragcontrols.d.ts (make own modeled off of others) to js/controls, js/three, and js/node_modules/@types/three
3. Modify as needed
*/

THREE.DragControls = function (_camera, _domElement) { //pass in objects, camera, etc.

    var _plane = new THREE.Plane();
    var _raycaster = new THREE.Raycaster();

    var _mouse = new THREE.Vector2();
    var _movePos = new THREE.Vector3();
    var _mousePos = new THREE.Vector3();
    var _oldPos = new THREE.Vector3();
    var _startPos = new THREE.Vector3();
    var _new_pos = new THREE.Vector3();
    var _move = new THREE.Vector3();
    var _boxSelector;

    var _selected = null, _hovered = null;
    //selected is object selected

    var scope = this;

    function activate() {

        _domElement.addEventListener('mousemove', onDocumentMouseMove, false);
        _domElement.addEventListener('mousedown', onDocumentMouseDown, false);
        _domElement.addEventListener('mouseup', onDocumentMouseCancel, false);
        _domElement.addEventListener('mouseleave', onDocumentMouseCancel, false);

    }

    function deactivate() {

        _domElement.removeEventListener('mousemove', onDocumentMouseMove, false);
        _domElement.removeEventListener('mousedown', onDocumentMouseDown, false);
        _domElement.removeEventListener('mouseup', onDocumentMouseCancel, false);
        _domElement.removeEventListener('mouseleave', onDocumentMouseCancel, false);

    }

    function dispose() {

        deactivate();

    }

    function onDocumentMouseMove(event) { 
        if (getActionModes().includes("Drag")) {
            render();
            event.preventDefault(); 
            var rect = _domElement.getBoundingClientRect();

            //change the cursor if you're hovering over something selectable
            let id = gpu_picker(event)
            if (id > -1) {
                _domElement.style.cursor = 'pointer';
            }
            else {
                _domElement.style.cursor = 'auto';
            }

            _mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; //get mouse position
            _mouse.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            //use the raycaster to project the mouse position onto the plane and move the object to the mouse
            _raycaster.setFromCamera(_mouse, _camera); 
            if (_selected && scope.enabled) {
                _new_pos.copy(_raycaster.ray.intersectPlane(_plane, _mousePos));
                _move.copy(_new_pos).sub(_oldPos);

                translateElements(selectedBases, _move);
                _oldPos.copy(_new_pos); //Need difference from previous position.
                
                // Disable controls
                controls.enabled = false;

                //Update attributes on the GPU
                _selected.parent.parent.backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
                _selected.parent.parent.nucleoside.geometry["attributes"].instanceOffset.needsUpdate = true;
                _selected.parent.parent.connector.geometry["attributes"].instanceOffset.needsUpdate = true;
                _selected.parent.parent.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
                _selected.parent.parent.dummyBackbone.geometry["attributes"].instanceOffset.needsUpdate = true;
            }
            render();
        } else if (_boxSelector && getActionModes().includes("Select") && getScopeMode() === "Box") {
            // Box selection
            event.preventDefault();
            _boxSelector.redrawBox(new THREE.Vector2(event.clientX, event.clientY));
        }
    }

    function onDocumentMouseDown(event) { //if mouse is moved
        if (getActionModes().includes("Drag")) {
            event.preventDefault();

            //check if there is anything under the mouse
            let id = gpu_picker(event)
            if (id > -1) {
                //The camera points down its own -Z axis
                let camera_heading = new THREE.Vector3(0, 0, -1);
                camera_heading.applyQuaternion(camera.quaternion);

                //Create a movement plane perpendicular to the camera heading containing the clicked object
                _selected = elements[id]
                _movePos.set(0, 0, 0);
                _objPos = _selected.getInstanceParameter3("bbOffsets");
                _plane.setFromNormalAndCoplanarPoint(camera_heading, _objPos);
                _mousePos.copy(camera_heading).multiplyScalar(_plane.distanceToPoint(camera.position)).add(camera.position);
                _oldPos.copy(_objPos);
                _startPos.copy(_objPos);

				_domElement.style.cursor = 'move';

                controls.enabled = false;

			}
		} else if (getActionModes().includes("Select") && getScopeMode() === "Box") {
            // Box selection
            event.preventDefault();

            // Disable trackball controlls
            controls.enabled = false;

            // Select multiple elements my holding down ctrl
			if (!event.ctrlKey) {
				clearSelection();
			}

            // Create a selection box
            _boxSelector = new BoxSelector(
                new THREE.Vector2(event.clientX, event.clientY),
                camera, _domElement, scene
            );
        }
	}

	function onDocumentMouseCancel(event) { 
		if (getActionModes().includes("Drag")) { 
			event.preventDefault();

			//calculate new sp connectors
			if (_selected) {

                // Re-enable trackball controlls
                controls.enabled = true;

                if (selectedBases.has(_selected)) {
                    // Calculate the total translation and add it to the edit history
                    var totalMove = _new_pos.clone().sub(_startPos);
                    editHistory.add(new RevertableTranslation(selectedBases, totalMove));
                    console.log("Added translation to history: "+ totalMove.length())
                }
				_selected = null; //now nothing is selected for dragging b/c click event is over

			}
            _domElement.style.cursor = 'auto';
            render();
        } else if (_boxSelector && getActionModes().includes("Select") && getScopeMode() === "Box") {
            // Box selection
            event.preventDefault();

            // Calculate which elements are in the drawn box
            let boxSelected = _boxSelector.select(
                new THREE.Vector2(event.clientX, event.clientY)
            );

            // Toggle selected elements (unless they are already selected)
            boxSelected.forEach(element => {
                if (!selectedBases.has(element)) {
                    element.toggle();
                }
            });

            // Remove selection box and update the view
            _boxSelector.onSelectOver();
            _boxSelector = undefined;
            systems.forEach(sys => {
                updateView(sys);
            });

            // Re-enable trackball controlls
            controls.enabled = true;
		}
    }

    activate();

    // API

    this.enabled = true;

    this.activate = activate;
    this.deactivate = deactivate;
    this.dispose = dispose;

    // Backward compatibility

    this.setObjects = function () {

        console.error('THREE.DragControls: setObjects() has been removed.');

    };

    this.on = function (type, listener) {

        console.warn('THREE.DragControls: on() has been deprecated. Use addEventListener() instead.');
        scope.addEventListener(type, listener);

    };

    this.off = function (type, listener) {

        console.warn('THREE.DragControls: off() has been deprecated. Use removeEventListener() instead.');
        scope.removeEventListener(type, listener);

    };

    this.notify = function (type) {

        console.error('THREE.DragControls: notify() has been deprecated. Use dispatchEvent() instead.');
        scope.dispatchEvent({ type: type });

    };

};

THREE.DragControls.prototype = Object.create(THREE.EventDispatcher.prototype);
THREE.DragControls.prototype.constructor = THREE.DragControls;
