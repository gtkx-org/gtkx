import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { getProperty, setProperty, t } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import "@gtkx/gi/gobject";

describe("getProperty / setProperty auto-marshalling", () => {
    it("round-trips a string property", () => {
        const label = new Gtk.Label({ label: "" });
        setProperty(label, "label", t.string("borrowed"), "hello");
        expect(getProperty(label, "label", t.string("borrowed"))).toBe("hello");
    });

    it("round-trips a boolean property", () => {
        const button = new Gtk.Button();
        setProperty(button, "sensitive", t.boolean, false);
        expect(getProperty(button, "sensitive", t.boolean)).toBe(false);
        setProperty(button, "sensitive", t.boolean, true);
        expect(getProperty(button, "sensitive", t.boolean)).toBe(true);
    });

    it("round-trips an integer property", () => {
        const scale = new Gtk.Scale();
        setProperty(scale, "width-request", t.int32, 240);
        expect(getProperty(scale, "width-request", t.int32)).toBe(240);
    });

    it("round-trips a double property", () => {
        const adjustment = Gtk.Adjustment.new(0, 0, 1, 0.1, 0.1, 0);
        setProperty(adjustment, "value", t.float64, 0.75);
        expect(getProperty(adjustment, "value", t.float64) as number).toBeCloseTo(0.75);
    });

    it("preserves null when reading a string property that is unset", () => {
        const button = new Gtk.Button();
        expect(getProperty(button, "label", t.string("borrowed"))).toBeNull();
    });

    it("returns a wrapper instance for object properties via the class registry", () => {
        const window = new Gtk.Window();
        expect(getProperty(window, "display", t.object("borrowed"))).toBe(Gdk.Display.getDefault());
    });
});

describe("generated property accessors route through the static GValue path", () => {
    it("round-trips an integer property that has no typed C accessor", () => {
        const window = new Gtk.Window();
        window.widthRequest = 240;
        expect(window.widthRequest).toBe(240);
    });

    it("reads an object property that has no typed C accessor", () => {
        expect(new Gtk.Window().display).toBe(Gdk.Display.getDefault());
    });
});
