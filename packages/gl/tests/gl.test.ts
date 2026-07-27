import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import * as gl from "@gtkx/gl";
import { beforeAll, describe, expect, it } from "vitest";

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

const TRIANGLE_POSITIONS = new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]);

const compileShader = (type: number, source: string): number => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, 1, [source], [-1]);
    gl.compileShader(shader);

    return shader;
};

const compileShaderPair = (vertSrc: string, fragSrc: string): number => {
    const vertShader = compileShader(gl.VERTEX_SHADER, vertSrc);
    const fragShader = compileShader(gl.FRAGMENT_SHADER, fragSrc);
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
    gl.bufferData(gl.ARRAY_BUFFER, TRIANGLE_POSITIONS.byteLength, TRIANGLE_POSITIONS, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    return { vao, vbo };
};

beforeAll(async () => {
    const window = new Gtk.Window();
    const glArea = new Gtk.GLArea();
    glArea.setAllowedApis(Gdk.GLAPI.GL);
    window.setChild(glArea);

    const isGlReady = await new Promise<boolean>((resolve) => {
        glArea.on("realize", () => {
            glArea.makeCurrent();

            if (glArea.getError()) {
                resolve(false);
            }
        });

        glArea.on("render", () => {
            resolve(true);

            return Gdk.EVENT_STOP;
        });

        window.present();
    });

    if (!isGlReady) {
        throw new Error("GLArea could not provide a desktop GL context; the GL contract suite cannot run");
    }

    glArea.makeCurrent();
    glArea.attachBuffers();
});

describe("shader operations", () => {
    it("creates and deletes a vertex shader", () => {
        const shader = gl.createShader(gl.VERTEX_SHADER);
        expect(shader).toBeGreaterThan(0);
        gl.deleteShader(shader);
    });

    it("creates and deletes a fragment shader", () => {
        const shader = gl.createShader(gl.FRAGMENT_SHADER);
        expect(shader).toBeGreaterThan(0);
        gl.deleteShader(shader);
    });

    it("compiles a valid vertex shader", () => {
        const shader = compileShader(gl.VERTEX_SHADER, BASIC_VERT);
        expect(gl.getShaderiv(shader, gl.COMPILE_STATUS)).toBe(gl.TRUE);
        gl.deleteShader(shader);
    });

    it("reports compilation errors for invalid shader", () => {
        const shader = compileShader(gl.FRAGMENT_SHADER, "invalid glsl code");
        expect(gl.getShaderiv(shader, gl.COMPILE_STATUS)).toBe(gl.FALSE);
        const log = gl.getShaderInfoLog(shader);
        expect(log.length).toBeGreaterThan(0);
        gl.deleteShader(shader);
    });

    it("returns empty info log for shader with no errors", () => {
        const shader = compileShader(
            gl.VERTEX_SHADER,
            `#version 300 es
            precision mediump float;
            void main() {
                gl_Position = vec4(0.0);
            }`,
        );

        const log = gl.getShaderInfoLog(shader);
        expect(log).toBe("");
        gl.deleteShader(shader);
    });
});

describe("program operations", () => {
    it("creates and deletes a program", () => {
        const program = gl.createProgram();
        expect(program).toBeGreaterThan(0);
        gl.deleteProgram(program);
    });

    it("links a valid program", () => {
        const program = compileShaderPair(BASIC_VERT, BASIC_FRAG);
        expect(gl.getProgramiv(program, gl.LINK_STATUS)).toBe(gl.TRUE);
        gl.deleteProgram(program);
    });

    it("reports link errors", () => {
        const program = gl.createProgram();
        gl.linkProgram(program);
        const log = gl.getProgramInfoLog(program);
        expect(typeof log).toBe("string");
        gl.deleteProgram(program);
    });

    it("uses a program", () => {
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
        program = compileShaderPair(UNIFORM_VERT, BASIC_FRAG);
        gl.useProgram(program);
    });

    it("gets a uniform location", () => {
        const loc = gl.getUniformLocation(program, "uFloat");
        expect(loc).toBeGreaterThanOrEqual(0);
    });

    it("returns -1 for nonexistent uniform", () => {
        const loc = gl.getUniformLocation(program, "nonexistent");
        expect(loc).toBe(-1);
    });

    it("sets a float uniform", () => {
        const loc = gl.getUniformLocation(program, "uFloat");
        gl.uniform1f(loc, 1.5);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });

    it("sets an int uniform", () => {
        const loc = gl.getUniformLocation(program, "uInt");
        gl.uniform1i(loc, 42);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });
});

describe("uniform operations — vectors and matrices", () => {
    let program: number;

    beforeAll(() => {
        program = compileShaderPair(UNIFORM_VERT, BASIC_FRAG);
        gl.useProgram(program);
    });

    it("sets a vec2 uniform", () => {
        const loc = gl.getUniformLocation(program, "uVec2");
        gl.uniform2f(loc, 1, 2);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });

    it("sets a vec3 uniform", () => {
        const loc = gl.getUniformLocation(program, "uVec3");
        gl.uniform3f(loc, 1, 2, 3);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });

    it("sets a vec4 uniform", () => {
        const loc = gl.getUniformLocation(program, "uVec4");
        gl.uniform4f(loc, 1, 2, 3, 4);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });

    it("sets a mat4 uniform", () => {
        const loc = gl.getUniformLocation(program, "uMat4");
        const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
        gl.uniformMatrix4fv(loc, 1, false, identity);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });

    it("sets a mat4 uniform from a Float32Array", () => {
        const loc = gl.getUniformLocation(program, "uMat4");
        const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        gl.uniformMatrix4fv(loc, 1, false, identity);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });
});

describe("buffer operations", () => {
    it("creates and deletes a vertex array", () => {
        const vao = gl.genVertexArray();
        expect(vao).toBeGreaterThan(0);
        gl.deleteVertexArray(vao);
    });

    it("binds a vertex array", () => {
        const vao = gl.genVertexArray();
        gl.bindVertexArray(vao);
        expect(gl.getError()).toBe(gl.NO_ERROR);
        gl.bindVertexArray(0);
        gl.deleteVertexArray(vao);
    });

    it("creates and deletes a buffer", () => {
        const buffer = gl.genBuffer();
        expect(buffer).toBeGreaterThan(0);
        gl.deleteBuffer(buffer);
    });

    it("generates buffers in bulk as a returned array", () => {
        const buffers = gl.genBuffers(3);
        expect(buffers).toHaveLength(3);

        for (const buffer of buffers) {
            expect(buffer).toBeGreaterThan(0);
        }

        gl.deleteBuffers(3, buffers);
    });

    it("binds and fills a buffer with float data", () => {
        const buffer = gl.genBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        const data = new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]);
        gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, data, gl.STATIC_DRAW);
        expect(gl.getError()).toBe(gl.NO_ERROR);
        gl.bindBuffer(gl.ARRAY_BUFFER, 0);
        gl.deleteBuffer(buffer);
    });

    it("binds and fills a buffer with unsigned short data", () => {
        const buffer = gl.genBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
        const indices = new Uint16Array([0, 1, 2]);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices.byteLength, indices, gl.STATIC_DRAW);
        expect(gl.getError()).toBe(gl.NO_ERROR);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, 0);
        gl.deleteBuffer(buffer);
    });
});

