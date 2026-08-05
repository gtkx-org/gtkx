import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import * as gl from "@gtkx/gl";
import {
    GtkAdjustment,
    GtkBox,
    GtkFrame,
    GtkGLArea,
    GtkLabel,
    GtkOverlay,
    GtkOverlayLayoutChild,
    GtkScale,
} from "@gtkx/jsx/gtk";
import { useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import { useTickCallback } from "../../use-tick-callback.js";
import sourceCode from "./gears.tsx?raw";
import { bufferFloatData, setShaderSource } from "./gl-helpers.js";

type GearStrip = {
    first: number;
    count: number;
};

type GearGeometry = {
    vertices: number[];
    nvertices: number;
    strips: GearStrip[];
};

type GearBuilder = {
    vertices: number[];
    strips: GearStrip[];
    vi: number;
    nx: number;
    ny: number;
    nz: number;
    w2: number;
    vert: (px: number, py: number, sign: number) => void;
    startStrip: () => void;
    endStrip: () => void;
    quadNormal: (p1x: number, p1y: number, p2x: number, p2y: number) => void;
};

type ToothRadii = {
    r0: number;
    r1: number;
    r2: number;
    da: number;
};

type ToothPoints = {
    p0x: number;
    p0y: number;
    p1x: number;
    p1y: number;
    p2x: number;
    p2y: number;
    p3x: number;
    p3y: number;
    p4x: number;
    p4y: number;
    p5x: number;
    p5y: number;
    p6x: number;
    p6y: number;
};

type GLState = {
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
};

type DrawGearParams = {
    uniforms: GLState["uniforms"];
    projection: number[];
    transform: number[];
    gear: GearGeometry;
    vbo: number;
    x: number;
    y: number;
    angle: number;
    color: number[];
};

type GearsState = ReturnType<typeof useGearsState>;

type ViewRotation = {
    x: number;
    y: number;
    z: number;
};

type RenderFrameParams = {
    glState: GLState;
    area: Gtk.GLArea;
    rotation: ViewRotation;
    angle: number;
};

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

const GEAR_COLORS = [
    [0.8, 0.1, 0, 1],
    [0, 0.8, 0.2, 1],
    [0.2, 0.2, 1, 1],
];

const GEAR_PARAMS = [
    { inner: 1, outer: 4, width: 1, teeth: 20, depth: 0.7 },
    { inner: 0.5, outer: 2, width: 2, teeth: 10, depth: 0.7 },
    { inner: 1.3, outer: 2, width: 0.5, teeth: 10, depth: 0.7 },
];

const FPS_POLL_MS = 500;

const gearsDemo: Demo = {
    id: "gears",
    title: "OpenGL/Gears",
    description: "This is a classic OpenGL demo, running in a GtkGLArea.",
    keywords: [],
    component: GearsDemo,
    sourceCode,
    defaultWidth: 640,
    defaultHeight: 640,
};

const createGearBuilder = (width: number): GearBuilder => {
    const vertices: number[] = [];
    const strips: GearStrip[] = [];

    const builder: GearBuilder = {
        vertices,
        strips,
        vi: 0,
        nx: 0,
        ny: 0,
        nz: 0,
        w2: width / 2,
        vert(px, py, sign) {
            vertices.push(px, py, sign * builder.w2, builder.nx, builder.ny, builder.nz);
            builder.vi++;
        },
        startStrip() {
            strips.push({ first: builder.vi, count: 0 });
        },
        endStrip() {
            const strip = strips.at(-1);

            if (strip) {
                strip.count = builder.vi - strip.first;
            }
        },
        quadNormal(p1x, p1y, p2x, p2y) {
            builder.nx = p1y - p2y;
            builder.ny = -(p1x - p2x);
            builder.nz = 0;
            builder.vert(p1x, p1y, -1);
            builder.vert(p1x, p1y, 1);
            builder.vert(p2x, p2y, -1);
            builder.vert(p2x, p2y, 1);
        },
    };

    return builder;
};

const computeToothPoints = (radii: ToothRadii, base: number): ToothPoints => {
    const { r0, r1, r2, da } = radii;
    const c0 = Math.cos(base);
    const s0 = Math.sin(base);
    const c1 = Math.cos(base + da);
    const s1 = Math.sin(base + da);
    const c2 = Math.cos(base + 2 * da);
    const s2 = Math.sin(base + 2 * da);
    const c3 = Math.cos(base + 3 * da);
    const s3 = Math.sin(base + 3 * da);
    const c4 = Math.cos(base + 4 * da);
    const s4 = Math.sin(base + 4 * da);

    return {
        p0x: r2 * c1,
        p0y: r2 * s1,
        p1x: r2 * c2,
        p1y: r2 * s2,
        p2x: r1 * c0,
        p2y: r1 * s0,
        p3x: r1 * c3,
        p3y: r1 * s3,
        p4x: r0 * c0,
        p4y: r0 * s0,
        p5x: r1 * c4,
        p5y: r1 * s4,
        p6x: r0 * c4,
        p6y: r0 * s4,
    };
};

const emitToothFaces = (builder: GearBuilder, radii: ToothRadii, base: number) => {
    const p = computeToothPoints(radii, base);
    builder.startStrip();
    builder.nx = 0;
    builder.ny = 0;
    builder.nz = 1;
    builder.vert(p.p0x, p.p0y, 1);
    builder.vert(p.p1x, p.p1y, 1);
    builder.vert(p.p2x, p.p2y, 1);
    builder.vert(p.p3x, p.p3y, 1);
    builder.vert(p.p4x, p.p4y, 1);
    builder.vert(p.p5x, p.p5y, 1);
    builder.vert(p.p6x, p.p6y, 1);
    builder.endStrip();
    builder.startStrip();
    builder.quadNormal(p.p4x, p.p4y, p.p6x, p.p6y);
    builder.endStrip();
    builder.startStrip();
    builder.nx = 0;
    builder.ny = 0;
    builder.nz = -1;
    builder.vert(p.p6x, p.p6y, -1);
    builder.vert(p.p5x, p.p5y, -1);
    builder.vert(p.p4x, p.p4y, -1);
    builder.vert(p.p3x, p.p3y, -1);
    builder.vert(p.p2x, p.p2y, -1);
    builder.vert(p.p1x, p.p1y, -1);
    builder.vert(p.p0x, p.p0y, -1);
    builder.endStrip();
    builder.startStrip();
    builder.quadNormal(p.p0x, p.p0y, p.p2x, p.p2y);
    builder.endStrip();
    builder.startStrip();
    builder.quadNormal(p.p1x, p.p1y, p.p0x, p.p0y);
    builder.endStrip();
    builder.startStrip();
    builder.quadNormal(p.p3x, p.p3y, p.p1x, p.p1y);
    builder.endStrip();
    builder.startStrip();
    builder.quadNormal(p.p5x, p.p5y, p.p3x, p.p3y);
    builder.endStrip();
};

function createGear({
    innerRadius,
    outerRadius,
    width,
    teeth,
    toothDepth,
}: {
    innerRadius: number;
    outerRadius: number;
    width: number;
    teeth: number;
    toothDepth: number;
}): GearGeometry {
    const builder = createGearBuilder(width);

    const radii = {
        r0: innerRadius,
        r1: outerRadius - toothDepth / 2,
        r2: outerRadius + toothDepth / 2,
        da: (2 * Math.PI) / teeth / 4,
    };

    for (let i = 0; i < teeth; i++) {
        emitToothFaces(builder, radii, (i * 2 * Math.PI) / teeth);
    }

    return { vertices: builder.vertices, nvertices: builder.vi, strips: builder.strips };
}

function mat4Cell(a: number[], b: number[], row: number, column: number): number {
    let sum = 0;

    for (let k = 0; k < 4; k++) {
        sum += (b[row * 4 + k] ?? 0) * (a[k * 4 + column] ?? 0);
    }

    return sum;
}

function mat4Multiply(a: number[], b: number[]): number[] {
    const result: number[] = [];

    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            result.push(mat4Cell(a, b, i, j));
        }
    }

    return result;
}

