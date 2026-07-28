import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

const valueObject = (value: number): ValueObject => {
    const object = new ValueObject();
    object.value = value;

    return object;
};

const itemValue = (item: GObject.Object | null): number => {
    expect(item).toBeInstanceOf(ValueObject);

    return item instanceof ValueObject ? item.value : 0;
};

const valueStore = (...values: number[]): Gio.ListStore => {
    const store = Gio.ListStore.new(ValueObject.prototype.__type__);

    for (const value of values) {
        store.append(valueObject(value));
    }

    return store;
};

const storeValues = (model: Gio.ListModel): number[] => {
    const values: number[] = [];

    for (let index = 0; index < model.getNItems(); index += 1) {
        values.push(itemValue(model.getItem(index)));
    }

    return values;
};

class ValueObject extends GObject.Object {
    value = 0;
}

registerClass(ValueObject, { typeName: "GtkxTestItemComparatorValueObject" });

describe("GObject item comparators", () => {
    it("passes item wrappers to a ListStore sort comparator", () => {
        const store = valueStore(3, 1, 2);
        store.sort((a, b) => itemValue(a) - itemValue(b));
        expect(storeValues(store)).toEqual([1, 2, 3]);
    });

    it("passes item wrappers to a ListStore insertSorted comparator", () => {
        const store = valueStore(1, 3);
        const position = store.insertSorted(valueObject(2), (a, b) => itemValue(a) - itemValue(b));
        expect(position).toBe(1);
        expect(storeValues(store)).toEqual([1, 2, 3]);
    });

    it("passes item wrappers to a ListStore equality comparator", () => {
        const store = valueStore(1, 2, 3);
        const target = valueObject(2);
        const [found, position] = store.findWithEqualFuncFull(target, (a, b) => itemValue(a) === itemValue(b));
        expect(found).toBe(true);
        expect(position).toBe(1);
    });

    it("passes item wrappers to a CustomSorter comparator", () => {
        const store = valueStore(2, 3, 1);
        const sorter = Gtk.CustomSorter.new((a, b) => itemValue(a) - itemValue(b));
        const sortModel = Gtk.SortListModel.new(store, sorter);
        expect(storeValues(sortModel)).toEqual([1, 2, 3]);
    });
});
