import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkLabel } from "@gtkx/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "../src/index.js";

describe("screen", () => {
    it("finds element by role", async () => {
        await render(<GtkButton label="Test" />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Test" });
        expect(button).toBeDefined();
    });

    it("finds element by text", async () => {
        await render("Hello World");
        const label = await screen.findByText("Hello World");
        expect(label).toBeDefined();
    });

    it("finds element by label text", async () => {
        const entryRef = { current: null as Gtk.Entry | null };
        const LabelledEntry = (): ReactNode => (
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkLabel label="Click Me" mnemonicWidget={entryRef.current} />
                <GtkEntry
                    ref={(el) => {
                        entryRef.current = el;
                    }}
                />
            </GtkBox>
        );

        const { rerender } = await render(<LabelledEntry />);
        await rerender(<LabelledEntry />);

        const entry = await screen.findByLabelText("Click Me");
        expect(entry).toBeDefined();
        expect(entry.getAccessibleRole()).toBe(Gtk.AccessibleRole.TEXT_BOX);
    });

    it("finds element by test id", async () => {
        await render(<GtkEntry name="my-input" />);
        const entry = await screen.findByTestId("my-input");
        expect(entry).toBeDefined();
    });

    it("finds all elements by role", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="First" />
                <GtkButton label="Second" />
                <GtkButton label="Third" />
            </GtkBox>,
        );

        const buttons = await screen.findAllByRole(Gtk.AccessibleRole.BUTTON, { name: /First|Second|Third/ });
        expect(buttons.length).toBe(3);
    });

    it("finds all elements by text", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="Item" />
                <GtkButton label="Item" />
            </GtkBox>,
        );

        const buttons = await screen.findAllByText("Item");
        expect(buttons.length).toBe(2);
    });

    it("finds all elements by label text", async () => {
        const ref1 = { current: null as Gtk.Entry | null };
        const ref2 = { current: null as Gtk.Entry | null };
        const LabelledEntries = (): ReactNode => (
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkLabel label="Action" mnemonicWidget={ref1.current} />
                <GtkEntry
                    ref={(el) => {
                        ref1.current = el;
                    }}
                />
                <GtkLabel label="Action" mnemonicWidget={ref2.current} />
                <GtkEntry
                    ref={(el) => {
                        ref2.current = el;
                    }}
                />
            </GtkBox>
        );

        const { rerender } = await render(<LabelledEntries />);
        await rerender(<LabelledEntries />);

        const entries = await screen.findAllByLabelText("Action");
        expect(entries.length).toBe(2);
    });

    it("finds all elements by test id", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
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
