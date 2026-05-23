import { describe, expect, it } from "vitest";
import { parseTitle } from "../../src/context/demo-context.js";
import { demos } from "../../src/demos/index.js";

describe("demos catalog", () => {
    it("starts with the intro demo (no component, no category)", () => {
        const first = demos[0];
        expect(first?.id).toBe("intro");
        expect(first?.title).toBe("GTK Demo");
        expect(first?.component).toBeUndefined();
    });

    it("assigns unique ids to every demo", () => {
        const ids = demos.map((d) => d.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("exposes a description and a keywords array on every demo", () => {
        for (const demo of demos) {
            expect(typeof demo.description).toBe("string");
            expect(Array.isArray(demo.keywords)).toBe(true);
        }
    });

    it("pulls in demos from every category module", () => {
        const categories = new Set(
            demos.map((d) => parseTitle(d.title).category).filter((c): c is string => c !== null),
        );
        for (const expected of [
            "Benchmark",
            "Constraints",
            "Entry",
            "Fixed Layout",
            "Lists",
            "List Box",
            "OpenGL",
            "Overlay",
            "Pango",
            "Paintable",
            "Printing",
            "Text View",
            "Theming",
        ]) {
            expect(categories.has(expected)).toBe(true);
        }
    });
});
