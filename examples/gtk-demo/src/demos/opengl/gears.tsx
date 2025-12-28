import type * as Gdk from "@gtkx/ffi/gdk";
import {
    GL_ARRAY_BUFFER,
    GL_COLOR_BUFFER_BIT,
    GL_CULL_FACE,
    GL_DEPTH_BUFFER_BIT,
    GL_DEPTH_TEST,
    GL_FLOAT,
    GL_FRAGMENT_SHADER,
    GL_LEQUAL,
    GL_STATIC_DRAW,
    GL_TRIANGLES,
    GL_VERTEX_SHADER,
    glAttachShader,
    glBindBuffer,
    glBindVertexArray,
    glBufferData,
    glClear,
    glClearColor,
    glClearDepth,
    glCompileShader,
    glCreateProgram,
    glCreateShader,
    glDeleteBuffer,
    glDeleteProgram,
    glDeleteShader,
    glDeleteVertexArray,
    glDepthFunc,
    glDrawArrays,
    glEnable,
    glEnableVertexAttribArray,
    glGenBuffer,
    glGenVertexArray,
    glGetUniformLocation,
    glLinkProgram,
    glShaderSource,
    glUniform3f,
    glUniformMatrix4fv,
    glUseProgram,
    glVertexAttribPointer,
    glViewport,
} from "@gtkx/ffi/gl";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkGLArea, GtkLabel, GtkScale } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./gears.tsx?raw";

// Vertex shader with lighting
const VERTEX_SHADER = `#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;

uniform mat4 uModelView;
uniform mat4 uProjection;
uniform mat4 uNormalMatrix;
uniform vec3 uLightDir;

out vec3 vNormal;
out vec3 vLightDir;

void main() {
    gl_Position = uProjection * uModelView * vec4(aPos, 1.0);
    vNormal = normalize(mat3(uNormalMatrix) * aNormal);
    vLightDir = normalize(uLightDir);
}`;

// Fragment shader with diffuse lighting
const FRAGMENT_SHADER = `#version 330 core
in vec3 vNormal;
in vec3 vLightDir;

uniform vec3 uColor;

out vec4 FragColor;

void main() {
    float ambient = 0.3;
    float diffuse = max(dot(vNormal, vLightDir), 0.0) * 0.7;
    vec3 finalColor = uColor * (ambient + diffuse);
    FragColor = vec4(finalColor, 1.0);
}`;

