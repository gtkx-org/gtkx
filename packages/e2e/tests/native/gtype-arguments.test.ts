import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass, TYPE_GTYPE } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

const newStoreFor = (itemType: unknown): Gio.ListStore => Gio.ListStore.new(itemType as bigint);

class TitledObject extends GObject.Object {
    title = "";
}

registerClass(TitledObject, { typeName: "GtkxTestGtypeTitledObject" });

describe("classes passed where a GType is expected", () => {
    it("accepts a generated wrapper class and round-trips appended items", () => {
        const store = Gio.ListStore.new(Gtk.Label);
        const label = new Gtk.Label();
        label.setLabel("first");
        store.append(label);
        expect(store.getItem(0)).toBe(label);
        expect((store.getItem(0) as Gtk.Label).getLabel()).toBe("first");
    });

    it("accepts a registerClass result", () => {
        const store = Gio.ListStore.new(TitledObject);
        const item = new TitledObject();
        item.title = "kept";
        store.append(item);
        expect(store.getItem(0)).toBe(item);
        expect((store.getItem(0) as TitledObject).title).toBe("kept");
    });

    it("resolves a wrapper class or interface to its registered GType", () => {
        expect(GObject.typeName(Gtk.Label)).toBe("GtkLabel");
        expect(GObject.typeName(Gio.ListModel)).toBe("GListModel");
        expect(GObject.typeName(TitledObject)).toBe("GtkxTestGtypeTitledObject");
    });

    it("coerces a class emitted as a declared signal's GType argument", () => {
        class TypeEmitter extends GObject.Object {}

        const Registered = registerClass(TypeEmitter, {
            typeName: "GtkxTestGtypeEmitter",
            signals: { "type-picked": { paramTypes: [TYPE_GTYPE] } },
        });

        const instance = new Registered();
        const seen: bigint[] = [];

        instance.connect("type-picked", (type: bigint) => {
            seen.push(type);
        });

        instance.emit("type-picked", Gtk.Label);
        expect(seen).toEqual([Gtk.Label.prototype.__type__]);
    });
});

describe("values that carry no registered GType", () => {
    it("still accepts a raw GType bigint", () => {
        const store = Gio.ListStore.new(Gtk.Label.prototype.__type__);
        expect(store.getItemType()).toBe(Gtk.Label.prototype.__type__);
    });

    it("rejects an unregistered subclass of a wrapper class", () => {
        class PlainSubclass extends Gtk.Label {}
        expect(() => Gio.ListStore.new(PlainSubclass)).toThrow();
    });

    it("rejects a plain object", () => {
        expect(() => newStoreFor({})).toThrow();
    });

    it("rejects a string", () => {
        expect(() => newStoreFor("GtkLabel")).toThrow();
    });

    it("rejects a class that was never registered", () => {
        class Unregistered {
            title = "";
        }

        expect(() => newStoreFor(Unregistered)).toThrow();
    });
});
