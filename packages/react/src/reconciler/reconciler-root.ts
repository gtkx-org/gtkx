import type { ReactNode } from "react";
import { reconciler } from "./reconciler.js";
import type { ContainerInfo } from "./types.js";

const noop = (): void => {};

type FiberRoot = ReturnType<typeof reconciler.createContainer>;

type ReconcilerErrorCallback = (error: Error, info: { componentStack?: string | null }) => void;

/**
 * Options for {@link createReconcilerRoot}.
 */
export type ReconcilerRootOptions = {
    /** The container the reconciler mounts its tree into. */
    containerInfo: ContainerInfo;
    /** Invoked when an uncaught error escapes rendering. */
    onUncaughtError: ReconcilerErrorCallback;
    /** Invoked when an error is caught by an error boundary. */
    onCaughtError: ReconcilerErrorCallback;
    /** Invoked when React recovers from a concurrent error. */
    onRecoverableError?: ReconcilerErrorCallback;
};

/**
 * A live reconciler root: a fiber container with update and unmount controls.
 */
export type ReconcilerRoot = {
    /** The underlying React fiber container. */
    fiberRoot: FiberRoot;
    /** Renders or re-renders `element` into the root. */
    update(element: ReactNode): void;
    /** Unmounts the root once, passing it to `free`; returns `free`'s result, or `undefined` if already unmounted. */
    unmount<R>(free: (root: ReconcilerRoot) => R): R | undefined;
};

const activeRoots = new Set<ReconcilerRoot>();

/**
 * Creates a new reconciler root bound to the supplied container and error callbacks.
 *
 * @param options - The container and error-handling callbacks for the root.
 * @returns A {@link ReconcilerRoot} tracked among the active roots.
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
        fiberRoot,
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

/**
 * Unmounts every active reconciler root, passing each to `free`, and returns their results.
 *
 * @param free - Teardown applied to each active root.
 * @returns The result of applying `free` to each root, in iteration order.
 */
export const unmountAllReconcilerRoots = <R>(free: (root: ReconcilerRoot) => R): R[] => {
    const roots = [...activeRoots];
    activeRoots.clear();
    return roots.map(free);
};
