import EventEmitter from "node:events";
import { type NativeHandle, init as nativeInit, stop as nativeStop } from "@gtkx/native";
import { init as initAdwaita } from "./generated/adw/functions.js";
import { init as initGtk } from "./generated/gtk/functions.js";
import { finalize as finalizeGtkSource, init as initGtkSource } from "./generated/gtksource/functions.js";

const KEEP_ALIVE_INTERVAL = 2147483647;

let mainLoopHandle: NativeHandle | null = nativeInit();
let keepAliveTimeout: ReturnType<typeof setTimeout> | null = null;
let runtimeReady = false;

const keepAlive = (): void => {
    keepAliveTimeout = setTimeout(keepAlive, KEEP_ALIVE_INTERVAL);
};

keepAlive();

/**
 * Event map for application lifecycle events.
 * @internal
 */
type NativeEventMap = {
    /** Emitted when extension libraries have been initialized */
    start: [];
    /** Emitted when the GTK runtime is shutting down */
    stop: [];
};

/**
 * Event emitter for GTK runtime lifecycle events.
 *
 * Emits "start" the first time {@link initRuntime} is called and "stop"
 * when {@link stop} is invoked.
 *
 * @example
 * ```tsx
 * import { events } from "@gtkx/ffi";
 *
 * events.on("start", () => {
 *   console.log("Runtime started");
 * });
 *
 * events.on("stop", () => {
 *   console.log("Runtime stopping");
 * });
 * ```
 */
export const events = new EventEmitter<NativeEventMap>();

/**
 * Whether the GTK runtime has been fully initialized.
 *
 * `true` once {@link initRuntime} has run and {@link stop} has not yet
 * been called.
 */
export const isStarted = (): boolean => runtimeReady;

/**
 * Initializes optional GTK extension libraries (Adwaita, GtkSource).
 *
 * The `GLib` main loop is spawned automatically when `@gtkx/ffi` is
 * imported, so most callers should rely on `render` from `@gtkx/react`
 * to trigger initialization. Call this directly only when bootstrapping
 * GTK without the React reconciler.
 */
export const initRuntime = (): void => {
    if (runtimeReady) return;
    runtimeReady = true;

    initGtk();

    try {
        initAdwaita();
        initGtkSource();
    } catch {}

    events.emit("start");
};

/**
 * Shuts down the GTK runtime.
 *
 * Finalizes extension libraries, emits a `"stop"` event, quits the `GLib`
 * main loop, and clears the keep-alive timer so the Node.js process can
 * exit cleanly. Once stopped, no further FFI calls may be made.
 *
 * @see {@link initRuntime}
 * @see {@link events}
 */
export const stop = (): void => {
    if (!mainLoopHandle) return;

    if (runtimeReady) {
        runtimeReady = false;

        try {
            finalizeGtkSource();
        } catch {}

        events.emit("stop");
    }

    nativeStop(mainLoopHandle);

    if (keepAliveTimeout) {
        clearTimeout(keepAliveTimeout);
        keepAliveTimeout = null;
    }

    mainLoopHandle = null;
};
