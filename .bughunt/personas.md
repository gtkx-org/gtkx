# Persona catalog

Each persona is one kind of GTKX user with one surface to break. A hunter agent is assigned exactly
one persona, reads `brief.md` plus its own section here, and works only that surface.

Slugs are stable: they key the scratch directories and the findings ledger.

---

## `cli` — The command-line driver

Installs the CLI and runs every subcommand every way a user might.

- `gtkx --help`, `--version`, and `<subcommand> --help` for `dev`, `build`, `codegen`, `docs`, `create`.
- Every documented flag: `build --asset-base`, `codegen --force`, `docs --out --base-path --force`,
  the `--cwd` and entry arguments on every command that takes them.
- Argument edge cases: a relative entry, an absolute entry, an entry that does not exist, a directory
  passed where a file is expected, a path with spaces, a path with non-ASCII characters, a symlinked
  project root, a `--cwd` outside the project, `--cwd` pointing at a file, two conflicting flags,
  an unknown flag, an unknown subcommand, a flag with a missing value, `--` passthrough to the app.
- Run from a subdirectory of the project. Run with no `gtkx.config.ts`. Run with a `gtkx.config.ts`
  that throws, that exports the wrong shape, that is empty, that is CommonJS.
- Run with no `node_modules`. Run with a corrupted generated store (delete half of
  `node_modules/.gtkx/gi`). `codegen --force` is documented to recover that: verify it does.
- Run two `gtkx dev` processes on the same project at once.
- Send `SIGINT` and `SIGTERM` to each long-running command. Check for orphaned child processes with
  `pgrep -a` afterwards. A leaked compositor, Vite server, or app process is a defect.

Oracles: exit codes, whether the error names the actual problem, orphaned processes, stack traces
printed where a sentence belongs.

---

## `scaffold` — The first-time user

Runs `npm create gtkx@latest` / `npx create-gtkx@1.0.0` the way the README and website tell them to.

- Every prompt combination: TypeScript and JavaScript, each package manager offered, each library set.
- Non-interactive flags if any exist; check `create-gtkx --help`.
- Awkward inputs: an app name with spaces, with uppercase, with a leading digit, with a `/`, an empty
  name, a name matching an existing directory, a reserved application ID, an application ID that is
  not reverse-DNS, a target directory that exists and is non-empty, a target directory with no write
  permission.
- After each successful scaffold, the app must: install, `gtkx codegen`, `tsc --noEmit`, `gtkx build`,
  and actually start under `wlheadless-run` and exit cleanly. Anything less is a defect.
- Check the scaffolded `package.json`, `tsconfig.json`, and `gtkx.config.ts` are internally consistent
  and that the versions it pins actually resolve.

---

## `hotreload` — The developer in an edit loop

Runs `gtkx dev` and edits files while it is running. Drive the app with `@gtkx/mcp` where useful.

Sequences to run, each starting from a working app, checking that the app is still alive and correct
after every step:

- Edit a component's JSX. Edit a hook's dependencies. Add a new `useState`. Remove a `useState`.
  Reorder hooks (this must produce a clean remount, not a corrupt tree).
- Introduce a syntax error, save, then fix it. The app must recover, not die.
- Introduce a runtime throw in render, save, then fix it.
- Rename a file that is imported. Delete a file that is imported. Re-create it.
- Add a new file and import it. Add a new dependency to `package.json` mid-session.
- Edit `gtkx.config.ts` (add a library, change the application ID). Edit `tsconfig.json`.
- Edit a CSS-in-JS style object. Edit a module that is imported by both the app and a worker.
- Save the same file 20 times in a second.
- Edit while the app window is closing, and edit after the app has quit.
- Kill the app process and check the supervisor's behavior. Kill the supervisor and check for orphans.
- Check that component state is preserved across a Fast Refresh where React says it should be, and
  reset where React says it should reset.

Oracles: the app must never die from an edit, never show stale output after a successful reload,
never leak a process, and never report the wrong file in an error overlay.

