import type * as Gdk from "@gtkx/ffi/gdk";
import * as gl from "@gtkx/ffi/gl";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkGLArea, GtkLabel, GtkScale, x } from "@gtkx/react";
import { useCallback, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./glarea.tsx?raw";

const VERTEX_SHADER = `#version 300 es
precision mediump float;

in vec3 aPos;
in vec3 aColor;
uniform mat4 uMvp;
out vec4 vertexColor;

void main() {
    gl_Position = uMvp * vec4(aPos, 1.0);
    vertexColor = vec4(aColor, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

in vec4 vertexColor;
out vec4 FragColor;

void main() {
    FragColor = vertexColor;
}`;

const TRIANGLE_DATA = [0.0, 0.5, 0.0, 1.0, 0.0, 0.0, -0.5, -0.366, 0.0, 0.0, 1.0, 0.0, 0.5, -0.366, 0.0, 0.0, 0.0, 1.0];

interface GLState {
    program: number;
    vao: number;
    vbo: number;
    mvpLocation: number;
    initialized: boolean;
}

const createRotationMatrix = (rx: number, ry: number, rz: number): number[] => {
    const cosX = Math.cos(rx);
    const sinX = Math.sin(rx);
    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);
    const cosZ = Math.cos(rz);
    const sinZ = Math.sin(rz);

    return [
        cosY * cosZ,
        cosX * sinZ + sinX * sinY * cosZ,
        sinX * sinZ - cosX * sinY * cosZ,
        0,
        -cosY * sinZ,
        cosX * cosZ - sinX * sinY * sinZ,
        sinX * cosZ + cosX * sinY * sinZ,
        0,
        sinY,
        -sinX * cosY,
        cosX * cosY,
        0,
        0,
        0,
        0,
        1,
    ];
};

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
    gl.bufferData(gl.ARRAY_BUFFER, TRIANGLE_DATA, gl.STATIC_DRAW);

    const posLocation = gl.getAttribLocation(program, "aPos");
    const colorLocation = gl.getAttribLocation(program, "aColor");

    gl.vertexAttribPointer(posLocation, 3, gl.FLOAT, false, 6 * 4, 0);
    gl.enableVertexAttribArray(posLocation);
    gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 6 * 4, 3 * 4);
    gl.enableVertexAttribArray(colorLocation);

    const mvpLocation = gl.getUniformLocation(program, "uMvp");

    gl.bindVertexArray(0);

    return { program, vao, vbo, mvpLocation, initialized: true };
};

const GLAreaDemo = () => {
    const glAreaRef = useRef<Gtk.GLArea | null>(null);
    const glStateRef = useRef<GLState | null>(null);
    const [rotationX, setRotationX] = useState(0);
    const [rotationY, setRotationY] = useState(0);
    const [rotationZ, setRotationZ] = useState(0);
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
            const mvp = createRotationMatrix(rotationX, rotationY, rotationZ);

            gl.clearColor(0.5, 0.5, 0.5, 1.0);
            gl.clearDepth(1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
            gl.useProgram(state.program);
            gl.uniformMatrix4fv(state.mvpLocation, 1, false, mvp);

            gl.bindVertexArray(state.vao);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            gl.bindVertexArray(0);

            // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
            gl.useProgram(0);

            return true;
        },
        [rotationX, rotationY, rotationZ],
    );

    const handleResize = useCallback((_self: Gtk.GLArea, width: number, height: number) => {
        gl.viewport(0, 0, width, height);
    }, []);

    const handleXChange = useCallback((value: number) => {
        setRotationX((value * Math.PI) / 180);
        glAreaRef.current?.queueRender();
    }, []);

    const handleYChange = useCallback((value: number) => {
        setRotationY((value * Math.PI) / 180);
        glAreaRef.current?.queueRender();
    }, []);

    const handleZChange = useCallback((value: number) => {
        setRotationZ((value * Math.PI) / 180);
        glAreaRef.current?.queueRender();
    }, []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand hexpand>
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

            <GtkGLArea
                ref={glAreaRef}
                useEs
                hasDepthBuffer
                vexpand
                hexpand
                onUnrealize={handleUnrealize}
                onRender={handleRender}
                onResize={handleResize}
            />

            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={8}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <GtkBox spacing={12}>
                    <GtkLabel label="X axis" widthRequest={60} halign={Gtk.Align.START} />
                    <GtkScale hexpand drawValue valuePos={Gtk.PositionType.RIGHT} digits={0}>
                        <x.Adjustment
                            value={0}
                            lower={0}
                            upper={360}
                            stepIncrement={1}
                            pageIncrement={10}
                            onValueChanged={handleXChange}
                        />
                    </GtkScale>
                </GtkBox>
                <GtkBox spacing={12}>
                    <GtkLabel label="Y axis" widthRequest={60} halign={Gtk.Align.START} />
                    <GtkScale hexpand drawValue valuePos={Gtk.PositionType.RIGHT} digits={0}>
                        <x.Adjustment
                            value={0}
                            lower={0}
                            upper={360}
                            stepIncrement={1}
                            pageIncrement={10}
                            onValueChanged={handleYChange}
                        />
                    </GtkScale>
                </GtkBox>
                <GtkBox spacing={12}>
                    <GtkLabel label="Z axis" widthRequest={60} halign={Gtk.Align.START} />
                    <GtkScale hexpand drawValue valuePos={Gtk.PositionType.RIGHT} digits={0}>
                        <x.Adjustment
                            value={0}
                            lower={0}
                            upper={360}
                            stepIncrement={1}
                            pageIncrement={10}
                            onValueChanged={handleZChange}
                        />
                    </GtkScale>
                </GtkBox>
            </GtkBox>
        </GtkBox>
    );
};

export const glareaDemo: Demo = {
    id: "glarea",
    title: "OpenGL/OpenGL Area",
    description:
        "GtkGLArea is a widget that allows drawing with OpenGL. Drag the sliders to change the rotation angles on the X, Y, and Z axis.",
    keywords: ["opengl", "gl", "glarea", "GtkGLArea", "3d", "graphics", "shader", "triangle", "rendering", "rotation"],
    component: GLAreaDemo,
    sourceCode,
};
