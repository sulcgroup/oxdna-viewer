/*
 * @author zz85 / https://github.com/zz85
 * @author mrdoob / http://mrdoob.com
 * Running this will allow you to drag three.js objects around the screen.
 */

/*To include anything such as DragControls.js, TrackballControls.js, etc., do the following:
1. Add .js file from GitHub to controls
2. Add three-dragcontrols.d.ts (make own modeled off of others) to js/controls, js/three, and js/node_modules/@types/three
3. Modify as needed
*/

THREE.DragControls = function (_objects, _camera, individ, _domElement) { //pass in objects, camera, etc.
	if (_objects instanceof THREE.Camera) {

		console.warn('THREE.DragControls: Constructor now expects ( objects, camera, domElement )');
		var temp = _objects; _objects = _camera; _camera = temp;

	}

	var _plane = new THREE.Plane();
	var _raycaster = new THREE.Raycaster();

	var _mouse = new THREE.Vector2();
	var _offset = new THREE.Vector3();
	var _intersection = new THREE.Vector3();

	var _selected = null, _hovered = null;
	//selected is object selected

	var scope = this;

	function activate() {

		_domElement.addEventListener('mousemove', onDocumentMouseMove, false);
		_domElement.addEventListener('mousedown', onDocumentMouseDown, false);
		_domElement.addEventListener('mouseup', onDocumentMouseCancel, false);
		_domElement.addEventListener('mouseleave', onDocumentMouseCancel, false);
		_domElement.addEventListener('touchmove', onDocumentTouchMove, false);
		_domElement.addEventListener('touchstart', onDocumentTouchStart, false);
		_domElement.addEventListener('touchend', onDocumentTouchEnd, false);

	}

	function deactivate() {

		_domElement.removeEventListener('mousemove', onDocumentMouseMove, false);
		_domElement.removeEventListener('mousedown', onDocumentMouseDown, false);
		_domElement.removeEventListener('mouseup', onDocumentMouseCancel, false);
		_domElement.removeEventListener('mouseleave', onDocumentMouseCancel, false);
		_domElement.removeEventListener('touchmove', onDocumentTouchMove, false);
		_domElement.removeEventListener('touchstart', onDocumentTouchStart, false);
		_domElement.removeEventListener('touchend', onDocumentTouchEnd, false);

	}

	function dispose() {

		deactivate();

	}

	function onDocumentMouseMove(event) { //when mouse is moved
		if (getActionModes().includes("Drag")) { //if in drag mode
			render();
			event.preventDefault(); //prevent default functions such as clicking in text areas, etc

			var rect = _domElement.getBoundingClientRect();

			_mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; //get mouse position
			_mouse.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;

			_raycaster.setFromCamera(_mouse, _camera); //set raycaster - object that determines click location relative to objects on scene
			if (_selected && scope.enabled) {
				if (_raycaster.ray.intersectPlane(_plane, _intersection)) {
					_selected.position.copy(_intersection.sub(_offset));
				}

				scope.dispatchEvent({ type: 'drag', object: _selected });

				return;

			}
			render(); //update scene
			_raycaster.setFromCamera(_mouse, _camera);

			var intersects = _raycaster.intersectObjects(_objects, individ); //find all objects in scene intersected by click location into interesects array

			if (intersects.length > 0) { //if something in scene was clicked - i.e. is in intersects array
				//.includes finds if string is in another string but b/c of radio buttons, scope modes are mutually exclusive so string should = scopeMode
				/*if (scopeMode.includes("Drag")) { //if scope mode is "Drag", set objects to be dragged to the clicked Mesh - i.e. backbone, con, nucleoside, or sp
				 	var object = intersects[0].object;
				 }*/
				switch (scopeMode) {
					case "Nuc": //if scope mode is "Nuc", set objects to be dragged to the clicked nucleotide
						var object = intersects[0].object.parent; break;
					case "Strand": //if scope mode is "Strand", set objects to be dragged to the clicked strand
						var object = intersects[0].object.parent.parent; break;
					case "System": //if scope mode is "System", set objects to be dragged to the clicked system
						var object = intersects[0].object.parent.parent.parent; break;
				}
				_plane.setFromNormalAndCoplanarPoint(_camera.getWorldDirection(_plane.normal), object.position);

				if (_hovered !== object) {

					scope.dispatchEvent({ type: 'hoveron', object: object });

					_domElement.style.cursor = 'pointer';
					_hovered = object;

				}
				render(); //update scene

			} else {

				if (_hovered !== null) {

					scope.dispatchEvent({ type: 'hoveroff', object: _hovered });

					_domElement.style.cursor = 'auto';
					_hovered = null;

				}

			}

		}

	}
	function onDocumentMouseDown(event) { //if mouse is moved
		if (getActionModes().includes("Drag")) { //if getActionModes() includes "Drag"
			event.preventDefault(); //prevent default mouse functions

			_raycaster.setFromCamera(_mouse, _camera); //set raycaster - object that determines click location relative to objects on scene

			var intersects = _raycaster.intersectObjects(_objects, individ); //find all objects in scene intersected by click location into interesects array

			if (intersects.length > 0) { //if something in scene was clicked - i.e. is in intersects array

				/*if (scopeMode.includes("Drag")) { //if scope mode is "Drag", set objects to be dragged to the clicked Mesh - i.e. backbone, con, nucleoside, or sp
				 	_selected = intersects[0].object;
				 }*/
				switch (scopeMode) {
					case "Nuc": //if scope mode is "Nuc", set _selected to be dragged to the clicked nucleotide
						_selected = intersects[0].object.parent; break;
					case "Strand": //if scope mode is "Strand", set objects to be dragged to the clicked strand
						_selected = intersects[0].object.parent.parent; break;
					case "System": //if scope mode is "System", set objects to be dragged to the clicked system
						_selected = intersects[0].object.parent.parent.parent; break;
				}
				if (_raycaster.ray.intersectPlane(_plane, _intersection)) {
					_offset.copy(_intersection).sub(_selected.position);
				}

				_domElement.style.cursor = 'move';

				scope.dispatchEvent({ type: 'dragstart', object: _selected });

			}
		}

	}

	function onDocumentMouseCancel(event) { //if mouse is ??
		if (getActionModes().includes("Drag")) { //if action mode includes "Drag"

			event.preventDefault();

			//calculate new sp connectors - does not work after rotation
			if (_selected) { //if there is a clicked object
				if (scopeMode == "Nuc") {
					var current_nuc = elements[parseInt(_selected.name)]; //get selected object's nucleotide global id to get Nucleotide object

					if (current_nuc.neighbor3 !== null && current_nuc.neighbor3 !== undefined) { //if neighbor3 exists
						calcsp(current_nuc); //calculate sp between current and neighbor3
					}
					if (current_nuc.neighbor5 !== null && current_nuc.neighbor5 !== undefined) { //if neighbor5 exists
						calcsp(current_nuc.neighbor5); //calculate sp between current and neighbor5
					}
				}
				scope.dispatchEvent({ type: 'dragend', object: _selected });

				_selected = null; //now nothing is selected for dragging b/c click event is over

			}
			_domElement.style.cursor = 'auto';
			render();
		}
	}

	function calcsp(current_nuc) { //calculate new sp
		var temp = new THREE.Vector3();
		//temp = current_nuc.neighbor3.visual_object.children[0].position;
		current_nuc.neighbor3.visual_object.children[0].getWorldPosition(temp); //get neighbor3's backbone world position
		var x_bb_last = temp.x,
			y_bb_last = temp.y,
			z_bb_last = temp.z;
		//temp = current_nuc.visual_object.children[0].position;
		current_nuc.visual_object.children[0].getWorldPosition(temp); //get current_nuc's backbone world position
		// compute backbone cm
		let x_bb = temp.x;
		let y_bb = temp.y;
		let z_bb = temp.z;
		//calculate sp location
		let x_sp = (x_bb + x_bb_last) / 2,
			y_sp = (y_bb + y_bb_last) / 2,
			z_sp = (z_bb + z_bb_last) / 2;

		let sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2)); //calculate sp length
		// easy periodic boundary condition fix  
		var rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion( //create sp's rotation - I think this is the source of error for the sp recalculation not working after rotations
			new THREE.Quaternion().setFromUnitVectors(
				new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_bb - x_sp, y_bb - y_sp, z_bb - z_sp).normalize()
			)
        );
        //let material = current_nuc.parent.parent.strand_to_material(current_nuc.parent.strand_id);
        //let tempsp = new THREE.Mesh(connector_geometry, material); //create new Mesh w/ proper coloring
        let tempsp = current_nuc.updateSP();
        tempsp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //set length
        tempsp.applyMatrix(rotation_sp); //set rotation
        tempsp.position.set(x_sp, y_sp, z_sp); //set position
        current_nuc.visual_object.getWorldPosition(temp); //get nucleotide's world position and subtract it from new sp position to accomodate for setting positions based on center of masses
        tempsp.position.sub(temp);
        current_nuc.visual_object.remove(current_nuc.visual_object.children[current_nuc.SP_CON]); //remove old sp
        current_nuc.visual_object.add(tempsp); //add new sp
	}

	function onDocumentTouchMove(event) { //if mouse moves
		if (getActionModes().includes("Drag")) { //if action mode includes "Drag"
			event.preventDefault(); //prevent default mouse functions
			event = event.changedTouches[0];

			var rect = _domElement.getBoundingClientRect();

			_mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; //calculate mouse click position
			_mouse.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;

			_raycaster.setFromCamera(_mouse, _camera);

			if (_selected && scope.enabled) { //if an object in scene was clicked

				if (_raycaster.ray.intersectPlane(_plane, _intersection)) {
					_selected.position.copy(_intersection.sub(_offset));
				}

				scope.dispatchEvent({ type: 'drag', object: _selected });

				return;

			}
		}
	}

	function onDocumentTouchStart(event) { //on mouse start on document
		if (getActionModes().includes("Drag")) { //if getActionModes() includes "Drag"

			event.preventDefault(); //prevent default mouse functions
			event = event.changedTouches[0];

			var rect = _domElement.getBoundingClientRect();

			_mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; //get mouse click location
			_mouse.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;

			_raycaster.setFromCamera(_mouse, _camera);

			var intersects = _raycaster.intersectObjects(_objects, individ);

			if (intersects.length > 0) { //if something in scene was clicked - i.e. is in intersects array
				switch (scopeMode) {
					case "Nuc": //if "Nuc", set _selected to be dragged to the clicked nucleotide
						_selected = intersects[0].object.parent; break;
					case "Strand": //if "Strand", set _selected to be dragged to the clicked strand
						_selected = intersects[0].object.parent.parent; break;
					case "System": //if "System", set _selected to be dragged to the clicked system
						_selected = intersects[0].object.parent.parent.parent; break;
				}

				_plane.setFromNormalAndCoplanarPoint(_camera.getWorldDirection(_plane.normal), _selected.position);

				if (_raycaster.ray.intersectPlane(_plane, _intersection)) {

					_offset.copy(_intersection).sub(_selected.position);

				}

				_domElement.style.cursor = 'move';

				scope.dispatchEvent({ type: 'dragstart', object: _selected });

			}
		}

	}

	function onDocumentTouchEnd(event) { //if mouse ??
		if (getActionModes().includes("Drag")) {

			event.preventDefault(); //prevent default mouse functions

			if (_selected) { //if something was clicked

				scope.dispatchEvent({ type: 'dragend', object: _selected });

				_selected = null; //set clicked object/_selected to null

			}

			_domElement.style.cursor = 'auto';
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
