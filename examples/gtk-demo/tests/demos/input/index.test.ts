import { describe, expect, it } from "vitest";
import { inputDemos } from "../../../src/demos/input/index.js";

describe("inputDemos", () => {
    it("exposes the expected input demos in declared order", () => {
        expect(inputDemos.map((d) => d.id)).toEqual([
            "entry-undo",
            "password-entry",
            "search-entry",
            "tabs",
            "textview",
            "hypertext",
            "textscroll",
            "textundo",
        ]);
    });
});
