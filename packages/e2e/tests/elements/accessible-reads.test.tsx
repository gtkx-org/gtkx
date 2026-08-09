import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwComboRow, AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkBox, GtkLabel, GtkStringList, GtkTextView } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("accessible reads beyond the concrete classes", () => {
    it("reads a placeholder from a widget that is not a Gtk.Editable", async () => {
        const ref = createRef<Gtk.TextView>();
        await render(<GtkTextView ref={ref} accessiblePlaceholder="type here" />);
        expect(screen.getByPlaceholderText("type here")).toBe(ref.current);
    });

    it("reads the selection of a selectable label", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref} label="hello world" selectable />);
        const label = ref.current as Gtk.Label;
        label.selectRegion(6, 11);
        expect(label).toHaveSelection("world");
    });

    it("slices a label selection by code point", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref} label="a😀bc" selectable />);
        const label = ref.current as Gtk.Label;
        label.selectRegion(1, 3);
        expect(label).toHaveSelection("😀b");
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
