---
title: "OpenGL"
description: "Draw with OpenGL in a GTKX app using @gtkx/gl: generated OpenGL 4.6 core bindings, override helpers, and the GtkGLArea realize, resize, render, and unrealize flow."
---

# OpenGL

`@gtkx/gl` draws OpenGL from TypeScript against a `Gtk.GLArea` that mounts like any other widget. It installs separately:

```bash
npm install @gtkx/gl
```

## What the package contains

The OpenGL 4.6 core profile, behind one namespaced import:

```ts
import * as gl from "@gtkx/gl";
```

Commands drop the `gl` prefix and lowercase the first letter (`glCompileShader` becomes `compileShader`); enums drop `GL_` and keep their case (`GL_TRIANGLES` becomes `TRIANGLES`).

The generic state queries (`getIntegerv` and its siblings) are not exported: use the typed getters `getShaderiv`, `getProgramiv`, and `getBufferParameteriv`.

Every object family has a singular helper next to the plural one: `genBuffer()` returns one name where `genBuffers(n)` returns an array, and `deleteBuffer(name)` deletes one.

`getShaderInfoLog` and `getProgramInfoLog` return the driver's diagnostics as a string. The [@gtkx/gl reference](/reference/@gtkx/gl/) lists every command, enum, and type, including the `debugMessageCallback` and `clientWaitSyncLoop` overrides.

## The GtkGLArea signal flow

`GtkGLArea` is the element you draw into. GTK4 gives it a `Gdk.GLContext` and a framebuffer, then emits these signals:

- `onRealize` fires when the area gets its context: compile shaders and upload geometry.
- `onResize` receives the framebuffer width and height: set `viewport`.
- `onRender` receives the `Gdk.GLContext`, draws, and returns `true` to stop the signal.
- `onUnrealize` fires when the area loses its context: delete every GL object created.

Like every JSX `on*` prop, these handlers receive the area that emitted the signal as their final argument.

`onRender` and `onResize` already run with the context current. Everywhere else, including `onRealize`, `onUnrealize`, and a handler that recompiles a shader, call `area.makeCurrent()` first. Skipping it fails silently or corrupts another context. In `onRealize`, stop when `area.getError()` reports a context that failed to initialize.

Realization follows when the widget is shown, not when the component mounts, so props that configure the context apply before realize: `allowedApis` restricts which APIs may be chosen, so `allowedApis={Gdk.GLAPI.GLES}` asks for an OpenGL ES context, and `hasDepthBuffer` and `hasStencilBuffer` add those attachments to the framebuffer. `area.getApi()` reports which API was granted.

## A simple example

Compiling a shader uses the naming rules, a typed getter, and an info log override at once:

```ts
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

Geometry uploads pass the byte length next to the typed-array view:

```ts
const createVertexBuffer = (data: number[]): { vao: number; vbo: number } => {
    const vao = gl.genVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.genBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const view = new Float32Array(data);
    gl.bufferData(gl.ARRAY_BUFFER, view.byteLength, view, gl.STATIC_DRAW);

    return { vao, vbo };
};
```

`initGL` picks the GL or the GLES shader sources from the API it is handed, compiles both, and links them into a program. It then calls `createVertexBuffer`, declares the attribute layout with `vertexAttribPointer` and `enableVertexAttribArray`, and reads the uniform with `gl.getUniformLocation(program, "mvp")`.

The component keeps the area and the GL state in refs:

```tsx
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import * as gl from "@gtkx/gl";
import { GtkGLArea } from "@gtkx/jsx/gtk";
import { useRef, useState } from "react";

type GLState = { program: number; vao: number; vbo: number; mvpLocation: number };

const GLAreaDemo = () => {
    const glAreaRef = useRef<Gtk.GLArea | null>(null);
    const glStateRef = useRef<GLState | null>(null);
    const [rotationX, setRotationX] = useState(0);

    const handleRealize = (area: Gtk.GLArea) => {
        area.makeCurrent();
        if (area.getError()) return;
        glStateRef.current = initGL(area.getApi());
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

    const handleRender = () => {
        const state = glStateRef.current;
        if (!state) return Gdk.EVENT_STOP;
        gl.clearColor(0.5, 0.5, 0.5, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(state.program);
        gl.uniformMatrix4fv(state.mvpLocation, 1, false, createRotationMatrix(rotationX, 0, 0));
        gl.bindVertexArray(state.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
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

The GLSL sources, `initGL`, and `createRotationMatrix`, along with the Gears demo and a Shadertoy player, live in `examples/gtk-demo/src/demos/opengl`.

## The context and React state

GL object names belong in refs, not state. A re-render does not repaint the area; `area.queueRender()` does, so a control that changes the scene sets its state and queues a render:

```ts
const handleAxisChanged = (value: number) => {
    setRotationX((value * Math.PI) / 180);
    glAreaRef.current?.queueRender();
};
```

`autoRender` is on by default, so the render signal is emitted every time the widget draws. `autoRender={false}` preserves the previous frame until `queueRender()` is called.

Continuous animation runs off a tick callback registered with `Gtk.Widget.addTickCallback` that calls `queueRender()`, not off React state.

`area.setError()` makes the widget render an error state of its own instead of drawing:

```ts
import * as GLib from "@gtkx/gi/glib";

const SHADER_ERROR = GLib.quarkFromString("my-app-shader-error-quark");

area.setError(GLib.Error.newLiteral(SHADER_ERROR, 0, `Fragment shader compile error:\n${log}`));
```

`GLib.Error.newLiteral(domain, code, message)` builds a GError, and `GLib.quarkFromString` registers (or looks up) a quark for an error domain of your own: pick a unique, descriptive string, conventionally ending in `-quark`. Pass `null` to `setError` to clear it once the shader compiles.

[Error Handling](/guide/error-handling) covers matching the GErrors bindings throw.

## Next

Continue with [Testing](/guide/testing) to see how the reconciler renders and asserts on widgets.
