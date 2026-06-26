import { describe, expect, it } from "vitest";
import { omit, uniqBy } from "../src/collection.js";

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

describe("omit", () => {
    it("removes the listed keys", () => {
        expect(omit({ a: 1, b: 2, c: 3 }, ["b"])).toEqual({ a: 1, c: 3 });
    });

    it("ignores keys absent from the record", () => {
        const record: Record<string, number> = { a: 1 };
        expect(omit(record, ["x"])).toEqual({ a: 1 });
    });

    it("does not mutate the source record", () => {
        const source = { a: 1, b: 2 };
        omit(source, ["a"]);
        expect(source).toEqual({ a: 1, b: 2 });
    });
});
