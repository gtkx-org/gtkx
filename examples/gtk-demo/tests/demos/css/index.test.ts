import { describe, expect, it } from "vitest";
import { cssDemos } from "../../../src/demos/css/index.js";

describe("cssDemos", () => {
    it("exposes the expected CSS demos in declared order", () => {
        expect(cssDemos.map((d) => d.id)).toEqual([
            "css-basics",
            "css-shadows",
            "css-accordion",
            "css-blendmodes",
            "css-multiplebgs",
            "css-pixbufs",
            "errorstates",
            "theming-style-classes",
        ]);
    });
});
