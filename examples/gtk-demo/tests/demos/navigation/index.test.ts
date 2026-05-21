import { describe, expect, it } from "vitest";
import { navigationDemos } from "../../../src/demos/navigation/index.js";

describe("navigationDemos", () => {
    it("exposes the expected navigation demos in declared order", () => {
        expect(navigationDemos.map((d) => d.id)).toEqual(["stack", "revealer", "sidebar"]);
    });
});
