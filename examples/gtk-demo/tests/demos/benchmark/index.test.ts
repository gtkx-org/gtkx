import { describe, expect, it } from "vitest";
import { benchmarkDemos } from "../../../src/demos/benchmark/index.js";

describe("benchmarkDemos", () => {
    it("exposes the expected benchmark demos in declared order", () => {
        expect(benchmarkDemos.map((d) => d.id)).toEqual(["frames", "themes"]);
    });
});
