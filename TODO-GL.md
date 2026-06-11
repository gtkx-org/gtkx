# TODO: Generate `@gtkx/gl` from the Khronos XML registry

Findings and implementation plan from the 2026-06-10 exploration into replacing the hand-written
`packages/gl` bindings with output generated from the Khronos OpenGL XML registry (`gl.xml`).
Method: four repo deep-dives, two web research passes, three independent design proposals,
two adversarial judges, one completeness critic. Both judges independently selected the same
winning design (registry-faithful 1:1 generation) with the grafts recorded below.

## Verdict

Viable and worth doing. The recommended shape is to **generate `packages/gl/src/` at framework
development time from a vendored, pinned `gl.xml`, commit the output, and publish the package
exactly as it is published today** — not per-app generation through the `.gtkx` store. GL 4.6
core has been frozen since 2017 and unused `t.fn` bindings cost one frozen object each, so
generating the full surface once covers every app; per-app selection machinery (config section,
fingerprint coupling, ~9 CLI touch points, 2.8 MB of XML in the `@gtkx/codegen` tarball) buys
nothing that varies in practice.

## 1. Current state (worktree, branch `feat/v1`)

- `@gtkx/gl@0.21.0` lives at `packages/gl` as a hand-written workspace package (MPL-2.0,
  depends only on `@gtkx/ffi`, not `private` so `scripts/publish.ts` publishes it to npm).
- Surface: 44 exported functions over 37 `t.fn` bindings against `dlsym("libGL.so.1")`, plus
  40 constants with WebGL-identical names (`GL_` stripped).
- Consumers: `examples/gtk-demo/src/demos/opengl/{glarea,gears,shadertoy}.tsx` (all import
  `@gtkx/gl`) and the contract suite `packages/gl/tests/gl.test.ts` (Window + GLArea +
  realize + `makeCurrent` harness; `tests/setup.ts` defers the import until after Xvfb because
  importing the package runs `gtk_init()`).
- `knip.json` already has a `packages/gl` workspace entry; `examples/gtk-demo/package.json`
  declares `"@gtkx/gl": "workspace:*"`. Zero `@gtkx/gi/gl` imports remain anywhere.
- WebGL-style ergonomics the current surface provides (the migration must account for each):
  single-string `shaderSource`, value-returning `getShaderiv`/`getProgramiv`, info-log helpers
  hiding the two-call length dance, singular `genBuffer`/`genVertexArray`/`deleteBuffer`/
  `deleteVertexArray`, size-computing `bufferData(target, number[], usage)` plus
  `bufferDataUshort`, layout-object `vertexAttribPointer`, components-object `uniform4f`,
  `boolean`-typed GLboolean params, numeric `TRUE`/`FALSE`, `""` empty info log, `-1` missing
  uniform sentinel.

## 2. The registry as a codegen input (measured against the live file, 2026-06-10)

- Canonical: `KhronosGroup/OpenGL-Registry`, `xml/gl.xml`; raw GitHub URL is the only reliable
  automation source (the khronos.org mirror sits behind a Cloudflare challenge). ~2.77 MB,
  ~47.7k lines, one file covering GL, GLES 1/2/3, and GL SC. License: Apache-2.0 (SPDX header
  in the file itself). Schema: `xml/registry.rnc`.
- **No Linux distro packages gl.xml** (Repology: only Conan/Vcpkg). It must be vendored —
  proposed location `packages/codegen/registry/gl.xml` with a README recording the pinned
  upstream commit, following the shipped `overlay/` precedent. Apache-2.0 §4 requires the
  license text to ship with redistributions.
- Subset sizes (standard feature-resolution algorithm, extensions excluded):

  | Target | Commands | Enums |
  | --- | --- | --- |
  | gl 4.6 core | 657 | 1,367 |
  | gl 4.6 compatibility | 1,048 | 1,808 |
  | gl 3.3 core | 344 | 818 |
  | gles2 3.2 | 358 | 1,001 |
  | full registry | 3,301 | 6,064 (+863 extensions) |

