import { describe, expect, it } from "vitest";
import * as Gtk from "../src/generated/gtk/index.js";
import { getInterface, type NativeObject } from "../src/index.js";

type TypeWithGlibTypeName<T extends NativeObject> = {
    glibTypeName: string;
    prototype: T;
    fromPtr(ptr: unknown): T;
};

describe("getInterface", () => {
    it("returns interface instance when object implements it", () => {
        const box = new Gtk.Box(Gtk.Orientation.HORIZONTAL, 0);
        const orientable = getInterface(box.id, Gtk.Orientable);
        expect(orientable).not.toBeNull();
    });

    it("allows calling interface methods on returned instance", () => {
        const box = new Gtk.Box(Gtk.Orientation.HORIZONTAL, 0);
        const orientable = getInterface(box.id, Gtk.Orientable);
        expect(orientable).not.toBeNull();
        expect(typeof orientable?.setOrientation).toBe("function");
    });

    it("returns null for invalid gtype", () => {
        const label = new Gtk.Label("Test");
        const invalidType: TypeWithGlibTypeName<NativeObject> = {
            glibTypeName: "InvalidInterface",
            prototype: { id: null },
            fromPtr: () => ({ id: null }),
        };
        const result = getInterface(label.id, invalidType);
        expect(result).toBeNull();
    });
});
