import { type AnyClass, callParent, getClassType, registerClass, typeName } from "@gtkx/runtime";
import { keepAlive } from "@gtkx/runtime/internal";
import { Application } from "../gio.js";

/** Registration and ownership state tracked for an application. */
type ApplicationInstance = "primary" | "remote" | "shutDown" | "unregistered";

/** What {@link runApplication} reports about the process it just started. */
type RunApplicationResult = {
    /** Whether this process owns the application ID and may build a user interface. */
    isPrimary: boolean;
    /** The status GLib determined for the command line, which the process should exit with. */
    exitStatus: number;
};

type CommandLineResult = [boolean, string[], number];

type ManagedApplication = Application & {
    runLocalCommandLine(argv: string[]): CommandLineResult;
};

interface WindowOwner {
    getWindows?(): object[];
    removeWindow?(window: object): void;
}

interface ApplicationRun {
    promise: Promise<number>;
    resolve(exitStatus: number): void;
    reject(error: unknown): void;
    exitStatus: number;
    starting: boolean;
    finishing: boolean;
    quitRequested: boolean;
    cleanupScheduled: boolean;
    startupFailure?: { error: unknown };
}

/** An application class together with the construct properties it accepts. */
type ApplicationConstructor<T extends Application, P> = AnyClass<T> & (new (props: P) => T);

const derivedClasses: WeakMap<AnyClass<Application>, AnyClass<Application>> = new WeakMap();
const derivedApplicationClasses: Set<AnyClass<ManagedApplication>> = new Set();
const quitApplications: WeakSet<Application> = new WeakSet();
const shuttingDownApplications: WeakSet<Application> = new WeakSet();
const asynchronousApplications: WeakSet<Application> = new WeakSet();
const applicationRuns: WeakMap<Application, ApplicationRun> = new WeakMap();
const activeApplications: Set<Application> = new Set();

const requestApplicationQuit = (application: Application): boolean => {
    const run = applicationRuns.get(application);

    if (!run) {
        return false;
    }

    run.quitRequested = true;

    if (!run.starting && !run.finishing && !run.cleanupScheduled) {
        run.cleanupScheduled = true;

        queueMicrotask(() => {
            if (applicationRuns.get(application) === run) {
                quitApplication(application);
            }
        });
    }

    return true;
};

const derivedTypeName = (base: AnyClass<Application>): string => `Gtkx${typeName(getClassType(base)) ?? base.name}`;

const buildApplicationClass = (base: AnyClass<Application>): AnyClass<ManagedApplication> => {
    class DerivedApplication extends base {
        runLocalCommandLine(argv: string[]): CommandLineResult {
            return this.vfuncLocalCommandLine(argv);
        }

        protected override vfuncLocalCommandLine(argv: string[]): CommandLineResult {
            if (shuttingDownApplications.has(this)) {
                this.quit();

                return [true, argv, 0];
            }

            return callParent(DerivedApplication, "vfuncLocalCommandLine", this, argv) as CommandLineResult;
        }

        protected override vfuncNameLost(): boolean {
            const handled = callParent(DerivedApplication, "vfuncNameLost", this) as boolean;

            if (handled) {
                quitApplications.add(this);
                requestApplicationQuit(this);
            }

            return handled;
        }

        override quit(): void {
            if (!shuttingDownApplications.has(this)) {
                if (requestApplicationQuit(this)) {
                    return;
                }

                if (asynchronousApplications.has(this)) {
                    quitApplication(this);
                    return;
                }
            }

            quitApplications.add(this);
            super.quit();
        }
    }

    const derived = registerClass(DerivedApplication, { typeName: derivedTypeName(base) });
    derivedApplicationClasses.add(derived);

    return derived;
};

const isDerivedApplication = (application: object): application is ManagedApplication => {
    for (const derived of derivedApplicationClasses) {
        if (application instanceof derived) {
            return true;
        }
    }

    return false;
};

const shutDownThroughRun = (application: Application): void => {
    if (!isDerivedApplication(application) || quitApplications.has(application)) {
        return;
    }

    shuttingDownApplications.add(application);

    try {
        application.run([]);
    } finally {
        shuttingDownApplications.delete(application);
    }
};

const deriveApplicationClass = <T extends Application>(base: AnyClass<T>): AnyClass<T> =>
    derivedClasses.getOrInsertComputed(base, () => buildApplicationClass(base)) as AnyClass<T>;

/**
 * Constructs an application supported by {@link Application.runAsync}, {@link runApplication},
 * and {@link quitApplication}.
 * Its derived GType lets GTKX avoid repeating GLib's command-line parse, which would crash.
 *
 * @remarks
 * Construction does not claim the process-wide default. Any default assigned by GLib during
 * construction is released; {@link runApplication} claims it when the application starts.
 *
 * @param base The application class, such as `Gtk.Application`.
 * @param props Construct properties, passed through unchanged.
 * @returns An instance derived from `base`, with one registered GType per base class.
 */
const createApplication = <T extends Application, P>(base: ApplicationConstructor<T, P>, props: P): T => {
    const application = new (deriveApplicationClass(base) as new (props: P) => T)(props);
    releaseDefaultApplication(application);

    return application;
};

const releaseDefaultApplication = (application: Application): void => {
    if (Application.getDefault() === application) {
        Application.prototype.setDefault.call(null);
    }
};

