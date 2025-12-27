import EventEmitter from "node:events";

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
