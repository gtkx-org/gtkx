import { describe, expect, it } from "vitest";
import { getInstanceGType, type NativeHandle } from "../../index.js";
import { createLabel, typeFromName } from "./utils.js";

describe("getInstanceGType", () => {
    it("returns the runtime GType of a GtkLabel instance", () => {
        const label = createLabel("Test") as NativeHandle;
        const gtype = getInstanceGType(label);

        expect(gtype).toBeGreaterThan(0);
        expect(gtype).toBe(typeFromName("GtkLabel"));
    });
});
