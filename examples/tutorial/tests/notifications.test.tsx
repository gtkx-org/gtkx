import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import { act, render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { execFile, fork, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import schema from "../data/com.gtkx.tutorial.gschema.xml";
import { App } from "../src/app.js";
import { useStore } from "../src/store/index.js";

const call = promisify(execFile);
const service = "org.freedesktop.Notifications";
const objectPath = "/org/freedesktop/Notifications";
const busctl = "/usr/bin/busctl";
const settings = Gio.Settings.new(schema.id);

type Notification = [
    app: string,
    replaces: number,
    icon: string,
    title: string,
    body: string,
    actions: string[],
    hints: Record<string, { type: string; data: unknown }>,
    expires: number,
];

type NotificationLog = Notification[] & { withdrawals: number };

const testDue = (index: number, offset: number, due: string): string | null => {
    if (index === 3) {
        return new Date(Date.now() + offset).toISOString();
    }

    return index === 4 ? null : due;
};

const rejectAfterExit = async (exited: Promise<void>): Promise<never> => {
    await exited;
    throw new Error("The reminder application exited before mounting");
};

const test = it.extend<{ notifications: NotificationLog }>({
    notifications: async ({}, run) => {
        const address = process.env.DBUS_SESSION_BUS_ADDRESS;
        if (address === undefined) {
            throw new Error("The notification test needs its headless session bus");
        }
        const args = [`--address=${address}`, "--json=short"];
        const child = spawn(busctl, [...args, `--match=type='method_call',interface='${service}'`, "monitor"], {
            stdio: ["ignore", "pipe", "inherit"],
        });
        const notifications: NotificationLog = Object.assign([], { withdrawals: 0 });
        let informationCalls = 0;
        let isStopping = false;
        let failure: Error | undefined;
        const exited: Promise<void> = new Promise((resolve) => {
            child.once("error", (error) => {
                failure = error;
            });
            child.once("close", (code, signal) => {
                if (!isStopping) {
                    failure = new Error(`Notification monitor exited: ${String(code ?? signal)}`);
                }
                resolve();
            });
        });
        const lines = createInterface({ input: child.stdout });
        lines.on("line", (line) => {
            const message = JSON.parse(line) as { member: string; payload: { data: unknown } };
            switch (message.member) {
                case "Notify": {
                    notifications.push(message.payload.data as Notification);
                    break;
                }
                case "CloseNotification": {
                    notifications.withdrawals += 1;
                    break;
                }
                case "GetServerInformation": {
                    informationCalls += 1;
                    break;
                }
            }
        });
        const synchronize = async (): Promise<void> => {
            const previous = informationCalls;
            await expect.poll(async () => {
                if (failure !== undefined) {
                    throw failure;
                }
                await call(busctl, [...args, "call", service, objectPath, service, "GetServerInformation"]);

                return informationCalls;
            }).toBeGreaterThan(previous);
        };

        try {
            await synchronize();
            await run(notifications);
            if (failure !== undefined) {
                throw failure;
            }
        } finally {
            isStopping = true;
            child.kill();
            await exited;
            lines.close();
        }
    },
});

beforeEach(async () => {
    await act(() => {
        settings.setInt("reminder-minutes", 0);
        useStore.setState((state) => ({ tasks: state.tasks.map((task) => ({ ...task, due: null })) }));
    });
});

afterEach(async () => {
    await act(() => {
        settings.reset("reminder-minutes");
    });
});

describe("desktop reminders", () => {
    test("sends once across effect replay and remount, then sends a changed due date", async ({ notifications }) => {
        const due = new Date(Date.now() - 1000).toISOString();
        useStore.getState().updateTask("t2", { due });

        const first = await render(<StrictMode><App /></StrictMode>, { container: rootElement });
        await waitFor(() => {
            expect(notifications).toHaveLength(1);
        });
        await first.unmount();
        await render(<App />, { container: rootElement });
        await act(() => {
            useStore.getState().updateTask("t2", {
                due: new Date(Date.now() - 500).toISOString(),
                title: "Water the balcony",
            });
        });
        await waitFor(() => {
            expect(notifications.at(-1)?.[3]).toBe("Water the balcony");
        });
        expect(notifications.map((notification) => notification[3])).toEqual([
            "Water the plants",
            "Water the balcony",
        ]);
    });

    test("sends every task in the same due batch", async ({ notifications }) => {
        settings.setInt("reminder-minutes", 30);
        const due = new Date(Date.now() + 10 * 60_000).toISOString();
        useStore.getState().updateTask("t2", { due });
        useStore.getState().updateTask("t4", { due });

        await render(<App />, { container: rootElement });

        await waitFor(() => {
            expect(notifications).toHaveLength(2);
        });
        expect(notifications.map((notification) => notification[3]).toSorted((a, b) => a.localeCompare(b))).toEqual([
            "Review pull requests",
            "Water the plants",
        ]);
    });

    test.for([
        { timing: "future", offset: 60_000 },
        { timing: "old overdue", offset: -120_000 },
    ])("skips completed, deleted, previously notified and $timing tasks", async ({ offset }, { notifications }) => {
        const due = new Date(Date.now() - 1000).toISOString();
        useStore.setState((state) => ({
            tasks: state.tasks.map((task, index) => ({
                ...task,
                due: testDue(index, offset, due),
                done: index === 0,
                deleted: index === 1,
                lastNotifiedDue: index === 2 ? due : null,
            })),
        }));

        await render(<App />, { container: rootElement });
        await waitFor(() => {
            expect(notifications.at(-1)?.[3]).toBe("Order birthday gift");
        });

        expect(notifications.map((message) => message[3])).toEqual(["Order birthday gift"]);
    });

    test.for([
        { name: "completion", change: () => {
            useStore.getState().setDone("t4", true);
        } },
        { name: "trash", change: () => {
            useStore.getState().moveToTrash("t4");
        } },
        { name: "removal", change: () => {
            useStore.getState().deleteForever("t4");
        } },
        {
            name: "rescheduling",
            change: () => {
                useStore.getState().updateTask("t4", {
                    due: new Date(Date.now() + 3_600_000).toISOString(),
                });
            },
        },
    ])("honors $name before a pending reminder dispatches", async ({ change }, { notifications }) => {
        const due = new Date(Date.now() - 1000).toISOString();
        for (const id of ["t2", "t4", "t6"]) {
            useStore.getState().updateTask(id, { due });
        }
        const unsubscribe = useStore.subscribe((state) => {
            if (state.tasks.every((task) => !(task.id === "t2" && task.lastNotifiedDue === due))) {
                return;
            }

            unsubscribe();
            change();
        });

        try {
            await render(<App />, { container: rootElement });
            await waitFor(() => {
                expect(notifications.some((message) => message[3] === "Order birthday gift"))
                    .toBe(true);
            });
            expect(notifications.map((message) => message[3])).toEqual([
                "Water the plants",
                "Order birthday gift",
            ]);
        } finally {
            unsubscribe();
        }
    });

    test.for([
        {
            name: "completion",
            change: async () => {
                const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Review pull requests" });
                await userEvent.click(within(row).getByRole(Gtk.AccessibleRole.CHECKBOX));
            },
            expectedCompletion: true,
        },
        {
            name: "trash",
            change: async () => {
                const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Review pull requests" });
                await userEvent.click(within(row).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete task" }));
            },
            expectedCompletion: null,
        },
        {
            name: "permanent removal",
            change: async () => act(() => {
                useStore.getState().deleteForever("t4");
            }),
            expectedCompletion: null,
        },
        {
            name: "rescheduling",
            change: async () => act(() => {
                useStore.getState().updateTask("t4", {
                    due: new Date(Date.now() + 3_600_000).toISOString(),
                });
            }),
            expectedCompletion: false,
        },
    ])("withdraws and rejects stale actions after $name", async ({ change, expectedCompletion }, { notifications }) => {
        const due = new Date(Date.now() - 1000).toISOString();
        useStore.getState().updateTask("t4", { due });
        await render(<App />, { container: rootElement });
        await waitFor(() => {
            expect(notifications.at(-1)?.[3]).toBe("Review pull requests");
        });

        await change();
        await waitFor(() => {
            expect(notifications.withdrawals).toBe(1);
        });

        const target = GLib.Variant.newTuple([GLib.Variant.newString("t4"), GLib.Variant.newString(due)]);
        const window = screen.getByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        await act(() => {
            expect(window.activateAction("app.open-reminder", target)).toBe(true);
            expect(window.activateAction("app.complete-reminder", target)).toBe(true);
        });
        expect(screen.queryByText("Notes")).toBeNull();

        const row = screen.queryByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Review pull requests" });
        const isCompleted = row === null
            ? null
            : within(row).queryByRole(Gtk.AccessibleRole.CHECKBOX, { checked: true }) !== null;
        expect(isCompleted).toBe(expectedCompletion);
    });

    test("uses the current title when a pending reminder dispatches", async ({ notifications }) => {
        const due = new Date(Date.now() - 1000).toISOString();
        for (const id of ["t2", "t4", "t6"]) {
            useStore.getState().updateTask(id, { due });
        }
        const unsubscribe = useStore.subscribe((state) => {
            if (state.tasks.every((task) => !(task.id === "t2" && task.lastNotifiedDue === due))) {
                return;
            }

            unsubscribe();
            state.updateTask("t4", { title: "Review the new pull requests" });
        });

        try {
            await render(<App />, { container: rootElement });
            await waitFor(() => {
                expect(notifications.some((message) => message[3] === "Order birthday gift"))
                    .toBe(true);
            });
            expect(notifications.map((message) => message[3])).toEqual([
                "Water the plants",
                "Review the new pull requests",
                "Order birthday gift",
            ]);
        } finally {
            unsubscribe();
        }
    });

    test("catches a nonzero reminder after the application resumes past its due window", async (
        { notifications, signal },
    ) => {
        const project = fileURLToPath(new URL("..", import.meta.url));
        const output = mkdtempSync(join(project, ".gtkx-reminder-"));
        const dataHome = mkdtempSync(join(tmpdir(), "gtkx-reminder-data-"));
        const cliManifest = fileURLToPath(import.meta.resolve("@gtkx/cli/package.json"));
        const cli = join(dirname(cliManifest), "bin", "gtkx.js");
        try {
            await call(process.execPath, [
                cli,
                "build",
                "tests/fixtures/delayed-reminder.tsx",
                "--out",
                relative(project, output),
            ], { cwd: project, timeout: 60_000, signal });
            const child = fork(join(output, "bundle.mjs"), {
                cwd: project,
                env: { ...process.env, XDG_DATA_HOME: dataHome },
                execArgv: [],
                signal,
                killSignal: "SIGKILL",
                stdio: ["ignore", "ignore", "inherit", "ipc"],
            });
            const exited: Promise<void> = new Promise((resolve) => child.once("close", () => {
                resolve();
            }));
            const ready: Promise<{ due: number }> = new Promise((resolve, reject) => {
                child.once("message", resolve);
                child.once("error", reject);
            });
            try {
                const { due } = await Promise.race([
                    ready,
                    rejectAfterExit(exited),
                ]);
                await waitFor(() => {
                    expect(notifications.map((message) => message[3])).toEqual(["Review pull requests"]);
                });
                child.kill("SIGSTOP");
                await delay(due + 65_000 - Date.now(), undefined, { signal });
                child.kill("SIGCONT");
                await waitFor(() => {
                    expect(notifications.at(-1)?.[3]).toBe("Water the plants");
                }, { timeout: 10_000 });
                expect(notifications.map((message) => message[3])).toEqual([
                    "Review pull requests",
                    "Water the plants",
                ]);
            } finally {
                child.kill("SIGCONT");
                child.kill("SIGTERM");
                await exited;
            }
        } finally {
            rmSync(output, { recursive: true, force: true });
            rmSync(dataHome, { recursive: true, force: true });
        }
    }, 180_000);

    test("serializes reminder content and routes its open action", async ({ notifications }) => {
        const due = new Date(Date.now() - 1000).toISOString();
        useStore.getState().updateTask("t2", { due });
        await render(<App />, { container: rootElement });
        await waitFor(() => {
            expect(notifications).toHaveLength(1);
        });
        const [notification] = notifications;
        expect(notification[3]).toBe("Water the plants");
        expect(notification[4]).toMatch(/^Due /);
        expect(notification[5]).toContain("default");
        expect(notification[5]).toContain("Mark Complete");
        expect(notification[6].urgency).toEqual({ type: "y", data: 1 });

        const window = screen.getByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        const target = GLib.Variant.newTuple([GLib.Variant.newString("t2"), GLib.Variant.newString(due)]);
        await act(() => {
            expect(window.activateAction("app.open-reminder", target)).toBe(true);
        });
        expect(await screen.findByText("Notes")).toHaveTextContent("Notes");
        await waitFor(() => {
            expect(notifications.withdrawals).toBe(1);
        });
    });

    test("completes from a reminder action and withdraws once", async ({ notifications }) => {
        const due = new Date(Date.now() - 1000).toISOString();
        useStore.getState().updateTask("t2", { due });
        await render(<App />, { container: rootElement });
        await waitFor(() => {
            expect(notifications).toHaveLength(1);
        });

        const window = screen.getByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        const target = GLib.Variant.newTuple([GLib.Variant.newString("t2"), GLib.Variant.newString(due)]);
        await act(() => {
            expect(window.activateAction("app.complete-reminder", target)).toBe(true);
        });
        await waitFor(() => {
            expect(notifications.withdrawals).toBe(1);
        });
        const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Water the plants" });
        expect(within(row).getByRole(Gtk.AccessibleRole.CHECKBOX)).toBeChecked();
    });
});
