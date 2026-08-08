---
title: "OpenGL"
description: "Draw with OpenGL in a GTKX app using @gtkx/gl: generated OpenGL 4.6 core bindings, override helpers, and the GtkGLArea realize, resize, render, and unrealize flow."
---

# OpenGL

`@gtkx/gl` lets you draw with OpenGL from TypeScript inside a GTKX app: compile shaders, upload buffers, and issue draw calls against a `Gtk.GLArea` that the reconciler mounts like any other widget. This page covers what the package contains, how a GL area's signals sequence your setup and drawing, and how the GL context relates to React.

It is a separate install:

```bash
npm install @gtkx/gl@rc
```

## What the package contains

Most of `@gtkx/gl` is generated. Codegen reads Khronos's `gl.xml` registry, the same specification the C headers come from, and emits the OpenGL 4.6 core profile. Commands whose C shape the registry does not pin down are left out, which is why the generic state queries (`getIntegerv` and its siblings, whose output length depends on the token you pass) are not there: reach for the typed getters instead, such as `getShaderiv`, `getProgramiv`, and `getBufferParameteriv`. Every command is a plain function bound to `libGL.so.1` through the FFI in `@gtkx/runtime`, and every enum is an exported constant.

Commands drop the `gl` prefix and lowercase the first letter, so `glCompileShader` is `compileShader` and `glDrawArrays` is `drawArrays`. Enums drop `GL_` and keep their case, so `GL_TRIANGLES` is `TRIANGLES`. Enum groups become named TypeScript aliases, so `createShader` is declared as taking a `ShaderType` rather than a bare number. The aliases are documentation: they resolve to `GLenum`, so they name the expected family without constraining the value.

Codegen also derives singular helpers for the object creation and deletion pairs, because asking for exactly one object is the common case. `genBuffer()` returns a single name where `genBuffers(n)` returns an array, and `deleteBuffer(name)` deletes one. Vertex arrays, queries, and the other object families work the same way.

The rest of the module is hand-written overrides for calls the registry cannot describe on its own:

- `getShaderInfoLog`, `getProgramInfoLog`, and `getProgramPipelineInfoLog` return the driver's diagnostics as a string, doing the length query and the output buffer for you.
- `debugMessageCallback(callback)` installs a handler for driver debug messages and enables `DEBUG_OUTPUT` and `DEBUG_OUTPUT_SYNCHRONOUS`. Pass `null` to remove it.
- `clientWaitSyncLoop(sync, flags, timeoutNs)` waits on a fence in bounded chunks, so a long timeout is not truncated by the driver's per-call limit.

Both halves come out of one entry point, and namespacing the import keeps the calls reading like the C API:

```ts
import * as gl from "@gtkx/gl";
```

Every command, enum, and type is listed in the [@gtkx/gl reference](/reference/@gtkx/gl/).

## The GtkGLArea signal flow

`GtkGLArea` is the intrinsic element you draw into. GTK4 creates a `Gdk.GLContext` for it, gives it a framebuffer, and emits the signals that sequence everything you do:

- `onRealize` hands you the area when the widget receives its context. Compile shaders and upload geometry here, after calling `area.makeCurrent()`: GTK4 does not make the context current for you in this signal.
- `onResize` fires with the framebuffer width and height before rendering, which is where `viewport` belongs.
- `onRender` receives the `Gdk.GLContext`, runs with that context current and the framebuffer bound, and returns `true` to stop the signal.
- `onUnrealize` hands you the area when it loses its context. Delete every GL object you created, again after `area.makeCurrent()`.

Like every JSX `on*` prop, these handlers receive the area that emitted the signal as their final argument, so a handler that only needs the widget it fired on can take it from the parameter list instead of a ref.

Realize and unrealize come from `Gtk.Widget`, so they track the widget's lifetime rather than the component's. React mounts your component first, and realization follows when the widget's window is shown.

Several props shape the context before it exists. `useEs` asks for an OpenGL ES context, `allowedApis` restricts which APIs may be chosen, and `hasDepthBuffer` and `hasStencilBuffer` add those attachments to the framebuffer. Once the area is realized, `area.getApi()` tells you what you actually got.

## A simple example

This is the gtk-demo OpenGL Area demo, which draws one shaded triangle. Compiling a shader shows the generated commands and the info log override together:

```ts
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import * as gl from "@gtkx/gl";
import { GtkGLArea } from "@gtkx/jsx/gtk";
import { useRef, useState } from "react";

const compileShader = (type: number, source: string, name: string): number => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, 1, [source], [-1]);
    gl.compileShader(shader);
    if (!gl.getShaderiv(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`${name} shader compilation failed: ${log}`);
    }
    return shader;
};
```

Linking is the same shape, with `getProgramInfoLog` reporting what went wrong:

```ts
const linkProgram = (vertexShader: number, fragmentShader: number): number => {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.bindAttribLocation(program, 0, "in_position");
    gl.bindAttribLocation(program, 1, "in_color");
    gl.linkProgram(program);
    if (!gl.getProgramiv(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        throw new Error(`Shader program linking failed: ${log}`);
    }
    return program;
};
```

`initGL` calls both, then creates the vertex array and buffer the draw call needs. The GLSL sources, the interleaved `VERTEX_DATA`, and `createRotationMatrix` live in `examples/gtk-demo/src/demos/opengl/glarea.tsx`. Buffer uploads take the byte length next to the view, since the binding passes both to the driver:

