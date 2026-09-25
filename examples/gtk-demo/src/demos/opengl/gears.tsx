import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import * as Graphene from "@gtkx/gi/graphene";
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
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import { useTickCallback } from "../../use-tick-callback.js";
import sourceCode from "./gears.tsx?raw";
import { bufferFloatData, createShaderProgram, rotationMatrix } from "./gl-helpers.js";

type GearStrip = {
    first: number;
    count: number;
};

type GearGeometry = {
    vertices: number[];
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
    startStrip: () => number;
    endStrip: (first: number) => void;
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

type GearColor = [number, number, number, number];

type GearDefinition = {
    innerRadius: number;
    outerRadius: number;
    width: number;
    teeth: number;
    toothDepth: number;
    color: GearColor;
    x: number;
    y: number;
    angleScale: number;
    angleOffset: number;
};

type GearMesh = GearDefinition & GearGeometry & { vbo: number };

type GLState = {
    program: number;
    vao: number;
    gears: GearMesh[];
    uniforms: {
        mvp: number;
        normalMatrix: number;
        lightSourcePosition: number;
        materialColor: number;
    };
};

type DrawGearParams = {
    uniforms: GLState["uniforms"];
    projection: Graphene.Matrix;
    transform: Graphene.Matrix;
    gear: GearMesh;
    angle: number;
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

const GEAR_DEFINITIONS: GearDefinition[] = [
    {
        innerRadius: 1,
        outerRadius: 4,
        width: 1,
        teeth: 20,
        toothDepth: 0.7,
        color: [0.8, 0.1, 0, 1],
        x: -3,
        y: -2,
        angleScale: 1,
        angleOffset: 0,
    },
    {
        innerRadius: 0.5,
        outerRadius: 2,
        width: 2,
        teeth: 10,
        toothDepth: 0.7,
        color: [0, 0.8, 0.2, 1],
        x: 3.1,
        y: -2,
        angleScale: -2,
        angleOffset: -9,
    },
    {
        innerRadius: 1.3,
        outerRadius: 2,
        width: 0.5,
        teeth: 10,
        toothDepth: 0.7,
        color: [0.2, 0.2, 1, 1],
        x: -3.1,
        y: 4.2,
        angleScale: -2,
        angleOffset: -25,
    },
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
            return builder.vi;
        },
        endStrip(first) {
            strips.push({ first, count: builder.vi - first });
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
    let first = builder.startStrip();
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
    builder.endStrip(first);
    first = builder.startStrip();
    builder.quadNormal(p.p4x, p.p4y, p.p6x, p.p6y);
    builder.endStrip(first);
    first = builder.startStrip();
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
    builder.endStrip(first);
    first = builder.startStrip();
    builder.quadNormal(p.p0x, p.p0y, p.p2x, p.p2y);
    builder.endStrip(first);
    first = builder.startStrip();
    builder.quadNormal(p.p1x, p.p1y, p.p0x, p.p0y);
    builder.endStrip(first);
    first = builder.startStrip();
    builder.quadNormal(p.p3x, p.p3y, p.p1x, p.p1y);
    builder.endStrip(first);
    first = builder.startStrip();
    builder.quadNormal(p.p5x, p.p5y, p.p3x, p.p3y);
    builder.endStrip(first);
};

function createGear({
    innerRadius,
    outerRadius,
    width,
    teeth,
    toothDepth,
}: GearDefinition): GearGeometry {
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

    return { vertices: builder.vertices, strips: builder.strips };
}

const translationMatrix = (x: number, y: number, z: number): Graphene.Matrix => {
    const point = new Graphene.Point3D();
    point.init(x, y, z);

    return Graphene.Matrix.alloc().initTranslate(point);
};

const collectUniforms = (program: number) => ({
    mvp: gl.getUniformLocation(program, "ModelViewProjectionMatrix"),
    normalMatrix: gl.getUniformLocation(program, "NormalMatrix"),
    lightSourcePosition: gl.getUniformLocation(program, "LightSourcePosition"),
    materialColor: gl.getUniformLocation(program, "MaterialColor"),
});

const createGearBuffers = () => {
    return GEAR_DEFINITIONS.map((definition): GearMesh => {
        const geometry = createGear(definition);

        const vbo = gl.genBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        bufferFloatData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);

        return { ...definition, ...geometry, vbo };
    });
};

function initGL(): GLState {
    const program = createShaderProgram(VERTEX_SHADER, FRAGMENT_SHADER);
    gl.useProgram(program);
    const uniforms = collectUniforms(program);
    gl.uniform4f(uniforms.lightSourcePosition, 5, 5, 10, 1);
    const vao = gl.genVertexArray();
    gl.bindVertexArray(vao);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    const gears = createGearBuffers();

    return { program, vao, gears, uniforms };
}

function drawGear(params: DrawGearParams) {
    const { uniforms, projection, transform, gear, angle } = params;
    const gearAngle = gear.angleScale * angle + gear.angleOffset;
    const modelView = rotationMatrix(gearAngle, 0, 0, 1)
        .multiply(translationMatrix(gear.x, gear.y, 0))
        .multiply(transform);
    const mvp = modelView.multiply(projection);
    gl.uniformMatrix4fv(uniforms.mvp, 1, false, mvp.toFloat());
    const [, inverseModelView] = modelView.inverse();
    gl.uniformMatrix4fv(uniforms.normalMatrix, 1, false, inverseModelView.transpose().toFloat());
    gl.uniform4f(uniforms.materialColor, gear.color[0], gear.color[1], gear.color[2], gear.color[3]);
    gl.bindBuffer(gl.ARRAY_BUFFER, gear.vbo);
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
                accessibleLabel={`${axis} axis`}
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
    const [glArea, setGLArea] = useState<Gtk.GLArea | null>(null);
    const firstFrameTimeRef = useRef(0);
    const angleRef = useRef(0);

    useTickCallback(glArea, (_widget, frameClock) => {
        const frameTime = Number(frameClock.getFrameTime());

        if (firstFrameTimeRef.current === 0) {
            firstFrameTimeRef.current = frameTime;

            return GLib.SOURCE_CONTINUE;
        }

        angleRef.current = (((frameTime - firstFrameTimeRef.current) / 1_000_000) * 70) % 360;
        glArea?.queueRender();
        sampleFps(frameClock, frameTime, fpsRef);

        return GLib.SOURCE_CONTINUE;
    });

    const handleGLAreaRef = useCallback((area: Gtk.GLArea | null) => {
        setGLArea(area);
        firstFrameTimeRef.current = 0;
    }, []);

    useFpsPolling(fpsRef, setFps);

    return { angleRef, handleGLAreaRef };
}

function useGearsUnrealize(glStateRef: React.RefObject<GLState | null>) {
    return (area: Gtk.GLArea) => {
        const state = glStateRef.current;

        if (!state) {
            return;
        }

        area.makeCurrent();

        for (const gear of state.gears) {
            gl.deleteBuffer(gear.vbo);
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

const drawAllGears = (state: GLState, transform: Graphene.Matrix, projection: Graphene.Matrix, angle: number) => {
    for (const gear of state.gears) {
        drawGear({ uniforms: state.uniforms, projection, transform, gear, angle });
    }
};

const computeViewTransform = (rotation: ViewRotation): Graphene.Matrix =>
    rotationMatrix(rotation.z, 0, 0, 1)
        .multiply(rotationMatrix(rotation.y, 0, 1, 0))
        .multiply(rotationMatrix(rotation.x, 1, 0, 0))
        .multiply(translationMatrix(0, 0, -20));

const renderGearsFrame = ({ glState, area, rotation, angle }: RenderFrameParams): void => {
    const scale = area.getScaleFactor();
    const width = area.getWidth() * scale;
    const height = area.getHeight() * scale;
    const projection = Graphene.Matrix.alloc().initPerspective(60, width / height, 1, 1024);
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
                    accessibleLabel="Animated gears"
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
