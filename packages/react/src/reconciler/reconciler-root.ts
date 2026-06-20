import type { ReactNode } from "react";
import { reconciler } from "./reconciler.js";
import type { ContainerInfo } from "./types.js";

const noop = (): void => {};

/** The reconciler's opaque fiber-container handle, as `createContainer` returns it. */
export type FiberRoot = ReturnType<typeof reconciler.createContainer>;

/** A reconciler error callback, receiving the thrown error and React's error info. */
type ReconcilerErrorCallback = (error: Error, info: { readonly componentStack?: string | null }) => void;

/**
 * The error routing a {@link createReconcilerRoot} caller injects. Each callback
 * mirrors one of the reconciler container's error hooks; the primitive forwards
 * them to `createContainer` and otherwise stays policy-free.
 */
export type ReconcilerRootOptions = {
    /** The mount target: a backing GObject or a root-element token. */
    readonly containerInfo: ContainerInfo;
    /** Routes an error that escaped every error boundary. */
    readonly onUncaughtError: ReconcilerErrorCallback;
    /** Routes an error an error boundary caught. */
    readonly onCaughtError: ReconcilerErrorCallback;
    /** Routes an error React recovered from by retrying, or none when omitted. */
    readonly onRecoverableError?: ReconcilerErrorCallback;
};

/**
 * A reconciler fiber container with its lifecycle reduced to the two operations
 * every caller shares. `update` commits an element tree (or `null` to clear);
 * `unmount` runs the registry's delete-guard once, then the caller-supplied
 * `free` strategy.
 */
export type ReconcilerRoot = {
    /** The underlying fiber container. */
    readonly fiberRoot: FiberRoot;
    /**
     * Commits `element` to the container, or tears the tree down when `null`.
     * Synchronous; a caller needing test-environment flushing wraps the call.
     */
    update(element: ReactNode): void;
    /**
     * Removes the root from the active registry exactly once and, when this call
     * performed the removal, runs `free` to release the container. Returns the
     * `free` result so an async strategy can be awaited; a no-op repeat returns
     * `undefined`.
     *
     * @param free - Releases the container, e.g. a synchronous or act-wrapped commit.
     */
    unmount<R>(free: (root: ReconcilerRoot) => R): R | undefined;
};

const activeRoots = new Set<ReconcilerRoot>();

/**
 * Creates a reconciler fiber container and registers it in the shared active-root
 * set, returning the {@link ReconcilerRoot} the production and testing roots both
 * build on. The primitive owns the full positional `createContainer` shape and
 * the delete-guarded teardown; the caller injects only its error routing and any
 * update wrapping.
 *
 * @param options - The container target and error routing.
 * @returns The registered reconciler root.
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
 * Unmounts every active reconciler root, running `free` against each one. The
 * set is captured before iteration so a `free` that re-enters teardown is a
 * no-op. Production's `quit` and the testing harness's `cleanup` both fan their
 * teardown through this.
 *
 * @param free - Releases one root, e.g. a synchronous or act-wrapped commit.
 */
export const unmountAllReconcilerRoots = <R>(free: (root: ReconcilerRoot) => R): R[] => {
    const roots = [...activeRoots];
    activeRoots.clear();
    return roots.map(free);
};
