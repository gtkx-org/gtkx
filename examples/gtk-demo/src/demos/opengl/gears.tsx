import type * as Gdk from "@gtkx/ffi/gdk";
import * as gl from "@gtkx/ffi/gl";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkGLArea, GtkLabel, GtkScale, x } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./gears.tsx?raw";

const VERTEX_SHADER = `#version 300 es
precision mediump float;

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

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

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

    for (let i = 0; i < teeth; i++) {
        const angle = (i * 2 * Math.PI) / teeth;

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

        const fz = width / 2;

        addTriangle(r0 * cos0, r0 * sin0, fz, r1 * cos0, r1 * sin0, fz, r0 * cos4, r0 * sin4, fz, 0, 0, 1);

        addTriangle(r0 * cos4, r0 * sin4, fz, r1 * cos0, r1 * sin0, fz, r1 * cos3, r1 * sin3, fz, 0, 0, 1);

        addTriangle(r1 * cos0, r1 * sin0, fz, r2 * cos1, r2 * sin1, fz, r2 * cos2, r2 * sin2, fz, 0, 0, 1);

        addTriangle(r1 * cos0, r1 * sin0, fz, r2 * cos2, r2 * sin2, fz, r1 * cos3, r1 * sin3, fz, 0, 0, 1);

        const bz = -width / 2;

        addTriangle(r0 * cos0, r0 * sin0, bz, r0 * cos4, r0 * sin4, bz, r1 * cos0, r1 * sin0, bz, 0, 0, -1);

        addTriangle(r0 * cos4, r0 * sin4, bz, r1 * cos3, r1 * sin3, bz, r1 * cos0, r1 * sin0, bz, 0, 0, -1);

        addTriangle(r1 * cos0, r1 * sin0, bz, r2 * cos2, r2 * sin2, bz, r2 * cos1, r2 * sin1, bz, 0, 0, -1);

        addTriangle(r1 * cos0, r1 * sin0, bz, r1 * cos3, r1 * sin3, bz, r2 * cos2, r2 * sin2, bz, 0, 0, -1);

        addTriangle(r1 * cos0, r1 * sin0, fz, r1 * cos0, r1 * sin0, bz, r2 * cos1, r2 * sin1, fz, cos0, sin0, 0);
        addTriangle(r2 * cos1, r2 * sin1, fz, r1 * cos0, r1 * sin0, bz, r2 * cos1, r2 * sin1, bz, cos1, sin1, 0);

        addTriangle(r2 * cos1, r2 * sin1, fz, r2 * cos1, r2 * sin1, bz, r2 * cos2, r2 * sin2, fz, cos1, sin1, 0);
        addTriangle(r2 * cos2, r2 * sin2, fz, r2 * cos1, r2 * sin1, bz, r2 * cos2, r2 * sin2, bz, cos2, sin2, 0);

        addTriangle(r2 * cos2, r2 * sin2, fz, r2 * cos2, r2 * sin2, bz, r1 * cos3, r1 * sin3, fz, cos2, sin2, 0);
        addTriangle(r1 * cos3, r1 * sin3, fz, r2 * cos2, r2 * sin2, bz, r1 * cos3, r1 * sin3, bz, cos3, sin3, 0);

        addTriangle(r1 * cos3, r1 * sin3, fz, r1 * cos3, r1 * sin3, bz, r1 * cos4, r1 * sin4, fz, cos3, sin3, 0);
        addTriangle(r1 * cos4, r1 * sin4, fz, r1 * cos3, r1 * sin3, bz, r1 * cos4, r1 * sin4, bz, cos4, sin4, 0);

        addTriangle(r0 * cos0, r0 * sin0, bz, r0 * cos0, r0 * sin0, fz, r0 * cos4, r0 * sin4, fz, -cos0, -sin0, 0);
        addTriangle(r0 * cos0, r0 * sin0, bz, r0 * cos4, r0 * sin4, fz, r0 * cos4, r0 * sin4, bz, -cos4, -sin4, 0);
    }

    return { vertices, normals };
}

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
}

const initGL = (): GLState => {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, VERTEX_SHADER);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, FRAGMENT_SHADER);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    const uniforms = {
        modelView: gl.getUniformLocation(program, "uModelView"),
        projection: gl.getUniformLocation(program, "uProjection"),
        normalMatrix: gl.getUniformLocation(program, "uNormalMatrix"),
        color: gl.getUniformLocation(program, "uColor"),
        lightDir: gl.getUniformLocation(program, "uLightDir"),
    };

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

        const vao = gl.genVertexArray();
        gl.bindVertexArray(vao);

        const vbo = gl.genBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        const nbo = gl.genBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, nbo);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(1);

        gl.bindVertexArray(0);

        return {
            vao,
            vbo,
            nbo,
            vertexCount: vertices.length / 3,
            color: config.color,
        };
    });

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);

    return { program, gears, uniforms };
};

const GearsDemo = () => {
    const glAreaRef = useRef<Gtk.GLArea | null>(null);
    const glStateRef = useRef<GLState | null>(null);
    const [viewRotX, setViewRotX] = useState(20);
    const [viewRotY, setViewRotY] = useState(30);
    const [isAnimating, setIsAnimating] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const aspectRef = useRef(1.0);
    const sizeRef = useRef({ width: 500, height: 400 });
    const tickIdRef = useRef<number | null>(null);
    const lastFrameTimeRef = useRef<number | null>(null);
    const angleRef = useRef(0);
    const viewRotXRef = useRef(viewRotX);
    const viewRotYRef = useRef(viewRotY);
    viewRotXRef.current = viewRotX;
    viewRotYRef.current = viewRotY;

    const tickCallback = useCallback((_widget: Gtk.Widget, frameClock: Gdk.FrameClock): boolean => {
        const frameTime = frameClock.getFrameTime();
        if (lastFrameTimeRef.current !== null) {
            const delta = (frameTime - lastFrameTimeRef.current) / 1_000_000;
            angleRef.current = (angleRef.current + delta * 120) % 360;
            glAreaRef.current?.queueRender();
        }
        lastFrameTimeRef.current = frameTime;
        return true;
    }, []);

    const startAnimation = useCallback(() => {
        const glArea = glAreaRef.current;
        if (!glArea || tickIdRef.current !== null) return;
        lastFrameTimeRef.current = null;
        tickIdRef.current = glArea.addTickCallback(tickCallback);
    }, [tickCallback]);

    const stopAnimation = useCallback(() => {
        const glArea = glAreaRef.current;
        if (!glArea || tickIdRef.current === null) return;
        glArea.removeTickCallback(tickIdRef.current);
        tickIdRef.current = null;
        lastFrameTimeRef.current = null;
    }, []);

    const handleGLAreaRef = useCallback((glArea: Gtk.GLArea | null) => {
        if (glAreaRef.current && tickIdRef.current !== null) {
            glAreaRef.current.removeTickCallback(tickIdRef.current);
            tickIdRef.current = null;
        }
        glAreaRef.current = glArea;
    }, []);

    const handleToggleAnimation = useCallback(() => {
        setIsAnimating((prev) => {
            if (prev) {
                stopAnimation();
            } else {
                startAnimation();
            }
            return !prev;
        });
    }, [startAnimation, stopAnimation]);

    useEffect(() => {
        if (isAnimating) {
            startAnimation();
        }
        return stopAnimation;
    }, [isAnimating, startAnimation, stopAnimation]);

    const handleUnrealize = useCallback((_self: Gtk.Widget) => {
        glStateRef.current = null;
    }, []);

    const handleRender = useCallback((self: Gtk.GLArea, _context: Gdk.GLContext) => {
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

        const scale = self.getScaleFactor();
        const width = self.getAllocatedWidth() * scale;
        const height = self.getAllocatedHeight() * scale;
        const aspect = width / height;

        gl.viewport(0, 0, width, height);

        gl.clearColor(0.1, 0.1, 0.15, 1.0);
        gl.clearDepth(1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
        gl.useProgram(state.program);

        const projection = mat4Perspective(Math.PI / 4, aspect, 1.0, 100.0);
        gl.uniformMatrix4fv(state.uniforms.projection, 1, false, projection);

        gl.uniform3f(state.uniforms.lightDir, 0.5, 0.5, 1.0);

        let view = mat4Identity();
        view = mat4Translate(view, 0, 0, -25);
        view = mat4RotateX(view, (viewRotXRef.current * Math.PI) / 180);
        view = mat4RotateY(view, (viewRotYRef.current * Math.PI) / 180);

        const angleRad = (angleRef.current * Math.PI) / 180;

        const gear1 = state.gears[0];
        if (gear1) {
            let modelView = mat4Translate(view, -3.0, -2.0, 0.0);
            modelView = mat4RotateZ(modelView, angleRad);
            gl.uniformMatrix4fv(state.uniforms.modelView, 1, false, modelView);
            gl.uniformMatrix4fv(state.uniforms.normalMatrix, 1, false, mat4Inverse3x3(modelView));
            gl.uniform3f(state.uniforms.color, gear1.color.r, gear1.color.g, gear1.color.b);
            gl.bindVertexArray(gear1.vao);
            gl.drawArrays(gl.TRIANGLES, 0, gear1.vertexCount);
        }

        const gear2 = state.gears[1];
        if (gear2) {
            let modelView = mat4Translate(view, 3.1, -2.0, 0.0);
            modelView = mat4RotateZ(modelView, -2 * angleRad - (9 * Math.PI) / 180);
            gl.uniformMatrix4fv(state.uniforms.modelView, 1, false, modelView);
            gl.uniformMatrix4fv(state.uniforms.normalMatrix, 1, false, mat4Inverse3x3(modelView));
            gl.uniform3f(state.uniforms.color, gear2.color.r, gear2.color.g, gear2.color.b);
            gl.bindVertexArray(gear2.vao);
            gl.drawArrays(gl.TRIANGLES, 0, gear2.vertexCount);
        }

        const gear3 = state.gears[2];
        if (gear3) {
            let modelView = mat4Translate(view, -3.1, 4.2, 0.0);
            modelView = mat4RotateZ(modelView, -2 * angleRad - (25 * Math.PI) / 180);
            gl.uniformMatrix4fv(state.uniforms.modelView, 1, false, modelView);
            gl.uniformMatrix4fv(state.uniforms.normalMatrix, 1, false, mat4Inverse3x3(modelView));
            gl.uniform3f(state.uniforms.color, gear3.color.r, gear3.color.g, gear3.color.b);
            gl.bindVertexArray(gear3.vao);
            gl.drawArrays(gl.TRIANGLES, 0, gear3.vertexCount);
        }

        gl.bindVertexArray(0);
        // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
        gl.useProgram(0);

        return true;
    }, []);

    const handleResize = useCallback((_self: Gtk.GLArea, width: number, height: number) => {
        aspectRef.current = width / height;
        sizeRef.current = { width, height };
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
                        ref={handleGLAreaRef}
                        useEs
                        hasDepthBuffer
                        vexpand
                        onUnrealize={handleUnrealize}
                        onRender={handleRender}
                        onResize={handleResize}
                        widthRequest={500}
                        heightRequest={400}
                        cssClasses={["card"]}
                    />

                    <GtkBox spacing={12} halign={Gtk.Align.CENTER}>
                        <GtkButton
                            label={isAnimating ? "Pause" : "Play"}
                            onClicked={handleToggleAnimation}
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
                    <GtkBox spacing={12}>
                        <GtkLabel label="Rotation X:" widthRequest={80} halign={Gtk.Align.START} />
                        <GtkScale drawValue valuePos={Gtk.PositionType.RIGHT} hexpand>
                            <x.Adjustment
                                value={viewRotX}
                                lower={-90}
                                upper={90}
                                stepIncrement={1}
                                pageIncrement={10}
                                onValueChanged={setViewRotX}
                            />
                        </GtkScale>
                    </GtkBox>
                    <GtkBox spacing={12}>
                        <GtkLabel label="Rotation Y:" widthRequest={80} halign={Gtk.Align.START} />
                        <GtkScale drawValue valuePos={Gtk.PositionType.RIGHT} hexpand>
                            <x.Adjustment
                                value={viewRotY}
                                lower={-180}
                                upper={180}
                                stepIncrement={1}
                                pageIncrement={10}
                                onValueChanged={setViewRotY}
                            />
                        </GtkScale>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const gearsDemo: Demo = {
    id: "gears",
    title: "OpenGL/Gears",
    description: "Classic OpenGL gears with animation and lighting",
    keywords: ["opengl", "gl", "gears", "3d", "animation", "lighting", "shading", "classic", "demo"],
    component: GearsDemo,
    sourceCode,
};
