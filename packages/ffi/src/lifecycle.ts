import { stop as nativeStop } from "@gtkx/native";

const KEEP_ALIVE_INTERVAL = 2147483647;

let keepAliveTimeout: ReturnType<typeof setTimeout> | null = null;
let stopped = false;

const { promise: stoppedPromise, resolve: resolveStopped } = Promise.withResolvers<void>();

const keepAlive = (): void => {
    keepAliveTimeout = setTimeout(keepAlive, KEEP_ALIVE_INTERVAL);
};

/**
 * Resolves when the GTK runtime begins shutting down.
 *
 * The returned promise settles exactly once, when {@link stop} is called and
 * before native dispatch is torn down. Generated namespace modules register
 * their library finalizers on it; application code may also use it to release
 * resources tied to the runtime's lifetime, such as a dev server.
 *
 * @example
 * ```tsx
 * import { whenStopped } from "@gtkx/ffi";
 *
 * whenStopped().then(() => {
 *   console.log("Runtime stopping");
 * });
 * ```
 *
 * @see {@link stop}
 */
export const whenStopped = (): Promise<void> => stoppedPromise;

/**
 * Shuts down the GTK runtime.
 *
 * Resolves the {@link whenStopped} promise so registered library finalizers
 * run, awaits them, then stops native dispatch and clears the keep-alive timer
 * so the Node.js process can exit cleanly. Subsequent calls are no-ops. Once
 * stopped, no further FFI calls may be made.
 *
 * @see {@link whenStopped}
 */
export const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;

    resolveStopped();
    await stoppedPromise;

    nativeStop();

    if (keepAliveTimeout) {
        clearTimeout(keepAliveTimeout);
        keepAliveTimeout = null;
    }
};

keepAlive();
