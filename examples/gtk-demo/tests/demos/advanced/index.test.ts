import { describe, expect, it } from "vitest";
import { advancedDemos } from "../../../src/demos/advanced/index.js";

describe("advancedDemos", () => {
    it("exposes the expected advanced demos in declared order", () => {
        expect(advancedDemos.map((d) => d.id)).toEqual(["font-features", "fontrendering", "markup", "textmask"]);
    });
});
