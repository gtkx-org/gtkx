import * as Gio from "@gtkx/gi/gio";
import { ObjectClass, ParamSpec, TYPE_INVALID, TYPE_STRING } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getClassType, registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "../helpers/unique-name.js";

const uniqueName = createTypeNameFactory("Peek");

describe("GTypeStruct peek — happy path", () => {
    it("finds a property spec on a peeked class struct", () => {
        const spec = ObjectClass.peek(Gtk.Label).findProperty("label");
        expect(spec).toBeInstanceOf(ParamSpec);
        expect(spec.getName()).toBe("label");
    });

    it("lists the properties of a peeked class struct", () => {
        const specs = ObjectClass.peek(Gtk.Label).listProperties();
        expect(specs.length).toBeGreaterThan(0);
        expect(specs.map((spec) => spec.getName())).toContain("label");
    });

    it("peeks a widget class struct and reads its CSS name", () => {
        expect(Gtk.WidgetClass.peek(Gtk.Label).getCssName()).toBe("label");
        expect(Gtk.WidgetClass.peek(Gtk.Button).getCssName()).toBe("button");
    });

    it("peeks by raw GType as well as by wrapper class", () => {
        const byType = ObjectClass.peek(getClassType(Gtk.Button));
        expect(byType.findProperty("label").getName()).toBe("label");
        expect(Gtk.WidgetClass.peek(getClassType(Gtk.Button)).getCssName()).toBe("button");
    });
});

describe("GTypeStruct peek — edge cases", () => {
    it("peeks a type created through registerClass before any instance exists", () => {
        class PeekedLabel extends Gtk.Label {}
        registerClass(PeekedLabel, { typeName: uniqueName("GtkxPeekLabel"), cssName: "peeked-label" });
        expect(Gtk.WidgetClass.peek(PeekedLabel).getCssName()).toBe("peeked-label");
        expect(ObjectClass.peek(PeekedLabel).findProperty("label").getName()).toBe("label");
    });

    it("peeks the class struct of a registered non-widget subclass through ObjectClass", () => {
        class PeekedAction extends Gio.SimpleAction {}
        registerClass(PeekedAction, { typeName: uniqueName("GtkxPeekAction") });
        const specs = ObjectClass.peek(PeekedAction).listProperties();
        expect(specs.map((spec) => spec.getName())).toContain("name");
    });
});

describe("GTypeStruct peek — error paths", () => {
    it("rejects a GType that is not a GObject type", () => {
        expect(() => ObjectClass.peek(TYPE_STRING)).toThrow();
        expect(() => Gtk.WidgetClass.peek(TYPE_STRING)).toThrow();
    });

    it("rejects the invalid GType", () => {
        expect(() => ObjectClass.peek(TYPE_INVALID)).toThrow();
    });

    it("rejects a class that carries no GType", () => {
        class Plain {
            value = 0;
        }

        expect(() => ObjectClass.peek(Plain)).toThrow();
    });

    it("rejects peeking a non-widget type as a widget class struct", () => {
        expect(() => Gtk.WidgetClass.peek(Gio.SimpleAction)).toThrow();
    });
});
