import type { ParamSpec } from "@gtkx/gi/gobject";
import * as Gio from "@gtkx/gi/gio";
import {
    Object as GObject,
    ParamFlags,
    paramSpecInt,
    paramSpecString,
    TYPE_INT,
    TYPE_OBJECT,
    TYPE_STRING,
    Value,
} from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "../helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");

const makeSwatchClass = () => {
    class Swatch extends GObject {
        declare red: number;
        declare label: string;
    }

    registerClass(Swatch, {
        typeName: uniqueName("GtkxPropSwatch"),
        properties: {
            red: paramSpecInt("red", null, null, 0, 255, 0, ParamFlags.READWRITE),
            label: paramSpecString("label", null, null, "", ParamFlags.READWRITE),
        },
    });

    return Swatch;
};

describe("registerClass — properties", () => {
    it("installs the properties on the new type", () => {
        const Swatch = makeSwatchClass();
        const swatch = new Swatch();
        expect(swatch.red).toBe(0);
        expect(swatch.label).toBe("");
    });

    it("round-trips a value through g_object_get_property and g_object_set_property", () => {
        const Swatch = makeSwatchClass();
        const swatch = new Swatch();
        swatch.red = 200;
        swatch.label = "crimson";
        const readRed = new Value();
        readRed.init(TYPE_INT);
        swatch.getProperty("red", readRed);
        expect(readRed.getInt()).toBe(200);
        const readLabel = new Value();
        readLabel.init(TYPE_STRING);
        swatch.getProperty("label", readLabel);
        expect(readLabel.getString()).toBe("crimson");
        const written = new Value();
        written.init(TYPE_INT);
        written.setInt(12);
        swatch.setProperty("red", written);
        expect(swatch.red).toBe(12);
    });

    it("emits notify when a generated accessor changes the value", () => {
        const Swatch = makeSwatchClass();
        const swatch = new Swatch();
        const seen: string[] = [];

        swatch.on("notify", (...args: unknown[]) => {
            const [pspec] = args as [ParamSpec];
            seen.push(pspec.getName());
        });

        swatch.red = 3;
        const afterFirstWrite = [...seen];
        swatch.red = 3;
        expect(seen).toEqual(afterFirstWrite);
        swatch.label = "teal";
        expect(seen).toEqual(["red", "label"]);
    });
});

describe("registerClass — property notifications", () => {
    it("emits notify exactly once when the property is set through g_object_set_property", () => {
        const Swatch = makeSwatchClass();
        const swatch = new Swatch();
        const seen: string[] = [];

        swatch.on("notify", (...args: unknown[]) => {
            const [pspec] = args as [ParamSpec];
            seen.push(pspec.getName());
        });

        const written = new Value();
        written.init(TYPE_INT);
        written.setInt(99);
        swatch.setProperty("red", written);
        expect(seen).toEqual(["red"]);
        expect(swatch.red).toBe(99);
    });
});

describe("registerClass — properties and native sorting", () => {
    it("lets a native sorter compare the property without calling back into JavaScript", () => {
        const Swatch = makeSwatchClass();
        const store = Gio.ListStore.new(Swatch.prototype.__type__);

        for (const red of [7, 3, 9, 1]) {
            const swatch = new Swatch();
            swatch.red = red;
            store.append(swatch);
        }

        const expression = Gtk.PropertyExpression.new(Swatch.prototype.__type__, null, "red");
        const sorter = Gtk.NumericSorter.new(expression);
        const sorted = Gtk.SortListModel.new(store, sorter);

        const reds = Array.from({ length: sorted.getNItems() }, (_, index) => {
            const item = sorted.getItem(index);

            return item === null ? -1 : (Reflect.get(item, "red") as number);
        });

        expect(reds).toEqual([1, 3, 7, 9]);
    });

    it("keeps a plain GObject subclass unaffected", () => {
        class Plain extends GObject {}
        registerClass(Plain, { typeName: uniqueName("GtkxPlainNoProps") });
        const store = new Gio.ListStore({ itemType: TYPE_OBJECT });
        store.append(new Plain());
        expect(store.getNItems()).toBe(1);
    });
});
