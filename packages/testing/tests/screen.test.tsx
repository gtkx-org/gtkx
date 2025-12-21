import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkLabel } from "@gtkx/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "../src/index.js";

afterEach(async () => {
    await cleanup();
});

describe("screen", () => {
    it("finds element by role", async () => {
        await render(<GtkButton label="Test" />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
        expect(button).toBeDefined();
    });

    it("finds element by text", async () => {
        await render(<GtkLabel label="Hello World" />);
        const label = await screen.findByText("Hello World");
        expect(label).toBeDefined();
    });

    it("finds element by label text", async () => {
        await render(<GtkButton label="Click Me" />);
        const button = await screen.findByLabelText("Click Me");
        expect(button).toBeDefined();
    });

    it("finds element by test id", async () => {
        await render(<GtkEntry name="my-input" />);
        const entry = await screen.findByTestId("my-input");
        expect(entry).toBeDefined();
    });

    it("finds all elements by role", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkButton label="First" />
                <GtkButton label="Second" />
                <GtkButton label="Third" />
            </GtkBox>,
        );

        const buttons = await screen.findAllByRole(Gtk.AccessibleRole.BUTTON);
        expect(buttons.length).toBe(3);
    });

    it("finds all elements by text", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkLabel label="Item" />
                <GtkLabel label="Item" />
            </GtkBox>,
        );

        const labels = await screen.findAllByText("Item");
        expect(labels.length).toBe(2);
    });

    it("finds all elements by label text", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkButton label="Action" />
                <GtkButton label="Action" />
            </GtkBox>,
        );

        const buttons = await screen.findAllByLabelText("Action");
        expect(buttons.length).toBe(2);
    });

    it("finds all elements by test id", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkEntry name="field" />
                <GtkEntry name="field" />
            </GtkBox>,
        );

        const entries = await screen.findAllByTestId("field");
        expect(entries.length).toBe(2);
    });

    describe("error handling", () => {
        it("throws when no render has been performed", async () => {
            await cleanup();
            expect(() => screen.findByRole(Gtk.AccessibleRole.BUTTON, { timeout: 100 })).toThrow(
                "No render has been performed",
            );
        });
    });
});
