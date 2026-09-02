import * as Gio from "@gtkx/gi/gio";
import { Object as GObject, TYPE_OBJECT } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import {
    getClassType,
    getInstanceType,
    newObjectWithProperties,
    registerClass,
    registerWrapperClass,
} from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "./helpers/unique-name.js";

type Measurement = [number, number, number, number];

const LABEL_TEXT = "hello world";
const uniqueName = createTypeNameFactory("_");

const measureWidth = (label: Gtk.Label): number => label.measure(Gtk.Orientation.HORIZONTAL, -1)[0];
const plainWidth = (): number => measureWidth(new Gtk.Label({ label: LABEL_TEXT }));
const grown = ([minimum, natural]: Measurement, by: number): Measurement => [minimum + by, natural + by, -1, -1];

const storeWith = <T extends Gio.ListStore>(store: T, items: number): T => {
    for (let index = 0; index < items; index++) {
        store.append(new GObject({}));
    }

    return store;
};

const uninitializedSocket = (family: Gio.SocketFamily): Gio.Socket =>
    newObjectWithProperties(
        getClassType(Gio.Socket),
        { family, type: Gio.SocketType.STREAM, protocol: 0 },
        Object.create(Gio.Socket.prototype) as Gio.Socket,
    );

describe("super.vfunc — class vtable slots", () => {
    it("chains up through a class that declares no vtable of its own", () => {
        class MeasuringLabel extends Gtk.Label {
            override vfuncMeasure(orientation: Gtk.Orientation, forSize: number): Measurement {
                return grown(super.vfuncMeasure(orientation, forSize), 10);
            }
        }

        registerClass(MeasuringLabel, { typeName: uniqueName("GtkxSuperMeasuringLabel") });
        const width = plainWidth();
        expect(width).toBeGreaterThan(0);

        expect(new MeasuringLabel({ label: LABEL_TEXT }).measure(Gtk.Orientation.HORIZONTAL, -1)).toEqual([
            width + 10,
            width + 10,
            -1,
            -1,
        ]);
    });

    it("invokes the implementation of the wrapper class the instance already is", () => {
        class ProbingLabel extends Gtk.Label {
            measureThroughSlot(): Measurement {
                return this.vfuncMeasure(Gtk.Orientation.HORIZONTAL, -1);
            }
        }

        registerClass(ProbingLabel, { typeName: uniqueName("GtkxSuperProbingLabel") });
        const [minimum] = new ProbingLabel({ label: LABEL_TEXT }).measureThroughSlot();
        expect(minimum).toBeGreaterThan(0);
        expect(minimum).toBe(measureWidth(new Gtk.Label({ label: LABEL_TEXT })));
    });

    it("reaches one level up at every step of a hierarchy", () => {
        class InnerLabel extends Gtk.Label {
            override vfuncMeasure(orientation: Gtk.Orientation, forSize: number): Measurement {
                return grown(super.vfuncMeasure(orientation, forSize), 10);
            }
        }

        class OuterLabel extends InnerLabel {
            override vfuncMeasure(orientation: Gtk.Orientation, forSize: number): Measurement {
                return grown(super.vfuncMeasure(orientation, forSize), 10);
            }
        }

        registerClass(InnerLabel, { typeName: uniqueName("GtkxSuperInnerLabel") });
        registerClass(OuterLabel, { typeName: uniqueName("GtkxSuperOuterLabel") });
        const width = plainWidth();
        expect(measureWidth(new InnerLabel({ label: LABEL_TEXT }))).toBe(width + 10);
        expect(measureWidth(new OuterLabel({ label: LABEL_TEXT }))).toBe(width + 20);
    });
});

describe("super.vfunc — construct-time slots", () => {
    it("reaches each level of a two-level hierarchy while the object is constructed", () => {
        const order: string[] = [];

        class BaseObject extends GObject {
            override vfuncConstructed(): void {
                order.push("Base");
                super.vfuncConstructed();
            }
        }

        class DerivedObject extends BaseObject {
            override vfuncConstructed(): void {
                order.push("Derived-pre");
                super.vfuncConstructed();
                order.push("Derived-post");
            }
        }

        registerClass(BaseObject, { typeName: uniqueName("GtkxSuperConstructedBase") });
        registerClass(DerivedObject, { typeName: uniqueName("GtkxSuperConstructedDerived") });
        expect(new DerivedObject()).toBeInstanceOf(BaseObject);
        expect(order).toEqual(["Derived-pre", "Base", "Derived-post"]);
    });

    it("reaches the widget implementation the outermost wrapper class carries", () => {
        const constructed: object[] = [];

        class ConstructedLabel extends Gtk.Label {
            override vfuncConstructed(): void {
                super.vfuncConstructed();
                constructed.push(this);
            }
        }

        registerClass(ConstructedLabel, { typeName: uniqueName("GtkxSuperConstructedLabel") });
        const label = new ConstructedLabel({ label: LABEL_TEXT });
        expect(constructed).toEqual([label]);
        const box = new Gtk.Box();
        box.append(label);
        expect(label.getParent()).toBe(box);
        expect(measureWidth(label)).toBe(plainWidth());
        label.setLabel("still a working label");
        expect(label.getLabel()).toBe("still a working label");
    });
});

