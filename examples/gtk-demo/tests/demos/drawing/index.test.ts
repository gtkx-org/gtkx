import { describe, expect, it } from "vitest";
import { drawingDemos } from "../../../src/demos/drawing/index.js";

describe("drawingDemos", () => {
    it("exposes the expected drawing demos", () => {
        expect(drawingDemos.map((d) => d.id)).toEqual(["drawingarea", "images", "paintable-svg"]);
    });
});
