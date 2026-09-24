import * as Graphene from "@gtkx/gi/graphene";
import * as gl from "@gtkx/gl";

type AttributeBinding = readonly [index: number, name: string];

const setShaderSource = (shader: number, source: string): void => {
    gl.shaderSource(shader, 1, [source], [-1]);
};

const compileShader = (type: number, source: string, name: string): number => {
    const shader = gl.createShader(type);
    setShaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderiv(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`${name} shader compilation failed: ${log}`);
    }

    return shader;
};

const createShaderProgram = (
    vertexSource: string,
    fragmentSource: string,
    attributeBindings: readonly AttributeBinding[] = [],
): number => {
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource, "Fragment");
    let vertexShader: number;

    try {
        vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource, "Vertex");
    } catch (error) {
        gl.deleteShader(fragmentShader);
        throw error;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    for (const [index, name] of attributeBindings) {
        gl.bindAttribLocation(program, index, name);
    }

    gl.linkProgram(program);
    const linked = gl.getProgramiv(program, gl.LINK_STATUS);
    const log = linked ? "" : gl.getProgramInfoLog(program);
    gl.detachShader(program, vertexShader);
    gl.detachShader(program, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!linked) {
        gl.deleteProgram(program);
        throw new Error(`Shader program linking failed: ${log}`);
    }

    return program;
};

const rotationMatrix = (angle: number, x: number, y: number, z: number): Graphene.Matrix => {
    const axis = new Graphene.Vec3();
    axis.init(x, y, z);

    return new Graphene.Matrix().initRotate(angle, axis);
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

export { bufferFloatData, createShaderProgram, createVertexBuffer, rotationMatrix };
