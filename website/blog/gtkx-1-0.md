---
title: "GTKX 1.0: The React framework for Linux"
description: "GTKX renders native GTK4 and Adwaita applications from React on Linux. In 1.0 the element surface is generated on your machine from the GObject-Introspection data your development packages already install, so every widget on the system is a typed JSX element, with its properties as props and its signals as handlers."
image: /tasks-screenshot.png
---

# GTKX 1.0

<p class="post-date">August 4, 2026</p>

After months of hard work, GTKX 1.0 is finally out.

GTKX is the React framework for Linux. It provides the missing declarative layer on top of the already mature GTK4 APIs: you write JSX, and GTKX creates GObject instances.

In regular GTK development, GtkBuilder XML lays out an interface, but the tree it builds is fixed: keeping it in sync with your application state is imperative code you write yourself, and nothing refreshes the window as you work. Reaching GTK4 from JavaScript has meant GJS, a separate runtime cut off from npm, or wrapping the desktop around a browser. If you know React, GTKX gives you the Linux desktop without shipping one; if you know GTK, it gives you re-rendering, Fast Refresh, and npm without leaving the platform.

Scaffold an app and the rest of this post is what you get:

```bash
npm create gtkx
```

It needs Linux, Node.js 24 or later, and the GTK4 and GLib development packages. [Getting Started](/guide/getting-started) covers the first run.

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

React here is stock React 19, not a dialect: hooks, context, Suspense, portals, and the React Compiler behave the way they do in any other renderer.

The app is an ordinary Node.js process. `node:fs`, `fetch`, timers, and the npm registry all work: the Tasks app in the [tutorial](/tutorial/) keeps its state in `zustand` and writes it to disk with `node:fs`. Gio comes in only where the desktop is the point: GSettings, notifications, and actions. GTK and your JavaScript share one thread.

<picture>
  <source srcset="/tasks-screenshot.webp" type="image/webp" />
  <img src="/tasks-screenshot.png" width="900" height="600" loading="lazy" alt="The Tasks app: an adaptive Adwaita window with a sidebar of smart views and colored user lists on the left, and a boxed task list on the right." />
</picture>

*The tutorial's Tasks app. All driven declaratively by GTKX.*

This is Linux only. If you want one codebase across desktop platforms, GTKX is the wrong tool. The narrowness is the point: targeting one platform is what lets GTKX expose the whole toolkit instead of the subset every platform shares.

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

`import { WebKitWebView } from "@gtkx/jsx/webkit"` then resolves, with `WebKit.WebView`'s full method set behind its `ref`; the [`browser`](https://github.com/gtkx-org/gtkx/tree/main/examples/browser) example is that one entry grown into a small web browser.

## Every GObject is an element, every property is a prop

What generation buys is coverage without invention. A row from the tutorial's task list, trimmed to its check button and its drag-to-reorder controllers:

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

All GObjects are built as JSX, nothing is imperative if it doesn't need to be.

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

Cost tracks the viewport rather than the result set. Syncing a million rows through that `items` prop was 2,228 ms and roughly 891 MB of resident memory in v0; in 1.0 it is 277 ms and 111 MB.

`GridView`, `ColumnView`, and `DropDown` get the same treatment. `ListView` and `ColumnView` also group items under section headers and expand nested ones into a tree; `DropDown` takes the section headers, and `GridView` stays flat. Cell recycling stays native, and React state inside a cell behaves normally. [`@gtkx/components`](/guide/components) also carries Adwaita's combo row and a toast provider.

## There is no mock GTK

`@gtkx/testing` queries the accessibility tree the way Testing Library queries the DOM, and `userEvent` checks that a widget is sensitive, mapped, allocated, and in an active window before it interacts with it, so a test fails, naming the condition that was not met, instead of silently doing nothing:

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

`gtkx docs` emits reference pages for the elements your own project generated, with the props, signal handlers, and `ref` methods each one actually has. The [`@gtkx/mcp`](/guide/mcp) server exposes those same pages to an agent and lets it read the widget tree of the running app, query it, and click through it. Shipping the thing is documented too: a [desktop entry and an AppStream file](/tutorial/packaging), then a [Flatpak manifest and a Flathub submission](/tutorial/flatpak).

## What 1.0 means

The generated elements and their prop rules, `gtkx.config.ts`, and the element behavior contract are frozen. So are the surfaces this post has been using around them: the hooks and `createRoot` in `@gtkx/react`, the components, `@gtkx/testing`, `@gtkx/css`, `@gtkx/gl`, and `registerClass` in `@gtkx/runtime`. Breaking changes are out for the 1.x line. A minor release may bind more of what GIR describes and add behaviors, and upgrading regenerates what is under `node_modules/.gtkx` without renaming any of it.

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

with the application itself now an element you render. The changes are mechanical. The [v1.0.0 release notes](https://github.com/gtkx-org/gtkx/releases/tag/v1.0.0) list them in full, and [Getting Started](/guide/getting-started) documents the current shape end to end.

## What's next

1.0 freezes the surface, not the pace. The [roadmap](https://github.com/orgs/gtkx-org/projects/1) is public, and the next items are scoped: a [`gtkx deploy`](https://github.com/gtkx-org/gtkx/issues/477) command that builds and publishes to Flatpak or DEB/RPM (shipped in [1.1](/blog/gtkx-1-1)), [`@gtkx/animated`](https://github.com/gtkx-org/gtkx/issues/478) on top of React Spring (shipped in [1.3](/blog/gtkx-1-3)), [`@gtkx/navigation`](https://github.com/gtkx-org/gtkx/issues/479) on top of Adwaita and React Navigation (shipped in [1.4](/blog/gtkx-1-4)), and [`@gtkx/forms`](https://github.com/gtkx-org/gtkx/issues/480) for React Hook Form-driven Adwaita forms. If something else should come first, say so on the [issue tracker](https://github.com/gtkx-org/gtkx/issues); that is how the list gets ordered.

## Thanks, and where to start

GTKX is a thin layer over other people's work: GTK and the GNOME platform, GObject-Introspection, libffi, React and `react-reconciler`, and napi-rs. Thank you also to everyone who filed, tested, and argued through the [release candidates](https://github.com/gtkx-org/gtkx/releases).

The [guide](/guide/why-gtkx) covers the rest. Run `npm create gtkx`, give the [tutorial](/tutorial/) an afternoon, and it will take you from an empty directory to a Flathub submission. If you already have a GTK4 application, port one dialog and [file what breaks](https://github.com/gtkx-org/gtkx/issues). Questions go to [GitHub Discussions](https://github.com/gtkx-org/gtkx/discussions), and [CONTRIBUTING.md](https://github.com/gtkx-org/gtkx/blob/main/CONTRIBUTING.md) is the door in.
