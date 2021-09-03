THREE.ShaderLib.customDepthRGBA = { // this is a cut-and-paste of the depth shader -- modified to accommodate instancing for this app

	uniforms: THREE.ShaderLib.depth.uniforms,

	vertexShader:
		`
		// instanced
		#ifdef INSTANCED

			attribute vec3 instanceOffset;
			attribute vec4 instanceRotation;
			attribute vec3 instanceScale;
			attribute vec3 instanceVisibility;
			vec3 rotate_vector( vec4 quat, vec3 vec );
			vec3 rotate_vector( vec4 quat, vec3 vec ){ 
				return vec + 2.0 * cross( cross( vec, quat.xyz ) + quat.w * vec, quat.xyz ); 
			}

		#endif

		#include <common>
		#include <uv_pars_vertex>
		#include <displacementmap_pars_vertex>
		#include <morphtarget_pars_vertex>
		#include <skinning_pars_vertex>
		#include <logdepthbuf_pars_vertex>
		#include <clipping_planes_pars_vertex>

		void main() {

			#include <uv_vertex>

			#include <skinbase_vertex>

			#ifdef USE_DISPLACEMENTMAP

				#include <beginnormal_vertex>
				#include <morphnormal_vertex>
				#include <skinnormal_vertex>

			#endif

			#include <begin_vertex>

			// instanced
			#ifdef INSTANCED
				transformed *= instanceScale * instanceVisibility;
				transformed = rotate_vector( instanceRotation, transformed);
				transformed = transformed + instanceOffset;

			#endif

			#include <morphtarget_vertex>
			#include <skinning_vertex>
			#include <displacementmap_vertex>
			#include <project_vertex>
			#include <logdepthbuf_vertex>
			#include <clipping_planes_vertex>

		}
	`,

	fragmentShader: THREE.ShaderChunk.depth_frag

};




THREE.ShaderLib.physical = {
	uniforms: THREE.ShaderLib.physical.uniforms,

	vertexShader:
	`
	#define PHYSICAL

	#ifdef INSTANCED
	attribute vec3 instanceOffset;
	attribute vec4 instanceRotation;
	attribute vec3 instanceColor;
	attribute vec3 instanceScale;
	attribute vec3 instanceVisibility;
	vec3 rotate_vector( vec4 quat, vec3 vec );
	vec3 rotate_vector( vec4 quat, vec3 vec ){ 
		return vec + 2.0 * cross( cross( vec, quat.xyz ) + quat.w * vec, quat.xyz ); 
	}
	#endif

	varying vec3 vViewPosition;
	#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
	varying vec3 vTangent;
	varying vec3 vBitangent;
	#endif
	#endif
	#include <common>
	#include <uv_pars_vertex>
	#include <uv2_pars_vertex>
	#include <displacementmap_pars_vertex>
	#include <color_pars_vertex>
	#include <fog_pars_vertex>
	#include <morphtarget_pars_vertex>
	#include <skinning_pars_vertex>
	#include <shadowmap_pars_vertex>
	#include <logdepthbuf_pars_vertex>
	#include <clipping_planes_pars_vertex>
	void main() {
		#include <uv_vertex>
		#include <uv2_vertex>
		#include <color_vertex>

		// vertex colors instanced
		#ifdef INSTANCED
			#ifdef USE_COLOR
				vColor.xyz = instanceColor.xyz;
			#endif
		#endif

		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
		#ifndef FLAT_SHADED
		vNormal = normalize( transformedNormal );
		#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#endif
		#endif
		#include <begin_vertex>

		// position instanced
		#ifdef INSTANCED
			transformed *= instanceScale * instanceVisibility;
			transformed = rotate_vector( instanceRotation, transformed);
			transformed = transformed + instanceOffset;
		#endif


		#include <morphtarget_vertex>
		#include <skinning_vertex>
		#include <displacementmap_vertex>
		#include <project_vertex>
		#include <logdepthbuf_vertex>
		#include <clipping_planes_vertex>
		vViewPosition = - mvPosition.xyz;
		#include <worldpos_vertex>
		#include <shadowmap_vertex>
		#include <fog_vertex>
	}
	`,
	fragmentShader: THREE.ShaderLib.physical.fragmentShader
};



THREE.ShaderLib.phong = { // this is a cut-and-paste of the Phong shader -- modified to accommodate instancing for this app

	uniforms: THREE.ShaderLib.phong.uniforms,

	vertexShader:
		`
		#define PHONG

		#ifdef INSTANCED
		attribute vec3 instanceOffset;
		attribute vec4 instanceRotation;
		attribute vec3 instanceColor;
		attribute vec3 instanceScale;
		attribute vec3 instanceVisibility;
		vec3 rotate_vector( vec4 quat, vec3 vec );
		vec3 rotate_vector( vec4 quat, vec3 vec ){ 
			return vec + 2.0 * cross( cross( vec, quat.xyz ) + quat.w * vec, quat.xyz ); 
		}
		#endif
		
		varying vec3 vViewPosition;
		#ifndef FLAT_SHADED
		varying vec3 vNormal;
		#endif
		#include <common>
		#include <uv_pars_vertex>
		#include <uv2_pars_vertex>
		#include <displacementmap_pars_vertex>
		#include <envmap_pars_vertex>
		#include <color_pars_vertex>
		#include <fog_pars_vertex>
		#include <morphtarget_pars_vertex>
		#include <skinning_pars_vertex>
		#include <shadowmap_pars_vertex>
		#include <logdepthbuf_pars_vertex>
		#include <clipping_planes_pars_vertex>
		void main() {
			#include <uv_vertex>
			#include <uv2_vertex>
			#include <color_vertex>
		
			// vertex colors instanced
			#ifdef INSTANCED
				#ifdef USE_COLOR
					vColor.xyz = instanceColor.xyz;
				#endif
			#endif
		
			#include <beginnormal_vertex>
			#include <morphnormal_vertex>
			#include <skinbase_vertex>
			#include <skinnormal_vertex>
			#include <defaultnormal_vertex>
			#ifndef FLAT_SHADED
			vNormal = normalize( transformedNormal );
			#endif
			#include <begin_vertex>
			// position instanced
			#ifdef INSTANCED
				transformed *= instanceScale * instanceVisibility;
				transformed = rotate_vector( instanceRotation, transformed);
				transformed = transformed + instanceOffset;
			#endif
			
			#include <morphtarget_vertex>
			#include <skinning_vertex>
			#include <displacementmap_vertex>
			#include <project_vertex>
			#include <logdepthbuf_vertex>
			#include <clipping_planes_vertex>
			vViewPosition = - mvPosition.xyz;
			#include <worldpos_vertex>
			#include <envmap_vertex>
			#include <shadowmap_vertex>
			#include <fog_vertex>
		}`,

	fragmentShader: THREE.ShaderLib.phong.fragmentShader

};




