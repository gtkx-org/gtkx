import * as gl from "@gtkx/gl";

/**
 * Sets a shader's source from a single string, wrapping the registry-faithful
 * count/array/length form of `shaderSource`.
 *
 * @param shader - The shader object name
 * @param source - The complete GLSL source
 */
export const setShaderSource = (shader: number, source: string): void => {
    gl.shaderSource(shader, 1, [source], [-1]);
};

/**
 * Uploads float vertex data through the explicit-size `bufferData` form,
 * passing the typed array zero-copy.
 *
 * @param target - The buffer target (e.g. `ARRAY_BUFFER`)
 * @param data - The float values to upload
 * @param usage - The usage hint (e.g. `STATIC_DRAW`)
 */
export const bufferFloatData = (target: number, data: readonly number[], usage: number): void => {
    const view = new Float32Array(data);
    gl.bufferData(target, view.byteLength, view, usage);
};
