import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");

describe("vfunc out parameters written back through the C vtable", () => {
    it("writes a string and two integers", () => {
        class Ctx extends Gtk.IMContext {
            override vfuncGetSurroundingWithSelection(): [boolean, string, number, number] {
                return [true, "surrounding text", 4, 6];
            }
        }

        registerClass(Ctx, { typeName: uniqueName("GtkxCtxA") });
        expect(new Ctx({}).getSurroundingWithSelection()).toEqual([true, "surrounding text", 4, 6]);
    });

    it("writes a boxed value alongside a string", () => {
        const attributes = Pango.AttrList.new();

        class Ctx extends Gtk.IMContext {
            override vfuncGetPreeditString(): [string, Pango.AttrList, number] {
                return ["preedit", attributes, 2];
            }
        }

        registerClass(Ctx, { typeName: uniqueName("GtkxCtxB") });
        const [text, list, cursor] = new Ctx({}).getPreeditString();
        expect(text).toBe("preedit");
        expect(cursor).toBe(2);
        expect(list.toString()).toBe(attributes.toString());
    });

    it("writes a fundamental out parameter", () => {
        class Iter extends Gio.MenuAttributeIter {
            private isDone = false;

            override vfuncGetNext(): [boolean, string, GLib.Variant] {
                const wasDone = this.isDone;
                this.isDone = true;

                return [!wasDone, "label", GLib.Variant.newString("hi")];
            }
        }

        registerClass(Iter, { typeName: uniqueName("GtkxIterF") });
        const iterator = new Iter({});
        expect(iterator.getNext()).toEqual([true, "label", expect.anything()]);
        expect(iterator.getNext()[0]).toBe(false);
    });
});

describe("vfunc out parameters that carry GVariant data", () => {
    it("writes booleans, variant types and variants at once", () => {
        class Group extends Gio.SimpleActionGroup {
            override vfuncQueryAction(
                actionName: string,
            ): [boolean, boolean, GLib.VariantType, GLib.VariantType, GLib.Variant, GLib.Variant] {
                return [
                    actionName === "known",
                    true,
                    GLib.VariantType.new("s"),
                    GLib.VariantType.new("i"),
                    GLib.Variant.newString("hint"),
                    GLib.Variant.newString("state"),
                ];
            }
        }

        registerClass(Group, { typeName: uniqueName("GtkxGroupG") });
        const group = new Group({});
        const [isKnown, isEnabled, parameterType, stateType, , state] = group.queryAction("known");
        expect(isKnown).toBe(true);
        expect(isEnabled).toBe(true);
        expect(parameterType.dupString()).toBe("s");
        expect(stateType.dupString()).toBe("i");
        expect(state.getString()).toEqual(["state", 5]);
        expect(group.queryAction("other")[0]).toBe(false);
    });
});

describe("vfunc out arrays whose length parameter is folded away", () => {
    it("derives the length of an out array of objects", () => {
        const fontMap = new Gtk.Label({ label: "x" }).getPangoContext().getFontMap();

        if (fontMap === null) {
            throw new Error("The tests need a Pango font map");
        }

        const faces = fontMap.listFamilies()[0]?.listFaces() ?? [];
        expect(faces.length).toBeGreaterThan(0);

        class Family extends Pango.FontFamily {
            override vfuncListFaces(): Pango.FontFace[] {
                return faces;
            }
        }

        registerClass(Family, { typeName: uniqueName("GtkxFamilyD") });

        expect(new Family({}).listFaces().map((face) => face.getFaceName())).toEqual(
            faces.map((face) => face.getFaceName()),
        );
    });

    it("derives the length of an out array of numbers", () => {
        class Face extends Pango.FontFace {
            override vfuncListSizes(): number[] | null {
                return [8, 12, 16];
            }
        }

        registerClass(Face, { typeName: uniqueName("GtkxFaceH") });
        expect(new Face({}).listSizes()).toEqual([8, 12, 16]);
    });

    it("keeps a derived length in step with an array the implementation rebuilds", () => {
        let sizes = [1, 2];

        class Face extends Pango.FontFace {
            override vfuncListSizes(): number[] | null {
                return sizes;
            }
        }

        registerClass(Face, { typeName: uniqueName("GtkxFaceI") });
        const face = new Face({});
        expect(face.listSizes()).toEqual([1, 2]);
        sizes = [3, 4, 5, 6];
        expect(face.listSizes()).toEqual([3, 4, 5, 6]);
    });
});

describe("vfunc out hash tables", () => {
    it("writes the entries an implementation returns as a Map", () => {
        class Model extends Gio.MenuModel {
            override vfuncGetItemAttributes(): Map<string, GLib.Variant> {
                return new Map([["label", GLib.Variant.newString("hello")]]);
            }

            override vfuncGetNItems(): number {
                return 1;
            }
        }

        registerClass(Model, { typeName: uniqueName("GtkxModelC") });
        expect(new Model({}).getItemAttributeValue(0, "label", null)?.getString()).toEqual(["hello", 5]);
    });
});
