import { setImmediate } from "node:timers/promises";
import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { afterEach, describe, expect, it } from "vitest";
import { applicationProps, countSignal } from "./helpers/application.js";

interface ApplicationCase {
    name: string;
    createApplication(): Gtk.Application;
    createWindow(application: Gtk.Application): Gtk.Window;
}

const applicationCases: ApplicationCase[] = [
    {
        name: "Gtk",
        createApplication: () => new Gtk.Application(applicationProps()),
        createWindow: (application) => new Gtk.ApplicationWindow({ application }),
    },
    {
        name: "Adw",
        createApplication: () => new Adw.Application(applicationProps()),
        createWindow: (application) => new Adw.ApplicationWindow({ application }),
    },
];

const applications: Gtk.Application[] = [];
const windows: Gtk.Window[] = [];
const completions: Promise<number>[] = [];

const createWindow = (applicationCase: ApplicationCase, application: Gtk.Application): Gtk.Window => {
    const window = applicationCase.createWindow(application);
    windows.push(window);

    return window;
};

const startWithWindow = (applicationCase: ApplicationCase) => {
    const application = applicationCase.createApplication();
    applications.push(application);
    const activatedWindows: Gtk.Window[] = [];
    const shutdowns = countSignal(application, "shutdown");
    application.on("activate", () => {
        activatedWindows.push(createWindow(applicationCase, application));
    });
    const completion = application.runAsync(["probe"]);
    completions.push(completion);
    let settled = false;
    void completion.then(
        () => {
            settled = true;
        },
        () => {
            settled = true;
        },
    );
    const [window] = activatedWindows;

    if (!window) {
        throw new Error("Application activation did not create a window");
    }

    return { application, window, completion, shutdowns, settled: () => settled };
};

afterEach(async () => {
    for (const window of windows.splice(0)) {
        window.destroy();
    }

    for (const application of applications.splice(0)) {
        application.quit();
    }

    await Promise.allSettled(completions.splice(0));
});

describe.each(applicationCases)("$name application window lifetime", (applicationCase) => {
    it.each(["close", "destroy"] as const)(
        "shuts down after the last of two windows is removed by %s",
        async (remove) => {
            const run = startWithWindow(applicationCase);
            const secondWindow = createWindow(applicationCase, run.application);
            run.window.present();
            secondWindow.present();

            await setImmediate();

            expect(run.settled()).toBe(false);
            expect(run.application.getWindows()).toHaveLength(2);
            run.window.close();

            await setImmediate();

            expect(run.settled()).toBe(false);
            expect(run.shutdowns()).toBe(0);
            expect(run.application.getWindows()).toEqual([secondWindow]);
            secondWindow[remove]();

            await expect(run.completion).resolves.toBe(0);

            expect(run.shutdowns()).toBe(1);
            expect(run.application.getWindows()).toHaveLength(0);
            expect(run.application.getIsRegistered()).toBe(false);
            expect(Gio.Application.getDefault()).toBeNull();
        },
    );

    it("retains hidden windows, including windows hidden by closing", async () => {
        const run = startWithWindow(applicationCase);

        await setImmediate();

        expect(run.window.getVisible()).toBe(false);
        expect(run.settled()).toBe(false);
        run.window.setHideOnClose(true);
        run.window.present();
        run.window.close();

        await setImmediate();

        expect(run.window.getVisible()).toBe(false);
        expect(run.application.getWindows()).toEqual([run.window]);
        expect(run.settled()).toBe(false);
        expect(run.shutdowns()).toBe(0);
        run.window.destroy();

        await expect(run.completion).resolves.toBe(0);
        expect(run.shutdowns()).toBe(1);
    });

    it("keeps an explicit hold after the last window closes", async () => {
        const run = startWithWindow(applicationCase);
        run.application.hold();
        run.window.present();
        run.window.close();

        await setImmediate();

        expect(run.application.getWindows()).toHaveLength(0);
        expect(run.application.getIsRegistered()).toBe(true);
        expect(run.settled()).toBe(false);
        expect(run.shutdowns()).toBe(0);
        run.application.release();

        await expect(run.completion).resolves.toBe(0);
        expect(run.shutdowns()).toBe(1);
        expect(run.application.getIsRegistered()).toBe(false);
    });

    it("cancels automatic shutdown when the last window is synchronously replaced", async () => {
        const run = startWithWindow(applicationCase);
        run.application.removeWindow(run.window);
        const replacement = createWindow(applicationCase, run.application);

        await setImmediate();

        expect(run.window.getApplication()).toBeNull();
        expect(run.application.getWindows()).toEqual([replacement]);
        expect(run.settled()).toBe(false);
        expect(run.shutdowns()).toBe(0);
        replacement.destroy();

        await expect(run.completion).resolves.toBe(0);
        expect(run.shutdowns()).toBe(1);
    });

    it("transfers a window's lifetime to its new application", async () => {
        const previous = startWithWindow(applicationCase);
        const next = startWithWindow(applicationCase);
        next.window.destroy();
        previous.window.setApplication(next.application);

        await expect(previous.completion).resolves.toBe(0);
        await setImmediate();

        expect(previous.shutdowns()).toBe(1);
        expect(previous.application.getWindows()).toHaveLength(0);
        expect(previous.application.getIsRegistered()).toBe(false);
        expect(next.application.getWindows()).toEqual([previous.window]);
        expect(next.application.getIsRegistered()).toBe(true);
        expect(next.settled()).toBe(false);
        expect(next.shutdowns()).toBe(0);
        expect(Gio.Application.getDefault()).toBe(next.application);
        previous.window.destroy();

        await expect(next.completion).resolves.toBe(0);
        expect(next.shutdowns()).toBe(1);
        expect(Gio.Application.getDefault()).toBeNull();
    });
});