function mat4Translate(m: number[], x: number, y: number, z: number): number[] {
    return mat4Multiply(m, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
}

function mat4Rotate(m: number[], { angle, x, y, z }: { angle: number; x: number; y: number; z: number }): number[] {
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
    const f = 1 / Math.tan(fovy / 2);
    const dz = zFar - zNear;

    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, -(zFar + zNear) / dz, -1, 0, 0, (-2 * zNear * zFar) / dz, 0];
}

function mat4Transpose(m: number[]): number[] {
    const at = (i: number) => m[i] ?? 0;

    return [
        at(0),
        at(4),
        at(8),
        at(12),
        at(1),
        at(5),
        at(9),
        at(13),
        at(2),
        at(6),
        at(10),
        at(14),
        at(3),
        at(7),
        at(11),
        at(15),
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

const createGearsProgram = (): number => {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    setShaderSource(vs, VERTEX_SHADER);
    gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    setShaderSource(fs, FRAGMENT_SHADER);
    gl.compileShader(fs);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.detachShader(program, vs);
    gl.detachShader(program, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.useProgram(program);

    return program;
};

const collectUniforms = (program: number) => ({
    mvp: gl.getUniformLocation(program, "ModelViewProjectionMatrix"),
    normalMatrix: gl.getUniformLocation(program, "NormalMatrix"),
    lightSourcePosition: gl.getUniformLocation(program, "LightSourcePosition"),
    materialColor: gl.getUniformLocation(program, "MaterialColor"),
});

const createGearBuffers = () => {
    const gearVbos: number[] = [];
    const gearGeoms: GearGeometry[] = [];

    for (const params of GEAR_PARAMS) {
        const gear = createGear({
            innerRadius: params.inner,
            outerRadius: params.outer,
            width: params.width,
            teeth: params.teeth,
            toothDepth: params.depth,
        });

        const vbo = gl.genBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        bufferFloatData(gl.ARRAY_BUFFER, gear.vertices, gl.STATIC_DRAW);
        gearVbos.push(vbo);
        gearGeoms.push(gear);
    }

    return { gearVbos, gearGeoms };
};

function initGL(): GLState {
    const program = createGearsProgram();
    const uniforms = collectUniforms(program);
    gl.uniform4f(uniforms.lightSourcePosition, 5, 5, 10, 1);
    const vao = gl.genVertexArray();
    gl.bindVertexArray(vao);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    const { gearVbos, gearGeoms } = createGearBuffers();

    return { program, vao, gearVbos, gearGeoms, uniforms };
}

function drawGear(params: DrawGearParams) {
    const { uniforms, projection, transform, gear, vbo, x, y, angle, color } = params;
    let modelView = mat4Translate(transform, x, y, 0);
    modelView = mat4Rotate(modelView, { angle: (2 * Math.PI * angle) / 360, x: 0, y: 0, z: 1 });
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

const AxisSlider = ({ axis, value, onChange }: { axis: string; value: number; onChange: (value: number) => void }) => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
            <GtkLabel>{axis}</GtkLabel>
            <GtkScale
                orientation={Gtk.Orientation.VERTICAL}
                inverted
                drawValue={false}
                vexpand
                adjustment={<GtkAdjustment value={value} lower={0} upper={360} stepIncrement={1} pageIncrement={12} />}
                onValueChanged={(scale) => {
                    onChange(scale.getValue());
                }}
            />
        </GtkBox>
    );
};

function useGearsState() {
    const [viewRotX, setViewRotX] = useState(20);
    const [viewRotY, setViewRotY] = useState(30);
    const [viewRotZ, setViewRotZ] = useState(20);
    const [fps, setFps] = useState(-1);
    const fpsRef = useRef(-1);
    const [error, setError] = useState<string | null>(null);

    return {
        viewRotX,
        setViewRotX,
        viewRotY,
        setViewRotY,
        viewRotZ,
        setViewRotZ,
        fps,
        setFps,
        fpsRef,
        error,
        setError,
    };
}

const sampleFps = (frameClock: Gdk.FrameClock, frameTime: number, fpsRef: React.RefObject<number>): void => {
    const frame = Number(frameClock.getFrameCounter());

    if (frame % 60 !== 0) {
        return;
    }

    const historyStart = Number(frameClock.getHistoryStart());
    const historyLen = frame - historyStart;

    if (historyLen <= 0) {
        return;
    }

    const previousTimings = frameClock.getTimings(BigInt(frame - historyLen));

    if (!previousTimings) {
        return;
    }

    const previousFrameTime = Number(previousTimings.getFrameTime());
    fpsRef.current = (1_000_000 * historyLen) / (frameTime - previousFrameTime);
};

function useFpsPolling(fpsRef: React.RefObject<number>, setFps: (fps: number) => void) {
    useEffect(() => {
        const interval = setInterval(() => {
            setFps(fpsRef.current);
        }, FPS_POLL_MS);

        return () => {
            clearInterval(interval);
        };
    }, [fpsRef, setFps]);
}

function useGearsAnimation(fpsRef: React.RefObject<number>, setFps: (fps: number) => void) {
    const glAreaRef = useRef<Gtk.GLArea | null>(null);
    const firstFrameTimeRef = useRef(0);
    const angleRef = useRef(0);

    useTickCallback(glAreaRef, (_widget, frameClock) => {
        const frameTime = Number(frameClock.getFrameTime());

        if (firstFrameTimeRef.current === 0) {
            firstFrameTimeRef.current = frameTime;

            return GLib.SOURCE_CONTINUE;
        }

        angleRef.current = (((frameTime - firstFrameTimeRef.current) / 1_000_000) * 70) % 360;
        glAreaRef.current?.queueRender();
        sampleFps(frameClock, frameTime, fpsRef);

        return GLib.SOURCE_CONTINUE;
    });

    const handleGLAreaRef = (glArea: Gtk.GLArea | null) => {
        glAreaRef.current = glArea;
        firstFrameTimeRef.current = 0;
    };

    useFpsPolling(fpsRef, setFps);

    return { angleRef, handleGLAreaRef };
}

function useGearsUnrealize(glStateRef: React.RefObject<GLState | null>) {
    return () => {
        const state = glStateRef.current;

        if (!state) {
            return;
        }

        for (const vbo of state.gearVbos) {
            gl.deleteBuffer(vbo);
        }

        gl.deleteVertexArray(state.vao);
        gl.deleteProgram(state.program);
        glStateRef.current = null;
    };
}

const resolveGLState = (
    glStateRef: React.RefObject<GLState | null>,
    area: Gtk.GLArea,
    setError: (message: string) => void,
): GLState | null => {
    if (glStateRef.current) {
        return glStateRef.current;
    }

    const glError = area.getError();

    if (glError) {
        setError(`GL context error: ${glError.message}`);

        return null;
    }

    try {
        glStateRef.current = initGL();
    } catch (error) {
        setError(`GL initialization error: ${error instanceof Error ? error.message : String(error)}`);

        return null;
    }

    return glStateRef.current;
};

const drawAllGears = (state: GLState, transform: number[], projection: number[], angle: number) => {
    const configs = [
        { idx: 0, x: -3, y: -2, angle },
        { idx: 1, x: 3.1, y: -2, angle: -2 * angle - 9 },
        { idx: 2, x: -3.1, y: 4.2, angle: -2 * angle - 25 },
    ];

    for (const cfg of configs) {
        const gear = state.gearGeoms[cfg.idx];
        const vbo = state.gearVbos[cfg.idx];
        const color = GEAR_COLORS[cfg.idx];

        if (gear !== undefined && vbo !== undefined && color) {
            drawGear({
                uniforms: state.uniforms,
                projection,
                transform,
                gear,
                vbo,
                x: cfg.x,
                y: cfg.y,
                angle: cfg.angle,
                color,
            });
        }
    }
};

const computeViewTransform = (rotation: ViewRotation): number[] => {
    let transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    transform = mat4Translate(transform, 0, 0, -20);
    transform = mat4Rotate(transform, { angle: (rotation.x * 2 * Math.PI) / 360, x: 1, y: 0, z: 0 });
    transform = mat4Rotate(transform, { angle: (rotation.y * 2 * Math.PI) / 360, x: 0, y: 1, z: 0 });
    transform = mat4Rotate(transform, { angle: (rotation.z * 2 * Math.PI) / 360, x: 0, y: 0, z: 1 });

    return transform;
};

const renderGearsFrame = ({ glState, area, rotation, angle }: RenderFrameParams): void => {
    const scale = area.getScaleFactor();
    const width = area.getWidth() * scale;
    const height = area.getHeight() * scale;
    const projection = mat4Perspective(Math.PI / 3, width / height, 1, 1024);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindVertexArray(glState.vao);
    gl.useProgram(glState.program);
    const transform = computeViewTransform(rotation);
    drawAllGears(glState, transform, projection, angle);
    gl.useProgram(0);
    gl.bindVertexArray(0);
};

function useGearsRender(
    glStateRef: React.RefObject<GLState | null>,
    angleRef: React.RefObject<number>,
    state: GearsState,
) {
    return (_context: Gdk.GLContext, self: Gtk.GLArea) => {
        const glState = resolveGLState(glStateRef, self, state.setError);

        if (glState) {
            renderGearsFrame({
                glState,
                area: self,
                rotation: { x: state.viewRotX, y: state.viewRotY, z: state.viewRotZ },
                angle: angleRef.current,
            });
        }

        return Gdk.EVENT_STOP;
    };
}

const GearsError = ({ error }: { error: string }) => (
    <GtkFrame marginStart={12} marginEnd={12} marginTop={12} marginBottom={12}>
        <GtkLabel cssClasses={["error"]} marginTop={12} marginBottom={12} marginStart={12} marginEnd={12}>
            {error}
        </GtkLabel>
    </GtkFrame>
);

function GearsDemo() {
    const state = useGearsState();
    const glStateRef = useRef<GLState | null>(null);
    const { angleRef, handleGLAreaRef } = useGearsAnimation(state.fpsRef, state.setFps);
    const handleUnrealize = useGearsUnrealize(glStateRef);
    const handleRender = useGearsRender(glStateRef, angleRef, state);

    if (state.error) {
        return <GearsError error={state.error} />;
    }

    return (
        <GtkOverlay
            marginStart={12}
            marginEnd={12}
            marginTop={12}
            marginBottom={12}
            overlays={[
                <GtkOverlayLayoutChild key="overlay-0">
                    <GtkLabel
                        halign={Gtk.Align.START}
                        valign={Gtk.Align.START}
                        marginStart={12}
                        marginTop={12}
                        cssClasses={["app-notification"]}
                    >
                        {state.fps > 0 ? `FPS: ${state.fps.toFixed(1)}` : "FPS: ---"}
                    </GtkLabel>
                </GtkOverlayLayoutChild>,
            ]}
        >
            <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
                <GtkGLArea
                    name="gl-area"
                    ref={handleGLAreaRef}
                    allowedApis={Gdk.GLAPI.GLES}
                    hasDepthBuffer
                    hexpand
                    vexpand
                    onUnrealize={handleUnrealize}
                    onRender={handleRender}
                />
                <AxisSlider axis="X" value={state.viewRotX} onChange={state.setViewRotX} />
                <AxisSlider axis="Y" value={state.viewRotY} onChange={state.setViewRotY} />
                <AxisSlider axis="Z" value={state.viewRotZ} onChange={state.setViewRotZ} />
            </GtkBox>
        </GtkOverlay>
    );
}

export { gearsDemo };
