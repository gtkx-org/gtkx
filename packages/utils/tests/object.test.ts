import { omit, pickBy, structuredClone } from "@gtkx/utils";
import { describe, expect, it } from "vitest";

describe("omit", () => {
    it("removes specified single key", () => {
        const obj = { a: 1, b: 2, c: 3 };
        const result = omit(obj, ["b"]);
        expect(result).toEqual({ a: 1, c: 3 });
    });

    it("removes multiple specified keys", () => {
        const obj = { a: 1, b: 2, c: 3, d: 4 };
        const result = omit(obj, ["a", "c"]);
        expect(result).toEqual({ b: 2, d: 4 });
    });

    it("handles absent keys as a no-op", () => {
        const obj = { a: 1, b: 2 };
        const result = omit(obj, ["nonExistent" as keyof typeof obj]);
        expect(result).toEqual({ a: 1, b: 2 });
    });

    it("returns an empty object when omitting all keys", () => {
        const obj = { a: 1, b: 2 };
        const result = omit(obj, ["a", "b"]);
        expect(result).toEqual({});
    });

    it("returns a shallow copy when keys array is empty", () => {
        const obj = { a: 1, b: 2 };
        const result = omit(obj, []);
        expect(result).toEqual({ a: 1, b: 2 });
        expect(result).not.toBe(obj);
    });

    it("does not mutate the original object", () => {
        const obj = { a: 1, b: 2 };
        omit(obj, ["a"]);
        expect(obj).toEqual({ a: 1, b: 2 });
    });
});

describe("pickBy", () => {
    it("picks properties matching the predicate", () => {
        const obj = { a: 1, b: 2, c: 3, d: 4 };
        const result = pickBy(obj, (value) => typeof value === "number" && value % 2 === 0);
        expect(result).toEqual({ b: 2, d: 4 });
    });

    it("passes both value and key to the predicate callback", () => {
        const recorded: [unknown, string][] = [];
        const obj = { first: "hello", second: "world" };

        pickBy(obj, (value, key) => {
            recorded.push([value, key]);

            return key === "first";
        });

        expect(recorded).toEqual([
            ["hello", "first"],
            ["world", "second"],
        ]);
    });

    it("returns an empty object when no properties match", () => {
        const obj = { a: 1, b: 2 };
        const result = pickBy(obj, () => false);
        expect(result).toEqual({});
    });

    it("returns a new object with all properties when all match", () => {
        const obj = { a: 1, b: 2 };
        const result = pickBy(obj, () => true);
        expect(result).toEqual({ a: 1, b: 2 });
        expect(result).not.toBe(obj);
    });

    it("does not mutate the original object", () => {
        const obj = { a: 1, b: 2 };
        pickBy(obj, (value) => value === 1);
        expect(obj).toEqual({ a: 1, b: 2 });
    });
});

describe("structuredClone", () => {
    it("deeply clones a plain object and preserves independence", () => {
        const original = { a: 1, nested: { b: 2 } };
        const cloned = structuredClone(original);
        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned.nested).not.toBe(original.nested);
        cloned.nested.b = 99;
        expect(original.nested.b).toBe(2);
    });

    it("deeply clones arrays and preserves independence", () => {
        const original = [1, [2, 3], { a: 4 }];
        const cloned = structuredClone(original);
        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned[1]).not.toBe(original[1]);
        expect(cloned[2]).not.toBe(original[2]);
        (cloned[1] as number[])[0] = 99;
        expect((original[1] as number[])[0]).toBe(2);
    });

    it("returns primitives unchanged", () => {
        expect(structuredClone(42)).toBe(42);
        expect(structuredClone("string")).toBe("string");
        expect(structuredClone(true)).toBe(true);
        expect(structuredClone(null)).toBeNull();
        expect(structuredClone<unknown>(undefined)).toBeUndefined();
    });
});
