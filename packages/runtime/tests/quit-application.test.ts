import { quitApplication, runApplication } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { countSignal, createApplication, createPlainApplication } from "./helpers/application.js";

describe("runApplication — an application GTKX did not derive", () => {
    it("refuses to start an application built straight from Gio.Application", () => {
        const application = createPlainApplication();
        const activations = countSignal(application, "activate");
        expect(() => runApplication(application, ["probe"])).toThrow();
        expect(application.getIsRegistered()).toBe(false);
        expect(activations()).toBe(0);
    });

    it("leaves an unregistered foreign application untouched when quit", () => {
        const application = createPlainApplication();
        const shutdowns = countSignal(application, "shutdown");
        quitApplication(application);
        expect(shutdowns()).toBe(0);
    });
});

describe("quitApplication — an application that already quit itself", () => {
    it("releases an application whose own quit ran first", () => {
        const application = createApplication();
        const shutdowns = countSignal(application, "shutdown");
        runApplication(application, ["probe"]);
        application.quit();
        quitApplication(application);
        expect(shutdowns()).toBe(1);
    });
});

describe("runApplication — starting an application a second time", () => {
    it("registers and activates again after a full shutdown", () => {
        const application = createApplication();
        const activations = countSignal(application, "activate");
        const shutdowns = countSignal(application, "shutdown");
        expect(runApplication(application, ["probe"])).toEqual({ isPrimary: true, exitStatus: 0 });
        quitApplication(application);
        expect(application.getIsRegistered()).toBe(false);
        expect(runApplication(application, ["probe"])).toEqual({ isPrimary: true, exitStatus: 0 });
        expect(application.getIsRegistered()).toBe(true);
        expect(activations()).toBe(2);
        quitApplication(application);
        expect(shutdowns()).toBe(2);
    });
});
