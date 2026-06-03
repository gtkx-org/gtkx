import { describe, expect, it } from "vitest";
import { findObjectProperty, type NativeHandle } from "../../index.js";
import { createLabel } from "./utils.js";

describe("findObjectProperty", () => {
    it("returns a handle for a property that exists on the instance", () => {
        const label = createLabel("Test") as NativeHandle;
        const pspec = findObjectProperty(label, "label");

        expect(pspec).not.toBeNull();
        expect(pspec).toBeDefined();
    });

    it("returns null when the property name is unknown", () => {
        const label = createLabel("Test") as NativeHandle;

        expect(findObjectProperty(label, "this-property-does-not-exist")).toBeNull();
    });
});