THREE.ShaderLib.lambert = { // this is a cut-and-paste of the lambert shader -- modified to accommodate instancing for this app

	uniforms: THREE.ShaderLib.lambert.uniforms,

	vertexShader:
	`
	#define LAMBERT
	#ifdef INSTANCED
		attribute vec3 instanceOffset;
		attribute vec4 instanceRotation;
		attribute vec3 instanceColor;
		attribute vec3 instanceScale;
		attribute vec3 instanceVisibility;
		vec3 rotate_vector( vec4 quat, vec3 vec );
		vec3 rotate_vector( vec4 quat, vec3 vec ){ 
			return vec + 2.0 * cross( cross( vec, quat.xyz ) + quat.w * vec, quat.xyz ); 
		}
	#endif
	varying vec3 vLightFront;
	varying vec3 vIndirectFront;
	#ifdef DOUBLE_SIDED
		varying vec3 vLightBack;
		varying vec3 vIndirectBack;
	#endif
	#include <common>
	#include <uv_pars_vertex>
	#include <uv2_pars_vertex>
	#include <envmap_pars_vertex>
	#include <bsdfs>
	#include <lights_pars_begin>
	#include <color_pars_vertex>
	#include <fog_pars_vertex>
	#include <morphtarget_pars_vertex>
	#include <skinning_pars_vertex>
	#include <shadowmap_pars_vertex>
	#include <logdepthbuf_pars_vertex>
	#include <clipping_planes_pars_vertex>
	void main() {
		#include <uv_vertex>
		#include <uv2_vertex>
		#include <color_vertex>
		// vertex colors instanced
		#ifdef INSTANCED
			#ifdef USE_COLOR
				vColor.xyz = instanceColor.xyz;
			#endif
		#endif
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#ifdef INSTANCED
			vec3 transformedNormal = normalMatrix * rotate_vector(instanceRotation, objectNormal);
		#endif
		#include <begin_vertex>
		// position instanced
		#ifdef INSTANCED
			transformed *= instanceScale * instanceVisibility;
			transformed = rotate_vector( instanceRotation, transformed);
			transformed = transformed + instanceOffset;
		#endif
		#include <morphtarget_vertex>
		#include <skinning_vertex>
		#include <project_vertex>
		#include <logdepthbuf_vertex>
		#include <clipping_planes_vertex>
		#include <worldpos_vertex>
		#include <envmap_vertex>
		#include <lights_lambert_vertex>
		#include <shadowmap_vertex>
		#include <fog_vertex>
	}
	`,

	fragmentShader: THREE.ShaderLib.lambert.fragmentShader

};

//gpu picking allows us to interact with nucleotides without raycasting, which is very CPU-intensive
var pickingScene = new THREE.Scene();

//var pickingTexture = new THREE.WebGLRenderTarget(renderer.domElement.clientWidth, renderer.domElement.clientHeight)
var pickingTexture = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);

pickingTexture.texture.minFilter = THREE.LinearFilter; //voodoo

//create dummy vertex and fragment shaders 
var vs3D = `
attribute vec3 instanceColor;
attribute vec3 instanceVisibility;
varying vec3 vinstanceColor;
attribute vec3 instanceOffset;

void main(){
vinstanceColor = instanceColor;
vec3 pos = position + instanceOffset;
pos *= instanceVisibility;
gl_Position = projectionMatrix * modelViewMatrix * vec4( pos, 1.0);
}`;

var fs3D = `
varying vec3 vinstanceColor;
void main(void) {
gl_FragColor = vec4(vinstanceColor,1.0);
}`;

var pickingMaterial = new THREE.ShaderMaterial(
    {
        vertexShader: vs3D,
        fragmentShader: fs3D
	});
	
//Renders the secret scene containing the picking materials
//Returns the global id of the particle under the mouse.
//The GPU picker can accommodate 16,581,375 particles...
//I have no idea what happens if you go over that, but I kinda doubt we'll find out any time soon.
function gpuPicker(event): number {
	renderer.setRenderTarget(pickingTexture);
	renderer.render(pickingScene, camera);
	let pixelBuffer = new Uint8Array(4);
	renderer.readRenderTargetPixels(pickingTexture, event.pageX, pickingTexture.height - event.pageY, 1, 1, pixelBuffer);
	let id = ((pixelBuffer[0] << 16) | (pixelBuffer[1] << 8) | (pixelBuffer[2])) - 1; 
	renderer.setRenderTarget(null);
	render();
	return id;
}