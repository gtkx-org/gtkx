import { getCurrentApp, start, stop } from "@gtkx/ffi";
import type React from "react";
import type Reconciler from "react-reconciler";
import { afterEach, beforeAll } from "vitest";
import { endCommit } from "../src/batch.js";
import { ROOT_NODE_CONTAINER } from "../src/factory.js";
import { reconciler } from "../src/reconciler.js";

export { getCurrentApp };

const APP_ID = "com.gtkx.test.react";

let container: Reconciler.FiberRoot | null = null;

const getInstance = () => reconciler.getInstance();

/**
 * Internal React reconciler type that exposes flushSyncFromReconciler.
 * This method exists but is not part of the public type definitions.
 * Cast is necessary to access this internal API for synchronous test rendering.
 */
type ReconcilerWithFlushSync = { flushSyncFromReconciler: (fn: () => void) => void };

const renderSync = (element: React.ReactNode, fiberRoot: Reconciler.FiberRoot): void => {
    const instance = getInstance();
    const instanceAny = instance as unknown as ReconcilerWithFlushSync;
    instanceAny.flushSyncFromReconciler(() => {
        instance.updateContainer(element, fiberRoot, null, () => {});
    });
    instance.flushPassiveEffects();
};

export const render = (element: React.ReactNode): void => {
    if (!container) {
        throw new Error("Test container not initialized. Call setupTests() in your test file.");
    }
    renderSync(element, container);
};

export const flushSync = (fn: () => void): void => {
    const instance = getInstance();
    const instanceAny = instance as unknown as ReconcilerWithFlushSync;
    instanceAny.flushSyncFromReconciler(fn);
    instance.flushPassiveEffects();
};

const cleanup = (): void => {
    if (container) {
        renderSync(null, container);
    }
};

export const setupTests = () => {
    beforeAll(() => {
        if (!container) {
            start(APP_ID);
            const instance = getInstance();
            container = instance.createContainer(
                ROOT_NODE_CONTAINER,
                0,
                null,
                false,
                false,
                "",
                (error: Error) => console.error("Test reconciler error:", error),
                () => {},
                () => {},
                () => {},
                null,
            );
        }
    });

    afterEach(() => {
        endCommit();
        cleanup();
    });
};

export const teardown = () => {
    cleanup();
    stop();
    container = null;
};

export const flushMicrotasks = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve));
