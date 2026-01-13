import { describe, expect, it } from "vitest";
import * as Gdk from "../../src/generated/gdk/index.js";
import * as Gtk from "../../src/generated/gtk/index.js";
import { getNativeObject } from "../../src/index.js";

describe("getNativeObject", () => {
    it("wraps a native pointer in a class instance", () => {
        const label = new Gtk.Label("Test");
        const wrapped = getNativeObject(label.handle);
        expect(wrapped).toBeInstanceOf(Gtk.Label);
    });

    it("determines correct runtime type via GLib type system", () => {
        const button = new Gtk.Button();
        const wrapped = getNativeObject(button.handle);
        expect(wrapped).toBeInstanceOf(Gtk.Button);
    });

    it("wraps with specific type when targetType is provided", () => {
        const box = new Gtk.Box();
        const wrapped = getNativeObject(box.handle, Gtk.Box);
        expect(wrapped).toBeInstanceOf(Gtk.Box);
    });

    describe("null handling", () => {
        it("returns null when id is null", () => {
            const result = getNativeObject(null);
            expect(result).toBeNull();
        });

        it("returns null when id is undefined", () => {
            const result = getNativeObject(undefined);
            expect(result).toBeNull();
        });
    });

    describe("boxed types", () => {
        it("wraps a native boxed type pointer in a class instance", () => {
            const rgba = new Gdk.RGBA({ red: 1.0, green: 0.5, blue: 0.0, alpha: 1.0 });
            const wrapped = getNativeObject(rgba.handle, Gdk.RGBA);
            expect(wrapped).not.toBeNull();
            expect(wrapped?.red).toBeCloseTo(1.0);
            expect(wrapped?.green).toBeCloseTo(0.5);
            expect(wrapped?.blue).toBeCloseTo(0.0);
            expect(wrapped?.alpha).toBeCloseTo(1.0);
        });

        it("sets the correct prototype chain", () => {
            const rgba = new Gdk.RGBA({ red: 0.5 });
            const wrapped = getNativeObject(rgba.handle, Gdk.RGBA);
            expect(wrapped).not.toBeNull();
            expect(typeof wrapped?.toString).toBe("function");
            expect(typeof wrapped?.copy).toBe("function");
        });

        it("returns null when id is null for boxed types", () => {
            const result = getNativeObject(null, Gdk.RGBA);
            expect(result).toBeNull();
        });

        it("returns null when id is undefined for boxed types", () => {
            const result = getNativeObject(undefined, Gdk.RGBA);
            expect(result).toBeNull();
        });
    });

    describe("interfaces", () => {
        it("returns interface instance when object implements it", () => {
            const box = new Gtk.Box();
            const orientable = getNativeObject(box.handle, Gtk.Orientable);
            expect(orientable).not.toBeNull();
        });

        it("allows calling interface methods on returned instance", () => {
            const box = new Gtk.Box();
            const orientable = getNativeObject(box.handle, Gtk.Orientable);
            expect(orientable).not.toBeNull();
            expect(typeof orientable?.setOrientation).toBe("function");
        });
    });
});