---

## `marshal` — The bindings power user

Calls the generated `@gtkx/gi` bindings directly, hunting for FFI marshaling defects. This is the
highest-yield persona: exercise argument shapes that ordinary app code never reaches.

- **Out and inout parameters** on every form: a single out param, several, a mix of in and out,
  an out param that is an array with a length out param, an out param on a method that also returns
  a boolean success flag, an out `GError`.
- **Arrays**: zero-terminated, length-parameterized, fixed-size, arrays of strings, of structs,
  of objects, of enums; empty arrays; `NULL` arrays; arrays returned with transfer none, container,
  and full. Round-trip each one where a setter/getter pair exists.
- **Strings**: UTF-8 with astral-plane characters, embedded NUL, empty string vs `NULL`, filename
  encoding, very long strings, a string returned with transfer full versus none.
- **Numbers**: `gint64`/`guint64` past `Number.MAX_SAFE_INTEGER`, negative values into unsigned
  parameters, `gfloat` precision, `gdouble` NaN and infinities, `gsize` on 64-bit.
- **GVariant**: build and read every type code, nested tuples, dictionaries, maybe types, byte
  strings, and round-trip through `GSettings` and through action parameters.
- **Boxed and struct types**: `GdkRGBA`, `GtkBorder`, `GrapheneRect`, `Cairo` contexts, `GBytes`,
  copy semantics, mutation of a returned struct, passing a struct by value versus by reference.
- **Callbacks**: scope call, scope async, scope notified; a callback that throws; a callback invoked
  after the JS closure is collected; a callback with out parameters; a `GDestroyNotify`.
- **Enums and flags**: an unknown numeric value, combining flags, a flags value of zero, a negative
  enum.
- **Nullability**: pass `null` and `undefined` to every nullable and non-nullable parameter, and
  check the error for the non-nullable case is a clean JS error, not a segfault.
- **GError**: a call that fails must throw a JS error carrying the domain, code, and message.

Oracles: round-trip identity, no criticals, no aborts, and ASan cleanliness. Distil anything you find
into a test under `packages/e2e/tests/runtime/` or `packages/e2e/tests/native/` in the worktree and
run it with `pnpm vitest run --project e2e <file>` to confirm it reproduces against source.

---

## `subclass` — The GObject subclasser

Uses `registerClass` and the class-extension surface.

- Register a subclass of `GtkWidget`, `GtkBox`, `GObject`, and an Adwaita widget.
- Install properties of every type: string, int, uint, int64, boolean, double, enum, flags, object,
  boxed, GVariant. Read and write each from JS and from C (via `g_object_get`/`set` through the
  bindings). Construct-only and construct properties. A property with a non-trivial default. A
  property notify handler.
- Install and emit custom signals: with no arguments, with each argument type, with a return value,
  with accumulator semantics, detailed signals, and a signal emitted from a vfunc.
- Override vfuncs (`snapshot`, `measure`, `size_allocate`, `dispose`, `finalize`) and chain to the
  parent implementation. Verify the parent runs. Verify a vfunc that throws does not corrupt GTK.
- Implement an interface (`GtkBuildable`, `GListModel`, `GtkOrientable`).
- Register the same class name twice. Register a class with an invalid name. Register during a signal
  emission.
- Instantiate thousands of instances and check for leaks; unref and confirm `dispose` and `finalize`
  run.
- Use the subclass as a JSX element through the element registry.

---

## `higapp` — The application developer

Builds a complete, credible GNOME application following the Human Interface Guidelines, from scratch,
in the playground, and drives it. The point is emergent defects from realistic composition, not
isolated API probes.

