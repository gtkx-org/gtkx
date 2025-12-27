import type * as Gdk from "@gtkx/ffi/gdk";
import * as GL from "@gtkx/ffi/gl";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkGLArea, GtkLabel, GtkScale } from "@gtkx/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const VERTEX_SHADER = `#version 300 es
precision mediump float;

layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aColor;

out vec3 vertexColor;

uniform mat4 mvp;

void main() {
    gl_Position = mvp * vec4(aPos, 1.0);
    vertexColor = aColor;
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

in vec3 vertexColor;
out vec4 FragColor;

void main() {
    FragColor = vec4(vertexColor, 1.0);
}
`;

const VERTEX_DATA = [

    0.0,
    0.5,
    0.0,
    1.0,
    0.0,
    0.0, 
    -0.5,
    -0.5,
    0.0,
    0.0,
    1.0,
    0.0, 
    0.5,
    -0.5,
    0.0,
    0.0,
    0.0,
    1.0, 
];

interface GLResources {
    program: number;
    vao: number;
    vbo: number;
    mvpLocation: number;
}

function createRotationMatrix(rotX: number, rotY: number, rotZ: number): number[] {
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const cosZ = Math.cos(rotZ);
    const sinZ = Math.sin(rotZ);

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
}

function compileShader(type: number, source: string): number {
    const shader = GL.glCreateShader(type);
    GL.glShaderSource(shader, source);
    GL.glCompileShader(shader);

    const status = GL.glGetShaderiv(shader, GL.GL_COMPILE_STATUS);

    if (!status) {
        const log = GL.glGetShaderInfoLog(shader, 1024);
        GL.glDeleteShader(shader);
        throw new Error(`Shader compilation failed: ${log}`);
    }

    return shader;
}

function createShaderProgram(vertexSource: string, fragmentSource: string): number {
    const vertexShader = compileShader(GL.GL_VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(GL.GL_FRAGMENT_SHADER, fragmentSource);

    const program = GL.glCreateProgram();
    GL.glAttachShader(program, vertexShader);
    GL.glAttachShader(program, fragmentShader);
    GL.glLinkProgram(program);

    const status = GL.glGetProgramiv(program, GL.GL_LINK_STATUS);

    if (!status) {
        const log = GL.glGetProgramInfoLog(program, 1024);
        GL.glDeleteProgram(program);
        GL.glDeleteShader(vertexShader);
        GL.glDeleteShader(fragmentShader);
        throw new Error(`Program linking failed: ${log}`);
    }

    GL.glDeleteShader(vertexShader);
    GL.glDeleteShader(fragmentShader);

    return program;
}

const GLAreaDemo = () => {
    const [rotationX, setRotationX] = useState(0);
    const [rotationY, setRotationY] = useState(0);
    const [rotationZ, setRotationZ] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const glResources = useRef<GLResources | null>(null);
    const glAreaRef = useRef<Gtk.GLArea | null>(null);

    const xAdjustment = useMemo(() => new Gtk.Adjustment(0, 0, 360, 1, 10, 0), []);
    const yAdjustment = useMemo(() => new Gtk.Adjustment(0, 0, 360, 1, 10, 0), []);
    const zAdjustment = useMemo(() => new Gtk.Adjustment(0, 0, 360, 1, 10, 0), []);

    useEffect(() => {
        if (xAdjustment.getValue() !== rotationX) xAdjustment.setValue(rotationX);
    }, [xAdjustment, rotationX]);
    useEffect(() => {
        if (yAdjustment.getValue() !== rotationY) yAdjustment.setValue(rotationY);
    }, [yAdjustment, rotationY]);
    useEffect(() => {
        if (zAdjustment.getValue() !== rotationZ) zAdjustment.setValue(rotationZ);
    }, [zAdjustment, rotationZ]);

    const handleRealize = useCallback((self: Gtk.Widget) => {
        glAreaRef.current = self as Gtk.GLArea;
    }, []);

    const initializeGL = useCallback((area: Gtk.GLArea): boolean => {
        const context = area.getContext();
        if (!context) {
            setError("GL context creation failed");
            return false;
        }

        try {
            const program = createShaderProgram(VERTEX_SHADER, FRAGMENT_SHADER);
            const mvpLocation = GL.glGetUniformLocation(program, "mvp");

            const vao = GL.glGenVertexArray();
            const vbo = GL.glGenBuffer();

            GL.glBindVertexArray(vao);
            GL.glBindBuffer(GL.GL_ARRAY_BUFFER, vbo);
            GL.glBufferData(GL.GL_ARRAY_BUFFER, VERTEX_DATA, GL.GL_STATIC_DRAW);

            GL.glVertexAttribPointer(0, 3, GL.GL_FLOAT, false, 6 * 4, 0);
            GL.glEnableVertexAttribArray(0);

            GL.glVertexAttribPointer(1, 3, GL.GL_FLOAT, false, 6 * 4, 3 * 4);
            GL.glEnableVertexAttribArray(1);

            GL.glBindVertexArray(0);

            glResources.current = { program, vao, vbo, mvpLocation };
            return true;
        } catch (e) {
            setError(`GL initialization error: ${e}`);
            return false;
        }
    }, []);

    const handleUnrealize = useCallback((self: Gtk.Widget) => {
        const area = self as Gtk.GLArea;
        area.makeCurrent();

        if (glResources.current) {
            GL.glDeleteBuffer(glResources.current.vbo);
            GL.glDeleteVertexArray(glResources.current.vao);
            GL.glDeleteProgram(glResources.current.program);
            glResources.current = null;
        }
    }, []);

    const handleRender = useCallback(
        (self: Gtk.GLArea, _context: Gdk.GLContext) => {
            if (!glResources.current && !initializeGL(self)) {
                return true;
            }

            const resources = glResources.current;
            if (!resources) {
                return true;
            }

            const { program, vao, mvpLocation } = resources;

            GL.glClearColor(0.2, 0.2, 0.2, 1.0);
            GL.glClear(GL.GL_COLOR_BUFFER_BIT | GL.GL_DEPTH_BUFFER_BIT);

            GL.glUseProgram(program);

            const radX = (rotationX * Math.PI) / 180;
            const radY = (rotationY * Math.PI) / 180;
            const radZ = (rotationZ * Math.PI) / 180;
            const mvp = createRotationMatrix(radX, radY, radZ);

            GL.glUniformMatrix4fv(mvpLocation, 1, false, mvp);

            GL.glBindVertexArray(vao);
            GL.glDrawArrays(GL.GL_TRIANGLES, 0, 3);
            GL.glBindVertexArray(0);

            return true;
        },
        [initializeGL, rotationX, rotationY, rotationZ],
    );

    const handleResize = useCallback((_self: Gtk.GLArea, width: number, height: number) => {
        GL.glViewport(0, 0, width, height);
    }, []);

    const handleReset = useCallback(() => {
        setRotationX(0);
        setRotationY(0);
        setRotationZ(0);
    }, []);

    const queueRedraw = useCallback(() => {
        if (glAreaRef.current) {
            glAreaRef.current.queueRender();
        }
    }, []);

    const handleXChange = useCallback(
        (self: Gtk.Range) => {
            setRotationX(self.getValue());
            queueRedraw();
        },
        [queueRedraw],
    );

    const handleYChange = useCallback(
        (self: Gtk.Range) => {
            setRotationY(self.getValue());
            queueRedraw();
        },
        [queueRedraw],
    );

    const handleZChange = useCallback(
        (self: Gtk.Range) => {
            setRotationZ(self.getValue());
            queueRedraw();
        },
        [queueRedraw],
    );

    if (error) {
        return (
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} marginStart={20} marginEnd={20} marginTop={20}>
                <GtkLabel label="GtkGLArea Error" cssClasses={["title-2"]} halign={Gtk.Align.START} />
                <GtkLabel label={error} wrap cssClasses={["error"]} />
            </GtkBox>
        );
    }

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="OpenGL Area" cssClasses={["title-2"]} halign={Gtk.Align.START} />
            <GtkLabel
                label="GtkGLArea is a widget that allows drawing with OpenGL. This demo renders a rotating colored triangle using vertex and fragment shaders."
                wrap
                cssClasses={["dim-label"]}
            />

            <GtkGLArea
                hasDepthBuffer
                useEs
                vexpand
                hexpand
                heightRequest={300}
                onRealize={handleRealize}
                onUnrealize={handleUnrealize}
                onRender={handleRender}
                onResize={handleResize}
            />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Rotation Controls" cssClasses={["heading"]} halign={Gtk.Align.START} />

                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkLabel label="X:" widthRequest={30} />
                    <GtkScale
                        orientation={Gtk.Orientation.HORIZONTAL}
                        hexpand
                        drawValue
                        adjustment={xAdjustment}
                        onValueChanged={handleXChange}
                    />
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkLabel label="Y:" widthRequest={30} />
                    <GtkScale
                        orientation={Gtk.Orientation.HORIZONTAL}
                        hexpand
                        drawValue
                        adjustment={yAdjustment}
                        onValueChanged={handleYChange}
                    />
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkLabel label="Z:" widthRequest={30} />
                    <GtkScale
                        orientation={Gtk.Orientation.HORIZONTAL}
                        hexpand
                        drawValue
                        adjustment={zAdjustment}
                        onValueChanged={handleZChange}
                    />
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8} halign={Gtk.Align.END} marginTop={8}>
                    <GtkButton label="Reset" onClicked={handleReset} />
                </GtkBox>
            </GtkBox>
        </GtkBox>
    );
};

export const glAreaDemo: Demo = {
    id: "glarea",
    title: "OpenGL Area",
    description: "OpenGL rendering with shaders in a GtkGLArea widget.",
    keywords: ["opengl", "gl", "glarea", "shader", "3d", "graphics", "rendering", "triangle"],
    component: GLAreaDemo,
    sourcePath: getSourcePath(import.meta.url, "gl-area.tsx"),
};
