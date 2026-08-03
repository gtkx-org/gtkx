import { type AnyClass, getOrInsert } from "@gtkx/utils";
import { registerClass } from "./register-class.js";
import { getClassType } from "./registry.js";
import { typeName } from "./type.js";

type CommandLineResult = [boolean, string[], number];

/**
 * The GIO application surface {@link deriveApplicationClass} overrides, which `Gio.Application` and
 * every subclass of it satisfies structurally.
 */
type CommandLineApplication = {
    /**
     * Runs GLib's local command line handling: parses the options, registers the application,
     * forwards or dispatches activation, and returns whether the command line was fully handled,
     * the arguments left unconsumed, and the exit status.
     */
    vfuncLocalCommandLine(argv: string[]): [boolean, string[], number];
    /** Handles another process taking over the application ID, which quits this one. */
    vfuncNameLost(): boolean;
    /** Marks the application as quitting, so GLib's own `run` returns without driving a main loop. */
    quit(): void;
};

type ShutdownApplication = {
    run(argv: string[]): number;
};

const derivedClasses: WeakMap<AnyClass, AnyClass> = new WeakMap();
const derivedApplicationClasses: Set<AnyClass> = new Set();
const quitApplications: WeakSet<object> = new WeakSet();
const shuttingDownApplications: WeakSet<object> = new WeakSet();

const derivedTypeName = (base: AnyClass): string => `Gtkx${typeName(getClassType(base)) ?? base.name}`;

const buildApplicationClass = (base: AnyClass<CommandLineApplication>): AnyClass<CommandLineApplication> => {
    class DerivedApplication extends base {
        override vfuncLocalCommandLine(argv: string[]): CommandLineResult {
            if (shuttingDownApplications.has(this)) {
                this.quit();

                return [true, argv, 0];
            }

            return super.vfuncLocalCommandLine(argv);
        }

        override vfuncNameLost(): boolean {
            quitApplications.add(this);

            return super.vfuncNameLost();
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

const isDerivedApplication = (application: object): boolean => {
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

/**
 * Derives, once per base class, an application class whose command line handling GTKX may drive a
 * second time. GLib parses an application's command line at most once per instance and crashes on a
 * second parse, so only an application built from this class can reach the teardown that unregisters
 * it from D-Bus. Every application the reconciler builds is one.
 *
 * @param base The application class to derive from, such as `Gtk.Application`.
 * @returns The derived class, registered as its own GType.
 */
const deriveApplicationClass = <T extends CommandLineApplication>(base: AnyClass<T>): AnyClass<T> =>
    getOrInsert(derivedClasses, base, () => buildApplicationClass(base)) as AnyClass<T>;

export { deriveApplicationClass, shutDownThroughRun, type CommandLineApplication };
