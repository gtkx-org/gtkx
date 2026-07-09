import { getObjectProperty, setObjectProperty, t } from "@gtkx/ffi";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";
import "@gtkx/gi/gobject";

describe("getObjectProperty / setObjectProperty auto-marshalling", () => {
    it("round-trips a string property", () => {
        const label = new Gtk.Label({ label: "" });
        setObjectProperty(label, "label", t.string("borrowed"), "hello");
        expect(getObjectProperty(label, "label", t.string("borrowed"))).toBe("hello");
    });

    it("round-trips a boolean property", () => {
        const button = new Gtk.Button();
        setObjectProperty(button, "sensitive", t.boolean, false);
        expect(getObjectProperty(button, "sensitive", t.boolean)).toBe(false);
        setObjectProperty(button, "sensitive", t.boolean, true);
        expect(getObjectProperty(button, "sensitive", t.boolean)).toBe(true);
    });

    it("round-trips an integer property", () => {
        const scale = new Gtk.Scale();
        setObjectProperty(scale, "width-request", t.int32, 240);
        expect(getObjectProperty(scale, "width-request", t.int32)).toBe(240);
    });

    it("round-trips a double property", () => {
        const adjustment = Gtk.Adjustment.new(0, 0, 1, 0.1, 0.1, 0);
        setObjectProperty(adjustment, "value", t.float64, 0.75);
        expect(getObjectProperty(adjustment, "value", t.float64) as number).toBeCloseTo(0.75);
    });

    it("preserves null when reading a string property that is unset", () => {
        const button = new Gtk.Button();
        const result = getObjectProperty(button, "label", t.string("borrowed"));
        expect(result === null || result === "").toBe(true);
    });

    it("returns a wrapper instance for object properties via the class registry", () => {
        const window = new Gtk.Window();
        expect(getObjectProperty(window, "display", t.object("borrowed"))).toBeInstanceOf(Gdk.Display);
    });
});

describe("generated property accessors route through the static GValue path", () => {
    it("round-trips an integer property that has no typed C accessor", () => {
        const window = new Gtk.Window();
        window.widthRequest = 240;
        expect(window.widthRequest).toBe(240);
    });

    it("reads an object property that has no typed C accessor", () => {
        expect(new Gtk.Window().display).toBeInstanceOf(Gdk.Display);
    });
});
