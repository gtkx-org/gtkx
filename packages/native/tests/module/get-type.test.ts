import { describe, expect, it } from "vitest";
import { getType, type Handle } from "../../index.js";
import { createLabel, typeFromName } from "./utils.js";

describe("getType", () => {
    it("returns the runtime GType of a GtkLabel instance", () => {
        const label = createLabel("Test") as Handle;
        const gtype = getType(label);

        expect(gtype).toBeGreaterThan(0);
        expect(gtype).toBe(typeFromName("GtkLabel"));
    });
});
