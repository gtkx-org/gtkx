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
 * Compile-time substitution for the application id.
 *
 * `gtkx build` and `gtkx dev` inject the `appId` from `gtkx.config.ts` here
 * via Vite's `define` so that user code can call `render(<App />)` with no
 * positional `appId` argument. When unbundled (e.g. unit tests, bare Node),
 * the `typeof` guard below resolves it to undefined safely.
 */
declare const __GTKX_APP_ID__: string | undefined;

/**
 * Renders a React element tree into a GTK4 application window.
 *
 * This is the main entry point for GTKX applications. It initializes the GTK4
 * runtime, creates an application container, and begins the React reconciliation
 * process.
 *
 * @param element - The root React element to render
 * @param appId - Application ID in reverse-DNS notation (e.g. `"com.example.myapp"`).
 *     Optional when the bundle was produced by `gtkx build` or `gtkx dev` against
 *     a `gtkx.config.ts` that supplied `appId`; the CLI injects that value at
 *     build time and the explicit argument acts as an override.
 * @param flags - Optional GIO application flags for customizing behavior
 * @throws If no `appId` is available — neither the argument was provided nor a
 *     value was injected by the CLI from `gtkx.config.ts`
 *
 * @example
 * ```tsx
 * import { render, quit } from "@gtkx/react";
 *
 * const App = () => (
 * <GtkApplicationWindow title="My App" onClose={quit}>
 * <GtkLabel label="Hello, GTKX!" />
 * </GtkApplicationWindow>
 * );
 *
 * // Built with `gtkx build` (appId injected from gtkx.config.ts):
 * render(<App />);
 *
 * // Or pass it explicitly:
 * render(<App />, "com.example.myapp");
 * ```
 *
 * @see {@link quit} for shutting down the application
 * @see {@link update} for hot-reloading the rendered tree
 */
export const render = (element: ReactNode, appId?: string, flags?: Gio.ApplicationFlags): void => {
    const injectedAppId = __GTKX_APP_ID__;
    const resolvedAppId = appId ?? injectedAppId;
    if (!resolvedAppId) {
        throw new Error(
            "render(): no appId was provided and no value was injected from gtkx.config.ts. " +
                "Set `appId` in gtkx.config.ts (used by `gtkx build`/`gtkx dev`), or pass it as the second argument.",
        );
    }
    const application = start(resolvedAppId, flags);
    app = application;

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
 * import.meta.hot.accept(() => {
 * update(<App />);
 * });
 * }
 * ```
 *
 * @see {@link render} for initial rendering
 */
export const update = (element: ReactNode): Promise<void> => {
    return new Promise((resolve) => {
        reconciler.updateContainer(
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
    if (isHotReloading) {
        return;
    }

    reconciler.updateContainer(null, container, null, () => {
        setTimeout(() => {
            stop();
        }, 0);
    });
};
