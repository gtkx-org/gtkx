import { describe, expect, it, vi } from "vitest";
import { Stylesheet } from "../src/stylesheet.js";

describe("Stylesheet", () => {
    it("accepts a rule via insert", () => {
        const stylesheet = new Stylesheet();
        expect(() => {
            stylesheet.insert(".test { color: red; }");
        }).not.toThrow();
    });

    it("accepts multiple rules via insert", () => {
        const stylesheet = new Stylesheet();
        expect(() => {
            stylesheet.insert(".rule1 { color: red; }");
            stylesheet.insert(".rule2 { color: blue; }");
            stylesheet.insert(".rule3 { color: green; }");
        }).not.toThrow();
    });

    it("warns when GTK rejects a declaration", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        try {
            const stylesheet = new Stylesheet();
            stylesheet.insert(".bad { not-a-real-property: 1; }");
            await new Promise<void>((resolve) => queueMicrotask(resolve));
            expect(warn).toHaveBeenCalledWith(expect.stringContaining("[gtkx/css] GTK rejected CSS"));
        } finally {
            warn.mockRestore();
        }
    });
});
