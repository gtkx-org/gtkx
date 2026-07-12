import { registerClass } from "@gtkx/ffi";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 30000 });

class Item extends GObject.Object {
    value = 0;
}
registerClass(Item, { typeName: "GtkxCapabilityItem" });

class VirtualList extends GObject.Object<Gio.ListModelSignalHandlers> implements Gio.ListModel {
    size = 0;
    declare itemsChanged: Gio.ListModel["itemsChanged"];
    getItemType(): bigint {
        return Item.prototype.__type__;
    }
    getNItems(): number {
        return this.size;
    }
    getItem(position: number): Item | null {
        if (position >= this.size) return null;
        const item = new Item();
        item.value = position;
        return item;
    }
    setSize(next: number): void {
        const old = this.size;
        if (next === old) return;
        this.size = next;
        if (next > old) this.itemsChanged(old, 0, next - old);
        else this.itemsChanged(next, old - next, 0);
    }
}
registerClass(VirtualList, { typeName: "GtkxCapabilityVirtualList", implements: [Gio.ListModel] });

describe("JS-implemented Gio.ListModel", () => {
    it("conforms to Gio.ListModel and reports lazy items", () => {
        const list = new VirtualList();
        expect(list instanceof Gio.ListModel).toBe(true);
        list.setSize(1000);
        expect(list.getNItems()).toBe(1000);
        const item = list.getItem(42) as Item | null;
        expect(item).not.toBeNull();
        expect(Reflect.get(item as object, "value")).toBe(42);
        expect(list.getItem(1000)).toBeNull();
    });

    it("drives a GtkGridView and a GtkSortListModel without materializing everything", () => {
        const list = new VirtualList();
        list.setSize(500_000);
        const sorter = Gtk.CustomSorter.new((a, b) => {
            const va = Reflect.get(a as object, "value") as number;
            const vb = Reflect.get(b as object, "value") as number;
            return vb - va;
        });
        const sortModel = Gtk.SortListModel.new(list, sorter);
        const selection = new Gtk.MultiSelection({ model: sortModel });
        const factory = Gtk.SignalListItemFactory.new();
        factory.on("setup", (li) => {
            if (li instanceof Gtk.ListItem) li.setChild(new Gtk.Label());
        });
        const grid = new Gtk.GridView({ model: selection, factory });
        expect(grid.getModel()).toBe(selection);
        expect(selection.getNItems()).toBe(500_000);
        const first = list.getItem(0) as Item | null;
        expect(Reflect.get(first as object, "value")).toBe(0);
    });

    it("supports .on('items-changed') directly on the JS-implemented model", () => {
        const list = new VirtualList();
        let lastAdded = -1;
        let lastRemoved = -1;
        list.on("items-changed", (_pos, removed, added) => {
            lastRemoved = removed as number;
            lastAdded = added as number;
        });
        list.setSize(8);
        expect(lastAdded).toBe(8);
        expect(lastRemoved).toBe(0);
        list.setSize(10);
        expect(lastAdded).toBe(2);
        list.setSize(3);
        expect(lastRemoved).toBe(7);
        expect(lastAdded).toBe(0);
    });

    it("delegates non-interface signals (notify) through to GObject.Object", () => {
        const list = new VirtualList();
        const handlerId = list.connect("notify", () => {});
        expect(typeof handlerId).toBe("number");
        expect(handlerId).toBeGreaterThan(0);
    });

    it("emits items-changed so a wrapping GTK model observes growth", () => {
        const list = new VirtualList();
        const wrapper = Gtk.SortListModel.new(list, null);
        let lastAdded = -1;
        wrapper.on("items-changed", (_pos, _removed, added) => {
            lastAdded = added as number;
        });
        list.setSize(8);
        expect(wrapper.getNItems()).toBe(8);
        expect(lastAdded).toBe(8);
    });

    it("sorts a large virtual model incrementally without blocking the loop", async () => {
        const list = new VirtualList();
        list.setSize(200_000);
        const sortModel = Gtk.SortListModel.new(list, null);
        sortModel.setIncremental(true);
        const sorter = Gtk.CustomSorter.new((a, b) => {
            const va = Reflect.get(a as object, "value") as number;
            const vb = Reflect.get(b as object, "value") as number;
            return vb - va;
        });

        const t0 = performance.now();
        sortModel.setSorter(sorter);
        const setSorterMs = performance.now() - t0;

        expect(setSorterMs).toBeLessThan(500);
        expect(sortModel.getPending()).toBeGreaterThan(0);

        const start = performance.now();
        while (sortModel.getPending() > 0) {
            await new Promise((r) => setTimeout(r, 0));
            if (performance.now() - start > 60000) throw new Error("incremental sort did not drain");
        }
        expect(sortModel.getPending()).toBe(0);
        expect(sortModel.getNItems()).toBe(200_000);
    });
});

describe("registerClass hot reload", () => {
    it("rebinds an existing type name instead of failing on re-registration", () => {
        class First extends GObject.Object {
            tag = "first";
        }
        registerClass(First, { typeName: "GtkxHotReloadReuse" });
        const gtype = Reflect.get(First.prototype, "__type__") as bigint;
        expect(gtype).not.toBe(0n);

        class Second extends GObject.Object {
            tag = "second";
        }
        expect(() => registerClass(Second, { typeName: "GtkxHotReloadReuse" })).not.toThrow();
        expect(Reflect.get(Second.prototype, "__type__")).toBe(gtype);
        expect(new Second() instanceof GObject.Object).toBe(true);
    });
});
