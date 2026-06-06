import { stop as nativeStop } from "@gtkx/native";
import { type GracefulShutdownHandle, installGracefulShutdown } from "@gtkx/utils";

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

/**
 * Installs `SIGINT`/`SIGTERM`/`SIGHUP` handlers that shut the runtime down by
 * routing the signal through {@link stop}.
 *
 * The GLib main loop runs on a dedicated thread, so the Node.js event loop
 * stays responsive and these handlers fire on the JS thread. A plain
 * (non-React) CLI app therefore quits its loop cleanly on Ctrl+C, provided it
 * drives the application through `activate` rather than blocking the JS thread
 * in `Gio.Application.run`. The first signal drains finalizers and quits the
 * loop before the process exits with the signal's conventional code; a second
 * `SIGINT` forces an immediate exit.
 *
 * Called automatically when this module loads unless
 * `GTKX_DISABLE_SHUTDOWN_HANDLERS` is set to `"1"`.
 *
 * @see {@link stop}
 */
const installShutdownHandlers = (): GracefulShutdownHandle => installGracefulShutdown({ onSignal: () => stop() });

if (process.env.GTKX_DISABLE_SHUTDOWN_HANDLERS !== "1") {
    installShutdownHandlers();
}

keepAlive();
