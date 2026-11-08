---
title: "OpenGL"
description: "Use GTKX's OpenGL bindings inside a GtkGLArea."
---

# OpenGL

`@gtkx/gl` provides OpenGL bindings for drawing inside a `GtkGLArea`. `create-gtkx` projects don't include it; install it:

```bash
npm install @gtkx/gl@beta
```

This guide covers GTKX integration. Use the [Khronos OpenGL reference](https://registry.khronos.org/OpenGL-Refpages/gl4/) for the rendering API and the [GTKX GL reference](/v2/reference/@gtkx/gl/) for available bindings.

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

GTK presents the result as part of the surrounding widget tree. Returning `Gdk.EVENT_STOP` marks the render signal as handled. Like every signal handler, `onRender` also receives the area as its last argument (see the [JSX prop model](/v2/guide/jsx-elements#the-jsx-prop-model)).

For complete shader and geometry setup, see the [GLArea, Gears and Shadertoy examples](https://github.com/gtkx-org/gtkx/tree/main/examples/gtk-demo/src/demos/opengl).

## Use the bindings

The bindings are generated from the OpenGL 4.6 core registry. Commands omit the `gl` prefix and start with a lowercase letter; constants omit `GL_`. For example, use `gl.compileShader` and `gl.TRIANGLES`.

Object creation and deletion also have singular helpers: `gl.genBuffer()` returns one name, while `gl.genBuffers(count)` returns an array. Pass typed-array views directly, with their byte length where the command takes a size, as in `gl.bufferData(gl.ARRAY_BUFFER, vertices.byteLength, vertices, gl.STATIC_DRAW)`. `GLint64` and `GLuint64` values are `bigint`.

Pass `null` as the lengths of `shaderSource` to read each source to its end, as `NULL` does in C:

```ts
gl.shaderSource(shader, 1, [source], null);
```

Explicit lengths count UTF-8 bytes, so `[source.length]`, which counts UTF-16 code units, truncates any source with a non-ASCII character, even one in a comment.

Generic state queries such as `getIntegerv` are not exported. Use the typed query for the object you are inspecting, such as `getShaderiv` or `getProgramiv`. `getShaderInfoLog` and `getProgramInfoLog` return the driver's diagnostics as strings.

## Manage context resources

Create GL objects in `onRealize` and delete them in `onUnrealize`, making the area's context current first in both. Realization follows the native widget's lifecycle, so it can happen after the React component mounts. Keep the object names in refs:

```tsx
import * as gl from "@gtkx/gl";
import { GtkGLArea } from "@gtkx/jsx/gtk";
import { useRef } from "react";

export const BufferArea = () => {
    const buffer = useRef<number | null>(null);

    return (
        <GtkGLArea
            hexpand
            vexpand
            onRealize={(area) => {
                area.makeCurrent();
                if (area.getError()) {
                    return;
                }
                buffer.current = gl.genBuffer();
            }}
            onUnrealize={(area) => {
                area.makeCurrent();
                if (buffer.current !== null) {
                    gl.deleteBuffer(buffer.current);
                    buffer.current = null;
                }
            }}
        />
    );
};
```

`onRender` and `onResize` already run with the context current. Call `makeCurrent()` before issuing GL commands from other handlers. GTK sets the viewport when the area resizes; use `onResize` for other size-dependent state, such as a camera's aspect ratio.

Configure the context through JSX before realization. `allowedApis` selects GL or GLES, while `hasDepthBuffer` and `hasStencilBuffer` request framebuffer attachments. Use `area.getApi()` to choose rendering code compatible with the context that was created. A realized area keeps its context: GTK rejects a later `allowedApis` change with a critical, including one made by editing the prop while `gtkx dev` runs. To switch APIs, give the area a React `key` that changes with `allowedApis`, so React replaces it with a new area. See [GTK's GLArea documentation](https://docs.gtk.org/gtk4/class.GLArea.html) for the native lifecycle and context options.

## Request another frame

Changing React state does not itself repaint the GL scene. Obtain the area through its `ref` and call `queueRender()` when the scene needs drawing again.

With the default `autoRender`, GTK emits the render signal whenever the widget draws. With `autoRender={false}`, ordinary redraws reuse the previous frame; resizing the area or calling `queueRender()` requests a new one.

For continuous animation, advance the scene and call `queueRender()` from a [tick callback](https://docs.gtk.org/gtk4/method.Widget.add_tick_callback.html), registered while the area is mounted:

```tsx
import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import type * as Gtk from "@gtkx/gi/gtk";
import * as gl from "@gtkx/gl";
import { GtkGLArea } from "@gtkx/jsx/gtk";
import { useLayoutEffect, useRef, useState } from "react";

export const PulsingArea = () => {
    const [area, setArea] = useState<Gtk.GLArea | null>(null);
    const seconds = useRef(0);

    useLayoutEffect(() => {
        if (area === null) {
            return;
        }
        const id = area.addTickCallback((_widget, clock) => {
            seconds.current = Number(clock.getFrameTime()) / 1_000_000;
            area.queueRender();
            return GLib.SOURCE_CONTINUE;
        });
        return () => area.removeTickCallback(id);
    }, [area]);

    return (
        <GtkGLArea
            ref={setArea}
            hexpand
            vexpand
            onRender={() => {
                const red = 0.5 + 0.5 * Math.sin(seconds.current);
                gl.clearColor(red, 0.5, 0.5, 1);
                gl.clear(gl.COLOR_BUFFER_BIT);
                return Gdk.EVENT_STOP;
            }}
        />
    );
};
```

## Show an error

Pass a `GLib.Error` to `area.setError()` to display an error inside the widget, and pass `null` to clear it after recovery. Context initialization failures are available through `area.getError()`. See [Error Handling](/v2/guide/error-handling) for errors raised by binding calls.
