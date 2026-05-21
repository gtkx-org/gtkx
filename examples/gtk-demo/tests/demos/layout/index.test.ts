import { describe, expect, it } from "vitest";
import { layoutDemos } from "../../../src/demos/layout/index.js";

describe("layoutDemos", () => {
    it("exposes the expected layout demos in declared order", () => {
        expect(layoutDemos.map((d) => d.id)).toEqual([
            "panes",
            "fixed",
            "fixed2",
            "flowbox",
            "headerbar",
            "overlay",
            "overlay-decorative",
            "sizegroup",
        ]);
    });
});
