import { quit as nativeQuit } from "@gtkx/native";

const KEEP_ALIVE_INTERVAL = 2147483647;

export type ApplicationRunner = {
    getIsRegistered(): boolean;
    register(cancellable: null): boolean;
    activate(): void;
    on(signal: "activate" | "shutdown", handler: () => void): unknown;
    emit(signal: "shutdown"): void;
};

const shutdownCallbacks: (() => void)[] = [];
let hasQuit = false;

export const onExit = (callback: () => void): void => {
    shutdownCallbacks.push(callback);
};

/**
 * Shuts the gtkx runtime down cleanly: runs every callback registered through
 * {@link onExit}, then quits the GLib main loop and joins its thread. Idempotent
 * and safe to call more than once. Registered as the `process.on("exit")`
 * handler and also exposed so a host (such as a test harness) can quiesce the
 * runtime before tearing down resources the GLib thread still depends on. The
 * runtime is single-lifecycle: it cannot be re-initialized after this returns.
 */
export const quit = (): void => {
    if (hasQuit) return;
    hasQuit = true;

    for (const callback of shutdownCallbacks) callback();

    nativeQuit();
};

process.on("exit", quit);

export const runApplication = (application: ApplicationRunner): void => {
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

export const quitApplication = (application: ApplicationRunner): void => {
    application.emit("shutdown");
};
