import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwComboRow, AdwPreferencesGroup } from "@gtkx/jsx/adw";
import {
    GtkAdjustment,
    GtkBox,
    GtkInscription,
    GtkLabel,
    GtkProgressBar,
    GtkScale,
    GtkStringList,
    GtkTextView,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

const expectLabelSelection = async (text: string, range: [number, number], expected: string): Promise<void> => {
    const ref = createRef<Gtk.Label>();
    await render(<GtkLabel ref={ref} label={text} selectable />);
    const label = ref.current as Gtk.Label;
    label.selectRegion(range[0], range[1]);
    expect(label).toHaveSelection(expected);
};

describe("accessible reads beyond the concrete classes", () => {
    it("reads a placeholder from a widget that is not a Gtk.Editable", async () => {
        const ref = createRef<Gtk.TextView>();
        await render(<GtkTextView ref={ref} accessiblePlaceholder="type here" />);
        expect(screen.getByPlaceholderText("type here")).toBe(ref.current);
    });

    it("reads the selection of a selectable label", async () => {
        await expectLabelSelection("hello world", [6, 11], "world");
    });

    it("slices a label selection by code point", async () => {
        await expectLabelSelection("a😀bc", [1, 3], "😀b");
    });

    it("reads the shown option of an Adwaita combo row", async () => {
        const ref = createRef<Adw.ComboRow>();

        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <AdwPreferencesGroup>
                    <AdwComboRow ref={ref} title="Pick" model={<GtkStringList strings={["alpha", "beta"]} />} />
                </AdwPreferencesGroup>
            </GtkBox>,
        );

        expect(screen.getByDisplayValue("alpha")).toBeDefined();
    });
});

describe("indeterminate states match neither boolean", () => {
    it("does not match a mixed pressed toggle as pressed or unpressed", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkToggleButton label="Mixed" accessiblePressed={Gtk.AccessibleTristate.MIXED} />
            </GtkBox>,
        );

        expect(screen.queryAllByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { pressed: false })).toHaveLength(0);
        expect(screen.queryAllByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { pressed: true })).toHaveLength(0);
    });
});

describe("numeric value reads keep full precision", () => {
    it("matches a scale value beyond six significant digits", async () => {
        const ref = createRef<Gtk.Scale>();

        await render(
            <GtkScale ref={ref} adjustment={<GtkAdjustment value={1234.5678} lower={0} upper={10_000} />} />,
        );

        expect(screen.getByRole(Gtk.AccessibleRole.SLIDER, { value: { now: 1234.5678 } })).toBe(ref.current);
        expect(ref.current).toHaveValue(1234.5678);
        expect(ref.current).not.toHaveValue(1234.57);
    });

    it("matches a progress fraction that six digits cannot represent", async () => {
        const ref = createRef<Gtk.ProgressBar>();
        await render(<GtkProgressBar ref={ref} fraction={1 / 3} />);
        expect(ref.current).toHaveValue(1 / 3);
    });
});

describe("inscriptions stay discoverable by text", () => {
    it("finds one whose text came from the text prop, and one from markup", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkInscription text="glyph name" />
                <GtkInscription markup="<b>bold name</b>" />
            </GtkBox>,
        );

        expect(screen.getByText("glyph name", { as: Gtk.Inscription })).toBeDefined();
        expect(screen.getByText("bold name", { as: Gtk.Inscription })).toBeDefined();
    });
});
