import type { ParamSpec } from "@gtkx/gi/gobject";
import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import { Object as GObject, ParamFlags, paramSpecGtype, TYPE_OBJECT, TYPE_STRING, Value } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getClassType, registerClass, resolveType, t, TYPE_GTYPE } from "@gtkx/runtime";
import { fromValue, getValueType, toValue } from "@gtkx/runtime/internal";
import { describe, expect, it } from "vitest";

const widgetType = getClassType(Gtk.Widget);
const buttonType = getClassType(Gtk.Button);
const orientationType = resolveType("libgtk-4.so.1", "gtk_orientation_get_type");

class GtypeHolder extends GObject {
    declare kind: bigint;
}

registerClass(GtypeHolder, {
    typeName: `GtkxGtypeHolder_${String(process.pid)}`,
    properties: { kind: paramSpecGtype("kind", null, null, TYPE_OBJECT, ParamFlags.READWRITE) },
});

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
        const store = new Gio.ListStore({ itemType: widgetType });
        expect(store.itemType).toBe(widgetType);
    });

    it("reads itemType off a Gtk.SingleSelection", () => {
        const selection = new Gtk.SingleSelection({ model: new Gio.ListStore({ itemType: widgetType }) });
        expect(selection.itemType).toBe(selection.getItemType());
    });

    it("reads itemType off a Gtk.StringList", () => {
        const list = new Gtk.StringList({});
        expect(list.itemType).toBe(list.getItemType());
    });

    it("reads enumType off an Adw.EnumListModel", () => {
        const model = new Adw.EnumListModel({ enumType: orientationType });
        expect(model.enumType).toBe(orientationType);
        expect(model.itemType).toBe(model.getItemType());
    });
});

describe("registerClass with a paramSpecGtype property", () => {
    it("reads the pspec default of a never-written property", () => {
        expect(new GtypeHolder().kind).toBe(TYPE_OBJECT);
    });

    it("takes the GType through the constructor", () => {
        expect(new GtypeHolder({ kind: buttonType }).kind).toBe(buttonType);
    });

    it("writes and reads the property after construction", () => {
        const holder = new GtypeHolder();
        const seen: string[] = [];

        holder.on("notify", (...args: unknown[]) => {
            seen.push((args[0] as ParamSpec).getName());
        });

        holder.kind = widgetType;
        expect(holder.kind).toBe(widgetType);
        expect(seen).toEqual(["kind"]);
    });

    it("refuses a value that is not a GType", () => {
        const holder = new GtypeHolder();

        expect(() => Reflect.set(holder, "kind", "widget")).toThrow(
            /cannot set property 'kind' to "widget"; the property holds values of type 'GType'/,
        );
    });

    it("refuses a GType outside the range the pspec allows", () => {
        const holder = new GtypeHolder();

        expect(() => {
            holder.kind = TYPE_STRING;
        }).toThrow(RangeError);
    });

    it("serves the GType back through g_object_get_property", () => {
        const holder = new GtypeHolder({ kind: widgetType });
        const read = new Value();
        read.init(TYPE_GTYPE);
        holder.getProperty("kind", read);
        expect(read.getGtype()).toBe(widgetType);
    });
});
