import { describe, expect, it } from "vitest";
import * as Gtk from "../src/generated/gtk/index.js";
import { getCurrentApp, getObject } from "../src/index.js";

describe("getObject", () => {
    it("wraps a native pointer in a class instance", () => {
        const label = new Gtk.Label("Test");
        const wrapped = getObject<Gtk.Label>(label.id);
        expect(wrapped).toBeInstanceOf(Gtk.Label);
    });

    it("determines correct runtime type via GLib type system", () => {
        const button = new Gtk.Button();
        const wrapped = getObject(button.id);
        expect(wrapped).toBeInstanceOf(Gtk.Button);
    });

    it("walks up type hierarchy for unregistered subtypes", () => {
        const app = getCurrentApp();
        const wrapped = getObject(app.id);
        expect(wrapped).toBeInstanceOf(Gtk.Application);
    });

    describe("error handling", () => {
        it("throws when id is null", () => {
            expect(() => getObject(null)).toThrow("getObject: id cannot be null or undefined");
        });

        it("throws when id is undefined", () => {
            expect(() => getObject(undefined)).toThrow("getObject: id cannot be null or undefined");
        });
    });
});
