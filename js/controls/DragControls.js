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

				// if (scopeMode.includes("drag")) {
				// 	var object = intersects[0].object;
				// }
				if (scopeMode.includes("Nuc")) {
					var object = intersects[0].object.parent;
				}
				else if (scopeMode.includes("Strand")) {
					for (let i = 0; i < systems.length; i++) {
						for (let j = 0; j < systems[i].strands.length; j++) {
							for (let k = 0; k < systems[i].strands[j].nucleotides.length; k++) {
								for (let l = 0; l < systems[i].strands[j].nucleotides[k].visual_object.children.length; l++) {
									if (systems[i].strands[j].nucleotides[k].visual_object.children[l].id == intersects[0].object.id) {
										var object = systems[i].strands[j].strand_3objects;

									}
								}
							}
						}
					}
				}
				else if (scopeMode.includes("System")) {
					for (let i = 0; i < systems.length; i++) {
						for (let j = 0; j < systems[i].strands.length; j++) {
							for (let k = 0; k < systems[i].strands[j].nucleotides.length; k++) {
								for (let l = 0; l < systems[i].strands[j].nucleotides[k].visual_object.children.length; l++) {
									if (systems[i].strands[j].nucleotides[k].visual_object.children[l].id == intersects[0].object.id) {
										object = systems[i].system_3objects;
									}
								}
							}
						}
					}
				}

				_plane.setFromNormalAndCoplanarPoint(_camera.getWorldDirection(_plane.normal), object.position);

				if (_hovered !== object) {

					scope.dispatchEvent({ type: 'hoveron', object: object });

					_domElement.style.cursor = 'pointer';
					_hovered = object;

				}

			} else {

				if (_hovered !== null) {

					scope.dispatchEvent({ type: 'hoveroff', object: _hovered });

					_domElement.style.cursor = 'auto';
					_hovered = null;

				}

			}
			render();
		}

	}

	function onDocumentMouseDown(event) {
		if (actionMode.includes("Drag")) {
			event.preventDefault();

			_raycaster.setFromCamera(_mouse, _camera);

			var intersects = _raycaster.intersectObjects(_objects, individ);

			if (intersects.length > 0) {

				// if (scopeMode.includes("drag")) {
				// 	_selected = intersects[0].object;
				// }
				if (scopeMode.includes("Nuc")) {
					_selected = intersects[0].object.parent;
				}
				else if (scopeMode.includes("Strand")) {
					for (let i = 0; i < systems.length; i++) {
						for (let j = 0; j < systems[i].strands.length; j++) {
							for (let k = 0; k < systems[i].strands[j].nucleotides.length; k++) {
								for (let l = 0; l < systems[i].strands[j].nucleotides[k].visual_object.children.length; l++) {
									if (systems[i].strands[j].nucleotides[k].visual_object.children[l].id == intersects[0].object.id) {
										_selected = systems[i].strands[j].strand_3objects;

									}
								}
							}
						}
					}
				}
				else if (scopeMode.includes("System")) {
					for (let i = 0; i < systems.length; i++) {
						for (let j = 0; j < systems[i].strands.length; j++) {
							for (let k = 0; k < systems[i].strands[j].nucleotides.length; k++) {
								for (let l = 0; l < systems[i].strands[j].nucleotides[k].visual_object.children.length; l++) {
									if (systems[i].strands[j].nucleotides[k].visual_object.children[l].id == intersects[0].object.id) {
										_selected = systems[i].system_3objects;
									}
								}
							}
						}
					}
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

				scope.dispatchEvent({ type: 'dragend', object: _selected });

				_selected = null;

			}

			_domElement.style.cursor = 'auto';
		}
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
					console.log("333333333333");
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
				// if (scopeMode.includes("drag")) {
				// 	_selected = intersects[0].object;
				// }
				if (scopeMode.includes("Nuc")) {
					_selected = intersects[0].object.parent;
				}
				else if (scopeMode.includes("Strand")) {
					for (let i = 0; i < systems.length; i++) {
						for (let j = 0; j < systems[i].strands.length; j++) {
							for (let k = 0; k < systems[i].strands[j].nucleotides.length; k++) {
								for (let l = 0; l < systems[i].strands[j].nucleotides[k].visual_object.children.length; l++) {
									if (systems[i].strands[j].nucleotides[k].visual_object.children[l].id == intersects[0].object.id) {
										_selected = systems[i].strands[j].strand_3objects;

									}
								}
							}
						}
					}
				}
				else if (scopeMode.includes("System")) {
					for (let i = 0; i < systems.length; i++) {
						for (let j = 0; j < systems[i].strands.length; j++) {
							for (let k = 0; k < systems[i].strands[j].nucleotides.length; k++) {
								for (let l = 0; l < systems[i].strands[j].nucleotides[k].visual_object.children.length; l++) {
									if (systems[i].strands[j].nucleotides[k].visual_object.children[l].id == intersects[0].object.id) {
										_selected = systems[i].system_3objects;
									}
								}
							}
						}
					}
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