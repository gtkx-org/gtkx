# Styling, animation, and GL

Three sibling end-user packages give gtkx app authors web-style visual tooling on top of GTK4: `@gtkx/css` (Emotion-based CSS-in-JS compiled to GTK CSS classes), `@gtkx/animate` (libadwaita-driven widget animation with presence-aware mount/exit), and `@gtkx/gl` (generated OpenGL bindings for `GtkGLArea` render callbacks). All three sit above the reconciler rather than inside it: they produce class names, wrap children, or issue FFI calls, and the reconciler attaches the widgets they touch. For how the reconciler turns JSX into live widgets and applies the `cssClasses` prop, and for how the generated GL module is produced, see the orientation hub in [./architecture.md](./architecture.md), which routes to the reconciler under `packages/react/src/reconciler/`, the generator under `packages/codegen/src/`, and the CLI under `packages/cli/src/`. Setup and commands for humans live in [../README.md](../README.md).

## @gtkx/css

`css` compiles a tagged-template style body into a deterministic GTK CSS class name and pushes the compiled rule into a process-wide GTK `CssProvider`. The app author applies styling by passing the returned class name to a widget's `cssClasses` prop; nothing renders styled until that happens.

### Public API

- `css(...args)` -> the generated class name string. Serializes the interpolations, derives a hashed name prefixed by the cache key, compiles the rule body, inserts it once, and returns the class name.
- `cx(...classNames)` -> `string[]`, filtering out falsy and empty entries. Used to compose a list for `cssClasses`.
- `injectGlobal(...args)` -> `void`. Inserts unscoped global CSS (not wrapped in a generated selector), deduped under a `global-` key.
- `registerProviderForDefaultDisplay()` -> `{ provider, display }`. Creates a `CssProvider`, attaches it to the default `Gdk.Display` at application priority if one exists, and returns both. Reused by `@gtkx/animate` for its per-animation providers. `display` is `null` when no display is open yet.

### Compilation pipeline

```
css`...`
  -> serializeStyles (@emotion/serialize)  -> hashed name + style body
  -> className = `${cacheKey}-${name}`      -> dedupe by name in the cache
  -> escapeNamedColors                      -> rewrite @named-colors to a sentinel
  -> stylis compile + middleware:
       removeLabel  (drop Emotion debug `label` decls)
       stringify
       rulesheet    -> restoreNamedColors -> Stylesheet.insert(rule)
  -> rules buffered, flushed on a microtask -> CssProvider.loadFromString
```

The Emotion cache (keyed `gtkx`) and the `Stylesheet` are module-level singletons created lazily, one per process. The cache's `inserted`/`registered` maps dedupe by the serialized style hash, so calling `css` with the same body twice compiles and inserts once.

### Named-color escaping

GTK CSS uses `@`-prefixed named colors (e.g. `@accent_bg_color`) that stylis would otherwise parse as at-rules. The pipeline rewrites every `@identifier` to a sentinel token before compilation, then restores it to `@`-form when the rule reaches the sheet. Identifiers in the known at-rule keyword set (`keyframes`, `media`, `define-color`, `font-face`, `supports`, `binding-set`, and others) are left untouched, so genuine at-rules still compile. The distinction is keyword-sensitive: only non-keyword `@identifiers` round-trip as named colors.

### Label stripping

Emotion emits a debug `label` declaration into serialized output. A stylis middleware drops it before insertion, detecting it by inspecting the first and third character codes of the declaration value string (the middleware reads `element.value`, the declaration text, not the stylis property).

### The stylesheet / CssProvider bridge

`Stylesheet` accumulates rule text and bridges to GTK:

- `insert(rule)` appends the rule and schedules a microtask flush; repeated inserts in one tick coalesce into a single flush.
- The flush lazily creates one `CssProvider`, joins all buffered rules, and calls `loadFromString`. It subscribes to `parsing-error` to warn (prefixed `[gtkx/css]`) when GTK rejects a rule.
- Provider attachment goes through `StyleContext.addProviderForDisplay` at `STYLE_PROVIDER_PRIORITY_APPLICATION`. If no display is open when the provider is created, the sheet attaches it once on the first `DisplayManager` `display-opened` event.

Because insertion buffers and flushes on a microtask, and provider attachment may wait for a display to open, styling is asynchronous relative to the `css()` call. All `css`/`injectGlobal` output accumulates into the same shared provider on the default display.

### App-author model

