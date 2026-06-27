import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

describe("marshalling - floating point types across the napi boundary", () => {
    it("round-trips a 32-bit float through gtk_label_set_xalign", () => {
        const label = Gtk.Label.new("Test");

        label.setXalign(0.25);

        expect(label.getXalign()).toBeCloseTo(0.25);
    });

    it("round-trips a 64-bit float through gtk_widget_set_opacity", () => {
        const label = Gtk.Label.new("Test");

        label.setOpacity(0.123456789);

        expect(label.getOpacity()).toBeCloseTo(0.123456789);
    });
});
