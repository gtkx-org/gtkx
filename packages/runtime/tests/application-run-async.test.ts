import { setImmediate } from "node:timers/promises";
import * as Gio from "@gtkx/gi/gio";
import { registerClass } from "@gtkx/runtime";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import { startApplicationOwner, stopApplicationOwners } from "./helpers/application-owner.js";
import {
    countSignal,
    createApplication,
    createApplicationFrom,
    createPlainApplication,
    createUniqueApplication,
} from "./helpers/application.js";
import { createAppIdFactory, createTypeNameFactory } from "./helpers/unique-name.js";

type CommandLineResult = [boolean, string[], number];

const uniqueName = createTypeNameFactory("_");
const uniqueAppId = createAppIdFactory("org.gtkx.async");
const applications: Gio.Application[] = [];

const track = (application: Gio.Application): Gio.Application => {
    applications.push(application);

    return application;
};

const createTrackedApplication = (): Gio.Application => track(createApplication());

afterEach(async () => {
    for (const application of applications.splice(0)) {
        application.quit();
    }

    await setImmediate();
    stopApplicationOwners();
});

describe("Application.runAsync", () => {
    it("waits for quit while held and resolves after shutdown releases the application", async () => {
        const application = createApplicationFrom(Gio.Application);
        expectTypeOf(application).toEqualTypeOf<Gio.Application>();
        track(application);
        application.hold();
        const activations = countSignal(application, "activate");
        const shutdowns = countSignal(application, "shutdown");
        let settled = false;
        const completion = application.runAsync(["probe"]);
        expectTypeOf(completion).toEqualTypeOf<Promise<number>>();
        void completion.then(() => {
            settled = true;
        });

        await setImmediate();

        expect(activations()).toBe(1);
        expect(shutdowns()).toBe(0);
        expect(settled).toBe(false);
        expect(application.getIsRegistered()).toBe(true);
        expect(Gio.Application.getDefault()).toBe(application);

        application.quit();

        await expect(completion).resolves.toBe(0);
        expect(shutdowns()).toBe(1);
        expect(application.getIsRegistered()).toBe(false);
        expect(Gio.Application.getDefault()).toBeNull();
        application.release();
        application.quit();
        expect(shutdowns()).toBe(1);
    });

    it("finishes startup before shutting down when activation quits synchronously", async () => {
        const application = createTrackedApplication();
        const events: string[] = [];
        application.on("activate", () => {
            events.push("activate");
            application.quit();
            events.push("activated");
        });
        application.on("shutdown", () => {
            events.push("shutdown");
        });

        await expect(application.runAsync(["probe"])).resolves.toBe(0);

        expect(events).toEqual(["activate", "activated", "shutdown"]);
        expect(application.getIsRegistered()).toBe(false);
        expect(Gio.Application.getDefault()).toBeNull();
        application.quit();
        expect(events).toEqual(["activate", "activated", "shutdown"]);
    });

    it("keeps the primary startup exit status until shutdown", async () => {
        class StatusApplication extends Gio.Application {
            override vfuncLocalCommandLine(argv: string[]): CommandLineResult {
                const [handled, remaining] = super.vfuncLocalCommandLine(argv);

                return [handled, remaining, 7];
            }
        }

        registerClass(StatusApplication, { typeName: uniqueName("GtkxAsyncStatusApplication") });
        const application = createApplicationFrom(StatusApplication);
        expectTypeOf(application).toEqualTypeOf<StatusApplication>();
        track(application);
        const activations = countSignal(application, "activate");
        const completion = application.runAsync(["probe"]);

        expect(activations()).toBe(1);
        expect(application.getIsRegistered()).toBe(true);
        application.quit();

        await expect(completion).resolves.toBe(7);
        expect(application.getIsRegistered()).toBe(false);
        expect(Gio.Application.getDefault()).toBeNull();
    });

    it("resolves a local option exit without waiting for shutdown", async () => {
        const application = createTrackedApplication();
        const activations = countSignal(application, "activate");
        const shutdowns = countSignal(application, "shutdown");
        application.on("handle-local-options", () => 3);

        await expect(application.runAsync(["probe"])).resolves.toBe(3);

        expect(activations()).toBe(0);
        expect(shutdowns()).toBe(0);
        expect(application.getIsRegistered()).toBe(false);
        expect(Gio.Application.getDefault()).toBe(application);
        application.quit();
        expect(Gio.Application.getDefault()).toBeNull();
        expect(shutdowns()).toBe(0);
    });

    it("rejects applications that were not created by GTKX", async () => {
        const application = track(createPlainApplication());
        const activations = countSignal(application, "activate");

        try {
            await expect(application.runAsync(["probe"])).rejects.toThrow(/Application\.create/);

            expect(activations()).toBe(0);
            expect(application.getIsRegistered()).toBe(false);
        } finally {
            if (Gio.Application.getDefault() === application) {
                Gio.Application.prototype.setDefault.call(null);
            }
        }
    });

    it("resolves a remote instance without waiting for its owner's shutdown", async () => {
        const applicationId = uniqueAppId();
        await startApplicationOwner(applicationId);
        const application = track(createUniqueApplication(applicationId));
        const activations = countSignal(application, "activate");
        const shutdowns = countSignal(application, "shutdown");

        await expect(application.runAsync(["probe"])).resolves.toBe(0);

        expect(activations()).toBe(0);
        expect(shutdowns()).toBe(0);
        expect(application.getIsRegistered()).toBe(true);
        expect(application.getIsRemote()).toBe(true);
        expect(Gio.Application.getDefault()).toBe(application);
        application.quit();
        expect(Gio.Application.getDefault()).toBeNull();
    });

    it("rejects a command-line exception and releases the process-wide default", async () => {
        class RefusingApplication extends Gio.Application {
            override vfuncLocalCommandLine(argv: string[]): CommandLineResult {
                throw new Error(`startup refused ${argv[0]}`);
            }
        }

        registerClass(RefusingApplication, { typeName: uniqueName("GtkxAsyncRefusingApplication") });
        const application = track(createApplicationFrom(RefusingApplication));
        const activations = countSignal(application, "activate");
        const shutdowns = countSignal(application, "shutdown");

        await expect(application.runAsync(["probe"])).rejects.toThrow("startup refused probe");

        expect(activations()).toBe(0);
        expect(shutdowns()).toBe(0);
        expect(application.getIsRegistered()).toBe(false);
        expect(application.getRegistrationState()).toBe("unregistered");
        expect(Gio.Application.getDefault()).toBeNull();
    });

    it("cleans up registration when activation throws during startup", async () => {
        const application = createTrackedApplication();
        const shutdowns = countSignal(application, "shutdown");
        application.on("activate", () => {
            throw new Error("activation refused");
        });

        await expect(application.runAsync(["probe"])).rejects.toThrow("activation refused");

        expect(shutdowns()).toBe(1);
        expect(application.getIsRegistered()).toBe(false);
        expect(application.getRegistrationState()).toBe("shutDown");
        expect(Gio.Application.getDefault()).toBeNull();
    });

    it("rejects a shutdown exception after releasing registration and the default", async () => {
        const application = createTrackedApplication();
        const activations = countSignal(application, "activate");
        application.on("shutdown", () => {
            throw new Error("shutdown refused");
        });
        const completion = application.runAsync(["probe"]);

        expect(activations()).toBe(1);
        application.quit();

        await expect(completion).rejects.toThrow("shutdown refused");
        expect(application.getIsRegistered()).toBe(false);
        expect(Gio.Application.getDefault()).toBeNull();
    });

    it("keeps running when its parent declines to quit after name loss", async () => {
        class PersistentApplication extends Gio.Application {
            override vfuncNameLost(): boolean {
                return false;
            }
        }

        registerClass(PersistentApplication, { typeName: uniqueName("GtkxAsyncPersistentApplication") });
        const application = track(createApplicationFrom(PersistentApplication));
        application.hold();
        const activations = countSignal(application, "activate");
        const shutdowns = countSignal(application, "shutdown");
        let settled = false;
        const completion = application.runAsync(["probe"]);
        void completion.then(() => {
            settled = true;
        });

        expect(application.emit("name-lost")).toBe(false);
        await setImmediate();

        expect(activations()).toBe(1);
        expect(shutdowns()).toBe(0);
        expect(settled).toBe(false);
        expect(application.getIsRegistered()).toBe(true);
        application.quit();

        await expect(completion).resolves.toBe(0);
        expect(shutdowns()).toBe(1);
        expect(application.getIsRegistered()).toBe(false);
        expect(Gio.Application.getDefault()).toBeNull();
        application.release();
    });

    it("rejects an overlapping run without ending the active run", async () => {
        const application = createTrackedApplication();
        application.hold();
        const activations = countSignal(application, "activate");
        const shutdowns = countSignal(application, "shutdown");
        let settled = false;
        const completion = application.runAsync(["probe"]);
        void completion.then(() => {
            settled = true;
        });

        await expect(application.runAsync(["probe"])).rejects.toThrow();
        await setImmediate();

        expect(activations()).toBe(1);
        expect(shutdowns()).toBe(0);
        expect(settled).toBe(false);
        expect(application.getIsRegistered()).toBe(true);
        application.quit();

        await expect(completion).resolves.toBe(0);
        expect(shutdowns()).toBe(1);
        application.release();
    });

    it("returns a fresh pending promise when a completed application is restarted", async () => {
        const application = createTrackedApplication();
        const activations = countSignal(application, "activate");
        const shutdowns = countSignal(application, "shutdown");
        const first = application.runAsync(["probe"]);
        application.quit();
        await expect(first).resolves.toBe(0);

        let settled = false;
        application.hold();
        const second = application.runAsync(["probe"]);
        void second.then(() => {
            settled = true;
        });
        await setImmediate();

        expect(second).not.toBe(first);
        expect(settled).toBe(false);
        expect(activations()).toBe(2);
        expect(shutdowns()).toBe(1);
        expect(application.getIsRegistered()).toBe(true);
        expect(Gio.Application.getDefault()).toBe(application);
        application.quit();

        await expect(second).resolves.toBe(0);
        expect(shutdowns()).toBe(2);
        expect(Gio.Application.getDefault()).toBeNull();
        application.release();
    });

    it("restarts immediately after quit without waiting for the previous promise", async () => {
        const application = createTrackedApplication();
        const activations = countSignal(application, "activate");
        const shutdowns = countSignal(application, "shutdown");
        const first = application.runAsync(["probe"]);
        application.quit();
        application.hold();
        const second = application.runAsync(["probe"]);
        let settled = false;
        void second.then(() => {
            settled = true;
        });

        await expect(first).resolves.toBe(0);
        await setImmediate();

        expect(second).not.toBe(first);
        expect(activations()).toBe(2);
        expect(shutdowns()).toBe(1);
        expect(settled).toBe(false);
        expect(application.getIsRegistered()).toBe(true);
        expect(Gio.Application.getDefault()).toBe(application);
        application.quit();

        await expect(second).resolves.toBe(0);
        expect(shutdowns()).toBe(2);
        expect(Gio.Application.getDefault()).toBeNull();
        application.release();
    });

    it("preserves caller arguments when a native parent handles a mutable argv", async () => {
        class FilteringApplication extends Gio.Application {
            override vfuncLocalCommandLine(argv: string[]): CommandLineResult {
                const index = argv.indexOf("--strip-me");

                if (index >= 0) {
                    argv.splice(index, 1);
                }

                return super.vfuncLocalCommandLine(argv);
            }
        }

        registerClass(FilteringApplication, { typeName: uniqueName("GtkxAsyncFilteringApplication") });
        const application = track(createApplicationFrom(FilteringApplication));
        const activations = countSignal(application, "activate");
        const argv = ["probe", "--strip-me"];
        const completion = application.runAsync(argv);

        expect(argv).toEqual(["probe", "--strip-me"]);
        expect(activations()).toBe(1);
        application.quit();

        await expect(completion).resolves.toBe(0);
    });
});
