import type { ReactNode } from "react";
import { reconciler } from "./reconciler.js";
import type { ContainerInfo } from "./types.js";

const noop = (): void => {};

type FiberRoot = ReturnType<typeof reconciler.createContainer>;

type ReconcilerErrorCallback = (error: Error, info: { componentStack?: string | null }) => void;

export type ReconcilerRootOptions = {
    containerInfo: ContainerInfo;
    onUncaughtError: ReconcilerErrorCallback;
    onCaughtError: ReconcilerErrorCallback;
    onRecoverableError?: ReconcilerErrorCallback;
};

export type ReconcilerRoot = {
    fiberRoot: FiberRoot;
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

export const unmountAllReconcilerRoots = <R>(free: (root: ReconcilerRoot) => R): R[] => {
    const roots = [...activeRoots];
    activeRoots.clear();
    return roots.map(free);
};
