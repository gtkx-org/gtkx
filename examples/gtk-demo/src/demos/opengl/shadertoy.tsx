import type * as Gdk from "@gtkx/ffi/gdk";
import * as gl from "@gtkx/ffi/gl";
import * as Gtk from "@gtkx/ffi/gtk";
import * as GtkSource from "@gtkx/ffi/gtksource";
import {
    GtkBox,
    GtkButton,
    GtkFrame,
    GtkGLArea,
    GtkLabel,
    GtkPaned,
    GtkScrolledWindow,
    GtkSourceView,
    x,
} from "@gtkx/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const DEFAULT_SHADER = `// Shadertoy-compatible uniforms:
// iTime - elapsed time in seconds
// iResolution - viewport resolution in pixels
// iMouse - mouse position (x,y = current, z,w = click)

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
 vec2 uv = fragCoord / iResolution.xy;

 // Create a simple plasma effect
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

const SHADER_PRESETS: { name: string; code: string }[] = [
    { name: "Plasma", code: DEFAULT_SHADER },
    {
        name: "Tunnel",
        code: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
 vec2 uv = fragCoord / iResolution.xy - 0.5;
 uv.x *= iResolution.x / iResolution.y;

 float a = atan(uv.y, uv.x);
 float r = length(uv);

 float t = iTime;

 vec2 tc = vec2(a / 3.14159, 1.0 / r + t * 0.5);

 float c = mod(floor(tc.x * 8.0) + floor(tc.y * 8.0), 2.0);
 c = mix(0.2, 0.8, c);

 c *= r * 2.0; // Fade towards center

 fragColor = vec4(vec3(c), 1.0);
}`,
    },
    {
        name: "Waves",
        code: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
 vec2 uv = fragCoord / iResolution.xy;

 float wave = 0.0;
 for (int i = 0; i < 5; i++) {
 float fi = float(i);
 wave += sin(uv.x * 10.0 * (fi + 1.0) + iTime * (fi + 1.0) * 0.5) * 0.1;
 wave += sin(uv.y * 8.0 * (fi + 1.0) + iTime * (fi + 1.5) * 0.3) * 0.1;
 }

 float d = abs(uv.y - 0.5 - wave);
 float intensity = smoothstep(0.1, 0.0, d);

 vec3 col = mix(
 vec3(0.1, 0.1, 0.2),
 vec3(0.2, 0.5, 0.9),
 intensity
 );

 fragColor = vec4(col, 1.0);
}`,
    },
    {
        name: "Mandelbrot",
        code: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
 vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

 // Zoom and pan with time
 float zoom = 2.0 + sin(iTime * 0.1) * 1.5;
 vec2 c = uv * zoom + vec2(-0.5, 0.0);

 vec2 z = vec2(0.0);
 float iter = 0.0;
 const float maxIter = 100.0;

 for (float i = 0.0; i < maxIter; i++) {
 z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
 if (dot(z, z)> 4.0) break;
 iter++;
 }

 float t = iter / maxIter;
 vec3 col = vec3(
 0.5 + 0.5 * cos(3.0 + t * 15.0),
 0.5 + 0.5 * cos(3.0 + t * 15.0 + 0.6),
 0.5 + 0.5 * cos(3.0 + t * 15.0 + 1.0)
 );

 if (iter>= maxIter - 1.0) col = vec3(0.0);

 fragColor = vec4(col, 1.0);
}`,
    },
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
    uniforms: {
        time: number;
        resolution: number;
        mouse: number;
    };
}

const initGL = (shaderCode: string): GLState => {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, VERTEX_SHADER);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, wrapShaderCode(shaderCode));
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

    return {
        program,
        vao,
        vbo,
        uniforms: {
            time: gl.getUniformLocation(program, "iTime"),
            resolution: gl.getUniformLocation(program, "iResolution"),
            mouse: gl.getUniformLocation(program, "iMouse"),
        },
    };
};

const ShadertoyDemo = () => {
    const glAreaRef = useRef<Gtk.GLArea | null>(null);
    const glStateRef = useRef<GLState | null>(null);

    const [shaderCode, setShaderCode] = useState(DEFAULT_SHADER);
    const [compiledCode, setCompiledCode] = useState(DEFAULT_SHADER);
    const [compileError, setCompileError] = useState<string | null>(null);
    const [isAnimating, setIsAnimating] = useState(true);
    const [displayTime, setDisplayTime] = useState(0);
    const [resolution, setResolution] = useState({ x: 400, y: 300 });
    const [mouse] = useState({ x: 0, y: 0, z: 0, w: 0 });

    const startTimeRef = useRef(Date.now());
    const timeRef = useRef(0);

    const buffer = useMemo(() => {
        const buf = new GtkSource.Buffer();
        const langManager = GtkSource.LanguageManager.getDefault();
        const language = langManager.getLanguage("glsl");
        if (language) {
            buf.setLanguage(language);
        }
        const schemeManager = GtkSource.StyleSchemeManager.getDefault();
        const scheme = schemeManager.getScheme("Adwaita-dark");
        if (scheme) {
            buf.setStyleScheme(scheme);
        }
        buf.setHighlightSyntax(true);
        buf.setText(shaderCode, -1);
        return buf;
    }, [shaderCode]);

    useEffect(() => {
        if (!isAnimating) return;

        let lastDisplayUpdate = 0;
        const animate = () => {
            const elapsed = (Date.now() - startTimeRef.current) / 1000;
            timeRef.current = elapsed;
            glAreaRef.current?.queueRender();

            if (elapsed - lastDisplayUpdate >= 0.1) {
                lastDisplayUpdate = elapsed;
                setDisplayTime(elapsed);
            }
        };

        const intervalId = setInterval(animate, 16);
        return () => clearInterval(intervalId);
    }, [isAnimating]);

    useEffect(() => {
        glAreaRef.current?.queueRender();
    }, []);

    useEffect(() => {
        const area = glAreaRef.current;
        const state = glStateRef.current;
        if (!area || !state || !area.getRealized()) return;

        area.makeCurrent();

        try {
            const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
            gl.shaderSource(fragmentShader, wrapShaderCode(compiledCode));
            gl.compileShader(fragmentShader);

            const compileStatus = gl.getShaderiv(fragmentShader, gl.COMPILE_STATUS);
            if (compileStatus === 0) {
                setCompileError("Shader compilation failed. Check your GLSL syntax.");
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

            const linkStatus = gl.getProgramiv(program, gl.LINK_STATUS);
            if (linkStatus === 0) {
                setCompileError("Shader linking failed.");
                gl.deleteShader(vertexShader);
                gl.deleteShader(fragmentShader);
                gl.deleteProgram(program);
                return;
            }

            if (state.program) {
                gl.deleteProgram(state.program);
            }

            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);

            state.program = program;
            state.uniforms = {
                time: gl.getUniformLocation(program, "iTime"),
                resolution: gl.getUniformLocation(program, "iResolution"),
                mouse: gl.getUniformLocation(program, "iMouse"),
            };

            setCompileError(null);
        } catch (error) {
            setCompileError(`Error: ${error}`);
        }
    }, [compiledCode]);

    const handleUnrealize = useCallback((_self: Gtk.Widget) => {
        glStateRef.current = null;
    }, []);

    const handleRender = useCallback(
        (self: Gtk.GLArea, _context: Gdk.GLContext) => {
            if (!glStateRef.current) {
                const glError = self.getError();
                if (glError) {
                    setCompileError(`GL context error: ${glError.message}`);
                    return true;
                }

                try {
                    glStateRef.current = initGL(compiledCode);
                } catch (error) {
                    setCompileError(`Initialization error: ${error}`);
                    return true;
                }
            }

            const state = glStateRef.current;

            gl.viewport(0, 0, resolution.x, resolution.y);

            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);

            // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
            gl.useProgram(state.program);

            if (state.uniforms.time >= 0) {
                gl.uniform1f(state.uniforms.time, timeRef.current);
            }
            if (state.uniforms.resolution >= 0) {
                gl.uniform2f(state.uniforms.resolution, resolution.x, resolution.y);
            }
            if (state.uniforms.mouse >= 0) {
                gl.uniform2f(state.uniforms.mouse, mouse.x, mouse.y);
            }

            gl.bindVertexArray(state.vao);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            gl.bindVertexArray(0);

            // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
            gl.useProgram(0);

            return true;
        },
        [resolution, mouse, compiledCode],
    );

    const handleResize = useCallback((_self: Gtk.GLArea, width: number, height: number) => {
        setResolution({ x: width, y: height });
        gl.viewport(0, 0, width, height);
    }, []);

    const handleCompile = useCallback(() => {
        const start = new Gtk.TextIter();
        const end = new Gtk.TextIter();
        buffer.getStartIter(start);
        buffer.getEndIter(end);
        const text = buffer.getText(start, end, false);
        setShaderCode(text);
        setCompiledCode(text);
    }, [buffer]);

    const loadPreset = useCallback(
        (preset: (typeof SHADER_PRESETS)[0]) => {
            buffer.setText(preset.code, -1);
            setShaderCode(preset.code);
            setCompiledCode(preset.code);
            startTimeRef.current = Date.now();
            timeRef.current = 0;
            setDisplayTime(0);
        },
        [buffer],
    );

    const handleReset = useCallback(() => {
        startTimeRef.current = Date.now();
        timeRef.current = 0;
        setDisplayTime(0);
    }, []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Shadertoy" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="A GLSL shader playground inspired by Shadertoy. Write fragment shaders using Shadertoy-compatible uniforms (iTime, iResolution, iMouse) and see them render in real-time."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Shader Playground">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={8}>
                        <GtkLabel label="Presets:" cssClasses={["dim-label"]} />
                        {SHADER_PRESETS.map((preset) => (
                            <GtkButton
                                key={preset.name}
                                label={preset.name}
                                onClicked={() => loadPreset(preset)}
                                cssClasses={["flat"]}
                            />
                        ))}
                    </GtkBox>

                    <GtkPaned shrinkStartChild={false} shrinkEndChild={false}>
                        <x.Slot for={GtkPaned} id="startChild">
                            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} widthRequest={400}>
                                <GtkScrolledWindow vexpand hexpand heightRequest={300}>
                                    <GtkSourceView
                                        buffer={buffer}
                                        showLineNumbers
                                        highlightCurrentLine
                                        tabWidth={4}
                                        leftMargin={8}
                                        rightMargin={8}
                                        topMargin={8}
                                        bottomMargin={8}
                                        monospace
                                    />
                                </GtkScrolledWindow>

                                {compileError && (
                                    <GtkLabel
                                        label={compileError}
                                        cssClasses={["error"]}
                                        halign={Gtk.Align.START}
                                        wrap
                                    />
                                )}

                                <GtkBox spacing={8}>
                                    <GtkButton
                                        label="Compile"
                                        onClicked={handleCompile}
                                        cssClasses={["suggested-action"]}
                                    />
                                    <GtkButton
                                        label={isAnimating ? "Pause" : "Play"}
                                        onClicked={() => setIsAnimating(!isAnimating)}
                                    />
                                    <GtkButton label="Reset Time" onClicked={handleReset} />
                                </GtkBox>
                            </GtkBox>
                        </x.Slot>

                        <x.Slot for={GtkPaned} id="endChild">
                            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} hexpand>
                                <GtkGLArea
                                    ref={glAreaRef}
                                    useEs
                                    onUnrealize={handleUnrealize}
                                    onRender={handleRender}
                                    onResize={handleResize}
                                    hexpand
                                    vexpand
                                    widthRequest={400}
                                    heightRequest={300}
                                    cssClasses={["card"]}
                                />
                                <GtkLabel
                                    label={`Time: ${displayTime.toFixed(2)}s | Resolution: ${resolution.x}x${resolution.y}`}
                                    cssClasses={["dim-label", "caption"]}
                                    halign={Gtk.Align.CENTER}
                                    widthChars={40}
                                />
                            </GtkBox>
                        </x.Slot>
                    </GtkPaned>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Available Uniforms">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label={`float iTime - Elapsed time in seconds
vec2 iResolution - Viewport resolution in pixels
vec4 iMouse - Mouse position (x,y = current, z,w = click)

Define your shader in a mainImage function:
void mainImage(out vec4 fragColor, in vec2 fragCoord)`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const shadertoyDemo: Demo = {
    id: "shadertoy",
    title: "OpenGL/Shadertoy",
    description: "GLSL shader playground with live editing",
    keywords: ["opengl", "gl", "shader", "glsl", "shadertoy", "fragment", "live", "editor", "creative"],
    component: ShadertoyDemo,
    sourceCode,
};