const startedApplications: WeakSet<Application> = new WeakSet();
const registeredApplications: WeakSet<Application> = new WeakSet();
const shutDownApplications: WeakSet<Application> = new WeakSet();

const startApplication = (application: ManagedApplication, argv: string[]): number => {
    startedApplications.add(application);

    application.on("activate", () => {
        activeApplications.add(application);
        keepAlive(true);
    });

    application.on("shutdown", () => {
        activeApplications.delete(application);
        keepAlive(activeApplications.size > 0);
        requestApplicationQuit(application);
    });

    return application.runLocalCommandLine(argv)[2];
};

const restartApplication = (application: Application): number => {
    shutDownApplications.delete(application);

    if (!application.register(null)) {
        return 1;
    }

    application.activate();

    return 0;
};

/** Returns the application's registration and ownership state, including a completed shutdown. */
const getApplicationInstance = (application: Application): ApplicationInstance => {
    if (!application.getIsRegistered()) {
        return registeredApplications.has(application) ? "shutDown" : "unregistered";
    }

    return application.getIsRemote() ? "remote" : "primary";
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
const runApplication = (application: Application, argv: string[]): RunApplicationResult => {
    if (!isDerivedApplication(application)) {
        throw new Error(
            "runApplication: this application was not built by GTKX, so its command line cannot be " +
            "parsed and it cannot be shut down safely; render <AdwApplication> or <GtkApplication>, " +
            "or construct it with createApplication from @gtkx/gi/gio",
        );
    }

    Application.prototype.setDefault.call(application);

    const exitStatus = startedApplications.has(application)
        ? restartApplication(application)
        : startApplication(application, argv);

    const instance = getApplicationInstance(application);

    if (instance !== "unregistered") {
        registeredApplications.add(application);
    }

    const isPrimary = instance === "primary";

    if (isPrimary) {
        activeApplications.add(application);
        keepAlive(true);
    }

    return { isPrimary, exitStatus };
};

const tearDownApplication = (application: Application): void => {
    if (!application.getIsRegistered() || shutDownApplications.has(application)) {
        return;
    }

    const owner: Application & WindowOwner = application;
    const windows = owner.getWindows?.() ?? [];

    for (const window of windows) {
        owner.removeWindow?.(window);
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
const quitApplication = (application: Application): void => {
    const run = applicationRuns.get(application);

    if (!run) {
        tearDownApplication(application);
        releaseDefaultApplication(application);
        return;
    }

    if (run.starting) {
        run.quitRequested = true;
        return;
    }

    if (run.finishing) {
        return;
    }

    run.finishing = true;

    try {
        try {
            tearDownApplication(application);
        } finally {
            releaseDefaultApplication(application);
        }
    } catch (error) {
        run.reject(
            run.startupFailure
                ? new AggregateError([run.startupFailure.error, error], "Application startup and shutdown failed")
                : error,
        );
        return;
    } finally {
        applicationRuns.delete(application);
        activeApplications.delete(application);
        keepAlive(activeApplications.size > 0);
    }

    if (run.startupFailure) {
        run.reject(run.startupFailure.error);
    } else {
        run.resolve(run.exitStatus);
    }
};

declare module "../gio.js" {
    interface Application {
        /**
         * Starts a GTKX-managed application and resolves its command-line exit status after
         * explicit shutdown. Construct the application with {@link createApplication} or let
         * the GTKX renderer construct it.
         *
         * @remarks
         * Node remains the outer event loop. A primary instance stays active until `quit()`
         * or {@link quitApplication} completes cleanup, including releasing the process-wide
         * default. Closing the last window or balancing `hold()` and `release()` does not
         * complete this Promise.
         *
         * Options handled before registration and remote instances resolve immediately. The
         * application remains the process-wide default until `quit()` releases it.
         *
         * A second concurrent call rejects. After completion, another call follows
         * {@link runApplication}'s restart behavior without parsing the command line again.
         * GLib's full native shutdown runs only once per instance.
         *
         * @param argv Command-line arguments, starting with the program name.
         * @returns GLib's command-line exit status after completion.
         */
        runAsync(argv: string[]): Promise<number>;
    }
}

Application.prototype.runAsync = function (argv: string[]): Promise<number> {
    if (!isDerivedApplication(this)) {
        return Promise.reject(new Error("Application.runAsync requires an application created with createApplication"));
    }

    if (applicationRuns.has(this)) {
        return Promise.reject(new Error("Application.runAsync is already running for this application"));
    }

    const deferred = Promise.withResolvers<number>();
    const run: ApplicationRun = {
        ...deferred,
        exitStatus: 0,
        starting: true,
        finishing: false,
        quitRequested: false,
        cleanupScheduled: false,
    };

    asynchronousApplications.add(this);
    applicationRuns.set(this, run);

    try {
        const result = runApplication(this, argv);
        run.exitStatus = result.exitStatus;
        run.starting = false;

        if (run.quitRequested) {
            quitApplication(this);
        } else if (!result.isPrimary) {
            applicationRuns.delete(this);
            run.resolve(result.exitStatus);
        }
    } catch (error) {
        run.starting = false;
        run.startupFailure = { error };
        quitApplication(this);
    }

    return run.promise;
};

export {
    createApplication,
    getApplicationInstance,
    quitApplication,
    runApplication,
    type ApplicationConstructor,
    type ApplicationInstance,
    type RunApplicationResult,
};
