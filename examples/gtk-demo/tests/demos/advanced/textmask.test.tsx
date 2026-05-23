import { describe, expect, it } from "vitest";
import { textmaskDemo } from "../../../src/demos/advanced/textmask.js";
import { renderDemo } from "../../test-utils.js";

describe("textmaskDemo", () => {
    it("exposes the expected metadata", () => {
        expect(textmaskDemo.id).toBe("textmask");
        expect(textmaskDemo.title).toBe("Pango/Text Mask");
        expect(textmaskDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(textmaskDemo.keywords)).toBe(true);
        expect(typeof textmaskDemo.sourceCode).toBe("string");
        expect(textmaskDemo.defaultWidth).toBeUndefined();
        expect(textmaskDemo.defaultHeight).toBeUndefined();
        expect(textmaskDemo.keywords).toEqual([]);
    });

    it("applies the configured size request to the host window", async () => {
        const { window } = await renderDemo(textmaskDemo);
        const win = window.current;
        if (!win) throw new Error("expected the host window ref to be populated");
        const [w, h] = win.getSizeRequest();
        expect(w).toBe(400);
        expect(h).toBe(240);
    });
});
