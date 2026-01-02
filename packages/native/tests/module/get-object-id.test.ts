import { describe, expect, it } from "vitest";
import { alloc, call, getObjectId } from "../../index.js";
import { GDK_LIB, GTK_LIB } from "./utils.js";

describe("getObjectId", () => {
    it("returns a number identifier for a GObject", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string", ownership: "none" }, value: "Test" }], {
            type: "gobject",
            ownership: "none",
        });

        const id = getObjectId(label);

        expect(typeof id).toBe("number");
    });

    it("returns a number identifier for a boxed type", () => {
        const rgba = alloc(16, "GdkRGBA", GDK_LIB);

        const id = getObjectId(rgba);

        expect(typeof id).toBe("number");
    });

    it("returns consistent id for the same object", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string", ownership: "none" }, value: "Test" }], {
            type: "gobject",
            ownership: "none",
        });

        const id1 = getObjectId(label);
        const id2 = getObjectId(label);

        expect(id1).toBe(id2);
    });

    it("returns different ids for different objects", () => {
        const label1 = call(
            GTK_LIB,
            "gtk_label_new",
            [{ type: { type: "string", ownership: "none" }, value: "Test 1" }],
            { type: "gobject", ownership: "none" },
        );
        const label2 = call(
            GTK_LIB,
            "gtk_label_new",
            [{ type: { type: "string", ownership: "none" }, value: "Test 2" }],
            { type: "gobject", ownership: "none" },
        );

        const id1 = getObjectId(label1);
        const id2 = getObjectId(label2);

        expect(id1).not.toBe(id2);
    });

    it("can be used as a Map key", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string", ownership: "none" }, value: "Test" }], {
            type: "gobject",
            ownership: "none",
        });

        const map = new Map<number, string>();
        const id = getObjectId(label);
        map.set(id, "label-value");

        expect(map.get(id)).toBe("label-value");
    });
});
