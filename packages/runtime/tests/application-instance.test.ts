import type * as Gio from "@gtkx/gi/gio";
import { quitApplication, runApplication } from "@gtkx/runtime";
import { getApplicationInstance } from "@gtkx/runtime/internal";
import { afterEach, describe, expect, it } from "vitest";
import { startApplicationOwner, stopApplicationOwners } from "./helpers/application-owner.js";
import { createUniqueApplication } from "./helpers/application.js";
import { createAppIdFactory } from "./helpers/unique-name.js";

const uniqueAppId = createAppIdFactory("org.gtkx.instance");
const started: Gio.Application[] = [];

const trackUniqueApplication = (applicationId: string): Gio.Application => {
    const application = createUniqueApplication(applicationId);
    started.push(application);

    return application;
};

const runAndQuitApplication = (): Gio.Application => {
    const application = trackUniqueApplication(uniqueAppId());
    runApplication(application, ["probe"]);
    quitApplication(application);

    return application;
};

afterEach(() => {
    const applications = [...started];
    started.length = 0;

    for (const application of applications) {
        quitApplication(application);
    }

    stopApplicationOwners();
});

describe("runApplication instance ownership", () => {
    it("reports a primary instance for the process that owns the application ID", () => {
        const application = trackUniqueApplication(uniqueAppId());
        expect(runApplication(application, ["probe"])).toEqual({ isPrimary: true, exitStatus: 0 });
    });

    it("registers without becoming primary when another process already owns the application ID", async () => {
        const applicationId = uniqueAppId();
        await startApplicationOwner(applicationId);
        const application = trackUniqueApplication(applicationId);
        expect(runApplication(application, ["probe"])).toEqual({ isPrimary: false, exitStatus: 0 });
        expect(application.getIsRegistered()).toBe(true);
        expect(application.getIsRemote()).toBe(true);
    });

    it("keeps reporting an unregistered instance for a command line the application refused", () => {
        const application = trackUniqueApplication(uniqueAppId());
        expect(runApplication(application, ["probe", "--nope"])).toEqual({ isPrimary: false, exitStatus: 1 });
        expect(application.getIsRegistered()).toBe(false);
        expect(getApplicationInstance(application)).toBe("unregistered");
    });

    it("tells an application that shut down apart from one that never registered", () => {
        const application = runAndQuitApplication();
        expect(application.getIsRegistered()).toBe(false);
        expect(getApplicationInstance(application)).toBe("shutDown");
    });

    it("reports a primary instance again for an application that ran a second time", () => {
        const application = runAndQuitApplication();
        expect(runApplication(application, ["probe"])).toEqual({ isPrimary: true, exitStatus: 0 });
        expect(getApplicationInstance(application)).toBe("primary");
    });
});
