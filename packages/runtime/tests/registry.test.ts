import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

describe("wrappers returned by public bindings", () => {
    it("instantiates concrete registered class when handle is unseen", () => {
        const searchEntry = new Gtk.SearchEntry();
        const child = searchEntry.getFirstAccessibleChild();
        expect(child).toBeInstanceOf(Gtk.Image);
    });

    it("registers wrapper so subsequent lookups return the same instance", () => {
        const searchEntry = new Gtk.SearchEntry();
        const first = searchEntry.getFirstAccessibleChild();
        const second = searchEntry.getFirstAccessibleChild();
        expect(first).toBe(second);
    });
});

describe("a binding returning a fundamental instance", () => {
    it("wraps it in the class registered for the type the instance carries", () => {
        const expression = Gtk.ConstantExpression.newForValue("payload");
        expect(expression).toBeInstanceOf(Gtk.ConstantExpression);
        expect(expression.getValue()).toBe("payload");
    });

    it("wraps a property expression in its own class", () => {
        const expression = Gtk.PropertyExpression.new(Gtk.Label.prototype.__type__, null, "label");
        expect(expression).toBeInstanceOf(Gtk.PropertyExpression);
    });

    it("wraps a variant in its own class, which carries no type tag to read", () => {
        const parsed = GLib.Variant.parse(null, "'text'", null, null);
        expect(parsed).toBeInstanceOf(GLib.Variant);
        expect(parsed.getString()).toEqual(["text", 4]);
    });
});

describe("a struct descriptor that names its wrapper class", () => {
    it("wraps a record handed over by a function that transfers ownership", () => {
        expect(GLib.AsyncQueue.new()).toBeInstanceOf(GLib.AsyncQueue);
    });
});
