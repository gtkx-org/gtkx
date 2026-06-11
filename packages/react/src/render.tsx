import type * as Gtk from "@gtkx/gi/gtk";
import { createContext, type ReactNode, useContext } from "react";
import { getSignalStore } from "./nodes/internal/signal-store.js";
import { reconciler } from "./reconciler.js";
import { type ReconcilerErrorHandler, setReconcilerErrorHandler } from "./reconciler-error-sink.js";

/**
 * React Context providing access to the GTK Application instance.
 *
 * The {@link GtkApplication} and {@link AdwApplication} components publish their
 * backing application through this context. Use {@link useApplication} to read it
 * in descendant components.
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
 * Must be called within a component rendered under a {@link GtkApplication} or
 * {@link AdwApplication}. Throws an error if called outside the application
 * context.
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

type ActiveRoot = {
    container: unknown;
    sentinel: object;
    priorHandler: ReconcilerErrorHandler | null;
};

const activeRoots = new Set<ActiveRoot>();

/**
 * Handle returned by {@link render}, allowing callers to tear down a single
 * rendered tree independently of the rest of the application.
 */
export type RenderHandle = {
    /**
     * Unmounts the tree, restores the reconciler error handler captured at
     * mount time, and frees the container. When the tree contains a
     * {@link GtkApplication} or {@link AdwApplication}, its unmount runs the
     * application teardown, which stops the GTK runtime by default. Calling
     * twice is a no-op.
     */
    unmount(): void;
};

/**
 * Renders a React element tree.
 *
 * Creates a per-root sentinel container and begins reconciliation. The element
 * tree is expected to render a {@link GtkApplication} (or {@link AdwApplication})
 * component, which constructs the GTK application, registers and activates it,
 * and publishes it through {@link ApplicationContext}. Mirrors the role of
 * `createRoot().render()` in `react-dom`: call once at module top-level in your
 * entry file, or once per test that drives the reconciler directly.
 *
 * In the dev server, the entry module runs once per process. Component-level
 * edits are applied via React Refresh; edits that propagate up to the entry
 * trigger a process restart so this function still runs at most once per
 * process.
 *
 * @param element - The root React element to render
 * @returns A handle whose `unmount()` method tears down this root.
 *
 * @example
 * ```tsx
 * import { GtkApplication, GtkApplicationWindow, GtkLabel } from "@gtkx/jsx/gtk";
 * import { render, quit } from "@gtkx/react";
 *
 * const App = () => (
 *   <GtkApplication applicationId="com.example.myapp">
 *     <GtkApplicationWindow
 *       title="My App"
 *       onCloseRequest={() => {
 *         quit();
 *         return true;
 *       }}
 *     >
 *       <GtkLabel label="Hello, GTKX!" />
 *     </GtkApplicationWindow>
 *   </GtkApplication>
 * );
 *
 * render(<App />);
 * ```
 *
 * @see {@link quit} for shutting down the application
 */
export const render = (element: ReactNode): RenderHandle => {
    const sentinel: object = {};

    const onUncaughtError = (error: unknown): void => {
        getSignalStore(sentinel).forceUnblockAll();
        throw error;
    };
    const onCaughtError = (error: unknown): void => {
        getSignalStore(sentinel).forceUnblockAll();
        console.error(error);
    };

    const priorHandler = setReconcilerErrorHandler(onUncaughtError);

    const container = reconciler.createContainer(
        sentinel,
        1,
        null,
        false,
        null,
        "",
        onUncaughtError,
        onCaughtError,
        () => {},
        () => {},
    );

    const root: ActiveRoot = { container, sentinel, priorHandler };
    activeRoots.add(root);

    reconciler.updateContainer(element, container, null, () => {});

    return {
        unmount: () => {
            if (!activeRoots.delete(root)) return;
            setReconcilerErrorHandler(root.priorHandler);
            reconciler.updateContainer(null, root.container, null, () => {});
        },
    };
};

/**
 * Gracefully shuts down the GTK application.
 *
 * Unmounts every active render root and restores their reconciler error
 * handlers — the `render(null)` counterpart to {@link render}. Unmounting a
 * tree that contains a {@link GtkApplication} or {@link AdwApplication} runs
 * the application teardown, which stops the GTK runtime by default, so the
 * process exits once the roots are gone. A tree without an application
 * component keeps the runtime alive; stop it explicitly with `stop` from
 * `@gtkx/ffi`. Typically called from the main window's `onCloseRequest`
 * handler, returning `true` so GTK's native close is vetoed and the React
 * tree controls the teardown.
 *
 * @example
 * ```tsx
 * import { GtkApplicationWindow, GtkButton } from "@gtkx/jsx/gtk";
 * import { quit } from "@gtkx/react";
 *
 * const App = () => (
 *   <GtkApplicationWindow
 *     title="My App"
 *     onCloseRequest={() => {
 *       quit();
 *       return true;
 *     }}
 *   >
 *     <GtkButton label="Quit" onClicked={quit} />
 *   </GtkApplicationWindow>
 * );
 * ```
 *
 * @see {@link render} for starting the application
 */
export const quit = (): void => {
    const roots = [...activeRoots];
    activeRoots.clear();

    for (const root of roots) {
        setReconcilerErrorHandler(root.priorHandler);
        reconciler.updateContainer(null, root.container, null, () => {});
    }
};
