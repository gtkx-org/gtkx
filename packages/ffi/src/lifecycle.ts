import { stop as nativeStop } from "@gtkx/native";
import { type GracefulShutdownHandle, installGracefulShutdown } from "@gtkx/utils";

const KEEP_ALIVE_INTERVAL = 2147483647;

/**
 * The minimal application surface {@link runApplication} and
 * {@link quitApplication} drive: any `Gio.Application` (or subtype) satisfies
 * it. Kept structural so `@gtkx/ffi` need not depend on the generated
 * `@gtkx/gi` bindings.
 */
export type RunnableApplication = {
    /** Releases the application's hold on the GTK main loop. */
    quit(): void;
};

const shutdownCallbacks: (() => void)[] = [];
let keepAliveTimeout: ReturnType<typeof setTimeout> | null = null;
let shutdownHandle: GracefulShutdownHandle | null = null;
let stopped = false;

const keepAlive = (): void => {
    keepAliveTimeout = setTimeout(keepAlive, KEEP_ALIVE_INTERVAL);
};

const clearKeepAlive = (): void => {
    if (keepAliveTimeout) {
        clearTimeout(keepAliveTimeout);
        keepAliveTimeout = null;
    }
};

/**
 * Registers a callback to run during shutdown, before native dispatch is torn
 * down.
 *
 * Generated namespace modules register their library finalizers here; callbacks
 * run synchronously, in registration order, when the Node.js process exits.
 * Application code may also use it to release resources tied to the runtime's
 * lifetime.
 *
 * @param callback - The shutdown callback to run before native dispatch stops.
 *
 * @example
 * ```tsx
 * import { onExit } from "@gtkx/ffi";
 *
 * onExit(() => {
 *   console.log("Runtime stopping");
 * });
 * ```
 */
export const onExit = (callback: () => void): void => {
    shutdownCallbacks.push(callback);
};

const stop = (): void => {
    if (stopped) return;
    stopped = true;

    for (const callback of shutdownCallbacks) callback();

    nativeStop();
    clearKeepAlive();
};

process.on("exit", stop);

/**
 * Starts driving an application's run loop, mirroring `Gio.Application.run`.
 *
 * Keeps the Node.js event loop alive so the GLib main loop on the dedicated
 * native thread keeps iterating, and — unless `GTKX_DISABLE_SHUTDOWN_HANDLERS`
 * is set to `"1"` — installs `SIGINT`/`SIGTERM`/`SIGHUP` handlers that quit the
 * application through {@link quitApplication}. Importing `@gtkx/ffi` alone does
 * not keep the process alive: only a running application does, so a process
 * that never calls this exits cleanly once its work is done.
 *
 * The GLib main loop runs on a dedicated thread, so the Node.js event loop
 * stays responsive and the signal handlers fire on the JS thread. `@gtkx/react`
 * calls this when an application component mounts; a plain (non-React) CLI app
 * calls it after constructing and activating its application.
 *
 * @param application - The application whose run loop to drive.
 *
 * @see {@link quitApplication}
 *
 * @example
 * ```tsx
 * import { runApplication } from "@gtkx/ffi";
 *
 * runApplication(app);
 * ```
 */
export const runApplication = (application: RunnableApplication): void => {
    if (keepAliveTimeout === null) keepAlive();
    if (shutdownHandle === null && process.env.GTKX_DISABLE_SHUTDOWN_HANDLERS !== "1") {
        shutdownHandle = installGracefulShutdown({ onSignal: () => quitApplication(application) });
    }
};

/**
 * Quits a running application, mirroring `Gio.Application.quit`.
 *
 * Releases the application's hold on the GTK main loop, stops keeping the
 * Node.js event loop alive, and removes the shutdown signal handlers installed
 * by {@link runApplication}. Once nothing else holds the event loop the process
 * exits cleanly, at which point the callbacks registered with {@link onExit}
 * run and native dispatch is torn down. `@gtkx/react` calls this when an
 * application component unmounts.
 *
 * @param application - The application to quit.
 *
 * @see {@link runApplication}
 *
 * @example
 * ```tsx
 * import { quitApplication } from "@gtkx/ffi";
 *
 * quitApplication(app);
 * ```
 */
export const quitApplication = (application: RunnableApplication): void => {
    application.quit();
    clearKeepAlive();
    shutdownHandle?.uninstall();
    shutdownHandle = null;
};
