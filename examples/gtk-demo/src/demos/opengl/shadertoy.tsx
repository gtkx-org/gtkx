import type * as Gdk from "@gtkx/ffi/gdk";
import * as gl from "@gtkx/ffi/gl";
import * as Gtk from "@gtkx/ffi/gtk";
import type * as GtkSource from "@gtkx/ffi/gtksource";
import {
    GtkAspectFrame,
    GtkBox,
    GtkButton,
    GtkCenterBox,
    GtkGLArea,
    GtkScrolledWindow,
    GtkSourceView,
    x,
} from "@gtkx/react";
import { type RefCallback, useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./shadertoy.tsx?raw";

const VERTEX_SHADER = `#version 300 es
precision mediump float;

layout (location = 0) in vec2 aPos;
out vec2 fragCoord;
uniform vec2 iResolution;
void main() {
 gl_Position = vec4(aPos, 0.0, 1.0);
 fragCoord = (aPos * 0.5 + 0.5) * iResolution;
}`;

const ALIEN_PLANET_SHADER = `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float t = iTime * 0.5;
    float v = 0.0;
    v += sin((uv.x * 10.0) + t);
    v += sin((uv.y * 10.0) + t);
    v += sin((uv.x * 10.0 + uv.y * 10.0) + t);
    float cx = uv.x + 0.5 * sin(t / 5.0);
    float cy = uv.y + 0.5 * cos(t / 3.0);
    v += sin(sqrt(100.0 * (cx * cx + cy * cy) + 1.0) + t);
    v = v / 2.0;
    vec3 col = vec3(
        sin(v * 3.14159) * 0.5 + 0.5,
        sin(v * 3.14159 + 2.094) * 0.5 + 0.5,
        sin(v * 3.14159 + 4.188) * 0.5 + 0.5
    );
    fragColor = vec4(col, 1.0);
}`;

const MANDELBROT_SHADER = `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float zoom = 2.0 + sin(iTime * 0.1) * 1.5;
    vec2 c = uv * zoom + vec2(-0.5, 0.0);
    vec2 z = vec2(0.0);
    float iter = 0.0;
    const float maxIter = 100.0;
    for (float i = 0.0; i < maxIter; i++) {
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        if (dot(z, z) > 4.0) break;
        iter++;
    }
    float t = iter / maxIter;
    vec3 col = vec3(
        0.5 + 0.5 * cos(3.0 + t * 15.0),
        0.5 + 0.5 * cos(3.0 + t * 15.0 + 0.6),
        0.5 + 0.5 * cos(3.0 + t * 15.0 + 1.0)
    );
    if (iter >= maxIter - 1.0) col = vec3(0.0);
    fragColor = vec4(col, 1.0);
}`;

const NEON_SHADER = `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy - 0.5;
    uv.x *= iResolution.x / iResolution.y;
    float a = atan(uv.y, uv.x);
    float r = length(uv);
    float t = iTime;
    vec2 tc = vec2(a / 3.14159, 1.0 / r + t * 0.5);
    float c = mod(floor(tc.x * 8.0) + floor(tc.y * 8.0), 2.0);
    c = mix(0.2, 0.8, c);
    c *= r * 2.0;
    fragColor = vec4(vec3(c), 1.0);
}`;

const COGS_SHADER = `// Based on: https://www.shadertoy.com/view/3ljyDD (CC0)
#define PI 3.141592654
#define TAU (2.0*PI)

float hash(vec2 co) { return fract(sin(dot(co, vec2(12.9898,58.233))) * 13758.5453); }
float pcos(float a) { return 0.5 + 0.5*cos(a); }
void rot(inout vec2 p, float a) { float c=cos(a), s=sin(a); p = vec2(c*p.x+s*p.y, -s*p.x+c*p.y); }

float modPolar(inout vec2 p, float rep) {
    float angle = TAU/rep, a = atan(p.y, p.x) + angle/2.0;
    float r = length(p), c = floor(a/angle);
    a = mod(a,angle) - angle/2.0;
    p = vec2(cos(a), sin(a))*r;
    if (abs(c) >= rep/2.0) c = abs(c);
    return c;
}

float pmin(float a, float b, float k) {
    float h = clamp(0.5+0.5*(b-a)/k, 0.0, 1.0);
    return mix(b, a, h) - k*h*(1.0-h);
}

float circle(vec2 p, float r) { return length(p) - r; }

float unevenCapsule(vec2 p, float r1, float r2, float h) {
    p.x = abs(p.x);
    float b = (r1-r2)/h, a = sqrt(1.0-b*b), k = dot(p, vec2(-b,a));
    if (k < 0.0) return length(p) - r1;
    if (k > a*h) return length(p-vec2(0.0,h)) - r2;
    return dot(p, vec2(a,b)) - r1;
}

float cogwheel(vec2 p, float inner, float outer, float cogs, float holes) {
    float cogW = 0.25*inner*TAU/cogs;
    float d0 = circle(p, inner);
    vec2 icp = p; modPolar(icp, holes); icp -= vec2(inner*0.55, 0.0);
    float d1 = circle(icp, inner*0.25);
    vec2 cp = p; modPolar(cp, cogs); cp -= vec2(inner, 0.0);
    float d2 = unevenCapsule(cp.yx, cogW, cogW*0.75, outer-inner);
    float d3 = circle(p, inner*0.20);
    float d = min(d0, d2); d = pmin(d, d2, 0.5*cogW);
    d = max(d, -d1); d = max(d, -d3);
    return d;
}

float ccell(vec2 p) {
    vec2 cp0 = p; rot(cp0, -iTime*TAU/60.0);
    float d = cogwheel(cp0, 0.36, 0.38, 60.0, 5.0);
    vec2 cp1 = p; float nm = modPolar(cp1, 6.0);
    cp1 -= vec2(0.5, 0.0); rot(cp1, 0.2+TAU*nm/2.0 + iTime*TAU/16.0);
    d = min(d, cogwheel(cp1, 0.11, 0.125, 16.0, 5.0));
    return d;
}

vec2 hextile(inout vec2 p) {
    vec2 sz = vec2(1.0, sqrt(3.0)), hsz = 0.5*sz;
    vec2 p1 = mod(p, sz)-hsz, p2 = mod(p-hsz, sz)-hsz;
    vec2 p3 = mix(p2, p1, vec2(length(p1) < length(p2)));
    vec2 n = p3 - p; p = p3; return n;
}

void mainImage(out vec4 fragColor, vec2 fragCoord) {
    vec2 q = fragCoord/iResolution.xy;
    vec2 p = -1.0 + 2.0*q; p.x *= iResolution.x/iResolution.y;
    float tm = iTime*0.1;
    p += vec2(cos(tm), sin(tm*sqrt(0.5)));
    float z = mix(0.5, 1.0, pcos(tm*sqrt(0.3)));
    p /= z;
    hextile(p);
    float d = ccell(p)*z;
    vec3 col = vec3(0.63);
    col = mix(col, vec3(0.3), smoothstep(0.0, -4.0/iResolution.y, d));
    col += 0.4*pow(abs(sin(20.0*d)), 0.6);
    col = pow(clamp(col,0.0,1.0), vec3(0.75));
    col *= 0.5+0.5*pow(19.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.7);
    fragColor = vec4(col, 1.0);
}`;

const GLOWING_STARS_SHADER = `// Based on: https://www.shadertoy.com/view/ttBcRV (CC0)
#define PI 3.141592654
#define TAU (2.0*PI)

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float hash(vec3 co) { return fract(sin(dot(co, vec3(12.9898,58.233,71.131))) * 13758.5453); }

float starn(vec2 p, float r, int n, float m) {
    float an = PI/float(n), en = PI/m;
    vec2 acs = vec2(cos(an),sin(an)), ecs = vec2(cos(en),sin(en));
    float bn = mod(atan(p.x,p.y), 2.0*an) - an;
    p = length(p)*vec2(cos(bn), abs(sin(bn)));
    p -= r*acs;
    p += ecs*clamp(-dot(p,ecs), 0.0, r*acs.y/ecs.y);
    return length(p)*sign(p.x);
}

vec4 alphaBlend(vec4 back, vec4 front) {
    return vec4(mix(back.xyz*back.w, front.xyz, front.w), mix(back.w, 1.0, front.w));
}

void rot(inout vec2 p, float a) { float c=cos(a), s=sin(a); p = vec2(c*p.x+s*p.y, -s*p.x+c*p.y); }

vec3 offset(float z) {
    vec2 p = -0.075*(vec2(cos(z), sin(z*1.414)) + vec2(cos(z*0.866), sin(z*0.707)));
    return vec3(p, z);
}

vec4 planeCol(vec3 ro, vec3 rd, float n, vec3 pp) {
    vec2 p = pp.xy - (1.0+5.0*(pp.z-ro.z))*offset(pp.z).xy;
    p *= 0.5;
    float r = hash(vec3(floor(p+0.5), n));
    p = fract(p+0.5)-0.5;
    rot(p, (TAU*r+n)*0.25);
    float d = starn(p, 0.20, 3+2*int(3.0*r), 3.0) - 0.06;
    d /= 0.5;
    float ds = -d+0.03;
    vec3 cols = hsv2rgb(vec3(0.936+0.1*sin(n*0.3), 0.8, 0.54+0.2*sin(n*0.3)));
    float ts = 1.0 - smoothstep(-4.0/iResolution.y, 0.0, ds);
    vec4 cs = vec4(cols, ts*0.93);
    float db = max(abs(abs(d)-0.06)-0.03, -d+0.03);
    float tb = exp(-db*30.0);
    vec4 cb = vec4(vec3(1.5, 1.05, 0.75), tb);
    return alphaBlend(cs, cb);
}

void mainImage(out vec4 fragColor, vec2 fragCoord) {
    vec2 q = fragCoord/iResolution.xy;
    vec2 p = -1.0 + 2.0*q; p.x *= iResolution.x/iResolution.y;
    float tm = iTime*0.65;
    vec3 ro = offset(tm);
    vec3 dro = 0.5*(offset(tm+0.05)-offset(tm-0.05))/0.05;
    vec3 ww = normalize(dro);
    vec3 uu = normalize(cross(vec3(0.0,1.0,0.0), ww));
    vec3 vv = cross(ww, uu);
    vec3 rd = normalize(p.x*uu + p.y*vv + (2.0-tanh(length(p)))*ww);
    vec4 col = vec4(vec3(0.0), 1.0);
    float nz = floor(ro.z);
    for (int i = 6; i >= 1; --i) {
        float pz = nz + float(i);
        float pd = (pz - ro.z)/rd.z;
        if (pd > 0.0) {
            vec3 pp = ro + rd*pd;
            vec4 pcol = planeCol(ro, rd, nz+float(i), pp);
            pcol.xyz *= sqrt(1.0-smoothstep(3.0, 6.0, pp.z-ro.z));
            col = alphaBlend(col, pcol);
        }
    }
    col.xyz = pow(clamp(col.xyz*col.w,0.0,1.0), vec3(0.75));
    col.xyz *= 0.5+0.5*pow(19.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.7);
    col.xyz *= smoothstep(0.0, 2.0, iTime);
    fragColor = vec4(col.xyz, 1.0);
}`;

const SHADER_PRESETS = [
    { name: "Alien Planet", code: ALIEN_PLANET_SHADER },
    { name: "Mandelbrot", code: MANDELBROT_SHADER },
    { name: "Neon", code: NEON_SHADER },
    { name: "Cogs", code: COGS_SHADER },
    { name: "Glowing Stars", code: GLOWING_STARS_SHADER },
];

function wrapShaderCode(userCode: string): string {
    return `#version 300 es
precision mediump float;

in vec2 fragCoord;
out vec4 FragColor;

uniform float iTime;
uniform vec2 iResolution;
uniform vec4 iMouse;

${userCode}

void main() {
    mainImage(FragColor, fragCoord);
}`;
}

const QUAD_VERTICES = [-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0];

interface GLState {
    program: number;
    vao: number;
    vbo: number;
    uniforms: { time: number; resolution: number; mouse: number };
}

const ShadertoyDemo = () => {
    const glAreaRef = useRef<Gtk.GLArea | null>(null);
    const glStateRef = useRef<GLState | null>(null);
    const sourceViewRef = useRef<GtkSource.View | null>(null);
    const [compiledCode, setCompiledCode] = useState(ALIEN_PLANET_SHADER);
    const [resolution, setResolution] = useState({ x: 400, y: 300 });
    const timeRef = useRef(0);
    const lastFrameTimeRef = useRef<number | null>(null);
    const tickIdRef = useRef<number | null>(null);

    const tickCallback = useCallback((_widget: Gtk.Widget, frameClock: Gdk.FrameClock): boolean => {
        const frameTime = frameClock.getFrameTime();
        if (lastFrameTimeRef.current !== null) {
            const delta = (frameTime - lastFrameTimeRef.current) / 1_000_000;
            timeRef.current += delta;
        }
        lastFrameTimeRef.current = frameTime;
        glAreaRef.current?.queueRender();
        return true;
    }, []);

    const handleGLAreaRef: RefCallback<Gtk.GLArea> = useCallback(
        (area: Gtk.GLArea | null) => {
            if (glAreaRef.current && tickIdRef.current !== null) {
                glAreaRef.current.removeTickCallback(tickIdRef.current);
                tickIdRef.current = null;
            }
            glAreaRef.current = area;
            if (area) {
                tickIdRef.current = area.addTickCallback(tickCallback);
            }
        },
        [tickCallback],
    );

    useEffect(() => {
        return () => {
            if (glAreaRef.current && tickIdRef.current !== null) {
                glAreaRef.current.removeTickCallback(tickIdRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const area = glAreaRef.current;
        const state = glStateRef.current;
        if (!area || !state || !area.getRealized()) return;

        area.makeCurrent();
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, wrapShaderCode(compiledCode));
        gl.compileShader(fragmentShader);

        if (gl.getShaderiv(fragmentShader, gl.COMPILE_STATUS) === 0) {
            gl.deleteShader(fragmentShader);
            return;
        }

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, VERTEX_SHADER);
        gl.compileShader(vertexShader);

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (gl.getProgramiv(program, gl.LINK_STATUS) === 0) {
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            gl.deleteProgram(program);
            return;
        }

        if (state.program) gl.deleteProgram(state.program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        state.program = program;
        state.uniforms = {
            time: gl.getUniformLocation(program, "iTime"),
            resolution: gl.getUniformLocation(program, "iResolution"),
            mouse: gl.getUniformLocation(program, "iMouse"),
        };
    }, [compiledCode]);

    const handleRender = useCallback(
        (self: Gtk.GLArea, _context: Gdk.GLContext) => {
            if (!glStateRef.current) {
                if (self.getError()) return true;
                const vertexShader = gl.createShader(gl.VERTEX_SHADER);
                gl.shaderSource(vertexShader, VERTEX_SHADER);
                gl.compileShader(vertexShader);

                const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
                gl.shaderSource(fragmentShader, wrapShaderCode(compiledCode));
                gl.compileShader(fragmentShader);

                const program = gl.createProgram();
                gl.attachShader(program, vertexShader);
                gl.attachShader(program, fragmentShader);
                gl.linkProgram(program);

                gl.deleteShader(vertexShader);
                gl.deleteShader(fragmentShader);

                const vao = gl.genVertexArray();
                gl.bindVertexArray(vao);

                const vbo = gl.genBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
                gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);
                gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(0);
                gl.bindVertexArray(0);

                glStateRef.current = {
                    program,
                    vao,
                    vbo,
                    uniforms: {
                        time: gl.getUniformLocation(program, "iTime"),
                        resolution: gl.getUniformLocation(program, "iResolution"),
                        mouse: gl.getUniformLocation(program, "iMouse"),
                    },
                };
            }

            const state = glStateRef.current;
            gl.viewport(0, 0, resolution.x, resolution.y);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
            gl.useProgram(state.program);
            if (state.uniforms.time >= 0) gl.uniform1f(state.uniforms.time, timeRef.current);
            if (state.uniforms.resolution >= 0) gl.uniform2f(state.uniforms.resolution, resolution.x, resolution.y);
            gl.bindVertexArray(state.vao);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            gl.bindVertexArray(0);
            // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
            gl.useProgram(0);
            return true;
        },
        [resolution, compiledCode],
    );

    const handleResize = useCallback((_self: Gtk.GLArea, width: number, height: number) => {
        setResolution({ x: width, y: height });
    }, []);

    const handleRun = useCallback(() => {
        const view = sourceViewRef.current;
        if (!view) return;
        const buffer = view.getBuffer();
        const start = new Gtk.TextIter();
        const end = new Gtk.TextIter();
        buffer.getStartIter(start);
        buffer.getEndIter(end);
        setCompiledCode(buffer.getText(start, end, false));
    }, []);

    const handleClear = useCallback(() => {
        sourceViewRef.current?.getBuffer().setText("", 0);
    }, []);

    const loadPreset = useCallback((code: string) => {
        sourceViewRef.current?.getBuffer().setText(code, -1);
        setCompiledCode(code);
        timeRef.current = 0;
    }, []);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={6}
            marginStart={12}
            marginEnd={12}
            marginTop={12}
            marginBottom={12}
        >
            <GtkAspectFrame xalign={0.5} yalign={0.5} ratio={1.77777} obeyChild={false} hexpand vexpand>
                <GtkGLArea
                    ref={handleGLAreaRef}
                    useEs
                    onRender={handleRender}
                    onResize={handleResize}
                    hexpand
                    vexpand
                />
            </GtkAspectFrame>

            <GtkScrolledWindow minContentHeight={250} hasFrame>
                <GtkSourceView
                    ref={(view: GtkSource.View | null) => {
                        sourceViewRef.current = view;
                        if (view) view.getBuffer().setText(compiledCode, -1);
                    }}
                    showLineNumbers
                    highlightCurrentLine
                    tabWidth={4}
                    leftMargin={20}
                    rightMargin={20}
                    topMargin={20}
                    bottomMargin={20}
                    monospace
                    language="glsl"
                    styleScheme="Adwaita-dark"
                />
            </GtkScrolledWindow>

            <GtkCenterBox>
                <x.Slot for={GtkCenterBox} id="startWidget">
                    <GtkBox spacing={6}>
                        <GtkButton iconName="view-refresh-symbolic" tooltipText="Restart the demo" onClicked={handleRun} />
                        <GtkButton
                            iconName="edit-clear-all-symbolic"
                            tooltipText="Clear the text view"
                            onClicked={handleClear}
                        />
                    </GtkBox>
                </x.Slot>
                <x.Slot for={GtkCenterBox} id="centerWidget">
                    <GtkBox spacing={6}>
                        {SHADER_PRESETS.map((preset) => (
                            <GtkButton key={preset.name} label={preset.name} onClicked={() => loadPreset(preset.code)} />
                        ))}
                    </GtkBox>
                </x.Slot>
            </GtkCenterBox>
        </GtkBox>
    );
};

export const shadertoyDemo: Demo = {
    id: "shadertoy",
    title: "OpenGL/Shadertoy",
    description: "Generate pixels using a custom fragment shader.",
    keywords: ["opengl", "gl", "shader", "glsl", "shadertoy", "fragment", "GtkGLArea"],
    component: ShadertoyDemo,
    sourceCode,
};
