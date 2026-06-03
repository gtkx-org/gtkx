import * as native from "../../native-binding.cjs";

type RawHandle = Parameters<typeof native.watchObjectFinalize>[0];

/**
 * Installs a native weak ref on the object behind `handle` that bumps the
 * global finalize counter when the object is destroyed, with no JavaScript
 * re-entrancy during finalization.
 */
export function watchObjectFinalize(handle: unknown): void {
    native.watchObjectFinalize(handle as RawHandle);
}

/** Total object finalizations recorded by {@link watchObjectFinalize}. */
export function finalizeCount(): number {
    return native.finalizeCount();
}

/**
 * Enqueues, from a background thread, `iterations` ref/unref pairs on the object
 * behind `handle`, each running on the `GLib` thread to fire live toggle
 * notifies that race the JS thread's garbage collection.
 */
export function driveToggleFromThread(handle: unknown, iterations: number): void {
    native.driveToggleFromThread(handle as RawHandle, iterations);
}

/** Ref/unref tasks not yet drained on the `GLib` thread. */
export function pendingToggleTasks(): number {
    return native.pendingToggleTasks();
}
