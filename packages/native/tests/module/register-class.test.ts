import { describe, expect, it } from "vitest";
import { call, registerClass } from "../../index.js";
import { createLabel, GOBJECT_LIB, typeFromName, UINT64 } from "./utils.js";

const G_TYPE_INVALID_NAME = "ThisGTypeDefinitelyDoesNotExist";

let uniqueSuffix = 0;
const uniqueName = (prefix: string): string => `${prefix}NativeTest${process.pid}_${++uniqueSuffix}`;

describe("registerClass", () => {
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
        expect(typeFromName(G_TYPE_INVALID_NAME)).toBe(0);
    });

    it("accepts inherited-interface entries through the options builder", () => {
        createLabel("Init");
        const name = uniqueName("GtkxNativeInterfaceVfuncs");
        const widgetGtype = typeFromName("GtkWidget");
        const buildableGtype = typeFromName("GtkBuildable");
        expect(widgetGtype).toBeGreaterThan(0);
        expect(buildableGtype).toBeGreaterThan(0);

        const newGtype = registerClass(name, widgetGtype, {
            interfaceVfuncs: [{ gtype: buildableGtype, vfuncs: [] }],
        });

        expect(newGtype).toBeGreaterThan(0);

        const stillImplementsBuildable = call(
            GOBJECT_LIB,
            "g_type_is_a",
            [
                { type: UINT64, value: newGtype },
                { type: UINT64, value: buildableGtype },
            ],
            { type: "boolean" },
        );
        expect(stillImplementsBuildable).toBe(true);
    });
});
