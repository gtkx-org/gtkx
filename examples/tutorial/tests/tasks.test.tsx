import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import { act, fireEvent, render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app.js";
import { ALL_TASKS, openTask } from "../src/navigation.js";
import { useStore } from "../src/store/index.js";

const openWaterThePlants = async (): Promise<void> => {
    const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
    await fireEvent(row, "activated");
    await screen.findByText("Notes");
};

const findTitleEntry = (): Promise<Adw.EntryRow> =>
    screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /^Title/, as: Adw.EntryRow });

const importantSwitch = (isChecked: boolean): Gtk.Switch =>
    screen.getByRole(Gtk.AccessibleRole.SWITCH, { checked: isChecked, as: Gtk.Switch });

const settings = Gio.Settings.new("com.gtkx.tutorial");

afterEach(() => {
    vi.useRealTimers();
    settings.reset("reminder-minutes");
    vi.restoreAllMocks();
});

describe("Tasks", () => {
    it("adds a task from the entry row", async () => {
        await render(<App />, { container: rootElement });

        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await userEvent.type(entry, "Book flights");
        await userEvent.keyboard(entry, "{Enter}");

        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Book flights" })).toBeDefined();
    });

    it("marks a task complete", async () => {
        await render(<App />, { container: rootElement });

        const [checkbox] = await screen.findAllByRole(Gtk.AccessibleRole.CHECKBOX);
        await userEvent.click(checkbox);

        expect(checkbox).toBeChecked();
    });

    it("opens the editor when a row is activated", async () => {
        await render(<App />, { container: rootElement });

        await openWaterThePlants();

        expect(await screen.findByText("Notes")).toHaveTextContent("Notes");
    });

    it("opens a notification target requested before navigation mounts", async () => {
        openTask(ALL_TASKS, "t2");
        await render(<App />, { container: rootElement });

        expect(await screen.findByText("Notes")).toHaveTextContent("Notes");
    });

    it("goes back to the list from the editor", async () => {
        await render(<App />, { container: rootElement });

        await openWaterThePlants();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));

        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ })).toBeDefined();
        expect(screen.queryByText("Notes")).toBeNull();
    });

    it("shows another list when its sidebar row is selected", async () => {
        await render(<App />, { container: rootElement });

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /^Work/ }));

        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Review pull requests/ })).toBeDefined();
        expect(screen.queryByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ })).toBeNull();
    });

    it("opens the editor for a task added with the New Task button", async () => {
        await render(<App />, { container: rootElement });

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New Task (Ctrl+N)" }));

        expect(await screen.findByText("Notes")).toHaveTextContent("Notes");
        expect(useStore.getState().tasks.some((task) => task.title === "New Task")).toBe(true);
    });

    it("returns to the list when the open task is moved to trash", async () => {
        await render(<App />, { container: rootElement });

        await openWaterThePlants();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete (Delete)" }));

        expect(screen.queryByText("Notes")).toBeNull();
        expect(useStore.getState().tasks.find((task) => task.id === "t2")?.deleted).toBe(true);
    });

    it("permanently deletes a task through the Trash confirmation", async () => {
        await render(<App />, { container: rootElement });

        const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
        await userEvent.click(within(row).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete task" }));
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /^Trash/ }));
        const trashed = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
        await userEvent.click(within(trashed).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete task" }));
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete" }));

        expect(screen.queryByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ })).toBeNull();
    });

    it("reorders tasks by dragging", async () => {
        await render(<App />, { container: rootElement });

        const source = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
        const target = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Review pull requests/ });
        await userEvent.dragAndDrop(source, target, "t2");

        const [first, second] = await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM, {
            name: /Water the plants|Review pull requests/,
        });

        expect(first).toHaveAccessibleName("Review pull requests");
        expect(second).toHaveAccessibleName("Water the plants");
    });

    it("reorders the focused task with the keyboard", async () => {
        await render(<App />, { container: rootElement });

        const source = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
        source.grabFocus();
        await userEvent.keyboard(source, "{Alt>}{ArrowDown}{/Alt}");

        const [first, second] = await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM, {
            name: /Water the plants|Prepare the weekly report/,
        });
        expect(first).toHaveAccessibleName("Prepare the weekly report");
        expect(second).toHaveAccessibleName("Water the plants");
    });

    it("does not expose reordering while the list is filtered", async () => {
        await render(<App />, { container: rootElement });

        await userEvent.click(await screen.findByText("Open"));
        const source = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
        const target = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Review pull requests/ });

        await expect(userEvent.dragAndDrop(source, target, "t2")).rejects.toThrow();
    });

    it("ignores text drops that do not name a task", async () => {
        await render(<App />, { container: rootElement });

        const source = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
        const target = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Prepare the weekly report/ });
        await userEvent.dragAndDrop(source, target, "outside the application");

        const [water, report, gift] = await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM, {
            name: /Water the plants|Prepare the weekly report|Order birthday gift/,
        });
        expect(water).toHaveAccessibleName("Water the plants");
        expect(report).toHaveAccessibleName("Prepare the weekly report");
        expect(gift).toHaveAccessibleName(/Order birthday gift/);
    });

    it("keeps an empty new-list form open until it has a name", async () => {
        await render(<App />, { container: rootElement });

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New List" }));
        const add = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Add" });
        const name = await screen.findByPlaceholderText("List name");
        expect(add).toBeDisabled();
        await userEvent.type(name, " ".repeat(3));
        expect(add).toBeDisabled();
        await userEvent.type(name, "Errands");
        await waitFor(() => {
            expect(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Add" })).toBeEnabled();
        });
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Add" }));

        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /^Errands/ })).toBeDefined();
    });

    it("sends a zero-minute reminder once across a window remount", async () => {
        settings.setInt("reminder-minutes", 0);
        useStore.setState((state) => ({
            tasks: state.tasks.map((task) =>
                task.id === "t4"
                    ? { ...task, due: new Date(Date.now() - 1000).toISOString(), lastNotifiedDue: null }
                    : task,
            ),
        }));
        const sendNotification = vi
            .spyOn(Gio.Application.prototype, "sendNotification")
            .mockImplementation(() => {
                return;
            });

        const first = await render(<App />, { container: rootElement });
        await waitFor(() => {
            expect(sendNotification).toHaveBeenCalledTimes(1);
        });
        await first.unmount();
        await render(<App />, { container: rootElement });

        expect(sendNotification).toHaveBeenCalledTimes(1);
    });

    it("sends a nonzero reminder after a delayed sweep passes its window", async () => {
        vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
        settings.setInt("reminder-minutes", 1);
        useStore.setState((state) => ({
            tasks: state.tasks.map((task) =>
                task.id === "t4"
                    ? {
                          ...task,
                          done: false,
                          deleted: false,
                          due: new Date(Date.now() + 90_000).toISOString(),
                          lastNotifiedDue: null,
                      }
                    : { ...task, done: true },
            ),
        }));
        const sendNotification = vi
            .spyOn(Gio.Application.prototype, "sendNotification")
            .mockImplementation(() => {
                return;
            });

        const view = await render(<App />, { container: rootElement });
        expect(sendNotification).not.toHaveBeenCalled();
        await act(async () => {
            vi.setSystemTime(Date.now() + 60_000);
            await vi.advanceTimersByTimeAsync(60_000);
        });

        expect(sendNotification).toHaveBeenCalledTimes(1);
        await view.unmount();
    });

    it("keeps one color selected when the same swatch is clicked repeatedly", async () => {
        await render(<App />, { container: rootElement });

        await act(() => {
            useStore.getState().showDialog("new-list");
        });

        const orange = await screen.findByLabelText("Color #e66100");
        await userEvent.click(orange);
        await userEvent.click(orange);

        expect(orange).toHaveObjectProperty("active", true);
        expect(await screen.findByLabelText("Color #3584e4")).toHaveObjectProperty("active", false);
    });
});

