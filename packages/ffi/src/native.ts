import { EventEmitter } from "node:events";
import { createRef, start as nativeStart, stop as nativeStop } from "@gtkx/native";

export { createRef };

import type { ApplicationFlags } from "./generated/gio/enums.js";
import { Application } from "./generated/gtk/application.js";

type NativeEventMap = {
    start: [];
    stop: [];
};

let keepAliveTimeout: NodeJS.Timeout | null = null;

/**
 * Event emitter for GTK lifecycle events.
 * Emits "start" when GTK is initialized and "stop" before shutdown.
 */
export const events = new EventEmitter<NativeEventMap>();

/**
 * Wraps a native pointer in a class instance without calling the constructor.
 * Used when receiving pointers from FFI calls that need to be wrapped as TypeScript objects.
 * @param ptr - The native pointer to wrap
 * @param cls - The class whose prototype should be used
 * @returns A new instance with the pointer attached
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
 * Starts the GTK application with the given application ID.
 * Sets up a keep-alive timer to prevent Node.js from exiting.
 * @param appId - The application ID (e.g., "com.example.myapp")
 * @param flags - Optional GIO application flags
 * @returns The GTK Application instance
 */
export const start = (appId: string, flags?: ApplicationFlags): Application => {
    const app = nativeStart(appId, flags);
    events.emit("start");

    keepAlive();

    return wrapPtr(app, Application);
};

/**
 * Stops the GTK application and cleans up the keep-alive timer.
 * Emits the "stop" event before shutting down to allow cleanup.
 */
export const stop = (): void => {
    if (keepAliveTimeout) {
        clearTimeout(keepAliveTimeout);
        keepAliveTimeout = null;
    }

    events.emit("stop");
    nativeStop();
};
