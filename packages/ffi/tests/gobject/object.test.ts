import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it, vi } from "vitest";
import "@gtkx/gi/gobject";

describe("Object.setProperty / getProperty auto-marshalling", () => {
    it("round-trips a string property through pspec lookup", () => {
        const label = new Gtk.Label({ label: "" });
        label.setProperty("label", "hello");
        expect(label.getProperty("label")).toBe("hello");
    });

    it("round-trips a boolean property", () => {
        const button = new Gtk.Button();
        button.setProperty("sensitive", false);
        expect(button.getProperty("sensitive")).toBe(false);
        button.setProperty("sensitive", true);
        expect(button.getProperty("sensitive")).toBe(true);
    });

    it("round-trips an enum property as its integer payload", () => {
        const button = new Gtk.Button();
        button.setProperty("halign", Gtk.Align.CENTER);
        expect(button.getProperty("halign")).toBe(Gtk.Align.CENTER);
    });

    it("round-trips an integer property", () => {
        const scale = new Gtk.Scale();
        scale.setProperty("width-request", 240);
        expect(scale.getProperty("width-request")).toBe(240);
    });

    it("round-trips a double property", () => {
        const adjustment = Gtk.Adjustment.new(0, 0, 1, 0.1, 0.1, 0);
        adjustment.setProperty("value", 0.75);
        expect(adjustment.getProperty("value") as number).toBeCloseTo(0.75);
    });

    it("preserves null when reading a string property that is unset", () => {
        const button = new Gtk.Button();
        const result = button.getProperty("label");
        expect(result === null || result === "").toBe(true);
    });

    it("returns a wrapper instance for boxed properties via class registry", () => {
        const window = new Gtk.Window();
        const settings = window.getProperty("display");
        expect(settings).toBeInstanceOf(Gdk.Display);
    });

    it("throws when getting an unknown property", () => {
        const button = new Gtk.Button();
        expect(() => button.getProperty("does-not-exist")).toThrow(/No property 'does-not-exist'/);
    });

    it("throws when setting an unknown property", () => {
        const button = new Gtk.Button();
        expect(() => button.setProperty("does-not-exist", 1)).toThrow(/No property 'does-not-exist'/);
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
        expect(() => (button as unknown as { emit(s: string): unknown }).emit("not-a-real-signal")).toThrow(
            /Unknown signal 'not-a-real-signal'/,
        );
    });
});
