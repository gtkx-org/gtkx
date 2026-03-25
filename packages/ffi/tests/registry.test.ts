import { describe, expect, it } from "vitest";
import * as Gdk from "../src/generated/gdk/index.js";
import * as Gtk from "../src/generated/gtk/index.js";
import {
    findNativeClass,
    getNativeClass,
    getNativeObject,
    type NativeClass,
    NativeObject,
    registerNativeClass,
} from "../src/index.js";

describe("registerNativeClass", () => {
    it("registers a class with glibTypeName and objectType", () => {
        class TestClass extends NativeObject {
            static glibTypeName = "TestType";
            static objectType = "gobject" as const;
        }
        registerNativeClass(TestClass as NativeClass);
    });

    it("allows getNativeObject to find registered types", () => {
        const label = new Gtk.Label("Test");
        const wrapped = getNativeObject(label.handle);
        expect(wrapped).toBeInstanceOf(Gtk.Label);
    });
});

describe("getNativeClass", () => {
    it("returns a registered class by GLib type name", () => {
        const cls = getNativeClass("GtkLabel");
        expect(cls).toBe(Gtk.Label);
    });

    it("returns null for an unregistered type name", () => {
        const cls = getNativeClass("NonExistentType");
        expect(cls).toBeNull();
    });
});

describe("findNativeClass", () => {
    it("returns exact match when type is registered", () => {
        const cls = findNativeClass("GtkButton");
        expect(cls).toBe(Gtk.Button);
    });

    it("walks hierarchy to find a registered parent class", () => {
        const cls = findNativeClass("GtkButton", true);
        expect(cls).not.toBeNull();
    });

    it("returns null when walkHierarchy is false and type is not registered", () => {
        const cls = findNativeClass("NonExistentType", false);
        expect(cls).toBeNull();
    });
});

describe("getNativeObject", () => {
    it("wraps a native pointer in a class instance", () => {
        const label = new Gtk.Label("Test");
        const wrapped = getNativeObject(label.handle);
        expect(wrapped).toBeInstanceOf(Gtk.Label);
    });

    it("determines correct runtime type via GLib type system", () => {
        const button = new Gtk.Button();
        const wrapped = getNativeObject(button.handle);
        expect(wrapped).toBeInstanceOf(Gtk.Button);
    });

    it("wraps with specific type when targetType is provided", () => {
        const box = new Gtk.Box();
        const wrapped = getNativeObject(box.handle, Gtk.Box);
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

    describe("boxed types", () => {
        it("wraps a native boxed type pointer in a class instance", () => {
            const rgba = new Gdk.RGBA({ red: 1.0, green: 0.5, blue: 0.0, alpha: 1.0 });
            const wrapped = getNativeObject(rgba.handle, Gdk.RGBA);
            expect(wrapped).not.toBeNull();
            expect(wrapped?.red).toBeCloseTo(1.0);
            expect(wrapped?.green).toBeCloseTo(0.5);
            expect(wrapped?.blue).toBeCloseTo(0.0);
            expect(wrapped?.alpha).toBeCloseTo(1.0);
        });

        it("sets the correct prototype chain", () => {
            const rgba = new Gdk.RGBA({ red: 0.5 });
            const wrapped = getNativeObject(rgba.handle, Gdk.RGBA);
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

    describe("interfaces", () => {
        it("returns interface instance when object implements it", () => {
            const box = new Gtk.Box();
            const orientable = getNativeObject(box.handle, Gtk.Orientable);
            expect(orientable).not.toBeNull();
        });

        it("allows calling interface methods on returned instance", () => {
            const box = new Gtk.Box();
            const orientable = getNativeObject(box.handle, Gtk.Orientable);
            expect(orientable).not.toBeNull();
            expect(typeof orientable?.setOrientation).toBe("function");
        });
    });
});
