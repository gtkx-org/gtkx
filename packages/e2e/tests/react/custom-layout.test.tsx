import * as Gtk from "@gtkx/gi/gtk";
import { expect, it } from "vitest";

const collect = async (): Promise<void> => {
    if (globalThis.gc === undefined) {
        throw new Error("Custom layout lifetime tests require --expose-gc");
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
    globalThis.gc();
    await new Promise<void>((resolve) => setImmediate(resolve));
};

const collectUntilReleased = async (references: WeakRef<object>[]): Promise<void> => {
    for (let round = 0; round < 30; round++) {
        await collect();
        if (references.every((reference) => reference.deref() === undefined)) {
            return;
        }
    }
};

it("keeps custom layout callbacks alive while a widget owns the layout and releases them afterward", async () => {
    const widget = new Gtk.Box({});
    const allocations: number[][] = [];
    const references = (() => {
        const requestMode = () => Gtk.SizeRequestMode.HEIGHT_FOR_WIDTH;
        const measure: Gtk.CustomMeasureFunc = (_widget, orientation, forSize) =>
            orientation === Gtk.Orientation.HORIZONTAL ? [17, 29, -1, -1] : [forSize, forSize, -1, -1];
        const allocate: Gtk.CustomAllocateFunc = (_widget, width, height, baseline) => {
            allocations.push([width, height, baseline]);
        };
        const layout = Gtk.CustomLayout.new(requestMode, measure, allocate);
        widget.setLayoutManager(layout);
        return [new WeakRef(layout), new WeakRef(requestMode), new WeakRef(measure), new WeakRef(allocate)];
    })();

    await collect();
    await collect();
    expect(widget.getRequestMode()).toBe(Gtk.SizeRequestMode.HEIGHT_FOR_WIDTH);
    expect(widget.measure(Gtk.Orientation.HORIZONTAL, -1)).toEqual([17, 29, -1, -1]);
    expect(widget.measure(Gtk.Orientation.VERTICAL, 40)).toEqual([40, 40, -1, -1]);
    widget.allocate(240, 80, -1, null);
    expect(allocations).toContainEqual([240, 80, -1]);
    expect(references.every((reference) => reference.deref() !== undefined)).toBe(true);

    widget.setLayoutManager(null);
    await collectUntilReleased(references);
    expect(references.every((reference) => reference.deref() === undefined)).toBe(true);
});

it("collects a custom layout whose callbacks capture the layout itself", async () => {
    const references = (() => {
        const measure: Gtk.CustomMeasureFunc = () => [layout.getWidget() === null ? 0 : 1, 1, -1, -1];
        const allocate: Gtk.CustomAllocateFunc = () => {
            layout.getWidget();
        };
        const layout = Gtk.CustomLayout.new(null, measure, allocate);
        return [new WeakRef(layout), new WeakRef(measure), new WeakRef(allocate)];
    })();

    await collectUntilReleased(references);
    expect(references.every((reference) => reference.deref() === undefined)).toBe(true);
});
