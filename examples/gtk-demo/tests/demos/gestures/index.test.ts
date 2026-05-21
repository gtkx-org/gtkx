import { describe, expect, it } from "vitest";
import { gesturesDemos } from "../../../src/demos/gestures/index.js";

describe("gesturesDemos", () => {
    it("exposes the expected gestures demos in declared order", () => {
        expect(gesturesDemos.map((d) => d.id)).toEqual([
            "gestures",
            "dnd",
            "clipboard",
            "shortcut-triggers",
            "links",
            "cursors",
        ]);
    });
});
