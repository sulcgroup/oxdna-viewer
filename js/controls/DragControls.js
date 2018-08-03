/*
 * @author zz85 / https://github.com/zz85
 * @author mrdoob / http://mrdoob.com
 * Running this will allow you to drag three.js objects around the screen.
 */

THREE.DragControls = function (_objects, _camera, individ, _domElement) {
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

	//

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

	function onDocumentMouseMove(event) {
		if (actionMode.includes("Drag")) {
			render();
			event.preventDefault();

			var rect = _domElement.getBoundingClientRect();

			_mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
			_mouse.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;

			_raycaster.setFromCamera(_mouse, _camera);
			if (_selected && scope.enabled) {
				if (_raycaster.ray.intersectPlane(_plane, _intersection)) {
					_selected.position.copy(_intersection.sub(_offset));
				}

				scope.dispatchEvent({ type: 'drag', object: _selected });

				return;

			}
			render();
			_raycaster.setFromCamera(_mouse, _camera);

			var intersects = _raycaster.intersectObjects(_objects, individ);

			if (intersects.length > 0) {

				// if (scopeMode.includes("Drag")) {
				// 	var object = intersects[0].object;
				// }
				if (scopeMode.includes("Nuc")) {
					var object = intersects[0].object.parent;
				}
				else if (scopeMode.includes("Strand")) {
					var object = intersects[0].object.parent.parent;
				}
				else if (scopeMode.includes("System")) {
					var object = intersects[0].object.parent.parent.parent;
				}
				_plane.setFromNormalAndCoplanarPoint(_camera.getWorldDirection(_plane.normal), object.position);

				if (_hovered !== object) {

					scope.dispatchEvent({ type: 'hoveron', object: object });

					_domElement.style.cursor = 'pointer';
					_hovered = object;

				}
				render();

			} else {

				if (_hovered !== null) {

					scope.dispatchEvent({ type: 'hoveroff', object: _hovered });

					_domElement.style.cursor = 'auto';
					_hovered = null;

				}

			}

		}

	}
	function onDocumentMouseDown(event) {
		if (actionMode.includes("Drag")) {
			event.preventDefault();

			_raycaster.setFromCamera(_mouse, _camera);

			var intersects = _raycaster.intersectObjects(_objects, individ);

			if (intersects.length > 0) {

				// if (scopeMode.includes("Drag")) {
				// 	_selected = intersects[0].object;
				// }
				if (scopeMode.includes("Nuc")) {
					_selected = intersects[0].object.parent;
				}
				else if (scopeMode.includes("Strand")) {
					_selected = intersects[0].object.parent.parent;
				}
				else if (scopeMode.includes("System")) {
					_selected = intersects[0].object.parent.parent.parent;
				}
				if (_raycaster.ray.intersectPlane(_plane, _intersection)) {
					_offset.copy(_intersection).sub(_selected.position);
				}

				_domElement.style.cursor = 'move';

				scope.dispatchEvent({ type: 'dragstart', object: _selected });

			}
		}

	}

	function onDocumentMouseCancel(event) {
		if (actionMode.includes("Drag")) {

			event.preventDefault();

			if (_selected) {
				if (scopeMode.includes("Nuc")) {
					var current_nuc = nucleotides[parseInt(_selected.name)];

					if (current_nuc.neighbor3 !== null && current_nuc.neighbor3 !== undefined) {
						calcsp(current_nuc);
					}
					if (current_nuc.neighbor5 !== null && current_nuc.neighbor5 !== undefined) {
						calcsp(systems[current_nuc.my_system].strands[current_nuc.my_strand - 1].nucleotides[current_nuc.local_id + 1]);
					}

				}
				scope.dispatchEvent({ type: 'dragend', object: _selected });

				_selected = null;

			}

			_domElement.style.cursor = 'auto';
			render();
		}
	}

	function calcsp(current_nuc) {
		var temp = new THREE.Vector3();
		//temp = current_nuc.neighbor3.visual_object.children[0].position;
		current_nuc.neighbor3.visual_object.children[0].getWorldPosition(temp);
		var x_bb_last = temp.x,
			y_bb_last = temp.y,
			z_bb_last = temp.z;
		//temp = current_nuc.visual_object.children[0].position;
		current_nuc.visual_object.children[0].getWorldPosition(temp);
		// compute backbone cm
		let x_bb = temp.x;
		let y_bb = temp.y;
		let z_bb = temp.z;
		current_nuc.visual_object.children[4].getWorldPosition(temp);

		//last, add the sugar-phosphate bond since its not done for the first nucleotide in each strand
		let x_sp = (x_bb + x_bb_last) / 2,
			y_sp = (y_bb + y_bb_last) / 2,
			z_sp = (z_bb + z_bb_last) / 2;

		let sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
		// easy periodic boundary condition fix  
		var rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(
			new THREE.Quaternion().setFromUnitVectors(
				temp.normalize(), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize()
			)
		);
		let tempsp = new THREE.Mesh(connector_geometry, backbone_materials[Math.floor(current_nuc.my_strand % backbone_materials.length)]);
		tempsp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0));
		tempsp.applyMatrix(rotation_sp);
		tempsp.position.set(x_sp, y_sp, z_sp);
		current_nuc.visual_object.getWorldPosition(temp);
		tempsp.position.sub(temp);
		current_nuc.visual_object.remove(current_nuc.visual_object.children[4]);
		current_nuc.visual_object.add(tempsp);
	}

	function onDocumentTouchMove(event) {
		if (actionMode.includes("Drag")) {

			event.preventDefault();
			event = event.changedTouches[0];

			var rect = _domElement.getBoundingClientRect();

			_mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
			_mouse.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;

			_raycaster.setFromCamera(_mouse, _camera);

			if (_selected && scope.enabled) {

				if (_raycaster.ray.intersectPlane(_plane, _intersection)) {
					_selected.position.copy(_intersection.sub(_offset));
				}

				scope.dispatchEvent({ type: 'drag', object: _selected });

				return;

			}
		}
	}


	function onDocumentTouchStart(event) {
		if (actionMode.includes("Drag")) {

			event.preventDefault();
			event = event.changedTouches[0];

			var rect = _domElement.getBoundingClientRect();

			_mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
			_mouse.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;

			_raycaster.setFromCamera(_mouse, _camera);

			var intersects = _raycaster.intersectObjects(_objects, individ);

			if (intersects.length > 0) {
				// if (scopeMode.includes("Drag")) {
				// 	_selected = intersects[0].object;
				// }
				if (scopeMode.includes("Nuc")) {
					_selected = intersects[0].object.parent;
				}
				else if (scopeMode.includes("Strand")) {
					_selected = intersects[0].object.parent.parent;
				}
				else if (scopeMode.includes("System")) {
					_selected = intersects[0].object.parent.parent.parent;
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

	function onDocumentTouchEnd(event) {
		if (actionMode.includes("Drag")) {

			event.preventDefault();

			if (_selected) {

				scope.dispatchEvent({ type: 'dragend', object: _selected });

				_selected = null;

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