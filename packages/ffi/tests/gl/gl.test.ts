import { beforeAll, describe, expect, it } from "vitest";
import * as Gtk from "../../src/generated/gtk/gtk.js";
import * as gl from "../../src/gl/index.js";

let glReady = false;

const BASIC_VERT = `#version 300 es
precision mediump float;
in vec3 aPos;
void main() { gl_Position = vec4(aPos, 1.0); }`;

const BASIC_FRAG = `#version 300 es
precision mediump float;
out vec4 FragColor;
void main() { FragColor = vec4(1.0, 0.0, 0.0, 1.0); }`;

const UNIFORM_VERT = `#version 300 es
precision mediump float;
in vec3 aPos;
uniform float uFloat;
uniform vec2 uVec2;
uniform vec3 uVec3;
uniform vec4 uVec4;
uniform int uInt;
uniform mat4 uMat4;
void main() {
    gl_Position = uMat4 * vec4(aPos * uFloat + vec3(uVec2, 0.0) + uVec3 + uVec4.xyz, 1.0) + vec4(uInt);
}`;

const TRIANGLE_POSITIONS = [-1, -1, 0, 1, -1, 0, 0, 1, 0];

const compileShaderPair = (vertSrc: string, fragSrc: string): number => {
    const vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertShader, vertSrc);
    gl.compileShader(vertShader);

    const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, fragSrc);
    gl.compileShader(fragShader);

    const program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    gl.deleteShader(vertShader);
    gl.deleteShader(fragShader);

    return program;
};

const setUpTriangleAttribArray = (): { vao: number; vbo: number } => {
    const vao = gl.genVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.genBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, TRIANGLE_POSITIONS, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, { size: 3, type: gl.FLOAT, normalized: false, stride: 0, offset: 0 });
    gl.enableVertexAttribArray(0);

    return { vao, vbo };
};

beforeAll(async () => {
    const window = new Gtk.Window();
    const glArea = new Gtk.GLArea();
    window.setChild(glArea);

    await new Promise<void>((resolve) => {
        glArea.connect("realize", () => {
            glArea.makeCurrent();
            if (!glArea.getError()) {
                glReady = true;
            }
            resolve();
        });
        window.present();
    });
});

describe("shader operations", () => {
    it("creates and deletes a vertex shader", () => {
        if (!glReady) return;
        const shader = gl.createShader(gl.VERTEX_SHADER);
        expect(shader).toBeGreaterThan(0);
        gl.deleteShader(shader);
    });

    it("creates and deletes a fragment shader", () => {
        if (!glReady) return;
        const shader = gl.createShader(gl.FRAGMENT_SHADER);
        expect(shader).toBeGreaterThan(0);
        gl.deleteShader(shader);
    });

    it("compiles a valid vertex shader", () => {
        if (!glReady) return;
        const shader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(shader, BASIC_VERT);
        gl.compileShader(shader);
        expect(gl.getShaderiv(shader, gl.COMPILE_STATUS)).toBe(gl.TRUE);
        gl.deleteShader(shader);
    });

    it("reports compilation errors for invalid shader", () => {
        if (!glReady) return;
        const shader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(shader, "invalid glsl code");
        gl.compileShader(shader);
        expect(gl.getShaderiv(shader, gl.COMPILE_STATUS)).toBe(gl.FALSE);
        const log = gl.getShaderInfoLog(shader);
        expect(log.length).toBeGreaterThan(0);
        gl.deleteShader(shader);
    });

    it("returns empty info log for shader with no errors", () => {
        if (!glReady) return;
        const shader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(
            shader,
            `#version 300 es
            precision mediump float;
            void main() {
                gl_Position = vec4(0.0);
            }`,
        );
        gl.compileShader(shader);
        const log = gl.getShaderInfoLog(shader);
        expect(log).toBe("");
        gl.deleteShader(shader);
    });
});

describe("program operations", () => {
    it("creates and deletes a program", () => {
        if (!glReady) return;
        const program = gl.createProgram();
        expect(program).toBeGreaterThan(0);
        gl.deleteProgram(program);
    });

    it("links a valid program", () => {
        if (!glReady) return;
        const program = compileShaderPair(BASIC_VERT, BASIC_FRAG);
        expect(gl.getProgramiv(program, gl.LINK_STATUS)).toBe(gl.TRUE);
        gl.deleteProgram(program);
    });

    it("reports link errors", () => {
        if (!glReady) return;
        const program = gl.createProgram();
        gl.linkProgram(program);
        const log = gl.getProgramInfoLog(program);
        expect(typeof log).toBe("string");
        gl.deleteProgram(program);
    });

    it("uses a program", () => {
        if (!glReady) return;
        const program = compileShaderPair(BASIC_VERT, BASIC_FRAG);
        gl.useProgram(program);
        expect(gl.getError()).toBe(gl.NO_ERROR);
        gl.useProgram(0);
        gl.deleteProgram(program);
    });
});

