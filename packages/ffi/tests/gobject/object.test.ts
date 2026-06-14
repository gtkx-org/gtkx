import { getGobjectProperty, setGobjectProperty, t } from "@gtkx/ffi";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it, vi } from "vitest";
import "@gtkx/gi/gobject";

describe("getGobjectProperty / setGobjectProperty auto-marshalling", () => {
    it("round-trips a string property", () => {
        const label = new Gtk.Label({ label: "" });
        setGobjectProperty(label, "label", t.string("borrowed"), "hello");
        expect(getGobjectProperty(label, "label", t.string("borrowed"))).toBe("hello");
    });

    it("round-trips a boolean property", () => {
        const button = new Gtk.Button();
        setGobjectProperty(button, "sensitive", t.boolean, false);
        expect(getGobjectProperty(button, "sensitive", t.boolean)).toBe(false);
        setGobjectProperty(button, "sensitive", t.boolean, true);
        expect(getGobjectProperty(button, "sensitive", t.boolean)).toBe(true);
    });

    it("round-trips an integer property", () => {
        const scale = new Gtk.Scale();
        setGobjectProperty(scale, "width-request", t.int32, 240);
        expect(getGobjectProperty(scale, "width-request", t.int32)).toBe(240);
    });

    it("round-trips a double property", () => {
        const adjustment = Gtk.Adjustment.new(0, 0, 1, 0.1, 0.1, 0);
        setGobjectProperty(adjustment, "value", t.float64, 0.75);
        expect(getGobjectProperty(adjustment, "value", t.float64) as number).toBeCloseTo(0.75);
    });

    it("preserves null when reading a string property that is unset", () => {
        const button = new Gtk.Button();
        const result = getGobjectProperty(button, "label", t.string("borrowed"));
        expect(result === null || result === "").toBe(true);
    });

    it("returns a wrapper instance for object properties via the class registry", () => {
        const window = new Gtk.Window();
        expect(getGobjectProperty(window, "display", t.object("borrowed"))).toBeInstanceOf(Gdk.Display);
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

describe("Object.emit() typed signal emission — basic dispatch", () => {
    it("emits a void signal with no arguments and invokes connected handlers", () => {
        const button = new Gtk.Button();
        const handler = vi.fn();
        button.on("clicked", handler);

        button.emit("clicked");

        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith();
    });

    it("emits a signal with primitive arguments and forwards them to the handler", () => {
        const window = new Gtk.Window();
        const handler = vi.fn();
        window.on("enable-debugging", handler);

        window.emit("enable-debugging", true);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith(true);
    });

    it("returns undefined from any signal emission", () => {
        const button = new Gtk.Button();
        button.on("clicked", () => {});

        const result = button.emit("clicked");

        expect(result).toBeUndefined();
    });
});

describe("Object.emit() typed signal emission — inheritance and errors", () => {
    it("emits an inherited signal via super.emit fallthrough", () => {
        const button = new Gtk.Button();
        const handler = vi.fn();
        button.on("destroy", handler);

        button.emit("destroy");

        expect(handler).toHaveBeenCalledOnce();
    });

    it("emits a signal with a GObject argument", () => {
        const listBox = new Gtk.ListBox();
        const row = new Gtk.ListBoxRow();
        listBox.append(row);
        const handler = vi.fn();
        listBox.on("row-activated", handler);

        listBox.emit("row-activated", row);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith(row);
    });

    it("throws on an unknown signal at the GObject root", () => {
        const button = new Gtk.Button();
        expect(() => button.emit("not-a-real-signal")).toThrow(/Unknown signal 'not-a-real-signal'/);
    });
});
