import EventEmitter from "node:events";
import { stop as nativeStop } from "@gtkx/native";
import { init as initAdwaita } from "./generated/adw/functions.js";
import { init as initGtk } from "./generated/gtk/functions.js";
import { finalize as finalizeGtkSource, init as initGtkSource } from "./generated/gtksource/functions.js";

let runtimeReady = false;

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
 * The `GLib` main loop is spawned automatically when `@gtkx/native` is
 * imported, so most callers should rely on {@link render} from `@gtkx/react`
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
 * Finalizes extension libraries, emits a `"stop"` event, and quits the
 * `GLib` main loop. Once stopped, no further FFI calls may be made.
 *
 * @see {@link initRuntime}
 * @see {@link events}
 */
export const stop = (): void => {
    if (!runtimeReady) {
        nativeStop();
        return;
    }

    runtimeReady = false;

    try {
        finalizeGtkSource();
    } catch {}

    events.emit("stop");
    nativeStop();
};