```ts
interface GLState {
    program: number;
    vao: number;
    vbo: number;
    mvpLocation: number;
}

const initGL = (api: Gdk.GLAPI): GLState => {
    const isGles = api === Gdk.GLAPI.GLES;
    const vertexShader = compileShader(gl.VERTEX_SHADER, isGles ? VERTEX_SHADER_GLES : VERTEX_SHADER_GL, "Vertex");
    const fragmentShader = compileShader(
        gl.FRAGMENT_SHADER,
        isGles ? FRAGMENT_SHADER_GLES : FRAGMENT_SHADER_GL,
        "Fragment",
    );
    const program = linkProgram(vertexShader, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    const vao = gl.genVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.genBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const view = new Float32Array(VERTEX_DATA);
    gl.bufferData(gl.ARRAY_BUFFER, view.byteLength, view, gl.STATIC_DRAW);

    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 8 * 4, 0);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 8 * 4, 4 * 4);
    gl.enableVertexAttribArray(1);

    const mvpLocation = gl.getUniformLocation(program, "mvp");
    gl.bindVertexArray(0);

    return { program, vao, vbo, mvpLocation };
};
```

The component holds the area and the GL state in refs, and hangs the handlers off the element:

```tsx
const GLAreaDemo = () => {
    const glAreaRef = useRef<Gtk.GLArea | null>(null);
    const glStateRef = useRef<GLState | null>(null);
    const [rotationX, setRotationX] = useState(0);

    const handleRealize = (area: Gtk.GLArea) => {
        area.makeCurrent();
        if (area.getError()) return;
        try {
            glStateRef.current = initGL(area.getApi());
        } catch (e) {
            if (e instanceof Error) console.error(e.message);
            glStateRef.current = null;
        }
    };

    const handleUnrealize = (area: Gtk.GLArea) => {
        area.makeCurrent();
        const state = glStateRef.current;
        if (!state) return;
        gl.deleteBuffer(state.vbo);
        gl.deleteVertexArray(state.vao);
        gl.deleteProgram(state.program);
        glStateRef.current = null;
    };

    const handleRender = (_context: Gdk.GLContext) => {
        const state = glStateRef.current;
        if (!state) return Gdk.EVENT_STOP;

        gl.clearColor(0.5, 0.5, 0.5, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(state.program);
        gl.uniformMatrix4fv(state.mvpLocation, 1, false, createRotationMatrix(rotationX, 0, 0));
        gl.bindVertexArray(state.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(0);
        gl.useProgram(0);
        gl.flush();
        return Gdk.EVENT_STOP;
    };

    return (
        <GtkGLArea
            ref={glAreaRef}
            hexpand
            vexpand
            onRealize={handleRealize}
            onUnrealize={handleUnrealize}
            onRender={handleRender}
            onResize={(width, height) => gl.viewport(0, 0, width, height)}
        />
    );
};
```

`area.getError()` in `handleRealize` reports a context that failed to initialize, in which case there is nothing to set up. The full demo, along with the classic Gears demo and a Shadertoy player, lives in `examples/gtk-demo/src/demos/opengl`.

## The context, the reconciler, and React state

The reconciler treats `GtkGLArea` as an ordinary intrinsic element. It creates the widget, applies props, connects your handlers, and destroys the widget on unmount. It never touches the GL context, which GTK4 creates at realize and drops at unrealize.

Every `gl` call is a direct FFI call into `libGL.so.1` on the one thread your components run on, and it acts on whichever context is current. `onRender` and `onResize` run with the area's context already current. Anywhere else, including `onRealize`, `onUnrealize`, and a handler that recompiles a shader, call `area.makeCurrent()` first.

GL object names are not rendering data, so keep them in refs and out of state. A re-render does not repaint the area: nothing about a React update reaches the framebuffer. What repaints is `area.queueRender()`, so a control that changes the scene sets its state and queues a render:

```ts
const handleAxisChanged = (value: number) => {
    setRotationX((value * Math.PI) / 180);
    glAreaRef.current?.queueRender();
};
```

With `autoRender` (the default), the render signal is emitted every time the widget draws. Setting `autoRender={false}` keeps the previous frame's contents until you call `queueRender()`, which suits a scene that changes seldom and costs a lot to draw.

For continuous animation, drive frames from the frame clock rather than from React. The Gears demo registers a tick callback on the area with `Gtk.Widget.addTickCallback`, advances its rotation in a ref on each tick, and calls `queueRender()`. The frame loop stays entirely in refs: it samples the measured frame rate into one, and a separate interval publishes that value to a label.

## Reporting failures to the widget

`Gtk.GLArea` renders an error state of its own when you hand it a GError, which is how the Shadertoy demo surfaces a GLSL compile failure instead of drawing:

```ts
const SHADER_ERROR = GLib.quarkFromString("my-app-shader-error-quark");

area.setError(GLib.Error.newLiteral(SHADER_ERROR, 0, `Fragment shader compile error:\n${log}`));
```

`GLib.Error.newLiteral(domain, code, message)` builds a GError, and `GLib.quarkFromString` registers (or looks up) a quark for your own error domain: pick a unique, descriptive string, conventionally ending in `-quark`. Pass `null` to `setError` to clear it once the shader compiles. [Error Handling](/guide/error-handling) covers matching the GErrors that bindings throw at you.

## Next

Continue with [Testing](/guide/testing) to see how the reconciler renders and asserts on widgets.