// Generate gear geometry
function generateGear(
    innerRadius: number,
    outerRadius: number,
    width: number,
    teeth: number,
    toothDepth: number,
): { vertices: number[]; normals: number[] } {
    const vertices: number[] = [];
    const normals: number[] = [];

    const r0 = innerRadius;
    const r1 = outerRadius - toothDepth / 2;
    const r2 = outerRadius + toothDepth / 2;
    const da = (2 * Math.PI) / teeth / 4;

    // Helper to add a triangle with normal
    const addTriangle = (
        x1: number,
        y1: number,
        z1: number,
        x2: number,
        y2: number,
        z2: number,
        x3: number,
        y3: number,
        z3: number,
        nx: number,
        ny: number,
        nz: number,
    ) => {
        vertices.push(x1, y1, z1, x2, y2, z2, x3, y3, z3);
        normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    };

    // Front and back faces
    for (let i = 0; i < teeth; i++) {
        const angle = (i * 2 * Math.PI) / teeth;

        // Calculate points for this tooth
        const cos0 = Math.cos(angle);
        const sin0 = Math.sin(angle);
        const cos1 = Math.cos(angle + da);
        const sin1 = Math.sin(angle + da);
        const cos2 = Math.cos(angle + 2 * da);
        const sin2 = Math.sin(angle + 2 * da);
        const cos3 = Math.cos(angle + 3 * da);
        const sin3 = Math.sin(angle + 3 * da);
        const cos4 = Math.cos(angle + 4 * da);
        const sin4 = Math.sin(angle + 4 * da);

        // Front face (z = width/2)
        const fz = width / 2;

        // Inner ring to r1
        addTriangle(r0 * cos0, r0 * sin0, fz, r1 * cos0, r1 * sin0, fz, r0 * cos4, r0 * sin4, fz, 0, 0, 1);

        addTriangle(r0 * cos4, r0 * sin4, fz, r1 * cos0, r1 * sin0, fz, r1 * cos3, r1 * sin3, fz, 0, 0, 1);

        // Tooth front
        addTriangle(r1 * cos0, r1 * sin0, fz, r2 * cos1, r2 * sin1, fz, r2 * cos2, r2 * sin2, fz, 0, 0, 1);

        addTriangle(r1 * cos0, r1 * sin0, fz, r2 * cos2, r2 * sin2, fz, r1 * cos3, r1 * sin3, fz, 0, 0, 1);

        // Back face (z = -width/2)
        const bz = -width / 2;

        addTriangle(r0 * cos0, r0 * sin0, bz, r0 * cos4, r0 * sin4, bz, r1 * cos0, r1 * sin0, bz, 0, 0, -1);

        addTriangle(r0 * cos4, r0 * sin4, bz, r1 * cos3, r1 * sin3, bz, r1 * cos0, r1 * sin0, bz, 0, 0, -1);

        addTriangle(r1 * cos0, r1 * sin0, bz, r2 * cos2, r2 * sin2, bz, r2 * cos1, r2 * sin1, bz, 0, 0, -1);

        addTriangle(r1 * cos0, r1 * sin0, bz, r1 * cos3, r1 * sin3, bz, r2 * cos2, r2 * sin2, bz, 0, 0, -1);

        // Outer edge of tooth
        addTriangle(r1 * cos0, r1 * sin0, fz, r1 * cos0, r1 * sin0, bz, r2 * cos1, r2 * sin1, fz, cos0, sin0, 0);
        addTriangle(r2 * cos1, r2 * sin1, fz, r1 * cos0, r1 * sin0, bz, r2 * cos1, r2 * sin1, bz, cos1, sin1, 0);

        addTriangle(r2 * cos1, r2 * sin1, fz, r2 * cos1, r2 * sin1, bz, r2 * cos2, r2 * sin2, fz, cos1, sin1, 0);
        addTriangle(r2 * cos2, r2 * sin2, fz, r2 * cos1, r2 * sin1, bz, r2 * cos2, r2 * sin2, bz, cos2, sin2, 0);

        addTriangle(r2 * cos2, r2 * sin2, fz, r2 * cos2, r2 * sin2, bz, r1 * cos3, r1 * sin3, fz, cos2, sin2, 0);
        addTriangle(r1 * cos3, r1 * sin3, fz, r2 * cos2, r2 * sin2, bz, r1 * cos3, r1 * sin3, bz, cos3, sin3, 0);

        // Valley between teeth
        addTriangle(r1 * cos3, r1 * sin3, fz, r1 * cos3, r1 * sin3, bz, r1 * cos4, r1 * sin4, fz, cos3, sin3, 0);
        addTriangle(r1 * cos4, r1 * sin4, fz, r1 * cos3, r1 * sin3, bz, r1 * cos4, r1 * sin4, bz, cos4, sin4, 0);

        // Inner cylinder
        addTriangle(r0 * cos0, r0 * sin0, bz, r0 * cos0, r0 * sin0, fz, r0 * cos4, r0 * sin4, fz, -cos0, -sin0, 0);
        addTriangle(r0 * cos0, r0 * sin0, bz, r0 * cos4, r0 * sin4, fz, r0 * cos4, r0 * sin4, bz, -cos4, -sin4, 0);
    }

    return { vertices, normals };
}

// Matrix utilities
function mat4Identity(): number[] {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function mat4Multiply(a: number[], b: number[]): number[] {
    const result = new Array(16).fill(0) as number[];
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            for (let k = 0; k < 4; k++) {
                (result[i * 4 + j] as number) += (a[i * 4 + k] as number) * (b[k * 4 + j] as number);
            }
        }
    }
    return result;
}

function mat4Translate(m: number[], x: number, y: number, z: number): number[] {
    const t = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
    return mat4Multiply(m, t);
}

