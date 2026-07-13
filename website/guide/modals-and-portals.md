---
description: "How gtkx renders GTK surfaces that live outside the widget tree: createPortal, the rootElement container, the Dialog and AlertDialog components, and extra windows."
---

# Modals and Portals

A React tree normally mirrors a containment hierarchy: each JSX child becomes a child widget of its JSX parent. GTK has surfaces that refuse to fit that shape. A dialog is not a child of the button that opened it; it is a free-floating `Adw.Dialog` that gets *presented* against a window. A second window has no parent widget at all. The cells of a `Gtk.ListView` are created by a factory the moment they scroll into view, not by you. In every one of these cases you still want React state to decide what exists and what it looks like. Portals are the bridge: they let a component render children into a container other than its JSX parent, while the component keeps owning those children's state, props, and lifetime.

This page describes the general model. For a worked walkthrough of toasts, confirmations, and form dialogs in a real app, read the [Feedback and Dialogs](/tutorial/feedback-and-dialogs) tutorial chapter.

## createPortal

`createPortal` from `@gtkx/react` has the same shape as its React DOM namesake, with GTK containers in place of DOM nodes:

```ts
import { createPortal } from "@gtkx/react";

createPortal(children: ReactNode, container: Container, key?: string | null): ReactPortal
```

A `Container` is either any live `GObject.Object` or the special `rootElement` marker described below. That definition is deliberately broad. The most common targets are:

- **A widget you hold a ref to.** The children are attached to that widget exactly as if they had been written as its JSX children, using the same generated container logic (append, insert, reorder) that regular children use.
- **The `Gtk.Application` object** from `useApplication()`, the natural home for extra windows.
- **`rootElement`**, the top-level container, for anything that should exist with no GTK parent at all.

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
            {tray && createPortal(<GtkLabel label="Synced" />, tray)}
        </>
    );
};
```

Everything you know about portals from React DOM carries over: the children stay in the *React* tree of the component that rendered them, so context, state, and effects flow from where the portal is written, not where the widgets land. Multiple portals can target the same container, portal contents update when props change, and removing the portal unmounts and destroys its widgets.

::: info
gtkx uses this mechanism internally. The `ListView`, `GridView`, and `ColumnView` components in `@gtkx/components` render your `renderItem` output through portals into the cell containers that GTK's list item factories create on demand. That is why fully declarative, stateful list cells work at all: each cell is a portal target.
:::

## The root element

`rootElement`, exported from `@gtkx/react`, is a singleton marker object, not a widget. It is the default container of `createRoot()`, which is why the entry point of a gtkx app passes no argument: the "root" of a native app is not an element in a page.

Portaling to `rootElement` means "mount this with no GTK parent." No attach call is made on the native side; the widget is simply created top-level. That is exactly what windows and dialogs need, since GTK forbids them from being parented into a layout. Relationships between top-level windows are expressed with window properties instead, chiefly `transientFor`:

```tsx
import { GtkWindow } from "@gtkx/jsx/gtk";
import { createPortal, rootElement, useParentWindow } from "@gtkx/react";

const DetachedPreview = ({ open }: { open: boolean }) => {
    const parent = useParentWindow();
    if (!open) return null;
    return createPortal(
        <GtkWindow title="Preview" transientFor={parent} defaultWidth={480} defaultHeight={360} />,
        rootElement,
    );
};
```

The portaled window has no widget parent (`getParent()` returns `null`), but `transientFor` is the hint window managers use to keep it stacked above its owner and center it over it. Setting the prop back to `null` clears the relationship.

## Declarative dialogs

Adw dialogs have an imperative API: you call `dialog.present(parent)` to show one and `dialog.forceClose()` to dismiss it. The `Dialog` component from `@gtkx/components/adw` converts that protocol into the React contract you actually want: **mounting the component presents the dialog, unmounting it closes the dialog.**

```tsx
import { Dialog } from "@gtkx/components/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAboutDialog } from "@gtkx/jsx/adw";

export const About = ({ onClose }: { onClose: () => void }) => (
    <Dialog>
        <AdwAboutDialog
            applicationName="Tasks"
            developerName="GTKX"
            version="1.0.0"
            licenseType={Gtk.License.MPL_2_0}
            onClosed={onClose}
        />
    </Dialog>
);
```

Showing it is a conditional render, the same as any other component:

```tsx
{showAbout ? <About onClose={() => setShowAbout(false)} /> : null}
```

`Dialog` takes a single child element that accepts a ref to a `DialogInstance`: a widget with `present(parent)` and `forceClose()` methods, which is to say `Adw.Dialog` and every subclass (`AdwAboutDialog`, `AdwPreferencesDialog`, `AdwShortcutsDialog`, `AdwAlertDialog`). Internally it does three things:

1. Renders the child through `createPortal(..., rootElement)`, so the dialog widget is created top-level rather than inside your layout.
2. In a layout effect, calls `present(parent)` on mount and `forceClose()` on unmount. `forceClose` bypasses any close confirmation, which is correct when React state, not the widget, owns whether the dialog is open.
3. Resolves `parent` for you: the optional `parent` prop (`Gtk.Window | null`) anchors the dialog explicitly, and when omitted it defaults to the nearest enclosing window from `useParentWindow()`. Pass `parent={null}` to present a dialog with no anchor.

The one piece of glue you supply is closing the loop when the *user* dismisses the dialog (Escape, the close button). Every `Adw.Dialog` emits `closed`, so handle `onClosed` and clear the state that mounted the dialog, as `About` does above. Without it, React would still consider the dialog open after GTK has closed it.

The same wrapper covers full preference surfaces. The tutorial's preferences dialog is an `AdwPreferencesDialog` with pages, groups, and rows as ordinary children, driven by [GSettings-backed state](/tutorial/preferences-and-theming):

```tsx
import { Dialog } from "@gtkx/components/adw";
import { AdwPreferencesDialog, AdwPreferencesGroup, AdwPreferencesPage } from "@gtkx/jsx/adw";

