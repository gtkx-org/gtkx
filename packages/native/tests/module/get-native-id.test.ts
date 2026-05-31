import { describe, expect, it } from "vitest";
import { alloc, call, getNativeId, type NativeHandle } from "../../index.js";
import { GDK_LIB, GTK_LIB } from "./utils.js";

function createBorrowedLabel(text: string): NativeHandle {
    return call(GTK_LIB, "gtk_label_new", [{ type: { type: "string", ownership: "borrowed" }, value: text }], {
        type: "gobject",
        ownership: "borrowed",
    }) as NativeHandle;
}

describe("getNativeId - id properties", () => {
    it("returns a number identifier for a GObject", () => {
        const label = createBorrowedLabel("Test");

        expect(typeof getNativeId(label)).toBe("number");
    });

    it("returns a number identifier for a boxed type", () => {
        const rgba = alloc(16, "GdkRGBA", GDK_LIB);

        expect(typeof getNativeId(rgba)).toBe("number");
    });

    it("returns consistent id for the same object", () => {
        const label = createBorrowedLabel("Test");

        expect(getNativeId(label)).toBe(getNativeId(label));
    });
});

describe("getNativeId - usage", () => {
    it("returns different ids for different objects", () => {
        const label1 = createBorrowedLabel("Test 1");
        const label2 = createBorrowedLabel("Test 2");

        expect(getNativeId(label1)).not.toBe(getNativeId(label2));
    });

    it("can be used as a Map key", () => {
        const label = createBorrowedLabel("Test");

        const map = new Map<number, string>();
        map.set(getNativeId(label), "label-value");

        expect(map.get(getNativeId(label))).toBe("label-value");
    });
});
