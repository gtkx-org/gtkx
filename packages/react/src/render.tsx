import { start, stop } from "@gtkx/ffi";
import type * as Gio from "@gtkx/ffi/gio";
import type * as Gtk from "@gtkx/ffi/gtk";
import { createContext, type ReactNode, useContext } from "react";
import { toGtkxError } from "./errors.js";
import { getSignalStore } from "./nodes/internal/signal-store.js";
import { reconciler } from "./reconciler.js";

/**
 * React Context providing access to the GTK Application instance.
 *
 * Use {@link useApplication} to access the application in components.
 *
 * @example
 * ```tsx
 * const App = () => {
 * const app = useApplication();
 * console.log(app.applicationId);
 * return <GtkLabel label="Hello" />;
 * };
 * ```
 */
export const ApplicationContext = createContext<Gtk.Application | null>(null);

/**
 * Hook to access the GTK Application instance.
 *
 * Must be called within a component rendered by {@link render}.
 * Throws an error if called outside the application context.
 *
 * @returns The GTK Application instance
 *
 * @example
 * ```tsx
 * const MyComponent = () => {
 * const app = useApplication();
 * return <GtkLabel label={app.applicationId} />;
 * };
 * ```
 *
 * @see {@link ApplicationContext} for the underlying context
 */
export const useApplication = (): Gtk.Application => {
    const context = useContext(ApplicationContext);

    if (!context) {
        throw new Error("Expected ApplicationContext: useApplication must be called within Application");
    }

    return context;
};

let container: unknown = null;

/**
 * Renders a React element tree into a GTK4 application window.
 *
 * Initializes the GTK4 runtime, creates an application container, and begins
 * the React reconciliation process. Mirrors the role of `createRoot().render()`
 * in `react-dom`: call once at module top-level in your entry file.
 *
 * In the dev server, the entry module runs once per process. Component-level
 * edits are applied via React Refresh; edits that propagate up to the entry
 * trigger a process restart so this function still runs at most once per life.
 *
 * @param element - The root React element to render
 * @param appId - Application ID in reverse-DNS notation (e.g. `"com.example.myapp"`)
 * @param flags - Optional GIO application flags
 *
 * @example
 * ```tsx
 * import * as Gio from "@gtkx/ffi/gio";
 * import { render, quit } from "@gtkx/react";
 *
 * const App = () => (
 * <GtkApplicationWindow title="My App" onClose={quit}>
 * <GtkLabel label="Hello, GTKX!" />
 * </GtkApplicationWindow>
 * );
 *
 * render(<App />, "com.example.myapp", Gio.ApplicationFlags.NON_UNIQUE);
 * ```
 *
 * @see {@link quit} for shutting down the application
 */
export const render = (element: ReactNode, appId: string, flags?: Gio.ApplicationFlags): void => {
    const application = start(appId, flags);

    container = reconciler.createContainer(
        application,
        1,
        null,
        false,
        null,
        "",
        (error: unknown) => {
            getSignalStore(application).forceUnblockAll();
            throw toGtkxError(error);
        },
        (error: unknown) => {
            getSignalStore(application).forceUnblockAll();
            console.error(toGtkxError(error).toString());
        },
        () => {},
        () => {},
    );

    reconciler.updateContainer(
        <ApplicationContext.Provider value={application}>{element}</ApplicationContext.Provider>,
        container,
        null,
        () => {},
    );
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
 * <GtkApplicationWindow title="My App" onClose={quit}>
 * <GtkButton label="Quit" onClicked={quit} />
 * </GtkApplicationWindow>
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
