import EventEmitter from "node:events";
import { type NativeHandle, start as nativeStart, stop as nativeStop } from "@gtkx/native";
import { init as initAdwaita } from "./generated/adw/functions.js";
import type { ApplicationFlags } from "./generated/gio/enums.js";
import type { Application } from "./generated/gtk/application.js";
import { finalize as finalizeGtkSource, init as initGtkSource } from "./generated/gtksource/functions.js";
import { getNativeObject } from "./registry.js";

let application: Application | null = null;
let keepAliveTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Event map for application lifecycle events.
 */
type NativeEventMap = {
    /** Emitted when the GTK application starts */
    start: [];
    /** Emitted when the GTK application stops */
    stop: [];
};

/**
 * Event emitter for GTK application lifecycle events.
 *
 * Emits "start" when {@link start} is called and "stop" when
 * {@link stop} is called.
 *
 * @example
 * ```tsx
 * import { events } from "@gtkx/ffi";
 *
 * events.on("start", () => {
 *   console.log("Application started");
 * });
 *
 * events.on("stop", () => {
 *   console.log("Application stopping");
 * });
 * ```
 */
export const events = new EventEmitter<NativeEventMap>();

/**
 * Flag indicating if a native object is currently being instantiated.
 *
 * @internal
 */
export let isInstantiating = false;

/**
 * Sets the instantiation flag.
 *
 * @internal
 */
export const setInstantiating = (value: boolean): void => {
    isInstantiating = value;
};

/**
 * Whether the GTK application runtime is currently running.
 * `true` if {@link start} has been called and {@link stop} has not.
 */
export const isStarted = (): boolean => {
    return Boolean(application);
};

const keepAlive = (): void => {
    keepAliveTimeout = setTimeout(() => keepAlive(), 2147483647);
};

/**
 * Initializes the GTK application runtime.
 *
 * Creates a GTK Application instance, initializes Adwaita and GtkSource
 * if available, and starts the event loop.
 *
 * @param appId - Application ID in reverse domain notation (e.g., "com.example.app")
 * @param flags - Optional GIO application flags
 * @returns The GTK Application instance
 *
 * @example
 * ```tsx
 * import { start } from "@gtkx/ffi";
 *
 * const app = start("com.example.myapp");
 * ```
 *
 * @see {@link stop} for shutting down the application
 */
export const start = (appId: string, flags?: ApplicationFlags): Application => {
    if (application) {
        return application;
    }

    const handle = nativeStart(appId, flags);
    application = getNativeObject(handle as NativeHandle) as Application;

    try {
        initAdwaita();
        initGtkSource();
    } catch {}

    events.emit("start");
    keepAlive();
    return application;
};

/**
 * Shuts down the GTK application runtime.
 *
 * Stops the event loop, cleans up resources, and finalizes libraries.
 * Emits a "stop" event before cleanup.
 *
 * @see {@link start} for initializing the application
 * @see {@link events} for lifecycle event handling
 */
export const stop = (): void => {
    if (!application) {
        return;
    }

    if (keepAliveTimeout) {
        clearTimeout(keepAliveTimeout);
        keepAliveTimeout = null;
    }

    try {
        finalizeGtkSource();
    } catch {}

    events.emit("stop");
    application = null;
    nativeStop();
};
