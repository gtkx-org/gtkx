import { EventEmitter } from "node:events";
import { getObjectId, start as nativeStart, stop as nativeStop } from "@gtkx/native";
import type { ApplicationFlags } from "./generated/gio/enums.js";
import { typeNameFromInstance } from "./generated/gobject/functions.js";
import { Application } from "./generated/gtk/application.js";

type NativeEventMap = {
    start: [];
    stop: [];
};

let currentApp: Application | null = null;
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
 * @param cls.prototype - The prototype object to assign to the new instance
 * @returns A new instance with the pointer attached
 */
export function getObject<T extends object>(ptr: unknown, cls: { prototype: T }): T {
    const instance = Object.create(cls.prototype) as T & { ptr: unknown };
    instance.ptr = ptr;
    return instance;
}

const keepAlive = (): void => {
    keepAliveTimeout = setTimeout(() => keepAlive(), 2147483647);
};

/**
 * Starts the GTK application with the given application ID.
 * Sets up a keep-alive timer to prevent Node.js from exiting.
 * This function is idempotent - calling it multiple times returns the existing app.
 * @param appId - The application ID (e.g., "com.example.myapp")
 * @param flags - Optional GIO application flags
 * @returns The GTK Application instance
 */
export const start = (appId: string, flags?: ApplicationFlags): Application => {
    if (currentApp) {
        return currentApp;
    }

    const app = nativeStart(appId, flags);
    currentApp = getObject(app, Application);
    events.emit("start");

    keepAlive();

    return currentApp;
};

/**
 * Gets the current GTK application instance.
 * @returns The GTK Application instance
 * @throws Error if GTK has not been started yet
 */
export const getCurrentApp = (): Application => {
    if (!currentApp) {
        throw new Error("GTK application not initialized. Call start() first.");
    }
    return currentApp;
};

/**
 * Stops the GTK application and cleans up the keep-alive timer.
 * Emits the "stop" event before shutting down to allow cleanup.
 * This function is idempotent - calling it when not started does nothing.
 */
export const stop = (): void => {
    if (!currentApp) {
        return;
    }

    if (keepAliveTimeout) {
        clearTimeout(keepAliveTimeout);
        keepAliveTimeout = null;
    }

    events.emit("stop");
    nativeStop();
    currentApp = null;
};

export { createRef, getObjectId } from "@gtkx/native";

/**
 * Type guard that checks if an object is an instance of a specific GTK class.
 * Uses GLib's type system to check the actual runtime type.
 * @param obj - The object to check
 * @param obj.ptr - The native pointer to the GObject instance
 * @param cls - The class to check against
 * @param cls.glibTypeName - The GLib type name (e.g., "GtkButton")
 * @param cls.prototype - The class prototype used for type narrowing
 * @returns True if the object is an instance of the class
 * @example
 * ```ts
 * if (isInstanceOf(widget, Gtk.ApplicationWindow)) {
 *   widget.setShowMenubar(true); // TypeScript knows widget is ApplicationWindow
 * }
 * ```
 */
export function isInstanceOf<T extends { ptr: unknown }>(
    obj: { ptr: unknown },
    cls: { glibTypeName: string; prototype: T },
): obj is T {
    const typeName = typeNameFromInstance(getObjectId(obj.ptr));
    return typeName === cls.glibTypeName;
}
