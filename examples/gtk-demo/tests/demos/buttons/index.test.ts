import { describe, expect, it } from "vitest";
import { buttonsDemos } from "../../../src/demos/buttons/index.js";

describe("buttonsDemos", () => {
    it("exposes the expected buttons demos in declared order", () => {
        expect(buttonsDemos.map((d) => d.id)).toEqual(["spinbutton", "scale", "spinner", "expander"]);
    });
});
