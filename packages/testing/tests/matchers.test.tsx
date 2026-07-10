import * as Gtk from "@gtkx/gi/gtk";
import { AdwToggle, AdwToggleGroup } from "@gtkx/jsx/adw";
import { GtkAdjustment, GtkButton, GtkCheckButton, GtkEntry, GtkLabel, GtkScale, GtkToggleButton } from "@gtkx/jsx/gtk";
import { describe, expect, it } from "vitest";
import { render, screen } from "../src/index.js";

describe("jest-dom-style matchers", () => {
    it("toHaveTextContent matches a label's visible text", async () => {
        await render(<GtkLabel label="Hello world" />);
        const label = await screen.findByText("Hello world");
        expect(label).toHaveTextContent("Hello");
        expect(label).toHaveTextContent(/world/);
        expect(label).not.toHaveTextContent("goodbye");
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
        await render(<GtkLabel label="plain" />);
        const label = await screen.findByText("plain");
        expect(() => expect(label).toBeChecked()).toThrow(/does not expose a checked state/);
    });
});
