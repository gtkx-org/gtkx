/**
 * Debug-only introspection surface for exercising the GObject wrapper lifetime
 * machinery from tests. These functions are backed by napi entry points that
 * exist only in debug builds of the addon.
 *
 * @packageDocumentation
 */
import type { Handle } from "./binding.js";
import * as native from "./index.js";

/**
 * Registers a finalize watcher on the GObject behind `handle` so that its
 * destruction increments the global finalize counter.
 *
 * @param handle - Native handle whose underlying GObject should be watched.
 * @public
 */
export function watchObjectFinalize(handle: Handle): void {
    native.watchObjectFinalize(handle);
}

/**
 * Returns the number of watched GObjects that have been finalized so far.
 *
 * @returns The running count of finalized watched GObjects.
 * @public
 */
export function finalizeCount(): number {
    return native.finalizeCount();
}

/**
 * Drives toggle-reference notifications for `handle` from a background thread to
 * exercise cross-thread wrapper toggling against the JavaScript garbage
 * collector.
 *
 * @param handle - Native handle whose toggle reference should be churned.
 * @param iterations - Number of toggle cycles to perform.
 * @public
 */
export function driveToggleFromThread(handle: Handle, iterations: number): void {
    native.driveToggleFromThread(handle, iterations);
}
