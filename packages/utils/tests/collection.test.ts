import { describe, expect, it } from "vitest";
import { uniqBy } from "../src/collection.js";

describe("uniqBy", () => {
    it("keeps the first item seen for each distinct key", () => {
        const items = [
            { id: "a", n: 1 },
            { id: "b", n: 2 },
            { id: "a", n: 3 },
        ];
        expect(uniqBy(items, (item) => item.id)).toEqual([
            { id: "a", n: 1 },
            { id: "b", n: 2 },
        ]);
    });

    it("preserves first-seen order", () => {
        expect(uniqBy(["c", "a", "c", "b", "a"], (value) => value)).toEqual(["c", "a", "b"]);
    });

    it("returns an empty array for empty input", () => {
        expect(uniqBy([], (value: string) => value)).toEqual([]);
    });

    it("does not mutate the source array", () => {
        const source = ["a", "a"];
        uniqBy(source, (value) => value);
        expect(source).toEqual(["a", "a"]);
    });
});
