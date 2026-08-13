import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { quitApplication, registerClass, runApplication, type RunApplicationResult } from "@gtkx/runtime";
import { afterEach, describe, expect, it } from "vitest";
import { applicationProps, countSignal, createApplication, createApplicationFrom } from "./helpers/application.js";
import { createTypeNameFactory } from "./helpers/unique-name.js";

type CommandLineResult = [boolean, string[], number];

const uniqueName = createTypeNameFactory("_");
const started: Gio.Application[] = [];

const track = (application: Gio.Application): Gio.Application => {
    started.push(application);

    return application;
};

const createTrackedApplication = (): { application: Gio.Application; activations: () => number } => {
    const application = track(createApplication());

    return { application, activations: countSignal(application, "activate") };
};

const startTrackedApplication = (
    argv: string[],
    expected: RunApplicationResult,
): { application: Gio.Application; activations: () => number } => {
    const tracked = createTrackedApplication();
    expect(runApplication(tracked.application, argv)).toEqual(expected);

    return tracked;
};

afterEach(() => {
    const applications = [...started];
    started.length = 0;

    for (const application of applications) {
        quitApplication(application);
    }
});

describe("runApplication — application options", () => {
    it("parses an application-defined main option and reaches handle-local-options", () => {
        const { application, activations } = createTrackedApplication();
        let parsed: number | null = null;
        application.addMainOption("count", 0, GLib.OptionFlags.NONE, GLib.OptionArg.INT, "how many", null);

        application.on("handle-local-options", (options) => {
            parsed = options.lookupValue("count", null)?.getInt32() ?? null;

            return -1;
        });

        expect(runApplication(application, ["probe", "--count=7"])).toEqual({ isPrimary: true, exitStatus: 0 });
        expect(parsed).toBe(7);
        expect(application.getIsRegistered()).toBe(true);
        expect(activations()).toBe(1);
    });

    it("stops startup with the status a handle-local-options handler returns", () => {
        const { application, activations } = createTrackedApplication();
        application.on("handle-local-options", () => 3);
        expect(runApplication(application, ["probe"])).toEqual({ isPrimary: false, exitStatus: 3 });
        expect(application.getIsRegistered()).toBe(false);
        expect(activations()).toBe(0);
    });

    it("treats a handle-local-options handler that returns nothing as a zero exit status", () => {
        const { application, activations } = createTrackedApplication();
        let hasHandled = false;

        application.on("handle-local-options", () => {
            hasHandled = true;
        });

        expect(runApplication(application, ["probe"])).toEqual({ isPrimary: false, exitStatus: 0 });
        expect(hasHandled).toBe(true);
        expect(application.getIsRegistered()).toBe(false);
        expect(activations()).toBe(0);
    });
});

describe("runApplication — launch modes", () => {
    it("activates normally when nothing but the program name is passed", () => {
        const { activations } = startTrackedApplication(["probe"], { isPrimary: true, exitStatus: 0 });
        expect(activations()).toBe(1);
    });

    it("registers without activating for --gapplication-service", () => {
        const { application, activations } = startTrackedApplication(["probe", "--gapplication-service"], {
            isPrimary: true,
            exitStatus: 0,
        });

        expect(application.getFlags() & Gio.ApplicationFlags.IS_SERVICE).toBe(Gio.ApplicationFlags.IS_SERVICE);
        expect(application.getIsRegistered()).toBe(true);
        expect(activations()).toBe(0);
        application.activate();
        expect(activations()).toBe(1);
    });

    it("reports a failing exit status for an unknown option without registering", () => {
        const { application, activations } = startTrackedApplication(["probe", "--nope"], {
            isPrimary: false,
            exitStatus: 1,
        });

        expect(application.getIsRegistered()).toBe(false);
        expect(activations()).toBe(0);
        expect(Gio.Application.getDefault()).toBe(application);
    });
});

describe("quitApplication", () => {
    it("emits shutdown once, releases the registration, and ignores repeated calls", () => {
        const application = createApplication();
        const shutdowns = countSignal(application, "shutdown");
        runApplication(application, ["probe"]);
        expect(application.getIsRegistered()).toBe(true);
        quitApplication(application);
        expect(application.getIsRegistered()).toBe(false);
        quitApplication(application);
        expect(shutdowns()).toBe(1);
    });

    it("releases an application that registered without activating", () => {
        const application = createApplication();
        runApplication(application, ["probe", "--gapplication-service"]);
        expect(application.getIsRegistered()).toBe(true);
        quitApplication(application);
        expect(application.getIsRegistered()).toBe(false);
    });

    it("does nothing for an application that never registered", () => {
        const application = createApplication();
        const shutdowns = countSignal(application, "shutdown");
        quitApplication(application);
        expect(shutdowns()).toBe(0);
    });

    it("gives up the process-wide default an application kept when its start left it unregistered", () => {
        const application = createApplication();
        application.on("handle-local-options", () => 3);
        expect(runApplication(application, ["probe"])).toEqual({ isPrimary: false, exitStatus: 3 });
        expect(application.getIsRegistered()).toBe(false);
        expect(Gio.Application.getDefault()).toBe(application);
        quitApplication(application);
        expect(Gio.Application.getDefault()).toBeNull();
    });
});

describe("vfuncLocalCommandLine — inout string array marshalling", () => {
    it("hands the real argv to an override and reads back the array it returns", () => {
        class EchoApplication extends Gio.Application {
            received: string[] | null = null;

            override vfuncLocalCommandLine(argv: string[]): CommandLineResult {
                this.received = [...argv];

                return [true, [...argv, "appended"], 5];
            }
        }

        registerClass(EchoApplication, { typeName: uniqueName("GtkxEchoApplication") });
        const application = new EchoApplication(applicationProps());

        expect(application.vfuncLocalCommandLine(["probe", "--flag", "value"])).toEqual([
            true,
            ["probe", "--flag", "value", "appended"],
            5,
        ]);

        expect(application.received).toEqual(["probe", "--flag", "value"]);
        expect(application.getIsRegistered()).toBe(false);
    });

    it("lets an override strip an argument before chaining up to GLib", () => {
        class FilteringApplication extends Gio.Application {
            override vfuncLocalCommandLine(argv: string[]): CommandLineResult {
                return super.vfuncLocalCommandLine(argv.filter((argument) => argument !== "--strip-me"));
            }
        }

        registerClass(FilteringApplication, { typeName: uniqueName("GtkxFilteringApplication") });
        const application = track(createApplicationFrom(FilteringApplication));
        const activations = countSignal(application, "activate");
        expect(runApplication(application, ["probe", "--strip-me"])).toEqual({ isPrimary: true, exitStatus: 0 });
        expect(activations()).toBe(1);
    });
});

describe("vfuncGetDefaultAttributes — out string array marshalling", () => {
    it("returns the two arrays a JavaScript implementation writes", () => {
        class AnnotatedInscription extends Gtk.Inscription {
            override vfuncGetDefaultAttributes(): [string[], string[]] {
                return [
                    ["weight", "style"],
                    ["bold", "italic"],
                ];
            }
        }

        registerClass(AnnotatedInscription, { typeName: uniqueName("GtkxAnnotatedInscription") });
        const inscription = new AnnotatedInscription({ text: "hello" });

        expect(inscription.vfuncGetDefaultAttributes()).toEqual([
            ["weight", "style"],
            ["bold", "italic"],
        ]);
    });
});