Pick one app idea per round and build it properly, using: `AdwApplicationWindow`, `AdwNavigationSplitView`
or `AdwOverlaySplitView`, `AdwToolbarView` with a header bar, `AdwViewStack` with a view switcher,
a primary menu, `AdwPreferencesDialog` with pages and groups, `AdwAboutDialog`, `AdwToastOverlay`,
`AdwBanner`, `AdwStatusPage` for empty states, `AdwAlertDialog` for destructive confirmation,
`GtkSearchBar` with a search entry, a `GtkListView` or `GtkColumnView` over a real data set,
keyboard shortcuts and a shortcuts window, `GSettings`-backed preferences, an app menu with
`GAction`s and accelerators, drag and drop, and a `GtkFileDialog`.

Then: resize the window across breakpoints, navigate every route, open and close every dialog twice,
toggle every preference, trigger every toast, run the whole flow with the app started cold and with
it started from `dist/bundle.js` after `gtkx build`.

Report anything that crashes, warns, renders wrong, loses state, or that the HIG says should be
possible and GTKX cannot express.

---

## `testkit` — The test author

Uses `@gtkx/testing` and `@gtkx/vitest` as a user writing an app test suite.

- Every query (`getBy*`, `queryBy*`, `findBy*`, `getAllBy*`) against every locator kind: role, text,
  label, placeholder, title, test id. Including the negative and plural forms, and the error message
  each throws when it matches nothing or matches several.
- `userEvent`: click, double click, right click, hover, keyboard, type, clear, tab, select options,
  drag. On plain widgets and on widgets inside `GtkListItem` rows, `GtkColumnView` headers,
  `GtkTreeExpander`, `AdwComboRow`, `GtkFlowBox`, `GtkNotebook` tabs, and popovers.
- Async: `waitFor`, `findBy*`, fake timers, a promise resolving from the GLib main loop, `act`
  warnings.
- Multiple `render` calls in one test. Rendering without cleanup. Rendering into a portal.
  Rendering a component that throws.
- Worker isolation: run the suite with `GTKX_MAX_WORKERS=1` and with the default, and check for
  cross-test leakage.
- Check the accessible tree the queries read matches what GTK's own accessibility API reports.

Historically the richest vein: clicks that emit gesture signals instead of pushing a real `GdkEvent`
break any handler that reads modifier state. Re-verify that class of defect every round.

---

## `styling` — The CSS user

Uses `@gtkx/css`.

- Every selector form the API supports, nesting, pseudo-classes (`:hover`, `:checked`, `:disabled`,
  `:selected`, `:focus`), child and descendant combinators, and GTK's node names.
- Dynamic values from props, values that change every frame, values that are `undefined` or `null`,
  numeric values needing units, colors in every notation, `calc`, and GTK named colors.
- Keyframes and transitions. Media queries. `@define-color`.
- A style object that produces invalid GTK CSS — the error must name the offending declaration, and
  GTK's CSS parser must not emit a critical.
- Very many distinct dynamic styles (thousands) — check the provider count and for leaks.
- Style a subclassed widget and an element rendered through a portal.
- Compare the emitted GTK CSS against what GTK4's CSS documentation says is supported. GTKX accepting
  a declaration GTK ignores is a defect if the user gets no warning.

---

## `config` — The project configurator

Breaks `gtkx.config.ts` and the codegen store.

- Every documented option: `libraries`, `applicationId`, `girPath`, `codegen: false`, `elements`
  with a behaviors module, and whatever else `@gtkx/config` exposes.
- A library that does not exist, a wrong version (`Gtk-3.0`), a namespace with no typelib installed,
  a duplicate entry, an empty list, a library whose dependency is missing.
- `GTKX_GIR_PATH` pointing at a directory with no GIR files, at one file, at a broken XML file.
- A behaviors module that throws, that exports nothing, that registers a duplicate element, that
  registers an element for a type that does not exist.
- Store freshness: bump `@gtkx/runtime` in `package.json` and check the store is invalidated. Touch a
  `.gir` file. Corrupt the fingerprint file. Delete the symlinks under `node_modules/@gtkx/`.
- Two projects in one workspace with different `libraries` — each must get its own correct store.
- Run `gtkx codegen` concurrently in two processes on one project.

