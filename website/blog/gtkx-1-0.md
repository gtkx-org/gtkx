---
title: "GTKX 1.0: The React framework for Linux"
description: "GTKX 1.0 brings React and TypeScript to native Linux apps, with generated bindings, Fast Refresh, and integration tests."
image: /tasks-screenshot.png
---

# GTKX 1.0

<p class="post-date">August 4, 2026</p>

GTKX 1.0 is available.

GTKX is the React framework for Linux. It creates GObject instances from JSX using generated GTK4 bindings.

GTKX runs React on Node.js and renders native widgets. Components describe the interface for the current state, React updates the widget tree, and Fast Refresh applies edits to the running app. Node APIs and compatible npm libraries are available alongside GTK and Gio.

This post describes GTKX 1.0. To follow the maintained 1.x documentation, scaffold a 1.x app:

```bash
npm create gtkx@1
```

It needs Linux, Node.js 24 or later, and the GTK4 and GLib development packages. [Getting Started](/guide/getting-started) covers the first run.

## A whole application

This is the [`hello-world`](https://github.com/gtkx-org/gtkx/tree/v1.0.0/examples/hello-world) example with its entry point folded in:

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

GTKX uses React 19, including hooks, context, Suspense, portals, and the React Compiler.

The app is an ordinary Node.js process. The Tasks app in the [tutorial](/tutorial/) keeps state in `zustand` and writes it to disk with `node:fs`; Gio provides settings, notifications, and actions. Packages that require the browser DOM need adaptation. GTK and application JavaScript share one thread.

<picture>
  <source srcset="/tasks-screenshot.webp" type="image/webp" />
  <img src="/tasks-screenshot.png" width="900" height="600" loading="lazy" alt="The Tasks app: an adaptive Adwaita window with a sidebar of smart views and colored user lists on the left, and a boxed task list on the right." />
</picture>

_The Tasks app built in the tutorial._

GTKX targets Linux. It exposes native library APIs through generated bindings and GTKX integration code; it does not provide a renderer for other desktop platforms.

## The elements are generated on your machine

The CLI reads the `.gir` files installed on your system and emits `@gtkx/gi/<namespace>` (typed classes, enums, and functions) and `@gtkx/jsx/<namespace>` (elements and their props) into `node_modules/.gtkx`. Neither is published to npm. You declare what you want bound:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    libraries: ["Gtk-4.0", "Adw-1"],
    applicationId: "com.gtkx.tutorial",
});
```

Adding WebKit is one entry in that array, plus the development package:

```ts
libraries: ["Gtk-4.0", "Adw-1", "WebKit-6.0"],
```

`import { WebKitWebView } from "@gtkx/jsx/webkit"` then resolves, with `WebKit.WebView`'s full method set behind its `ref`; the [`browser`](https://github.com/gtkx-org/gtkx/tree/v1.0.0/examples/browser) example is that one entry grown into a small web browser.

## Generated elements and props {#every-gobject-is-an-element-every-property-is-a-prop}

Generated elements expose native properties and signals as JSX props. This row from the tutorial's task list uses a check button and drag-to-reorder controllers:

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

The row and controllers are declared in JSX. The synchronous drag handler creates the content provider it must return to GTK.

## Where the generated surface stops

Property setting cannot express everything GTK4 does. Adding a child is `insertChildAfter` on a `GtkBox` and `addTopBar` on an `AdwToolbarView`; a scale's marks have no property at all. Behaviors cover those cases, and you can write your own: a behavior attaches to a GLib type, supplies the lifecycle hooks, and subtypes inherit it. GTK4's named-cursor API is a method with no property behind it, and teaching it to every widget is a behavior and a prop declaration:

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

Below JSX, `registerClass` from `@gtkx/runtime` turns a TypeScript class extending a generated wrapper into a GType of its own, with GObject properties and `vfunc` overrides that chain up through `super`. The [subclassing guide](/guide/subclassing) covers it.

## What GTKX still writes by hand

Some widgets carry an API that is too complex to be handled by element behaviors, so for those you use a component instead of the raw element. The collection views replace a model plus factories with data and a renderer, and keep selection in React state:

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

The collection views create widgets for visible items and recycle them as the user scrolls. They still retain the item data supplied by the application.

`GridView`, `ColumnView`, and `DropDown` get the same treatment. `ListView` and `ColumnView` also group items under section headers and expand nested ones into a tree; `DropDown` takes the section headers, and `GridView` stays flat. Cell recycling stays native, and React state inside a cell behaves normally. [`@gtkx/components`](/guide/components) also carries Adwaita's combo row and a toast provider.

## Testing native widgets {#there-is-no-mock-gtk}

`@gtkx/testing` queries the accessibility tree using a Testing Library-style API. Before interacting, `userEvent` checks that a widget is sensitive, mapped, allocated, and in an active window. If a condition is unmet, the test reports it:

```tsx
it("adds a task from the entry row", async () => {
    await render(<App />, { container: rootElement });

    const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
    await userEvent.type(entry, "Book flights");
    await userEvent.keyboard(entry, "{Enter}");

    expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Book flights" })).toBeDefined();
});
```

The drag and drop from the task row above is testable the same way, with `userEvent.dragAndDrop(source, target, "t2")`. `@gtkx/vitest` gives every worker its own headless Wayland compositor, session bus, and stub notification service, so test files cannot interfere through shared display state. The [testing guide](/guide/testing) has the query and matcher surface.

## The dev loop

`gtkx dev` provides Fast Refresh and restarts the app when a change is not patchable. `gtkx build` bundles to `dist/bundle.mjs`. React Compiler runs over your sources unless you turn it off.

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

`gtkx docs` emits reference pages for the project's generated elements, including props, signal handlers, and `ref` methods. The [`@gtkx/mcp`](/guide/mcp) server exposes those pages to coding agents and provides tools to inspect and interact with the running app. The tutorial covers [desktop entries and AppStream metadata](/tutorial/packaging), then [Flatpak packaging and submission to Flathub](/tutorial/flatpak).

## What 1.0 means

The 1.0 release establishes the public APIs for generated elements, configuration, element behaviors, rendering, components, testing, styling, OpenGL, and subclassing. Later 1.x releases extend these APIs and bind additional GIR declarations. Check each release's upgrade notes for compatibility changes, including safety-related removals.

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

The application itself is now an element you render. The [v1.0.0 release notes](https://github.com/gtkx-org/gtkx/releases/tag/v1.0.0) list the migrations, and [Getting Started](/guide/getting-started) documents the maintained 1.x setup.

## What's next

The original [roadmap](https://github.com/orgs/gtkx-org/projects/1) items have since shipped: [`gtkx deploy`](https://github.com/gtkx-org/gtkx/issues/477) for application packaging in [1.1](/blog/gtkx-1-1), [`@gtkx/animated`](https://github.com/gtkx-org/gtkx/issues/478) for React Spring integration in [1.3](/blog/gtkx-1-3), [`@gtkx/navigation`](https://github.com/gtkx-org/gtkx/issues/479) for Adwaita and React Navigation in [1.4](/blog/gtkx-1-4), and [`@gtkx/forms`](https://github.com/gtkx-org/gtkx/issues/480) for React Hook Form integration in [1.5](/blog/gtkx-1-5). Planned work is tracked in [issues](https://github.com/gtkx-org/gtkx/issues).

## Thanks, and where to start

GTKX builds on GTK and the GNOME platform, GObject-Introspection, libffi, React and `react-reconciler`, and napi-rs. Thanks to their contributors and to everyone who tested and reported issues in the [release candidates](https://github.com/gtkx-org/gtkx/releases).

The [guide](/guide/why-gtkx) covers the rest, and the [tutorial](/tutorial/) builds a task manager through packaging and preparation for Flathub. Submission still requires a tested package and [Flathub review](https://docs.flathub.org/docs/for-app-authors/submission); the time depends on the application and requested changes.

If you already have a GTK4 application, try porting one dialog and [report problems](https://github.com/gtkx-org/gtkx/issues). Questions go to [GitHub Discussions](https://github.com/gtkx-org/gtkx/discussions); [CONTRIBUTING.md](https://github.com/gtkx-org/gtkx/blob/main/CONTRIBUTING.md) explains how to contribute.