describe("buffer data transfer", () => {
    it("reads buffer contents back through getBufferSubData", () => {
        const buffer = gl.genBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        const data = new Float32Array([1.5, -2.5, 3.25, 0]);
        gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, data, gl.STATIC_DRAW);
        const readBack = new Float32Array(4);
        gl.getBufferSubData(gl.ARRAY_BUFFER, 0, readBack.byteLength, readBack);
        expect([...readBack]).toEqual([1.5, -2.5, 3.25, 0]);
        gl.bindBuffer(gl.ARRAY_BUFFER, 0);
        gl.deleteBuffer(buffer);
    });

    it("queries buffer size through the single-valued carve-out", () => {
        const buffer = gl.genBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, 64, null, gl.STATIC_DRAW);
        expect(gl.getBufferParameteriv(gl.ARRAY_BUFFER, gl.BUFFER_SIZE)).toBe(64);
        gl.bindBuffer(gl.ARRAY_BUFFER, 0);
        gl.deleteBuffer(buffer);
    });
});

describe("vertex attributes", () => {
    it("configures vertex attribute pointers", () => {
        const { vao, vbo } = setUpTriangleAttribArray();
        expect(gl.getError()).toBe(gl.NO_ERROR);
        gl.disableVertexAttribArray(0);
        gl.bindVertexArray(0);
        gl.deleteBuffer(vbo);
        gl.deleteVertexArray(vao);
    });

    it("gets an attribute location", () => {
        const program = compileShaderPair(BASIC_VERT, BASIC_FRAG);
        const loc = gl.getAttribLocation(program, "aPos");
        expect(loc).toBeGreaterThanOrEqual(0);
        gl.deleteProgram(program);
    });

    it("binds an attribute location", () => {
        const vertShader = compileShader(
            gl.VERTEX_SHADER,
            `#version 300 es
            precision mediump float;
            in vec3 position;
            void main() { gl_Position = vec4(position, 1.0); }`,
        );

        const fragShader = compileShader(gl.FRAGMENT_SHADER, BASIC_FRAG);
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
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });

    it("sets the viewport", () => {
        gl.viewport(0, 0, 100, 100);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });

    it("enables and disables capabilities", () => {
        gl.enable(gl.DEPTH_TEST);
        expect(gl.getError()).toBe(gl.NO_ERROR);
        gl.disable(gl.DEPTH_TEST);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });
});

