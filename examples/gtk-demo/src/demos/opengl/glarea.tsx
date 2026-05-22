import type * as Gdk from "@gtkx/ffi/gdk";
import * as gl from "@gtkx/ffi/gl";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkGLArea, GtkLabel, GtkScale } from "@gtkx/react";
import { useCallback, useRef, useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./glarea.tsx?raw";

const VERTEX_SHADER = `#version 300 es
precision mediump float;

in vec3 aPos;
in vec3 aColor;
uniform mat4 uMvp;
out vec4 vertexColor;

void main() {
    gl_Position = uMvp * vec4(aPos, 1);
    vertexColor = vec4(aColor, 1);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

in vec4 vertexColor;
out vec4 FragColor;

void main() {
    FragColor = vertexColor;
}`;

const TRIANGLE_DATA = [0, 0.5, 0, 1, 0, 0, -0.5, -0.366, 0, 0, 1, 0, 0.5, -0.366, 0, 0, 0, 1];

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

const compileShader = (type: number, source: string, name: string): number => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderiv(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`${name} shader compilation failed: ${log}`);
    }
    return shader;
};

const compileFragmentShader = (vertexShader: number): number => {
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, FRAGMENT_SHADER);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderiv(fragmentShader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(fragmentShader);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        throw new Error(`Fragment shader compilation failed: ${log}`);
    }
    return fragmentShader;
};

const linkProgram = (vertexShader: number, fragmentShader: number): number => {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramiv(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        throw new Error(`Shader program linking failed: ${log}`);
    }
    return program;
};

const initGL = (): GLState => {
    const vertexShader = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER, "Vertex");
    const fragmentShader = compileFragmentShader(vertexShader);
    const program = linkProgram(vertexShader, fragmentShader);

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    const vao = gl.genVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.genBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, TRIANGLE_DATA, gl.STATIC_DRAW);

    const posLocation = gl.getAttribLocation(program, "aPos");
    const colorLocation = gl.getAttribLocation(program, "aColor");

    gl.vertexAttribPointer(posLocation, { size: 3, type: gl.FLOAT, normalized: false, stride: 6 * 4, offset: 0 });
    gl.enableVertexAttribArray(posLocation);
    gl.vertexAttribPointer(colorLocation, { size: 3, type: gl.FLOAT, normalized: false, stride: 6 * 4, offset: 3 * 4 });
    gl.enableVertexAttribArray(colorLocation);

    const mvpLocation = gl.getUniformLocation(program, "uMvp");

    gl.bindVertexArray(0);

    return { program, vao, vbo, mvpLocation, initialized: true };
};

const releaseGLState = (glStateRef: React.RefObject<GLState | null>) => {
    const state = glStateRef.current;
    if (state) {
        gl.deleteBuffer(state.vbo);
        gl.deleteVertexArray(state.vao);
        gl.deleteProgram(state.program);
        glStateRef.current = null;
    }
};

interface RenderGLAreaArgs {
    glAreaRef: React.RefObject<Gtk.GLArea | null>;
    glStateRef: React.RefObject<GLState | null>;
    rotationX: number;
    rotationY: number;
    rotationZ: number;
}

const renderGLArea = ({ glAreaRef, glStateRef, rotationX, rotationY, rotationZ }: RenderGLAreaArgs): boolean => {
    if (!glStateRef.current && !glAreaRef.current?.getError()) {
        try {
            glStateRef.current = initGL();
        } catch (e) {
            if (e instanceof Error) console.error(e.message);
            glStateRef.current = null;
        }
    }

    const state = glStateRef.current;
    if (state) {
        const mvp = createRotationMatrix(rotationX, rotationY, rotationZ);

        gl.clearColor(0.5, 0.5, 0.5, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
        gl.useProgram(state.program);
        gl.uniformMatrix4fv(state.mvpLocation, 1, false, mvp);

        gl.bindVertexArray(state.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(0);

        // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
        gl.useProgram(0);
        gl.flush();
    }

    return true;
};

const AxisScale = ({ label, onValueChanged }: { label: string; onValueChanged: (value: number) => void }) => (
    <GtkBox spacing={12}>
        <GtkLabel label={label} widthRequest={60} halign={Gtk.Align.START} />
        <GtkScale
            hexpand
            drawValue={false}
            value={0}
            lower={0}
            upper={360}
            stepIncrement={1}
            pageIncrement={12}
            onValueChanged={onValueChanged}
        />
    </GtkBox>
);

const GLAreaDemo = ({ window }: DemoProps) => {
    const glAreaRef = useRef<Gtk.GLArea | null>(null);
    const glStateRef = useRef<GLState | null>(null);
    const [rotationX, setRotationX] = useState(0);
    const [rotationY, setRotationY] = useState(0);
    const [rotationZ, setRotationZ] = useState(0);

    const handleUnrealize = useCallback(() => releaseGLState(glStateRef), []);
    const handleRender = useCallback(
        (_context: Gdk.GLContext) => renderGLArea({ glAreaRef, glStateRef, rotationX, rotationY, rotationZ }),
        [rotationX, rotationY, rotationZ],
    );
    const handleResize = useCallback((width: number, height: number) => gl.viewport(0, 0, width, height), []);

    const handleAxisChange = useCallback(
        (axisSetter: (v: number) => void) => (value: number) => {
            axisSetter((value * Math.PI) / 180);
            glAreaRef.current?.queueRender();
        },
        [],
    );

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand hexpand>
            <GtkGLArea
                ref={glAreaRef}
                useEs
                vexpand
                hexpand
                widthRequest={100}
                heightRequest={200}
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
                <AxisScale label="X axis" onValueChanged={handleAxisChange(setRotationX)} />
                <AxisScale label="Y axis" onValueChanged={handleAxisChange(setRotationY)} />
                <AxisScale label="Z axis" onValueChanged={handleAxisChange(setRotationZ)} />
                <GtkButton label="Quit" hexpand onClicked={() => window.current?.destroy()} />
            </GtkBox>
        </GtkBox>
    );
};

export const glareaDemo: Demo = {
    id: "glarea",
    title: "OpenGL/OpenGL Area",
    description: "GtkGLArea is a widget that allows custom drawing using OpenGL calls.",
    keywords: ["gtkglarea"],
    component: GLAreaDemo,
    sourceCode,
    defaultWidth: 400,
    defaultHeight: 600,
};
