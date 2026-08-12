import type * as Gio from "@gtkx/gi/gio";
import { getApplicationInstance, quitApplication, runApplication } from "@gtkx/runtime";
import { afterEach, describe, expect, it } from "vitest";
import { startApplicationOwner, stopApplicationOwners } from "../helpers/application-owner.js";
import { createUniqueApplication } from "../helpers/application.js";
import { createAppIdFactory } from "../helpers/unique-name.js";

const uniqueAppId = createAppIdFactory("org.gtkx.instance");
const started: Gio.Application[] = [];

const trackUniqueApplication = (applicationId: string): Gio.Application => {
    const application = createUniqueApplication(applicationId);
    started.push(application);

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

describe("getApplicationInstance", () => {
    it("reports a primary instance for the process that owns the application ID", () => {
        const application = trackUniqueApplication(uniqueAppId());
        expect(runApplication(application, ["probe"])).toEqual({ isPrimary: true, exitStatus: 0 });
        expect(getApplicationInstance(application)).toBe("primary");
    });

    it("reports a remote instance when another process already owns the application ID", async () => {
        const applicationId = uniqueAppId();
        await startApplicationOwner(applicationId);
        const application = trackUniqueApplication(applicationId);
        expect(runApplication(application, ["probe"])).toEqual({ isPrimary: false, exitStatus: 0 });
        expect(application.getIsRegistered()).toBe(true);
        expect(getApplicationInstance(application)).toBe("remote");
    });

    it("reports an unregistered instance for an application that never ran", () => {
        const application = trackUniqueApplication(uniqueAppId());
        expect(application.getIsRegistered()).toBe(false);
        expect(getApplicationInstance(application)).toBe("unregistered");
    });
});