---

## `lifecycle` — The async and lifetime user

- Promisified async GIO calls: resolve, reject, and cancel each. A `GCancellable` cancelled before
  the call, during, and after. A cancelled call must reject, not hang.
- Quit the application while async work is pending. Quit from inside a signal handler. Quit twice.
- `GLib.timeout_add`, `idle_add`, and sources removed from inside their own callback.
- An unhandled promise rejection inside a signal handler, and inside a React effect.
- Connect and disconnect signals repeatedly; connect the same handler twice; disconnect during
  emission; block and unblock.
- Mount and unmount a large tree 500 times and watch RSS and the GObject handle count.
- `useApplication`, `useParentWindow`, and the other public hooks outside their intended context —
  the error must be clear.
- Ctrl-C the app. `SIGTERM` the app. Close the last window. Each must exit cleanly with code 0 and
  no criticals.

---

## `collections` — The list and menu user

Uses `@gtkx/components`.

- `GtkListView`, `GtkGridView`, `GtkColumnView`: empty, one item, 100k items, items added and removed
  while scrolled, the whole model replaced, duplicate keys, missing keys, keys that change identity.
- Selection: none, single, multiple; programmatic selection; selection surviving a model change;
  clicking a row versus clicking a widget inside a row.
- Sorters and filters, changed while scrolled; a sorter that is inconsistent; a filter that matches
  nothing.
- `GtkTreeExpander` and tree models: expand, collapse, expand a node whose children load async,
  remove an expanded node.
- Menus: `GMenuModel`-backed popovers, nested submenus, sections, items with and without actions,
  an action that is disabled, an accelerator, and a menu rebuilt while open.
- Rapidly mutate a model 1000 times in one frame.

---

## `mcpdrive` — The agent-driven user

Uses `@gtkx/mcp` to control a running app, the way an AI assistant or an automated test would.

- Start the MCP server against a `gtkx dev` app, list tools, and call each one.
- Read the widget tree and the accessible tree; check it matches the rendered app.
- Click, type, and screenshot. Query by role and by label.
- Call a tool with a bad selector, a stale widget reference, and while the app is starting or quitting.
- Two clients connected at once. Client disconnect and reconnect. Server outliving the app.
- The socket path: a long path, a path that already exists, `XDG_RUNTIME_DIR` unset.

---

## `deploy` — The shipper

Takes a working app all the way to something distributable, exactly as `examples/tutorial` documents
(`scripts/bundle.ts`, `scripts/build-sea.sh`, `flatpak/`).

- `gtkx build` then `node dist/bundle.js` from the project root, from `/`, and from another user's
  home. Asset resolution must work in all three.
- `gtkx build --asset-base ../share/my-app` and a real install layout under a prefix.
- The Node single-executable bundle: build it, run it, check it finds the native addon, the GIR data,
  the GSettings schemas, and the bundled assets.
- GSettings: a schema that compiles, one that does not, a missing schema at runtime, `glib-compile-schemas`
  not on PATH.
- The Flatpak manifest: `flatpak:lint`, `flatpak:sources`, and `flatpak:build`. Then run the built
  Flatpak and confirm the app starts inside the sandbox.
- Strip `node_modules` and run the built bundle — it must not need the dev dependencies.
- Run the built bundle on a machine-like environment with no `gtkx.config.ts` present.

---

## `girzoo` — The exotic-namespace binder

Every other persona uses the same four libraries. This one binds namespaces nobody has tried and
proves the result neither leaks nor crashes.

Work in the sandbox worktree (see `brief.md`), because leak and crash proof needs the sanitizer
targets and those only run from a source tree.

- **Bind unusual namespaces.** Whatever `pkg-config --list-all` and `/usr/share/gir-1.0` offer beyond
  the usual four: `GObject-2.0`, `Gio-2.0` on their own, `Pango`, `PangoCairo`, `Graphene`, `Gsk`,
  `GdkPixbuf`, `Harfbuzz`, `Json-1.0`, `Soup-3.0`, `GstBase`, `Vte`, `Poppler`, `Secret`, `Gcr`,
  `Nautilus`, `Rsvg`, `Champlain`, `AppStream`, anything installed. For each: does `gtkx codegen`
  finish, does the store typecheck, does a trivial call work?
