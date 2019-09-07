/**
* The vertex shader's main() function must define `gl_Position`,
* which describes the position of each vertex in screen coordinates.
*
* To do so, we can use the following variables defined by Three.js:
*   attribute vec3 position - stores each vertex's position in world space
*   attribute vec2 uv - sets each vertex's the texture coordinates
*   uniform mat4 projectionMatrix - maps camera space into screen space
*   uniform mat4 modelViewMatrix - combines:
*     model matrix: maps a point's local coordinate space into world space
*     view matrix: maps world space into camera space
*
* `attributes` can vary from vertex to vertex and are defined as arrays
*   with length equal to the number of vertices. Each index in the array
*   is an attribute for the corresponding vertex. Each attribute must
*   contain n_vertices * n_components, where n_components is the length
*   of the given datatype (e.g. for a vec2, n_components = 2; for a float,
*   n_components = 1)
* `uniforms` are constant across all vertices
* `varyings` are values passed from the vertex to the fragment shader
*
* For the full list of uniforms defined by three, see:
*   https://threejs.org/docs/#api/renderers/webgl/WebGLProgram
**/

precision mediump float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;

attribute vec3 position;    // blueprint's vertex positions
attribute vec3 color;       // only used for raycasting
attribute vec3 translation; // x y translation offsets for an instance

varying vec3 vColor;

void main() {
  vColor = color;

  // set point position
  vec3 pos = position + translation;
  vec4 projected = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projected;

  // use the delta between the point position and camera position to size point
  float xDelta = pow(projected[0] - cameraPosition[0], 2.0);
  float yDelta = pow(projected[1] - cameraPosition[1], 2.0);
  float zDelta = pow(projected[2] - cameraPosition[2], 2.0);
  float delta = pow(xDelta + yDelta + zDelta, 0.5);
  gl_PointSize = 10000.0 / delta;
}
