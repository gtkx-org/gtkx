import * as gl from "@gtkx/gl";

const setShaderSource = (shader: number, source: string): void => {
    gl.shaderSource(shader, 1, [source], [-1]);
};

const bufferFloatData = (target: number, data: number[], usage: number): void => {
    const view = new Float32Array(data);
    gl.bufferData(target, view.byteLength, view, usage);
};

const createVertexBuffer = (data: number[]): { vao: number; vbo: number } => {
    const vao = gl.genVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.genBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    bufferFloatData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    return { vao, vbo };
};

export { bufferFloatData, createVertexBuffer, setShaderSource };