- **Namespaces with awkward GIR.** Ones with no shared library, circular dependencies, duplicate type
  names across namespaces, versions installed twice (`Gtk-3.0` beside `Gtk-4.0`), C identifiers that
  are TypeScript reserved words, types whose names collide with generated helpers.
- **The rare marshaling corners `marshal` cannot reach with Gtk alone**: `GStrv` nested in a struct,
  arrays of arrays, `GPtrArray` versus `GArray` versus `GByteArray`, `GHashTable` with boxed values,
  callbacks stored in struct fields, functions taking a `va_list` equivalent, `GClosure` parameters,
  signals with `GVariant` return values, out parameters of an interface type, `GType` parameters,
  fundamental non-GObject types.

**Proof obligations.** A finding here is only as good as its evidence:
- Crash: reproduce under `pnpm nx run @gtkx/native:test:asan` or `@gtkx/e2e:test:asan` and quote the
  sanitizer report, not just the abort.
- Leak: run the operation in a loop of 10k, with `--expose-gc` and forced collection, under
  `detect_leaks=1`. Quote the leak report with its stack. RSS growth alone is not evidence and the
  round-2 hunter was right to refuse to report it as such.
- If you cannot get sanitizer output for something, say so in `covered` and do not claim a leak.

---

## `perf` — The user who notices it is slow

Hunts performance defects a user would feel. A slow path is a defect when it is disproportionate, not
merely when it is measurable, so every finding needs a baseline that makes the number mean something.

- **Startup.** Time from `node dist/bundle.js` to a mapped window, cold and warm. Compare against a
  plain GTK4 C or PyGObject app doing the same thing. Where does the time go: native addon load,
  store import, codegen check, React mount?
- **The generated store.** Its size on disk, its parse time, how much of it a trivial app actually
  imports. Does importing `@gtkx/gi/gtk` pull in every namespace? Does tree-shaking work?
- **Build and codegen.** `gtkx codegen` cold and warm, `gtkx build` on a small and a large app,
  the dev server's startup and its Fast Refresh latency. Is anything quadratic in file count?
- **Render paths.** Mount and update a 10k-row `GtkListView`, a deep tree, a wide `GtkGrid`. Time a
  single prop update, a list reorder, a full re-render. Compare a GTKX list against the same list
  built directly with the GTK API through `@gtkx/gi` and no React.
- **Marshaling cost.** Time a property read, a method call with no arguments, one with a string, one
  with an array of 10k, and a signal emission, against a direct `bind()` call. A binding that costs
  10x its own FFI call has overhead worth naming.
- **Memory.** RSS after mounting and unmounting a large tree 100 times.

Report a finding only with: the measurement, the baseline you compared against, the ratio, and the
profile showing where the time goes (`--cpu-prof`, `perf`, or a flame graph). "It takes 400ms" is not
a finding; "it takes 400ms where the equivalent GTK call takes 4ms, and 90% is in X" is.

---

## `docsconform` — The documentation follower

Treats `website/` as a contract and follows it literally, typing out every snippet.

- Work through the tutorial end to end in a fresh directory, exactly as written, without improvising.
  Every step must produce what the page says it produces.
- Every guide page: run every code block that is meant to be runnable.
- The API reference: for a sample of 30 elements and 20 public functions, check the documented props,
  types, defaults, and examples against the generated `@gtkx/jsx` and `@gtkx/gi` stores and against
  runtime behavior.
- The README and `CONTRIBUTING.md` install instructions on a clean checkout.
- Any snippet that does not compile, does not run, or produces different output than the page claims
  is a `dx` defect. Say whether the code or the documentation is wrong.
