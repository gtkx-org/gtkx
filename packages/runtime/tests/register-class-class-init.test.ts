import type { ParamSpec } from "@gtkx/gi/gobject";
import { Object as GObject, ObjectClass, ParamFlags, paramSpecInt, typeFromName } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getClassType, registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { newObjectFromNative } from "./helpers/native-object.js";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");

const intSpec = (name: string): ParamSpec => paramSpecInt(name, null, null, 0, 255, 0, ParamFlags.READWRITE);

describe("registerClass — cssName", () => {
    it("gives every instance of a widget subclass the registered CSS name", () => {
        class FancyLabel extends Gtk.Label {}

        registerClass(FancyLabel, {
            typeName: uniqueName("GtkxCssNameLabel"),
            cssName: "fancy-label",
        });

        expect(new FancyLabel().getCssName()).toBe("fancy-label");
    });

    it("applies the CSS name to instances a native caller creates", () => {
        const name = uniqueName("GtkxCssNameNativeLabel");
        class NativeFancyLabel extends Gtk.Label {}
        registerClass(NativeFancyLabel, { typeName: name, cssName: "native-fancy" });
        const instance = newObjectFromNative(typeFromName(name)) as Gtk.Label;
        expect(instance.getCssName()).toBe("native-fancy");
    });

    it("leaves a subclass registered without a cssName on the parent's CSS name", () => {
        class PlainLabel extends Gtk.Label {}
        registerClass(PlainLabel, { typeName: uniqueName("GtkxCssNamePlainLabel") });
        expect(new PlainLabel().getCssName()).toBe("label");
    });

    it("rejects a cssName on a class that does not extend Gtk.Widget", () => {
        class NotAWidget extends GObject {}

        expect(() =>
            registerClass(NotAWidget, {
                typeName: uniqueName("GtkxCssNameNonWidget"),
                cssName: "never-lands",
            }),
        ).toThrow();
    });
});

describe("registerClass — classInit", () => {
    it("hands a widget subclass its class struct for actions, shortcuts and layout managers", () => {
        const name = uniqueName("GtkxClassInitWidget");
        const activations: string[] = [];
        class ActionWidget extends Gtk.Widget {}

        registerClass(ActionWidget, {
            typeName: name,
            classInit: (typeStruct: Gtk.WidgetClass) => {
                typeStruct.installAction("demo.hello", null, (widget, actionName) => {
                    expect(widget).toBeInstanceOf(ActionWidget);
                    activations.push(actionName);
                });

                typeStruct.addShortcut(
                    Gtk.Shortcut.new(
                        Gtk.ShortcutTrigger.parseString("<Control>k"),
                        Gtk.ShortcutAction.parseString("action(demo.hello)"),
                    ),
                );

                typeStruct.setLayoutManagerType(getClassType(Gtk.BoxLayout));
            },
        });

        const widget = newObjectFromNative(typeFromName(name)) as Gtk.Widget;
        expect(widget.activateAction("demo.hello", null)).toBe(true);
        expect(activations).toEqual(["demo.hello"]);
        expect(widget.getLayoutManager()).toBeInstanceOf(Gtk.BoxLayout);
    });

    it("runs the hook exactly once, synchronously, during registration", () => {
        const calls: object[] = [];
        class CountingWidget extends Gtk.Label {}

        registerClass(CountingWidget, {
            typeName: uniqueName("GtkxClassInitOnce"),
            classInit: (typeStruct) => {
                calls.push(typeStruct);
            },
        });

        expect(calls).toHaveLength(1);
        expect(new CountingWidget()).toBeInstanceOf(CountingWidget);
        expect(calls).toHaveLength(1);
    });
});

describe("registerClass — classInit beyond the direct parent", () => {
    it("reaches Gtk.WidgetClass members from a subclass of a deeper widget type", () => {
        const name = uniqueName("GtkxClassInitButton");
        const activations: string[] = [];
        class ActionButton extends Gtk.Button {}

        registerClass(ActionButton, {
            typeName: name,
            classInit: (typeStruct: Gtk.WidgetClass) => {
                typeStruct.installAction("demo.deep", null, (_widget, actionName) => {
                    activations.push(actionName);
                });
            },
        });

        const button = new ActionButton();
        expect(button.activateAction("demo.deep", null)).toBe(true);
        expect(activations).toEqual(["demo.deep"]);
    });

    it("serves GObject.ObjectClass members to a non-widget subclass", () => {
        const seen: string[] = [];

        class Tinted extends GObject {
            declare tintLevel: number;
        }

        registerClass(Tinted, {
            typeName: uniqueName("GtkxClassInitPlain"),
            properties: { tintLevel: intSpec("tint-level") },
            classInit: (typeStruct: ObjectClass) => {
                seen.push(typeStruct.findProperty("tint-level").getName());
            },
        });

        expect(seen).toEqual(["tint-level"]);
    });
});

describe("registerClass — classInit errors", () => {
    it("propagates an exception the hook throws out of registerClass", () => {
        class Exploding extends Gtk.Label {}

        expect(() =>
            registerClass(Exploding, {
                typeName: uniqueName("GtkxClassInitThrows"),
                classInit: () => {
                    throw new Error("class init failed");
                },
            }),
        ).toThrow();
    });
});
