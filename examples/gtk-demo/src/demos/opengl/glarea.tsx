import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import * as gl from "@gtkx/gl";
import { GtkAdjustment, GtkBox, GtkButton, GtkGLArea, GtkLabel, GtkScale } from "@gtkx/jsx/gtk";
import { useRef, useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import { createShaderProgram, createVertexBuffer, rotationMatrix } from "./gl-helpers.js";
import sourceCode from "./glarea.tsx?raw";

type EventResult = typeof Gdk.EVENT_PROPAGATE | typeof Gdk.EVENT_STOP;

type GLState = {
    program: number;
    vao: number;
    vbo: number;
    mvpLocation: number;
};

type RenderGLAreaArgs = {
    glStateRef: React.RefObject<GLState | null>;
    rotationX: number;
    rotationY: number;
    rotationZ: number;
};

type UseGLAreaHandlersArgs = {
    glAreaRef: React.RefObject<Gtk.GLArea | null>;
    glStateRef: React.RefObject<GLState | null>;
    rotationX: number;
    rotationY: number;
    rotationZ: number;
};

const VERTEX_SHADER_GL = `#version 330

in vec4 in_position;
in vec4 in_color;
uniform mat4 mvp;

out vec4 color;

void main() {
  color = in_color;
  gl_Position = mvp * in_position;
}`;

const FRAGMENT_SHADER_GL = `#version 330

in vec4 color;

out vec4 outputColor;

void main() {
  outputColor = color;
}`;

const VERTEX_SHADER_GLES = `attribute vec4 in_position;
attribute vec4 in_color;

uniform mat4 mvp;

varying vec4 color;

void main() {
  color = in_color;
  gl_Position = mvp * in_position;
}`;

const FRAGMENT_SHADER_GLES = `precision highp float;

varying vec4 color;

void main() {
  gl_FragColor = color;
}`;

const VERTEX_DATA = [0, 0.5, 0, 1, 1, 0, 0, 1, 0.5, -0.366, 0, 1, 0, 1, 0, 1, -0.5, -0.366, 0, 1, 0, 0, 1, 1];
const GLAREA_ERROR_DOMAIN = GLib.quarkFromString("gtkx-glarea-error-quark");

const glareaDemo: Demo = {
    id: "glarea",
    title: "OpenGL/OpenGL Area",
    description: "GtkGLArea is a widget that allows custom drawing using OpenGL calls.",
    keywords: [],
    component: GLAreaDemo,
    sourceCode,
    defaultWidth: 400,
    defaultHeight: 600,
};

const initGL = (api: Gdk.GLAPI): GLState => {
    const isGles = api === Gdk.GLAPI.GLES;
    const program = createShaderProgram(
        isGles ? VERTEX_SHADER_GLES : VERTEX_SHADER_GL,
        isGles ? FRAGMENT_SHADER_GLES : FRAGMENT_SHADER_GL,
        [
            [0, "in_position"],
            [1, "in_color"],
        ],
    );
    const { vao, vbo } = createVertexBuffer(VERTEX_DATA);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 8 * 4, 0);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 8 * 4, 4 * 4);
    gl.enableVertexAttribArray(1);
    const mvpLocation = gl.getUniformLocation(program, "mvp");
    gl.bindVertexArray(0);

    return { program, vao, vbo, mvpLocation };
};

const tryInitGL = (area: Gtk.GLArea): GLState | null => {
    try {
        return initGL(area.getApi());
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        area.setError(GLib.Error.newLiteral(GLAREA_ERROR_DOMAIN, 0, message));

        return null;
    }
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

const realizeGLArea = (area: Gtk.GLArea, glStateRef: React.RefObject<GLState | null>): void => {
    area.makeCurrent();

    if (area.getError()) {
        return;
    }

    glStateRef.current = tryInitGL(area);
};

const unrealizeGLArea = (area: Gtk.GLArea, glStateRef: React.RefObject<GLState | null>): void => {
    area.makeCurrent();
    releaseGLState(glStateRef);
};

const renderGLArea = ({ glStateRef, rotationX, rotationY, rotationZ }: RenderGLAreaArgs): EventResult => {
    const state = glStateRef.current;

    if (!state) {
        return Gdk.EVENT_PROPAGATE;
    }

    const mvp = rotationMatrix(rotationX, 1, 0, 0)
        .multiply(rotationMatrix(rotationY, 0, 1, 0))
        .multiply(rotationMatrix(rotationZ, 0, 0, 1));
    gl.clearColor(0.5, 0.5, 0.5, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(state.program);
    gl.uniformMatrix4fv(state.mvpLocation, 1, false, mvp.toFloat());
    gl.bindVertexArray(state.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(0);
    gl.useProgram(0);
    gl.flush();

    return Gdk.EVENT_STOP;
};

const AxisScale = ({ label, onValueChanged }: { label: string; onValueChanged: (value: number) => void }) => {
    return (
        <GtkBox spacing={12}>
            <GtkLabel widthRequest={60} halign={Gtk.Align.START}>
                {label}
            </GtkLabel>
            <GtkScale
                hexpand
                drawValue={false}
                accessibleLabel={label}
                adjustment={<GtkAdjustment value={0} lower={0} upper={360} stepIncrement={1} pageIncrement={12} />}
                onValueChanged={(scale) => {
                    onValueChanged(scale.getValue());
                }}
            />
        </GtkBox>
    );
};

const useGLAreaHandlers = (args: UseGLAreaHandlersArgs) => {
    const { glAreaRef, glStateRef, rotationX, rotationY, rotationZ } = args;

    const handleRealize = (area: Gtk.GLArea) => {
        realizeGLArea(area, glStateRef);
    };

    const handleUnrealize = (area: Gtk.GLArea) => {
        unrealizeGLArea(area, glStateRef);
    };

    const renderFrame = (): EventResult => renderGLArea({ glStateRef, rotationX, rotationY, rotationZ });

    const createAxisHandler = (axisSetter: (v: number) => void) => (value: number) => {
        axisSetter(value);
        glAreaRef.current?.queueRender();
    };

    return { handleRealize, handleUnrealize, renderFrame, createAxisHandler };
};

function GLAreaDemo({ onClose }: DemoProps) {
    const glAreaRef = useRef<Gtk.GLArea | null>(null);
    const glStateRef = useRef<GLState | null>(null);
    const [rotationX, setRotationX] = useState(0);
    const [rotationY, setRotationY] = useState(0);
    const [rotationZ, setRotationZ] = useState(0);
    const handlers = useGLAreaHandlers({ glAreaRef, glStateRef, rotationX, rotationY, rotationZ });

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={6}
            marginStart={12}
            marginEnd={12}
            marginTop={12}
            marginBottom={12}
            vexpand
            hexpand
        >
            <GtkGLArea
                name="gl-area"
                accessibleLabel="Rotating triangle"
                ref={glAreaRef}
                vexpand
                hexpand
                widthRequest={100}
                heightRequest={200}
                onRealize={handlers.handleRealize}
                onUnrealize={handlers.handleUnrealize}
                onRender={() => {
                    return handlers.renderFrame();
                }}
            />
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <AxisScale label="X axis" onValueChanged={handlers.createAxisHandler(setRotationX)} />
                <AxisScale label="Y axis" onValueChanged={handlers.createAxisHandler(setRotationY)} />
                <AxisScale label="Z axis" onValueChanged={handlers.createAxisHandler(setRotationZ)} />
                <GtkButton label="Quit" hexpand onClicked={onClose} />
            </GtkBox>
        </GtkBox>
    );
}

export { glareaDemo };
