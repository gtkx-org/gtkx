# Windows & application lifecycle

A GTKX app is a React tree with an application component at the root and one or more windows as its top-level
children. This guide covers how that tree starts, how windows open and close, and how the process shuts down.

## The application component

`GtkApplication` (from `@gtkx/jsx/gtk`) and `AdwApplication` (from `@gtkx/jsx/adw`) construct the backing GTK
application from `applicationId` and `flags`, register and activate it, and provide it to every descendant through
context. Exactly one application component sits at the root of the tree; every window renders inside it.

Pass `applicationId` explicitly, reading it from the resolved `gtkx.config.ts` through `@gtkx/cli/runtime`:

```tsx
// src/app.tsx
import { applicationId } from "@gtkx/cli/runtime";
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
import { applicationId } from "@gtkx/cli/runtime";
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

`createRoot` mirrors `createRoot` from `react-dom`: call it once at module top level in your entry file and `render` the tree onto the returned root.

```tsx
// src/index.tsx
import { createRoot } from "@gtkx/react";
import { App } from "./app.js";

createRoot().render(<App />);
```

The root's `unmount()` tears down that single tree; calling it twice is a no-op:

```tsx
const root = createRoot();
root.render(<App />);

root.unmount();
```

`quit()` unmounts every active root — the teardown counterpart to `createRoot`. Unmounting a tree that contains a
`GtkApplication` or `AdwApplication` quits the application, which stops the GTK runtime by default, so the process
exits once the roots are gone.

::: tip
A non-React application keeps the loop alive with `runApplication` and stops it with `quitApplication` —
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
import { applicationId } from "@gtkx/cli/runtime";
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

Unmounting the application — through `quit()` or the main window's `onCloseRequest` — quits the GTK application and
stops the runtime, so the process exits cleanly. Under `gtkx dev`, the dev server also installs `SIGINT` (Ctrl+C),
`SIGTERM`, and `SIGHUP` handlers that quit the running application, so Ctrl+C shuts the app down gracefully. The
runtime itself installs no signal handlers; a standalone build that wants to trap signals installs its own handler
(for example with `installGracefulShutdown` from `@gtkx/utils`) that calls `quitApplication` from `@gtkx/ffi`.

To run code during shutdown — before native dispatch is torn down — register a callback with `onExit`:

```tsx
import { onExit } from "@gtkx/ffi";

onExit(() => {
    console.log("Runtime stopping");
});
```

Callbacks run synchronously, in registration order, when the process exits, making this the right place to release
resources tied to the runtime's lifetime.
