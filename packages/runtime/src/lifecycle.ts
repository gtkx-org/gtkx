import { keepAlive, quit as nativeQuit } from "@gtkx/native";
import { isDerivedApplication, type LocalCommandLineApplication, shutDownThroughRun } from "./application-class.js";

/**
 * The GIO and GTK application surface {@link runApplication} and {@link quitApplication} drive, so any
 * application subclass satisfies it structurally; the window members only `Gtk.Application` defines are
 * optional.
 */
type ApplicationLike = {
    /** Returns whether the application has already been registered. */
    getIsRegistered(): boolean;
    /** Returns whether another process owns the application ID, making this one a remote instance. */
    getIsRemote?(): boolean;
    /** Registers the application with the session, returning whether it succeeded. */
    register(cancellable: null): boolean;
    /** Emits `activate`, bringing up the application's initial user interface. */
    activate(): void;
    /**
     * Runs GLib's own `g_application_run`, whose tail emits `shutdown`, destroys the application
     * implementation and clears the registration.
     */
    run(argv: string[]): number;
    /** Returns the windows currently attached to the application. */
    getWindows?(): object[];
    /** Detaches a window, so it no longer holds the application open. */
    removeWindow?(window: object): void;
    /** Connects a handler to the application's `activate` or `shutdown` signal. */
    on(signal: "activate" | "shutdown", handler: () => void): unknown;
    /** Emits one of the application's own signals. */
    emit(signal: "shutdown"): unknown;
};

/** What {@link runApplication} reports about the process it just started. */
type RunApplicationResult = {
    /** Whether this process owns the application ID and may build a user interface. */
    isPrimary: boolean;
    /** The status GLib determined for the command line, which the process should exit with. */
    exitStatus: number;
};

const shutdownCallbacks: (() => void)[] = [];
const startedApplications: WeakSet<object> = new WeakSet();
const shutDownApplications: WeakSet<object> = new WeakSet();
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

const startApplication = (application: ApplicationLike & LocalCommandLineApplication, argv: string[]): number => {
    startedApplications.add(application);

    application.on("activate", () => {
        keepAlive(true);
    });

    application.on("shutdown", () => {
        keepAlive(false);
    });

    return application.runLocalCommandLine(argv)[2];
};

const restartApplication = (application: ApplicationLike): number => {
    shutDownApplications.delete(application);

    if (!application.register(null)) {
        return 1;
    }

    application.activate();

    return 0;
};

/**
 * Hands `argv` to GLib's own command line handling, which parses the application's options, prints
 * `--help`, runs `handle-local-options`, registers the application, and either activates it or
 * forwards the command line to the process that already owns the application ID. The runtime is
 * held alive while the application is active and released on shutdown.
 *
 * `g_application_run()` is not what starts the application, because it would drive its own main loop
 * and freeze Node; only the local command line handling it delegates to runs here. {@link
 * quitApplication} calls it once no window holds the application open, to reach the teardown only it
 * performs.
 *
 * GLib parses a given application's command line at most once, so starting an application that has
 * already run registers and activates it instead of reading `argv` again.
 *
 * When another process already owns the application ID, this one registers as a remote instance: no
 * user interface may be built here, because a remote application has no `GtkApplicationImpl` and
 * attaching a window to it crashes.
 *
 * @param application The application to start.
 * @param argv The command line, whose first entry names the program as `--help` should print it.
 * @returns Whether this process may build a user interface, and the status to exit with.
 */
const runApplication = (application: ApplicationLike, argv: string[]): RunApplicationResult => {
    if (!isDerivedApplication(application)) {
        throw new Error(
            "runApplication: this application was not built by GTKX, so its command line cannot be " +
            "parsed and it cannot be shut down safely; render <GtkApplication> or <AdwApplication>, " +
            "or construct it with createApplication from @gtkx/runtime",
        );
    }

    const exitStatus = startedApplications.has(application)
        ? restartApplication(application)
        : startApplication(application, argv);

    const isPrimary = application.getIsRegistered() && application.getIsRemote?.() !== true;

    if (isPrimary) {
        keepAlive(true);
    }

    return { isPrimary, exitStatus };
};

/**
 * Detaches every window from the application and runs GLib's own shutdown, which emits `shutdown`,
 * destroys the application implementation and releases the D-Bus registration. Does nothing for an
 * application that is not registered, so a repeated call is a no-op.
 *
 * GLib's own shutdown is reachable once per application: reaching it marks the application as
 * quitting, which GLib never undoes. An application that has already quit falls back to emitting
 * `shutdown`, which releases the runtime and leaves the registration for GLib to drop at finalize.
 *
 * @param application The application to shut down.
 */
const quitApplication = (application: ApplicationLike): void => {
    if (!application.getIsRegistered() || shutDownApplications.has(application)) {
        return;
    }

    const windows = application.getWindows?.() ?? [];

    for (const window of windows) {
        application.removeWindow?.(window);
    }

    shutDownThroughRun(application);

    if (application.getIsRegistered()) {
        shutDownApplications.add(application);
        application.emit("shutdown");
    }
};

export { onExit, quit, runApplication, quitApplication, type ApplicationLike, type RunApplicationResult };
