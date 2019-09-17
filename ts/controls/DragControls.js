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
    var _new_pos = new THREE.Vector3
    var _move = new THREE.Vector3();

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
                _move.copy(_new_pos).sub(_oldPos)
                switch (scopeMode) {
                    case "Monomer":
                        _selected.translate_position(_move);
                        break;
                    case "Strand":
                        _selected.parent.translate_strand(_move);
                        break;
                    case "System":
                        _selected.parent.parent.translate_system(_move);
                        break;
                }
                _oldPos.copy(_new_pos); //Need difference from previous position.
                

                scope.dispatchEvent({ type: 'drag' });

                //Update attributes on the GPU
                _selected.parent.parent.backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
                _selected.parent.parent.nucleoside.geometry["attributes"].instanceOffset.needsUpdate = true;
                _selected.parent.parent.connector.geometry["attributes"].instanceOffset.needsUpdate = true;
                _selected.parent.parent.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
                _selected.parent.parent.dummy_backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
            }
            render();

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
                _objPos = _selected.get_instance_parameter3("bb_offsets");
                _plane.setFromNormalAndCoplanarPoint(camera_heading, _objPos);
                _mousePos.copy(camera_heading).multiplyScalar(_plane.distanceToPoint(camera.position)).add(camera.position);
                _oldPos.copy(_objPos);

				_domElement.style.cursor = 'move';

				scope.dispatchEvent({ type: 'dragstart'});

			}
		}

	}

	function onDocumentMouseCancel(event) { 
		if (getActionModes().includes("Drag")) { 

			event.preventDefault();

			//calculate new sp connectors
			if (_selected) { 
				if (scopeMode == "Monomer") {

					if (_selected.neighbor3 !== null && _selected.neighbor3 !== undefined) { 
						calcsp(_selected); //calculate sp between current and neighbor3
					}
					if (_selected.neighbor5 !== null && _selected.neighbor5 !== undefined) { 
						calcsp(_selected.neighbor5); //calculate sp between current and neighbor5
					}
				}
				scope.dispatchEvent({ type: 'dragend' });

				_selected = null; //now nothing is selected for dragging b/c click event is over

			}
			_domElement.style.cursor = 'auto';
			render();
		}
    }

    //adjust the backbone after the move
	function calcsp(current_nuc) { 
		let temp = current_nuc.neighbor3.get_instance_parameter3("bb_offsets");
		let x_bb_last = temp.x,
			y_bb_last = temp.y,
			z_bb_last = temp.z;
		temp = current_nuc.get_instance_parameter3("bb_offsets"); //get current_nuc's backbone world position
		let x_bb = temp.x;
		let y_bb = temp.y;
        let z_bb = temp.z;
        
		//calculate sp location, length and orientation
		let x_sp = (x_bb + x_bb_last) / 2,
			y_sp = (y_bb + y_bb_last) / 2,
			z_sp = (z_bb + z_bb_last) / 2;
		let sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2)); 
		let rotation_sp = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize());
        
        current_nuc.set_instance_parameter('bbcon_offsets', [x_sp, y_sp, z_sp]);
        current_nuc.set_instance_parameter('bbcon_rotation', [rotation_sp.w, rotation_sp.z, rotation_sp.y, rotation_sp.x]);
        current_nuc.set_instance_parameter('bbcon_scales', [1, sp_len, 1]);
        current_nuc.parent.parent.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
        current_nuc.parent.parent.bbconnector.geometry["attributes"].instanceRotation.needsUpdate = true;
        current_nuc.parent.parent.bbconnector.geometry["attributes"].instanceScale.needsUpdate = true;
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
