import * as Gtk from "@gtkx/gi/gtk";
import { AdwToggle, AdwToggleGroup } from "@gtkx/jsx/adw";
import { GtkAdjustment, GtkButton, GtkCheckButton, GtkEntry, GtkScale, GtkToggleButton } from "@gtkx/jsx/gtk";
import { describe, expect, it } from "vitest";
import { render, screen } from "../src/index.js";
import { expectRejection, renderLabel } from "./widget-fixtures.js";

describe("jest-dom-style text matchers", () => {
    it("toHaveTextContent matches a label's visible text", async () => {
        const label = await renderLabel("Hello world");
        expect(label).toHaveTextContent("Hello");
        expect(label).toHaveTextContent(/world/);
        expect(label).not.toHaveTextContent("goodbye");
    });

    it("toHaveTextContent collapses whitespace by default", async () => {
        const label = await renderLabel("  Hello \n\t world  ", "Hello world");
        expect(label).toHaveTextContent("Hello world");
    });

    it("toHaveTextContent keeps the raw whitespace when normalization is off", async () => {
        const label = await renderLabel("  Hello \n\t world  ", "Hello world");
        expect(label).not.toHaveTextContent("Hello world", { normalizeWhitespace: false });
        expect(label).toHaveTextContent("Hello \n\t world", { normalizeWhitespace: false });
    });

    it("toHaveTextContent turns a non-breaking space into a regular one either way", async () => {
        const label = await renderLabel("Hello\u{A0}world", "Hello world");
        expect(label).toHaveTextContent("Hello world");
        expect(label).toHaveTextContent("Hello world", { normalizeWhitespace: false });
    });

    it("toHaveAccessibleName matches a button's accessible name", async () => {
        await render(<GtkButton label="Save" />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" });
        expect(button).toHaveAccessibleName("Save");
        expect(button).not.toHaveAccessibleName("Cancel");
    });

    it("toHaveDisplayValue and toHavePlaceholderText read an entry", async () => {
        await render(<GtkEntry text="typed value" placeholderText="type here" />);
        const entry = await screen.findByDisplayValue("typed value");
        expect(entry).toHaveDisplayValue("typed value");
        expect(entry).toHaveDisplayValue(/typed/);
        expect(entry).toHavePlaceholderText("type here");
        expect(entry).not.toHaveDisplayValue("other");
    });
});

describe("jest-dom-style state and value matchers", () => {
    it("toBeChecked reflects a check button's active state", async () => {
        await render(<GtkCheckButton label="Accept" active={true} />);
        const check = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Accept" });
        expect(check).toBeChecked();
    });

    it("toBeChecked is negatable for an inactive check button", async () => {
        await render(<GtkCheckButton label="Accept" active={false} />);
        const check = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Accept" });
        expect(check).not.toBeChecked();
    });

    it("toBeChecked works for a RADIO-role toggle in an Adw toggle group", async () => {
        await render(
            <AdwToggleGroup>
                <AdwToggle name="list" label="List" />
                <AdwToggle name="grid" label="Grid" />
            </AdwToggleGroup>,
        );

        const list = await screen.findByRole(Gtk.AccessibleRole.RADIO, { name: "List" });
        const grid = await screen.findByRole(Gtk.AccessibleRole.RADIO, { name: "Grid" });
        expect(list).toBeChecked();
        expect(grid).not.toBeChecked();
    });

    it("toBePressed reflects a toggle button's active state", async () => {
        await render(<GtkToggleButton label="Bold" active={true} />);
        const toggle = await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "Bold" });
        expect(toggle).toBePressed();
    });

    it("toHaveValue reads a scale's current value", async () => {
        await render(<GtkScale adjustment={<GtkAdjustment value={42} lower={0} upper={100} />} />);
        const slider = await screen.findByRole(Gtk.AccessibleRole.SLIDER);
        expect(slider).toHaveValue(42);
        expect(slider).not.toHaveValue(43);
    });

    it("throws for a boolean state matcher on a widget without that state", async () => {
        const label = await renderLabel("plain");

        expectRejection(() => {
            expect(label).toBeChecked();
        }, /does not expose a checked state/);
    });
});
