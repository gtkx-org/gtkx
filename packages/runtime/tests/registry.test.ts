import type { Type } from "@gtkx/gi/gobject";
import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import { typeFromName, typeName } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getHandle, getInstanceType } from "@gtkx/runtime";
import { registerClassType, resolveWrapperClass, wrapHandle } from "@gtkx/runtime/internal";
import { describe, expect, it } from "vitest";

const INVALID_GTYPE: Type = 0n;

describe("registerClassType", () => {
    it("registers a class by GType", () => {
        const fakeGtype: Type = 123_456_789n;

        class TestWrapper {
            gtype: Type = fakeGtype;
        }

        registerClassType(TestWrapper, fakeGtype);
        expect(resolveWrapperClass(fakeGtype)).toBe(TestWrapper);
    });

    it("allows wrapHandle to find registered types", () => {
        const label = new Gtk.Label({ label: "Test" });
        const wrapped = wrapHandle(getHandle(label));
        expect(wrapped).toBeInstanceOf(Gtk.Label);
    });
});

describe("resolveWrapperClass", () => {
    it("returns exact match when type is registered", () => {
        const cls = resolveWrapperClass(typeFromName("GtkButton"));
        expect(cls).toBe(Gtk.Button);
    });

    it("walks hierarchy to find a registered parent class", () => {
        const scrollbar = new Gtk.Scrollbar({ orientation: Gtk.Orientation.HORIZONTAL });
        const trough = scrollbar.getFirstChild()?.getFirstChild();

        if (!trough) {
            throw new Error("expected the scrollbar to carry an internal trough widget");
        }

        expect(typeName(getInstanceType(trough))).toBe("GtkGizmo");
        expect(resolveWrapperClass(getInstanceType(trough))).toBe(Gtk.Widget);
    });

    it("returns null for an unregistered type", () => {
        const cls = resolveWrapperClass(INVALID_GTYPE);
        expect(cls).toBeNull();
    });
});

describe("wrapHandle — wrapping", () => {
    it("wraps a native pointer in a class instance", () => {
        const label = new Gtk.Label({ label: "Test" });
        const wrapped = wrapHandle(getHandle(label));
        expect(wrapped).toBeInstanceOf(Gtk.Label);
    });

    it("determines correct runtime type via GLib type system", () => {
        const button = new Gtk.Button();
        const wrapped = wrapHandle(getHandle(button));
        expect(wrapped).toBeInstanceOf(Gtk.Button);
    });

    it("wraps with specific type when targetType is provided", () => {
        const box = new Gtk.Box();
        const wrapped = wrapHandle(getHandle(box), Gtk.Box);
        expect(wrapped).toBeInstanceOf(Gtk.Box);
    });
});

describe("wrapHandle — null handling", () => {
    it("returns null when id is null", () => {
        const result = wrapHandle(null);
        expect(result).toBeNull();
    });

    it("returns null when id is undefined", () => {
        const result = wrapHandle(undefined);
        expect(result).toBeNull();
    });
});

describe("wrapHandle — boxed types", () => {
    it("wraps a native boxed type pointer in a class instance", () => {
        const rgba = new Gdk.RGBA();
        rgba.red = 1;
        rgba.green = 0.5;
        rgba.blue = 0;
        rgba.alpha = 1;
        const wrapped = wrapHandle(getHandle(rgba), Gdk.RGBA);
        expect(wrapped).not.toBeNull();
        expect(wrapped.red).toBeCloseTo(1);
        expect(wrapped.green).toBeCloseTo(0.5);
        expect(wrapped.blue).toBeCloseTo(0);
        expect(wrapped.alpha).toBeCloseTo(1);
    });

    it("sets the correct prototype chain", () => {
        const rgba = new Gdk.RGBA();
        rgba.red = 0.5;
        const wrapped = wrapHandle(getHandle(rgba), Gdk.RGBA);
        expect(wrapped.toString()).toBe("rgba(128,0,0,0)");
        expect(wrapped.copy().red).toBeCloseTo(0.5);
    });

    it("returns null when id is null for boxed types", () => {
        const result = wrapHandle(null, Gdk.RGBA);
        expect(result).toBeNull();
    });

    it("returns null when id is undefined for boxed types", () => {
        const result = wrapHandle(undefined, Gdk.RGBA);
        expect(result).toBeNull();
    });
});

describe("interface wrapping via composed classes", () => {
    it("exposes implemented-interface methods on the wrapped instance", () => {
        const box = new Gtk.Box();
        const wrapped = wrapHandle(getHandle(box)) as Gtk.Box;
        wrapped.setOrientation(Gtk.Orientation.VERTICAL);
        expect(wrapped.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect(box.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
    });

    it("matches instanceof against an implemented-interface brand", () => {
        const box = new Gtk.Box();
        const wrapped = wrapHandle(getHandle(box));
        expect(wrapped).toBeInstanceOf(Gtk.Orientable);
    });

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
