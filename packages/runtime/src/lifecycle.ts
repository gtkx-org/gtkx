import { keepAlive, quit as nativeQuit } from "@gtkx/native";
import { blockMatchedSignalHandlers } from "./signal.js";

/**
 * The GIO and GTK application surface {@link runApplication} and {@link quitApplication} drive, so any
 * application subclass satisfies it structurally; the window members only `Gtk.Application` defines are
 * optional.
 */
type ApplicationLike = {
    /** Returns whether the application has already been registered. */
    getIsRegistered(): boolean;
    /** Registers the application with the session, returning whether it succeeded. */
    register(cancellable: null): boolean;
    /** Emits `activate`, bringing up the application's initial user interface. */
    activate(): void;
    /** Quits the application, so `run` returns at the next main-loop iteration after `shutdown` runs. */
    quit(): void;
    /** Runs the application's main loop until it shuts down and returns the exit status. */
    run(argv: string[]): number;
    /** Returns the windows currently attached to the application. */
    getWindows?(): object[];
    /** Detaches a window, so it no longer holds the application open. */
    removeWindow?(window: object): void;
    /** Connects a handler to the application's `activate` or `shutdown` signal. */
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
 * Detaches every window from the application and runs its main loop until it shuts
 * down, so pending shutdown work completes before the process exits. Does nothing
 * when the application was never registered.
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
