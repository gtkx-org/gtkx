import type { AnyClass } from "@gtkx/utils";
import { releaseDefaultApplication } from "./default-application.js";
import { registerClass } from "./register-class.js";
import { getClassType } from "./registry.js";
import { typeName } from "./type.js";
import { callParent } from "./vfunc-call.js";

type CommandLineResult = [boolean, string[], number];

/**
 * The GIO application surface {@link createApplication} builds on, which `Gio.Application` and
 * every subclass of it satisfies structurally.
 */
type CommandLineApplication = {
    /** Marks the application as quitting, so GLib's own `run` returns without driving a main loop. */
    quit(): void;
};

type LocalCommandLineApplication = {
    runLocalCommandLine(argv: string[]): CommandLineResult;
};

type ShutdownApplication = {
    run(argv: string[]): number;
};

/** An application class together with the construct properties it accepts. */
type ApplicationClass<T extends CommandLineApplication, P> = AnyClass<T> & (new (props: P) => T);

const derivedClasses: WeakMap<AnyClass, AnyClass> = new WeakMap();
const derivedApplicationClasses: Set<AnyClass> = new Set();
const quitApplications: WeakSet<object> = new WeakSet();
const shuttingDownApplications: WeakSet<object> = new WeakSet();

const derivedTypeName = (base: AnyClass): string => `Gtkx${typeName(getClassType(base)) ?? base.name}`;

const buildApplicationClass = (base: AnyClass<CommandLineApplication>): AnyClass<CommandLineApplication> => {
    class DerivedApplication extends base {
        runLocalCommandLine(argv: string[]): CommandLineResult {
            return this.vfuncLocalCommandLine(argv);
        }

        protected vfuncLocalCommandLine(argv: string[]): CommandLineResult {
            if (shuttingDownApplications.has(this)) {
                this.quit();

                return [true, argv, 0];
            }

            return callParent(DerivedApplication, "vfuncLocalCommandLine", this, argv) as CommandLineResult;
        }

        protected vfuncNameLost(): boolean {
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

const isDerivedApplication = (application: object): application is LocalCommandLineApplication => {
    for (const derived of derivedApplicationClasses) {
        if (application instanceof derived) {
            return true;
        }
    }

    return false;
};

const shutDownThroughRun = (application: ShutdownApplication): void => {
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

const deriveApplicationClass = <T extends CommandLineApplication>(base: AnyClass<T>): AnyClass<T> =>
    derivedClasses.getOrInsertComputed(base, () => buildApplicationClass(base)) as AnyClass<T>;

/**
 * Constructs an application GTKX can shut down. GLib parses an application's command line at most
 * once per instance and crashes on a second parse, so {@link runApplication} and
 * {@link quitApplication} only accept an application built here.
 *
 * Whatever `g_application_constructed` assigned to the process-wide default is handed straight back,
 * so merely building an application never makes it what `Gio.Application.getDefault()` returns.
 * {@link runApplication} is the only place that claims that default, which keeps it pointing at an
 * application GTKX has actually started rather than at one that is still unregistered.
 *
 * @param base The application class to construct, such as `Gtk.Application`.
 * @param props Construct properties, passed through unchanged.
 * @returns An instance of a class derived from `base`, registered once per base class as its own GType.
 */
const createApplication = <T extends CommandLineApplication, P>(base: ApplicationClass<T, P>, props: P): T => {
    const application = new (deriveApplicationClass(base) as new (props: P) => T)(props);
    releaseDefaultApplication(application);

    return application;
};

export {
    createApplication,
    isDerivedApplication,
    shutDownThroughRun,
    type ApplicationClass,
    type CommandLineApplication,
    type LocalCommandLineApplication,
};
