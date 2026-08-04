---
title: "GTKX 1.0"
description: "GTKX renders native GTK4 and Adwaita applications from React on Linux. In 1.0 the element surface is generated on your machine from the GObject-Introspection data your development packages already install, so every widget on the system is a typed JSX element, with its properties as props and its signals as handlers."
head:
  - - meta
    - property: og:type
      content: article
---

# GTKX 1.0

<p class="post-date">August 4, 2026</p>

GTKX 1.0 is out.

React drives real GTK4 widgets. `GtkApplicationWindow` is a `GtkApplicationWindow`, `cssClasses` sets the widget's `css-classes` property, and `onClicked` connects to the button's `clicked` signal. There is no web view and no parallel widget tree: you write JSX, and GTKX creates GObject instances typed against the GObject-Introspection data installed on your own machine.

1.0 settles the API. The generated elements and their prop rules, `gtkx.config.ts`, and the element behavior contract are what the 1.x line builds on.

```bash
npm create gtkx
```

## A whole application

This is the [`hello-world`](https://github.com/gtkx-org/gtkx/tree/main/examples/hello-world) example with its entry point folded in:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, quit } from "@gtkx/react";
import { useState } from "react";

const Counter = () => {
    const [count, setCount] = useState(0);

    return (
        <GtkApplicationWindow title="Hello GTKX" defaultWidth={400} defaultHeight={300} onCloseRequest={quit}>
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={20}
                marginTop={40}
                marginBottom={40}
                marginStart={40}
                marginEnd={40}
                valign={Gtk.Align.CENTER}
                halign={Gtk.Align.CENTER}
            >
                <GtkLabel cssClasses={["title-1"]}>Welcome to GTKX!</GtkLabel>
                <GtkLabel cssClasses={["title-2"]}>{`Count: ${String(count)}`}</GtkLabel>
                <GtkButton
                    label="Increment"
                    onClicked={() => {
                        setCount((c) => c + 1);
                    }}
                    cssClasses={["suggested-action", "pill"]}
                />
            </GtkBox>
        </GtkApplicationWindow>
    );
};

const App = () => (
    <GtkApplication>
        <Counter />
    </GtkApplication>
);

createRoot().render(<App />);
```

Everything in it belongs to GTK4. `onCloseRequest` is the window's `close-request` signal, `defaultWidth` is its `default-width` property, `cssClasses` is `Gtk.Widget`'s own array of style classes, and `title-1` and `suggested-action` are names from the stylesheet GTK4 ships. The accessibility tree, the input methods, and the compositor integration are the toolkit's, because the widgets are the toolkit's.

The process is an ordinary Node.js process. `node:fs`, `fetch`, timers, and the npm registry all work: the Tasks app in the [tutorial](/tutorial/) keeps its state in `zustand` and writes it to disk with `node:fs`, and reaches for Gio only where the desktop is the point, for GSettings, notifications, and actions. GTK and your JavaScript share one thread.

This is Linux only, and it hands you the native toolkit rather than hiding it. If you want one codebase across desktop platforms, GTKX is the wrong tool.

## Every GObject is an element, every property is a prop

A row from the tutorial's task list, trimmed to its check button and its drag-to-reorder controllers:

```tsx
<AdwActionRow
    title={title}
    useMarkup
    subtitle={formatDue(task.due) ?? undefined}
    activatable
    onActivated={() => openTask(task.id)}
    prefix={
        <GtkCheckButton
            valign={Gtk.Align.CENTER}
            active={task.done}
            accessibleLabel="Mark complete"
            onToggled={(self) => setDone(task.id, self.active)}
        />
    }
    controllers={
        <>
            <GtkDragSource
                actions={Gdk.DragAction.MOVE}
                onPrepare={(x, y, self) => {
                    const row = self.getWidget();
                    if (row) self.setIcon(Gtk.WidgetPaintable.new(row), Math.round(x), Math.round(y));
                    return Gdk.ContentProvider.newForValue(
                        GObject.buildValue(GObject.TYPE_STRING, (value) => value.setString(task.id)),
                    );
                }}
            />
            <GtkDropTarget
                actions={Gdk.DragAction.MOVE}
                types={[GObject.TYPE_STRING]}
                onDrop={(value) => {
                    const draggedId = value.getString();
                    if (draggedId) reorder(draggedId, task.id);
                    return true;
                }}
            />
        </>
    }
/>
```

That is drag and drop between rows with no imperative wiring, and almost every name in it is GTK4's or Adwaita's. The exceptions are `controllers` and `prefix`, GTKX's names for children a widget takes through a method call rather than a property. Event controllers are children, so they are added and removed with the row that owns them. `onPrepare` and `onDrop` carry the signals' real parameters with the emitting object last, and `self.getWidget()` returns a `Gtk.Widget` because the handler is typed against the drag source class.

The prop surface follows the GIR and nothing else. A property that is writable, construct, or construct-only becomes a camelCase prop carrying the upstream documentation as JSDoc. Almost every introspectable property gets an `onNotifyX` handler, read-only ones included, which is how you observe what GTK4 changes on its own. A writable, non-construct-only property whose type is a GObject class also accepts an element, so a controller, a drag source, a breakpoint, and a row's prefix widget are written where they belong instead of being assembled in setup code, and `sidebar={<AdwNavigationPage ... />}` mounts and assigns in one place. Every element takes a `ref` typed to its `@gtkx/gi` class, GIO's callback-and-finish pairs are promises you `await`, and GIR error domains are `instanceof` right-hand sides: `error instanceof Gtk.DialogError && error.code === Gtk.DialogError.DISMISSED`.

Surfaces that have no parent are elements too. `createPortal(<GtkWindow transientFor={parent} />, rootElement)` puts a second window on screen, and mounting an `AdwDialog` presents it while unmounting closes it, so a modal is a conditional render. The [modals and portals guide](/guide/modals-and-portals) covers both.

In v0 you could only write the widgets GTKX had listed, and a window closed on `onClose`, a prop GTKX invented, rather than on the signal GTK4 emits.

## Those elements are generated on your machine

Which widgets you can write is decided by your system, not by GTKX. The CLI reads the `.gir` files your development packages already install, and emits `@gtkx/gi/<namespace>` (typed classes, enums, and functions) and `@gtkx/jsx/<namespace>` (elements and their props) into `node_modules/.gtkx`. Neither is published to npm. You declare what you want bound:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    libraries: ["Gtk-4.0", "Adw-1"],
    applicationId: "com.gtkx.tutorial",
});
```

Adding WebKit is the array, plus the development package:

```ts
libraries: ["Gtk-4.0", "Adw-1", "WebKit-6.0"],
```

`import { WebKitWebView } from "@gtkx/jsx/webkit"` then resolves, with `WebKit.WebView`'s full method set behind its `ref`. Transitive namespaces come along on their own, so declaring those pulls in Gio, GLib, GObject, Gdk, Gsk, Pango, Graphene, and Cairo. `libraries: "*"` binds every introspection library on the system. The types cannot drift from the calls they describe, and they regenerate when your system libraries move underneath you.

In v0 you installed `@gtkx/ffi`, a fixed namespace list: GTK4, Adwaita, WebKit, GtkSourceView, VTE, GES and their dependencies. Every app carried all of it whether it used it or not, the bound API could differ from the GTK4 actually on the machine, and binding a library GTKX had not vendored meant waiting for someone else to vendor it. The ceiling was somebody else's list.

## Where the generated surface stops

Property setting cannot express everything GTK4 does. Adding a child is `insertChildAfter` on a `GtkBox` and `addTopBar` on an `AdwToolbarView`; a scale's marks have no property at all. So those cases are handled by behaviors, and you can write your own: a behavior attaches to a GLib type, supplies the lifecycle hooks, and subtypes inherit it. GTK4's named-cursor API is a method with no property behind it, and teaching it to every widget is a behavior and a prop declaration:

```ts
// src/elements.ts
import type * as Gtk from "@gtkx/gi/gtk";
import { defineBehavior, defineElements } from "@gtkx/react/config";

export default defineElements({
    GtkWidget: {
        behaviors: [
            defineBehavior<Gtk.Widget>({
                update: (widget, prev, next) => {
                    if (!Object.is(prev.cursorName, next.cursorName) && typeof next.cursorName === "string") {
                        widget.setCursorFromName(next.cursorName);
                    }
                    return ["cursorName"];
                },
            }),
        ],
    },
});
```

```ts
declare module "@gtkx/jsx/gtk" {
    interface GtkWidgetProps {
        cursorName?: string | null | undefined;
    }
}
```

Point `elements.behaviors` at that module and every widget accepts `cursorName`. Your behaviors are consulted before the built-in ones, so you can override how GTKX already handles a prop.

Below JSX, `registerClass` from `@gtkx/runtime` turns a TypeScript class extending a generated wrapper into a real GType, with GObject properties and `vfunc` overrides that chain up through `super`. The [subclassing guide](/guide/subclassing) covers it.

In v0, a widget whose children were not plain properties could not be added from your own project: it took a GTKX release.

## The packages you import

Some widgets carry an imperative API that props alone cannot reach, so for those you use a component instead of the raw element. The collection views replace a model plus factories with data and a renderer, and keep selection in React state:

```tsx
<ListView<Task>
    items={tasks.map((task) => ({ id: task.id, value: task }))}
    selectionMode={Gtk.SelectionMode.MULTIPLE}
    selectedIds={selectedIds}
    onSelectionChanged={setSelectedIds}
    estimatedItemHeight={56}
    renderItem={({ item }) => <GtkLabel halign={Gtk.Align.START}>{item.title}</GtkLabel>}
/>
```

`GridView`, `ColumnView`, and `DropDown` get the same treatment. `ListView` and `ColumnView` also group items under section headers and expand nested ones into a tree; `DropDown` takes the section headers, and `GridView` stays flat. Cell recycling stays native, and React state inside a cell behaves normally. Cost tracks the viewport rather than the result set: syncing a million rows was 2,228 ms and roughly 891 MB of resident memory, and it is 277 ms and 111 MB now. [`@gtkx/components`](/guide/components) also carries Adwaita's combo row and a toast provider.

[`@gtkx/css`](/guide/css) is Emotion-style CSS-in-JS compiled to GTK4's own CSS engine. [`@gtkx/gl`](/guide/opengl) covers the OpenGL 4.6 core profile for what you draw inside a `GtkGLArea`. The generic state queries are missing (`getIntegerv` and its siblings, whose output length depends on the token you pass), so you reach for the typed getters instead: `getShaderiv`, `getProgramiv`, `getBufferParameteriv`, and the rest. The hooks in `@gtkx/react` bring GObject state into React: `useProperty` and `useSignal` for any object, `useSetting` and `useBindSetting` for GSettings keys, `useApplication` and `useParentWindow` for the tree above you.

## Tests drive the real widgets

There is no mock GTK. `@gtkx/testing` queries the accessibility tree the way Testing Library queries the DOM, and `userEvent` checks that a widget is sensitive, mapped, allocated, and in an active window before it interacts with it, so a test fails naming the condition that was not met instead of silently doing nothing:

```tsx
it("adds a task from the entry row", async () => {
    await render(<App />, { container: rootElement });

    const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
    await userEvent.type(entry, "Book flights");
    await userEvent.keyboard(entry, "{Enter}");

    expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Book flights" })).toBeDefined();
});
```

The drag and drop from the task row above is testable the same way, with `userEvent.dragAndDrop(source, target, "t2")`. `@gtkx/vitest` gives every worker its own headless Wayland compositor, session bus, and stub notification service, so test files cannot interfere through shared display state. Set `G_DEBUG=fatal-criticals` in your Vitest config's `env` and a GLib critical fails the test instead of becoming a line you scroll past. The [testing guide](/guide/testing) has the query and matcher surface.

## The loop around the code

`gtkx dev` patches the running window through Fast Refresh and restarts the app when a change is not patchable. `gtkx build` bundles to `dist/bundle.js`. React Compiler runs over your sources unless you turn it off.

Assets imported through `#data/*` are staged, compiled with `glib-compile-resources`, and registered at startup, so an import gives you a `resource://` URI and changing the file re-registers the bundle without a restart. A GSettings schema is an import too, and its keys are typed:

```ts
import { useSetting } from "@gtkx/react";
import schema from "#data/com.gtkx.tutorial.gschema.xml";
import { type SortOrder, SortValue } from "../types.js";

export const useSortOrder = (): [SortOrder, (order: SortOrder) => void] => {
    const [value, setValue] = useSetting(schema, "sort-order");
    return [SortValue[value] as SortOrder, (order) => setValue(SortValue[order])];
};
```

`gtkx docs` emits reference pages for the elements your own project generated, with the props, signal handlers, and `ref` methods each one actually has. The [`@gtkx/mcp`](/guide/mcp) server serves those same pages to an agent and lets it read the widget tree of the running app, query it, and click through it. The tutorial ends at a [desktop entry and an AppStream file](/tutorial/packaging), then a [Flatpak manifest and a Flathub submission](/tutorial/flatpak), so shipping the thing is documented too.

## What 1.0 means

The surfaces named at the top of this post are frozen. A minor release may bind more of what GIR describes and add behaviors, and upgrading regenerates what is under `node_modules/.gtkx`. It will not rename what is there.

`@gtkx/native` ships prebuilt for x64 and arm64 glibc Linux only. On anything else, including musl, you build it from the repository with a Rust toolchain, and `npm install` will not do it for you.

## Coming from v0

Almost every import path moved. Widgets come from `@gtkx/jsx/<namespace>` instead of `@gtkx/react`, classes and enums from `@gtkx/gi/<namespace>` instead of `@gtkx/ffi/<namespace>`, and configuration from `gtkx.config.ts` instead of a `package.json` field. The minimum Node.js is 24. Mounting changed shape:

```diff
-import { render } from "@gtkx/react";
-import pkg from "../package.json" with { type: "json" };
+import { createRoot } from "@gtkx/react";
 import { App } from "./app.js";

-render(<App />, pkg.gtkx.appId);
+createRoot().render(<App />);
```

with the application itself now an element you render. The changes are mechanical, and the CLI names the `.gir` file it could not find when a system introspection package is missing. [Getting Started](/guide/getting-started) documents the current shape end to end.

## Thanks, and where to start

GTKX is a thin layer over other people's work: GTK and the GNOME platform, GObject-Introspection, libffi, React and `react-reconciler`, and napi-rs. Thank you also to everyone who filed, tested, and argued through the release candidates.

The [guide](/guide/why-gtkx) covers the rest. Run `npm create gtkx`, give the [tutorial](/tutorial/) an afternoon, and it will take you from an empty directory to a Flathub submission. If you already have a GTK4 application, port one dialog and file what breaks.
