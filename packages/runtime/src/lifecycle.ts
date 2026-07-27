import { keepAlive, quit as nativeQuit } from "@gtkx/native";
import { blockMatchedSignalHandlers } from "./signal.js";

/**
 * Minimal structural interface of a GTK4/GIO application needed to register, run,
 * and shut it down, plus the signals its lifecycle helpers connect to.
 */
type ApplicationLike = {
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
/**
 * Runs every registered exit callback and shuts down the native runtime. Safe to
 * call more than once; only the first call takes effect.
 */
const quit: () => void = createQuit();

function createQuit(): () => void {
    let hasQuit = false;

    return () => {
        if (hasQuit) {
            return;
        }

        hasQuit = true;

        for (const callback of shutdownCallbacks) {
            callback();
        }

        nativeQuit();
    };
}

/**
 * Registers a callback to run once when the process quits, before the native
 * runtime is torn down.
 *
 * @param callback Invoked during shutdown.
 */
const onExit = (callback: () => void): void => {
    shutdownCallbacks.push(callback);
};

/**
 * Registers the application if needed and activates it, keeping the runtime alive
 * while it is active and releasing it on shutdown.
 *
 * @param application The application to register and activate.
 */
const runApplication = (application: ApplicationLike): void => {
    application.on("activate", () => {
        keepAlive(true);
    });

    application.on("shutdown", () => {
        keepAlive(false);
    });

    if (!application.getIsRegistered()) {
        application.register(null);
    }

    application.activate();
};

/**
 * Closes all of the application's windows and drives its main loop until it quits,
 * so pending shutdown work can complete before the process exits.
 *
 * @param application The application to shut down.
 */
const quitApplication = (application: ApplicationLike): void => {
    if (!application.getIsRegistered()) {
        return;
    }

    const windows = application.getWindows?.() ?? [];

    for (const window of windows) {
        application.removeWindow?.(window);
    }

    application.on("shutdown", () => {
        application.quit();
    });

    blockMatchedSignalHandlers(application, "activate");
    application.run([]);
};

export { onExit, quit, runApplication, quitApplication, type ApplicationLike };
