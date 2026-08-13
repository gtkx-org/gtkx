import * as Gio from "@gtkx/gi/gio";
import { Object as GObject, ParamFlags, paramSpecGtype, TYPE_OBJECT, TYPE_STRING, Value } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getClassType, registerClass, t, TYPE_GTYPE } from "@gtkx/runtime";
import { fromValue, getValueType, toValue } from "@gtkx/runtime/internal";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "../helpers/unique-name.js";
import { watchNotify } from "./helpers.js";

const uniqueName = createTypeNameFactory("_");

const makeKindHolderClass = () => {
    class KindHolder extends GObject {
        declare kind: bigint;
    }

    registerClass(KindHolder, {
        typeName: uniqueName("GtkxKindHolder"),
        properties: { kind: paramSpecGtype("kind", null, null, TYPE_OBJECT, ParamFlags.READWRITE) },
    });

    return KindHolder;
};

describe("GValue conversion for GType", () => {
    it("round-trips a GType through the gtype descriptor", () => {
        const value = toValue(t.gtype, TYPE_STRING);
        expect(getValueType(value)).toBe(TYPE_GTYPE);
        expect(fromValue(value)).toBe(TYPE_STRING);
    });

    it("round-trips the invalid GType", () => {
        expect(fromValue(toValue(t.gtype, 0n))).toBe(0n);
    });
});

describe("generated GType property accessors", () => {
    it("reads itemType off a Gio.ListStore", () => {
        const store = new Gio.ListStore({ itemType: getClassType(Gtk.Widget) });
        expect(store.itemType).toBe(getClassType(Gtk.Widget));
    });

    it("reads itemType off a Gtk.SingleSelection", () => {
        const store = new Gio.ListStore({ itemType: getClassType(Gtk.Widget) });
        const selection = new Gtk.SingleSelection({ model: store });
        expect(selection.itemType).toBe(selection.getItemType());
    });

    it("reads itemType off a Gtk.StringList", () => {
        const list = new Gtk.StringList({});
        expect(list.itemType).toBe(list.getItemType());
    });
});

describe("registerClass with a paramSpecGtype property", () => {
    it("reads the pspec default of a never-written property", () => {
        const KindHolder = makeKindHolderClass();
        expect(new KindHolder().kind).toBe(TYPE_OBJECT);
    });

    it("takes the GType through the constructor", () => {
        const KindHolder = makeKindHolderClass();
        expect(new KindHolder({ kind: getClassType(Gtk.Button) }).kind).toBe(getClassType(Gtk.Button));
    });

    it("writes and reads the property after construction", () => {
        const KindHolder = makeKindHolderClass();
        const holder = new KindHolder();
        const seen = watchNotify(holder);
        holder.kind = getClassType(Gtk.Widget);
        expect(holder.kind).toBe(getClassType(Gtk.Widget));
        expect(seen).toEqual(["kind"]);
    });

    it("refuses a value that is not a GType", () => {
        const KindHolder = makeKindHolderClass();
        const holder = new KindHolder();

        expect(() => Reflect.set(holder, "kind", "widget")).toThrow(
            /cannot set property 'kind' to "widget"; the property holds values of type 'GType'/,
        );
    });

    it("refuses a GType outside the range the pspec allows", () => {
        const KindHolder = makeKindHolderClass();
        const holder = new KindHolder();

        expect(() => {
            holder.kind = TYPE_STRING;
        }).toThrow(RangeError);
    });

    it("serves the GType back through g_object_get_property", () => {
        const KindHolder = makeKindHolderClass();
        const holder = new KindHolder({ kind: getClassType(Gtk.Widget) });
        const read = new Value();
        read.init(TYPE_GTYPE);
        holder.getProperty("kind", read);
        expect(read.getGtype()).toBe(getClassType(Gtk.Widget));
    });
});
