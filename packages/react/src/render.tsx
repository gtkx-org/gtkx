import { stop } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { ReactNode } from "react";
import { getSignalStore } from "./nodes/internal/signal-store.js";
import { reconciler } from "./reconciler.js";

let container: unknown = null;

/**
 * Renders a React element tree into a GTK4 application window.
 *
 * Registers and activates the supplied application, then begins the React
 * reconciliation process. Mirrors the role of `createRoot().render()` in
 * `react-dom`: call once at module top-level in your entry file.
 *
 * In the dev server, the entry module runs once per process. Component-level
 * edits are applied via React Refresh; edits that propagate up to the entry
 * trigger a process restart so this function still runs at most once per
 * process.
 *
 * @param element - The root React element to render
 * @param app - The GTK application to host the rendered tree
 *
 * @example
 * ```tsx
 * import * as Gtk from "@gtkx/ffi/gtk";
 * import { render, quit } from "@gtkx/react";
 *
 * const App = () => (
 *   <GtkApplicationWindow title="My App" onClose={quit}>
 *     <GtkLabel label="Hello, GTKX!" />
 *   </GtkApplicationWindow>
 * );
 *
 * const app = new Gtk.Application({ application_id: "com.example.myapp" });
 * render(<App />, app);
 * ```
 *
 * @see {@link quit} for shutting down the application
 */
export const render = (element: ReactNode, app: Gtk.Application): void => {
    app.register(null);
    app.activate();

    container = reconciler.createContainer(
        app,
        1,
        null,
        false,
        null,
        "",
        (error: unknown) => {
            getSignalStore(app).forceUnblockAll();
            throw error;
        },
        (error: unknown) => {
            getSignalStore(app).forceUnblockAll();
            console.error(error);
        },
        () => {},
        () => {},
    );

    reconciler.updateContainer(element, container, null, () => {});
};

/**
 * Gracefully shuts down the GTK application.
 *
 * Unmounts the React component tree and stops the GTK main loop.
 * Typically used as the `onClose` handler for the application window.
 *
 * @example
 * ```tsx
 * import { quit } from "@gtkx/react";
 *
 * const App = () => (
 *   <GtkApplicationWindow title="My App" onClose={quit}>
 *     <GtkButton label="Quit" onClicked={quit} />
 *   </GtkApplicationWindow>
 * );
 * ```
 *
 * @see {@link render} for starting the application
 */
export const quit = (): void => {
    reconciler.updateContainer(null, container, null, () => {
        setTimeout(() => {
            stop();
        }, 0);
    });
};
