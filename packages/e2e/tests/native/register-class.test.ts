import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/native";
import { describe, expect, it } from "vitest";
import { BIGUINT64, callArgs, GOBJECT_LIB, typeFromName } from "../helpers/native-utils.js";

const G_TYPE_INVALID_NAME = "ThisGTypeDefinitelyDoesNotExist";

let uniqueSuffix = 0;
const uniqueName = (prefix: string): string => `${prefix}NativeTest${process.pid}_${++uniqueSuffix}`;

describe("registerClass", () => {
    it("registers a new GType derived from GObject", () => {
        const name = uniqueName("GtkxNativeBare");
        const gobjectGtype = typeFromName("GObject");

        const newGtype = registerClass(name, gobjectGtype) as bigint;

        expect(newGtype).toBeGreaterThan(0);
        expect(newGtype).toBe(typeFromName(name));
    });

    it("rejects registering the same GType name twice", () => {
        const name = uniqueName("GtkxNativeDuplicate");
        const gobjectGtype = typeFromName("GObject");

        expect(registerClass(name, gobjectGtype) as bigint).toBeGreaterThan(0);
        expect(() => registerClass(name, gobjectGtype)).toThrow();
    });

    it("returns zero for a GType name that has not been registered", () => {
        expect(typeFromName(G_TYPE_INVALID_NAME)).toBe(0n);
    });

    it("accepts inherited-interface entries through the options builder", () => {
        const label = new Gtk.Label();
        expect(label).toBeInstanceOf(Gtk.Label);
        const name = uniqueName("GtkxNativeInterfaceVfuncs");
        const widgetGtype = typeFromName("GtkWidget");
        const buildableGtype = typeFromName("GtkBuildable");
        expect(widgetGtype).toBeGreaterThan(0);
        expect(buildableGtype).toBeGreaterThan(0);

        const newGtype = registerClass(name, widgetGtype, {
            interfaces: [{ type: buildableGtype, vfuncs: [] }],
        }) as bigint;

        expect(newGtype).toBeGreaterThan(0);

        const stillImplementsBuildable = callArgs(
            GOBJECT_LIB,
            "g_type_is_a",
            [
                { type: BIGUINT64, value: newGtype },
                { type: BIGUINT64, value: buildableGtype },
            ],
            { kind: "boolean" },
        );
        expect(stillImplementsBuildable).toBe(true);
    });

    it("rejects a non-interface type in the interfaces option without registering", () => {
        const name = uniqueName("GtkxNativeNonInterface");
        const gobjectGtype = typeFromName("GObject");

        expect(() => registerClass(name, gobjectGtype, { interfaces: [{ type: gobjectGtype, vfuncs: [] }] })).toThrow(
            /is not an interface/,
        );
        expect(typeFromName(name)).toBe(0n);
    });

    it("rejects an interface the parent does not conform to without registering", () => {
        const name = uniqueName("GtkxNativeNonConforming");
        const gobjectGtype = typeFromName("GObject");
        const buildableGtype = typeFromName("GtkBuildable");
        expect(buildableGtype).toBeGreaterThan(0);

        expect(() => registerClass(name, gobjectGtype, { interfaces: [{ type: buildableGtype, vfuncs: [] }] })).toThrow(
            /does not conform to interface/,
        );
        expect(typeFromName(name)).toBe(0n);
    });
});
