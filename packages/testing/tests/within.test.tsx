import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkFrame, GtkLabel } from "@gtkx/react";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "../src/index.js";

describe("within", () => {
    it("scopes queries to container element", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkFrame name="section-a" label="Section A">
                    <GtkButton label="Submit" />
                </GtkFrame>
                <GtkFrame name="section-b" label="Section B">
                    <GtkButton label="Cancel" />
                </GtkFrame>
            </GtkBox>,
        );

        const sectionA = await screen.findByTestId("section-a");
        const { findByRole } = within(sectionA);

        const submitButton = await findByRole(Gtk.AccessibleRole.BUTTON);
        expect(submitButton).toBeDefined();
    });

    it("does not find elements outside container", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkFrame name="inner-frame" label="Inner">
                    Inside
                </GtkFrame>
                Outside
            </GtkBox>,
        );

        const frame = await screen.findByTestId("inner-frame");
        const { findByText } = within(frame);

        await expect(findByText("Outside", { timeout: 100 })).rejects.toThrow("Unable to find");
    });

    it("provides findByRole query", async () => {
        await render(
            <GtkFrame name="container">
                <GtkButton label="Test" />
            </GtkFrame>,
        );

        const frame = await screen.findByTestId("container");
        const { findByRole } = within(frame);
        const button = await findByRole(Gtk.AccessibleRole.BUTTON);
        expect(button).toBeDefined();
    });

    it("provides findByText query", async () => {
        await render(<GtkFrame name="container">Hello World</GtkFrame>);

        const frame = await screen.findByTestId("container");
        const { findByText } = within(frame);
        const label = await findByText("Hello World");
        expect(label).toBeDefined();
    });

    it("provides findByLabelText query", async () => {
        const entryRef = { current: null as Gtk.Entry | null };
        const LabelledEntry = () => (
            <GtkFrame name="container">
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkLabel label="Action" mnemonicWidget={entryRef.current} />
                    <GtkEntry
                        ref={(el) => {
                            entryRef.current = el;
                        }}
                    />
                </GtkBox>
            </GtkFrame>
        );

        const { rerender } = await render(<LabelledEntry />);
        await rerender(<LabelledEntry />);

        const frame = await screen.findByTestId("container");
        const { findByLabelText } = within(frame);
        const entry = await findByLabelText("Action");
        expect(entry).toBeDefined();
    });

    it("provides findByTestId query", async () => {
        await render(
            <GtkFrame name="container">
                <GtkEntry name="my-input" />
            </GtkFrame>,
        );

        const frame = await screen.findByTestId("container");
        const { findByTestId } = within(frame);
        const entry = await findByTestId("my-input");
        expect(entry).toBeDefined();
    });

    it("provides findAllByRole query", async () => {
        await render(
            <GtkFrame name="container">
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkButton label="First" />
                    <GtkButton label="Second" />
                </GtkBox>
            </GtkFrame>,
        );

        const frame = await screen.findByTestId("container");
        const { findAllByRole } = within(frame);
        const buttons = await findAllByRole(Gtk.AccessibleRole.BUTTON);
        expect(buttons.length).toBe(2);
    });

    it("provides findAllByText query", async () => {
        await render(
            <GtkFrame name="container">
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkButton label="Item" />
                    <GtkButton label="Item" />
                </GtkBox>
            </GtkFrame>,
        );

        const frame = await screen.findByTestId("container");
        const { findAllByText } = within(frame);
        const buttons = await findAllByText("Item");
        expect(buttons.length).toBe(2);
    });

    it("provides findAllByLabelText query", async () => {
        const ref1 = { current: null as Gtk.Entry | null };
        const ref2 = { current: null as Gtk.Entry | null };
        const LabelledEntries = () => (
            <GtkFrame name="container">
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
            </GtkFrame>
        );

        const { rerender } = await render(<LabelledEntries />);
        await rerender(<LabelledEntries />);

        const frame = await screen.findByTestId("container");
        const { findAllByLabelText } = within(frame);
        const entries = await findAllByLabelText("Action");
        expect(entries.length).toBe(2);
    });

    it("provides findAllByTestId query", async () => {
        await render(
            <GtkFrame name="container">
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkEntry name="field" />
                    <GtkEntry name="field" />
                </GtkBox>
            </GtkFrame>,
        );

        const frame = await screen.findByTestId("container");
        const { findAllByTestId } = within(frame);
        const entries = await findAllByTestId("field");
        expect(entries.length).toBe(2);
    });

    it("supports nested within calls", async () => {
        await render(
            <GtkFrame name="outer-frame">
                <GtkFrame name="inner-frame">
                    <GtkButton label="Deep" />
                </GtkFrame>
            </GtkFrame>,
        );

        const outer = await screen.findByTestId("outer-frame");
        const { findByTestId: findInOuter } = within(outer);
        const inner = await findInOuter("inner-frame");
        const { findByRole } = within(inner);
        const button = await findByRole(Gtk.AccessibleRole.BUTTON);
        expect(button).toBeDefined();
    });
});
