import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwApplication } from "@gtkx/jsx/adw";
import { rootElement } from "@gtkx/react";
import { act, fireEvent, render, screen, userEvent } from "@gtkx/testing";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { App } from "../src/app.js";
import { Window } from "../src/components/window.js";
import { ALL_TASKS, type OpenTaskRequest } from "../src/navigation.js";
import { useStore } from "../src/store/index.js";

const openWaterThePlants = async (): Promise<void> => {
    const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
    await fireEvent(row, "activated");
    await screen.findByText("Notes");
};

const activateOpenTask = async (id: string): Promise<void> => {
    const application = Gio.Application.getDefault();
    if (application === null) throw new Error("the application did not mount");

    await act(() => {
        application.activateAction("open-task", GLib.Variant.newString(id));
    });
};

const ApplicationWithPendingOpenTask = ({ id }: { id: string }) => {
    const [request, setRequest] = useState<OpenTaskRequest | null>({ selection: ALL_TASKS, id });

    return (
        <AdwApplication>
            <Window
                openTaskRequest={request}
                onOpenTaskRequest={setRequest}
                onOpenTaskRequestHandled={(handled) => {
                    setRequest((current) => (current === handled ? null : current));
                }}
            />
        </AdwApplication>
    );
};

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

        await openWaterThePlants();

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

    it("returns to Trash when the open task is deleted permanently", async () => {
        await render(<App />, { container: rootElement });

        await openWaterThePlants();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete (Delete)" }));
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /^Trash/ }));
        await openWaterThePlants();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete (Delete)" }));
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete" }));

        expect(screen.queryByText("Notes")).toBeNull();
        expect(useStore.getState().tasks.some((task) => task.id === "t2")).toBe(false);
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

describe("external task actions", () => {
    it("opens a task when navigation is already ready", async () => {
        await render(<App />, { container: rootElement });

        await activateOpenTask("t2");

        expect(await screen.findByText("Notes")).toHaveTextContent("Notes");
    });

    it("opens a pending task after cold-start navigation becomes ready", async () => {
        await render(<ApplicationWithPendingOpenTask id="t2" />, { container: rootElement });

        expect(await screen.findByText("Notes")).toHaveTextContent("Notes");
    });

    it("ignores actions for missing or deleted tasks", async () => {
        await render(<App />, { container: rootElement });

        await activateOpenTask("missing-task");

        expect(screen.queryByText("Notes")).toBeNull();

        await act(() => {
            useStore.getState().moveToTrash("t2");
        });
        await activateOpenTask("t2");

        expect(screen.queryByText("Notes")).toBeNull();

        await activateOpenTask("t1");

        expect(await screen.findByText("Notes")).toHaveTextContent("Notes");
    });
});
