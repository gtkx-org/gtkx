import { EventEmitter } from "node:events";
import { createRef, start as nativeStart, stop as nativeStop } from "@gtkx/native";

export { createRef };

import type { ApplicationFlags } from "./generated/gio/enums.js";
import { Application } from "./generated/gtk/application.js";

let keepAliveTimeout: NodeJS.Timeout | null = null;
let isReady = false;

/**
 * Event emitter for GTK lifecycle events.
 */
const events = new EventEmitter();

/**
 * Wraps a native pointer in a class instance without calling the constructor.
 * Used when receiving pointers from FFI calls that need to be wrapped as TypeScript objects.
 */
export const wrapPtr = <T extends object>(ptr: unknown, cls: { prototype: T }): T => {
    const instance = Object.create(cls.prototype) as T & { ptr: unknown };
    instance.ptr = ptr;
    return instance;
};

const keepAlive = (): void => {
    keepAliveTimeout = setTimeout(() => keepAlive(), 2147483647);
};

/**
 * Register a callback to be called when GTK is initialized.
 * If GTK is already ready, the callback is called immediately.
 */
export const onReady = (callback: () => void): void => {
    if (isReady) {
        callback();
    } else {
        events.once("ready", callback);
    }
};

/**
 * Starts the GTK application with the given application ID.
 * Sets up a keep-alive timer to prevent Node.js from exiting.
 * @param appId - The application ID (e.g., "com.example.myapp")
 * @param flags - Optional GIO application flags
 * @returns The GTK Application instance
 */
export const start = (appId: string, flags?: ApplicationFlags): Application => {
    const app = nativeStart(appId, flags);

    isReady = true;
    events.emit("ready");
    keepAlive();

    return wrapPtr(app, Application);
};

/**
 * Stops the GTK application and cleans up the keep-alive timer.
 */
export const stop = (): void => {
    if (keepAliveTimeout) {
        clearTimeout(keepAliveTimeout);
        keepAliveTimeout = null;
    }

    nativeStop();
};
