import { describe, expect, it } from "vitest";
import { callBooleanGetter, callStringGetter } from "../src/widget-getters.js";
import { renderLabel } from "./widget-fixtures.js";

describe("callBooleanGetter", () => {
    it("returns the boolean a getter yields", async () => {
        const label = await renderLabel("Plain");
        expect(callBooleanGetter(label, "getSelectable")).toBe(false);
    });

    it("returns null when the getter yields a non-boolean", async () => {
        const label = await renderLabel("Plain");
        expect(callBooleanGetter(label, "getLabel")).toBeNull();
    });

    it("returns null when the method does not exist", async () => {
        const label = await renderLabel("Plain");
        expect(callBooleanGetter(label, "getMissing")).toBeNull();
    });
});

describe("callStringGetter", () => {
    it("returns the string a getter yields", async () => {
        const label = await renderLabel("Plain");
        expect(callStringGetter(label, "getLabel")).toBe("Plain");
    });

    it("returns null when the getter yields a non-string", async () => {
        const label = await renderLabel("Plain");
        expect(callStringGetter(label, "getSelectable")).toBeNull();
    });
});
