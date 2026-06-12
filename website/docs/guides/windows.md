# Windows & application lifecycle

A GTKX app is a React tree with an application component at the root and one or more windows as its top-level
children. This guide covers how that tree starts, how windows open and close, and how the process shuts down.

## The application component

`GtkApplication` (from `@gtkx/jsx/gtk`) and `AdwApplication` (from `@gtkx/jsx/adw`) construct the backing GTK
application from `applicationId` and `flags`, register and activate it, and provide it to every descendant through
context. Exactly one application component sits at the root of the tree; every window renders inside it.

Pass `applicationId` explicitly, reading it from the resolved `gtkx.config.ts` through `@gtkx/config/runtime`:

```tsx
// src/app.tsx
import { applicationId } from "@gtkx/config/runtime";
import { GtkApplication, GtkApplicationWindow, GtkLabel } from "@gtkx/jsx/gtk";
import { quit } from "@gtkx/react";

export const App = () => (
    <GtkApplication applicationId={applicationId}>
        <GtkApplicationWindow
            title="My App"
            onCloseRequest={() => {
                quit();
                return true;
            }}
        >
            <GtkLabel label="Hello, GTKX!" />
        </GtkApplicationWindow>
    </GtkApplication>
);
```

Use `AdwApplication` when your interface builds on Adwaita widgets. It backs the tree with an `Adw.Application` — a
`Gtk.Application` subclass that exposes the Adwaita style manager — and is otherwise a drop-in replacement:

```tsx
import { applicationId } from "@gtkx/config/runtime";
import { AdwApplication } from "@gtkx/jsx/adw";
import { NotesWindow } from "./notes-window.js";

export const App = () => (
    <AdwApplication applicationId={applicationId}>
        <NotesWindow />
    </AdwApplication>
);
```

The optional `flags` prop takes `Gio.ApplicationFlags`, for example `Gio.ApplicationFlags.NON_UNIQUE` to allow
multiple instances of the same application ID.

## Rendering and quitting

`render` mirrors `createRoot().render()` from `react-dom`: call it once at module top level in your entry file.

```tsx
// src/index.tsx
import { render } from "@gtkx/react";
import { App } from "./app.js";

render(<App />);
```

It returns a handle whose `unmount()` tears down that single tree; calling it twice is a no-op:

```tsx
const handle = render(<App />);

handle.unmount();
```

`quit()` unmounts every active root — the `render(null)` counterpart to `render`. Unmounting a tree that contains a
`GtkApplication` or `AdwApplication` runs the application teardown, which stops the GTK runtime by default, so the
process exits once the roots are gone.

