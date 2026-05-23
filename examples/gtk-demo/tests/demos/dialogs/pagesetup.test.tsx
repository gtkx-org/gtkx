import { describe, expect, it } from "vitest";
import { pageSetupDemo } from "../../../src/demos/dialogs/pagesetup.js";

describe("pageSetupDemo", () => {
    it("exposes the expected metadata", () => {
        expect(pageSetupDemo.id).toBe("pagesetup");
        expect(pageSetupDemo.title).toBe("Printing/Page Setup");
        expect(pageSetupDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(pageSetupDemo.keywords)).toBe(true);
        expect(typeof pageSetupDemo.sourceCode).toBe("string");
        expect(pageSetupDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(pageSetupDemo.keywords).toContain("GtkPageSetup");
        expect(pageSetupDemo.component).toBeTypeOf("function");
        expect(pageSetupDemo.dialogOnly).toBe(true);
    });
});
