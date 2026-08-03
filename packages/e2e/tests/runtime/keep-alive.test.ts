import * as Gtk from "@gtkx/gi/gtk";
import { quitApplication, runApplication } from "@gtkx/runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { countSignal, createApplication, createApplicationFrom } from "../helpers/application.js";

const nativeMock = vi.hoisted(() => ({ keepAlive: vi.fn() }));

vi.mock("@gtkx/native", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@gtkx/native")>();

    return { ...actual, keepAlive: nativeMock.keepAlive };
});

afterEach(() => {
    nativeMock.keepAlive.mockClear();
});

describe("runApplication — holding the native loop alive", () => {
    it("holds the loop from activation until shutdown releases it", () => {
        const application = createApplication();
        expect(runApplication(application, ["probe"])).toEqual({ isPrimary: true, exitStatus: 0 });
        expect(nativeMock.keepAlive).toHaveBeenLastCalledWith(true);
        quitApplication(application);
        expect(nativeMock.keepAlive).toHaveBeenLastCalledWith(false);
    });

    it("holds the loop for a registered application that never activated", () => {
        const application = createApplication();
        const activations = countSignal(application, "activate");

        expect(runApplication(application, ["probe", "--gapplication-service"])).toEqual({
            isPrimary: true,
            exitStatus: 0,
        });

        expect(activations()).toBe(0);
        expect(nativeMock.keepAlive).toHaveBeenCalledExactlyOnceWith(true);
        quitApplication(application);
    });

    it("leaves the loop alone when the command line registered nothing", () => {
        const application = createApplication();
        expect(runApplication(application, ["probe", "--nope"])).toEqual({ isPrimary: false, exitStatus: 1 });
        expect(nativeMock.keepAlive).not.toHaveBeenCalled();
    });

    it("holds the loop again on every later activation", () => {
        const application = createApplication();
        runApplication(application, ["probe"]);
        nativeMock.keepAlive.mockClear();
        application.activate();
        expect(nativeMock.keepAlive).toHaveBeenCalledExactlyOnceWith(true);
        quitApplication(application);
    });
});

describe("quitApplication — windows held by the application", () => {
    it("detaches every window before GLib reaches shutdown", () => {
        const application = createApplicationFrom(Gtk.Application);
        runApplication(application, ["probe"]);
        const windows = [new Gtk.ApplicationWindow({ application }), new Gtk.ApplicationWindow({ application })];
        expect(application.getWindows()).toEqual(windows);
        let windowsAtShutdown: number | null = null;

        application.on("shutdown", () => {
            windowsAtShutdown = application.getWindows().length;
        });

        quitApplication(application);
        expect(windowsAtShutdown).toBe(0);
        expect(application.getWindows()).toHaveLength(0);
    });
});
