import type { ReactNode } from "react";
import { log, type ReconcilerErrorHandler, setReconcilerErrorHandler } from "./reconciler-error-handler.js";
import { createReconcilerRoot, type ReconcilerRoot, unmountAllReconcilerRoots } from "./reconciler-root.js";
import { createRootElement, type RootElement } from "./root-element.js";
import { getSignalStore } from "./signal-store.js";

const priorHandlers = new WeakMap<ReconcilerRoot, ReconcilerErrorHandler | null>();

const teardownRoot = (root: ReconcilerRoot): void => {
    setReconcilerErrorHandler(priorHandlers.get(root) ?? null);
    root.update(null);
};

export type Root = {
    render(element: ReactNode): void;
    unmount(): void;
};

export const createRoot = (container: RootElement = createRootElement()): Root => {
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

export const quit = (): true => {
    unmountAllReconcilerRoots(teardownRoot);
    return true;
};
