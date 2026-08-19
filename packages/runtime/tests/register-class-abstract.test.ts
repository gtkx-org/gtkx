import * as Gio from "@gtkx/gi/gio";
import { Object as GObject, TYPE_OBJECT, TypeFlags, typeFromName, typeTestFlags } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");

describe("registerClass — abstract types", () => {
    it("registers an abstract GType whose registered subclass instantiates", () => {
        class Shape extends GObject {}
        const name = uniqueName("GtkxAbstractShape");
        registerClass(Shape, { typeName: name, abstract: true });
        expect(typeTestFlags(typeFromName(name), TypeFlags.ABSTRACT)).toBe(true);
        class Circle extends Shape {}
        registerClass(Circle, { typeName: uniqueName("GtkxAbstractShapeCircle") });
        const circle = new Circle();
        expect(circle).toBeInstanceOf(Circle);
        expect(circle).toBeInstanceOf(Shape);
    });

    it("leaves the abstract flag off a registered subclass", () => {
        class Backend extends GObject {}
        registerClass(Backend, { typeName: uniqueName("GtkxAbstractBackend"), abstract: true });
        class LocalBackend extends Backend {}
        const concreteName = uniqueName("GtkxLocalBackend");
        registerClass(LocalBackend, { typeName: concreteName });
        expect(typeTestFlags(typeFromName(concreteName), TypeFlags.ABSTRACT)).toBe(false);
        expect(new LocalBackend()).toBeInstanceOf(Backend);
    });

    it("registers an instantiable type when abstract is false", () => {
        class Plain extends Gtk.Label {}
        const name = uniqueName("GtkxNonAbstractLabel");
        registerClass(Plain, { typeName: name, abstract: false });
        expect(typeTestFlags(typeFromName(name), TypeFlags.ABSTRACT)).toBe(false);
        expect(new Plain()).toBeInstanceOf(Gtk.Label);
    });

    it("installs vfunc overrides of an abstract base on its concrete subclass", () => {
        class CountedStore extends Gio.ListStore {
            override vfuncGetNItems(): number {
                return 7;
            }
        }

        registerClass(CountedStore, { typeName: uniqueName("GtkxAbstractStore"), abstract: true });
        class RealStore extends CountedStore {}
        registerClass(RealStore, { typeName: uniqueName("GtkxAbstractStoreReal") });
        const store = new RealStore({ itemType: TYPE_OBJECT });
        expect(store.getNItems()).toBe(7);
    });
});

describe("registerClass — abstract instantiation errors", () => {
    it("throws when an abstract registered class is instantiated directly", () => {
        class Port extends GObject {}
        registerClass(Port, { typeName: uniqueName("GtkxAbstractPort"), abstract: true });
        expect(() => new Port()).toThrow();
    });

    it("throws for the abstract base even after a subclass registers", () => {
        class Device extends GObject {}
        registerClass(Device, { typeName: uniqueName("GtkxAbstractDevice"), abstract: true });
        class UsbDevice extends Device {}
        registerClass(UsbDevice, { typeName: uniqueName("GtkxAbstractUsbDevice") });
        expect(new UsbDevice()).toBeInstanceOf(Device);
        expect(() => new Device()).toThrow();
    });
});
