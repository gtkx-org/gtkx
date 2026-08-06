---
title: "Modals and Portals"
description: "How GTKX renders GTK4 surfaces that live outside the widget tree: createPortal, the rootElement container, the present-on-mount contract of Adwaita dialog elements, and extra windows."
---

# Modals and Portals

Portals let a component render children into a container other than its JSX parent, while it keeps owning those children's state, props, and lifetime.

## createPortal

`createPortal` from `@gtkx/react` has the same shape as its React DOM namesake, with GTK4 containers in place of DOM nodes:

```ts
createPortal(children: ReactNode, container: GObject.Object | RootElement, key?: string | null): ReactPortal
```

The container is either any live `GObject.Object` or the special `rootElement` marker described below. That definition is deliberately broad. The most common targets are:

- **A widget you hold a ref to.** The children are attached to that widget exactly as if they had been written as its JSX children, using the same generated container logic (append, insert, reorder) that regular children use.
- **`rootElement`**, the top-level container, for anything that should exist with no GTK4 parent at all.

Portaling into a widget looks like this. The container has to exist before the portal can target it, so capture it in state rather than a plain ref, which makes the portal render as soon as the widget is created:

```tsx
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { createPortal } from "@gtkx/react";
import { useState } from "react";

const StatusArea = () => {
    const [tray, setTray] = useState<Gtk.Box | null>(null);
    return (
        <>
            <GtkBox ref={setTray} />
            {tray && createPortal(<GtkLabel>Synced</GtkLabel>, tray)}
        </>
    );
};
```

React ownership carries over from React DOM: the children stay in the *React* tree of the component that rendered them, so context, state, and effects flow from where the portal is written, not where the widgets land. Multiple portals can target the same container, portal contents update when props change, and removing the portal unmounts and destroys its widgets.

::: info
GTKX uses this mechanism internally. The `ListView`, `GridView`, `ColumnView`, and `DropDown` components in `@gtkx/components` render your `renderItem` (or, for `ColumnView` columns, `renderCell`) output through portals into the cell containers that GTK4's list item factories create on demand. That is why fully declarative, stateful list cells work at all: each cell is a portal target.
:::

## The root element

`rootElement`, exported from `@gtkx/react`, is a singleton marker object, not a widget. It is the default container of `createRoot()`, which is why the entry point of a GTKX app passes no argument: the marker already names the top of the tree.

Portaling to `rootElement` means "mount this with no GTK4 parent." No attach call is made on the native side; the widget is created top-level. That is exactly what windows and dialogs need, since GTK4 forbids them from being parented into a layout. You never portal a window by hand, though: every window element portals itself. `GtkWindow` mounts at the top level no matter where it sits in your JSX, and `GtkApplicationWindow` mounts into the `Gtk.Application` of its nearest `GtkApplication` ancestor, which registers the window with the application. Rendering a `GtkApplicationWindow` without a `GtkApplication` ancestor throws.

Relationships between top-level windows are expressed with window properties instead, chiefly `transientFor`, and `GtkWindow` fills that in for you as well: when you do not pass the prop, it defaults to the nearest window ancestor in the React tree. A secondary window is just a conditional render:

```tsx
import { GtkWindow } from "@gtkx/jsx/gtk";

const DetachedPreview = ({ open }: { open: boolean }) =>
    open ? <GtkWindow title="Preview" defaultWidth={480} defaultHeight={360} /> : null;
```

The window has no widget parent (`getParent()` returns `null`), but `transientFor` is the hint window managers use to keep it stacked above its owner and center it over it. Pass the prop yourself to point it at a different window, or pass `null` to make the window fully independent; an explicit value always wins over the default.

## Declarative dialogs

Adwaita dialogs have an imperative API: you call `dialog.present(parent)` to show one and `dialog.forceClose()` to dismiss it. GTKX wraps `AdwDialog` and every element derived from it, so that protocol becomes a declarative React contract: **mounting the element presents the dialog, unmounting it closes the dialog.** These elements live in `@gtkx/jsx/adw`, which exists once `Adw-1` is in your `libraries`.

```tsx
import { AdwDialog } from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";

const Notice = ({ onClose }: { onClose: () => void }) => (
    <AdwDialog onClosed={onClose} title="Notice">
        <GtkLabel>Nothing to report.</GtkLabel>
    </AdwDialog>
);
```

Showing it is a conditional render, the same as any other element. Reach for `AdwDialog` when a plain surface is enough, and for a more specific element, such as `AdwAlertDialog` or `AdwPreferencesDialog`, when you want its behavior; each carries the same contract and takes its own props and children directly.

Set `canClose={false}` when the dialog is not ready to go away, and handle `onCloseAttempt` to decide what happens instead, for example prompting about unsaved edits. Unmounting still closes the dialog unconditionally, so React remains the final word on lifetime.

The tutorial works the same contract through a store field that names the dialog on screen, and routes `onClosed` back to that field so Escape and the close button leave the store honest: see [Mounting dialogs](/tutorial/actions-menus-shortcuts#mounting-dialogs).

## Alert dialogs

`Adw.AlertDialog` is the message-and-buttons modal. `AdwAlertDialog` turns its imperative `addResponse`/`setResponseAppearance` calls into a declarative `responses` array, and the chosen button's `id` arrives on `onResponse`.

The `responses` entry shape (`id`, `label`, `appearance`) and the `defaultResponse`/`closeResponse` safety pair are covered in [Confirming a permanent delete](/tutorial/trash-and-toasts#confirming-a-permanent-delete). The same chapter builds a form inside an alert dialog in [A dialog that is a form](/tutorial/trash-and-toasts#a-dialog-that-is-a-form).

## Finding the parent window

`useParentWindow()` from `@gtkx/react` returns the `Gtk.Window` provided by the nearest window ancestor in the React tree, or `null` when there is none. Every window element (anything GTKX wraps as a window, such as `GtkWindow`, `GtkApplicationWindow`, and `AdwApplicationWindow`) provides this context to everything it renders, including subtrees passed through element props like `titlebar`, `controllers`, and `actions`. Because the context follows the *React* tree, it survives portals: a dialog portaled to `rootElement` from deep inside a window's subtree still resolves that window as its parent, which is precisely how a dialog element anchors itself without being told where it is.

## Multiple windows

Windows carry their lifecycle in the element itself: on mount a window element calls `present()`, and on unmount it destroys the window. So a second window is another conditionally rendered element, mounted from wherever the owning state lives:

```tsx
import { GtkApplicationWindow } from "@gtkx/jsx/gtk";

const MirrorWindow = ({ open }: { open: boolean }) =>
    open ? <GtkApplicationWindow title="Mirror" defaultWidth={400} defaultHeight={300} /> : null;
```

It does not matter how deep in the tree the element sits: an application window finds its `GtkApplication` ancestor and registers with it, and a plain `GtkWindow` mounts as a standalone toplevel transient for its nearest window ancestor. Wire `onCloseRequest` to clear the state that mounted the window, so React stays in charge of when it goes away. Each window provides its own `useParentWindow()` context, so dialogs opened inside a secondary window anchor to that window automatically.

Every dialog and window element, along with its full prop surface, is covered by the element reference `gtkx docs` generates for your project.

## Next

Continue with [CSS](/guide/css) to style these surfaces with the `css` tagged template and GTK4's own CSS engine.
