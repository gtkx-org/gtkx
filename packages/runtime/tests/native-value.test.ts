import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { type Descriptor, getHandle, t } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

const roundtripTable = (key: Descriptor, value: Descriptor): ((table: unknown) => unknown) =>
    t.fn("libglib-2.0.so.0", "g_hash_table_ref", () => ({
        args: [{ type: t.hashTable(key, value, "borrowed"), isRequired: true }],
        returns: t.hashTable(key, value, "full"),
    }));

const stringTable = roundtripTable(t.string(), t.string());
const rectangle = t.boxed("GdkRectangle", {
    ownership: "borrowed",
    sharedLibrary: "libgtk-4.so.1",
    getTypeFnName: "gdk_rectangle_get_type",
});
const pageRange = t.struct("borrowed", { size: 8, wrapperClass: Gtk.PageRange });

describe("native hash-table return values", () => {
    it("returns an independent map of string entries", () => {
        const source = new Map([["k", "v"]]);
        const result = stringTable(source);

        expect(result).toEqual(source);
        expect(result).not.toBe(source);
    });

    it("preserves GObject identity through a native table", () => {
        const label = new Gtk.Label({ label: "held" });
        const roundtrip = roundtripTable(t.string(), t.object("borrowed"));
        const result = roundtrip(new Map([["a", getHandle(label)]])) as Map<string, Gtk.Label>;

        expect(result.get("a")).toBe(label);
        expect(result.get("a")?.label).toBe("held");
    });

    it("returns a copied boxed value with its registered wrapper", () => {
        const rect = new Gdk.Rectangle({ width: 7 });
        const roundtrip = roundtripTable(t.string(), rectangle);
        const result = roundtrip(new Map([["r", getHandle(rect)]])) as Map<string, Gdk.Rectangle>;
        rect.width = 19;

        expect(result.get("r")).toBeInstanceOf(Gdk.Rectangle);
        expect(result.get("r")?.width).toBe(7);
    });

    it("returns a copied plain struct value through its declared wrapper", () => {
        const range = new Gtk.PageRange({ start: 3 });
        const roundtrip = roundtripTable(t.string(), pageRange);
        const result = roundtrip(new Map([["r", getHandle(range)]])) as Map<string, Gtk.PageRange>;
        range.start = 12;

        expect(result.get("r")).toBeInstanceOf(Gtk.PageRange);
        expect(result.get("r")?.start).toBe(3);
    });

    it("returns a copied plain struct key through its declared wrapper", () => {
        const range = new Gtk.PageRange({ end: 8 });
        const roundtrip = roundtripTable(pageRange, t.string());
        const result = roundtrip(new Map([[getHandle(range), "v"]])) as Map<Gtk.PageRange, string>;
        const [key] = result.keys();
        range.end = 21;

        expect(key).toBeInstanceOf(Gtk.PageRange);
        expect(key?.end).toBe(8);
        expect(result.values().toArray()).toEqual(["v"]);
    });

    it("wraps objects inside a native pointer-array table value", () => {
        const first = new Gtk.Label({ label: "first" });
        const second = new Gtk.Label({ label: "second" });
        const roundtrip = roundtripTable(t.string(), t.ptrArray(t.object("borrowed")));
        const result = roundtrip(
            new Map([["widgets", [getHandle(first), getHandle(second)]]]),
        ) as Map<string, Gtk.Label[]>;

        expect(result.get("widgets")).toEqual([first, second]);
        expect(result.get("widgets")?.map((widget) => widget.label)).toEqual(["first", "second"]);
    });

    it("returns an independent empty map", () => {
        const source = new Map();
        const result = stringTable(source);

        expect(result).toEqual(new Map());
        expect(result).not.toBe(source);
    });

    it("rejects invalid inputs before entry and recovers", () => {
        expect(() => stringTable(null)).toThrow();
        expect(() => stringTable(undefined)).toThrow();
        expect(() => stringTable({ k: "v" })).toThrow();
        expect(() => stringTable(new Map([["k", "invalid\0value"]]))).toThrow();
        expect(stringTable(new Map([["recovered", "value"]]))).toEqual(new Map([["recovered", "value"]]));
    });
});
