---
title: "Modals and Portals"
description: "Render windows, Adwaita dialogs, and objects outside their surrounding container."
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

See the [`createPortal` reference](/v2/reference/@gtkx/react/index/functions/createPortal) for GTKX's arguments, and React's [portal documentation](https://react.dev/reference/react-dom/createPortal) for context and component lifetime.

## Synchronous native callbacks

Some native signals need an object returned before their handler finishes. For example, `AdwTabOverview.onCreateTab` returns the new `Adw.TabPage`, and `AdwTabView.onCreateWindow` returns the destination `Adw.TabView`.

React commits asynchronously, so JSX rendered in response to the signal is not ready in time. Create the native object in the handler, keep it in state, and render into it with `createPortal` once React commits. For a new tab, append an `Adw.Bin` to the view and return its page; for a new window, construct the `Adw.TabView` and mount the window around it. The [tab view navigator](/v2/guide/navigation#tab-view-navigator) packages this pattern for tabs, and the list components use it for their cells.

An independent `createRoot(container)` owns its rendered children separately from the component that created the container. Explicitly unmount that root when its content is no longer needed. This lets a tab keep its native widget and React state after libadwaita transfers it to another window and the original window closes. The [Adwaita demo](https://github.com/gtkx-org/gtkx/tree/main/examples/adwaita-demo) demonstrates this lifecycle with native tab creation and transfer.

## Windows

Window elements present themselves on mount and destroy the native window on unmount. Render a secondary window conditionally:

```tsx
import { AdwApplicationWindow, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";

const MirrorWindow = ({ open }: { open: boolean }) =>
    open ? (
        <AdwApplicationWindow title="Mirror" defaultWidth={400} defaultHeight={300}>
            <AdwToolbarView top={<AdwHeaderBar />} />
        </AdwApplicationWindow>
    ) : null;
```

`AdwApplicationWindow` registers with its nearest application element, normally `AdwApplication`; it requires that ancestor. To associate it with another window, pass `transientFor` explicitly.

Plain `AdwWindow` and `GtkWindow` elements default `transientFor` to their nearest window ancestor. An explicit value selects another parent; `null` keeps the window independent.

Handle `onCloseRequest` by clearing the state that rendered the secondary window.

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

Set `canClose={false}` when the dialog must stay open, and handle `onCloseAttempt` to respond to a close request. Unmounting still closes the dialog unconditionally.

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

### About dialog metadata

`AdwAboutDialog` accepts `links`, `creditSections`, `acknowledgementSections`, `legalSections`, and `otherApps` as arrays:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAboutDialog } from "@gtkx/jsx/adw";

<AdwAboutDialog
    applicationName="Notes"
    links={[{ title: "User Guide", url: "https://example.org/guide" }]}
    creditSections={[{ name: "Design", people: ["Ada Lovelace"] }]}
    acknowledgementSections={[{ name: "Thanks", people: ["Our translators"] }]}
    legalSections={[{ title: "Sample data", copyright: "© Example", licenseType: Gtk.License.MIT_X11 }]}
    otherApps={[{ appid: "org.example.Calendar", name: "Calendar", summary: "Plan your day" }]}
/>
```

Libadwaita cannot remove these entries. Each array becomes fixed when its first nonempty value is applied; equivalent arrays on later renders are accepted. To change or remove a populated list, give the dialog a new React `key`. Legal-section copyright and custom license text accept Pango markup, so escape externally supplied plain text with `GLib.markupEscapeText`.

## Finding the parent window

`useParentWindow()` from `@gtkx/react` returns the nearest window once its native instance exists. It returns `null` while the instance is unavailable or when there is no window ancestor. The lookup follows component ancestry through portals, so portaled dialogs can still use their originating window.

The tutorial builds these surfaces in [Mounting dialogs](/v2/tutorial/actions-menus-shortcuts#mounting-dialogs), [Confirming a permanent delete](/v2/tutorial/trash-and-toasts#confirming-a-permanent-delete), and [A dialog that is a form](/v2/tutorial/trash-and-toasts#a-dialog-that-is-a-form). The exported API is in the [@gtkx/react reference](/v2/reference/@gtkx/react/).

## Next

Continue with [Navigation](/v2/guide/navigation) to move between screens with stack, tab, drawer, and split view navigators drawn by libadwaita.
