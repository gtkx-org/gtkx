---
title: "OpenGL"
description: "Render OpenGL content in a GtkGLArea."
---

# OpenGL

`@gtkx/gl` exposes the OpenGL 4.6 core profile to a `Gtk.GLArea`.

```bash
npm install @gtkx/gl
```

```ts
import * as gl from "@gtkx/gl";
```

Commands omit the `gl` prefix (`glCompileShader` becomes `compileShader`) and enums omit `GL_` (`GL_TRIANGLES` becomes `TRIANGLES`). Prefer typed queries such as `getShaderiv` and singular helpers such as `genBuffer`. The [GL reference](/reference/@gtkx/gl/) is the command and enum catalog.

## Follow the GtkGLArea lifecycle

- `onRealize`: call `makeCurrent()`, stop if `getError()` is set, then create programs and buffers.
- `onResize`: update the viewport; the context is already current.
- `onRender`: draw and return `Gdk.EVENT_STOP`; the context is already current.
- `onUnrealize`: call `makeCurrent()` and delete every GL object you created.

```tsx
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import * as gl from "@gtkx/gl";
import { GtkGLArea } from "@gtkx/jsx/gtk";
import { useRef } from "react";

const GLView = () => {
    const program = useRef<number | null>(null);

    return (
        <GtkGLArea
            hexpand
            vexpand
            onRealize={(area) => {
                area.makeCurrent();
                if (!area.getError()) program.current = gl.createProgram();
            }}
            onResize={(width, height) => gl.viewport(0, 0, width, height)}
            onRender={() => {
                gl.clear(gl.COLOR_BUFFER_BIT);
                return Gdk.EVENT_STOP;
            }}
            onUnrealize={(area: Gtk.GLArea) => {
                area.makeCurrent();
                if (program.current !== null) gl.deleteProgram(program.current);
                program.current = null;
            }}
        />
    );
};
```

Keep GL object names in refs. A React rerender does not redraw the framebuffer; call `queueRender()`. With `autoRender={false}`, the previous frame remains until requested. Continuous animation should use a widget tick callback that queues renders rather than React state on every frame.

Context options such as `allowedApis`, `hasDepthBuffer`, and `hasStencilBuffer` must be set before realization. Report initialization or shader failures with `area.setError(...)`; clear the state with `null` after recovery. Complete examples live in `examples/gtk-demo/src/demos/opengl`.
