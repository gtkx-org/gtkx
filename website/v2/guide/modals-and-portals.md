---
title: "Modals and Portals"
description: "Rendering surfaces that live outside the widget tree: portals, windows, and Adwaita dialogs."
---

# Modals and Portals

GTKX windows and Adwaita dialogs handle their own native placement. Use `createPortal` for other objects that belong outside their surrounding widget container.

## createPortal

`createPortal` from `@gtkx/react` renders into a native object whose child-placement rules accept the content. Capture that target with a state callback ref:

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

Pass `rootElement` from `@gtkx/react` when the object needs React ownership without a native parent. The [async operations example](/v2/guide/async-operations#awaiting-async-operations) uses this for a file dialog.

See the [`createPortal` reference](/v2/reference/@gtkx/react/index/variables/createPortal) for GTKX's arguments, and React's [portal documentation](https://react.dev/reference/react-dom/createPortal) for context and component lifetime.

## Windows

Window elements present themselves on mount and destroy the native window on unmount. Render a secondary window conditionally:

```tsx
import { AdwApplicationWindow, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";

const MirrorWindow = ({ open }: { open: boolean }) =>
    open ? (
        <AdwApplicationWindow title="Mirror" defaultWidth={400} defaultHeight={300}>
            <AdwToolbarView topBar={<AdwHeaderBar />} />
        </AdwApplicationWindow>
    ) : null;
```

`AdwApplicationWindow` registers with its nearest application element, normally `AdwApplication`; it requires that ancestor. To associate it with another window, pass `transientFor` explicitly.

Plain `AdwWindow` and `GtkWindow` elements default `transientFor` to their nearest window ancestor. An explicit value selects another parent; `null` keeps the window independent.

Wire `onCloseRequest` to clear the state that mounted a secondary window, so React stays in charge of when it goes away.

## Dialogs

Adwaita dialog elements present on mount and close on unmount. Handle `onClosed` by clearing the state that rendered the dialog:

```tsx
import { AdwDialog } from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";

const Notice = ({ onClose }: { onClose: () => void }) => (
    <AdwDialog onClosed={onClose} title="Notice">
        <GtkLabel>Nothing to report.</GtkLabel>
    </AdwDialog>
);
```

Specialized dialogs keep the same lifecycle. Place their content in the supported JSX slots; for example, `AdwPreferencesDialog` takes `AdwPreferencesPage` children.

Set `canClose={false}` when the dialog is not ready to go away, and handle `onCloseAttempt` to decide what happens instead. Unmounting still closes the dialog unconditionally.

`AdwAlertDialog` takes plain-text `heading` and `body` values and a declarative `responses` array. Its `onResponse` prop receives the selected response ID:

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

Place extra content between the heading and response buttons as children, as shown by the entry above.

## Finding the parent window

`useParentWindow()` from `@gtkx/react` returns the nearest window once its native instance exists. It returns `null` while the instance is unavailable or when there is no window ancestor. The lookup follows component ancestry through portals, so portaled dialogs can still use their originating window.

The tutorial builds these surfaces in [Mounting dialogs](/v2/tutorial/actions-menus-shortcuts#mounting-dialogs), [Confirming a permanent delete](/v2/tutorial/trash-and-toasts#confirming-a-permanent-delete), and [A dialog that is a form](/v2/tutorial/trash-and-toasts#a-dialog-that-is-a-form). The exported API is in the [@gtkx/react reference](/v2/reference/@gtkx/react/).

## Next

Continue with [Navigation](/v2/guide/navigation) to move between screens with stack, tab, drawer, and split view navigators drawn by libadwaita.
