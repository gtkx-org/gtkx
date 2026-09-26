import { keepAlive, quit as nativeQuit } from "@gtkx/native";
import { isDerivedApplication, type LocalCommandLineApplication, shutDownThroughRun } from "./application-class.js";
import { claimDefaultApplication, releaseDefaultApplication } from "./default-application.js";

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

type ApplicationInstance = "primary" | "remote" | "shutDown" | "unregistered";

/** What {@link runApplication} reports about the process it just started. */
type RunApplicationResult = {
    /** Whether this process owns the application ID and may build a user interface. */
    isPrimary: boolean;
    /** The status GLib determined for the command line, which the process should exit with. */
    exitStatus: number;
};

const shutdownCallbacks: (() => void)[] = [];
const startedApplications: WeakSet<object> = new WeakSet();
const registeredApplications: WeakSet<object> = new WeakSet();
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
        const errors: unknown[] = [];
        const runCleanup = (cleanup: () => void): void => {
            try {
                cleanup();
            } catch (error) {
                errors.push(error);
            }
        };

        for (const callback of shutdownCallbacks) {
            runCleanup(callback);
        }

        runCleanup(nativeQuit);

        if (errors.length === 1) {
            throw errors[0];
        }

        if (errors.length > 1) {
            throw new AggregateError(errors, "GTKX shutdown failed");
        }
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

const getApplicationInstance = (application: ApplicationLike): ApplicationInstance => {
    if (!application.getIsRegistered()) {
        return registeredApplications.has(application) ? "shutDown" : "unregistered";
    }

    return application.getIsRemote?.() === true ? "remote" : "primary";
};

/**
 * Starts a GTKX-created application through GLib's command-line handling, including option
 * parsing, `--help`, `handle-local-options`, registration, and activation or forwarding to an
 * existing instance. Keeps the runtime alive while the application is active.
 *
 * @remarks
 * Node remains the outer event loop. Starting the same application again registers and activates
 * it without reparsing `argv`; GLib permits command-line parsing only once per instance.
 *
 * Build a UI only when `isPrimary` is true. A remote instance has no `GtkApplicationImpl`, and
 * attaching a window to it crashes.
 *
 * Before parsing, the application becomes the process-wide default returned by
 * `Gio.Application.getDefault()`. It remains the default even if registration fails or it is
 * remote, until {@link quitApplication} releases it.
 *
 * @param application An application created by GTKX.
 * @param argv Command-line arguments; the first entry is the program name displayed by `--help`.
 * @returns Whether this instance may build a UI, and GLib's command-line exit status.
 * @throws If the application was not created by GTKX.
 */
const runApplication = (application: ApplicationLike, argv: string[]): RunApplicationResult => {
    if (!isDerivedApplication(application)) {
        throw new Error(
            "runApplication: this application was not built by GTKX, so its command line cannot be " +
            "parsed and it cannot be shut down safely; render <AdwApplication> or <GtkApplication>, " +
            "or construct it with createApplication from @gtkx/runtime",
        );
    }

    claimDefaultApplication(application);

    const exitStatus = startedApplications.has(application)
        ? restartApplication(application)
        : startApplication(application, argv);

    const instance = getApplicationInstance(application);

    if (instance !== "unregistered") {
        registeredApplications.add(application);
    }

    const isPrimary = instance === "primary";

    if (isPrimary) {
        keepAlive(true);
    }

    return { isPrimary, exitStatus };
};

const tearDownApplication = (application: ApplicationLike): void => {
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

/**
 * Detaches application windows, runs shutdown, and releases the process-wide default claimed by
 * {@link runApplication}. Repeated calls do not repeat shutdown. Unregistered applications only
 * release the default.
 *
 * @remarks
 * GLib's full shutdown runs once per instance, emitting `shutdown`, destroying its application
 * implementation, and releasing D-Bus registration. For an instance that already quit, GTKX emits `shutdown` to
 * release the runtime; registration then remains until GLib finalizes the instance. Releasing
 * the default does not wait for garbage collection or native finalization.
 *
 * @param application The application to shut down.
 */
const quitApplication = (application: ApplicationLike): void => {
    tearDownApplication(application);
    releaseDefaultApplication(application);
};

export {
    getApplicationInstance,
    onExit,
    quit,
    runApplication,
    quitApplication,
    type ApplicationInstance,
    type RunApplicationResult,
};