describe("task form - happy path", () => {
    it("applies title and Important edits across navigation", async () => {
        await render(<App />, { container: rootElement });
        await openWaterThePlants();
        const title = await findTitleEntry();
        await userEvent.clear(title);
        await userEvent.type(title, "Water the balcony");
        await userEvent.keyboard(title, "{Enter}");
        await userEvent.click(importantSwitch(true));
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
        const updated = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the balcony/ });
        await fireEvent(updated, "activated");
        const reopenedTitle = await findTitleEntry();
        expect(reopenedTitle.getText()).toBe("Water the balcony");
        expect(importantSwitch(false)).not.toBeChecked();
    });
});

describe("task form - edge cases", () => {
    it("syncs Important changes without replacing a dirty title or leaking it to another task", async () => {
        await render(<App />, { container: rootElement });
        await openWaterThePlants();
        const title = await findTitleEntry();
        await userEvent.clear(title);
        await userEvent.type(title, "Unapplied draft");
        await userEvent.click(importantSwitch(true));
        expect(title.getText()).toBe("Unapplied draft");
        expect(importantSwitch(false)).not.toBeChecked();
        expect(useStore.getState().tasks.find((task) => task.id === "t2")?.title).toBe("Water the plants");

        await act(() => {
            useStore.getState().setImportant("t2", true);
        });

        await waitFor(() => {
            expect(importantSwitch(true)).toBeChecked();
        });

        expect(title.getText()).toBe("Unapplied draft");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ })).toBeDefined();
        expect(screen.queryByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Unapplied draft/ })).toBeNull();
        const otherTask = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Review pull requests/ });
        await fireEvent(otherTask, "activated");
        const otherTitle = await findTitleEntry();
        expect(otherTitle.getText()).toBe("Review pull requests");
    });
});
