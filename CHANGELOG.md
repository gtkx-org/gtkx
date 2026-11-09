## 2.0.0-beta.14 (2026-11-09)

### ⚠️  Breaking Changes

- GSettings schema imports are now typed by a `<name>.gschema.d.xml.ts` that `gtkx codegen`, `gtkx dev` and `gtkx build` write beside each `.gschema.xml`, instead of wildcard declarations in `node_modules/.gtkx/env.d.ts`. An import with a wrong path now fails `tsc`, and schemas with the same file name in different directories get their own types. TypeScript reads these files only with `"allowArbitraryExtensions": true`, so add it to `compilerOptions` in `tsconfig.json` and add `*.d.xml.ts` to `.gitignore`; new projects get both, and codegen warns while a project with schemas lacks the option, linking to the upgrade guide section on it. ([#968](https://github.com/gtkx-org/gtkx/pull/968))
- Slots use only their GtkBuilder child type names: `AdwToolbarView` no longer accepts `topBar` and `bottomBar` (use `top` and `bottom`), `GtkOverlay` no longer accepts `overlays` (use `overlay`), and `AdwExpanderRow` takes its nested rows as `children` instead of the `rows` prop. ([#1011](https://github.com/gtkx-org/gtkx/pull/1011))

### 🩹 Fixes

- The API reference names each entry module after its import path, such as `@gtkx/react/config`, and describes what it exports. The `@gtkx/config` reference lists the default of every `gtkx.config.ts` option and links the Configuration and Codegen guide, and the `animated` reference says which props skip a React render. ([#1011](https://github.com/gtkx-org/gtkx/pull/1011))
- Every package description names GTK, so the packages show up when npm users search for "gtk", and the `@gtkx/native`, `@gtkx/mcp`, `@gtkx/storybook` and `@gtkx/utils` descriptions say what each package does. ([#1011](https://github.com/gtkx-org/gtkx/pull/1011))

### ❤️ Thank You

- Eugenio Depalo @eugeniodepalo

## 2.0.0-beta.13 (2026-11-08)

### ⚠️  Breaking Changes

- Constructing an object with a key that names none of its type's properties now throws a `TypeError`, as GJS does: `new Gio.Notification({ title: "Done" })` fails with "No property title on GNotification" instead of building the object without the value. Use the type's constructor function for values that are not properties, such as `Gio.Notification.new("Done")`. See the [upgrade guide](https://gtkx.dev/v2/guide/upgrading-to-2#check-the-behavior-changes). ([#927](https://github.com/gtkx-org/gtkx/pull/927))
- `userEvent.type` now presses keys named in braces, as Testing Library does, so `type(entry, "Celebrate{Enter}")` types the text and then activates the entry. Text with a literal `{`, such as JSON, fails with "Unclosed key descriptor" until it is written as `{{`. The MCP `gtkx_type` tool still types its text verbatim. See the [upgrade guide](https://gtkx.dev/v2/guide/upgrading-to-2#check-the-behavior-changes). ([#927](https://github.com/gtkx-org/gtkx/pull/927))
- GLib criticals and warnings are now printed by GLib's default log handler, as in C and GJS applications, instead of becoming JavaScript errors, so a critical from GTK's own callbacks no longer ends the application or fails tests. `onLog` is removed from `@gtkx/runtime`. Addon panics still throw from the binding call or reach Node's uncaught-exception channel. See the [upgrade guide](https://gtkx.dev/v2/guide/upgrading-to-2#check-the-behavior-changes). ([#927](https://github.com/gtkx-org/gtkx/pull/927))
- `flushSync` is removed from `@gtkx/react` and `createTabCollection` from `@gtkx/components`. Handlers that must return a native object synchronously, such as `create-tab` and `create-window`, create it first and render into it with `createPortal`, and the new tab view navigator covers tabs across windows. ([#874](https://github.com/gtkx-org/gtkx/pull/874))
- A close the user starts and the app does not answer no longer leaves the toolkit and React out of step. Adwaita dialogs without `onClosed`, `onCloseAttempt` or `onResponse`, and JSX tab pages whose `AdwTabView` has no `close-page` handler, stay open; `showSidebar`, `showContent`, `open` on `AdwBottomSheet` and `AdwTabOverview`, and `searchModeEnabled` are controlled when given. In development, GTKX warns once per element type with the handler to add. See the [upgrade guide](https://gtkx.dev/v2/guide/upgrading-to-2#check-the-behavior-changes). ([#927](https://github.com/gtkx-org/gtkx/pull/927))
- `GObject.Object.bindPropertyFull` and `GObject.BindingGroup.bindFull` take transform functions shaped as in GJS, `(binding, value) => [success, value]`, with `null` for the default conversion and value types that follow the named properties. Rewrite transforms written as `(binding, fromValue, toValue) => boolean`; a `GObject.Closure` still receives the closure arguments. See the [upgrade guide](https://gtkx.dev/v2/guide/upgrading-to-2#check-the-behavior-changes). ([#927](https://github.com/gtkx-org/gtkx/pull/927))
- Every `gtkx` command now rejects options it does not define, suggesting the closest one, instead of ignoring them, so `gtkx deploy --targets=deb` no longer writes the default Flatpak manifest. Commands that start no application also reject arguments after `--`, and `gtkx dev`, `build` and `deploy` reject an entry that is not a JavaScript or TypeScript module. Remove options GTKX never read, and pass application options after `--`, as in `gtkx dev -- --verbose`. See the [upgrade guide](https://gtkx.dev/v2/guide/upgrading-to-2#check-the-behavior-changes). ([#927](https://github.com/gtkx-org/gtkx/pull/927))

### 🚀 Features

- GTKX apps run in pnpm workspaces with isolated `node_modules`: codegen writes the bindings to the workspace root, and each app can import only the libraries it declares. An app treats the sources of its linked workspace packages as its own, extracting their `t()` messages and bundling their icons and schemas, and npm workspace apps keep their bindings across `npm install`. Importing a library the project does not declare fails with the entry to add to `libraries`. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- Node workers can import project files with `?url`, `?raw` and `?inline` under `gtkx dev` and Vitest, as they already could in `gtkx build`, and `gtkx dev` restarts the app when any file a worker loaded changes. Vite's `?worker` and `?sharedworker` imports are rejected with an error pointing to `new Worker(new URL(...))` from `node:worker_threads`. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- `@gtkx/testing` and the MCP tools refuse input a user could not give: pointer helpers reject a widget behind an open `AdwDialog` or inside one whose `canTarget` is off, keyboard helpers reject a widget behind such a dialog, and the error names what blocks the target. Window shortcuts and application accelerators no longer run for keys pressed inside an open dialog or popover. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- Translation extraction passes `// Translators:` comments written before a `t` call or `Trans` element to translators as extracted comments, as xgettext does, and adds the summaries and descriptions of imported GSettings schemas to the catalogs. ([#927](https://github.com/gtkx-org/gtkx/pull/927))
- `withSignals` from `@gtkx/runtime` lets a class emit, connect and listen to its own declared signals on `this`, and signal methods on `this` typecheck against inherited signals. Registered classes accept their declared properties in `new`, are assignable to the interfaces they implement, and give `paramSpecBoxed` properties keys in `useProperty` and `GObject.getProperty`. Their own properties emit `notify` whenever their stored value changes, as in GJS. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- `createTabViewNavigator` in `@gtkx/navigation` keeps an `Adw.TabView`'s pages in navigation state: tabs open, close, select, reorder and pin through actions, screens mount lazily, and pages dragged in from another window are adopted. It takes `renderMenu` for a JSX tab context menu and `replaceLastTab` to replace a closed last tab. The split view navigator takes `collapseCondition` and exposes `useSplitViewCollapsed()`, and static navigator configs with callbacks such as `screenOptions` typecheck. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- The MCP server adds `gtkx_press_keys`, which presses keys and shortcuts such as `{Enter}` or `{Control>}s{/Control}`, and `gtkx_pointer`, which presses mouse buttons such as `[MouseRight]` to open context menus. `gtkx_search_api` and `gtkx_get_api_docs` find and return single class members, also by JSX element name, as in `GtkSourceView.showLineNumbers`. Widget summaries now report the accessible name as `name`; read `type` for the widget's type. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- `userEvent.keyboard` and the MCP `gtkx_press_keys` tool behave more like a real keyboard: `{Tab}` and arrow keys move focus, each key goes to the widget focused at that point, a target is focused before keys are pressed, and keys reach GTK's own key controllers. `{Escape}` closes popovers and dialogs, Enter or Space clicks a button on release, and `userEvent.keyboard("{Enter}")` without a target sends keys to the focused widget. `userEvent.type` inserts each character as its own edit. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- Generated bindings gain more of GJS's API. Functions GIR attaches to an enumeration or error domain are its statics (`Gio.DBusError.getRemoteError`), functions moved onto a class keep their flat name (`GLib.sourceRemove`), and enumerations carry their GType as `__type__`. `new` on a boxed record calls its `new` constructor (`new GLib.VariantType("s")`), embedded record fields read as views into their parent, and every `Gio.ActionMap` has `addActionEntries`. Importing a namespace calls its library's `init` when it takes only optional arguments, so GStreamer apps no longer need `Gst.init()`. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- Flatpaks built by `gtkx deploy` now target the GNOME 51 runtime unless `deploy.flatpak.runtimeVersion` names another branch; set it to `"50"` to keep the previous runtime. ([#947](https://github.com/gtkx-org/gtkx/pull/947))
- `ColumnView` columns take `hasExpander` to draw a tree's expander in that column, and `ListView`, `GridView` and `ListItemFactory` take `rowProps` to give rows accessible labels or make them unselectable, unactivatable or unfocusable. `GtkPopoverMenu`, `GtkPopoverMenuBar` and `GtkMenuButton` take `customChildren` to place widgets in menu items, and menu items accept the other GtkBuilder menu attributes. Construct-only object props accept JSX elements, such as `userContentManager={<WebKitUserContentManager />}` on a `WebKitWebView`. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- A prop an element does not have now throws, naming the closest prop it does have: `<GtkLabel lable="…">` fails with "Did you mean 'label'?" instead of being ignored. A misplaced child or a prop named after a widget method, such as `packStart={…}`, fails with the prop to use, and development builds warn when an element that shows one child holds several visible children. A custom element behavior must return the props it handles from `update`. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- `gtkx dev` keeps application state for more edits. Imported `.css` files and `injectGlobal` rules apply in the open window instead of restarting the app, and edits to non-component modules such as custom hooks, or to files imported with `?raw`, Fast Refresh the components that import them. An edited `injectGlobal` call adds its rules after the earlier ones, so a removed rule keeps applying until a restart. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- A package that is not an application, such as a component library, can leave out `applicationId` and run `gtkx codegen`, `gtkx storybook`, `gtkx docs`, `gtkx mcp` and its Vitest tests, as the new Component libraries guide section describes. `gtkx dev`, `gtkx storybook` and Vitest run dependencies that use `@gtkx/react` through Vite, and libraries can emit declarations for classes built with `withSignals`, whose base is now typed as `SignalBaseClass`. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- `gtkx upgrade` moves every GTKX package in a project or workspace, including pnpm catalog entries, to one release, installs, and fails naming any GTKX package left on another version. Without an argument it picks the newest release on the dist-tag the project follows. It exempts GTKX packages from the package manager's release-age gate and puts the changed files back when the install fails. Other commands warn when the installed GTKX packages are not all on one version, and GTKX packages now depend on each other with caret ranges. ([#927](https://github.com/gtkx-org/gtkx/pull/927))
- `Context` from `@gtkx/cairo` supports `using` and `[Symbol.dispose]()` to drop its native reference at once, as `cairo_destroy` does, and image surfaces count their pixel memory toward garbage collection, so code that creates surfaces every frame no longer grows to gigabytes. `LinearPattern`, `RadialPattern`, `MeshPattern` and `ToyFontFace` have working constructors. `copyPath()` and `copyPathFlat()` return a `Path`, as in GJS, which `Gsk.PathBuilder.addCairoPath()` accepts; call `toData()` to read its segments. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- Child slots are named after their GtkBuilder child types: `AdwToolbarView` takes `top` and `bottom`, `GtkOverlay` takes `overlay`, and `GtkListBox` gains a `placeholder` slot. The previous `topBar`, `bottomBar` and `overlays` props still work, are marked deprecated in the generated reference and are removed in 3.0. ([#894](https://github.com/gtkx-org/gtkx/pull/894))

### 🩹 Fixes

- Relative `url()` references and `@import` rules in imported `.css` files work in development, tests and builds, and `gtkx dev` and `gtkx build` warn about `url()` paths GTK cannot load. `?resource` imports bundle files of any type, and a `?resource` stylesheet no longer fails builds at random. `@gtkx/cli/env` types only the imports GTKX builds, so an asset import without a query no longer typechecks, and re-exporting an imported asset works. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- `quit()` ends applications that hold themselves and runs `onShutdown`, apps with `HANDLES_OPEN` render when launched with files, and a second launch hands over to the running instance quietly. The program name comes from the application ID before the entry runs, so `--help` and X11 window classes no longer say `node`. Rendering an application window outside an application element explains what is missing. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- A window mounted with `visible={false}` stays hidden, signal handlers hear what GTK does when a window is first shown, and closing windows with title bars or tab overviews no longer logs criticals. Removing a focused subtree moves focus as GTK would, and a `<GtkPopover>` inside a button attaches to it instead of crashing. JSX tab pages close when removed from state and stay selected when their content changes. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- The GTKX Vitest plugin keys Vitest's module cache on the configuration and the generated bindings, so tests pick up `gtkx.config.ts` changes and never load two copies of the bindings. Workers exit cleanly when cancelled by `bail` or a signal and stop leftover image loader processes, `render` turns caret blinking off so GLib idle callbacks run, and `isolate: false` is rejected with an explanation. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- The `style` prop types CSS custom properties and the longhands GTK accepts, such as `fontVariantNumeric`. `useProperty` on a non-null object no longer adds `undefined`, `useBindSetting` checks property names, `onNotify<Prop>` handlers are typed for object properties, and `@gtkx/react` exports `SettingsSchema` for describing system schemas. Classes that shadow an inherited method stay assignable to their parent types, and `<GtkDropTarget types>` accepts generated classes. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- Queries in `@gtkx/testing` follow GTK's accessible names more closely: they read `Gtk.AccessibleText`, match labels by `accessibleLabel`, name menu items without their accelerator, skip hidden popovers and match dialogs once their content is shown. Snapshots print the widget tree instead of empty objects, and widgets without children close in their own tag, so existing snapshots need updating once. `toBeVisible` fails for content its container does not show and says what hides the widget. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- Pointer helpers in `@gtkx/testing` act more like a real pointer: clicks report the button and held modifiers to `GtkGestureClick` and list selections, stop at a gesture that claims the press, and reach the nearest ancestor with a matching drag or drop controller. `userEvent.pointer` takes `[MouseRight]` and `[MouseMiddle]`, and clicks open drop-downs from their label, edit a `GtkEditableLabel` and select `AdwTabView` pages. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- `@gtkx/testing` cleanup quits the application a render started and releases held keys and buttons, and a test no longer fails when an error boundary catches an error. A throwing callback inside `act` no longer stops later renders, and `findBy*` queries accept wait options as a third argument. `render` without a container parents dialogs to the harness window, and loading `@gtkx/runtime` twice after `vi.resetModules()` throws an error that says so. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- The Storybook explorer supports `argTypes` `mapping` and `if`, hides stories tagged `!dev`, shows fractional number arguments and groups stories by title path. `gtkx storybook` reopens the current story after a restart, scrolls tall stories, skips `.mdx` files, accepts story globs in sibling workspace packages, logs story reloads and explains when `@gtkx/storybook` is missing. `composeStories` types stories that declare their own args. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- An exception from a main-loop callback no longer drops the other callbacks GLib dispatches in the same iteration, and closing a GLib descriptor whose number Node reused no longer aborts the process. Adaptive windows no longer crash on quit, record field access no longer allocates on every read, and list views over JavaScript models tear down at quit without warnings. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- The generated reference in `.gtkx/reference`, `gtkx docs` and the MCP tools documents the children slots of parent-created elements, inherited `acceptedChildTypes`, class structs such as `Gtk.WidgetClass`, the fields of configured prop types and construct-only props. Constructors show the class they return, and enum members and defaults use the names TypeScript exports. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- Removing a prop restores its default even when GIR records none, equal new values for construct-only props no longer throw, and replacing a native object prop or a slot's element keeps the parent's other props and user changes. `onNotify…` handlers hear changes caused by adding or removing children and receive values typed like the getter, and `AdwAlertDialog` responses update in place. A `<Suspense>` boundary inside a single-child element shows its content again after the fallback. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- MCP tools without `applicationId` answer from the `gtkx dev` app of the server's own project, also while it reconnects, and the Storybook explorer registers under the project's application ID with a `.Storybook` suffix. When the app fails to start or an error stops it, tools answer with that error, and `gtkx dev` reports errors raised during an MCP interaction as it does for real input. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- `gtkx_query_widgets` and `gtkx_get_widget_tree` search every open window, match accessible names and labels with `by: "name"`, and report widgets inside disabled containers as insensitive. Summaries include a text view's text and boxed values such as colors in string form. Tools reject arguments they do not declare, `gtkx_press_keys` says when a modifier stays held, and `gtkx_click` reports when nothing handled a click. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- Translation catalogs under `po/` stay stable: the template uses GNU gettext's layout, so deployment now requires `msgcat`, and comes from the production `applicationId` in development profiles. GTKX manages `po/` only when `@gtkx/i18n` is installed and accepts new locales without a known plural rule, and apps start under a locale the C library does not provide. Extraction reports every error in one run, skips story files, and accepts plurals whose English forms match when both are written out. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- `new GLib.Error(domain, code, message)` and `error.matches(domain, code)` accept generated error domains such as `Gio.IOErrorEnum`, as in GJS, and typecheck with every domain. Promisified methods such as `loadContentsAsync` reject with the `GLib.Error` again, so `instanceof` and `error.code` identify cancellations and dismissed dialogs. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- `@gtkx/forms` rows show as invalid when GTK clamps or shortens their value, and mark the field inside the row invalid for screen readers and `toBeInvalid()`. `@gtkx/animated` no longer freezes the app on a looping spring when animations are disabled, and keeps an app's own `skipAnimation` across reduced-motion changes. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- Source-mode Flatpak manifests build pnpm 12 and Yarn 4 projects offline, install the app's worker chunks and translations, and use the lockfile committed at the pinned revision; workspace members get an error asking for a standalone project. Prebuilt bundles include translations, and `deploy.signing.flatpak` signs the repository commit and the bundle. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- `gtkx dev` restarts the app instead of failing when an edit changes a construct-only prop, remounts the component that renders `AdwApplication`, or touches a module that calls `registerClass`, and names the non-component export that forced a restart. It also restarts when the lockfile or a GIR file the bindings came from changes, and survives installs that move, upgrade or unlink the GTKX packages it runs from. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- `gtkx dev` reports an error thrown while the app starts and keeps the dev server up, ends the app on an uncaught exception as a built app would, and points stack traces at the right source line. When the app quits with pending work, it warns what keeps the process alive. It stops with status 1 when another process owns the application ID, and prints fewer duplicate errors and Vite messages that do not apply. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- RPM packages require the shared libraries of the configured GIR libraries and no longer own system directories, and a deb deployment with an empty `deploy.depends.deb` names the libraries to cover. Packages leave GSettings schemas to the system so vendor overrides apply, `deploy.extraFiles` accepts directories, and `deploy.relations.breaks` and `preDepends` accept only `deb` entries. `--skip-build` accepts deploy-only configuration changes but stops on a build of another entry, and AppStream validation no longer fails on untranslated strings. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- `create-gtkx` installs the React, Vitest and type package majors GTKX supports with caret ranges rather than `latest`, and exempts GTKX packages from the release-age gate so projects created on a release day install. It accepts any directory name, deriving the package name, display name and application ID from it, and expands `~/`. New projects typecheck `gtkx.config.ts` and `vitest.config.ts`, include `@gtkx/testing` for MCP without pulling in Vitest, and register the MCP server in a workspace root's `.mcp.json`. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- `create-gtkx` sets up Yarn projects that install and run: it writes `nodeLinker: node-modules`, pins the Yarn release in `packageManager` and works under Plug'n'Play. A pnpm workspace gets the new app as a member, and inside pnpm, npm and Yarn workspaces the scaffold prints the root settings to add instead of writing app-level ones the package manager ignores. `--overwrite` keeps existing `.yarnrc.yml` and `pnpm-workspace.yaml` settings. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- `ListView`, `GridView`, `ColumnView`, `DropDown` and `ComboRow` keep rows mounted when items are inserted or moved, clear the selection when the selected item is removed, and no longer echo controlled `selectedIds` or `expandedIds` to their callbacks. Sectioned lists start at their first header and keep it when its first row is removed, and reordering columns keeps the sort. `DropDown` and `ComboRow` show a checkmark, ellipsize long items, support `useSubtitle` and `enableSearch`, and pass the full-list `index` while filtered. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- The `AGENTS.md` section that `gtkx codegen` writes lists only installed tools and stays unchanged after Prettier or oxfmt reformat it, and `agents.rules: false` and `agents.reference: false` remove what they turn off. New projects and `gtkx mcp init` register the MCP server as `npx --no gtkx mcp`, so a client never installs an unrelated `gtkx` package; rerun `gtkx mcp init` or add `--no` to existing entries. `gtkx mcp init --client codex` writes the project's `.codex/config.toml`. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- Configuration fields show their documentation in editors, including inside `$development` and `$production`, and each section has an exported type such as `DeployOptions`. Directory layers in `extends` load in every command, a missing `applicationId` reports "is required", and a relative `module` in `elements.config` resolves from the project root. Codegen finds Debian's multiarch GIR directory, libraries that fail to load report the linker's reason, and commands announce binding regeneration before it starts. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- `gtkx build` keeps line breaks in the minified bundle so a load error prints one line, names the source of an unresolvable import or a native addon, and produces the same worker chunk names in any checkout. It rejects `--out` inside the deploy directory and leaves linked workspace packages out of the third-party notices. GSettings schema summaries are available in bundles and AppImages, and identical schema copies are installed once. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- Bindings that could never work are no longer generated, including `Gio.InputStream.readAsync` (use `readBytesAsync`), the `GIRepository` `load*` methods and `Gio.DBusInterfaceSkeleton.vfuncGetVtable`. Type errors name what was passed and the property or signal involved, a bad vfunc return names the class and vfunc, and production bundles warn when tree shaking dropped a class an object needs. ([#964](https://github.com/gtkx-org/gtkx/pull/964))
- Generated bindings follow GIR and GJS more closely: nullable zero-terminated arrays return `null`, so `readLine` loops end, methods from typelib-generated GIR files receive their instance, and `GObject.signalEmitv` takes values. Reference-counted boxed callback arguments stay usable after the handler returns, `Gio.Settings` throws instead of aborting on a missing schema or key, and callbacks from other threads are skipped with a warning instead of crashing. `Gtk.Editable` delegates and interface property accessors take effect in registered classes. ([#964](https://github.com/gtkx-org/gtkx/pull/964))

### ❤️ Thank You

- Eugenio Depalo @eugeniodepalo

## 2.0.0-beta.12 (2026-10-21)

### 🚀 Features

- Export `flushSync` for native signals that synchronously return JSX-created objects. Preserve independently rendered tab content when its original window closes, and support parent-page relationships in JSX. ([#841](https://github.com/gtkx-org/gtkx/pull/841))
- Add `createTabCollection` for tabs that preserve React state when moved between windows. Support declarative tab pinning, extra drop targets, `textDirection`, About dialog metadata, and updates to custom layout callbacks. ([#841](https://github.com/gtkx-org/gtkx/pull/841))

  Preserve controlled values when JSX models or adjustments change, and retain page content through transfers and child replacement. Allow menu-button content alongside popovers, and update check-button accessible names when mnemonic handling changes.

  Load imported stylesheets in development and production, and reload stylesheet edits during development.

- Subscribe to GLib log messages with `onLog` from `@gtkx/runtime`, and use its `keepAlive` API for native work in helper processes. ([#831](https://github.com/gtkx-org/gtkx/pull/831))

  Create and stop MCP servers programmatically with `createMcpServer` from `@gtkx/mcp/server`, including custom transports. Cancel `runMcpServer` with an `AbortSignal`.

- Expand generated bindings to support nested string arrays, container input/output parameters, caller-allocated arrays, records passed by value, and callback-valued properties. Fix property, signal, and virtual-function argument conversion, and keep returned collections and Cairo paths usable after their source objects are collected. ([#831](https://github.com/gtkx-org/gtkx/pull/831))

### 🩹 Fixes

- Prevent failures when repeated object callbacks traverse large collections, including searches in `Gio.ListStore`. ([#779](https://github.com/gtkx-org/gtkx/pull/779))
- Preserve original error details when reporting asynchronous, Storybook, and MCP failures. ([#860](https://github.com/gtkx-org/gtkx/pull/860))
- Document configuration fields and nested options, preserve their descriptions in the API reference, and link declarations to their original source files on GitHub. ([#783](https://github.com/gtkx-org/gtkx/pull/783))
- Prevent crashes when native events schedule React transitions. ([#781](https://github.com/gtkx-org/gtkx/pull/781))
- Clarify package descriptions and search keywords for native rendering, generated bindings, testing, and application tooling. ([#859](https://github.com/gtkx-org/gtkx/pull/859))
- Hide inactive drawer and tab pages from assistive technologies, including preloaded pages, so screen readers expose only the focused screen. ([#778](https://github.com/gtkx-org/gtkx/pull/778))
- Allow tab and drawer labels to opt into keyboard mnemonics while preserving plain header titles and accessible names. Support native mnemonic activation in keyboard test interactions. ([#793](https://github.com/gtkx-org/gtkx/pull/793))
- Report a missing `sway` or `dbus-daemon` before tests, headless development, or headless Storybook sessions start, with an install command on recognized distributions. When creating a project with tests, `create-gtkx` lists any that are missing the same way. ([#870](https://github.com/gtkx-org/gtkx/pull/870))
- Wait for the headless compositor to accept connections before initializing its virtual input devices, preventing intermittent test worker startup failures. ([#835](https://github.com/gtkx-org/gtkx/pull/835))
- Restart development sessions when imported URL assets change so binary assets reload without being parsed as JavaScript, and recover when missing URL assets are recreated. ([#780](https://github.com/gtkx-org/gtkx/pull/780))
- Signal handlers see updated props when native property changes emit notifications during a React update. ([b45674d7](https://github.com/gtkx-org/gtkx/commit/b45674d7))
- Headless development and test sessions no longer require `setpriv`. After a forced termination, recover abandoned sessions on the next startup or with `gtkx cleanup`. ([#850](https://github.com/gtkx-org/gtkx/pull/850))
- Fix ComboRow crashes in production bundles, preserve native values when signal handlers return nothing, and marshal output parameters correctly in subclass signal handlers. ([#811](https://github.com/gtkx-org/gtkx/pull/811))

### ⚠️  Breaking Changes

- Always run headless displays on Sway, removing the Vitest plugin's `compositor` option and the `CompositorId` type. Delete the option and any `CompositorId` imports; tests need Sway installed. ([#870](https://github.com/gtkx-org/gtkx/pull/870))
- Publish generated bindings through one snapshot, regenerate legacy stores, and remove obsolete JSX during GI-only generation. Restart development apps for import or bundled-asset changes while retaining Fast Refresh for component edits. Simplify configuration dependency tracking and translation extraction. ([#863](https://github.com/gtkx-org/gtkx/pull/863))
- For applications using generated bindings without React, replace `createApplication(ApplicationClass, props)` and `ApplicationClass.create(props)` with `new ApplicationClass(props)`. Use `getIsRegistered()` and `getIsRemote()` in place of registration-state helpers, and observe completion through `runAsync(argv)`. Pass an argument array or `null`; omitting the argument is an error. The associated application helper types are removed. React applications continue to declare their application in JSX. ([#813](https://github.com/gtkx-org/gtkx/pull/813))

  Replace the removed `runApplication` and `quitApplication` helpers with applications' `runAsync(argv): Promise<number>` and `quit()` methods. `RunApplicationResult` is removed. Node remains the outer event loop. Applications finish automatically when no application windows or outstanding JavaScript holds remain, respecting inactivity timeouts and the initial service grace period. Balance `hold()` with `release()` to keep background work alive, or call `quit()` to force shutdown. GTKX cannot observe holds acquired directly by native C code.

  Replace `toVariant` and `fromVariant` with GJS-style `GLib.Variant` construction and unpacking methods. Dictionaries use objects for every key type; 64-bit values remain exact bigints. Import Variant types from `@gtkx/gi/glib`; the byte-array type is now `VariantByteArray` and conversion options types are removed.

  Replace `GObject.paramSpecOverride` with `GObject.ParamSpec.override`.

  Generated methods support nullable receivers where declared by GIR.

- Remove the generated `GObject.Closure.sink()` and `GObject.ParamSpec.sink()` methods. Delete these calls from applications; reference management is automatic. ([#840](https://github.com/gtkx-org/gtkx/pull/840))
- Require ESM for application and configuration modules, including generated bindings. Convert local CommonJS files to ESM and use erasable TypeScript in configuration. Storybook main configuration accepts `.ts`, `.mts`, `.js`, and `.mjs`; previews and stories retain JSX support. External CommonJS dependencies remain supported through ESM imports. ([771acfea](https://github.com/gtkx-org/gtkx/commit/771acfea))

### ❤️ Thank You

- Eugenio Depalo @eugeniodepalo
- eugeniodepalo @eugeniodepalo

## 2.0.0-beta.11 (2026-09-27)

### 🚀 Features

- Add a native Storybook explorer with controls, actions, live story updates, and portable CSF3 fixtures. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#655](https://github.com/gtkx-org/gtkx/pull/655).

- Update dependencies for React 19.3 and Vite 8.3, support pnpm 12 in offline Flatpak builds, and bundle Node.js 26.8.2 by default. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#672](https://github.com/gtkx-org/gtkx/pull/672).


### 🩹 Fixes

- Update JavaScript and Rust dependencies and CI actions. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#689](https://github.com/gtkx-org/gtkx/pull/689).

- Strengthen ESLint policy and package type dependencies, correct native build caching, and verify staged release artifacts and complete package channel promotion. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#765](https://github.com/gtkx-org/gtkx/pull/765).

- Fix GitHub release draft validation and retry handling before publishing packages. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))
- Polish GTKX 2.0 foundations, framework packages, navigation, forms, components, tutorials, code generation, development tooling, deployment, native ownership, integration testing, runtime contracts, examples, declarative integration, GTK Demo, and application behavior. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#699](https://github.com/gtkx-org/gtkx/pull/699).

- Replace native pointer integers with lifetime-checked handles, move class and call policy into the runtime, and centralize generated override implementations and shared metadata. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#699](https://github.com/gtkx-org/gtkx/pull/699).

- Validate and read build and deploy ownership markers through one file descriptor. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#720](https://github.com/gtkx-org/gtkx/pull/720).

- Publish package-specific READMEs and clarify public API documentation. Clarify CLI and inspection-tool help, and use Linux in the scaffolded application description. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#763](https://github.com/gtkx-org/gtkx/pull/763).

- Reduce temporary allocations in native calls and accessibility queries. Give drawer rows accessible names, and include inherited accessibility properties in generated JSX types and reference documentation. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#764](https://github.com/gtkx-org/gtkx/pull/764).

- Update JavaScript and Rust dependencies. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#698](https://github.com/gtkx-org/gtkx/pull/698).

### ⚠️  Breaking Changes

- Consolidate Toast controls into `useToast().show()` and `useToast().dismissAll()`, with individual dismissal through the returned toast. Restrict native exports to supported operations, move the generated wrapper-retention helper to the runtime internal entrypoint, isolate testing renderer errors by root, and centralize configuration dependency tracking. Allow TODO/FIXME comments and link upstream workarounds to their removal trackers. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Restrict synthetic record construction to supported initialization contracts, preserve field-allocation cleanup, and expose `GLib.String` storage fields as readonly. Native bigint codecs require bigint inputs; runtime bindings continue normalizing valid Number inputs. Render persistent collection models through JSX and share native-addon resolution between build and deployment.

  Original change: [#759](https://github.com/gtkx-org/gtkx/pull/759).

### ❤️ Thank You

- Eugenio Depalo @eugeniodepalo

## Earlier releases

Release notes for 2.0.0-beta.10 and earlier are on [GitHub Releases](https://github.com/gtkx-org/gtkx/releases).
