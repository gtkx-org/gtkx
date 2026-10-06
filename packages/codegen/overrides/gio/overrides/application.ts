import { type AnyClass, callParent, getClassType, registerClass, typeName } from "@gtkx/runtime";
import { keepAlive } from "@gtkx/runtime/internal";
import { Application, ApplicationFlags } from "../gio.js";

/** Registration and ownership state tracked for an application. */
type ApplicationInstance = "primary" | "remote" | "shutDown" | "unregistered";

interface ApplicationStartup {
    isPrimary: boolean;
    exitStatus: number;
}

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
    idleTimer?: ReturnType<typeof setTimeout>;
    startupFailure?: { error: unknown };
}

interface ApplicationActivity {
    holds: number;
    uses: number;
    idleDeadline?: number;
}

/** An application class together with the construct properties it accepts. */
type ApplicationConstructor<T extends Application, P> = AnyClass<T> & (new (props: P) => T);

const derivedClasses: WeakMap<AnyClass<Application>, AnyClass<Application>> = new WeakMap();
const derivedApplicationClasses: Set<AnyClass<ManagedApplication>> = new Set();
const quitApplications: WeakSet<Application> = new WeakSet();
const shuttingDownApplications: WeakSet<Application> = new WeakSet();
const applicationRuns: WeakMap<Application, ApplicationRun> = new WeakMap();
const applicationActivity: WeakMap<Application, ApplicationActivity> = new WeakMap();
const activeApplications: Set<Application> = new Set();

const activityFor = (application: Application): ApplicationActivity =>
    applicationActivity.getOrInsertComputed(application, () => ({ holds: 0, uses: 0 }));

const refreshApplicationActivity = (application: Application): ApplicationActivity => {
    const activity = activityFor(application);
    const owner: Application & WindowOwner = application;
    const uses = activity.holds + (owner.getWindows?.().length ?? 0);

    if (uses > 0) {
        delete activity.idleDeadline;
    } else if (activity.uses > 0) {
        activity.idleDeadline = performance.now() + application.getInactivityTimeout();
    }

    activity.uses = uses;

    return activity;
};

const scheduleApplicationCompletion = (application: Application): void => {
    const run = applicationRuns.get(application);

    if (!run || run.starting || run.finishing) {
        return;
    }

    clearTimeout(run.idleTimer);
    delete run.idleTimer;
    const activity = activityFor(application);

    if (!run.quitRequested && activity.uses > 0) {
        return;
    }

    const remaining = run.quitRequested ? 0 : (activity.idleDeadline ?? 0) - performance.now();

    if (remaining > 0) {
        run.idleTimer = setTimeout(() => updateApplicationActivity(application), Math.min(remaining, 2_147_483_647));
        return;
    }

    if (run.cleanupScheduled) {
        return;
    }

    run.cleanupScheduled = true;
    queueMicrotask(() => {
        if (applicationRuns.get(application) !== run) {
            return;
        }

        run.cleanupScheduled = false;
        const current = refreshApplicationActivity(application);

        if (run.quitRequested || (current.uses === 0 && (current.idleDeadline ?? 0) <= performance.now())) {
            finishApplication(application);
        } else {
            scheduleApplicationCompletion(application);
        }
    });
};

/** @internal Reconciles explicit holds and windows after a native ownership change. */
const updateApplicationActivity = (application: Application): void => {
    refreshApplicationActivity(application);
    scheduleApplicationCompletion(application);
};

const requestApplicationQuit = (application: Application): boolean => {
    const run = applicationRuns.get(application);

    if (!run) {
        return false;
    }

    run.quitRequested = true;
    scheduleApplicationCompletion(application);

    return true;
};

const derivedTypeName = (base: AnyClass<Application>): string => `Gtkx${typeName(getClassType(base)) ?? base.name}`;

const buildApplicationClass = (base: AnyClass<Application>): AnyClass<ManagedApplication> => {
    class DerivedApplication extends base {
        override hold(): void {
            super.hold();
            activityFor(this).holds += 1;
            updateApplicationActivity(this);
        }

        override release(): void {
            const activity = activityFor(this);

            if (activity.holds === 0) {
                throw new RangeError("Application.release requires a matching hold");
            }

            super.release();
            activity.holds -= 1;
            updateApplicationActivity(this);
        }

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

                finishApplication(this);
                return;
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
 * Constructs an application supported by {@link Application.runAsync}.
 * Its derived GType lets GTKX avoid repeating GLib's command-line parse, which would crash.
 *
 * @remarks
 * Construction does not claim the process-wide default. Any default assigned by GLib during
 * construction is released; {@link Application.runAsync} claims it when the application starts.
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

const initializeApplication = (application: ManagedApplication, argv: string[]): ApplicationStartup => {
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

const finishApplication = (application: Application): void => {
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
    clearTimeout(run.idleTimer);
    delete run.idleTimer;

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
        delete activityFor(application).idleDeadline;
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
         * shutdown. Construct the application with {@link createApplication} or let
         * the GTKX renderer construct it.
         *
         * @remarks
         * Startup handles GLib command-line options, registration, activation, and forwarding
         * to an existing instance. Build the UI in an `activate` handler; remote instances
         * cannot own application windows.
         *
         * Node remains the outer event loop. A primary instance stays active while it owns
         * application windows or has unmatched JavaScript `hold()` calls. With neither, it
         * shuts down after the current JavaScript turn, respecting `inactivityTimeout` after
         * the final release. Service instances initially wait up to ten seconds for activity.
         * `quit()` forces shutdown regardless of windows or holds. Cleanup releases the
         * process-wide default before this Promise resolves.
         *
         * Call `hold()` before asynchronous startup work and `release()` when it finishes;
         * closing a window does not cancel an explicit hold. Holds persist across runs, and
         * `release()` without a matching JavaScript hold throws. Native library holds other
         * than GTK application window ownership cannot be observed by this managed loop.
         *
         * Options handled before registration and remote instances resolve immediately. The
         * application remains the process-wide default until `quit()` releases it.
         *
         * A second concurrent call rejects unless the preceding run has already requested
         * shutdown with `quit()`. Calling this method after `quit()` completes the pending
         * cleanup before restarting. Subsequent runs register and activate the application
         * without parsing the command line again. GLib's full native shutdown runs only once
         * per instance; subsequent shutdowns emit `shutdown` and release the default, while
         * registration remains until native finalization.
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

    const previousRun = applicationRuns.get(this);

    if (previousRun) {
        if (!previousRun.quitRequested || previousRun.starting || previousRun.finishing) {
            return Promise.reject(new Error("Application.runAsync is already running for this application"));
        }

        finishApplication(this);
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

    applicationRuns.set(this, run);

    try {
        const result = initializeApplication(this, argv);
        run.exitStatus = result.exitStatus;
        run.starting = false;

        if (run.quitRequested) {
            finishApplication(this);
        } else if (!result.isPrimary) {
            applicationRuns.delete(this);
            run.resolve(result.exitStatus);
        } else {
            const activity = refreshApplicationActivity(this);

            if (activity.uses === 0 && activity.idleDeadline === undefined &&
                (this.getFlags() & ApplicationFlags.IS_SERVICE) !== 0) {
                activity.idleDeadline = performance.now() + 10_000;
            }

            scheduleApplicationCompletion(this);
        }
    } catch (error) {
        run.starting = false;
        run.startupFailure = { error };
        finishApplication(this);
    }

    return run.promise;
};

export {
    createApplication,
    getApplicationInstance,
    updateApplicationActivity,
    type ApplicationConstructor,
    type ApplicationInstance,
};
