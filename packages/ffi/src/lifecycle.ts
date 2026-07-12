import { keepAlive, quit as nativeQuit } from "@gtkx/native";
import { blockMatchedSignalHandlers } from "./signal.js";

/**
 * Minimal structural interface of a GTK/GIO application needed to register, run,
 * and shut it down, plus the signals its lifecycle helpers connect to.
 */
export type ApplicationLike = {
    getIsRegistered(): boolean;
    register(cancellable: null): boolean;
    activate(): void;
    quit(): void;
    run(argv: string[]): number;
    getWindows?(): object[];
    removeWindow?(window: object): void;
    on(signal: "activate" | "shutdown", handler: () => void): unknown;
};

const shutdownCallbacks: (() => void)[] = [];
let hasQuit = false;

/**
 * Registers a callback to run once when the process quits, before the native
 * runtime is torn down.
 *
 * @param callback Invoked during shutdown.
 */
export const onExit = (callback: () => void): void => {
    shutdownCallbacks.push(callback);
};

/**
 * Runs every registered exit callback and shuts down the native runtime. Safe to
 * call more than once; only the first call takes effect.
 */
export const quit = (): void => {
    if (hasQuit) return;
    hasQuit = true;

    for (const callback of shutdownCallbacks) callback();

    nativeQuit();
};

process.on("exit", quit);

/**
 * Registers the application if needed and activates it, keeping the runtime alive
 * while it is active and releasing it on shutdown.
 *
 * @param application The application to register and activate.
 */
export const runApplication = (application: ApplicationLike): void => {
    application.on("activate", () => keepAlive(true));
    application.on("shutdown", () => keepAlive(false));

    if (!application.getIsRegistered()) application.register(null);
    application.activate();
};

/**
 * Closes all of the application's windows and drives its main loop until it quits,
 * so pending shutdown work can complete before the process exits.
 *
 * @param application The application to shut down.
 */
export const quitApplication = (application: ApplicationLike): void => {
    if (!application.getIsRegistered()) return;
    for (const window of application.getWindows?.() ?? []) application.removeWindow?.(window);
    application.on("shutdown", () => application.quit());
    blockMatchedSignalHandlers(application, "activate");
    application.run([]);
};