describe("vfunc — interface vtable slots a wrapper class already carries", () => {
    it("calls the implementation the wrapper class carries for an inherited interface", () => {
        class MyBox extends Gtk.Box {}
        registerClass(MyBox, { typeName: uniqueName("GtkxInheritedBox") });
        const box = new MyBox();
        box.vfuncSetId("frame");
        expect(box.vfuncGetId()).toBe("frame");
        expect(box.getBuildableId()).toBe("frame");
    });

    it("chains up to the widget implementation of an inherited interface slot", () => {
        class TaggedBox extends Gtk.Box {
            override vfuncSetId(id: string): void {
                super.vfuncSetId(`${id}-tagged`);
            }
        }

        registerClass(TaggedBox, { typeName: uniqueName("GtkxTaggedBox") });
        const box = new TaggedBox();
        box.vfuncSetId("frame");
        expect(box.getBuildableId()).toBe("frame-tagged");
        expect(box.vfuncGetId()).toBe("frame-tagged");
    });
});

describe("super.vfunc — interface vtable slots", () => {
    it("chains up to the implementation the interface vtable carries", () => {
        class CountingStore extends Gio.ListStore {
            override vfuncGetNItems(): number {
                return super.vfuncGetNItems() + 100;
            }
        }

        registerClass(CountingStore, { typeName: uniqueName("GtkxSuperCountingStore") });
        expect(storeWith(new Gio.ListStore({ itemType: TYPE_OBJECT }), 2).getNItems()).toBe(2);
        expect(storeWith(new CountingStore({ itemType: TYPE_OBJECT }), 2).getNItems()).toBe(102);
    });

    it("does not re-enter the override when a further subclass inherits it", () => {
        class MiddleStore extends Gio.ListStore {
            override vfuncGetNItems(): number {
                return super.vfuncGetNItems() + 100;
            }
        }

        class LeafStore extends MiddleStore {}
        registerClass(MiddleStore, { typeName: uniqueName("GtkxSuperMiddleStore") });
        registerClass(LeafStore, { typeName: uniqueName("GtkxSuperLeafStore") });
        expect(storeWith(new LeafStore({ itemType: TYPE_OBJECT }), 2).getNItems()).toBe(102);
    });
});

describe("super.vfunc — caller-allocated out parameters", () => {
    it("passes the caller-allocated record through and returns it in the tuple", () => {
        const seen: Gtk.Border[] = [];

        class BorderedView extends Gtk.ColumnView {
            override vfuncGetBorder(border: Gtk.Border): [boolean, Gtk.Border] {
                const [isSet, filled] = super.vfuncGetBorder(border);
                seen.push(filled);

                return [isSet, filled];
            }
        }

        registerClass(BorderedView, { typeName: uniqueName("GtkxSuperBorderedView") });
        const view = new BorderedView();
        const border = new Gtk.Border();
        const result = view.vfuncGetBorder(border);
        expect(result).toHaveLength(2);
        expect(result[1]).toBe(border);
        expect(seen).toEqual([border]);
        const [, publicBorder] = view.getBorder();
        expect(publicBorder).toBeInstanceOf(Gtk.Border);
        expect(seen).toHaveLength(2);
    });
});

describe("super.vfunc — recursion", () => {
    it("reaches the parent implementation instead of the override the instance carries", () => {
        const depth = { value: 0 };

        class GuardedLabel extends Gtk.Label {
            override vfuncMeasure(orientation: Gtk.Orientation, forSize: number): Measurement {
                depth.value += 1;

                try {
                    if (depth.value > 1) {
                        throw new Error("GuardedLabel.vfuncMeasure was re-entered");
                    }

                    return grown(super.vfuncMeasure(orientation, forSize), 10);
                } finally {
                    depth.value -= 1;
                }
            }

            measureThroughWrapperSlot(): Measurement {
                return super.vfuncMeasure(Gtk.Orientation.HORIZONTAL, -1);
            }
        }

        registerClass(GuardedLabel, { typeName: uniqueName("GtkxSuperGuardedLabel") });
        const width = plainWidth();
        const guarded = new GuardedLabel({ label: LABEL_TEXT });
        expect(measureWidth(guarded)).toBe(width + 10);
        expect(guarded.measureThroughWrapperSlot()[0]).toBe(width);
        expect(depth.value).toBe(0);
    });
});

describe("super vfunc — a derived class registered as a wrapper", () => {
    it("chains up without recursing when the subclass is also a registered wrapper", () => {
        class Marked extends Gtk.Label {
            override vfuncMeasure(orientation: Gtk.Orientation, forSize: number): Measurement {
                const [minimum, natural] = super.vfuncMeasure(orientation, forSize);

                return [minimum + 10, natural + 10, -1, -1];
            }
        }

        registerClass(Marked, { typeName: uniqueName("Marked") });
        const label = new Marked({ label: "hello world" });
        registerWrapperClass(Marked, getInstanceType(label));
        const [minimum, natural] = label.measure(Gtk.Orientation.HORIZONTAL, -1);
        const [plainMinimum] = new Gtk.Label({ label: "hello world" }).measure(Gtk.Orientation.HORIZONTAL, -1);
        expect(minimum).toBe(plainMinimum + 10);
        expect(natural).toBe(plainMinimum + 10);
    });
});

describe("vfunc — slots that take a GError", () => {
    it("throws what the slot writes into the trailing GError", () => {
        const socket = uninitializedSocket(Gio.SocketFamily.INVALID);

        expect(() => socket.vfuncInit(null)).toThrow();
    });

    it("returns normally out of a slot that writes no error", () => {
        const socket = uninitializedSocket(Gio.SocketFamily.IPV4);

        expect(socket.vfuncInit(null)).toBe(true);
    });
});
