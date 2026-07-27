import { describe, expect, it, vi } from "vitest";
import { StyleSheet } from "../src/stylesheet.js";

describe("StyleSheet", () => {
    it("accepts a rule via insert", () => {
        const stylesheet = new StyleSheet();

        expect(() => {
            stylesheet.insert(".test { color: red; }");
        }).not.toThrow();
    });

    it("accepts multiple rules via insert", () => {
        const stylesheet = new StyleSheet();

        expect(() => {
            stylesheet.insert(".rule1 { color: red; }");
            stylesheet.insert(".rule2 { color: blue; }");
            stylesheet.insert(".rule3 { color: green; }");
        }).not.toThrow();
    });

    it("warns when GTK4 rejects a declaration", async () => {
        const warn = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

        try {
            const stylesheet = new StyleSheet();
            stylesheet.insert(".bad { not-a-real-property: 1; }");

            await new Promise<void>((resolve) => {
                queueMicrotask(resolve);
            });

            expect(warn).toHaveBeenCalledWith(expect.stringContaining("[gtkx:css]"));
            expect(warn).toHaveBeenCalledWith(expect.stringContaining("GTK4 rejected CSS"));
        } finally {
            warn.mockRestore();
        }
    });
});
