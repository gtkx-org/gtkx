import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { createRoot } from "@gtkx/react";
import { act, waitFor, within } from "@gtkx/testing";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { applicationId, resourceBasePath } from "virtual:gtkx-config";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/app.js";
import { useStore } from "../src/store/index.js";

const call = promisify(execFile);

async function callApplication(method: string, signature: string, ...args: string[]): Promise<void> {
    const address = process.env.DBUS_SESSION_BUS_ADDRESS;
    if (address === undefined) {
        throw new Error("Application actions need a headless session bus");
    }
    await call("busctl", [
        `--address=${address}`,
        "call",
        applicationId,
        resourceBasePath,
        "org.freedesktop.Application",
        method,
        signature,
        ...args,
    ]);
}

async function activateAction(name: string, id: string): Promise<void> {
    await act(() => callApplication("ActivateAction", "sava{sv}", name, "1", "s", id, "0"));
}

const test = it.extend<{ application: Gtk.Application }>({
    application: async ({}, run) => {
        const root = createRoot();
        const original = process.argv;
        process.argv = [...original.slice(0, 2), "--gapplication-service"];

        try {
            await act(() => {
                root.render(<App />);
            });
            const application = Gio.Application.getDefault();
            if (!(application instanceof Gtk.Application)) {
                throw new TypeError("The application did not register");
            }
            await run(application);
        } finally {
            process.argv = original;
            await act(() => {
                root.unmount();
            });
        }
    },
});

async function expectSelectedTitle(application: Gtk.Application, title: string): Promise<void> {
    await waitFor(() => {
        const row = within(application).getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /^Title/, as: Adw.EntryRow });
        expect(row.getText()).toBe(title);
    });
}

beforeEach(() => {
    useStore.setState((state) => ({ tasks: state.tasks.map((task) => ({ ...task, due: null })) }));
});

describe("application actions", () => {
    test("opens a task from service mode and reuses its window for later activations", async ({ application }) => {
        const screen = within(application);
        expect(application.getWindows()).toHaveLength(0);

        await activateAction("open-task", "t2");
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        await expectSelectedTitle(application, "Water the plants");

        await activateAction("open-task", "t4");
        await expectSelectedTitle(application, "Review pull requests");
        expect(screen.getByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window })).toBe(window);

        await act(() => callApplication("Activate", "a{sv}", "0"));
        await expectSelectedTitle(application, "Review pull requests");
        expect(screen.getByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window })).toBe(window);
    });

    test("persists completion in service mode before opening any window", async ({ application }) => {
        const screen = within(application);
        await activateAction("complete-task", "t2");
        expect(application.getWindows()).toHaveLength(0);
        const file = join(GLib.getUserDataDir(), applicationId, "tasks.json");
        const saved = JSON.parse(readFileSync(file, "utf8")) as {
            state: { tasks: { id: string; done: boolean; completedAt: string | null }[] };
        };
        const completed = saved.state.tasks.find((task) => task.id === "t2");
        expect(completed?.done).toBe(true);
        expect(typeof completed?.completedAt).toBe("string");

        await act(() => callApplication("Activate", "a{sv}", "0"));
        await activateAction("open-task", "t2");
        await expectSelectedTitle(application, "Water the plants");
        expect(await screen.findByText("Completed")).toHaveTextContent("Completed");
    });

    test("rejects an incompatible action target without opening a window", async ({ application }) => {
        await expect(
            callApplication("ActivateAction", "sava{sv}", "open-task", "1", "i", "7", "0"),
        ).rejects.toHaveProperty("code", 1);
        expect(application.getWindows()).toHaveLength(0);

        await activateAction("open-task", "t2");
        await expectSelectedTitle(application, "Water the plants");
    });
});