- Metadata quality: `len` appears on 1,832 params in exactly five forms — numeric literal
  (646), `COMPSIZE(...)` (582), bare param name (418), `param*K` (168), `param/K` (18).
  `class` annotations (860 params + 10 protos) consistently mark object kinds across the
  gen/delete/bind/use families. 93% of `GLenum` params carry a `group`; groups are officially
  open and incomplete (Khronos issues #355–#361), so they map to documentation-only type
  aliases (`type ShaderType = GLenum`), never closed unions or branded types. `altlen` and
  `null-terminated` never appear in gl.xml.
- Traps, all verified: 618 alias commands (ARB/EXT promotions); 1,265 enum values shared by
  multiple names; `GL_ACTIVE_PROGRAM_EXT` has a different value per API (key enum tables by
  `(name, api)`); `GL_TIMEOUT_IGNORED = 0xFFFFFFFFFFFFFFFF` exceeds 2^53; five negative NV
  tokens; `GLboolean` is `unsigned char`; `GLsizei` is signed; `COMPSIZE` is not
  machine-evaluable (treat the argument's own length as authoritative, keep the expression in
  JSDoc); mixed-content C prototypes (`const GLchar *const*`) require a second
  `fast-xml-parser` configuration with `preserveOrder`; `supported="disabled"` extension to
  exclude; `glcore` vs `gl` support tokens; all nine `<remove>` blocks live in
  `GL_VERSION_3_2` with `profile="core"`.
- `glx.xml`/`wgl.xml`/`egl.xml` are not needed: `GdkGLContext` owns context creation,
  configuration (`setRequiredVersion`/`setAllowedApis`), and `makeCurrent`.

## 3. Symbol resolution (local verification, EL10 + GTK 4.22.4 + epoxy 1.5.10 + GLVND 1.7)

- **libepoxy is not directly usable by the current call path.** It exports zero plain `gl*`
  symbols; its 3,549 `epoxy_gl*` exports are *data* symbols — global function-pointer
  variables initialized to a lazy resolver thunk. `dlsym` returns the variable's address;
  calling it as code crashes. Using epoxy requires a load-pointer-then-call indirection mode
  at the symbol-resolution point in `CallRequest::execute` (`packages/native/src/module/call.rs`).
  GTK4 hard-depends on epoxy (`DT_NEEDED libepoxy.so.0` verified), so it is guaranteed present.
- **GLVND `libGL.so.1` exports ~3,470 real `T` function symbols**, including all modern core
  entry points (`glCreateShader`, `glDispatchCompute`, `glFenceSync`, `glMapBufferRange`,
  `glDebugMessageCallback` verified), dispatched per current context through libGLdispatch —
  including under the demos' `useEs` GLES contexts. This is why the current package works.
- Weaknesses of the libGL route, stated plainly: the official Linux OpenGL ABI only guarantees
  exports up to GL 1.2; the fat GLVND surface is de facto, vendor-dependent; extension entry
  points outside it are absent; GLES-only systems have no `libGL.so.1` at all (the
  `LibraryCache` comma-fallback `"libGL.so.1,libGLESv2.so.2"` already exists in
  `packages/native/src/state.rs`).
- **Decision: keep `dlsym("libGL.so.1")` for v1** (zero native changes, demonstrably correct
  on GLVND systems). The epoxy indirect-resolver mode is the documented escape hatch for
  extensions and exotic drivers; `eglGetProcAddress`/`glXGetProcAddress` plumbing is rejected
  (EGL < 1.5 cannot resolve core functions; Mesa GLX returns non-NULL stubs for unsupported
  functions — the state machine epoxy exists to hide).

## 4. FFI/native capabilities and threading (verified with file:line evidence)

- Every FFI call executes on the single dedicated GLib thread; calls are synchronous from JS.
  A context made current via `GLArea.makeCurrent()` is current for every subsequent call.
- Signal re-entry: a `render`/`realize` handler runs its JS on the JS thread while the GLib
  thread parks inside the signal emission frame; GL calls the handler issues are drained by
  the parked GLib thread at callback depth — they execute inside the signal frame while GTK
  has the area's context current. WebGL-correct context semantics fall out of the existing
  dispatch design; no threading work is needed.
- Freeze/commit: the freeze loop drains GL calls in order without yielding to the frame clock;
  `render` can never interleave with a React commit.
- Per-call overhead (measured, warm): ~4.3 µs fixed round trip; ~7 µs with a mat4-sized
  array; `number[]` bulk data costs ~66 µs per 1,024 floats and **~3.2 ms per 256 KB**.
  Fixed costs re-paid per call today: descriptor re-parse, CIF rebuild, `dlsym`, channel +
  GSource allocation (a prepared-call handle would amortize all four; optimization, not a
  correctness need).
- **TypedArray marshalling does not exist** — the critical gap. A `Float32Array` is misparsed
  as a `Ref` (`packages/native/src/value.rs:258-299`) and rejected by `ArrayType::encode`
  (`packages/native/src/types/array.rs:537-543`). Zero-copy passthrough is sound because the
  JS thread blocks for the entire call. This single feature unlocks per-frame buffer
  streaming, `texImage2D`, and `glReadPixels` write-back, and benefits GIR paths too.
- Other native gaps: no BigInt branch (`GL_TIMEOUT_IGNORED` unpassable; i64/u64 capped at
  ±2^53); no bulk memcpy primitive for `glMapBufferRange` memory; `glDebugMessageCallback`
  is unsound through trampolines (drivers may invoke from non-GLib threads — the parked-thread
  drain would execute queued GTK work on a foreign thread).

## 5. Recommended architecture

### Packaging

- [ ] Generator runs as a repo-level script (dev-time), emitting `packages/gl/src/`; output is
      committed and reviewed like any source change. No `gtkx.config.ts` section, no store
      wiring, no fingerprint coupling, no per-app codegen cost.
- [ ] Vendor `packages/codegen/registry/gl.xml` (pinned commit + Apache-2.0 license text).
- [ ] Selection fixed at `api=gl, version=4.6, profile=core` (657 commands / 1,367 enums).
      Revisit per-app selection only if api/version/profile choice genuinely varies per app.
- [ ] Replacing 44 WebGL-flavored exports with the generated surface is a semver event for a
      published package — version it deliberately.

### Generator (new `packages/codegen/src/khronos/`, ~650 lines total)

| Module | Contents |
| --- | --- |
| `parse.ts` | Second `fast-xml-parser` instance (`preserveOrder` for mixed-content `<proto>`/`<param>`); reuses exported `attr`/`attrBool` helpers from `gir/parse.ts` |
| `model.ts` | `GlCommand`, `GlParam {name, cType, group?, len?, class?}`, `GlEnum {name, value, groups, api?, typeSuffix?}`, `GlFeature`, `GlExtension`; skip `<glx>`, `<vecequiv>`, `<kinds>`, `<unused>` |
| `select.ts` | reg.py algorithm: ascending features with matching `api`, `number <=` target, apply `<require>`/`<remove>` honoring `profile`; extension inclusion by `supported` token; exclude `supported="disabled"`; enum lookup keyed by `(name, api)` |
| `ctype.ts` | Closed C-type → `t.*` table (below); unknown base type = hard codegen error |
| `pipeline.ts` | Emission via the reused `dsl/` builders; JSDoc synthesized from the C prototype + registry metadata + providing feature |

The GIR model (`src/gir/*`) is not reusable for this — `GirTypeRef`/`GirFunction` carry
GLib container/transfer/introspection concepts with no GL analog. Reused wholesale: `dsl/`,
`transpile.ts` (isolated-declarations validation), the `attr` helpers. Not routed through:
`ModuleContext`, `writers/function.ts` (its `emitNamespaceBootstrap` auto-invokes
`init`-named functions — a trap), class/signal writers, `react/`.

### Type mapping (closed table)

| GL C type | `t.*` | TS surface |
| --- | --- | --- |
| `GLenum`, `GLbitfield`, `GLuint` | `t.uint32` | `number` (group alias) |
| `GLint`, `GLsizei` | `t.int32` | `number` |
| `GLboolean` param | `t.boolean` | `boolean` |
| `GLboolean` return | `t.uint8` + `!== 0` wrapper | `boolean` |
| `GLbyte/GLubyte/GLshort/GLushort` | `t.int8/uint8/int16/uint16` | `number` |
| `GLfixed`, `GLclampx` | `t.int32` | `number` |
| `GLfloat`, `GLclampf` | `t.float32` | `number` |
| `GLdouble`, `GLclampd` | `t.float64` | `number` |
| `GLint64/GLuint64` | `t.int64/uint64` | `number` (±2^53 cap; see exclusions) |
| `GLintptr`, `GLsizeiptr` | `t.int64` | `number` |
| `GLhandleARB` | `t.uint32` | `number` (Linux-only project) |
| `GLsync` | `t.struct("borrowed")` | opaque handle |
| `const GLchar *` in | `t.string("borrowed")` | `string` |
| `const GLchar *const*` in | `t.array(t.string("borrowed"))` | `string[]` |
| `const GLubyte *` return (`glGetString`) | `t.string("borrowed")` | `string` |
| `const T *` in with `len` | `t.array(scalar)` | `TypedArray \| number[]` |
| `T *` out, no len or `len="1"` | `t.ref(scalar)` | `Ref<number>` |
| `T *` out, `len=<param>` | `t.ref(t.sizedArray(scalar, idx))` | `Ref<number[]>` |
| `GLchar *` out, `len=<bufSize>` | per-call `t.fn` with `t.ref(t.string("borrowed", n))` | `Ref<string>` (~20 cold-path commands) |
| `const void *` data (`bufferData`, `texImage2D`) | new `t.blob` | `ArrayBufferView \| number \| null` |
| `void *` out with len (`readPixels`) | `t.blob` | `ArrayBufferView` (callee writes into the JS buffer) |
| `void *` return (`glMapBufferRange`) | `t.struct("borrowed")` | opaque handle (bulk access excluded in v1) |

### Transforms and grafts (the agreed design)

- [ ] Six annotation-driven transforms only: prefix strip (`glClearColor` → `clearColor`,
      `GL_COLOR_BUFFER_BIT` → `COLOR_BUFFER_BIT`, keep prefix for digit-leading names), the
      scalar table, string codecs, `len`-array codecs, out-`Ref` codecs, `t.blob`. Nothing
      per-command; unclassifiable shapes fail at codegen time.
- [ ] **Curated byte-offset table** (one small data table, pinned-registry safe): the
      `glVertexAttribPointer`/`glVertexAttribIPointer`/`glVertexAttribLPointer` `pointer`
      params and the `glDraw*Elements*`/indirect families' `indices` params are typed as
      plain `number` byte offsets — never `ArrayBufferView`. Removes the worst raw-GL footgun
      (a typed array silently becoming a dangling client pointer at a draw call). Reserve
      `t.blob` for genuine data params.
- [ ] **Derived singulars**: `createBuffer(): number` / `deleteBuffer(name)` generated
      mechanically from the `n` + `len="n"` + `class` annotations on the gen/delete plural
      commands. Data-driven, zero hand lists; preserves the ergonomics every consumer uses.
- [ ] **Single-valued object-query carve-out**: generate `glGetShaderiv`/`glGetProgramiv`/
      `glGetBufferParameteriv` (and family) despite their `len="COMPSIZE(pname)"` — they are
      the info-log workflow's prerequisite. The general `COMPSIZE(pname)` *out* rule stays an
      exclusion (it is what makes `glGetIntegerv(GL_VIEWPORT)` a heap-corruption hazard).
- [ ] **Hand-written companion module** inside `packages/gl` (not generated): info-log helpers
      (`getShaderInfoLog(shader): string` with the two-call dance), `debugMessageCallback`
      wrapper forcing `GL_DEBUG_OUTPUT_SYNCHRONOUS`, sync helpers. Keeps the existing test
      contract for cold paths.
- [ ] **Generator-time assertion** that generated and hand-written export name sets are
      disjoint (a star-export collision drops exports silently in ESM), plus an
      exclusion-count report in the codegen output.
- [ ] Enum groups → open type aliases; bitmask groups stay OR-composable `number`. Handles
      stay plain `number` (no branding — `class` covers only 860 of 10,953 params).
- [ ] Aliases: no folding logic; emit the names the selected sets require, each binding its
      own symbol (the loader stack resolves both).
- [ ] JSDoc synthesized per export: verbatim C prototype, per-param registry metadata
      (`group`/`len`/`class`), providing feature/extension, Khronos refpage link. gl.xml
      carries no prose; the generator invents none.

### Explicit v1 exclusions (companion module or later phases cover them)

| Excluded | Why | Coverage |
| --- | --- | --- |
| Callback-typed commands (`glDebugMessageCallback` family) | driver-thread invocation unsound with trampolines | hand-written synchronous wrapper |
| `GL_TIMEOUT_IGNORED` | > 2^53, no BigInt path | capped-timeout loop helper; BigInt later |
| `glMapBufferRange` bulk access | no native memcpy primitive | `bufferSubData`/`getBufferSubData` (both usable via `t.blob`) |
| `T*` outs with `len="COMPSIZE(pname)"` except the single-valued carve-out | not machine-evaluable; vector forms corrupt memory | per-need additions |
| `gles1`, `glsc2` | no consumer; GTK never creates such contexts | — |

## 6. Phase 0: native prerequisites (before the generator is useful)

- [ ] **TypedArray detection** in `Value::from_js_value` (`packages/native/src/value.rs`) +
      fast path in `ArrayType::encode` (`packages/native/src/types/array.rs`): pass backing
      store pointer + byteLength directly, both directions (in-params and out write-back).
      Reject SharedArrayBuffer-backed views at encode.
- [ ] **`t.blob` descriptor** in `@gtkx/ffi` helpers + native `BlobType`: view ⇒ pointer,
      number ⇒ usize address/offset, null ⇒ NULL.
- [ ] Both must clear the `packages/native` gates: 100% llvm-cov line/function coverage,
      ASan (`scripts/ci-asan.sh`), Miri (`scripts/ci-miri.sh`) over the new marshalling paths.
- [ ] Later (severable): prepared-call handles (cache parsed types + CIF + resolved symbol),
      BigInt u64, `glMapBufferRange` memcpy primitive, epoxy indirect-resolver mode.

## 7. Risks and hazards

- **Silent-skip test harness**: every GL test starts `if (!glReady) return;` — if context
  creation fails (Xvfb without usable GLX/EGL), the entire suite passes with zero assertions.
  Gate CI on `glReady` or report skip counts before trusting any migration.
- **CI GL capability unverified**: which Mesa driver and GL version actually serve GLArea
  contexts in the Ubuntu CI container (under `GSK_RENDERER=cairo`, `LIBGL_ALWAYS_SOFTWARE=1`)
  has never been established. llvmpipe usually advertises 4.5 core; verify before assuming
  4.6-core symbols resolve there.
- **Context-currency discipline**: with the GSK GL renderer (`GSK_RENDERER=ngl`), GSK may
  rebind contexts between top-level JS calls. GL calls belong inside `render`/`realize`
  handlers or immediately after `makeCurrent()`; document this, and consider an `ngl` test
  lane or a debug-mode current-context assertion.
- **GLVND export-surface drift** on exotic drivers; first-call errors should name the missing
  symbol. The epoxy indirection mode is the escape hatch.
- **Desktop-vs-GLES forks**: `glClearDepth` (GLdouble) is desktop-only; GLES has only
  `glClearDepthf`. The `useEs` demos are the one shipped desktop-binding-on-GLES combination —
  name them as an explicit test target.
- **Registry update churn**: Khronos merges group/annotation fixes quarterly; count-asserting
  generator tests (e.g. gl 4.6 core = 657 commands / 1,367 enums against the vendored file)
  make a registry bump a reviewable diff instead of a silent reshape.
- **GdkGLContext negotiation**: nothing currently pairs the generated surface with
  `GLArea.setRequiredVersion`/`setAllowedApis`; without that the binding's version and the
  real context are uncorrelated. At minimum document the pairing.
- **GTK pixel interop**: the most common GL-in-GTK tasks (GdkPixbuf/GdkTexture bytes →
  `texImage2D`; `GdkGLTexture`/`GLTextureBuilder` for exporting GL output into GSK) remain
  unsketched; TypedArray marshalling is their prerequisite.

## 8. Open decisions

- [ ] Confirm the dev-time-generation packaging model (vs per-app `.gtkx` store generation —
      the rejected alternative needs: config `gl:` section + validators, `store-resolver.ts`
      third store, `run-codegen.ts` wipe/staleness/prune updates, fingerprint sentinel,
      vitest inline-regex `gl` entry, knip `.gtkx/gl` entry, registry in the npm tarball).
- [ ] API contract: accept the call-site break (positional `uniform4f`, 5-arg
      `vertexAttribPointer` + offset, explicit-size `bufferData(target, byteLength, view, usage)`,
      `Ref` cells where no carve-out applies) and the semver bump it implies.
- [ ] Naming: `clearColor` (prefix-stripped, matches every existing call site) vs verbatim
      `glClearColor`. Note `useProgram` keeps tripping Biome's hook lint at call sites.
- [ ] Whether GLES 3.2 signatures ship at launch or desktop-only suffices.
- [ ] BigInt/u64 policy timing; branded handles ruled out for v1 (retrofitting later is
      breaking — accept that).
- [ ] Docs: GL guide page under `website/docs/` + sidebar entry; whether the generated package
      joins TypeDoc (precedent: generated packages are excluded).

## 9. Phased plan (~2 weeks total)

| Phase | Work | Estimate |
| --- | --- | --- |
| 0 — native | TypedArray passthrough + `t.blob` + coverage/ASan/Miri | 3–4 days |
| 1 — generator | `src/khronos/` (parse/model/select/ctype/pipeline) + count-asserting tests; vendor registry; emission into `packages/gl/src/` with the companion module and disjointness assertion | 4–5 days |
| 2 — migration | Rewrite `packages/gl/tests/gl.test.ts` against the new surface (fix the silent-skip gate); migrate the three demos; docs page; full `pnpm lint && pnpm typecheck && pnpm test` + manual demo runs | 2–3 days |
| 3 — severable follow-ons | Prepared-call handles; epoxy indirect resolver; BigInt + `TIMEOUT_IGNORED`; `glMapBufferRange` memcpy; GLES/`ngl` CI lanes; e2e GL call-overhead benchmark | as needed |

## 10. Reference: key measured numbers

- libepoxy 1.5.10: 3,549 `epoxy_gl*` data symbols, 12 `T` utility exports, zero plain `gl*`.
- GLVND libGL.so.1 (1.7): ~3,470 `T` function symbols including all 4.6-core entry points.
- FFI: ~4.3 µs fixed per-call round trip; ~7 µs with mat4 array; `number[]` 3.2 ms/256 KB;
  no symbol caching (dlsym per call); CIF rebuilt per call.
- gl.xml: 2,772,806 bytes; 3,301 commands; 6,064 enums; 863 extensions; 618 alias commands;
  `len` on 1,832 params in five forms; `class` on 860 params; 93% of GLenum params grouped.
