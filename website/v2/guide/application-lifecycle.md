---
title: "Application Lifecycle"
description: "Start the application from the entry point, know when it ends, end pending work, handle termination signals and the command line."
---

# Application Lifecycle

A GTKX app is a GTK application that React renders: the application element starts it, its windows keep it running, and it ends when they are gone. An app should also leave no work running when it quits, save its data when it receives `SIGTERM`, and answer when it is launched again from the command line. GTKX handles part of each; this page covers what your code does.

## The application element

The entry point renders the app into a root:

```tsx [src/index.tsx]
import { createRoot } from "@gtkx/react";
import { App } from "./app.js";

createRoot().render(<App />);
```

`createRoot()` without a container renders at the top level, where the application element goes. The application element is `AdwApplication`, or the element of any other `Gtk.Application` class, such as `GtkApplication`:

```tsx [src/app.tsx]
import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
import { quit } from "@gtkx/react";

export const App = () => (
    <AdwApplication>
        <AdwApplicationWindow title="Notes" defaultWidth={600} defaultHeight={400} onCloseRequest={quit} />
    </AdwApplication>
);
```

When it mounts, the application element creates the application and runs it with the process's command-line arguments. Its `applicationId` defaults to the one in [`gtkx.config.ts`](/v2/guide/configuration-and-codegen#the-config-file), including a `$development` override under `gtkx dev`. Its children render once the application activates, so the windows among them become the application's windows, and they unmount when it shuts down. [`useApplication()`](/v2/guide/native-state#the-application) returns the application to any component inside. When the run ends with a nonzero status, GTKX sets it as the process's exit code.

The application ID makes the app single-instance. A second launch hands its arguments to the running instance and exits without rendering, and the running instance receives `activate` again. Present its window there, or the second launch appears to do nothing:

```tsx [src/app.tsx]
import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
import { quit } from "@gtkx/react";

export const App = () => (
    <AdwApplication onActivate={(application) => application.getActiveWindow()?.present()}>
        <AdwApplicationWindow title="Notes" defaultWidth={600} defaultHeight={400} onCloseRequest={quit} />
    </AdwApplication>
);
```

### When the app ends

A GTK application runs while it has a window or a [`hold()`](https://docs.gtk.org/gio/method.Application.hold.html). GTKX holds the application until its first activated render commits, then releases it, so:

- Closing the last window ends the app. A window without an `onCloseRequest` handler closes when the user closes it.
- `quit()` from `@gtkx/react` unmounts every root and quits each application it unmounts, even one that holds itself. It returns `Gdk.EVENT_STOP`, so it can be the main window's `onCloseRequest` handler.
- A first render that shows no window ends the app at once, and `gtkx dev` reports `Application quit`. An app that waits for saved data before rendering anything quits before the data arrives. Render the window first and show a placeholder inside it; see [Restoring state](/v2/guide/navigation#restoring-state) for React Navigation's state persistence.
- `root.unmount()` and `root.render(null)` remove the windows. The application then ends unless something holds it.

To keep a windowless app running for background work, call `hold()` on the application and `release()` when the work finishes. Each `hold()` needs one `release()`; an extra `release()` throws a `RangeError`.

## Ending work on unmount

When the application quits, GTKX unmounts the tree, and the Node process exits once its event loop has no work left. A pending `fetch` or a running timer keeps the process alive after its window has closed. Abort requests and clear timers in the cleanup of the effect that started them, and start timers in effects rather than at module level:

```tsx
import { useEffect, useState } from "react";

export const useFeed = (url: string, intervalMs: number): string | null => {
    const [body, setBody] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const refresh = (): void => {
            fetch(url, { signal: controller.signal })
                .then((response) => response.text())
                .then(setBody)
                .catch((error: unknown) => {
                    if (!controller.signal.aborted) console.error(error);
                });
        };

        refresh();
        const timer = setInterval(refresh, intervalMs);

        return () => {
            clearInterval(timer);
            controller.abort();
        };
    }, [url, intervalMs]);

    return body;
};
```

`gtkx dev` waits a few seconds after the application quits. If the process is still running then, it prints a warning naming the kinds of pending work, such as `Timeout` for a timer or `TCPSocketWrap` for an open connection, and stops. Run the built bundle to see the same work keep a production process alive.

## Handling termination signals

Listen for `SIGINT` and `SIGTERM` with Node's [`process.on`](https://nodejs.org/api/process.html#signal-events), not `GLibUnix.signalAdd`. GTKX quits the application on `SIGINT`, `SIGTERM` and `SIGHUP` while no other listener handles the signal. A listener you add takes over, so finish your cleanup and call `quit()`:

```tsx
import { quit } from "@gtkx/react";
import { useEffect } from "react";

export const useQuitOnSignals = (save: () => void): void => {
    useEffect(() => {
        const handleSignal = (): void => {
            save();
            quit();
        };

        process.on("SIGINT", handleSignal);
        process.on("SIGTERM", handleSignal);

        return () => {
            process.off("SIGINT", handleSignal);
            process.off("SIGTERM", handleSignal);
        };
    }, [save]);
};
```

When the last `GLibUnix.signalAdd` source for a signal is removed, for example on unmount or after a Fast Refresh, GLib resets that signal to its default action. That silently disables GTKX's exit handling and every `process.on` listener, although Node still lists them. The next `SIGTERM` then ends the process without cleanup, and a Vitest worker ends without releasing its headless display.

## Command-line apps

With `Gio.ApplicationFlags.HANDLES_COMMAND_LINE`, every launch's arguments reach the primary instance through the [`command-line`](https://docs.gtk.org/gio/signal.Application.command-line.html) signal instead of `activate`, including the first launch. GTKX renders the application's children once the application is activated or opened, so the handler calls `application.activate()` to show the window.

A second launch waits for the primary instance's reply. GLib sends it when the `Gio.ApplicationCommandLine` is finalized or its [`done()`](https://docs.gtk.org/gio/method.ApplicationCommandLine.done.html) method is called. GTKX finalizes it only after JavaScript garbage-collects the wrapper, so without `done()` the second launch can wait for minutes. Set the exit status before calling `done()`, because `done()` freezes it before GLib applies the handler's return value:

```tsx
import * as Gio from "@gtkx/gi/gio";
import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
import { quit } from "@gtkx/react";

const handleCommandLine = (commandLine: Gio.ApplicationCommandLine, application: Gio.Application): number => {
    application.activate();
    commandLine.setExitStatus(0);
    commandLine.done();
    return 0;
};

export const App = () => (
    <AdwApplication flags={Gio.ApplicationFlags.HANDLES_COMMAND_LINE} onCommandLine={handleCommandLine}>
        <AdwApplicationWindow title="Tasks" onCloseRequest={quit} />
    </AdwApplication>
);
```

A handler that answers after asynchronous work calls `setExitStatus` and `done()` when that work completes.

During development, `gtkx dev` passes the arguments after `--` to the application, so `gtkx dev -- notes.txt` starts an app with `HANDLES_OPEN` on that file. pnpm and Yarn 2 or newer pass `--` on to the `dev` script, as in `pnpm dev -- notes.txt`; npm removes the first `--`, so write `npm run dev -- -- notes.txt`. An option before `--` must be one `gtkx dev` defines: `gtkx dev --verbose` stops with an error naming `--verbose` rather than starting the app, so application options always go after `--`.

A GTKX app needs a display even for `--help` and other options that exit before a window opens. The generated `@gtkx/gi/gtk` and `@gtkx/gi/adw` modules initialize GTK when they are imported, before the application parses its command line, so without a Wayland or X11 display the process prints `Failed to open display` and exits with status 1. Run command-line checks of a packaged app, such as a smoke test in a container or CI, inside a desktop session or a virtual display such as `xvfb-run`.

GTKX sets the program name to the last segment of the production application ID before the entry module runs, as GJS does before an app's code. `--help` prints it as the usage line, and GTK's X11 backend uses it as the window class, even when a library such as GStreamer initializes while the app's modules load. A development ID such as `$development: { applicationId: "com.example.Tasks.Devel" }` keeps the name `Tasks` under `gtkx dev`. To choose another name, call `GLib.setPrgname()` before the application starts.

## Keeping a helper process alive

Application elements manage the GLib lifecycle automatically. A standalone Node helper needs an explicit hold while native work is pending; see [helper processes](/v2/guide/workers#keeping-a-helper-process-alive).
