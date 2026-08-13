import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/native";
import { describe, expect, it } from "vitest";
import { BIGUINT64, callArgs, GOBJECT_LIB, typeFromName } from "../helpers/native-utils.js";
import { createTypeNameFactory } from "../helpers/unique-name.js";

const G_TYPE_INVALID_NAME = "ThisGTypeDefinitelyDoesNotExist";
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

describe("registerClass — registration", () => {
    it("registers a new GType derived from GObject", () => {
        const name = uniqueName("GtkxNativeBare");
        const gobjectGtype = typeFromName("GObject");
        const newGtype = registerClass(name, gobjectGtype);
        expect(newGtype).toBeGreaterThan(0);
        expect(newGtype).toBe(typeFromName(name));
    });

    it("rejects registering the same GType name twice", () => {
        const name = uniqueName("GtkxNativeDuplicate");
        const gobjectGtype = typeFromName("GObject");
        expect(registerClass(name, gobjectGtype)).toBeGreaterThan(0);
        expect(() => registerClass(name, gobjectGtype)).toThrow();
    });

    it("returns zero for a GType name that has not been registered", () => {
        expect(typeFromName(G_TYPE_INVALID_NAME)).toBe(0n);
    });
});

describe("registerClass — interfaces (1)", () => {
    it("accepts inherited-interface entries through the options builder", () => {
        const label = new Gtk.Label();
        const name = uniqueName("GtkxNativeInterfaceVfuncs");
        const widgetGtype = typeFromName("GtkWidget");
        const buildableGtype = typeFromName("GtkBuildable");
        expect(queryTypeIsA(label.__type__, widgetGtype)).toBe(true);
        expect(queryTypeIsA(label.__type__, buildableGtype)).toBe(true);
        const newGtype = registerClass(name, widgetGtype, { interfaces: [{ type: buildableGtype, vfuncs: [] }] });
        expect(newGtype).toBeGreaterThan(0);
        expect(queryTypeIsA(newGtype, buildableGtype)).toBe(true);
    });

    it("rejects a non-interface type in the interfaces option without registering", () => {
        const name = uniqueName("GtkxNativeNonInterface");
        const gobjectGtype = typeFromName("GObject");
        expect(() => registerClass(name, gobjectGtype, { interfaces: [{ type: gobjectGtype, vfuncs: [] }] })).toThrow();
        expect(typeFromName(name)).toBe(0n);
    });

    it("accepts an interface the parent does not implement", () => {
        const name = uniqueName("GtkxNativeAddedInterface");
        const gobjectGtype = typeFromName("GObject");
        const buildableGtype = typeFromName("GtkBuildable");
        expect(buildableGtype).toBeGreaterThan(0);

        const newGtype = registerClass(name, gobjectGtype, {
            interfaces: [{ type: buildableGtype, vfuncs: [] }],
        });

        expect(newGtype).toBeGreaterThan(0);
        expect(queryTypeIsA(newGtype, buildableGtype)).toBe(true);
    });
});

describe("registerClass — interfaces (2)", () => {
    it("rejects an interface whose prerequisite the parent misses without registering", () => {
        const entry = new Gtk.Entry();
        const name = uniqueName("GtkxNativeMissingPrerequisite");
        const gobjectGtype = typeFromName("GObject");
        const editableGtype = typeFromName("GtkEditable");
        expect(queryTypeIsA(entry.__type__, editableGtype)).toBe(true);

        const register = (): unknown =>
            registerClass(name, gobjectGtype, {
                interfaces: [{ type: editableGtype, vfuncs: [] }],
            });

        expect(register).toThrow();
        expect(typeFromName(name)).toBe(0n);
    });
});
