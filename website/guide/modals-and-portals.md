---
title: "Modals and Portals"
description: "Rendering surfaces that live outside the widget tree: portals, windows, and Adwaita dialogs."
---

# Modals and Portals

Portals let a component render children into a container other than its JSX parent, while it keeps owning those children's state, props, and lifetime.

## createPortal

`createPortal` from `@gtkx/react` has the same signature as its React DOM namesake, with GTK4 containers in place of DOM nodes:

```ts
createPortal(children: ReactNode, container: GObject.Object | RootElement, key?: string): ReactPortal
```

The container is any live `GObject.Object`, or `rootElement` (also exported from `@gtkx/react`), the marker that mounts children at the top level with no GTK4 parent.

The container has to exist before the portal can target it, so capture it in state rather than a plain ref, which makes the portal render as soon as the widget is created:

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

Portal children stay in the *React* tree of the component that rendered them, so context, state, and effects flow from where the portal is written, not from where the widgets land.

## Windows

Windows portal themselves. A window element mounts at the top level wherever it sits in the JSX, so opening one is a conditional render:

```tsx
import { GtkApplicationWindow } from "@gtkx/jsx/gtk";

const MirrorWindow = ({ open }: { open: boolean }) =>
    open ? <GtkApplicationWindow title="Mirror" defaultWidth={400} defaultHeight={300} /> : null;
```

A window element presents itself on mount and destroys the window on unmount. `GtkApplicationWindow` registers with the `GtkApplication` ancestor it finds in the React tree, and throws when there is none. Relationships between top-level windows are expressed with `transientFor`, which `GtkWindow` defaults to the nearest window ancestor in the React tree; pass it explicitly to point at another window, or pass `null` for a fully independent one.

Wire `onCloseRequest` to clear the state that mounted a secondary window, so React stays in charge of when it goes away.

## Dialogs

Mounting an `AdwDialog`, or any element derived from it, presents the dialog; unmounting it closes the dialog. These elements come from `@gtkx/jsx/adw`, which exists once `Adw-1` is bound — a scaffolded project binds it from the start.

```tsx
import { AdwDialog } from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";

const Notice = ({ onClose }: { onClose: () => void }) => (
    <AdwDialog onClosed={onClose} title="Notice">
        <GtkLabel>Nothing to report.</GtkLabel>
    </AdwDialog>
);
```

Reach for `AdwDialog` when a plain surface is enough, and for a more specific element such as `AdwAlertDialog` or `AdwPreferencesDialog` when you want its behavior. Each carries the same contract and takes its own props and children directly. A plain `AdwDialog`'s children fill its whole surface, while a specialized one places them where its own layout expects: `AdwPreferencesDialog` takes `AdwPreferencesPage` children.

Set `canClose={false}` when the dialog is not ready to go away, and handle `onCloseAttempt` to decide what happens instead. Unmounting still closes the dialog unconditionally.

`AdwAlertDialog` is the message-and-buttons modal. Its `heading` and `body` props are plain strings, it takes a declarative `responses` array, and the chosen button's `id` arrives on `onResponse`:

```tsx
import * as Adw from "@gtkx/gi/adw";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { GtkEntry } from "@gtkx/jsx/gtk";

const RenameDialog = ({ onResponse }: { onResponse: (id: string) => void }) => (
    <AdwAlertDialog
        heading="Rename"
        body="Pick a new name for this list."
        defaultResponse="rename"
        closeResponse="cancel"
        responses={[
            { id: "cancel", label: "Cancel" },
            { id: "rename", label: "Rename", appearance: Adw.ResponseAppearance.SUGGESTED },
        ]}
        onResponse={onResponse}
    >
        <GtkEntry placeholderText="List name" activatesDefault />
    </AdwAlertDialog>
);
```

Children fill the dialog's extra slot, below the heading and body and above the response buttons. `extraChild` is not part of the element's prop surface, so children are the only way to fill it.

## Finding the parent window

`useParentWindow()` from `@gtkx/react` returns the `Gtk.Window` provided by the nearest window ancestor, or `null` when there is none. It resolves through the React tree, so a dialog portaled out of a window's subtree still finds that window.

The tutorial builds these surfaces in [Mounting dialogs](/tutorial/actions-menus-shortcuts#mounting-dialogs), [Confirming a permanent delete](/tutorial/trash-and-toasts#confirming-a-permanent-delete), and [A dialog that is a form](/tutorial/trash-and-toasts#a-dialog-that-is-a-form). The exported API is in the [@gtkx/react reference](/reference/@gtkx/react/).

## Next

Continue with [Navigation](/guide/navigation) to move between screens with stack, tab, drawer, and split view navigators drawn by libadwaita.
