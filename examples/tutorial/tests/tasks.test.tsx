import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import { fireEvent, render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { App } from "../src/app.js";
import { useStore } from "../src/store/index.js";

describe("the store", () => {
    it("adds a task and completes it", () => {
        const id = useStore.getState().addTask("personal", "  Call the plumber  ");

        expect(id).not.toBeNull();

        const added = useStore.getState().tasks.find((task) => task.id === id);

        expect(added?.title).toBe("Call the plumber");
        expect(added?.done).toBe(false);

        if (id) useStore.getState().setDone(id, true);

        const completed = useStore.getState().tasks.find((task) => task.id === id);

        expect(completed?.done).toBe(true);
        expect(completed?.completedAt).not.toBeNull();
    });
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

        const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
        await fireEvent(row, "activated");

        expect(await screen.findByText("Notes")).toHaveTextContent("Notes");
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

    it("keeps one color selected when the same swatch is clicked repeatedly", async () => {
        await render(<App />, { container: rootElement });
        useStore.getState().showDialog("new-list");

        const orange = await screen.findByLabelText("Color #e66100");
        await userEvent.click(orange);
        await userEvent.click(orange);

        expect(orange).toHaveObjectProperty("active", true);
        expect(await screen.findByLabelText("Color #3584e4")).toHaveObjectProperty("active", false);
    });
});