describe("uniform operations — lookup and scalars", () => {
    let program: number;

    beforeAll(() => {
        if (!glReady) return;
        program = compileShaderPair(UNIFORM_VERT, BASIC_FRAG);
        gl.useProgram(program);
    });

    it("gets a uniform location", () => {
        if (!glReady) return;
        const loc = gl.getUniformLocation(program, "uFloat");
        expect(loc).toBeGreaterThanOrEqual(0);
    });

    it("returns -1 for nonexistent uniform", () => {
        if (!glReady) return;
        const loc = gl.getUniformLocation(program, "nonexistent");
        expect(loc).toBe(-1);
    });

    it("sets a float uniform", () => {
        if (!glReady) return;
        const loc = gl.getUniformLocation(program, "uFloat");
        gl.uniform1f(loc, 1.5);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });

    it("sets an int uniform", () => {
        if (!glReady) return;
        const loc = gl.getUniformLocation(program, "uInt");
        gl.uniform1i(loc, 42);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });
});

describe("uniform operations — vectors and matrices", () => {
    let program: number;

    beforeAll(() => {
        if (!glReady) return;
        program = compileShaderPair(UNIFORM_VERT, BASIC_FRAG);
        gl.useProgram(program);
    });

    it("sets a vec2 uniform", () => {
        if (!glReady) return;
        const loc = gl.getUniformLocation(program, "uVec2");
        gl.uniform2f(loc, 1.0, 2.0);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });

    it("sets a vec3 uniform", () => {
        if (!glReady) return;
        const loc = gl.getUniformLocation(program, "uVec3");
        gl.uniform3f(loc, 1.0, 2.0, 3.0);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });

    it("sets a vec4 uniform", () => {
        if (!glReady) return;
        const loc = gl.getUniformLocation(program, "uVec4");
        gl.uniform4f(loc, { v0: 1.0, v1: 2.0, v2: 3.0, v3: 4.0 });
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });

    it("sets a mat4 uniform", () => {
        if (!glReady) return;
        const loc = gl.getUniformLocation(program, "uMat4");
        const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
        gl.uniformMatrix4fv(loc, 1, false, identity);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });
});

describe("buffer operations", () => {
    it("creates and deletes a vertex array", () => {
        if (!glReady) return;
        const vao = gl.genVertexArray();
        expect(vao).toBeGreaterThan(0);
        gl.deleteVertexArray(vao);
    });

    it("binds a vertex array", () => {
        if (!glReady) return;
        const vao = gl.genVertexArray();
        gl.bindVertexArray(vao);
        expect(gl.getError()).toBe(gl.NO_ERROR);
        gl.bindVertexArray(0);
        gl.deleteVertexArray(vao);
    });

    it("creates and deletes a buffer", () => {
        if (!glReady) return;
        const buffer = gl.genBuffer();
        expect(buffer).toBeGreaterThan(0);
        gl.deleteBuffer(buffer);
    });

    it("binds and fills a buffer with float data", () => {
        if (!glReady) return;
        const buffer = gl.genBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, [-1, -1, 0, 1, -1, 0, 0, 1, 0], gl.STATIC_DRAW);
        expect(gl.getError()).toBe(gl.NO_ERROR);
        gl.bindBuffer(gl.ARRAY_BUFFER, 0);
        gl.deleteBuffer(buffer);
    });

    it("binds and fills a buffer with unsigned short data", () => {
        if (!glReady) return;
        const buffer = gl.genBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
        gl.bufferDataUshort(gl.ELEMENT_ARRAY_BUFFER, [0, 1, 2], gl.STATIC_DRAW);
        expect(gl.getError()).toBe(gl.NO_ERROR);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, 0);
        gl.deleteBuffer(buffer);
    });
});

