import type * as Gdk from "@gtkx/ffi/gdk";
import * as gl from "@gtkx/ffi/gl";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkGLArea, GtkLabel } from "@gtkx/react";
import { useCallback, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./glarea.tsx?raw";

const VERTEX_SHADER = `#version 300 es
precision mediump float;

in vec3 aPos;
uniform vec4 uColor;
out vec4 vertexColor;
void main() {
 gl_Position = vec4(aPos, 1.0);
 vertexColor = uColor;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

in vec4 vertexColor;
out vec4 FragColor;
void main() {
 FragColor = vertexColor;
}`;

const TRIANGLE_VERTICES = [0.0, 0.5, 0.0, -0.5, -0.5, 0.0, 0.5, -0.5, 0.0];

interface GLState {
    program: number;
    vao: number;
    vbo: number;
    colorLocation: number;
    initialized: boolean;
}

const initGL = (): GLState => {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, VERTEX_SHADER);
    gl.compileShader(vertexShader);

    const vertexStatus = gl.getShaderiv(vertexShader, gl.COMPILE_STATUS);
    if (!vertexStatus) {
        const log = gl.getShaderInfoLog(vertexShader);
        gl.deleteShader(vertexShader);
        throw new Error(`Vertex shader compilation failed: ${log}`);
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, FRAGMENT_SHADER);
    gl.compileShader(fragmentShader);

    const fragmentStatus = gl.getShaderiv(fragmentShader, gl.COMPILE_STATUS);
    if (!fragmentStatus) {
        const log = gl.getShaderInfoLog(fragmentShader);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        throw new Error(`Fragment shader compilation failed: ${log}`);
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    const linkStatus = gl.getProgramiv(program, gl.LINK_STATUS);
    if (!linkStatus) {
        const log = gl.getProgramInfoLog(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        throw new Error(`Shader program linking failed: ${log}`);
    }

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    const vao = gl.genVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.genBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, TRIANGLE_VERTICES, gl.STATIC_DRAW);

    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 3 * 4, 0);
    gl.enableVertexAttribArray(0);

    const colorLocation = gl.getUniformLocation(program, "uColor");

    gl.bindVertexArray(0);

    return {
        program,
        vao,
        vbo,
        colorLocation,
        initialized: true,
    };
};

const GLAreaDemo = () => {
    const glAreaRef = useRef<Gtk.GLArea | null>(null);
    const glStateRef = useRef<GLState | null>(null);
    const [clearColor, setClearColor] = useState({ r: 0.2, g: 0.2, b: 0.3, a: 1.0 });
    const [triangleColor, setTriangleColor] = useState({ r: 0.9, g: 0.3, b: 0.3, a: 1.0 });
    const [error, setError] = useState<string | null>(null);

    const handleUnrealize = useCallback((_self: Gtk.Widget) => {
        glStateRef.current = null;
    }, []);

    const handleRender = useCallback(
        (self: Gtk.GLArea, _context: Gdk.GLContext) => {
            if (!glStateRef.current) {
                const glError = self.getError();
                if (glError) {
                    setError(`GL context error: ${glError.message}`);
                    return true;
                }

                try {
                    glStateRef.current = initGL();
                } catch (error) {
                    setError(`GL initialization error: ${error}`);
                    return true;
                }
            }

            const state = glStateRef.current;

            gl.clearColor(clearColor.r, clearColor.g, clearColor.b, clearColor.a);
            gl.clearDepth(1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
            gl.useProgram(state.program);
            gl.uniform4f(state.colorLocation, triangleColor.r, triangleColor.g, triangleColor.b, triangleColor.a);

            gl.bindVertexArray(state.vao);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            gl.bindVertexArray(0);

            // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
            gl.useProgram(0);

            return true;
        },
        [clearColor, triangleColor],
    );

    const handleResize = useCallback((_self: Gtk.GLArea, width: number, height: number) => {
        gl.viewport(0, 0, width, height);
    }, []);

    const cycleTriangleColor = () => {
        const colors = [
            { r: 0.9, g: 0.3, b: 0.3, a: 1.0 },
            { r: 0.3, g: 0.9, b: 0.3, a: 1.0 },
            { r: 0.3, g: 0.3, b: 0.9, a: 1.0 },
            { r: 0.9, g: 0.9, b: 0.3, a: 1.0 },
            { r: 0.9, g: 0.3, b: 0.9, a: 1.0 },
            { r: 0.3, g: 0.9, b: 0.9, a: 1.0 },
        ];
        const currentIndex = colors.findIndex(
            (c) => c.r === triangleColor.r && c.g === triangleColor.g && c.b === triangleColor.b,
        );
        const nextIndex = (currentIndex + 1) % colors.length;
        const nextColor = colors[nextIndex];
        if (nextColor) setTriangleColor(nextColor);
        glAreaRef.current?.queueRender();
    };

    const cycleClearColor = () => {
        const colors = [
            { r: 0.2, g: 0.2, b: 0.3, a: 1.0 },
            { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
            { r: 0.3, g: 0.2, b: 0.2, a: 1.0 },
            { r: 0.2, g: 0.3, b: 0.2, a: 1.0 },
            { r: 0.15, g: 0.15, b: 0.2, a: 1.0 },
        ];
        const currentIndex = colors.findIndex(
            (c) => c.r === clearColor.r && c.g === clearColor.g && c.b === clearColor.b,
        );
        const nextIndex = (currentIndex + 1) % colors.length;
        const nextColor = colors[nextIndex];
        if (nextColor) setClearColor(nextColor);
        glAreaRef.current?.queueRender();
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="GL Area" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GtkGLArea provides an OpenGL rendering context embedded in a GTK widget. Connect to the 'render' signal to initialize and draw with OpenGL. Use 'unrealize' to clean up GL resources."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            {error && (
                <GtkFrame>
                    <GtkLabel
                        label={error}
                        cssClasses={["error"]}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    />
                </GtkFrame>
            )}

            <GtkFrame label="OpenGL Triangle">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkGLArea
                        ref={glAreaRef}
                        useEs
                        hasDepthBuffer
                        vexpand
                        onUnrealize={handleUnrealize}
                        onRender={handleRender}
                        onResize={handleResize}
                        widthRequest={400}
                        heightRequest={300}
                        cssClasses={["card"]}
                    />
                    <GtkBox spacing={12} halign={Gtk.Align.CENTER}>
                        <GtkButton label="Change Triangle Color" onClicked={cycleTriangleColor} />
                        <GtkButton label="Change Background" onClicked={cycleClearColor} />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="How It Works">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel label="GtkGLArea Signals:" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <GtkLabel
                        label={`onRender: Initialize on first call, then draw content
onUnrealize: Clean up GL resources
onResize: Handle viewport changes`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const glareaDemo: Demo = {
    id: "glarea",
    title: "GL Area",
    description: "Basic OpenGL rendering with GtkGLArea",
    keywords: ["opengl", "gl", "glarea", "GtkGLArea", "3d", "graphics", "shader", "triangle", "rendering"],
    component: GLAreaDemo,
    sourceCode,
};
