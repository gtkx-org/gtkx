---
title: "OpenGL"
description: "Use GTKX's OpenGL bindings inside a GtkGLArea."
---

# OpenGL

`@gtkx/gl` provides OpenGL bindings for drawing inside a `GtkGLArea`. Install it alongside your application:

```bash
npm install @gtkx/gl@1.6.0
```

This guide covers GTKX integration. Use the [Khronos OpenGL reference](https://registry.khronos.org/OpenGL-Refpages/gl4/) for the rendering API and the [GTKX GL reference](/reference/@gtkx/gl/) for available bindings.

## Draw in a widget

Place a `GtkGLArea` inside your application's JSX tree. Its `onRender` handler runs with the area's GL context and framebuffer ready for drawing:

```tsx
import * as Gdk from "@gtkx/gi/gdk";
import * as gl from "@gtkx/gl";
import { GtkGLArea } from "@gtkx/jsx/gtk";

export const ColorArea = () => (
    <GtkGLArea
        hexpand
        vexpand
        onRender={() => {
            gl.clearColor(0.5, 0.5, 0.5, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            return Gdk.EVENT_STOP;
        }}
    />
);
```

GTK presents the result as part of the surrounding widget tree. Returning `Gdk.EVENT_STOP` marks the render signal as handled. As with other GTKX signals, handlers can receive the emitting area as their final argument.

For complete shader and geometry setup, see the [GLArea, Gears and Shadertoy examples](https://github.com/gtkx-org/gtkx/tree/v1.6.0/examples/gtk-demo/src/demos/opengl).

## Use the bindings

The bindings are generated from the OpenGL 4.6 core registry. Commands omit the `gl` prefix and start with a lowercase letter; constants omit `GL_`. For example, use `gl.compileShader` and `gl.TRIANGLES`.

Object creation and deletion also have singular helpers: `gl.genBuffer()` returns one name, while `gl.genBuffers(count)` returns an array. Pass typed-array views directly for geometry uploads, alongside the byte length required by the command.

Generic state queries such as `getIntegerv` are not exported. Use the available typed queries for the object you are inspecting, such as `getShaderiv` or `getProgramiv`. Shader and program info-log helpers return the driver's diagnostics as strings.

## Manage context resources

Create shaders and buffers in `onRealize`, after calling `area.makeCurrent()` and checking `area.getError()`. Realization follows the native widget's lifecycle, so it can happen after the React component mounts. Keep GL object names in refs and delete those resources in `onUnrealize`, making the area's context current first.

`onRender` and `onResize` already run with the context current. Call `makeCurrent()` before issuing GL commands from other handlers. GTK sets the viewport when the area resizes; use `onResize` for other size-dependent state, such as a camera's aspect ratio.

Configure the context through JSX before realization. `allowedApis` selects GL or GLES, while `hasDepthBuffer` and `hasStencilBuffer` request framebuffer attachments. Use `area.getApi()` to choose rendering code compatible with the context that was created. See [GTK's GLArea documentation](https://docs.gtk.org/gtk4/class.GLArea.html) for the native lifecycle and context options.

## Request another frame

Changing React state does not itself repaint the GL scene. Obtain the area through its `ref` and call `queueRender()` when the scene needs drawing again.

With the default `autoRender`, GTK emits the render signal whenever the widget draws. With `autoRender={false}`, ordinary redraws reuse the previous frame; resizing the area or calling `queueRender()` requests a new one.

For continuous animation, use a GTK tick callback to advance the scene and call `queueRender()`. Tie its registration and removal to the mounted area's lifetime.

## Show an error

Pass a `GLib.Error` to `area.setError()` to display an error inside the widget, and pass `null` to clear it after recovery. Context initialization failures are available through `area.getError()`. See [Error Handling](/guide/error-handling) for errors raised by binding calls.

## Next

Continue with [Testing](/guide/testing) for native widget queries and interaction tests.
