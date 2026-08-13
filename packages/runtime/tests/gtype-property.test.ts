import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import { Object as GObject, ParamFlags, paramSpecGtype, TYPE_OBJECT, TYPE_STRING } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getClassType, registerClass, resolveType, TYPE_GTYPE } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { valueOfType, watchNotify } from "./helpers/gobject.js";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");
const widgetType = getClassType(Gtk.Widget);
const buttonType = getClassType(Gtk.Button);
const orientationType = resolveType("libgtk-4.so.1", "gtk_orientation_get_type");

const makeHolderClass = () => {
    class Holder extends GObject {
        declare kind: bigint;
    }

    registerClass(Holder, {
        typeName: uniqueName("GtkxGtypeHolder"),
        properties: { kind: paramSpecGtype("kind", null, null, TYPE_OBJECT, ParamFlags.READWRITE) },
    });

    return Holder;
};

describe("generated GType property accessors", () => {
    it("serves the GType each model was built around", () => {
        const store = new Gio.ListStore({ itemType: widgetType });
        const selection = new Gtk.SingleSelection({ model: new Gio.ListStore({ itemType: widgetType }) });
        const list = new Gtk.StringList({});
        const model = new Adw.EnumListModel({ enumType: orientationType });
        expect(store.itemType).toBe(widgetType);
        expect(selection.itemType).toBe(selection.getItemType());
        expect(list.itemType).toBe(list.getItemType());
        expect(model.enumType).toBe(orientationType);
        expect(model.itemType).toBe(model.getItemType());
    });
});

describe("registerClass — a GType property", () => {
    it("serves the ParamSpec default, takes a GType at construction and after it", () => {
        const Holder = makeHolderClass();
        const holder = new Holder();
        const seen = watchNotify(holder);
        expect(holder.kind).toBe(TYPE_OBJECT);
        expect(new Holder({ kind: buttonType }).kind).toBe(buttonType);
        holder.kind = widgetType;
        expect(holder.kind).toBe(widgetType);
        expect(seen).toEqual(["kind"]);
    });

    it("serves the GType back through the GValue GObject reads the property into", () => {
        const read = valueOfType(TYPE_GTYPE);
        new (makeHolderClass())({ kind: widgetType }).getProperty("kind", read);
        expect(read.getGtype()).toBe(widgetType);
    });

    it("refuses a value that is not a GType, and one the ParamSpec's range excludes", () => {
        const holder = new (makeHolderClass())();
        expect(() => Reflect.set(holder, "kind", "widget")).toThrow(TypeError);

        expect(() => {
            holder.kind = TYPE_STRING;
        }).toThrow(RangeError);

        expect(holder.kind).toBe(TYPE_OBJECT);
    });
});
