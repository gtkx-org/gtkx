import type { ReactNode } from "react";
import { reconciler } from "./reconciler.js";
import type { Container } from "./types.js";

const noop = (): void => {};

type FiberRoot = ReturnType<typeof reconciler.createContainer>;

type ReconcilerErrorCallback = (error: Error, info: { componentStack?: string | null }) => void;

/**
 * Configuration for `createReconcilerRoot`: the container to mount into and the error callbacks.
 */
export type ReconcilerRootOptions = {
    containerInfo: Container;
    onUncaughtError: ReconcilerErrorCallback;
    onCaughtError: ReconcilerErrorCallback;
    onRecoverableError?: ReconcilerErrorCallback;
};

/**
 * A low-level reconciler root that renders an element tree into a container and can be unmounted.
 */
export type ReconcilerRoot = {
    update(element: ReactNode): void;
    /** Unmounts the root, calling `free` once to release it; returns `undefined` if already unmounted. */
    unmount<R>(free: (root: ReconcilerRoot) => R): R | undefined;
};

const activeRoots = new Set<ReconcilerRoot>();

/**
 * Creates a `ReconcilerRoot` bound to a container, registering it so it can be unmounted later.
 *
 * @param options The container and error callbacks for the root.
 * @returns The created reconciler root.
 */
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
            reconciler.updateContainer(element, fiberRoot, null, noop);
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