::: tip
A tree without an application component keeps the runtime alive. Stop it explicitly with `stop` from `@gtkx/ffi` —
see [FFI bindings](../ffi-bindings.md#running-an-application).
:::

::: details render and the dev server
In `gtkx dev`, the entry module runs once per process. Component-level edits are applied through React Fast Refresh;
edits that propagate up to the entry trigger a process restart, so `render` still runs at most once per process.
:::

## Closing windows

When the user closes a window, GTK emits `close-request`. The handler's return value decides what happens next:

- Return `true` to veto GTK's native close. Nothing is destroyed; your code decides what happens.
- Return `false` (or nothing) to let GTK destroy the window itself.

For the main window, veto the close and call `quit()`:

```tsx
<GtkApplicationWindow
    title="My App"
    onCloseRequest={() => {
        quit();
        return true;
    }}
>
```

`quit()` unmounts the tree, and unmounting destroys each window — teardown flows through React instead of GTK
destroying a widget the tree still renders.

::: warning
Letting GTK destroy a window your tree renders leaves React believing the window still exists. On any window rendered
from the tree, return `true` from `onCloseRequest` and remove the window through state or `quit()`.
:::

## Multiple windows

Each window is a top-level child of the application component — windows are siblings, never children of other
windows. A window presents itself when it mounts and is destroyed when it unmounts, so opening and closing a
secondary window is plain conditional rendering:

```tsx
import { applicationId } from "@gtkx/config/runtime";
import { GtkApplication, GtkApplicationWindow, GtkButton, GtkLabel, GtkWindow } from "@gtkx/jsx/gtk";
import { quit } from "@gtkx/react";
import { useState } from "react";

const App = () => {
    const [showInspector, setShowInspector] = useState(false);

    return (
        <GtkApplication applicationId={applicationId}>
            <GtkApplicationWindow
                title="Main"
                onCloseRequest={() => {
                    quit();
                    return true;
                }}
            >
                <GtkButton label="Open Inspector" onClicked={() => setShowInspector(true)} />
            </GtkApplicationWindow>
            {showInspector && (
                <GtkWindow
                    title="Inspector"
                    defaultWidth={400}
                    defaultHeight={300}
                    onCloseRequest={() => {
                        setShowInspector(false);
                        return true;
                    }}
                >
                    <GtkLabel label="Inspector contents" />
                </GtkWindow>
            )}
        </GtkApplication>
    );
};
```

The secondary window vetoes its native close and clears the state instead, so React unmounts and destroys it.

## Transient and modal windows

A secondary window stays above its parent through the `transientFor` prop, which takes a raw `Gtk.Window` instance —
never a React ref, because a ref is still unpopulated during the commit's mutation phase. Capture the parent into
state with a callback ref, then render the child window once the instance exists. Add `modal` to block interaction
with the parent while the child is open:

```tsx
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkApplicationWindow, GtkButton, GtkLabel, GtkWindow } from "@gtkx/jsx/gtk";
import { quit } from "@gtkx/react";
import { useState } from "react";

const Main = () => {
    const [mainWindow, setMainWindow] = useState<Gtk.Window | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    return (
        <>
            <GtkApplicationWindow
                ref={setMainWindow}
                title="Main"
                onCloseRequest={() => {
                    quit();
                    return true;
                }}
            >
                <GtkButton label="Settings" onClicked={() => setShowSettings(true)} />
            </GtkApplicationWindow>
            {showSettings && mainWindow && (
                <GtkWindow
                    title="Settings"
                    transientFor={mainWindow}
                    modal
                    onCloseRequest={() => {
                        setShowSettings(false);
                        return true;
                    }}
                >
                    <GtkLabel label="Settings contents" />
                </GtkWindow>
            )}
        </>
    );
};
```

Passing the state setter as the `ref` is the whole pattern: the callback ref stores the window instance in state, and
the `mainWindow &&` guard delays the child window until the instance is available. Setting `transientFor` to `null`
clears the relationship.

::: tip
Adwaita dialogs (`AdwAboutDialog`, `AdwAlertDialog`, `AdwPreferencesDialog`, ...) are not windows. They take a
`parent` prop instead of `transientFor`, read once when the dialog mounts — see the example below.
:::

## useApplication

`useApplication()` returns the backing `Gtk.Application`. It throws when called outside the application component.

Combine it with `useProperty` to observe an application property as React state. `activeWindow` is the most common
one — for example, as the `parent` of an Adwaita dialog:

```tsx
import { AdwAboutDialog } from "@gtkx/jsx/adw";
import { useApplication, useProperty } from "@gtkx/react";

export const About = ({ onClose }: { onClose: () => void }) => {
    const app = useApplication();
    const activeWindow = useProperty(app, "activeWindow");

    if (!activeWindow) return null;

    return (
        <AdwAboutDialog
            parent={activeWindow}
            applicationName="Notes"
            version="0.1.0"
            developerName="GTKX Tutorial"
            onClosed={onClose}
        />
    );
};
```

`useProperty` subscribes to the property's change notifications and re-renders the component whenever the value
changes, so the dialog always presents against the window that is currently active.

## Shutdown

`SIGINT` (Ctrl+C), `SIGTERM`, and `SIGHUP` are handled for you: the runtime routes the signal through `stop` from
`@gtkx/ffi`, quits the main loop, drains finalizers, and exits with the signal's conventional code. A second `SIGINT`
forces an immediate exit.

Embedders that own process signals can opt out by setting `GTKX_DISABLE_SHUTDOWN_HANDLERS=1` in the environment
before the process loads `@gtkx/ffi`.

To run code when the runtime begins shutting down — whichever path triggered it — use `whenStopped`:

```tsx
import { whenStopped } from "@gtkx/ffi";

whenStopped().then(() => {
    console.log("Runtime stopping");
});
```

The promise settles exactly once, before native dispatch is torn down, making it the right place to release resources
tied to the runtime's lifetime.