describe("drawing operations — draw calls", () => {
    it("draws arrays", () => {
        const { vao, vbo } = setUpTriangleAttribArray();
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        expect(gl.getError()).toBe(gl.NO_ERROR);
        gl.bindVertexArray(0);
        gl.deleteBuffer(vbo);
        gl.deleteVertexArray(vao);
    });

    it("draws elements", () => {
        const { vao, vbo } = setUpTriangleAttribArray();
        const ebo = gl.genBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
        const indices = new Uint16Array([0, 1, 2]);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices.byteLength, indices, gl.STATIC_DRAW);
        gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_SHORT, 0);
        expect(gl.getError()).toBe(gl.NO_ERROR);
        gl.bindVertexArray(0);
        gl.deleteBuffer(ebo);
        gl.deleteBuffer(vbo);
        gl.deleteVertexArray(vao);
    });
});

describe("framebuffer rendering", () => {
    it("renders into an offscreen framebuffer and reads pixels back", () => {
        const fbo = gl.genFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        const rbo = gl.genRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rbo);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, 4, 4);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rbo);
        expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).toBe(gl.FRAMEBUFFER_COMPLETE);
        gl.viewport(0, 0, 4, 4);
        gl.clearColor(1, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        const pixels = new Uint8Array(4 * 4 * 4);
        gl.readPixels(0, 0, 4, 4, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        expect(gl.getError()).toBe(gl.NO_ERROR);
        expect(pixels[0]).toBe(255);
        expect(pixels[1]).toBe(0);
        expect(pixels[2]).toBe(0);
        expect(pixels[3]).toBe(255);
        gl.bindFramebuffer(gl.FRAMEBUFFER, 0);
        gl.bindRenderbuffer(gl.RENDERBUFFER, 0);
        gl.deleteRenderbuffer(rbo);
        gl.deleteFramebuffer(fbo);
    });
});

describe("sync objects", () => {
    it("waits for a fence through the bounded loop helper", () => {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        const status = gl.clientWaitSyncLoop(sync, gl.SYNC_FLUSH_COMMANDS_BIT, 1_000_000_000);
        expect([gl.ALREADY_SIGNALED, gl.CONDITION_SATISFIED]).toContain(status);
        gl.deleteSync(sync);
    });
});

describe("debug output", () => {
    it("delivers inserted messages to the synchronous callback", () => {
        const received: string[] = [];

        gl.debugMessageCallback(({ message }) => {
            received.push(message);
        });

        gl.debugMessageControl(gl.DONT_CARE, gl.DONT_CARE, gl.DONT_CARE, 0, [], true);

        gl.debugMessageInsert(
            gl.DEBUG_SOURCE_APPLICATION,
            gl.DEBUG_TYPE_OTHER,
            7,
            gl.DEBUG_SEVERITY_NOTIFICATION,
            -1,
            "gtkx-debug-probe",
        );

        gl.debugMessageCallback(null);
        expect(received).toContain("gtkx-debug-probe");
    });
});

describe("state queries", () => {
    it("returns a desktop GL version string", () => {
        const version = gl.getString(gl.VERSION);
        expect(version.length).toBeGreaterThan(0);
        expect(version).not.toMatch(/OpenGL ES/);
    });

    it("sets depth function", () => {
        gl.depthFunc(gl.LEQUAL);
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });

    it("returns NO_ERROR when no error occurred", () => {
        gl.getError();
        expect(gl.getError()).toBe(gl.NO_ERROR);
    });
});

describe("constants", () => {
    it("exports buffer bit constants", () => {
        expect(gl.COLOR_BUFFER_BIT).toBe(0x00_00_40_00);
        expect(gl.DEPTH_BUFFER_BIT).toBe(0x00_00_01_00);
        expect(gl.STENCIL_BUFFER_BIT).toBe(0x00_00_04_00);
    });

    it("exports primitive type constants", () => {
        expect(gl.TRIANGLES).toBe(0x00_04);
        expect(gl.TRIANGLE_STRIP).toBe(0x00_05);
        expect(gl.TRIANGLE_FAN).toBe(0x00_06);
        expect(gl.LINES).toBe(0x00_01);
        expect(gl.POINTS).toBe(0x00_00);
    });

    it("exports shader type constants", () => {
        expect(gl.VERTEX_SHADER).toBe(0x8B_31);
        expect(gl.FRAGMENT_SHADER).toBe(0x8B_30);
    });

    it("exports data type constants", () => {
        expect(gl.FLOAT).toBe(0x14_06);
        expect(gl.UNSIGNED_SHORT).toBe(0x14_03);
        expect(gl.UNSIGNED_INT).toBe(0x14_05);
    });

    it("exports buffer target constants", () => {
        expect(gl.ARRAY_BUFFER).toBe(0x88_92);
        expect(gl.ELEMENT_ARRAY_BUFFER).toBe(0x88_93);
    });

    it("exports usage constants", () => {
        expect(gl.STATIC_DRAW).toBe(0x88_E4);
        expect(gl.DYNAMIC_DRAW).toBe(0x88_E8);
        expect(gl.STREAM_DRAW).toBe(0x88_E0);
    });
});
