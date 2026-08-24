import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

describe("an invalid JavaScript value passed where a GObject.Value is expected", () => {
    it("throws for undefined", () => {
        expect(() => Gtk.ConstantExpression.newForValue()).toThrow();
    });

    it("throws for a function", () => {
        expect(() => Gtk.ConstantExpression.newForValue(() => 0)).toThrow();
    });

    it("throws for an array holding anything but strings", () => {
        expect(() => Gtk.ConstantExpression.newForValue([1, 2])).toThrow();
    });

    it("throws for a plain object", () => {
        expect(() => Gtk.ConstantExpression.newForValue({})).toThrow();
    });
});