function mat4RotateX(m: number[], angle: number): number[] {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const r = [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
    return mat4Multiply(m, r);
}

function mat4RotateY(m: number[], angle: number): number[] {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const r = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
    return mat4Multiply(m, r);
}

function mat4RotateZ(m: number[], angle: number): number[] {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const r = [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    return mat4Multiply(m, r);
}

function mat4Perspective(fovy: number, aspect: number, near: number, far: number): number[] {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}

function mat4Inverse3x3(m: number[]): number[] {
    // Extract 3x3 from 4x4 and compute inverse for normal matrix
    const a00 = m[0] as number,
        a01 = m[1] as number,
        a02 = m[2] as number;
    const a10 = m[4] as number,
        a11 = m[5] as number,
        a12 = m[6] as number;
    const a20 = m[8] as number,
        a21 = m[9] as number,
        a22 = m[10] as number;

    const det = a00 * (a11 * a22 - a12 * a21) - a01 * (a10 * a22 - a12 * a20) + a02 * (a10 * a21 - a11 * a20);

    const invDet = 1.0 / det;

    // Return as 4x4 matrix (with 0s in 4th row/column except [3][3] = 1)
    return [
        (a11 * a22 - a12 * a21) * invDet,
        (a02 * a21 - a01 * a22) * invDet,
        (a01 * a12 - a02 * a11) * invDet,
        0,
        (a12 * a20 - a10 * a22) * invDet,
        (a00 * a22 - a02 * a20) * invDet,
        (a02 * a10 - a00 * a12) * invDet,
        0,
        (a10 * a21 - a11 * a20) * invDet,
        (a01 * a20 - a00 * a21) * invDet,
        (a00 * a11 - a01 * a10) * invDet,
        0,
        0,
        0,
        0,
        1,
    ];
}

interface GearData {
    vao: number;
    vbo: number;
    nbo: number;
    vertexCount: number;
    color: { r: number; g: number; b: number };
}

interface GLState {
    program: number;
    gears: GearData[];
    uniforms: {
        modelView: number;
        projection: number;
        normalMatrix: number;
        color: number;
        lightDir: number;
    };
    initialized: boolean;
}

const GearsDemo = () => {
    const glAreaRef = useRef<Gtk.GLArea | null>(null);
    const glStateRef = useRef<GLState>({
        program: 0,
        gears: [],
        uniforms: { modelView: -1, projection: -1, normalMatrix: -1, color: -1, lightDir: -1 },
        initialized: false,
    });
    const [angle, setAngle] = useState(0);
    const [viewRotX, setViewRotX] = useState(20);
    const [viewRotY, setViewRotY] = useState(30);
    const [isAnimating, setIsAnimating] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const aspectRef = useRef(1.0);

    // Animation loop
    useEffect(() => {
        if (!isAnimating) return;

        const intervalId = setInterval(() => {
            setAngle((prev) => (prev + 2) % 360);
        }, 16);

        return () => clearInterval(intervalId);
    }, [isAnimating]);

    // Queue render when angle or view changes
    useEffect(() => {
        if (glAreaRef.current) {
            glAreaRef.current.queueRender();
        }
    }, []);

    const handleRealize = useCallback((self: Gtk.Widget) => {
        const glArea = self as Gtk.GLArea;
        glArea.makeCurrent();

        const glError = glArea.getError();
        if (glError) {
            setError(`GL context error: ${glError.message}`);
            return;
        }

        try {
            // Create shaders
            const vertexShader = glCreateShader(GL_VERTEX_SHADER);
            glShaderSource(vertexShader, VERTEX_SHADER);
            glCompileShader(vertexShader);

            const fragmentShader = glCreateShader(GL_FRAGMENT_SHADER);
            glShaderSource(fragmentShader, FRAGMENT_SHADER);
            glCompileShader(fragmentShader);

            const program = glCreateProgram();
            glAttachShader(program, vertexShader);
            glAttachShader(program, fragmentShader);
            glLinkProgram(program);
            glDeleteShader(vertexShader);
            glDeleteShader(fragmentShader);

            // Get uniform locations
            const uniforms = {
                modelView: glGetUniformLocation(program, "uModelView"),
                projection: glGetUniformLocation(program, "uProjection"),
                normalMatrix: glGetUniformLocation(program, "uNormalMatrix"),
                color: glGetUniformLocation(program, "uColor"),
                lightDir: glGetUniformLocation(program, "uLightDir"),
            };

            // Generate gears
            const gearConfigs = [
                { inner: 1.0, outer: 4.0, width: 1.0, teeth: 20, depth: 0.7, color: { r: 0.8, g: 0.1, b: 0.0 } },
                { inner: 0.5, outer: 2.0, width: 2.0, teeth: 10, depth: 0.7, color: { r: 0.0, g: 0.8, b: 0.2 } },
                { inner: 1.3, outer: 2.0, width: 0.5, teeth: 10, depth: 0.7, color: { r: 0.2, g: 0.2, b: 1.0 } },
            ];

            const gears: GearData[] = gearConfigs.map((config) => {
                const { vertices, normals } = generateGear(
                    config.inner,
                    config.outer,
                    config.width,
                    config.teeth,
                    config.depth,
                );

                const vao = glGenVertexArray();
                glBindVertexArray(vao);

                const vbo = glGenBuffer();
                glBindBuffer(GL_ARRAY_BUFFER, vbo);
                glBufferData(GL_ARRAY_BUFFER, vertices, GL_STATIC_DRAW);
                glVertexAttribPointer(0, 3, GL_FLOAT, false, 0, 0);
                glEnableVertexAttribArray(0);

                const nbo = glGenBuffer();
                glBindBuffer(GL_ARRAY_BUFFER, nbo);
                glBufferData(GL_ARRAY_BUFFER, normals, GL_STATIC_DRAW);
                glVertexAttribPointer(1, 3, GL_FLOAT, false, 0, 0);
                glEnableVertexAttribArray(1);

                glBindVertexArray(0);

                return {
                    vao,
                    vbo,
                    nbo,
                    vertexCount: vertices.length / 3,
                    color: config.color,
                };
            });

            glStateRef.current = {
                program,
                gears,
                uniforms,
                initialized: true,
            };

            glEnable(GL_DEPTH_TEST);
            glDepthFunc(GL_LEQUAL);
            glEnable(GL_CULL_FACE);
        } catch (e) {
            setError(`GL initialization error: ${e}`);
        }
    }, []);

    const handleUnrealize = useCallback((self: Gtk.Widget) => {
        const glArea = self as Gtk.GLArea;
        glArea.makeCurrent();

        const state = glStateRef.current;
        if (state.initialized) {
            for (const gear of state.gears) {
                glDeleteBuffer(gear.vbo);
                glDeleteBuffer(gear.nbo);
                glDeleteVertexArray(gear.vao);
            }
            glDeleteProgram(state.program);
            state.initialized = false;
        }
    }, []);

    const handleRender = useCallback(
        (_self: Gtk.GLArea, _context: Gdk.GLContext) => {
            const state = glStateRef.current;
            if (!state.initialized) return true;

            glClearColor(0.1, 0.1, 0.15, 1.0);
            glClearDepth(1.0);
            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

            glUseProgram(state.program);

            // Set up projection
            const projection = mat4Perspective(Math.PI / 4, aspectRef.current, 1.0, 100.0);
            glUniformMatrix4fv(state.uniforms.projection, 1, false, projection);

            // Light direction
            glUniform3f(state.uniforms.lightDir, 0.5, 0.5, 1.0);

            // Base view transform
            let view = mat4Identity();
            view = mat4Translate(view, 0, 0, -25);
            view = mat4RotateX(view, (viewRotX * Math.PI) / 180);
            view = mat4RotateY(view, (viewRotY * Math.PI) / 180);

            const angleRad = (angle * Math.PI) / 180;

            // Draw gear 1 (red)
            const gear1 = state.gears[0];
            if (gear1) {
                let modelView = mat4Translate(view, -3.0, -2.0, 0.0);
                modelView = mat4RotateZ(modelView, angleRad);
                glUniformMatrix4fv(state.uniforms.modelView, 1, false, modelView);
                glUniformMatrix4fv(state.uniforms.normalMatrix, 1, false, mat4Inverse3x3(modelView));
                glUniform3f(state.uniforms.color, gear1.color.r, gear1.color.g, gear1.color.b);
                glBindVertexArray(gear1.vao);
                glDrawArrays(GL_TRIANGLES, 0, gear1.vertexCount);
            }

            // Draw gear 2 (green) - meshed with gear 1
            const gear2 = state.gears[1];
            if (gear2) {
                let modelView = mat4Translate(view, 3.1, -2.0, 0.0);
                modelView = mat4RotateZ(modelView, -2 * angleRad - (9 * Math.PI) / 180);
                glUniformMatrix4fv(state.uniforms.modelView, 1, false, modelView);
                glUniformMatrix4fv(state.uniforms.normalMatrix, 1, false, mat4Inverse3x3(modelView));
                glUniform3f(state.uniforms.color, gear2.color.r, gear2.color.g, gear2.color.b);
                glBindVertexArray(gear2.vao);
                glDrawArrays(GL_TRIANGLES, 0, gear2.vertexCount);
            }

            // Draw gear 3 (blue) - meshed with gear 2
            const gear3 = state.gears[2];
            if (gear3) {
                let modelView = mat4Translate(view, -3.1, 4.2, 0.0);
                modelView = mat4RotateZ(modelView, -2 * angleRad - (25 * Math.PI) / 180);
                glUniformMatrix4fv(state.uniforms.modelView, 1, false, modelView);
                glUniformMatrix4fv(state.uniforms.normalMatrix, 1, false, mat4Inverse3x3(modelView));
                glUniform3f(state.uniforms.color, gear3.color.r, gear3.color.g, gear3.color.b);
                glBindVertexArray(gear3.vao);
                glDrawArrays(GL_TRIANGLES, 0, gear3.vertexCount);
            }

            glBindVertexArray(0);
            glUseProgram(0);

            return true;
        },
        [angle, viewRotX, viewRotY],
    );

    const handleResize = useCallback((_self: Gtk.GLArea, width: number, height: number) => {
        aspectRef.current = width / height;
        glViewport(0, 0, width, height);
    }, []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Gears" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="The classic OpenGL gears demo, rendered with GtkGLArea. Three interlocking gears rotate with proper lighting and shading. This demonstrates 3D rendering, matrix transformations, and diffuse lighting calculations."
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

            <GtkFrame label="Rotating Gears">
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
                        hasDepthBuffer
                        onRealize={handleRealize}
                        onUnrealize={handleUnrealize}
                        onRender={handleRender}
                        onResize={handleResize}
                        widthRequest={500}
                        heightRequest={400}
                        cssClasses={["card"]}
                    />

                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12} halign={Gtk.Align.CENTER}>
                        <GtkButton
                            label={isAnimating ? "Pause" : "Play"}
                            onClicked={() => setIsAnimating(!isAnimating)}
                            cssClasses={isAnimating ? [] : ["suggested-action"]}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="View Controls">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <GtkLabel label="Rotation X:" widthRequest={80} halign={Gtk.Align.START} />
                        <GtkScale
                            orientation={Gtk.Orientation.HORIZONTAL}
                            drawValue
                            valuePos={Gtk.PositionType.RIGHT}
                            hexpand
                            adjustment={new Gtk.Adjustment(viewRotX, -90, 90, 1, 10, 0)}
                            onValueChanged={(self) => setViewRotX(self.getValue())}
                        />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <GtkLabel label="Rotation Y:" widthRequest={80} halign={Gtk.Align.START} />
                        <GtkScale
                            orientation={Gtk.Orientation.HORIZONTAL}
                            drawValue
                            valuePos={Gtk.PositionType.RIGHT}
                            hexpand
                            adjustment={new Gtk.Adjustment(viewRotY, -180, 180, 1, 10, 0)}
                            onValueChanged={(self) => setViewRotY(self.getValue())}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const gearsDemo: Demo = {
    id: "gears",
    title: "Gears",
    description: "Classic OpenGL gears with animation and lighting",
    keywords: ["opengl", "gl", "gears", "3d", "animation", "lighting", "shading", "classic", "demo"],
    component: GearsDemo,
    sourceCode,
};
