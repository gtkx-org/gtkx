import { describe, expect, it } from "vitest";
import * as Gdk from "../../src/generated/gdk/index.js";
import * as Gtk from "../../src/generated/gtk/index.js";

describe("boxed types", () => {
    describe("construction", () => {
        it("creates instance with empty init", () => {
            const rgba = new Gdk.RGBA();
            expect(rgba.id).toBeDefined();
        });

        it("creates instance with partial init", () => {
            const rgba = new Gdk.RGBA({ red: 1.0 });
            expect(rgba.red).toBeCloseTo(1.0);
        });

        it("creates instance with full init", () => {
            const rgba = new Gdk.RGBA({ red: 1.0, green: 0.5, blue: 0.25, alpha: 0.8 });
            expect(rgba.red).toBeCloseTo(1.0);
            expect(rgba.green).toBeCloseTo(0.5);
            expect(rgba.blue).toBeCloseTo(0.25);
            expect(rgba.alpha).toBeCloseTo(0.8);
        });

        it("creates boxed type via C constructor", () => {
            const border = new Gtk.Border();
            expect(border.id).toBeDefined();
        });
    });

    describe("field access", () => {
        it("reads float field", () => {
            const rgba = new Gdk.RGBA({ red: 0.75 });
            expect(rgba.red).toBeCloseTo(0.75);
        });

        it("writes float field", () => {
            const rgba = new Gdk.RGBA();
            rgba.green = 0.33;
            expect(rgba.green).toBeCloseTo(0.33);
        });

        it("reads integer field with default value", () => {
            const border = new Gtk.Border();
            expect(border.top).toBe(0);
        });

        it("writes and reads integer field", () => {
            const border = new Gtk.Border();
            border.bottom = 25;
            expect(border.bottom).toBe(25);
        });
    });

    describe("methods", () => {
        it("calls copy method", () => {
            const original = new Gdk.RGBA({ red: 1.0, green: 0.5, blue: 0.0, alpha: 1.0 });
            const copy = original.copy();
            expect(copy).not.toBe(original);
            expect(copy.red).toBeCloseTo(original.red);
            expect(copy.green).toBeCloseTo(original.green);
        });

        it("calls equal method returning true", () => {
            const rgba1 = new Gdk.RGBA({ red: 1.0, green: 0.5, blue: 0.0, alpha: 1.0 });
            const rgba2 = new Gdk.RGBA({ red: 1.0, green: 0.5, blue: 0.0, alpha: 1.0 });
            expect(rgba1.equal(rgba2)).toBe(true);
        });

        it("calls equal method returning false", () => {
            const rgba1 = new Gdk.RGBA({ red: 1.0 });
            const rgba2 = new Gdk.RGBA({ red: 0.5 });
            expect(rgba1.equal(rgba2)).toBe(false);
        });

        it("calls hash method", () => {
            const rgba = new Gdk.RGBA({ red: 1.0, green: 0.5, blue: 0.0, alpha: 1.0 });
            const hash = rgba.hash();
            expect(typeof hash).toBe("number");
        });

        it("calls toString method", () => {
            const rgba = new Gdk.RGBA({ red: 1.0, green: 0.0, blue: 0.0, alpha: 1.0 });
            const str = rgba.toString();
            expect(typeof str).toBe("string");
            expect(str).toContain("rgb");
        });

        it("calls parse method", () => {
            const rgba = new Gdk.RGBA();
            const success = rgba.parse("red");
            expect(success).toBe(true);
            expect(rgba.red).toBeCloseTo(1.0);
        });

        it("calls isClear method", () => {
            const clear = new Gdk.RGBA({ red: 0, green: 0, blue: 0, alpha: 0 });
            expect(clear.isClear()).toBe(true);
        });

        it("calls isOpaque method", () => {
            const opaque = new Gdk.RGBA({ red: 1, green: 1, blue: 1, alpha: 1 });
            expect(opaque.isOpaque()).toBe(true);
        });

        it("calls copy on Border", () => {
            const original = new Gtk.Border();
            const copy = original.copy();
            expect(copy).toBeInstanceOf(Gtk.Border);
            expect(copy).not.toBe(original);
        });
    });

    describe("glibTypeName", () => {
        it("has correct glibTypeName for RGBA", () => {
            expect(Gdk.RGBA.glibTypeName).toBe("GdkRGBA");
        });

        it("has correct glibTypeName for Border", () => {
            expect(Gtk.Border.glibTypeName).toBe("GtkBorder");
        });
    });
});
