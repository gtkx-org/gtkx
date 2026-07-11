import { freeze, unfreeze } from "@gtkx/ffi";
import type { ReactNode } from "react";
import { reconciler } from "./reconciler.js";
import { catchReconcilerError } from "./reconciler-error-handler.js";
import type { Container } from "./types.js";

const noop = (): void => {};

type FiberRoot = ReturnType<typeof reconciler.createContainer>;

type ReconcilerErrorCallback = (error: Error, info: { componentStack?: string | null }) => void;

export type ReconcilerRootOptions = {
    containerInfo: Container;
    onUncaughtError: ReconcilerErrorCallback;
    onCaughtError: ReconcilerErrorCallback;
    onRecoverableError?: ReconcilerErrorCallback;
};

export type ReconcilerRoot = {
    update(element: ReactNode): void;
    unmount<R>(free: (root: ReconcilerRoot) => R): R | undefined;
};

const activeRoots = new Set<ReconcilerRoot>();

export const createReconcilerRoot = (options: ReconcilerRootOptions): ReconcilerRoot => {
    const fiberRoot: FiberRoot = reconciler.createContainer(
        options.containerInfo,
        1,
        null,
        false,
        null,
        "",
        options.onUncaughtError,
        options.onCaughtError,
        options.onRecoverableError ?? noop,
        noop,
    );

    const root: ReconcilerRoot = {
        update: (element: ReactNode): void => {
            let frozen = false;
            catchReconcilerError(() => {
                freeze();
                frozen = true;
            });
            try {
                reconciler.updateContainer(element, fiberRoot, null, noop);
            } finally {
                if (frozen) catchReconcilerError(unfreeze);
            }
        },
        unmount: <R>(free: (root: ReconcilerRoot) => R): R | undefined => {
            if (!activeRoots.delete(root)) return undefined;
            return free(root);
        },
    };

    activeRoots.add(root);
    return root;
};

export const unmountAllReconcilerRoots = (free: (root: ReconcilerRoot) => void): void => {
    const roots = [...activeRoots];
    activeRoots.clear();
    roots.forEach(free);
};
