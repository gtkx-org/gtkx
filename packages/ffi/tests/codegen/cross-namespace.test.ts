import { describe, expect, it } from "vitest";
import * as Gdk from "../../src/generated/gdk/index.js";
import * as Gtk from "../../src/generated/gtk/index.js";

describe("cross-namespace", () => {
    describe("return types", () => {
        it("returns cross-namespace enum type", () => {
            const modMask = Gtk.acceleratorGetDefaultModMask();
            expect(typeof modMask).toBe("number");
        });
    });

    describe("parameter types", () => {
        it("accepts cross-namespace enum parameter", () => {
            const label = Gtk.acceleratorGetLabel(65, Gdk.ModifierType.CONTROL_MASK);
            expect(typeof label).toBe("string");
        });

        it("accepts multiple cross-namespace parameters", () => {
            const name = Gtk.acceleratorName(65, Gdk.ModifierType.CONTROL_MASK);
            expect(typeof name).toBe("string");
        });

        it("accepts cross-namespace boxed type parameter", () => {
            const rgba = new Gdk.RGBA({ red: 1.0, green: 0.0, blue: 0.0, alpha: 1.0 });
            const str = rgba.toString();
            expect(str).toContain("rgb");
        });
    });

    describe("inheritance", () => {
        it("class extends cross-namespace parent", () => {
            const button = new Gtk.Button();
            expect(button).toBeInstanceOf(Gtk.Widget);
        });

        it("accesses inherited methods from parent namespace", () => {
            const button = new Gtk.Button();
            const visible = button.getVisible();
            expect(typeof visible).toBe("boolean");
        });
    });

    describe("interface implementations", () => {
        it("uses interface from same namespace", () => {
            const button = new Gtk.Button();
            const actionName = button.getActionName();
            expect(actionName === null || typeof actionName === "string").toBe(true);
        });
    });
});
