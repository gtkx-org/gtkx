import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

describe("callbacks whose user data and destroy slots are adjacent", () => {
    it("marshals a JS function through a callback, user data, destroy triple", () => {
        const filter = Gtk.CustomFilter.new(
            (item) => item instanceof Gtk.StringObject && item.getString().startsWith("keep"),
        );

        expect(filter.match(Gtk.StringObject.new("keep me"))).toBe(true);
        expect(filter.match(Gtk.StringObject.new("drop me"))).toBe(false);
    });

    it("accepts a JS function for a standalone destroy notify parameter", () => {
        let freedItems = 0;

        const queue = GLib.AsyncQueue.newFull(() => {
            freedItems += 1;
        });

        expect(queue).toBeInstanceOf(GLib.AsyncQueue);
        expect(queue.length()).toBe(0);
        expect(freedItems).toBe(0);
    });
});

describe("callables whose user data or destroy slot is detached", () => {
    it("omits them from the generated bindings", () => {
        expect(Reflect.get(GLib.Tree, "newFull")).toBeUndefined();
        expect(Reflect.get(GLib.Tree.prototype, "traverse")).toBeUndefined();
    });

    it("keeps the adjacent members of the same type", () => {
        expect(typeof GLib.Tree.prototype.foreach).toBe("function");
        expect(typeof GLib.Tree.prototype.destroy).toBe("function");
    });

    it("throws when the type is constructed without its omitted constructor", () => {
        expect(() => {
            Reflect.construct(GLib.Tree, []);
        }).toThrow();
    });
});
