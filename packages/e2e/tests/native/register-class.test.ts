import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/native";
import { describe, expect, it } from "vitest";
import { BIGUINT64, callArgs, GOBJECT_LIB, typeFromName } from "../helpers/native-utils.js";
import { createTypeNameFactory } from "../helpers/unique-name.js";

const uniqueName = createTypeNameFactory("NativeTest");

const queryTypeIsA = (gtype: bigint, target: bigint): unknown =>
    callArgs(
        GOBJECT_LIB,
        "g_type_is_a",
        [
            { type: BIGUINT64, value: gtype },
            { type: BIGUINT64, value: target },
        ],
        { kind: "boolean" },
    );

describe("registerClass", () => {
    it("happy path", () => {
        const name = uniqueName("GtkxNativeBare");
        const gobjectGtype = typeFromName("GObject");
        const newGtype = registerClass(name, gobjectGtype);
        expect(newGtype).toBe(typeFromName(name));
    });

    it("edge cases", () => {
        const inheritedName = uniqueName("GtkxNativeInheritedInterface");
        const addedName = uniqueName("GtkxNativeAddedInterface");
        const gobjectGtype = typeFromName("GObject");
        const widgetGtype = Gtk.Widget.prototype.__type__;
        const buildableGtype = Gtk.Buildable.prototype.__type__;
        const inherited = registerClass(inheritedName, widgetGtype, {
            interfaces: [{ type: buildableGtype, vfuncs: [] }],
        });
        const added = registerClass(addedName, gobjectGtype, {
            interfaces: [{ type: buildableGtype, vfuncs: [] }],
        });
        expect(queryTypeIsA(inherited, buildableGtype)).toBe(true);
        expect(queryTypeIsA(added, buildableGtype)).toBe(true);
    });

    it("error paths", () => {
        const gobjectGtype = typeFromName("GObject");
        const editableGtype = Gtk.Editable.prototype.__type__;
        const duplicateName = uniqueName("GtkxNativeDuplicate");
        registerClass(duplicateName, gobjectGtype);
        expect(() => registerClass(duplicateName, gobjectGtype)).toThrow();

        expect(() =>
            registerClass(uniqueName("GtkxNativeNonInterface"), gobjectGtype, {
                interfaces: [{ type: gobjectGtype, vfuncs: [] }],
            }),
        ).toThrow();

        expect(() =>
            registerClass(uniqueName("GtkxNativeMissingPrerequisite"), gobjectGtype, {
                interfaces: [{ type: editableGtype, vfuncs: [] }],
            }),
        ).toThrow();
    });
});
