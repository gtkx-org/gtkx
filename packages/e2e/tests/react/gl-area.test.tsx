import * as Gdk from "@gtkx/gi/gdk";
import * as gl from "@gtkx/gl";
import { GtkGLArea } from "@gtkx/jsx/gtk";
import { render, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

type Outcome<T> = { result: T } | null;
type Frame = { size: number; pixels: Uint8Array; error: number; status: number };

const FRAME_SIZE = 4;
const CHANNELS = 4;
const RED_PIXEL = [255, 0, 0, 255];

const VERTEX_SOURCE = `#version 300 es
precision mediump float;
in vec3 aPos;
uniform float uScale;
void main() { gl_Position = vec4(aPos * uScale, 1.0); }`;

const FRAGMENT_SOURCE = `#version 300 es
precision mediump float;
out vec4 FragColor;
void main() { FragColor = vec4(0.0, 1.0, 0.0, 1.0); }`;

const TRIANGLE = new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]);

const inGlContext = async <T,>(work: () => T): Promise<T> => {
    const outcome: { current: Outcome<T> } = { current: null };

    await render(
        <GtkGLArea
            allowedApis={Gdk.GLAPI.GL}
            onRender={() => {
                outcome.current ??= { result: work() };

                return true;
            }}
        />,
    );

    await waitFor(() => {
        expect(outcome.current).not.toBeNull();
    });

    if (outcome.current === null) {
        throw new Error("expected the GL area to have rendered");
    }

    return outcome.current.result;
};

const compileShader = (type: number, source: string): number => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, 1, [source], [-1]);
    gl.compileShader(shader);

    return shader;
};

const linkProgram = (vertexSource: string, fragmentSource: string): number => {
    const vertex = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragment = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    return program;
};

const bindOffscreenFrame = (size: number): { framebuffer: number; renderbuffer: number; status: number } => {
    const framebuffer = gl.genFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    const renderbuffer = gl.genRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, size, size);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, renderbuffer);
    gl.viewport(0, 0, size, size);

    return { framebuffer, renderbuffer, status: gl.checkFramebufferStatus(gl.FRAMEBUFFER) };
};

const releaseOffscreenFrame = (framebuffer: number, renderbuffer: number): void => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, 0);
    gl.bindRenderbuffer(gl.RENDERBUFFER, 0);
    gl.deleteRenderbuffer(renderbuffer);
    gl.deleteFramebuffer(framebuffer);
};

const clearedFrame = (): Frame => {
    const frame = bindOffscreenFrame(FRAME_SIZE);
    gl.clearColor(1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const pixels = new Uint8Array(FRAME_SIZE * FRAME_SIZE * CHANNELS);
    gl.readPixels(0, 0, FRAME_SIZE, FRAME_SIZE, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const error = gl.getError();
    releaseOffscreenFrame(frame.framebuffer, frame.renderbuffer);

    return { size: FRAME_SIZE, pixels, error, status: frame.status };
};

const drawnFrame = (): Frame => {
    const frame = bindOffscreenFrame(FRAME_SIZE);
    const program = linkProgram(VERTEX_SOURCE, FRAGMENT_SOURCE);
    gl.useProgram(program);
    gl.uniform1f(gl.getUniformLocation(program, "uScale"), 1);
    const vertexArray = gl.genVertexArray();
    gl.bindVertexArray(vertexArray);
    const buffer = gl.genBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, TRIANGLE.byteLength, TRIANGLE, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const pixels = new Uint8Array(FRAME_SIZE * FRAME_SIZE * CHANNELS);
    gl.readPixels(0, 0, FRAME_SIZE, FRAME_SIZE, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const error = gl.getError();
    releaseOffscreenFrame(frame.framebuffer, frame.renderbuffer);

    return { size: FRAME_SIZE, pixels, error, status: gl.getProgramiv(program, gl.LINK_STATUS) };
};

const rejectedShader = (): { status: number; log: string } => {
    const shader = compileShader(gl.FRAGMENT_SHADER, "this is not a shader");
    const status = gl.getShaderiv(shader, gl.COMPILE_STATUS);
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);

    return { status, log };
};

describe("a GL area rendered from React", () => {
    it("clears an offscreen frame through the bindings and reads the pixels back", async () => {
        const frame = await inGlContext(clearedFrame);
        expect(frame.status).toBe(gl.FRAMEBUFFER_COMPLETE);
        expect(frame.error).toBe(gl.NO_ERROR);
        expect([...frame.pixels.slice(0, CHANNELS)]).toEqual(RED_PIXEL);
    });

    it("links a program, feeds it a uniform and a vertex buffer, and draws into that frame", async () => {
        const frame = await inGlContext(drawnFrame);
        expect(frame.status).toBe(gl.TRUE);
        expect(frame.error).toBe(gl.NO_ERROR);
        expect([...frame.pixels].some((channel) => channel > 0)).toBe(true);
    });

    it("reports a shader the driver refuses to compile", async () => {
        const shader = await inGlContext(rejectedShader);
        expect(shader.status).toBe(gl.FALSE);
        expect(shader.log.length).toBeGreaterThan(0);
    });
});
