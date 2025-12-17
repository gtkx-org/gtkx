import { getCurrentApp, stop } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { Arg } from "@gtkx/native";
import { call } from "@gtkx/native";
import type React from "react";
import type Reconciler from "react-reconciler";
import { afterAll, afterEach } from "vitest";
import { endCommit } from "../src/batch.js";
import { reconciler } from "../src/reconciler.js";
import { getContainer } from "../src/render.js";

export { getCurrentApp };

const getInstance = () => reconciler.getInstance();

type ReconcilerWithFlushSync = { flushSyncFromReconciler: (fn: () => void) => void };

const renderSync = (element: React.ReactNode): void => {
    const container = getContainer() as Reconciler.FiberRoot;
    const instance = getInstance();
    const instanceAny = instance as unknown as ReconcilerWithFlushSync;
    instanceAny.flushSyncFromReconciler(() => {
        instance.updateContainer(element, container, null, () => {});
    });
    instance.flushPassiveEffects();
};

export const render = (element: React.ReactNode): void => {
    const container = getContainer();
    if (!container) {
        throw new Error("Test container not initialized. Call setupTests() in your test file.");
    }
    renderSync(element);
};

export const flushSync = (fn: () => void): void => {
    const instance = getInstance();
    const instanceAny = instance as unknown as ReconcilerWithFlushSync;
    instanceAny.flushSyncFromReconciler(fn);
    instance.flushPassiveEffects();
};

export { update } from "../src/index.js";

const cleanup = (): void => {
    const container = getContainer();
    if (container) {
        renderSync(null);
    }
};

afterEach(() => {
    endCommit();
    cleanup();
});

afterAll(() => {
    cleanup();
    stop();
});

export const flushMicrotasks = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve));

export const fireEvent = async (element: Gtk.Widget, signalName: string, ...args: Arg[]): Promise<void> => {
    call(
        "libgobject-2.0.so.0",
        "g_signal_emit_by_name",
        [{ type: { type: "gobject" }, value: element.id }, { type: { type: "string" }, value: signalName }, ...args],
        { type: "undefined" },
    );

    await flushMicrotasks();
};
