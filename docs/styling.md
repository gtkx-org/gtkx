# Styling, animation, and GL

Three sibling end-user packages give gtkx app authors web-style visual tooling on top of GTK4: `@gtkx/css` (Emotion-based CSS-in-JS compiled to GTK CSS classes), `@gtkx/animate` (libadwaita-driven widget animation with presence-aware mount/exit), and `@gtkx/gl` (generated OpenGL bindings for `GtkGLArea` render callbacks). All three sit above the reconciler rather than inside it: they produce class names, wrap children, or issue FFI calls, and the reconciler attaches the widgets they touch. For how the reconciler turns JSX into live widgets and applies the `cssClasses` prop, and for how the generated GL module is produced, see the orientation hub in [./architecture.md](./architecture.md). Setup and commands for humans live in [../README.md](../README.md).

## @gtkx/css

`@gtkx/css` is an Emotion-style CSS-in-JS layer for GTK. A tagged template compiles a style body into a deterministic, content-hashed GTK CSS class name, and the compiled rule is pushed into a process-wide GTK `CssProvider` attached to the default display. The app author applies styling by passing the returned class name to a widget's `cssClasses` prop; nothing renders styled until that happens. A composition helper assembles a class list from conditional entries, and a separate entry point injects unscoped global CSS that is not wrapped in a generated selector.

Compilation runs the Emotion serializer over the template and its interpolations, then a stylis pipeline that strips Emotion's debug output and emits the final rule text. Identical bodies dedupe by content hash, so repeating the same style compiles and inserts once. Rules buffer and flush together, and provider attachment waits for a display when none is open yet, so styling is asynchronous relative to the call site. All scoped and global output accumulates into the same shared provider.

GTK CSS uses `@`-prefixed named colors (for example `@accent_bg_color`) that stylis would otherwise treat as at-rules. The pipeline escapes non-keyword `@identifiers` before compilation and restores them afterward, leaving genuine at-rules (`keyframes`, `media`, `define-color`, and the like) untouched.

```tsx
const card = css`
  background: @card_bg_color;
  border-radius: 12px;
  & label { font-weight: bold; }
`;

<GtkBox cssClasses={cx(card, isActive && "active")} />;
```

Selectors are written GTK-relative — use `&` and GTK node names. Importing a `.css` file is also supported: the CLI's Vite assets plugin rewrites the import into a global-injection call of the file's text, registering it as global GTK styling (see [./cli.md](./cli.md)).

## @gtkx/animate

`@gtkx/animate` animates a single GTK widget by interpolating opacity and transform components over a `0..1` progress driven by a libadwaita animation, then writing the interpolated values out as GTK CSS through a per-element `CssProvider`. It does not mutate widget properties directly — animation is entirely CSS-driven, and each animated element owns its own provider, distinct from the shared `@gtkx/css` one.

The package exposes a timed component and a spring component, each of which wraps exactly one widget child and forwards a ref onto it, so the child must accept a ref to a GTK widget. Both share `initial` / `animate` / `exit` / mount-trigger props plus start and complete callbacks; each adds its own mode-specific parameters (duration and easing for timed, spring physics for spring). The animatable properties cover opacity plus translate, scale, rotate, and skew, which compose into a single GTK CSS rule of `opacity` and a `transform`.

Each element drives its own animation lifecycle. On mount it derives a baseline state from the `initial`/`animate` props, attaches its provider, and optionally plays the entry animation. When the target props change, it interpolates from the current values to the new target frame by frame — a libadwaita timed or spring animation supplies the progress, and a per-tick callback writes the interpolated CSS. Missing properties fall back to per-property defaults. On unmount it cancels any in-flight animation, detaches the provider, and strips the class.

`AnimatePresence` tracks keyed children so removed widgets can play an exit animation before they unmount. When a key disappears from the current render, its element is retained and kept rendering; a presence context tells the wrapped animation it is no longer present, the exit animation runs once, and on completion the element is dropped and a re-render finalizes the unmount.

## @gtkx/gl

`@gtkx/gl` is a generated set of camelCase wrappers over the OpenGL 4.6 core profile, plus a small hand-written companion module. Wrappers operate on the currently-current GL context and are meant to be called inside `GtkGLArea` realize/render/resize/unrealize handlers after `makeCurrent()`. The generated bindings come from the codegen Khronos path over the vendored GL registry and must not be hand-edited; changes go through regeneration (see [./codegen.md](./codegen.md)).

Each wrapper binds a GL command through the FFI type-descriptor helper, keeping every non-output parameter in the signature and returning out-parameters as values or tuples. Generated enum and scalar/handle type modules accompany the commands. The companion module supplements these with calls awkward to auto-generate — info-log queries, debug-message-callback installation via an FFI callback, a chunked sync-wait loop — and with singular convenience helpers derived over the plural commands.

```tsx
import * as gl from "@gtkx/gl";

const areaRef = useRef<Gtk.GLArea | null>(null);

<GtkGLArea
  ref={areaRef}
  onRealize={() => {
    const area = areaRef.current;
    if (!area) return;
    area.makeCurrent();
    if (area.getError()) return;
    // gl.createShader / compileShader / linkProgram / genBuffer ...
  }}
  onRender={() => {
    gl.clearColor(0.5, 0.5, 0.5, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.flush();
    return true;
  }}
  onResize={(w, h) => gl.viewport(0, 0, w, h)}
  onUnrealize={() => {
    areaRef.current?.makeCurrent();
    // gl.deleteProgram / deleteBuffer ...
  }}
/>;
```

The `GtkGLArea` widget comes from `@gtkx/jsx`; `makeCurrent()`, `getError()`, and `queueRender()` are widget/context methods. The `gl.*` wrappers issue libGL calls via FFI against whichever context is current, so they only behave correctly inside these handlers after `makeCurrent()`. A state change that affects the frame ends with `queueRender()` to schedule a redraw.
