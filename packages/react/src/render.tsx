import { start, stop } from "@gtkx/ffi";
import type * as Gio from "@gtkx/ffi/gio";
import type * as Gtk from "@gtkx/ffi/gtk";
import { createContext, type ReactNode, useContext } from "react";
import { formatBoundaryError, formatRenderError } from "./errors.js";
import { reconciler } from "./reconciler.js";

/**
 * React Context for the GTK Application.
 */
export const ApplicationContext = createContext<Gtk.Application | null>(null);

/**
 * Hook to access the GTK Application instance from React components.
 * Must be used within an ApplicationContext.Provider.
 *
 * @throws Error if used outside of an ApplicationContext.Provider
 * @returns The GTK Application instance
 */
export const useApplication = (): Gtk.Application => {
    const context = useContext(ApplicationContext);

    if (!context) {
        throw new Error("useApplication must be used within an ApplicationContext.Provider");
    }

    return context;
};

let container: unknown = null;

/**
 * Renders a React element tree as a GTK application.
 * This is the main entry point for GTKX applications.
 *
 * @example
 * ```tsx
 * render(
 *   <ApplicationWindow title="My App">
 *     Hello, GTKX!
 *   </ApplicationWindow>,
 *   "com.example.myapp"
 * );
 * ```
 *
 * @param element - The root React element to render
 * @param appId - The application ID (e.g., "com.example.myapp")
 * @param flags - Optional GIO application flags
 */
export const render = (element: ReactNode, appId: string, flags?: Gio.ApplicationFlags): void => {
    const app = start(appId, flags);
    const instance = reconciler.getInstance();

    container = instance.createContainer(
        app,
        0,
        null,
        false,
        null,
        "",
        (error: unknown) => {
            throw formatRenderError(error);
        },
        (error: unknown) => {
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
 * Updates the React tree without restarting the GTK application.
 * Used for hot module replacement (HMR) during development.
 *
 * @param element - The new root React element to render
 * @throws Error if called before render()
 */
export const update = (element: ReactNode): void => {
    reconciler.getInstance().updateContainer(element, container, null, () => {});
};

/**
 * Quits the GTK application and cleans up resources.
 * Unmounts the React tree and stops the GTK main loop.
 * @returns Always returns true (useful for signal handlers)
 */
export const quit = () => {
    reconciler.getInstance().updateContainer(null, container, null, () => {
        setTimeout(() => {
            stop();
        }, 0);
    });

    return true;
};