```tsx
const card = css`
  background: @card_bg_color;
  border-radius: 12px;
  & label { font-weight: bold; }
`;

<GtkBox cssClasses={cx(card, isActive && "active")} />;
```

Selectors are written GTK-relative — use `&` and GTK node names. The `.css` import path is also supported: the CLI's Vite assets plugin rewrites a `.css` file import into an `injectGlobal(...)` call of the file's text, so importing a stylesheet registers it as global GTK styling (the assets plugin lives in `packages/cli/src/`; see [./architecture.md](./architecture.md)).

## @gtkx/animate

`@gtkx/animate` animates a single GTK widget by interpolating opacity and transform components over a `0..1` progress driven by a libadwaita animation, then writing the interpolated values out as GTK CSS through a per-instance `CssProvider`. It does not mutate widget properties directly — animation is entirely CSS-driven.

### Public API

- `AdwTimedAnimation`, `AdwSpringAnimation` — components that each wrap exactly one widget child and drive it.
- `AnimatePresence` — tracks keyed children and choreographs exit animations on removal.
- Types: `AnimatableProperties`, `AnimationProps`, `AdwTimedAnimationProps`, `AdwSpringAnimationProps`.

`AnimatableProperties` covers `opacity`, `translateX/Y`, `scale`/`scaleX`/`scaleY`, `rotate`, and `skewX/Y`. `buildCss` maps these to a GTK CSS rule of `opacity` plus a composed `transform` (translate, scale, rotate, skew). The genuinely shared base of both animation components is `initial` / `animate` / `exit` / `animateOnMount` plus the `onAnimationStart` / `onAnimationComplete` callbacks. `delay` is not part of that shared base — each props type declares its own `delay` alongside its mode-specific props. Timed props add `duration`, `easing`, `repeat`, `reverse`, `alternate` (and `delay`); spring props add `damping`, `mass`, `stiffness`, `initialVelocity`, `clamp` (and `delay`).

### Component contract

Each `AdwTimed`/`AdwSpringAnimation` renders a shared `WidgetAnimation` that takes `Children.only` and forwards a merged ref onto the single child. The child must therefore accept a `ref` to a `Gtk.Widget`. `kind: "timed" | "spring"` selects which Adw animation to build.

### AnimationDriver lifecycle

`useWidgetAnimation` creates one `AnimationDriver` per element, keyed by a sanitized React `useId`, and keeps a live ref to the latest props. The driver owns the CSS provider and the animation state machine:

```
mount (useLayoutEffect):
  driver.applyMount()
    -> AnimationCssProvider.attach(widget)   // create provider, add generated class
    -> write baseline values
    -> if animateOnMount && animate: startAnimation(animate)

animate prop change (useLayoutEffect):
  if changed (areAnimatedPropsEqual): driver.startAnimation(animate)

startAnimation(target, onComplete?):
  cancel any in-flight animation (skip)
  from = currentValues, to = target
  onAnimationStart?()
  CallbackAnimationTarget -> each tick: currentValues = interpolate(from, to, progress); provider.write
  build Adw.TimedAnimation | Adw.SpringAnimation
  on "done": snap to target; onAnimationComplete?(); onComplete?()
  play after optional delay timer

unmount:
  driver.dispose()  -> cancel, remove provider from display, remove class, clear timers
```

`baselineValues` / `mountValues` derive the pre-animation state from `initial` / `animate` / `animateOnMount` (`initial: false` opts out of an initial state). `interpolate` fills missing keys with per-property defaults (`opacity`/`scale*` default to `1`, everything else to `0`) and lerps each key by progress.

Timed and spring props map onto Adw primitives: `Adw.TimedAnimation.new(widget, 0, 1, duration, target)` with easing/repeat/reverse/alternate setters, or `Adw.SpringAnimation.new(widget, 0, 1, Adw.SpringParams.new(damping, mass, stiffness), target)` with initial-velocity/clamp setters. Both use an `Adw.CallbackAnimationTarget` whose callback writes the interpolated CSS each frame. Documented numeric defaults apply when a prop is omitted (timed duration; spring damping/mass/stiffness).

### AnimationCssProvider

Each animated element creates its own `CssProvider` via `registerProviderForDefaultDisplay` (reused from `@gtkx/css`), adds the generated class to the widget, and writes a full rule via `loadFromString` on every tick. On dispose it removes the provider from the display and strips the class. Provider state is per element, distinct from the shared `@gtkx/css` provider.

