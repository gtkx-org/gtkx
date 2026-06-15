import { stop as nativeStop } from "@gtkx/native";

const KEEP_ALIVE_INTERVAL = 2147483647;

/**
 * The minimal application surface {@link runApplication} and
 * {@link quitApplication} drive: any `Gio.Application` (or subtype) satisfies
 * it. Kept structural so `@gtkx/ffi` need not depend on the generated
 * `@gtkx/gi` bindings.
 */
export type RunnableApplication = {
    /** Whether the application has been registered with the session bus. */
    getIsRegistered(): boolean;
    /** Registers the application; the cancellable is always `null` here. */
    register(cancellable: null): boolean;
    /** Emits the application's `activate` signal. */
    activate(): void;
    /** Connects a handler to the application's `activate` or `shutdown` signal. */
    on(signal: "activate" | "shutdown", handler: () => void): unknown;
    /** Emits the application's `shutdown` signal. */
    emit(signal: "shutdown"): void;
};

const shutdownCallbacks: (() => void)[] = [];
let stopped = false;

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
};

process.on("exit", stop);

/**
 * Runs an application, mirroring `Gio.Application.run`.
 *
 * Registers and activates the application, then holds the Node.js event loop
 * alive for as long as the application is running so the GLib main loop on the
 * dedicated native thread keeps iterating. The keep-alive starts on the
 * application's `activate` signal and is released on its `shutdown` signal, so
 * the process stays alive exactly as long as the application does and exits
 * cleanly once it shuts down. Importing `@gtkx/ffi` alone does not keep the
 * process alive: only a running application does.
 *
 * `@gtkx/react` calls this when an application component mounts; a plain
 * (non-React) CLI app calls it after constructing its application.
 *
 * @param application - The application to run.
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
    let keepAliveTimeout: ReturnType<typeof setTimeout> | null = null;

    const scheduleKeepAlive = (): void => {
        keepAliveTimeout = setTimeout(scheduleKeepAlive, KEEP_ALIVE_INTERVAL);
    };

    application.on("activate", () => {
        if (keepAliveTimeout === null) scheduleKeepAlive();
    });
    application.on("shutdown", () => {
        if (keepAliveTimeout === null) return;
        clearTimeout(keepAliveTimeout);
        keepAliveTimeout = null;
    });

    if (!application.getIsRegistered()) application.register(null);
    application.activate();
};

/**
 * Quits a running application, mirroring `Gio.Application.quit`.
 *
 * Emits the application's `shutdown` signal, which releases the keep-alive
 * installed by {@link runApplication}. Once nothing else holds the event loop
 * the process exits cleanly, at which point the callbacks registered with
 * {@link onExit} run and native dispatch is torn down. `@gtkx/react` calls this
 * when an application component unmounts.
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
    application.emit("shutdown");
};
