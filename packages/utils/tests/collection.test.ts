import { describe, expect, it } from "vitest";
import { omit, reverseNumericEnum } from "../src/collection.js";

describe("omit", () => {
    it("removes the listed keys", () => {
        expect(omit({ a: 1, b: 2, c: 3 }, ["b"])).toEqual({ a: 1, c: 3 });
    });

    it("ignores keys absent from the record", () => {
        expect(omit({ a: 1 }, ["x"])).toEqual({ a: 1 });
    });

    it("does not mutate the source record", () => {
        const source = { a: 1, b: 2 };
        omit(source, ["a"]);
        expect(source).toEqual({ a: 1, b: 2 });
    });
});

describe("reverseNumericEnum", () => {
    enum Color {
        Red = 0,
        Green = 5,
        Blue = 6,
    }

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
