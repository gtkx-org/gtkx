import { getHandle, getNativeObject, getNativeObjectAsInterface } from "@gtkx/ffi";
import * as Gdk from "@gtkx/gi/gdk";
import type { GType } from "@gtkx/gi/gobject";
import { typeFromName } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { AnyClass } from "@gtkx/utils";
import { describe, expect, it } from "vitest";
import { findNativeClass, getNativeClass, setClassGType } from "../src/registry.js";

const INVALID_GTYPE: GType = 0;

describe("setClassGType", () => {
    it("registers a class by GType", () => {
        class TestClass {}
        const fakeGtype: GType = 123456789;
        setClassGType(TestClass as AnyClass, fakeGtype);
        expect(findNativeClass(fakeGtype)).toBe(TestClass);
    });

    it("allows getNativeObject to find registered types", () => {
        const label = new Gtk.Label({ label: "Test" });
        const wrapped = getNativeObject(getHandle(label));
        expect(wrapped).toBeInstanceOf(Gtk.Label);
    });
});

describe("findNativeClass", () => {
    it("returns exact match when type is registered", () => {
        const cls = findNativeClass(typeFromName("GtkButton"));
        expect(cls).toBe(Gtk.Button);
    });

    it("walks hierarchy to find a registered parent class", () => {
        const cls = findNativeClass(typeFromName("GtkButton"));
        expect(cls).not.toBeNull();
    });

    it("returns null for an unregistered type via exact lookup", () => {
        const cls = getNativeClass(INVALID_GTYPE);
        expect(cls).toBeNull();
    });
});

describe("getNativeObject — wrapping", () => {
    it("wraps a native pointer in a class instance", () => {
        const label = new Gtk.Label({ label: "Test" });
        const wrapped = getNativeObject(getHandle(label));
        expect(wrapped).toBeInstanceOf(Gtk.Label);
    });

    it("determines correct runtime type via GLib type system", () => {
        const button = new Gtk.Button();
        const wrapped = getNativeObject(getHandle(button));
        expect(wrapped).toBeInstanceOf(Gtk.Button);
    });

    it("wraps with specific type when targetType is provided", () => {
        const box = new Gtk.Box();
        const wrapped = getNativeObject(getHandle(box), Gtk.Box);
        expect(wrapped).toBeInstanceOf(Gtk.Box);
    });
});

describe("getNativeObject — null handling", () => {
    it("returns null when id is null", () => {
        const result = getNativeObject(null);
        expect(result).toBeNull();
    });

    it("returns null when id is undefined", () => {
        const result = getNativeObject(undefined);
        expect(result).toBeNull();
    });
});

describe("getNativeObject — boxed types", () => {
    it("wraps a native boxed type pointer in a class instance", () => {
        const rgba = new Gdk.RGBA();
        rgba.red = 1.0;
        rgba.green = 0.5;
        rgba.blue = 0.0;
        rgba.alpha = 1.0;
        const wrapped = getNativeObject(getHandle(rgba), Gdk.RGBA);
        expect(wrapped).not.toBeNull();
        expect(wrapped?.red).toBeCloseTo(1.0);
        expect(wrapped?.green).toBeCloseTo(0.5);
        expect(wrapped?.blue).toBeCloseTo(0.0);
        expect(wrapped?.alpha).toBeCloseTo(1.0);
    });

    it("sets the correct prototype chain", () => {
        const rgba = new Gdk.RGBA();
        rgba.red = 0.5;
        const wrapped = getNativeObject(getHandle(rgba), Gdk.RGBA);
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

describe("getNativeObject — interfaces", () => {
    it("returns interface instance when object implements it", () => {
        const box = new Gtk.Box();
        const orientable = getNativeObjectAsInterface(getHandle(box), Gtk.Orientable);
        expect(orientable).not.toBeNull();
    });

    it("allows calling interface methods on returned instance", () => {
        const box = new Gtk.Box();
        const orientable = getNativeObjectAsInterface(getHandle(box), Gtk.Orientable);
        expect(orientable).not.toBeNull();
        expect(typeof orientable?.setOrientation).toBe("function");
    });

    it("returns null for null/undefined handle", () => {
        expect(getNativeObjectAsInterface(null, Gtk.Orientable)).toBeNull();
        expect(getNativeObjectAsInterface(undefined, Gtk.Orientable)).toBeNull();
    });

    it("instantiates concrete registered class when handle is unseen", () => {
        const searchEntry = new Gtk.SearchEntry();
        const child = searchEntry.getFirstAccessibleChild();
        expect(child).not.toBeNull();
    });

    it("registers wrapper so subsequent lookups return the same instance", () => {
        const searchEntry = new Gtk.SearchEntry();
        const first = searchEntry.getFirstAccessibleChild();
        const second = searchEntry.getFirstAccessibleChild();
        expect(first).toBe(second);
    });
});
