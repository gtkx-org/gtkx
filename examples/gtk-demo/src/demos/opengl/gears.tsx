import type * as Gdk from "@gtkx/ffi/gdk";
import * as gl from "@gtkx/ffi/gl";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkGLArea, GtkLabel, GtkOverlay, GtkScale, x } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./gears.tsx?raw";

const VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;

uniform mat4 ModelViewProjectionMatrix;
uniform mat4 NormalMatrix;
uniform vec4 LightSourcePosition;
uniform vec4 MaterialColor;

smooth out vec4 Color;

void main() {
    vec3 N = normalize(vec3(NormalMatrix * vec4(normal, 1.0)));
    vec3 L = normalize(LightSourcePosition.xyz);
    float diffuse = (dot(N, L) + 1.0) * 0.5;
    Color = vec4(diffuse * MaterialColor.rgb, 1.0);
    gl_Position = ModelViewProjectionMatrix * vec4(position, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

smooth in vec4 Color;

out vec4 fragColor;

void main() {
    fragColor = Color;
}`;

interface GearStrip {
    first: number;
    count: number;
}

interface GearGeometry {
    vertices: number[];
    nvertices: number;
    strips: GearStrip[];
}

function createGear(
    innerRadius: number,
    outerRadius: number,
    width: number,
    teeth: number,
    toothDepth: number,
): GearGeometry {
    const r0 = innerRadius;
    const r1 = outerRadius - toothDepth / 2;
    const r2 = outerRadius + toothDepth / 2;
    const da = (2 * Math.PI) / teeth / 4;
    const w2 = width / 2;

    const vertices: number[] = [];
    const strips: GearStrip[] = [];
    let vi = 0;
    let nx = 0;
    let ny = 0;
    let nz = 0;

    function vert(px: number, py: number, sign: number) {
        vertices.push(px, py, sign * w2, nx, ny, nz);
        vi++;
    }

    function startStrip() {
        strips.push({ first: vi, count: 0 });
    }

    function endStrip() {
        const strip = strips[strips.length - 1];
        if (strip) strip.count = vi - strip.first;
    }

    function quadNormal(p1x: number, p1y: number, p2x: number, p2y: number) {
        nx = p1y - p2y;
        ny = -(p1x - p2x);
        nz = 0;
        vert(p1x, p1y, -1);
        vert(p1x, p1y, 1);
        vert(p2x, p2y, -1);
        vert(p2x, p2y, 1);
    }

    for (let i = 0; i < teeth; i++) {
        const base = (i * 2 * Math.PI) / teeth;
        const c0 = Math.cos(base),
            s0 = Math.sin(base);
        const c1 = Math.cos(base + da),
            s1 = Math.sin(base + da);
        const c2 = Math.cos(base + 2 * da),
            s2 = Math.sin(base + 2 * da);
        const c3 = Math.cos(base + 3 * da),
            s3 = Math.sin(base + 3 * da);
        const c4 = Math.cos(base + 4 * da),
            s4 = Math.sin(base + 4 * da);

        const p0x = r2 * c1,
            p0y = r2 * s1;
        const p1x = r2 * c2,
            p1y = r2 * s2;
        const p2x = r1 * c0,
            p2y = r1 * s0;
        const p3x = r1 * c3,
            p3y = r1 * s3;
        const p4x = r0 * c0,
            p4y = r0 * s0;
        const p5x = r1 * c4,
            p5y = r1 * s4;
        const p6x = r0 * c4,
            p6y = r0 * s4;

        startStrip();
        nx = 0;
        ny = 0;
        nz = 1;
        vert(p0x, p0y, 1);
        vert(p1x, p1y, 1);
        vert(p2x, p2y, 1);
        vert(p3x, p3y, 1);
        vert(p4x, p4y, 1);
        vert(p5x, p5y, 1);
        vert(p6x, p6y, 1);
        endStrip();

        startStrip();
        quadNormal(p4x, p4y, p6x, p6y);
        endStrip();

        startStrip();
        nx = 0;
        ny = 0;
        nz = -1;
        vert(p6x, p6y, -1);
        vert(p5x, p5y, -1);
        vert(p4x, p4y, -1);
        vert(p3x, p3y, -1);
        vert(p2x, p2y, -1);
        vert(p1x, p1y, -1);
        vert(p0x, p0y, -1);
        endStrip();

        startStrip();
        quadNormal(p0x, p0y, p2x, p2y);
        endStrip();

        startStrip();
        quadNormal(p1x, p1y, p0x, p0y);
        endStrip();

        startStrip();
        quadNormal(p3x, p3y, p1x, p1y);
        endStrip();

        startStrip();
        quadNormal(p5x, p5y, p3x, p3y);
        endStrip();
    }

    return { vertices, nvertices: vi, strips };
}

function mat4Multiply(a: number[], b: number[]): number[] {
    const result: number[] = [];
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            let sum = 0;
            for (let k = 0; k < 4; k++) {
                sum += (b[i * 4 + k] ?? 0) * (a[k * 4 + j] ?? 0);
            }
            result.push(sum);
        }
    }
    return result;
}

function mat4Translate(m: number[], x: number, y: number, z: number): number[] {
    return mat4Multiply(m, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
}

function mat4Rotate(m: number[], angle: number, x: number, y: number, z: number): number[] {
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    return mat4Multiply(m, [
        x * x * (1 - c) + c,
        y * x * (1 - c) + z * s,
        x * z * (1 - c) - y * s,
        0,
        x * y * (1 - c) - z * s,
        y * y * (1 - c) + c,
        y * z * (1 - c) + x * s,
        0,
        x * z * (1 - c) + y * s,
        y * z * (1 - c) - x * s,
        z * z * (1 - c) + c,
        0,
        0,
        0,
        0,
        1,
    ]);
}

function mat4Perspective(fovy: number, aspect: number, zNear: number, zFar: number): number[] {
    const f = 1.0 / Math.tan(fovy / 2);
    const dz = zFar - zNear;
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, -(zFar + zNear) / dz, -1, 0, 0, (-2 * zNear * zFar) / dz, 0];
}

function mat4Transpose(m: number[]): number[] {
    return [
        m[0] ?? 0,
        m[4] ?? 0,
        m[8] ?? 0,
        m[12] ?? 0,
        m[1] ?? 0,
        m[5] ?? 0,
        m[9] ?? 0,
        m[13] ?? 0,
        m[2] ?? 0,
        m[6] ?? 0,
        m[10] ?? 0,
        m[14] ?? 0,
        m[3] ?? 0,
        m[7] ?? 0,
        m[11] ?? 0,
        m[15] ?? 0,
    ];
}

function mat4Invert(m: number[]): number[] {
    const t = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -(m[12] ?? 0), -(m[13] ?? 0), -(m[14] ?? 0), 1];
    const r = [...m];
    r[12] = 0;
    r[13] = 0;
    r[14] = 0;
    return mat4Multiply(mat4Transpose(r), t);
}

interface GLState {
    program: number;
    vao: number;
    gearVbos: number[];
    gearGeoms: GearGeometry[];
    uniforms: {
        mvp: number;
        normalMatrix: number;
        lightSourcePosition: number;
        materialColor: number;
    };
}

const GEAR_COLORS = [
    [0.8, 0.1, 0.0, 1.0],
    [0.0, 0.8, 0.2, 1.0],
    [0.2, 0.2, 1.0, 1.0],
];

const GEAR_PARAMS = [
    { inner: 1.0, outer: 4.0, width: 1.0, teeth: 20, depth: 0.7 },
    { inner: 0.5, outer: 2.0, width: 2.0, teeth: 10, depth: 0.7 },
    { inner: 1.3, outer: 2.0, width: 0.5, teeth: 10, depth: 0.7 },
];

function initGL(): GLState {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, VERTEX_SHADER);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, FRAGMENT_SHADER);
    gl.compileShader(fs);

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.detachShader(program, vs);
    gl.detachShader(program, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
    gl.useProgram(program);

    const uniforms = {
        mvp: gl.getUniformLocation(program, "ModelViewProjectionMatrix"),
        normalMatrix: gl.getUniformLocation(program, "NormalMatrix"),
        lightSourcePosition: gl.getUniformLocation(program, "LightSourcePosition"),
        materialColor: gl.getUniformLocation(program, "MaterialColor"),
    };

    gl.uniform4f(uniforms.lightSourcePosition, 5.0, 5.0, 10.0, 1.0);

    const vao = gl.genVertexArray();
    gl.bindVertexArray(vao);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    const gearVbos: number[] = [];
    const gearGeoms: GearGeometry[] = [];

    for (const params of GEAR_PARAMS) {
        const gear = createGear(params.inner, params.outer, params.width, params.teeth, params.depth);
        const vbo = gl.genBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, gear.vertices, gl.STATIC_DRAW);
        gearVbos.push(vbo);
        gearGeoms.push(gear);
    }

    return { program, vao, gearVbos, gearGeoms, uniforms };
}

function drawGear(
    uniforms: GLState["uniforms"],
    projection: number[],
    transform: number[],
    gear: GearGeometry,
    vbo: number,
    x: number,
    y: number,
    angle: number,
    color: number[],
) {
    let modelView = mat4Translate(transform, x, y, 0);
    modelView = mat4Rotate(modelView, (2 * Math.PI * angle) / 360, 0, 0, 1);

    const mvp = mat4Multiply(projection, modelView);
    gl.uniformMatrix4fv(uniforms.mvp, 1, false, mvp);

    const normalMatrix = mat4Transpose(mat4Invert(modelView));
    gl.uniformMatrix4fv(uniforms.normalMatrix, 1, false, normalMatrix);

    gl.uniform4f(uniforms.materialColor, color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, color[3] ?? 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 6 * 4, 0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 6 * 4, 3 * 4);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);

    for (const strip of gear.strips) {
        gl.drawArrays(gl.TRIANGLE_STRIP, strip.first, strip.count);
    }

    gl.disableVertexAttribArray(1);
    gl.disableVertexAttribArray(0);
}

const AxisSlider = ({ axis, value, onChange }: { axis: string; value: number; onChange: (value: number) => void }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
        <GtkLabel label={axis} />
        <GtkScale
            orientation={Gtk.Orientation.VERTICAL}
            inverted
            drawValue={false}
            vexpand
            value={value}
            lower={0}
            upper={360}
            stepIncrement={1}
            pageIncrement={12}
            onValueChanged={onChange}
        />
    </GtkBox>
);

const GearsDemo = () => {
    const glAreaRef = useRef<Gtk.GLArea | null>(null);
    const glStateRef = useRef<GLState | null>(null);
    const [viewRotX, setViewRotX] = useState(20);
    const [viewRotY, setViewRotY] = useState(30);
    const [viewRotZ, setViewRotZ] = useState(20);
    const [fps, setFps] = useState(-1);
    const [error, setError] = useState<string | null>(null);
    const tickIdRef = useRef<number | null>(null);
    const firstFrameTimeRef = useRef(0);
    const angleRef = useRef(0);
    const viewRotXRef = useRef(viewRotX);
    const viewRotYRef = useRef(viewRotY);
    const viewRotZRef = useRef(viewRotZ);
    viewRotXRef.current = viewRotX;
    viewRotYRef.current = viewRotY;
    viewRotZRef.current = viewRotZ;

    const tickCallback = useCallback((_widget: Gtk.Widget, frameClock: Gdk.FrameClock): boolean => {
        const frameTime = frameClock.getFrameTime();

        if (firstFrameTimeRef.current === 0) {
            firstFrameTimeRef.current = frameTime;
            return true;
        }

        angleRef.current = (((frameTime - firstFrameTimeRef.current) / 1_000_000) * 70) % 360;
        glAreaRef.current?.queueRender();

        const frame = frameClock.getFrameCounter();
        const historyStart = frameClock.getHistoryStart();

        if (frame % 60 === 0) {
            const historyLen = frame - historyStart;
            if (historyLen > 0) {
                const previousTimings = frameClock.getTimings(frame - historyLen);
                if (previousTimings) {
                    const previousFrameTime = previousTimings.getFrameTime();
                    setFps((1_000_000 * historyLen) / (frameTime - previousFrameTime));
                }
            }
        }

        return true;
    }, []);

    const startAnimation = useCallback(() => {
        const glArea = glAreaRef.current;
        if (!glArea || tickIdRef.current !== null) return;
        firstFrameTimeRef.current = 0;
        tickIdRef.current = glArea.addTickCallback(tickCallback);
    }, [tickCallback]);

    const stopAnimation = useCallback(() => {
        const glArea = glAreaRef.current;
        if (!glArea || tickIdRef.current === null) return;
        glArea.removeTickCallback(tickIdRef.current);
        tickIdRef.current = null;
        firstFrameTimeRef.current = 0;
    }, []);

    const handleGLAreaRef = useCallback(
        (glArea: Gtk.GLArea | null) => {
            if (glAreaRef.current && tickIdRef.current !== null) {
                glAreaRef.current.removeTickCallback(tickIdRef.current);
                tickIdRef.current = null;
            }
            glAreaRef.current = glArea;
            if (glArea) {
                startAnimation();
            }
        },
        [startAnimation],
    );

    useEffect(() => {
        return stopAnimation;
    }, [stopAnimation]);

    const handleUnrealize = useCallback((_self: Gtk.Widget) => {
        const state = glStateRef.current;
        if (state) {
            for (const vbo of state.gearVbos) {
                gl.deleteBuffer(vbo);
            }
            gl.deleteVertexArray(state.vao);
            gl.deleteProgram(state.program);
            glStateRef.current = null;
        }
    }, []);

    const handleRender = useCallback((_context: Gdk.GLContext, self: Gtk.GLArea) => {
        if (!glStateRef.current) {
            const glError = self.getError();
            if (glError) {
                setError(`GL context error: ${glError.getMessage()}`);
                return true;
            }

            try {
                glStateRef.current = initGL();
            } catch (e) {
                setError(`GL initialization error: ${e}`);
                return true;
            }
        }

        const state = glStateRef.current;

        const scale = self.getScaleFactor();
        const width = self.getAllocatedWidth() * scale;
        const height = self.getAllocatedHeight() * scale;

        const projection = mat4Perspective(Math.PI / 3, width / height, 1.0, 1024.0);
        gl.viewport(0, 0, width, height);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.bindVertexArray(state.vao);

        // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
        gl.useProgram(state.program);

        let transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
        transform = mat4Translate(transform, 0, 0, -20);
        transform = mat4Rotate(transform, (viewRotXRef.current * 2 * Math.PI) / 360, 1, 0, 0);
        transform = mat4Rotate(transform, (viewRotYRef.current * 2 * Math.PI) / 360, 0, 1, 0);
        transform = mat4Rotate(transform, (viewRotZRef.current * 2 * Math.PI) / 360, 0, 0, 1);

        const angle = angleRef.current;

        const gear0 = state.gearGeoms[0];
        const vbo0 = state.gearVbos[0];
        const color0 = GEAR_COLORS[0];
        if (gear0 !== undefined && vbo0 !== undefined && color0) {
            drawGear(state.uniforms, projection, transform, gear0, vbo0, -3.0, -2.0, angle, color0);
        }

        const gear1 = state.gearGeoms[1];
        const vbo1 = state.gearVbos[1];
        const color1 = GEAR_COLORS[1];
        if (gear1 !== undefined && vbo1 !== undefined && color1) {
            drawGear(state.uniforms, projection, transform, gear1, vbo1, 3.1, -2.0, -2 * angle - 9.0, color1);
        }

        const gear2 = state.gearGeoms[2];
        const vbo2 = state.gearVbos[2];
        const color2 = GEAR_COLORS[2];
        if (gear2 !== undefined && vbo2 !== undefined && color2) {
            drawGear(state.uniforms, projection, transform, gear2, vbo2, -3.1, 4.2, -2 * angle - 25.0, color2);
        }

        // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
        gl.useProgram(0);
        gl.bindVertexArray(0);

        return true;
    }, []);

    if (error) {
        return (
            <GtkFrame marginStart={12} marginEnd={12} marginTop={12} marginBottom={12}>
                <GtkLabel
                    label={error}
                    cssClasses={["error"]}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                />
            </GtkFrame>
        );
    }

    return (
        <GtkOverlay marginStart={12} marginEnd={12} marginTop={12} marginBottom={12}>
            <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
                <GtkGLArea
                    ref={handleGLAreaRef}
                    useEs
                    hasDepthBuffer
                    hexpand
                    vexpand
                    onUnrealize={handleUnrealize}
                    onRender={handleRender}
                />
                <AxisSlider axis="X" value={viewRotX} onChange={setViewRotX} />
                <AxisSlider axis="Y" value={viewRotY} onChange={setViewRotY} />
                <AxisSlider axis="Z" value={viewRotZ} onChange={setViewRotZ} />
            </GtkBox>
            <x.OverlayChild>
                <GtkLabel
                    label={fps >= 0 ? `FPS: ${fps.toFixed(1)}` : ""}
                    halign={Gtk.Align.START}
                    valign={Gtk.Align.START}
                    marginStart={12}
                    marginTop={12}
                    cssClasses={["app-notification"]}
                />
            </x.OverlayChild>
        </GtkOverlay>
    );
};

export const gearsDemo: Demo = {
    id: "gears",
    title: "OpenGL/Gears",
    description: "Classic OpenGL gears with animation and lighting",
    keywords: ["opengl", "gl", "gears", "3d", "animation", "lighting", "shading", "classic", "demo"],
    component: GearsDemo,
    sourceCode,
    defaultWidth: 640,
    defaultHeight: 640,
};
