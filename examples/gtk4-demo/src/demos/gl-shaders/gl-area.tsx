import type * as Gdk from "@gtkx/ffi/gdk";
import * as GL from "@gtkx/ffi/gl";
import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, GLArea, Label, Scale } from "@gtkx/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

// Vertex shader - handles position transformation and color passing
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

// Fragment shader - outputs the interpolated vertex color
const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

in vec3 vertexColor;
out vec4 FragColor;

void main() {
    FragColor = vec4(vertexColor, 1.0);
}
`;

// Vertex data: position (x, y, z) and color (r, g, b) for each vertex of a triangle
const VERTEX_DATA = [
    // Position          // Color
    0.0,
    0.5,
    0.0,
    1.0,
    0.0,
    0.0, // Top vertex (red)
    -0.5,
    -0.5,
    0.0,
    0.0,
    1.0,
    0.0, // Bottom left (green)
    0.5,
    -0.5,
    0.0,
    0.0,
    0.0,
    1.0, // Bottom right (blue)
];

interface GLResources {
    program: number;
    vao: number;
    vbo: number;
    mvpLocation: number;
}

/**
 * Creates a 4x4 rotation matrix from Euler angles (in radians)
 */
function createRotationMatrix(rotX: number, rotY: number, rotZ: number): number[] {
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const cosZ = Math.cos(rotZ);
    const sinZ = Math.sin(rotZ);

    // Combined rotation matrix: Rz * Ry * Rx
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

/**
 * Compiles a shader and returns its ID, or throws on error
 */
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

/**
 * Creates and links a shader program, returns the program ID
 */
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

    // Shaders can be deleted after linking
    GL.glDeleteShader(vertexShader);
    GL.glDeleteShader(fragmentShader);

    return program;
}

const GLAreaDemo = () => {
    const [rotationX, setRotationX] = useState(0);
    const [rotationY, setRotationY] = useState(0);
    const [rotationZ, setRotationZ] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Store GL resources outside React state (they're native handles)
    const glResources = useRef<GLResources | null>(null);
    const glAreaRef = useRef<Gtk.GLArea | null>(null);

    // Adjustments for the rotation sliders
    const xAdjustment = useMemo(() => new Gtk.Adjustment(0, 0, 360, 1, 10, 0), []);
    const yAdjustment = useMemo(() => new Gtk.Adjustment(0, 0, 360, 1, 10, 0), []);
    const zAdjustment = useMemo(() => new Gtk.Adjustment(0, 0, 360, 1, 10, 0), []);

    // Sync adjustment values when React state changes (one-way: React -> GTK)
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
        const area = self as Gtk.GLArea;
        glAreaRef.current = area;

        // Make context current for GL calls
        area.makeCurrent();

        // Check for context creation errors by verifying context exists
        const context = area.getContext();
        if (!context) {
            setError("GL context creation failed");
            return;
        }

        try {
            // Create shader program
            const program = createShaderProgram(VERTEX_SHADER, FRAGMENT_SHADER);
            const mvpLocation = GL.glGetUniformLocation(program, "mvp");

            // Create VAO and VBO
            const vao = GL.glGenVertexArray();
            const vbo = GL.glGenBuffer();

            GL.glBindVertexArray(vao);
            GL.glBindBuffer(GL.GL_ARRAY_BUFFER, vbo);
            GL.glBufferData(GL.GL_ARRAY_BUFFER, VERTEX_DATA, GL.GL_STATIC_DRAW);

            // Position attribute (location 0)
            GL.glVertexAttribPointer(0, 3, GL.GL_FLOAT, false, 6 * 4, 0);
            GL.glEnableVertexAttribArray(0);

            // Color attribute (location 1)
            GL.glVertexAttribPointer(1, 3, GL.GL_FLOAT, false, 6 * 4, 3 * 4);
            GL.glEnableVertexAttribArray(1);

            GL.glBindVertexArray(0);

            glResources.current = { program, vao, vbo, mvpLocation };
        } catch (e) {
            setError(`GL initialization error: ${e}`);
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
        (_self: Gtk.GLArea, _context: Gdk.GLContext) => {
            if (!glResources.current) {
                return true;
            }

            const { program, vao, mvpLocation } = glResources.current;

            // Clear the framebuffer
            GL.glClearColor(0.2, 0.2, 0.2, 1.0);
            GL.glClear(GL.GL_COLOR_BUFFER_BIT | GL.GL_DEPTH_BUFFER_BIT);

            // Use our shader program
            GL.glUseProgram(program);

            // Convert degrees to radians and create rotation matrix
            const radX = (rotationX * Math.PI) / 180;
            const radY = (rotationY * Math.PI) / 180;
            const radZ = (rotationZ * Math.PI) / 180;
            const mvp = createRotationMatrix(radX, radY, radZ);

            GL.glUniformMatrix4fv(mvpLocation, 1, false, mvp);

            // Draw the triangle
            GL.glBindVertexArray(vao);
            GL.glDrawArrays(GL.GL_TRIANGLES, 0, 3);
            GL.glBindVertexArray(0);

            // We handled the render, return true
            return true;
        },
        [rotationX, rotationY, rotationZ],
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
            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12} marginStart={20} marginEnd={20} marginTop={20}>
                <Label label="GLArea Error" cssClasses={["title-2"]} halign={Gtk.Align.START} />
                <Label label={error} wrap cssClasses={["error"]} />
            </Box>
        );
    }

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={12} marginStart={20} marginEnd={20} marginTop={20}>
            <Label label="OpenGL Area" cssClasses={["title-2"]} halign={Gtk.Align.START} />
            <Label
                label="GtkGLArea is a widget that allows drawing with OpenGL. This demo renders a rotating colored triangle using vertex and fragment shaders."
                wrap
                cssClasses={["dim-label"]}
            />

            <GLArea
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

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <Label label="Rotation Controls" cssClasses={["heading"]} halign={Gtk.Align.START} />

                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <Label label="X:" widthRequest={30} />
                    <Scale
                        orientation={Gtk.Orientation.HORIZONTAL}
                        hexpand
                        drawValue
                        adjustment={xAdjustment}
                        onValueChanged={handleXChange}
                    />
                </Box>

                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <Label label="Y:" widthRequest={30} />
                    <Scale
                        orientation={Gtk.Orientation.HORIZONTAL}
                        hexpand
                        drawValue
                        adjustment={yAdjustment}
                        onValueChanged={handleYChange}
                    />
                </Box>

                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <Label label="Z:" widthRequest={30} />
                    <Scale
                        orientation={Gtk.Orientation.HORIZONTAL}
                        hexpand
                        drawValue
                        adjustment={zAdjustment}
                        onValueChanged={handleZChange}
                    />
                </Box>

                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={8} halign={Gtk.Align.END} marginTop={8}>
                    <Button label="Reset" onClicked={handleReset} />
                </Box>
            </Box>
        </Box>
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
