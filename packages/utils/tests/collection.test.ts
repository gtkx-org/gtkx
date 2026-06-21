import { describe, expect, it } from "vitest";
import { dedupeBy, omit, reverseNumericEnum } from "../src/collection.js";

describe("dedupeBy", () => {
    it("keeps the first item seen for each distinct key", () => {
        const items = [
            { id: "a", n: 1 },
            { id: "b", n: 2 },
            { id: "a", n: 3 },
        ];
        expect(dedupeBy(items, (item) => item.id)).toEqual([
            { id: "a", n: 1 },
            { id: "b", n: 2 },
        ]);
    });

    it("preserves first-seen order", () => {
        expect(dedupeBy(["c", "a", "c", "b", "a"], (value) => value)).toEqual(["c", "a", "b"]);
    });

    it("returns an empty array for empty input", () => {
        expect(dedupeBy([], (value: string) => value)).toEqual([]);
    });

    it("does not mutate the source array", () => {
        const source = ["a", "a"];
        dedupeBy(source, (value) => value);
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

describe("reverseNumericEnum", () => {
    const Color: Record<string, string | number> = {
        Red: 0,
        Green: 5,
        Blue: 6,
        0: "Red",
        5: "Green",
        6: "Blue",
    };

    it("maps each numeric enum value to its member name", () => {
        const byValue = reverseNumericEnum(Color);
        expect(byValue.get(0)).toBe("Red");
        expect(byValue.get(5)).toBe("Green");
        expect(byValue.get(6)).toBe("Blue");
    });

    it("keeps only the value-to-name direction of the enum object", () => {
        expect(reverseNumericEnum(Color).size).toBe(3);
    });

    it("reverses a plain object of numeric values", () => {
        const byValue = reverseNumericEnum({ a: 1, b: 2 });
        expect(byValue.get(1)).toBe("a");
        expect(byValue.get(2)).toBe("b");
    });
});
