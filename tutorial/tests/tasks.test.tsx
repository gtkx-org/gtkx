import * as Adw from "@gtkx/gi/adw";
import { getUserDataDir } from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import { render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applicationId } from "virtual:gtkx-config";
import { describe, expect, it } from "vitest";
import { App } from "../src/app.js";

const openWaterThePlants = async (): Promise<void> => {
    const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
    await userEvent.click(row);
    await screen.findByText("Notes");
};

const findTitleEntry = (): Promise<Adw.EntryRow> =>
    screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /^Title/, as: Adw.EntryRow });

const importantSwitch = (isChecked: boolean): Gtk.Switch =>
    screen.getByRole(Gtk.AccessibleRole.SWITCH, { checked: isChecked, as: Gtk.Switch });

describe("Tasks", () => {
    it("persists text entered through a native row", async () => {
        await render(<App />, { container: rootElement });

        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await userEvent.type(entry, "Buy milk & café");
        await userEvent.keyboard(entry, "{Enter}");

        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Buy milk & café" })).toBeDefined();
        const file = join(getUserDataDir(), applicationId, "tasks.json");
        const saved: unknown = JSON.parse(readFileSync(file, "utf8"));
        expect(saved).toHaveProperty("state.tasks", expect.arrayContaining([
            expect.objectContaining({ title: "Buy milk & café" }),
        ]));
    });

    it("adds a task from the entry row", async () => {
        await render(<App />, { container: rootElement });

        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await userEvent.type(entry, "Book flights");
        await userEvent.keyboard(entry, "{Enter}");

        const [gift, added] = await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM, {
            name: /Order birthday gift|Book flights/,
        });
        expect(gift).toHaveAccessibleName("Order birthday gift");
        expect(added).toHaveAccessibleName("Book flights");
    });

    it.each(["missing", "<b>missing</b>", "missing & < café"])("shows the literal search query %s", async (query) => {
        await render(<App />, { container: rootElement });

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Search (Ctrl+F)" }));
        const search = await screen.findByPlaceholderText("Search tasks…");
        await userEvent.type(search, query);

        expect(await screen.findByText(`No tasks match “${query}”`)).toHaveTextContent(`No tasks match “${query}”`);
    });

    it.each(["Errands & café", "<b>Travel</b>"])("creates a list with the literal name %s", async (title) => {
        await render(<App />, { container: rootElement });

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New List" }));
        const name = await screen.findByPlaceholderText("List name");
        await userEvent.type(name, title);
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Add" }));

        const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: title });
        expect(row).toHaveAccessibleName(title);
        await userEvent.click(row);

        expect(screen.queryByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ })).toBeNull();
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

    it("keeps the Delete key available while editing a task title", async () => {
        await render(<App />, { container: rootElement });

        await openWaterThePlants();
        const title = await findTitleEntry();
        await userEvent.click(title);
        await userEvent.keyboard(title, "{Delete}");

        expect(await screen.findByText("Notes")).toHaveTextContent("Notes");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ })).toBeDefined();
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
        expect(await findTitleEntry()).toHaveTextContent("New Task");
    });

    it("returns to the list when the open task is moved to trash", async () => {
        await render(<App />, { container: rootElement });

        await openWaterThePlants();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete (Delete)" }));

        expect(screen.queryByText("Notes")).toBeNull();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /^Trash/ }));
        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ })).toBeDefined();
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

        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Work" }));
        expect(screen.queryByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Water the plants" })).toBeNull();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "All Tasks" }));
        const returned = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Water the plants" });
        const destination = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Review pull requests" });
        await userEvent.dragAndDrop(returned, destination, "t2");

        const [water, review] = await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM, {
            name: /Water the plants|Review pull requests/,
        });
        expect(water).toHaveAccessibleName("Water the plants");
        expect(review).toHaveAccessibleName("Review pull requests");
    });

    it("reorders the focused task with the keyboard", async () => {
        await render(<App />, { container: rootElement });

        const source = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
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

    it("keeps one color selected when the same swatch is clicked repeatedly", async () => {
        await render(<App />, { container: rootElement });

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New List" }));

        const orange = await screen.findByLabelText("Color #e66100");
        await userEvent.click(orange);
        await userEvent.click(orange);

        expect(orange).toBePressed();
        expect(await screen.findByLabelText("Color #3584e4")).not.toBePressed();
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
        await userEvent.click(updated);
        const reopenedTitle = await findTitleEntry();
        expect(reopenedTitle.getText()).toBe("Water the balcony");
        expect(importantSwitch(false)).not.toBeChecked();
    });
});