export const Preferences = ({ onClose }: { onClose: () => void }) => (
    <Dialog>
        <AdwPreferencesDialog title="Preferences" onClosed={onClose}>
            <AdwPreferencesPage title="General" iconName="preferences-system-symbolic">
                <AdwPreferencesGroup title="Appearance">{/* rows */}</AdwPreferencesGroup>
            </AdwPreferencesPage>
        </AdwPreferencesDialog>
    </Dialog>
);
```

## Alert dialogs

`Adw.AlertDialog` is the message-and-buttons modal: a heading, a body, and a set of responses. Its native API adds responses with `addResponse` and styles them with `setResponseAppearance`. The `AlertDialog` component from `@gtkx/components/adw` makes the responses declarative children instead:

```tsx
import { AlertDialog, Dialog } from "@gtkx/components/adw";
import * as Adw from "@gtkx/gi/adw";

export const DeleteConfirmation = ({
    taskTitle,
    onConfirm,
    onCancel,
}: {
    taskTitle: string;
    onConfirm: () => void;
    onCancel: () => void;
}) => (
    <Dialog>
        <AlertDialog
            heading="Delete Task?"
            body={`"${taskTitle}" will be permanently deleted. This cannot be undone.`}
            defaultResponse="cancel"
            closeResponse="cancel"
            onResponse={(id) => {
                if (id === "delete") onConfirm();
                else onCancel();
            }}
        >
            <AlertDialog.Response id="cancel" label="Cancel" />
            <AlertDialog.Response id="delete" label="Delete" appearance={Adw.ResponseAppearance.DESTRUCTIVE} />
        </AlertDialog>
    </Dialog>
);
```

`AlertDialog` accepts every `AdwAlertDialog` prop (`heading`, `body`, `defaultResponse`, `closeResponse`, `onResponse`, and the rest). Each `AlertDialog.Response` declares one button: `id` is the string handed to `onResponse` when it is chosen, `label` is the button text, `appearance` takes an `Adw.ResponseAppearance` (`SUGGESTED` for the accent affirmative, `DESTRUCTIVE` for red), and `enabled` can disable a response while, say, a form inside the dialog is incomplete. `defaultResponse` binds a response to Return and `closeResponse` is what Escape resolves to, so pointing both at `"cancel"` keeps a destructive action from firing by accident.

Responses are not the only children an alert dialog can have. Any non-`Response` child becomes the dialog's body widget, which turns `AlertDialog` into a compact form container: the tutorial's [New List dialog](/tutorial/feedback-and-dialogs#the-new-list-dialog-a-form-in-an-alert-dialog) puts a `GtkEntry` and a row of color swatches inside one.

## Finding the parent window

`useParentWindow()` from `@gtkx/react` returns the `Gtk.Window` provided by the nearest window ancestor in the React tree, or `null` when there is none. Every window element (anything gtkx wraps as a window, such as `GtkWindow`, `GtkApplicationWindow`, and `AdwApplicationWindow`) provides this context to its children. Because the context follows the *React* tree, it survives portals: a dialog portaled to `rootElement` from deep inside a window's subtree still resolves that window as its parent, which is precisely how `Dialog` anchors itself without being told where it is.

## Multiple windows

Windows carry their lifecycle in the element itself: on mount a window element calls `present()`, and on unmount it destroys the window. So a second window is nothing special, just another conditionally rendered element. Render it as a sibling of your main window under the application, or portal it from wherever the owning state lives:

```tsx
import { GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { createPortal, useApplication } from "@gtkx/react";

const MirrorWindow = ({ open }: { open: boolean }) => {
    const app = useApplication();
    if (!open) return null;
    return createPortal(<GtkApplicationWindow title="Mirror" defaultWidth={400} defaultHeight={300} />, app);
};
```

Targeting the `Gtk.Application` object and targeting `rootElement` both produce a top-level window; use `transientFor` when the extra window should stay stacked above another one, and handle `onCloseRequest` or the window's state toggle to keep React in charge of when it goes away. Each window provides its own `useParentWindow()` context, so dialogs opened inside a secondary window anchor to that window automatically.

Every dialog and window element, along with its full prop surface, is covered by the element reference `gtkx docs` generates for your project.
