# OpenGL

The `@gtkx/gl` package provides OpenGL 4.6 core profile bindings for rendering inside a `GtkGLArea`. The surface is generated from the Khronos OpenGL XML registry, so command names, parameters, and constants mirror the C API with the `gl`/`GL_` prefixes stripped: `glClearColor` becomes `clearColor`, `GL_COLOR_BUFFER_BIT` becomes `COLOR_BUFFER_BIT`.

```tsx
import * as gl from "@gtkx/gl";

gl.clearColor(0, 0, 0, 1);
gl.clear(gl.COLOR_BUFFER_BIT);
```

## Contexts and where GL calls belong

`GdkGLContext` owns context creation and negotiation; `@gtkx/gl` only issues commands against whatever context is current. Make GL calls inside a `GtkGLArea`'s `realize`, `render`, or `resize` handlers — GTK guarantees the area's context is current there — or immediately after an explicit `makeCurrent()`:

```tsx
import * as Gdk from "@gtkx/gi/gdk";
import * as gl from "@gtkx/gl";
import { GtkGLArea } from "@gtkx/jsx/gtk";

const Scene = () => (
    <GtkGLArea
        onRender={() => {
            gl.clearColor(0.2, 0.3, 0.3, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            return true;
        }}
        onResize={(width, height) => gl.viewport(0, 0, width, height)}
    />
);
```

The bindings target the desktop GL command set. GTK may negotiate an OpenGL ES context where desktop GL is unavailable; most entry points are shared, but desktop-only commands (e.g. `clearDepth`, `getBufferSubData`) require a desktop context. Constrain the negotiation with `glArea.setAllowedApis(Gdk.GLAPI.GL)` when you depend on them.

## Output parameters

Commands that fill C out-parameters return them instead, matching the `@gtkx/gi` convention: a single output becomes the return value, multiple outputs (or an output alongside a non-`void` C return) become a tuple in declaration order.

```tsx
const status = gl.getShaderiv(shader, gl.COMPILE_STATUS);
const [buffer] = gl.genBuffers(1);
const [written, source] = gl.getShaderSource(shader, 4096);
```

The `glGen*`/`glCreate*`/`glDelete*` object families also carry derived singular forms: `genBuffer()` returns one fresh name, `deleteBuffer(name)` releases one.

```tsx
const vao = gl.genVertexArray();
const vbo = gl.genBuffer();
// ...
gl.deleteBuffer(vbo);
gl.deleteVertexArray(vao);
```

## Buffer data and typed arrays

Data parameters (`bufferData`, `texImage2D`, `readPixels`, …) accept an `ArrayBufferView`, a byte offset into the bound pixel/parameter buffer, or `null`. Typed arrays cross the FFI boundary zero-copy in both directions:

```tsx
const vertices = new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]);
gl.bufferData(gl.ARRAY_BUFFER, vertices.byteLength, vertices, gl.STATIC_DRAW);

const pixels = new Uint8Array(width * height * 4);
gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
```

The `pointer`/`indices`/`indirect` parameters of the vertex-attribute and draw families are byte offsets into the bound buffer object and are typed as plain numbers, never views:

```tsx
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 6 * 4, 0);
gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
```

## Shaders

`shaderSource` follows the registry shape — an array of strings plus their lengths, where `-1` marks a NUL-terminated entry:

```tsx
const shader = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(shader, 1, [source], [-1]);
gl.compileShader(shader);

if (!gl.getShaderiv(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
}
```

`getShaderInfoLog`, `getProgramInfoLog`, and `getProgramPipelineInfoLog` are hand-written companions that hide the C API's two-call length dance and return the log as a string (or `""` when empty).

## Debug output and fences

`debugMessageCallback(callback)` installs a GL debug handler, forcing `GL_DEBUG_OUTPUT_SYNCHRONOUS` so the driver invokes it inside the GL call that produced the message; pass `null` to uninstall. `clientWaitSyncLoop(sync, flags, timeoutNs)` waits on a fence by looping bounded `clientWaitSync` calls, standing in for the `GL_TIMEOUT_IGNORED` token whose value exceeds JavaScript's safe integer range:

```tsx
gl.debugMessageCallback((source, type, id, severity, message) => {
    console.warn(`GL debug: ${message}`);
});

const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
gl.clientWaitSyncLoop(fence, gl.SYNC_FLUSH_COMMANDS_BIT, 1_000_000_000);
gl.deleteSync(fence);
```

## What is excluded

A small set of commands has no generated form: state-vector queries whose output size depends on the queried name (`getIntegerv`, `getFloatv`, `getTexParameteriv`, …), `glDebugMessageCallback`'s raw form (covered by the companion wrapper), and `glMapBufferRange` memory access (use `bufferSubData`/`getBufferSubData`). Object-scoped single-valued queries (`getShaderiv`, `getProgramiv`, `getBufferParameteriv`, and family) are generated.

See the `examples/gtk-demo` OpenGL demos (`glarea`, `gears`, `shadertoy`) for complete programs.