describe("task form - edge cases", () => {
    it("rejects a blank title and trims a valid title", async () => {
        await render(<App />, { container: rootElement });
        await openWaterThePlants();
        const title = await findTitleEntry();
        await userEvent.clear(title);
        await userEvent.type(title, " ".repeat(3));
        await userEvent.keyboard(title, "{Enter}");

        expect(title).toBeInvalid();

        await userEvent.type(title, "  Water the balcony  ");
        await userEvent.keyboard(title, "{Enter}");

        expect(title).toHaveTextContent("Water the balcony");
        expect(title).toBeValid();
    });

    it("keeps an unapplied title local while editing importance and another task", async () => {
        await render(<App />, { container: rootElement });
        await openWaterThePlants();
        const title = await findTitleEntry();
        await userEvent.clear(title);
        await userEvent.type(title, "Unapplied draft");
        await userEvent.click(importantSwitch(true));
        expect(title.getText()).toBe("Unapplied draft");
        expect(importantSwitch(false)).not.toBeChecked();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ })).toBeDefined();
        expect(screen.queryByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Unapplied draft/ })).toBeNull();
        const otherTask = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Review pull requests/ });
        await userEvent.click(otherTask);
        const otherTitle = await findTitleEntry();
        expect(otherTitle.getText()).toBe("Review pull requests");
    });
});

describe("literal deletion toasts", () => {
    it.each(["Ordinary task", "<b>Read</b>", "Read & < café"])(
        "deletes and restores the literal task %s",
        async (title) => {
            await render(<App />, { container: rootElement });
            const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
            await userEvent.type(entry, title);
            await userEvent.keyboard(entry, "{Enter}");
            const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: title });
            await userEvent.click(within(row).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete task" }));
            expect(await screen.findByText(`“${title}” moved to Trash`)).toHaveTextContent(`“${title}” moved to Trash`);
            await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Undo" }));
            expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: title })).toHaveAccessibleName(title);
        },
    );
});

describe("manual order after permanent deletion", () => {
    it.each([false, true])("appends after deleting leading tasks (reordered: %s)", async (reordered) => {
        await render(<App />, { container: rootElement });
        if (reordered) {
            const source = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Order birthday gift" });
            const target = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Review pull requests" });
            await userEvent.dragAndDrop(source, target, "t6");
        }
        for (const title of ["Welcome to Tasks", "Water the plants"]) {
            const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: title });
            await userEvent.click(within(row).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete task" }));
        }
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /^Trash/ }));
        for (const title of ["Welcome to Tasks", "Water the plants"]) {
            const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: title });
            await userEvent.click(within(row).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete task" }));
            await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete" }));
        }
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /^All Tasks/ }));
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await userEvent.type(entry, "Newly appended task");
        await userEvent.keyboard(entry, "{Enter}");
        const lastSurvivor = reordered ? "Buy oat milk" : "Order birthday gift";
        const [survivor, added] = await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM, {
            name: (name) => name === lastSurvivor || name === "Newly appended task",
        });
        expect(survivor).toHaveAccessibleName(lastSurvivor);
        expect(added).toHaveAccessibleName("Newly appended task");
    });

    it("starts a new manual list after every task was permanently deleted", async () => {
        await render(<App />, { container: rootElement });
        const titles = [
            "Welcome to Tasks",
            "Water the plants",
            "Prepare the weekly report",
            "Review pull requests",
            "Buy oat milk",
            "Order birthday gift",
        ];
        for (const title of titles) {
            const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: title });
            await userEvent.click(within(row).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete task" }));
        }
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /^Trash/ }));
        for (const title of titles) {
            const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: title });
            await userEvent.click(within(row).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete task" }));
            await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete" }));
        }
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /^All Tasks/ }));
        expect(await screen.findByText("No Tasks Yet")).toHaveTextContent("No Tasks Yet");
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        for (const title of ["First new task", "Second new task"]) {
            await userEvent.type(entry, title);
            await userEvent.keyboard(entry, "{Enter}");
        }
        const [first, second] = await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM, {
            name: /First new task|Second new task/,
        });
        expect(first).toHaveAccessibleName("First new task");
        expect(second).toHaveAccessibleName("Second new task");
    });
});
