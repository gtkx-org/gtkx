import { describe, expect, it } from "vitest";
import * as Gtk from "../src/generated/gtk/index.js";
import { getNativeObject } from "../src/index.js";

describe("getNativeObject", () => {
    it("wraps a native pointer in a class instance", () => {
        const label = new Gtk.Label("Test");
        const wrapped = getNativeObject(label.id);
        expect(wrapped).toBeInstanceOf(Gtk.Label);
    });

    it("determines correct runtime type via GLib type system", () => {
        const button = new Gtk.Button();
        const wrapped = getNativeObject(button.id);
        expect(wrapped).toBeInstanceOf(Gtk.Button);
    });

    it("wraps with specific type when targetType is provided", () => {
        const box = new Gtk.Box(Gtk.Orientation.HORIZONTAL, 0);
        const wrapped = getNativeObject(box.id, Gtk.Box);
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
});
