import { start, stop } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import type React from "react";
import type Reconciler from "react-reconciler";
import { afterEach, beforeAll } from "vitest";
import { reconciler } from "../src/reconciler.js";

const APP_ID = "com.gtkx.test.react";

let app: Gtk.Application | null = null;
let container: Reconciler.FiberRoot | null = null;

export const getApp = (): Gtk.Application => {
    if (!app) {
        throw new Error("GTK app not initialized. Call setupTests() in your test file.");
    }
    return app;
};

const getInstance = () => reconciler.getInstance();

export const render = (element: React.ReactNode): void => {
    if (!container) {
        throw new Error("Test container not initialized. Call setupTests() in your test file.");
    }
    const instance = getInstance();
    instance.updateContainer(element, container, null, () => {});
    instance.flushPassiveEffects();
};

export const cleanup = (): void => {
    if (container) {
        const instance = getInstance();
        instance.updateContainer(null, container, null, () => {});
        instance.flushPassiveEffects();
    }
};

export const setupTests = () => {
    beforeAll(() => {
        if (!app) {
            app = start(APP_ID);
            reconciler.setApp(app);
            const instance = getInstance();
            container = instance.createContainer(
                app,
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
        cleanup();
    });
};

export const teardown = () => {
    if (app) {
        cleanup();
        stop();
        app = null;
        container = null;
    }
};
