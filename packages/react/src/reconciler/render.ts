import type { ReactNode } from "react";
import { log, type ReconcilerErrorHandler, setReconcilerErrorHandler } from "./reconciler-error-handler.js";
import { createReconcilerRoot, type ReconcilerRoot, unmountAllReconcilerRoots } from "./reconciler-root.js";
import { type RootElement, rootElement } from "./root-element.js";
import { getSignalStore } from "./signal-store.js";

const priorHandlers = new WeakMap<ReconcilerRoot, ReconcilerErrorHandler | null>();

const teardownRoot = (root: ReconcilerRoot): void => {
    setReconcilerErrorHandler(priorHandlers.get(root) ?? null);
    root.update(null);
};

/**
 * A render root that mounts a React element tree into a container and can unmount it.
 */
export type Root = {
    render(element: ReactNode): void;
    unmount(): void;
};

/**
 * Creates a render root for a container, wiring reconciler error handling to the container's signal store.
 *
 * @param container The root element to render into; defaults to the shared `rootElement`.
 * @returns A root with `render` and `unmount` methods.
 */
export const createRoot = (container: RootElement = rootElement): Root => {
    const onUncaughtError = (error: unknown): void => {
        getSignalStore(container).unblock();
        throw error;
    };
    const onCaughtError = (error: unknown): void => {
        getSignalStore(container).unblock();
        log.error("caught render error", error);
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
 * Unmounts all active render roots.
 *
 * @returns `true` once every root has been torn down.
 */
export const quit = (): true => {
    unmountAllReconcilerRoots(teardownRoot);
    return true;
};
