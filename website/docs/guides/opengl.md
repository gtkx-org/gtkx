# OpenGL

GTKX renders OpenGL content through `GtkGLArea`, and the `@gtkx/gl` package provides the commands to draw with.

## What @gtkx/gl covers

`@gtkx/gl` is GTKX's own OpenGL binding. GL ships no GObject Introspection data, so the package exists outside the GIR codegen that produces `@gtkx/gi`: its surface covers the OpenGL 4.6 core profile, generated from the Khronos registry, with names mirroring the C API minus the `gl`/`GL_` prefixes — `glClearColor` becomes `clearColor`, `GL_COLOR_BUFFER_BIT` becomes `COLOR_BUFFER_BIT`. Symbols resolve from the system GL library (`libGL.so.1`), and every call runs against whatever `GdkGLContext` is current. Context creation, version negotiation, and `makeCurrent` belong to GTK, so there is no GLX or EGL plumbing to manage.

```tsx
import * as gl from "@gtkx/gl";

gl.clearColor(0, 0, 0, 1);
gl.clear(gl.COLOR_BUFFER_BIT);
```

A few conveniences smooth the C shapes: singular `genBuffer()` / `deleteBuffer(name)` alongside the plural C commands, out-parameters returned as values (`getShaderiv(shader, gl.COMPILE_STATUS)` returns the status), string-returning `getShaderInfoLog` / `getProgramInfoLog`, and zero-copy typed-array transfer for buffer and pixel data.

## Setting up a GtkGLArea

A `GtkGLArea` drives your GL code through four signals:

- `onRealize` — the context exists now. Call `makeCurrent()` on the area, check `getError()`, then create shaders, buffers, and vertex arrays.
- `onRender` — GTK has the context current and the framebuffer bound. Issue draw calls and return `true`.
- `onResize` — update the viewport with the new size.
- `onUnrealize` — make the context current again and delete your GL resources.

The realize handler reaches the area through a ref, makes the context current, and bails out if context creation failed:

```tsx
const handleRealize = () => {
    const area = areaRef.current;
    if (!area) return;
    area.makeCurrent();
    if (area.getError()) return;
    sceneRef.current = initScene();
};
```

```tsx
<GtkGLArea
    ref={areaRef}
    hexpand
    vexpand
    onRealize={handleRealize}
    onUnrealize={handleUnrealize}
    onRender={handleRender}
    onResize={handleResize}
/>
```

Pass `useEs` to request an OpenGL ES context and `hasDepthBuffer` when your scene needs a depth attachment, as the gears demo does.

::: warning GL calls need a current context
`@gtkx/gl` issues commands against whatever context is current. Keep GL work inside the `realize`, `render`, `resize`, and `unrealize` handlers — GTK guarantees the area's context is current there — or call `makeCurrent()` on the area first.
:::

## A minimal example

A complete component that draws one red triangle:

```tsx
import type * as Gtk from "@gtkx/gi/gtk";
import * as gl from "@gtkx/gl";
import { GtkGLArea } from "@gtkx/jsx/gtk";
import { useRef } from "react";

const VERTEX_SHADER = `#version 300 es
precision mediump float;
in vec3 aPos;
void main() { gl_Position = vec4(aPos, 1.0); }`;

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;
out vec4 FragColor;
void main() { FragColor = vec4(1.0, 0.0, 0.0, 1.0); }`;

const TRIANGLE = new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]);

interface SceneState {
    program: number;
    vao: number;
    vbo: number;
}

