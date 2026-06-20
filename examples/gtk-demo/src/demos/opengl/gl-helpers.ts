import * as gl from "@gtkx/gl";

export const setShaderSource = (shader: number, source: string): void => {
    gl.shaderSource(shader, 1, [source], [-1]);
};

export const bufferFloatData = (target: number, data: number[], usage: number): void => {
    const view = new Float32Array(data);
    gl.bufferData(target, view.byteLength, view, usage);
};
