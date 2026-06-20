import type { ReactNode } from "react";
import { type ReconcilerErrorHandler, setReconcilerErrorHandler } from "./reconciler-error-sink.js";
import { createReconcilerRoot, type ReconcilerRoot, unmountAllReconcilerRoots } from "./reconciler-root.js";
import { createRootElement, type RootElement } from "./root-element.js";
import { getSignalStore } from "./signal-store.js";

const priorHandlers = new WeakMap<ReconcilerRoot, ReconcilerErrorHandler | null>();

const teardownRoot = (root: ReconcilerRoot): void => {
    setReconcilerErrorHandler(priorHandlers.get(root) ?? null);
    root.update(null);
};

/**
 * A render root, the entry point for mounting a React tree onto GTK. Returned
 * by {@link createRoot} and mirroring the `Root` object from `react-dom`'s
 * `createRoot`.
 */
export type Root = {
    /**
     * Mounts (or, on later calls, updates) the element tree on this root. The
     * tree is expected to render a {@link GtkApplication} or
     * {@link AdwApplication} component, which constructs the GTK application,
     * registers and activates it, and publishes it through
     * `ApplicationContext`.
     *
     * @param element - The root React element to render.
     */
    render(element: ReactNode): void;
    /**
     * Unmounts the tree, restores the reconciler error handler captured at
     * creation time, and frees the container. When the tree contains a
     * {@link GtkApplication} or {@link AdwApplication}, its unmount quits the
     * application, which stops the GTK runtime by default. Calling twice is a
     * no-op.
     */
    unmount(): void;
};

/**
 * Creates a render root for a React element tree, the counterpart to
 * `createRoot` in `react-dom`.
 *
 * Each root owns a per-root {@link RootElement} container, defaulting to a fresh
 * one so two roots never share identity. Call {@link Root.render} once at module
 * top-level in your entry file, or once per test that drives the reconciler
 * directly.
 *
 * In the dev server, the entry module runs once per process. Component-level
 * edits are applied via React Refresh; edits that propagate up to the entry
 * trigger a process restart so the root is created at most once per process.
 *
 * @param container - The root container token. Defaults to a fresh
 *   {@link createRootElement} token; pass one only to control root identity.
 * @returns A {@link Root} whose `render()` mounts the tree and whose `unmount()`
 *   tears it down.
 *
 * @example
 * ```tsx
 * import { GtkApplication, GtkApplicationWindow, GtkLabel } from "@gtkx/jsx/gtk";
 * import { createRoot, quit } from "@gtkx/react";
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
 * createRoot().render(<App />);
 * ```
 *
 * @see {@link quit} for shutting down the application
 */
export const createRoot = (container: RootElement = createRootElement()): Root => {
    const onUncaughtError = (error: unknown): void => {
        getSignalStore(container).forceUnblockAll();
        throw error;
    };
    const onCaughtError = (error: unknown): void => {
        getSignalStore(container).forceUnblockAll();
        console.error(error);
    };

    const priorHandler = setReconcilerErrorHandler(onUncaughtError);

    const root = createReconcilerRoot({ containerInfo: container, onUncaughtError, onCaughtError });
    priorHandlers.set(root, priorHandler);

    return {
        render: (element: ReactNode): void => {
            root.update(element);
        },
        unmount: (): void => {
            root.unmount(teardownRoot);
        },
    };
};

/**
 * Gracefully shuts down the GTK application.
 *
 * Unmounts every active render root and restores their reconciler error
 * handlers — the teardown counterpart to {@link createRoot}. Unmounting a
 * tree that contains a {@link GtkApplication} or {@link AdwApplication} quits
 * the application, which stops the GTK runtime by default, so the process exits
 * once the roots are gone. Typically called from the main window's
 * `onCloseRequest` handler, returning `true` so GTK's native close is vetoed
 * and the React tree controls the teardown.
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
 * @see {@link createRoot} for starting the application
 */
export const quit = (): void => {
    unmountAllReconcilerRoots(teardownRoot);
};
