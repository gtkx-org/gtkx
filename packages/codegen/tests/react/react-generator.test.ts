import { describe, expect, it } from "vitest";
import { ReactGenerator } from "../../src/react/react-generator.js";
import { createButtonMeta, createWidgetMeta } from "../fixtures/metadata-fixtures.js";

describe("ReactGenerator", () => {
    it("emits the four expected files in the conventional order", () => {
        const generator = new ReactGenerator([createWidgetMeta(), createButtonMeta()], [], ["Gtk"]);
        const files = generator.generate();

        const paths = files.map((f) => f.path);
        expect(paths).toEqual(["internal.ts", "jsx.ts", "compounds.ts", "registry.ts"]);
    });

    it("produces a string content field for every emitted file", () => {
        const generator = new ReactGenerator([createWidgetMeta(), createButtonMeta()], [], ["Gtk"]);
        const files = generator.generate();

        for (const file of files) {
            expect(typeof file.content).toBe("string");
        }
    });

    it("produces non-empty internal, jsx, and registry outputs", () => {
        const generator = new ReactGenerator([createWidgetMeta(), createButtonMeta()], [], ["Gtk"]);
        const files = generator.generate();

        for (const path of ["internal.ts", "jsx.ts", "registry.ts"]) {
            const file = files.find((f) => f.path === path);
            expect(file?.content.length ?? 0).toBeGreaterThan(0);
        }
    });

    it("includes namespace names in the generated registry output", () => {
        const generator = new ReactGenerator([createWidgetMeta()], [], ["Gtk", "Adw"]);
        const files = generator.generate();

        const registry = files.find((f) => f.path === "registry.ts");
        expect(registry).toBeDefined();
        expect(registry?.content).toContain("Gtk");
    });

    it("works with an empty controllers list", () => {
        const generator = new ReactGenerator([createWidgetMeta()], [], ["Gtk"]);
        expect(() => generator.generate()).not.toThrow();
    });

    it("can be instantiated and run multiple times for the same inputs", () => {
        const widgets = [createWidgetMeta(), createButtonMeta()];
        const first = new ReactGenerator(widgets, [], ["Gtk"]).generate();
        const second = new ReactGenerator(widgets, [], ["Gtk"]).generate();

        expect(first.length).toBe(second.length);
        for (let i = 0; i < first.length; i++) {
            expect(first[i]?.path).toBe(second[i]?.path);
        }
    });
});
