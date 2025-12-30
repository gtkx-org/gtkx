import { discardAllBatches, start, stop } from "@gtkx/ffi";
import type * as Gio from "@gtkx/ffi/gio";
import type * as Gtk from "@gtkx/ffi/gtk";
import { createContext, type ReactNode, useContext } from "react";
import { formatBoundaryError, formatRenderError } from "./errors.js";
import { reconciler } from "./reconciler.js";

/**
 * React Context providing access to the GTK Application instance.
 *
 * Use {@link useApplication} to access the application in components.
 *
 * @example
 * ```tsx
 * const App = () => {
 *   const app = useApplication();
 *   console.log(app.applicationId);
 *   return <GtkLabel label="Hello" />;
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
 *   const app = useApplication();
 *   return <GtkLabel label={app.applicationId} />;
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
let app: Gtk.Application | null = null;
let isHotReloading = false;

/**
 * Sets the hot reloading state.
 *
 * Used internally by the dev server to prevent quit() from closing
 * the application during HMR updates.
 *
 * @internal
 */
export const setHotReloading = (value: boolean): void => {
    isHotReloading = value;
};

/**
 * Renders a React element tree into a GTK4 application window.
 *
 * This is the main entry point for GTKX applications. It initializes the GTK4
 * runtime, creates an application container, and begins the React reconciliation
 * process.
 *
 * @param element - The root React element to render
 * @param appId - Application ID in reverse domain notation (e.g., "com.example.myapp")
 * @param flags - Optional GIO application flags for customizing behavior
 *
 * @example
 * ```tsx
 * import { render, quit } from "@gtkx/react";
 *
 * const App = () => (
 *   <GtkApplicationWindow title="My App" onCloseRequest={quit}>
 *     <GtkLabel label="Hello, GTKX!" />
 *   </GtkApplicationWindow>
 * );
 *
 * render(<App />, "com.example.myapp");
 * ```
 *
 * @see {@link quit} for shutting down the application
 * @see {@link update} for hot-reloading the rendered tree
 */
export const render = (element: ReactNode, appId: string, flags?: Gio.ApplicationFlags): void => {
    app = start(appId, flags);
    const instance = reconciler.getInstance();

    container = instance.createContainer(
        app,
        1,
        null,
        false,
        null,
        "",
        (error: unknown) => {
            discardAllBatches();
            throw formatRenderError(error);
        },
        (error: unknown) => {
            discardAllBatches();
            const formattedError = formatBoundaryError(error);
            console.error(formattedError.toString());
        },
        () => {},
        () => {},
        null,
    );

    instance.updateContainer(
        <ApplicationContext.Provider value={app}>{element}</ApplicationContext.Provider>,
        container,
        null,
        () => {},
    );
};

/**
 * Updates the rendered React element tree.
 *
 * Used primarily for hot module replacement (HMR) during development.
 * Replaces the current component tree with a new element without
 * reinitializing the GTK application.
 *
 * @param element - The new root React element to render
 *
 * @example
 * ```tsx
 * // In HMR handler
 * if (import.meta.hot) {
 *   import.meta.hot.accept(() => {
 *     update(<App />);
 *   });
 * }
 * ```
 *
 * @see {@link render} for initial rendering
 */
export const update = (element: ReactNode): Promise<void> => {
    return new Promise((resolve) => {
        reconciler
            .getInstance()
            .updateContainer(
                <ApplicationContext.Provider value={app}>{element}</ApplicationContext.Provider>,
                container,
                null,
                resolve,
            );
    });
};

/**
 * Gracefully shuts down the GTK application.
 *
 * Unmounts the React component tree and stops the GTK main loop.
 * Typically used as the `onCloseRequest` handler for the application window.
 *
 * @returns `false` to allow GTK to close the window
 *
 * @example
 * ```tsx
 * import { quit } from "@gtkx/react";
 *
 * const App = () => (
 *   <GtkApplicationWindow title="My App" onCloseRequest={quit}>
 *     <GtkButton label="Quit" onClicked={quit} />
 *   </GtkApplicationWindow>
 * );
 * ```
 *
 * @see {@link render} for starting the application
 */
export const quit = () => {
    if (isHotReloading) {
        return true;
    }

    reconciler.getInstance().updateContainer(null, container, null, () => {
        setTimeout(() => {
            stop();
        }, 0);
    });

    return true;
};
