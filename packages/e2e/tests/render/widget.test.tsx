import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkImage, GtkLabel } from "@gtkx/react";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - widget creation", () => {
    describe("basic widgets", () => {
        it("creates Label widget with text", async () => {
            await render(<GtkLabel label="Hello World" />);

            const label = await screen.findByText("Hello World");
            expect(label).toBeDefined();
        });

        it("creates Button widget with label", async () => {
            await render(<GtkButton label="Click Me" />);

            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Click Me" });
            expect(button).toBeDefined();
        });

        it("creates Box widget with orientation", async () => {
            const ref = createRef<Gtk.Box>();

            await render(<GtkBox ref={ref} orientation={Gtk.Orientation.VERTICAL} />);

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        });

        it("creates Entry widget", async () => {
            await render(<GtkEntry placeholderText="Enter text" />);

            const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
            expect(entry).toBeDefined();
        });

        it("creates Image widget", async () => {
            const ref = createRef<Gtk.Image>();

            await render(<GtkImage ref={ref} iconName="dialog-information" />);

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getIconName()).toBe("dialog-information");
        });
    });

    describe("constructor parameters", () => {
        it("passes constructor parameters from props", async () => {
            const ref = createRef<Gtk.Box>();

            await render(<GtkBox ref={ref} spacing={10} />);

            expect(ref.current?.getSpacing()).toBe(10);
        });

        it("handles widgets with no constructor parameters", async () => {
            const ref = createRef<Gtk.Button>();

            await render(<GtkButton ref={ref} />);

            expect(ref.current).not.toBeNull();
        });

        it("handles widgets with optional constructor parameters", async () => {
            const ref = createRef<Gtk.Label>();

            await render(<GtkLabel ref={ref} />);

            expect(ref.current).not.toBeNull();
        });
    });

    describe("ref access", () => {
        it("provides GTK widget via ref", async () => {
            const ref = createRef<Gtk.Label>();

            await render(<GtkLabel ref={ref} label="Test" />);

            expect(ref.current).not.toBeNull();
            expect(typeof ref.current?.getLabel).toBe("function");
        });

        it("ref.current is the actual GTK widget instance", async () => {
            const ref = createRef<Gtk.Label>();

            await render(<GtkLabel ref={ref} label="Widget Instance" />);

            expect(ref.current?.handle).toBeDefined();
            expect(ref.current?.getLabel()).toBe("Widget Instance");
        });
    });

    describe("screen queries", () => {
        it("finds multiple buttons by role", async () => {
            await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkButton label="First" />
                    <GtkButton label="Second" />
                    <GtkButton label="Third" />
                </GtkBox>,
            );

            const buttons = await screen.findAllByRole(Gtk.AccessibleRole.BUTTON);
            expect(buttons).toHaveLength(3);
        });

        it("finds button by name filter", async () => {
            await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkButton label="Submit" />
                    <GtkButton label="Cancel" />
                </GtkBox>,
            );

            const submitButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Submit" });
            expect(submitButton).toBeDefined();

            const cancelButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Cancel" });
            expect(cancelButton).toBeDefined();
        });

        it("returns null for non-existent widget with queryBy", async () => {
            await render(<GtkButton label="Only Button" />);

            const nonExistent = screen.queryByRole(Gtk.AccessibleRole.TEXT_BOX);
            expect(nonExistent).toBeNull();
        });

        it("finds widgets by text content", async () => {
            await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkLabel label="Welcome Message" />
                    <GtkLabel label="Description Text" />
                </GtkBox>,
            );

            const welcome = await screen.findByText("Welcome Message");
            expect(welcome).toBeDefined();

            const allLabels = await screen.findAllByText(/Message|Text/);
            expect(allLabels).toHaveLength(2);
        });

        it("uses regex for partial text matching", async () => {
            await render(<GtkLabel label="Error: Something went wrong" />);

            const errorLabel = await screen.findByText(/^Error:/);
            expect(errorLabel).toBeDefined();
        });
    });
});
