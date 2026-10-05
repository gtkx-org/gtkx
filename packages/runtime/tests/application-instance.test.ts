import type * as Gio from "@gtkx/gi/gio";
import { afterEach, describe, expect, it } from "vitest";
import { startApplicationOwner, stopApplicationOwners } from "./helpers/application-owner.js";
import { createUniqueApplication } from "./helpers/application.js";
import { createAppIdFactory } from "./helpers/unique-name.js";

const uniqueAppId = createAppIdFactory("org.gtkx.instance");
const started: Gio.Application[] = [];
const completions: Promise<number>[] = [];

const trackUniqueApplication = (applicationId: string): Gio.Application => {
    const application = createUniqueApplication(applicationId);
    started.push(application);

    return application;
};

const start = (application: Gio.Application, argv: string[]): Promise<number> => {
    const completion = application.runAsync(argv);
    completions.push(completion);

    return completion;
};

const runAndQuitApplication = async (): Promise<Gio.Application> => {
    const application = trackUniqueApplication(uniqueAppId());
    const completion = start(application, ["probe"]);
    application.quit();
    await expect(completion).resolves.toBe(0);

    return application;
};

afterEach(async () => {
    const applications = [...started];
    started.length = 0;

    for (const application of applications) {
        application.quit();
    }

    await Promise.allSettled(completions.splice(0));
    stopApplicationOwners();
});

describe("Application.runAsync instance ownership", () => {
    it("registers a primary instance for the process that owns the application ID", async () => {
        const application = trackUniqueApplication(uniqueAppId());
        const completion = start(application, ["probe"]);
        expect(application.getIsRegistered()).toBe(true);
        expect(application.getIsRemote()).toBe(false);
        application.quit();
        await expect(completion).resolves.toBe(0);
    });

    it("registers without becoming primary when another process already owns the application ID", async () => {
        const applicationId = uniqueAppId();
        await startApplicationOwner(applicationId);
        const application = trackUniqueApplication(applicationId);
        await expect(start(application, ["probe"])).resolves.toBe(0);
        expect(application.getIsRegistered()).toBe(true);
        expect(application.getIsRemote()).toBe(true);
    });

    it("leaves an instance unregistered when its command line is refused", async () => {
        const application = trackUniqueApplication(uniqueAppId());
        await expect(start(application, ["probe", "--nope"])).resolves.toBe(1);
        expect(application.getIsRegistered()).toBe(false);
    });

    it("releases registration after shutdown", async () => {
        const application = await runAndQuitApplication();
        expect(application.getIsRegistered()).toBe(false);
    });

    it("registers a primary instance again for an application that ran a second time", async () => {
        const application = await runAndQuitApplication();
        const completion = start(application, ["probe"]);
        expect(application.getIsRegistered()).toBe(true);
        expect(application.getIsRemote()).toBe(false);
        application.quit();
        await expect(completion).resolves.toBe(0);
    });
});
