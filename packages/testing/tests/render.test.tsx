import * as Gtk from "@gtkx/ffi/gtk";
import { GtkApplicationWindow, GtkBox, GtkButton } from "@gtkx/react";
import { describe, expect, it } from "vitest";
import { cleanup, render } from "../src/index.js";

describe("render", () => {
    it("renders a simple element", async () => {
        const { findByRole } = await render(<GtkButton label="Click me" />);
        const button = await findByRole(Gtk.AccessibleRole.BUTTON, { name: "Click me" });
        expect(button).toBeDefined();
    });

    it("renders nested elements", async () => {
        const { findByRole, findByText } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkButton label="First" />
                Second
            </GtkBox>,
        );

        const button = await findByRole(Gtk.AccessibleRole.BUTTON, { name: "First" });
        const label = await findByText("Second");

        expect(button).toBeDefined();
        expect(label).toBeDefined();
    });

    it("returns container as the GTK Application", async () => {
        const { container } = await render("Test");
        expect(container).toBeDefined();
        expect(container.getApplicationId()).toMatch(/org\.gtkx\.testing/);
    });

    it("wraps element in ApplicationWindow by default", async () => {
        const { findByRole } = await render(<GtkButton label="Test" />);
        const window = await findByRole(Gtk.AccessibleRole.WINDOW);
        expect(window).toBeDefined();
    });

    it("does not wrap when wrapper is false", async () => {
        const { findByRole } = await render(
            <GtkApplicationWindow>
                <GtkButton label="Test" />
            </GtkApplicationWindow>,
            { wrapper: false },
        );

        const windows = await findByRole(Gtk.AccessibleRole.WINDOW);
        expect(windows).toBeDefined();
    });

    it("uses custom wrapper component", async () => {
        const CustomWrapper = ({ children }: { children: React.ReactNode }) => (
            <GtkApplicationWindow title="Custom Title">{children}</GtkApplicationWindow>
        );

        const { findByRole } = await render(<GtkButton label="Test" />, { wrapper: CustomWrapper });
        const window = await findByRole(Gtk.AccessibleRole.WINDOW, { name: "Custom Title" });
        expect(window).toBeDefined();
    });

    it("provides rerender function to update content", async () => {
        const { findByText, rerender } = await render("Initial");

        await findByText("Initial");
        await rerender("Updated");

        const updatedLabel = await findByText("Updated");
        expect(updatedLabel).toBeDefined();
    });

    it("provides unmount function to remove content", async () => {
        const { container, findByRole, unmount } = await render(<GtkButton label="Test" />);

        await findByRole(Gtk.AccessibleRole.BUTTON, { name: "Test" });
        await unmount();

        const activeWindow = container.getActiveWindow();
        expect(activeWindow).toBeNull();
    });

    it("provides debug function", async () => {
        const { debug } = await render(<GtkButton label="Debug Test" />);
        expect(typeof debug).toBe("function");
    });
});

describe("cleanup", () => {
    it("removes rendered content", async () => {
        const { container } = await render(<GtkButton label="Test" />);
        await cleanup();

        const windows = container.getWindows();
        expect(windows.length).toBe(0);
    });

    it("allows rendering again after cleanup", async () => {
        const { findByText } = await render("First");
        await findByText("First");

        await cleanup();

        const { findByText: findByText2 } = await render("Second");
        const label = await findByText2("Second");
        expect(label).toBeDefined();
    });
});
