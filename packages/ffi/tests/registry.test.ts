import { getHandle } from "@gtkx/ffi";
import * as Gdk from "@gtkx/gi/gdk";
import type { GType } from "@gtkx/gi/gobject";
import { typeFromName } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { AnyClass } from "@gtkx/utils";
import { describe, expect, it } from "vitest";
import { findWrapperClass, getWrapperClass, setClassGtype, wrapHandle } from "../src/registry.js";

const INVALID_GTYPE: GType = 0n;

describe("setClassGtype", () => {
    it("registers a class by GType", () => {
        class TestClass {}
        const fakeGtype: GType = 123456789n;
        setClassGtype(TestClass as AnyClass, fakeGtype);
        expect(findWrapperClass(fakeGtype)).toBe(TestClass);
    });

    it("allows wrapHandle to find registered types", () => {
        const label = new Gtk.Label({ label: "Test" });
        const wrapped = wrapHandle(getHandle(label));
        expect(wrapped).toBeInstanceOf(Gtk.Label);
    });
});

describe("findWrapperClass", () => {
    it("returns exact match when type is registered", () => {
        const cls = findWrapperClass(typeFromName("GtkButton"));
        expect(cls).toBe(Gtk.Button);
    });

    it("walks hierarchy to find a registered parent class", () => {
        const cls = findWrapperClass(typeFromName("GtkButton"));
        expect(cls).not.toBeNull();
    });

    it("returns null for an unregistered type via exact lookup", () => {
        const cls = getWrapperClass(INVALID_GTYPE);
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
        rgba.red = 1.0;
        rgba.green = 0.5;
        rgba.blue = 0.0;
        rgba.alpha = 1.0;
        const wrapped = wrapHandle(getHandle(rgba), Gdk.RGBA);
        expect(wrapped).not.toBeNull();
        expect(wrapped?.red).toBeCloseTo(1.0);
        expect(wrapped?.green).toBeCloseTo(0.5);
        expect(wrapped?.blue).toBeCloseTo(0.0);
        expect(wrapped?.alpha).toBeCloseTo(1.0);
    });

    it("sets the correct prototype chain", () => {
        const rgba = new Gdk.RGBA();
        rgba.red = 0.5;
        const wrapped = wrapHandle(getHandle(rgba), Gdk.RGBA);
        expect(wrapped).not.toBeNull();
        expect(typeof wrapped?.toString).toBe("function");
        expect(typeof wrapped?.copy).toBe("function");
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
        const wrapped = wrapHandle<Gtk.Box>(getHandle(box));
        expect(wrapped).not.toBeNull();
        expect(typeof wrapped.setOrientation).toBe("function");
    });

    it("matches instanceof against an implemented-interface brand", () => {
        const box = new Gtk.Box();
        const wrapped = wrapHandle(getHandle(box));
        expect(wrapped).toBeInstanceOf(Gtk.Orientable);
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
