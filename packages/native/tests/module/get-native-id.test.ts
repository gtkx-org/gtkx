import { describe, expect, it } from "vitest";
import { alloc, call, getNativeId, type NativeHandle } from "../../index.js";
import { GDK_LIB, GTK_LIB } from "./utils.js";

describe("getNativeId", () => {
    it("returns a number identifier for a GObject", () => {
        const label = call(
            GTK_LIB,
            "gtk_label_new",
            [{ type: { type: "string", ownership: "borrowed" }, value: "Test" }],
            {
                type: "gobject",
                ownership: "borrowed",
            },
        );

        const id = getNativeId(label as NativeHandle);

        expect(typeof id).toBe("number");
    });

    it("returns a number identifier for a boxed type", () => {
        const rgba = alloc(16, "GdkRGBA", GDK_LIB);

        const id = getNativeId(rgba);

        expect(typeof id).toBe("number");
    });

    it("returns consistent id for the same object", () => {
        const label = call(
            GTK_LIB,
            "gtk_label_new",
            [{ type: { type: "string", ownership: "borrowed" }, value: "Test" }],
            {
                type: "gobject",
                ownership: "borrowed",
            },
        );

        const id1 = getNativeId(label as NativeHandle);
        const id2 = getNativeId(label as NativeHandle);

        expect(id1).toBe(id2);
    });

    it("returns different ids for different objects", () => {
        const label1 = call(
            GTK_LIB,
            "gtk_label_new",
            [{ type: { type: "string", ownership: "borrowed" }, value: "Test 1" }],
            { type: "gobject", ownership: "borrowed" },
        );
        const label2 = call(
            GTK_LIB,
            "gtk_label_new",
            [{ type: { type: "string", ownership: "borrowed" }, value: "Test 2" }],
            { type: "gobject", ownership: "borrowed" },
        );

        const id1 = getNativeId(label1 as NativeHandle);
        const id2 = getNativeId(label2 as NativeHandle);

        expect(id1).not.toBe(id2);
    });

    it("can be used as a Map key", () => {
        const label = call(
            GTK_LIB,
            "gtk_label_new",
            [{ type: { type: "string", ownership: "borrowed" }, value: "Test" }],
            {
                type: "gobject",
                ownership: "borrowed",
            },
        );

        const map = new Map<number, string>();
        const id = getNativeId(label as NativeHandle);
        map.set(id, "label-value");

        expect(map.get(id)).toBe("label-value");
    });
});