describe("vertex attributes", () => {
    it("configures vertex attribute pointers", () => {
        if (!glReady) return;
        const { vao, vbo } = setUpTriangleAttribArray();
        expect(gl.getError()).toBe(gl.NO_ERROR);

        gl.disableVertexAttribArray(0);
        gl.bindVertexArray(0);
        gl.deleteBuffer(vbo);
        gl.deleteVertexArray(vao);
    });

    it("gets an attribute location", () => {
        if (!glReady) return;
        const program = compileShaderPair(BASIC_VERT, BASIC_FRAG);
        const loc = gl.getAttribLocation(program, "aPos");
        expect(loc).toBeGreaterThanOrEqual(0);
        gl.deleteProgram(program);
    });

    it("binds an attribute location", () => {
        if (!glReady) return;
        const vertShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(
            vertShader,
            `#version 300 es
            precision mediump float;
            in vec3 position;
            void main() { gl_Position = vec4(position, 1.0); }`,
        );
        gl.compileShader(vertShader);

        const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragShader, BASIC_FRAG);
        gl.compileShader(fragShader);

        const program = gl.createProgram();
        gl.attachShader(program, vertShader);
        gl.attachShader(program, fragShader);
        gl.bindAttribLocation(program, 5, "position");
        gl.linkProgram(program);

        expect(gl.getAttribLocation(program, "position")).toBe(5);

        gl.deleteShader(vertShader);
        gl.deleteShader(fragShader);
        gl.deleteProgram(program);
    });
});

describe("drawing operations — state", () => {
    it("clears the color buffer", () => {
        if (!glReady) return;
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });

    it("sets the viewport", () => {
        if (!glReady) return;
        gl.viewport(0, 0, 100, 100);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });

    it("enables and disables capabilities", () => {
        if (!glReady) return;
        gl.enable(gl.DEPTH_TEST);
        expect(gl.getError()).toBe(gl.NO_ERROR);
        gl.disable(gl.DEPTH_TEST);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });
});

describe("drawing operations — draw calls", () => {
    it("draws arrays", () => {
        if (!glReady) return;
        const { vao, vbo } = setUpTriangleAttribArray();

        gl.drawArrays(gl.TRIANGLES, 0, 3);
        expect(gl.getError()).toBe(gl.NO_ERROR);

        gl.bindVertexArray(0);
        gl.deleteBuffer(vbo);
        gl.deleteVertexArray(vao);
    });

    it("draws elements", () => {
        if (!glReady) return;
        const { vao, vbo } = setUpTriangleAttribArray();

        const ebo = gl.genBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
        gl.bufferDataUshort(gl.ELEMENT_ARRAY_BUFFER, [0, 1, 2], gl.STATIC_DRAW);

        gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_SHORT, 0);
        expect(gl.getError()).toBe(gl.NO_ERROR);

        gl.bindVertexArray(0);
        gl.deleteBuffer(ebo);
        gl.deleteBuffer(vbo);
        gl.deleteVertexArray(vao);
    });
});

describe("depth operations", () => {
    it("sets depth function", () => {
        if (!glReady) return;
        gl.depthFunc(gl.LEQUAL);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });
});

describe("error handling", () => {
    it("returns NO_ERROR when no error occurred", () => {
        if (!glReady) return;
        gl.getError();
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });
});

describe("constants", () => {
    it("exports buffer bit constants", () => {
        expect(gl.COLOR_BUFFER_BIT).toBe(0x00004000);
        expect(gl.DEPTH_BUFFER_BIT).toBe(0x00000100);
        expect(gl.STENCIL_BUFFER_BIT).toBe(0x00000400);
    });

    it("exports primitive type constants", () => {
        expect(gl.TRIANGLES).toBe(0x0004);
        expect(gl.TRIANGLE_STRIP).toBe(0x0005);
        expect(gl.TRIANGLE_FAN).toBe(0x0006);
        expect(gl.LINES).toBe(0x0001);
        expect(gl.POINTS).toBe(0x0000);
    });

    it("exports shader type constants", () => {
        expect(gl.VERTEX_SHADER).toBe(0x8b31);
        expect(gl.FRAGMENT_SHADER).toBe(0x8b30);
    });

    it("exports data type constants", () => {
        expect(gl.FLOAT).toBe(0x1406);
        expect(gl.UNSIGNED_SHORT).toBe(0x1403);
        expect(gl.UNSIGNED_INT).toBe(0x1405);
    });

    it("exports buffer target constants", () => {
        expect(gl.ARRAY_BUFFER).toBe(0x8892);
        expect(gl.ELEMENT_ARRAY_BUFFER).toBe(0x8893);
    });

    it("exports usage constants", () => {
        expect(gl.STATIC_DRAW).toBe(0x88e4);
        expect(gl.DYNAMIC_DRAW).toBe(0x88e8);
        expect(gl.STREAM_DRAW).toBe(0x88e0);
    });
});
