import * as Gio from "@gtkx/gi/gio";
import { Object as GObject, ParamFlags, paramSpecString, Value } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getClassType, registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");

const makeRowClass = () => {
    class Row extends GObject {
        declare title: string;
    }

    registerClass(Row, {
        typeName: uniqueName("GtkxExprRow"),
        properties: { title: paramSpecString("title", null, null, "", ParamFlags.READWRITE) },
    });

    return Row;
};

const makeSorterClass = () => {
    class TitleSorter extends Gtk.Sorter {
        declare expression: Gtk.Expression | null;

        override vfuncCompare(): Gtk.Ordering {
            return Gtk.Ordering.EQUAL;
        }
    }

    registerClass(TitleSorter, {
        typeName: uniqueName("GtkxExprSorter"),
        properties: { expression: Gtk.paramSpecExpression("expression", "", "", ParamFlags.READWRITE) },
    });

    return TitleSorter;
};

const titleExpression = (): Gtk.Expression =>
    Gtk.PropertyExpression.new(getClassType(makeRowClass()), null, "title");

const evaluateTitle = (expression: Gtk.Expression | null, row: GObject): string | null => {
    const value = new Value();

    if (expression?.evaluate(row, value) !== true) {
        return null;
    }

    return value.getString();
};

describe("GtkExpression construct properties", () => {
    it("takes an expression through the constructor of a stock GTK class", () => {
        const Row = makeRowClass();
        const row = new Row();
        row.title = "delta";
        const expression = Gtk.PropertyExpression.new(getClassType(Row), null, "title");
        const sorter = new Gtk.StringSorter({ expression });
        expect(evaluateTitle(sorter.getExpression(), row)).toBe("delta");
    });

    it("takes an expression through a construct property JSX also exposes", () => {
        const Row = makeRowClass();
        const row = new Row();
        row.title = "charlie";
        const expression = Gtk.PropertyExpression.new(getClassType(Row), null, "title");
        const dropDown = new Gtk.DropDown({ expression });
        expect(evaluateTitle(dropDown.getExpression(), row)).toBe("charlie");
    });

    it("sorts a list model through an expression handed to the constructor", () => {
        const Row = makeRowClass();
        const store = Gio.ListStore.new(getClassType(Row));

        for (const title of ["delta", "alpha", "charlie"]) {
            const row = new Row();
            row.title = title;
            store.append(row);
        }

        const expression = Gtk.PropertyExpression.new(getClassType(Row), null, "title");
        const sorted = Gtk.SortListModel.new(store, new Gtk.StringSorter({ expression }));

        const titles = Array.from({ length: sorted.getNItems() }, (_, index) => {
            const item = sorted.getItem(index);

            return item === null ? "" : (Reflect.get(item, "title") as string);
        });

        expect(titles).toEqual(["alpha", "charlie", "delta"]);
    });
});

describe("registerClass with a Gtk.paramSpecExpression property", () => {
    it("reads the pspec default of an expression property", () => {
        const TitleSorter = makeSorterClass();
        expect(new TitleSorter().expression).toBeNull();
    });

    it("assigns an expression to the property after construction", () => {
        const TitleSorter = makeSorterClass();
        const sorter = new TitleSorter();
        const expression = titleExpression();
        sorter.expression = expression;
        expect(sorter.expression).toBe(expression);
    });

    it("takes the expression through the constructor", () => {
        const TitleSorter = makeSorterClass();
        const sorter = new TitleSorter({ expression: titleExpression() });
        expect(sorter.expression).toBeInstanceOf(Gtk.Expression);
    });

    it("serves the expression back through g_object_get_property", () => {
        const TitleSorter = makeSorterClass();
        const expression = titleExpression();
        const sorter = new TitleSorter({ expression });
        const read = new Value();
        read.init(getClassType(Gtk.Expression));
        sorter.getProperty("expression", read);
        const served = Gtk.valueGetExpression(read);
        expect(served).not.toBeNull();
        expect(served?.getValueType()).toBe(expression.getValueType());
    });
});
