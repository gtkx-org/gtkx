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

/** An application class together with the construct properties it accepts. */
type ApplicationConstructor<T extends Application, P> = AnyClass<T> & (new (props: P) => T);

const derivedClasses: WeakMap<AnyClass<Application>, AnyClass<Application>> = new WeakMap();
const derivedApplicationClasses: Set<AnyClass<ManagedApplication>> = new Set();
const quitApplications: WeakSet<Application> = new WeakSet();
const shuttingDownApplications: WeakSet<Application> = new WeakSet();

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
            quitApplications.add(this);

            return callParent(DerivedApplication, "vfuncNameLost", this) as boolean;
        }

        override quit(): void {
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
 * Constructs an application supported by {@link runApplication} and {@link quitApplication}.
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
        keepAlive(true);
    });

    application.on("shutdown", () => {
        keepAlive(false);
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
    tearDownApplication(application);
    releaseDefaultApplication(application);
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
