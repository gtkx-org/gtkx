import { describe, expect, it } from "vitest";
import { remove, uniqBy } from "../src/array/index.js";

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

    it("deduplicates by a non-string mapped key", () => {
        expect(uniqBy([2.1, 1.2, 2.3, 1.9], Math.floor)).toEqual([2.1, 1.2]);
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

describe("remove", () => {
    it("removes the first matching occurrence in place", () => {
        const items = ["a", "b", "c", "b"];
        remove(items, "b");
        expect(items).toEqual(["a", "c", "b"]);
    });

    it("leaves the array unchanged when the value is absent", () => {
        const items = ["a", "b"];
        remove(items, "z");
        expect(items).toEqual(["a", "b"]);
    });
});