### AnimatePresence exit choreography

`AnimatePresence` tracks keyed React-element children. Only keyed object children are tracked; anything unkeyed or non-object is ignored for exit. When a key disappears from the current render, its element is retained in an `exiting` map so it keeps rendering. Each present and exiting child is wrapped in a `PresenceContext`:

```
present child  -> { isPresent: true,  onExitComplete: noop }
exiting child  -> { isPresent: false, onExitComplete: drop key + force re-render }
```

`WidgetAnimation` reads that context. When `isPresent` flips to false, it runs the exit animation once (`startAnimation(exit ?? {})`) and calls `onExitComplete`, which removes the child from the exiting map and forces a re-render so the widget is finally unmounted.

## @gtkx/gl

`@gtkx/gl` is a generated set of camelCase wrappers over the OpenGL 4.6 core profile, plus a small hand-written companion module. Wrappers operate on the currently-current GL context and are meant to be called inside `GtkGLArea` realize/render/resize/unrealize handlers after `makeCurrent()`.

### Module shape

- `generated/commands` — one wrapper per GL command, binding the native `glXxx` symbol in `libGL.so.1` through the `@gtkx/ffi` `t` descriptor helper. Out-parameters return as values or tuples; array params accept JS arrays or typed arrays. Every non-output parameter is kept in the wrapper signature 1:1, including array-length/count parameters — `genBuffers(n: GLsizei): GLuint[]` keeps `n`, and `bindBuffersBase(target, first, count, buffers)` keeps `count`. The only place a count is dropped is the separately-derived singular helpers (see below), e.g. `genBuffer()` passes `1` internally. Each wrapper carries JSDoc citing the providing GL version, the C signature, and a Khronos refpage link.
- `generated/enums` — GL enum value constants emitted as named hex consts (e.g. `COLOR_BUFFER_BIT`, `FRAGMENT_SHADER`, `INFO_LOG_LENGTH`).
- `generated/types` — scalar aliases (`GLuint`, `GLint`, `GLfloat`, ...), opaque handle aliases (`GLsync`, `GLpointer` over the native `Handle`), and one open alias per Khronos enum group. Enum-group types are documentation-only aliases of `GLenum`/`GLbitfield`; they record intent but accept any numeric value.

The generated files are emitted by the codegen Khronos path from the vendored `registry/gl.xml` and must not be hand-edited; changes go through regeneration (the Khronos path lives under `packages/codegen/src/`; see [./architecture.md](./architecture.md)).

### Companion helpers

`companion.ts` supplements the generated bindings with calls awkward to auto-generate:

- `getShaderInfoLog` / `getProgramInfoLog` / `getProgramPipelineInfoLog` — query `INFO_LOG_LENGTH`, size a borrowed string buffer, bind the native log-reading symbol directly, and return the text.
- `debugMessageCallback(callback | null)` — installs a `GLDEBUGPROC` via an FFI callback descriptor (`forever` scope, user-data at index 6), enabling `DEBUG_OUTPUT` and `DEBUG_OUTPUT_SYNCHRONOUS`; passing `null` clears it.
- `clientWaitSyncLoop(sync, flags, timeoutNs)` — calls `clientWaitSync` in chunks bounded by a max chunk size to avoid timeout overflow, looping until signaled, satisfied, errored, or the total timeout expires.

Singular helpers (`genBuffer`, `genFramebuffer`, `deleteBuffer`, `deleteVertexArray`, and the like) are derived companions over the plural generated commands: they call the underlying `glGenBuffers`/`glDeleteVertexArrays` with a hardcoded count of `1` and return or take a single name instead of an array. This count-dropping is specific to these helpers, not the general wrapper rule.

### App-author model

```tsx
import * as gl from "@gtkx/gl";

const areaRef = useRef<Gtk.GLArea | null>(null);

<GtkGLArea
  ref={areaRef}
  onRealize={() => {
    const area = areaRef.current;
    if (!area) return;
    area.makeCurrent();
    if (area.getError()) return;          // check error after realize
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

The `GtkGLArea` widget comes from `@gtkx/jsx`; `makeCurrent()`, `getError()`, `getApi()`, and `queueRender()` are widget/context methods. The `gl.*` wrappers issue libGL calls via FFI against whichever context is current, so they only behave correctly inside these handlers after `makeCurrent()`. A state change that affects the frame ends with `queueRender()` to schedule a redraw.
