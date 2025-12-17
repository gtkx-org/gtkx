import { describe, expect, it } from "vitest";
import * as Gdk from "../src/generated/gdk/index.js";
import { getBoxed } from "../src/index.js";

describe("getBoxed", () => {
    it("wraps a native boxed type pointer in a class instance", () => {
        const rgba = new Gdk.RGBA({ red: 1.0, green: 0.5, blue: 0.0, alpha: 1.0 });
        const wrapped = getBoxed<Gdk.RGBA>(rgba.id, "GdkRGBA");
        expect(wrapped.red).toBeCloseTo(1.0);
        expect(wrapped.green).toBeCloseTo(0.5);
        expect(wrapped.blue).toBeCloseTo(0.0);
        expect(wrapped.alpha).toBeCloseTo(1.0);
    });

    it("sets the correct prototype chain", () => {
        const rgba = new Gdk.RGBA({ red: 0.5 });
        const wrapped = getBoxed<Gdk.RGBA>(rgba.id, "GdkRGBA");
        expect(typeof wrapped.toString).toBe("function");
        expect(typeof wrapped.copy).toBe("function");
    });

    describe("error handling", () => {
        it("throws when id is null", () => {
            expect(() => getBoxed(null, "GdkRGBA")).toThrow("getBoxed: id cannot be null or undefined");
        });

        it("throws when id is undefined", () => {
            expect(() => getBoxed(undefined, "GdkRGBA")).toThrow("getBoxed: id cannot be null or undefined");
        });

        it("throws for unknown boxed type", () => {
            const rgba = new Gdk.RGBA();
            expect(() => getBoxed(rgba.id, "UnknownType")).toThrow(
                "Unknown boxed type: UnknownType. Make sure the class is registered.",
            );
        });
    });
});
