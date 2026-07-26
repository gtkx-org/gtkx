import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

describe("marshalling - string array types across the napi boundary", () => {
    it("round-trips a string array through gtk_widget_set_css_classes and get_css_classes", () => {
        const label = Gtk.Label.new("Test");
        label.setCssClasses(["alpha", "beta", "gamma"]);
        expect(label.getCssClasses()).toEqual(["alpha", "beta", "gamma"]);
    });

    it("marshals an empty string array argument", () => {
        const label = Gtk.Label.new("Test");
        label.setCssClasses(["temporary"]);
        label.setCssClasses([]);
        expect(label.getCssClasses()).toEqual([]);
    });

    it("marshals unicode strings inside a string array", () => {
        const label = Gtk.Label.new("Test");
        label.setCssClasses(["café", "naïve", "日本語"]);
        expect(label.getCssClasses()).toEqual(["café", "naïve", "日本語"]);
    });
});