const compileShader = (type: number, source: string): number => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, 1, [source], [-1]);
    gl.compileShader(shader);
    if (!gl.getShaderiv(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
};

const initScene = (): SceneState => {
    const vertexShader = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

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
    gl.bufferData(gl.ARRAY_BUFFER, TRIANGLE.byteLength, TRIANGLE, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    gl.bindVertexArray(0);

    return { program, vao, vbo };
};

export const Triangle = () => {
    const areaRef = useRef<Gtk.GLArea | null>(null);
    const sceneRef = useRef<SceneState | null>(null);

    const handleRealize = () => {
        const area = areaRef.current;
        if (!area) return;
        area.makeCurrent();
        if (area.getError()) return;
        sceneRef.current = initScene();
    };

    const handleUnrealize = () => {
        const scene = sceneRef.current;
        areaRef.current?.makeCurrent();
        if (scene) {
            gl.deleteBuffer(scene.vbo);
            gl.deleteVertexArray(scene.vao);
            gl.deleteProgram(scene.program);
            sceneRef.current = null;
        }
    };

    const handleRender = () => {
        const scene = sceneRef.current;
        if (!scene) return true;
        gl.clearColor(0.2, 0.2, 0.2, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(scene.program);
        gl.bindVertexArray(scene.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(0);
        gl.useProgram(0);
        return true;
    };

    const handleResize = (width: number, height: number) => gl.viewport(0, 0, width, height);

    return (
        <GtkGLArea
            ref={areaRef}
            hexpand
            vexpand
            onRealize={handleRealize}
            onUnrealize={handleUnrealize}
            onRender={handleRender}
            onResize={handleResize}
        />
    );
};
```

## The render loop

A `GtkGLArea` repaints only when asked. For event-driven scenes, call `queueRender()` on the area whenever the inputs change — the glarea demo does this from its rotation sliders:

```tsx
const handleValueChanged = (value: number) => {
    setRotation((value * Math.PI) / 180);
    areaRef.current?.queueRender();
};
```

For continuous animation, register a frame-clock tick with `useTickCallback` from `@gtkx/react`. The callback fires once per frame; store the animation state in a ref, queue a render, and return `true` to keep ticking:

```tsx
import { useTickCallback } from "@gtkx/react";

const angleRef = useRef(0);

useTickCallback(areaRef, (_widget, frameClock) => {
    angleRef.current = ((frameClock.getFrameTime() / 1_000_000) * 70) % 360;
    areaRef.current?.queueRender();
    return true;
});
```

The render handler then reads `angleRef.current` when building its matrices. The gears and shadertoy demos both animate this way.

## Differences from WebGL

The surface is registry-faithful C, not the WebGL object model:

- **No context object.** Commands are plain imported functions that target the current `GdkGLContext`; there is no `canvas.getContext("webgl2")` equivalent.
- **Object names are numbers.** `createShader`, `createProgram`, and `genBuffer` return `GLuint` values, not opaque `WebGLShader` / `WebGLBuffer` objects.
- **Signatures follow the C registry.** `shaderSource(shader, 1, [source], [-1])` takes a count, a string array, and a lengths array (`-1` marks a NUL-terminated entry); `bufferData(target, byteLength, view, usage)` takes an explicit byte size; `uniformMatrix4fv(location, count, transpose, value)` takes an explicit matrix count.
- **Out-parameters become return values.** `getShaderiv(shader, gl.COMPILE_STATUS)` returns a `GLint` (`gl.TRUE` / `gl.FALSE`) instead of WebGL's boolean `getShaderParameter`; `genBuffers(3)` returns an array of fresh names.
- **`getUniformLocation` returns `-1`** for a missing uniform, never `null`.
- **Info logs come from companion helpers.** `getShaderInfoLog` and `getProgramInfoLog` hide the C API's two-call length dance and return `""` when the log is empty.
- **Debug output and fences have safe wrappers.** `debugMessageCallback(callback)` forces synchronous delivery so the handler runs inside the GL call that produced the message; `clientWaitSyncLoop(sync, flags, timeoutNs)` stands in for `GL_TIMEOUT_IGNORED`, whose value exceeds JavaScript's safe integer range.
- **Typed arrays cross zero-copy in both directions** — uploads through `bufferData`, write-backs through `readPixels` and `getBufferSubData`. Data parameters accept an `ArrayBufferView`, a byte offset into the bound pixel/parameter buffer, or `null`; the `pointer`/`indices`/`indirect` parameters of the vertex-attribute and draw families are byte offsets into the bound buffer object and are typed as plain numbers, never views.

## What is excluded

A small set of commands has no generated form: state-vector queries whose output size depends on the queried name (`getIntegerv`, `getFloatv`, `getTexParameteriv`, …), `glDebugMessageCallback`'s raw form (covered by the companion wrapper), and `glMapBufferRange` memory access (use `bufferSubData`/`getBufferSubData`). Object-scoped single-valued queries (`getShaderiv`, `getProgramiv`, `getBufferParameteriv`, and family) are generated.

## Full demos

The gtk-demo example ships three complete OpenGL programs:

- [OpenGL Area](https://github.com/gtkx-org/gtkx/blob/main/examples/gtk-demo/src/demos/opengl/glarea.tsx) — the canonical realize/render/resize/unrealize flow, drawing a rotating triangle controlled by sliders.
- [Gears](https://github.com/gtkx-org/gtkx/blob/main/examples/gtk-demo/src/demos/opengl/gears.tsx) — the classic gears scene with a depth buffer, a tick-driven animation loop, and an FPS readout from the frame clock.
- [Shadertoy](https://github.com/gtkx-org/gtkx/blob/main/examples/gtk-demo/src/demos/opengl/shadertoy.tsx) — a live GLSL editor that recompiles Shadertoy-compatible fragment shaders and feeds them mouse input through a drag gesture.
