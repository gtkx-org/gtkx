import { describe, expect, it } from "vitest";
import { isShallowArrayEqual, isShallowEqual, omit } from "../src/collection.js";

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

describe("isShallowEqual", () => {
    it("returns true for equal primitive arrays", () => {
        expect(isShallowEqual([1, 2, 3], [1, 2, 3])).toBe(true);
        expect(isShallowEqual(["a", "b"], ["a", "b"])).toBe(true);
    });

    it("returns false for differing length or elements", () => {
        expect(isShallowEqual([1, 2], [1, 2, 3])).toBe(false);
        expect(isShallowEqual([1, 2], [1, 3])).toBe(false);
    });

    it("treats two nullish references as equal and a nullish vs array as unequal", () => {
        expect(isShallowEqual<number>(null, null)).toBe(true);
        expect(isShallowEqual<number>(undefined, undefined)).toBe(true);
        expect(isShallowEqual<number>(null, [1])).toBe(false);
        expect(isShallowEqual<number>([1], undefined)).toBe(false);
    });
});

describe("isShallowArrayEqual", () => {
    it("returns true when every record is shallowly equal at the same index", () => {
        expect(isShallowArrayEqual([{ a: 1 }, { b: 2 }], [{ a: 1 }, { b: 2 }])).toBe(true);
    });

    it("returns false when a record value differs", () => {
        expect(isShallowArrayEqual([{ a: 1 }], [{ a: 2 }])).toBe(false);
    });

    it("returns false when key sets or lengths differ", () => {
        expect(isShallowArrayEqual([{ a: 1 }], [{ a: 1, b: 2 }])).toBe(false);
        expect(isShallowArrayEqual([{ a: 1 }], [])).toBe(false);
    });
});
