import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";
import { afterEach, describe, expect, it } from "vitest";
import { applicationProps, countSignal, createApplication, createApplicationFrom } from "./helpers/application.js";
import { createTypeNameFactory } from "./helpers/unique-name.js";

type CommandLineResult = [boolean, string[], number];

const uniqueName = createTypeNameFactory("_");
const started: Gio.Application[] = [];
const completions: Promise<number>[] = [];

const track = (application: Gio.Application): Gio.Application => {
    started.push(application);

    return application;
};

const createTrackedApplication = (): { application: Gio.Application; activations: () => number } => {
    const application = track(createApplication());

    return { application, activations: countSignal(application, "activate") };
};

const start = (application: Gio.Application, argv: string[]): Promise<number> => {
    const completion = application.runAsync(argv);
    completions.push(completion);

    return completion;
};

afterEach(async () => {
    const applications = [...started];
    started.length = 0;

    for (const application of applications) {
        application.quit();
    }

    await Promise.allSettled(completions.splice(0));
});

describe("Application.runAsync — application options", () => {
    it("parses an application-defined main option and reaches handle-local-options", async () => {
        const { application, activations } = createTrackedApplication();
        let parsed: number | null = null;
        application.addMainOption("count", 0, GLib.OptionFlags.NONE, GLib.OptionArg.INT, "how many", null);

        application.on("handle-local-options", (options) => {
            parsed = options.lookupValue("count", null)?.getInt32() ?? null;

            return -1;
        });

        const completion = start(application, ["probe", "--count=7"]);
        expect(parsed).toBe(7);
        expect(application.getIsRegistered()).toBe(true);
        expect(activations()).toBe(1);
        application.quit();
        await expect(completion).resolves.toBe(0);
    });

    it("stops startup with the status a handle-local-options handler returns", async () => {
        const { application, activations } = createTrackedApplication();
        application.on("handle-local-options", () => 3);
        await expect(start(application, ["probe"])).resolves.toBe(3);
        expect(application.getIsRegistered()).toBe(false);
        expect(activations()).toBe(0);
    });

    it("treats a handle-local-options handler that returns nothing as a zero exit status", async () => {
        const { application, activations } = createTrackedApplication();
        let hasHandled = false;

        application.on("handle-local-options", () => {
            hasHandled = true;
        });

        await expect(start(application, ["probe"])).resolves.toBe(0);
        expect(hasHandled).toBe(true);
        expect(application.getIsRegistered()).toBe(false);
        expect(activations()).toBe(0);
    });
});

describe("Application.runAsync — launch modes", () => {
    it("activates normally when nothing but the program name is passed", async () => {
        const { application, activations } = createTrackedApplication();
        const completion = start(application, ["probe"]);
        expect(activations()).toBe(1);
        application.quit();
        await expect(completion).resolves.toBe(0);
    });

    it("registers without activating for --gapplication-service", async () => {
        const { application, activations } = createTrackedApplication();
        const completion = start(application, ["probe", "--gapplication-service"]);

        expect(application.getFlags() & Gio.ApplicationFlags.IS_SERVICE).toBe(Gio.ApplicationFlags.IS_SERVICE);
        expect(application.getIsRegistered()).toBe(true);
        expect(activations()).toBe(0);
        application.activate();
        expect(activations()).toBe(1);
        application.quit();
        await expect(completion).resolves.toBe(0);
    });

    it("reports a failing exit status for an unknown option without registering", async () => {
        const { application, activations } = createTrackedApplication();
        await expect(start(application, ["probe", "--nope"])).resolves.toBe(1);

        expect(application.getIsRegistered()).toBe(false);
        expect(activations()).toBe(0);
        expect(Gio.Application.getDefault()).toBe(application);
    });
});

describe("Application.quit", () => {
    it("emits shutdown once, releases the registration, and ignores repeated calls", async () => {
        const { application } = createTrackedApplication();
        const shutdowns = countSignal(application, "shutdown");
        const completion = start(application, ["probe"]);
        expect(application.getIsRegistered()).toBe(true);
        application.quit();
        await expect(completion).resolves.toBe(0);
        expect(application.getIsRegistered()).toBe(false);
        application.quit();
        expect(shutdowns()).toBe(1);
    });

    it("releases an application that registered without activating", async () => {
        const { application } = createTrackedApplication();
        const completion = start(application, ["probe", "--gapplication-service"]);
        expect(application.getIsRegistered()).toBe(true);
        application.quit();
        await expect(completion).resolves.toBe(0);
        expect(application.getIsRegistered()).toBe(false);
    });

    it("does nothing for an application that never registered", () => {
        const { application } = createTrackedApplication();
        const shutdowns = countSignal(application, "shutdown");
        application.quit();
        expect(shutdowns()).toBe(0);
    });

    it("gives up the process-wide default an application kept when its start left it unregistered", async () => {
        const { application } = createTrackedApplication();
        application.on("handle-local-options", () => 3);
        await expect(start(application, ["probe"])).resolves.toBe(3);
        expect(application.getIsRegistered()).toBe(false);
        expect(Gio.Application.getDefault()).toBe(application);
        application.quit();
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

    it("lets an override strip an argument before chaining up to GLib", async () => {
        class FilteringApplication extends Gio.Application {
            override vfuncLocalCommandLine(argv: string[]): CommandLineResult {
                const index = argv.indexOf("--strip-me");

                if (index >= 0) {
                    argv.splice(index, 1);
                }

                return super.vfuncLocalCommandLine(argv);
            }
        }

        registerClass(FilteringApplication, { typeName: uniqueName("GtkxFilteringApplication") });
        const application = track(createApplicationFrom(FilteringApplication));
        const activations = countSignal(application, "activate");
        const argv = ["probe", "--strip-me"];
        const completion = start(application, argv);
        expect(argv).toEqual(["probe", "--strip-me"]);
        expect(activations()).toBe(1);
        application.quit();
        await expect(completion).resolves.toBe(0);
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
