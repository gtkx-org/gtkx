import * as Gio from "@gtkx/gi/gio";
import { Object as GObject, TYPE_OBJECT } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { callParent, registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "./helpers/unique-name.js";

type Measurement = [number, number, number, number];

const LABEL_TEXT = "hello world";
const uniqueName = createTypeNameFactory("_");

const measureWidth = (label: Gtk.Label): Measurement => label.measure(Gtk.Orientation.HORIZONTAL, -1);
const plainWidth = (): number => measureWidth(new Gtk.Label({ label: LABEL_TEXT }))[0];

const menuWith = <T extends Gio.Menu>(menu: T, items: number): T => {
    for (let index = 0; index < items; index++) {
        menu.append(`item ${String(index)}`, null);
    }

    return menu;
};

describe("callParent — class vtable slots", () => {
    it("runs the parent implementation and returns its scalar out parameters", () => {
        class MeasuringLabel extends Gtk.Label {
            override vfuncMeasure(orientation: Gtk.Orientation, forSize: number): Measurement {
                const [minimum, natural] = callParent(
                    MeasuringLabel,
                    "vfuncMeasure",
                    this,
                    orientation,
                    forSize,
                ) as Measurement;

                return [minimum + 10, natural + 10, -1, -1];
            }
        }

        registerClass(MeasuringLabel, { typeName: uniqueName("GtkxChainUpMeasuringLabel") });
        const width = plainWidth();
        expect(width).toBeGreaterThan(0);
        expect(measureWidth(new MeasuringLabel({ label: LABEL_TEXT }))).toEqual([width + 10, width + 10, -1, -1]);
    });

    it("runs the parent implementation of a slot with a primary return value", () => {
        class CountingMenu extends Gio.Menu {
            override vfuncGetNItems(): number {
                return (callParent(CountingMenu, "vfuncGetNItems", this) as number) + 100;
            }
        }

        registerClass(CountingMenu, { typeName: uniqueName("GtkxChainUpCountingMenu") });
        const plain = menuWith(new Gio.Menu(), 3);
        const counting = menuWith(new CountingMenu(), 3);
        expect(plain.getNItems()).toBe(3);
        expect(counting.getNItems()).toBe(103);
    });
});

describe("callParent — hierarchy depth", () => {
    it("reaches exactly one level up in a two-level hierarchy", () => {
        class InnerLabel extends Gtk.Label {
            override vfuncMeasure(orientation: Gtk.Orientation, forSize: number): Measurement {
                const [minimum, natural] = callParent(
                    InnerLabel,
                    "vfuncMeasure",
                    this,
                    orientation,
                    forSize,
                ) as Measurement;

                return [minimum + 10, natural + 10, -1, -1];
            }
        }

        class OuterLabel extends InnerLabel {
            override vfuncMeasure(orientation: Gtk.Orientation, forSize: number): Measurement {
                const [minimum, natural] = callParent(
                    OuterLabel,
                    "vfuncMeasure",
                    this,
                    orientation,
                    forSize,
                ) as Measurement;

                return [minimum + 10, natural + 10, -1, -1];
            }
        }

        registerClass(InnerLabel, { typeName: uniqueName("GtkxChainUpInnerLabel") });
        registerClass(OuterLabel, { typeName: uniqueName("GtkxChainUpOuterLabel") });
        const width = plainWidth();
        expect(measureWidth(new InnerLabel({ label: LABEL_TEXT }))[0]).toBe(width + 10);
        expect(measureWidth(new OuterLabel({ label: LABEL_TEXT }))[0]).toBe(width + 20);
    });
});

describe("callParent — construct-time slots", () => {
    it("runs the parent implementation of `vfuncConstructed` from inside the override", () => {
        const order: string[] = [];

        class ChainedLabel extends Gtk.Label {
            override vfuncConstructed(): void {
                callParent(ChainedLabel, "vfuncConstructed", this);
                order.push("after-parent");
            }
        }

        registerClass(ChainedLabel, { typeName: uniqueName("GtkxChainUpConstructedLabel") });
        const label = new ChainedLabel({ label: LABEL_TEXT });
        expect(order).toEqual(["after-parent"]);
        expect(measureWidth(label)[0]).toBe(plainWidth());
    });
});

describe("callParent — interface vtable slots", () => {
    it("runs the interface implementation the parent type carries", () => {
        class CountingStore extends Gio.ListStore {
            override vfuncGetNItems(): number {
                return (callParent(CountingStore, "vfuncGetNItems", this) as number) + 100;
            }
        }

        registerClass(CountingStore, { typeName: uniqueName("GtkxChainUpCountingStore") });
        const store = new CountingStore({ itemType: TYPE_OBJECT });
        const plain = new Gio.ListStore({ itemType: TYPE_OBJECT });

        for (const target of [store, plain]) {
            target.append(new GObject({}));
            target.append(new GObject({}));
        }

        expect(plain.getNItems()).toBe(2);
        expect(store.getNItems()).toBe(102);
    });
});

describe("callParent — rejected calls", () => {
    it("reports a slot the parent type leaves empty", () => {
        class CustomApplication extends Gio.Application {}
        registerClass(CustomApplication, { typeName: uniqueName("GtkxChainUpApplication") });
        const application = new CustomApplication({});

        expect(() => callParent(CustomApplication, "vfuncRunMainloop", application)).toThrow(
            /ApplicationClass\.run_mainloop.*provides no implementation/,
        );
    });

    it("reports a method the class inherits no vtable slot for", () => {
        class PlainLabel extends Gtk.Label {}
        registerClass(PlainLabel, { typeName: uniqueName("GtkxChainUpPlainLabel") });

        expect(() => callParent(PlainLabel, "notAVfunc", new PlainLabel())).toThrow(
            /PlainLabel inherits no 'notAVfunc' vtable slot/,
        );
    });

    it("reports a class that was never registered", () => {
        class UnregisteredLabel extends Gtk.Label {}

        expect(() =>
            callParent(UnregisteredLabel, "vfuncMeasure", new Gtk.Label({}), Gtk.Orientation.HORIZONTAL, -1),
        ).toThrow(/UnregisteredLabel was never passed to registerClass/);
    });

    it("reports an argument count that does not match the slot", () => {
        class ArityLabel extends Gtk.Label {}
        registerClass(ArityLabel, { typeName: uniqueName("GtkxChainUpArityLabel") });

        expect(() => callParent(ArityLabel, "vfuncMeasure", new ArityLabel({}), Gtk.Orientation.HORIZONTAL)).toThrow(
            /WidgetClass\.measure expects 2 arguments, received 1/,
        );
    });
});

describe("callParent — caller-allocated out parameters", () => {
    it("includes the caller-allocated slot in the result tuple", () => {
        class BorderedView extends Gtk.ColumnView {
            override vfuncGetBorder(border: Gtk.Border): [boolean, Gtk.Border] {
                return callParent(BorderedView, "vfuncGetBorder", this, border) as [boolean, Gtk.Border];
            }
        }

        registerClass(BorderedView, { typeName: uniqueName("BorderedView") });
        const view = new BorderedView();
        const border = new Gtk.Border();
        const result = view.vfuncGetBorder(border);
        expect(result).toHaveLength(2);
        expect(result[1]).toBe(border);
    });
});
