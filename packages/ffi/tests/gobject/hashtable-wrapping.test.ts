import { fromNative, getHandle, t } from "@gtkx/ffi";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

const rectangleFfi = t.boxed("GdkRectangle", {
    ownership: "borrowed",
    sharedLibrary: "libgtk-4.so.1",
    getTypeFnName: "gdk_rectangle_get_type",
});

describe("fromNative — hash-table entries are wrapped recursively", () => {
    it("passes string keys and values straight through", () => {
        const map = fromNative(t.hashTable(t.string("borrowed"), t.string("borrowed")), [["k", "v"]]);
        expect(map).toBeInstanceOf(Map);
        expect((map as Map<string, string>).get("k")).toBe("v");
    });

    it("wraps a GObject value, returning the identity-tracked instance", () => {
        const label = new Gtk.Label({});
        const map = fromNative(t.hashTable(t.string("borrowed"), t.object("borrowed")), [["a", getHandle(label)]]);
        expect((map as Map<string, unknown>).get("a")).toBe(label);
    });

    it("self-resolves a boxed value reached through a hash table, with no threaded class", () => {
        const rect = new Gdk.Rectangle({ width: 7 });
        const map = fromNative(t.hashTable(t.string("borrowed"), rectangleFfi), [["r", getHandle(rect)]]);
        const wrapped = (map as Map<string, Gdk.Rectangle>).get("r");
        expect(wrapped).toBeInstanceOf(Gdk.Rectangle);
        expect(wrapped?.width).toBe(7);
    });

    it("self-resolves a plain struct (no GType) value from its descriptor", () => {
        const range = new Gtk.PageRange({ start: 3 });
        const map = fromNative(
            t.hashTable(t.string("borrowed"), t.struct("borrowed", { wrapperClass: Gtk.PageRange })),
            [["r", getHandle(range)]],
        );
        const wrapped = (map as Map<string, Gtk.PageRange>).get("r");
        expect(wrapped).toBeInstanceOf(Gtk.PageRange);
        expect(wrapped?.start).toBe(3);
    });

    it("self-resolves a plain struct (no GType) used as a key", () => {
        const range = new Gtk.PageRange({ end: 8 });
        const map = fromNative(
            t.hashTable(t.struct("borrowed", { wrapperClass: Gtk.PageRange }), t.string("borrowed")),
            [[getHandle(range), "v"]],
        );
        const key = [...(map as Map<Gtk.PageRange, string>).keys()][0];
        expect(key).toBeInstanceOf(Gtk.PageRange);
        expect(key?.end).toBe(8);
    });

    it("recurses into an array-valued entry, wrapping each element", () => {
        const first = new Gtk.Label({});
        const second = new Gtk.Label({});
        const map = fromNative(t.hashTable(t.string("borrowed"), t.list(t.object("borrowed"))), [
            ["widgets", [getHandle(first), getHandle(second)]],
        ]);
        expect((map as Map<string, unknown[]>).get("widgets")).toEqual([first, second]);
    });

    it("maps a null hash table to null", () => {
        expect(fromNative(t.hashTable(t.string("borrowed"), t.string("borrowed")), null)).toBeNull();
    });
});
