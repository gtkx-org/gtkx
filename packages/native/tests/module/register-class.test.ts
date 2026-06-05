import { describe, expect, it } from "vitest";
import { call, registerClass } from "../../index.js";
import { createLabel, GOBJECT_LIB, typeFromName, UINT64 } from "./utils.js";

const G_TYPE_INVALID_NAME = "ThisGTypeDefinitelyDoesNotExist";

let uniqueSuffix = 0;
const uniqueName = (prefix: string): string => `${prefix}NativeTest${process.pid}_${++uniqueSuffix}`;

describe("registerClass", () => {
    it("registers a new GType derived from GObject", () => {
        const name = uniqueName("GtkxNativeBare");
        const gobjectGType = typeFromName("GObject");

        const newGType = registerClass(name, gobjectGType);

        expect(newGType).toBeGreaterThan(0);
        expect(newGType).toBe(typeFromName(name));
    });

    it("rejects registering the same GType name twice", () => {
        const name = uniqueName("GtkxNativeDuplicate");
        const gobjectGType = typeFromName("GObject");

        expect(registerClass(name, gobjectGType)).toBeGreaterThan(0);
        expect(() => registerClass(name, gobjectGType)).toThrow();
    });

    it("returns zero for a GType name that has not been registered", () => {
        expect(typeFromName(G_TYPE_INVALID_NAME)).toBe(0);
    });

    it("accepts inherited-interface entries through the options builder", () => {
        createLabel("Init");
        const name = uniqueName("GtkxNativeInterfaceVfuncs");
        const widgetGType = typeFromName("GtkWidget");
        const buildableGType = typeFromName("GtkBuildable");
        expect(widgetGType).toBeGreaterThan(0);
        expect(buildableGType).toBeGreaterThan(0);

        const newGType = registerClass(name, widgetGType, {
            interfaceVfuncs: [{ gtype: buildableGType, vfuncs: [] }],
        });

        expect(newGType).toBeGreaterThan(0);

        const stillImplementsBuildable = call(
            GOBJECT_LIB,
            "g_type_is_a",
            [
                { type: UINT64, value: newGType },
                { type: UINT64, value: buildableGType },
            ],
            { type: "boolean" },
        );
        expect(stillImplementsBuildable).toBe(true);
    });
});
