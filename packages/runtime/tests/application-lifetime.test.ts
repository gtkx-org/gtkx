import { setImmediate, setTimeout } from "node:timers/promises";
import * as Gio from "@gtkx/gi/gio";
import { afterEach, describe, expect, it } from "vitest";
import { countSignal, createApplication } from "./helpers/application.js";

const applications: Gio.Application[] = [];
const completions: Promise<number>[] = [];

const createTrackedApplication = (): Gio.Application => {
    const application = createApplication();
    applications.push(application);

    return application;
};

const start = (application: Gio.Application, argv = ["probe"]): Promise<number> => {
    const completion = application.runAsync(argv);
    completions.push(completion);

    return completion;
};

afterEach(async () => {
    for (const application of applications.splice(0)) {
        application.quit();
    }

    await Promise.allSettled(completions.splice(0));
});

describe("Application automatic lifetime", () => {
    it("shuts down after startup when no holds or windows remain", async () => {
        const application = createTrackedApplication();
        const activations = countSignal(application, "activate");
        const shutdowns = countSignal(application, "shutdown");
        const completion = start(application);

        expect(activations()).toBe(1);
        expect(shutdowns()).toBe(0);
        expect(application.getIsRegistered()).toBe(true);
        expect(Gio.Application.getDefault()).toBe(application);

        await expect(completion).resolves.toBe(0);

        expect(shutdowns()).toBe(1);
        expect(application.getIsRegistered()).toBe(false);
        expect(Gio.Application.getDefault()).toBeNull();
    });

    it("stays active until every hold acquired during activation is released", async () => {
        const application = createTrackedApplication();
        const shutdowns = countSignal(application, "shutdown");
        application.on("activate", () => {
            application.hold();
            application.hold();
        });
        let settled = false;
        const completion = start(application);
        void completion.then(() => {
            settled = true;
        });

        await setImmediate();
        expect(settled).toBe(false);
        application.release();
        await setImmediate();
        expect(settled).toBe(false);
        expect(shutdowns()).toBe(0);
        expect(application.getIsRegistered()).toBe(true);
        application.release();

        await expect(completion).resolves.toBe(0);
        expect(shutdowns()).toBe(1);
        expect(application.getIsRegistered()).toBe(false);
    });

    it("cancels a queued automatic exit when a hold is reacquired", async () => {
        const application = createTrackedApplication();
        countSignal(application, "activate");
        application.hold();
        let settled = false;
        const completion = start(application);
        void completion.then(() => {
            settled = true;
        });

        application.release();
        application.hold();
        await setImmediate();

        expect(settled).toBe(false);
        expect(application.getIsRegistered()).toBe(true);
        application.release();

        await expect(completion).resolves.toBe(0);
        expect(application.getIsRegistered()).toBe(false);
    });

    it("forces shutdown with outstanding holds and allows their later release", async () => {
        const application = createTrackedApplication();
        countSignal(application, "activate");
        const shutdowns = countSignal(application, "shutdown");
        application.hold();
        application.hold();
        const completion = start(application);
        await setImmediate();

        expect(shutdowns()).toBe(0);
        application.quit();

        await expect(completion).resolves.toBe(0);
        expect(shutdowns()).toBe(1);
        expect(application.getIsRegistered()).toBe(false);
        expect(Gio.Application.getDefault()).toBeNull();
        application.release();
        application.release();
        expect(shutdowns()).toBe(1);
    });

    it("preserves balanced holds acquired before startup", async () => {
        const application = createTrackedApplication();
        countSignal(application, "activate");
        application.hold();
        application.hold();
        application.release();
        let settled = false;
        const completion = start(application);
        void completion.then(() => {
            settled = true;
        });

        await setImmediate();

        expect(settled).toBe(false);
        expect(application.getIsRegistered()).toBe(true);
        application.release();

        await expect(completion).resolves.toBe(0);
        expect(application.getIsRegistered()).toBe(false);
    });

    it("rejects unbalanced releases without corrupting subsequent holds", async () => {
        const application = createTrackedApplication();
        countSignal(application, "activate");

        expect(() => application.release()).toThrow(RangeError);
        application.hold();
        const completion = start(application);
        await setImmediate();
        expect(application.getIsRegistered()).toBe(true);
        application.release();

        await expect(completion).resolves.toBe(0);
        expect(() => application.release()).toThrow(RangeError);
        expect(application.getIsRegistered()).toBe(false);
    });

    it("waits for the inactivity timeout after the final hold is released", async () => {
        const application = createTrackedApplication();
        countSignal(application, "activate");
        application.setInactivityTimeout(40);
        application.hold();
        const completion = start(application);
        const releasedAt = performance.now();
        application.release();

        await expect(completion).resolves.toBe(0);

        expect(performance.now() - releasedAt).toBeGreaterThanOrEqual(30);
        expect(application.getIsRegistered()).toBe(false);
    });

    it("preserves the inactivity timeout when startup acquires and releases its final hold", async () => {
        const application = createTrackedApplication();
        application.setInactivityTimeout(40);
        application.on("activate", () => {
            application.hold();
            application.release();
        });
        const startedAt = performance.now();
        const completion = start(application);

        await expect(completion).resolves.toBe(0);

        expect(performance.now() - startedAt).toBeGreaterThanOrEqual(30);
        expect(application.getIsRegistered()).toBe(false);
    });

    it("does not carry an interrupted inactivity timeout into a fresh unused run", async () => {
        const application = createTrackedApplication();
        countSignal(application, "activate");
        const shutdowns = countSignal(application, "shutdown");
        application.setInactivityTimeout(10_000);
        application.hold();
        const first = start(application);
        application.release();
        application.quit();

        await expect(first).resolves.toBe(0);

        let settled = false;
        const second = start(application);
        void second.then(() => {
            settled = true;
        });

        await setImmediate();

        expect(settled).toBe(true);
        await expect(second).resolves.toBe(0);
        expect(shutdowns()).toBe(2);
        expect(Gio.Application.getDefault()).toBeNull();
    });

    it("cancels an inactivity timeout when a hold is reacquired", async () => {
        const application = createTrackedApplication();
        countSignal(application, "activate");
        application.setInactivityTimeout(40);
        application.hold();
        let settled = false;
        const completion = start(application);
        void completion.then(() => {
            settled = true;
        });
        application.release();
        application.hold();

        await setTimeout(60);

        expect(settled).toBe(false);
        expect(application.getIsRegistered()).toBe(true);
        const releasedAt = performance.now();
        application.release();
        await expect(completion).resolves.toBe(0);
        expect(performance.now() - releasedAt).toBeGreaterThanOrEqual(30);
    });

    it("keeps an idle service alive until its first hold is acquired and released", async () => {
        const application = createTrackedApplication();
        const activations = countSignal(application, "activate");
        let settled = false;
        const completion = start(application, ["probe", "--gapplication-service"]);
        void completion.then(() => {
            settled = true;
        });

        await setImmediate();

        expect(activations()).toBe(0);
        expect(settled).toBe(false);
        expect(application.getIsRegistered()).toBe(true);
        application.hold();
        application.release();

        await expect(completion).resolves.toBe(0);
        expect(application.getIsRegistered()).toBe(false);
    });
});
