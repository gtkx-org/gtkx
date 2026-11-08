---
title: "Modals and Portals"
description: "Render windows, Adwaita dialogs, and objects outside their surrounding container."
---

# Modals and Portals

Windows and Adwaita dialogs are JSX elements: rendering one opens it, and the app closes it by no longer rendering it. GTKX places them natively, outside the widget tree they are declared in. Use `createPortal` for other objects that belong outside their surrounding container.

## Windows

Window elements present themselves on mount and destroy the native window on unmount. Render a secondary window conditionally, and handle `onCloseRequest` by clearing the state that rendered it:

```tsx
import {
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwToolbarView,
} from "@gtkx/jsx/adw";

const MirrorWindow = ({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) =>
    open ? (
        <AdwApplicationWindow
            title="Mirror"
            defaultWidth={400}
            defaultHeight={300}
            onCloseRequest={() => {
                onClose();
                return true;
            }}
        >
            <AdwToolbarView top={<AdwHeaderBar />} />
        </AdwApplicationWindow>
    ) : null;
```

Returning `true` keeps the window until React unmounts it.

A window that should keep its state while hidden, such as one with `hideOnClose`, can stay mounted and pass `visible` instead. Mounted with `visible={false}`, it stays hidden until `visible` becomes `true`.

`AdwApplicationWindow` registers with its nearest application element, normally `AdwApplication`, and throws without one. To associate it with another window, pass `transientFor` explicitly.

Plain `AdwWindow` and `GtkWindow` elements default `transientFor` to their nearest window ancestor. An explicit value selects another parent; `null` keeps the window independent.

## Dialogs

Adwaita dialog elements present on mount over their nearest window and close on unmount. Handle `onClosed` by clearing the state that rendered the dialog:

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

Without `onClosed`, the close button and Escape do nothing and the dialog stays open, as described in [Closing](#closing). To confirm before closing, for example when there are unsaved changes, set `canClose={false}` and handle `onCloseAttempt`, then stop rendering the dialog once the user confirms. Unmounting always closes the dialog.

`AdwAlertDialog` takes plain-text `heading` and `body` values and a `responses` array. Its `onResponse` prop receives the selected response ID and also answers the close request. Children appear between the body and the response buttons:

<<< @/figures/guide/modals-rename-dialog.tsx

<figure class="result">
    <img class="result-light" src="/figures/guide-modals-rename-dialog-light.png" width="480" height="360" loading="lazy" alt="A window titled Lists, dimmed behind an alert dialog with the heading Rename, the body Pick a new name for this list., an empty List name entry, and Cancel and Rename buttons, Rename highlighted." />
    <img class="result-dark" src="/figures/guide-modals-rename-dialog-dark.png" width="480" height="360" loading="lazy" alt="A window titled Lists, dimmed behind an alert dialog with the heading Rename, the body Pick a new name for this list., an empty List name entry, and Cancel and Rename buttons, Rename highlighted." />
    <figcaption>Captured from the sample above. <code>SUGGESTED</code> colors the Rename response.</figcaption>
</figure>

The tutorial builds dialogs in [Mount the dialogs](/v2/tutorial/actions-menus-shortcuts#mount-the-dialogs) and [Rename a note](/v2/tutorial/trash-and-toasts#rename-a-note).

### About dialog metadata

`AdwAboutDialog` accepts `links`, `creditSections`, `acknowledgementSections`, `legalSections`, and `otherApps` as arrays:

<<< @/figures/guide/modals-about-dialog.tsx

<figure class="result">
    <img class="result-light" src="/figures/guide-modals-about-dialog-light.png" width="480" height="600" loading="lazy" alt="A window titled Notes behind an about dialog headed Notes, with a Details row, a group of Credits, Legal and Acknowledgements rows, and a Calendar row reading Plan your day with an external link icon." />
    <img class="result-dark" src="/figures/guide-modals-about-dialog-dark.png" width="480" height="600" loading="lazy" alt="A window titled Notes behind an about dialog headed Notes, with a Details row, a group of Credits, Legal and Acknowledgements rows, and a Calendar row reading Plan your day with an external link icon." />
    <figcaption>Captured from the sample above. Libadwaita puts <code>links</code> under Details, gives each section array its own page, and lists <code>otherApps</code> at the bottom.</figcaption>
</figure>

Libadwaita cannot remove these entries. Each array becomes fixed when its first nonempty value is applied; equivalent arrays on later renders are accepted, and a different one throws. To change or remove a populated list, give the dialog a new React `key`. Legal-section copyright and custom license text accept Pango markup, so escape externally supplied plain text with `GLib.markupEscapeText`.

## Closing

The app decides what is open by what it renders. A close button, Escape, a gesture or the window manager only asks to close, and the app answers by rendering something else. Until it answers, GTKX keeps the native state matching React as far as the toolkit allows:

| Element                                                | Answered by                                                                                                                       | When nothing answers                                    |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Adwaita dialogs                                        | `onClosed` or `onCloseAttempt`; `onResponse` on `AdwAlertDialog`                                                                  | The dialog stays open.                                  |
| `AdwTabPage` in a JSX `AdwTabView`                     | A `close-page` handler on the view: `onClosePage` or one connected with [`useSignal`](/v2/guide/native-state#connecting-a-signal) | The tab stays.                                          |
| `AdwBottomSheet` given `open`                          | `onNotifyOpen` or `onCloseAttempt`                                                                                                | The sheet stays open.                                   |
| Open-state props                                       | Rendering the new value, usually from the matching `onNotify…` handler                                                            | GTKX restores the rendered value before the next frame. |
| Windows                                                | `onCloseRequest`                                                                                                                  | The window closes, so the user can always close it.     |
| `visible` on `GtkPopover`, `active` on `GtkMenuButton` | `onClosed`, `onNotifyActive`                                                                                                      | The popover closes.                                     |

The open-state props are `showSidebar` on `AdwOverlaySplitView`, `showContent` on `AdwNavigationSplitView`, `open` on `AdwBottomSheet` and `AdwTabOverview`, and `searchModeEnabled` on `GtkSearchBar`. Like a selection prop, each one is controlled when given; omitting it leaves it to the widget.

In development, GTKX warns once per element type when nothing answers, naming the handler to add. It also warns when a window other than the last one, a dialog or a popover closed while the app still renders it open, as when an `onClosed` handler only logs.

Returning `false` from `onClosePage` lets libadwaita close the tab without the app answering.

## Finding the parent window

`useParentWindow()` from `@gtkx/react` returns the nearest window once its native instance exists. It returns `null` while the instance is unavailable or when there is no window ancestor. The lookup follows component ancestry through portals, so portaled dialogs can still use their originating window.

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

An independent `createRoot(container)` owns its rendered children separately from the component that created the container, until you call its `unmount()`. A tab rendered into an `Adw.TabView` this way keeps its native widget and React state after libadwaita transfers it to another window and the original view unmounts. The tab view navigator remounts a transferred screen instead; see [Windows and transfers](/v2/guide/navigation#windows-and-transfers).

The exported API is in the [@gtkx/react reference](/v2/reference/@gtkx/react/).
