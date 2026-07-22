import { describe, expect, it } from "vitest";
import { isPlainObject, isRecord, isSameArray, isSameArrayBy, isShallowEqual } from "../src/predicate/index.js";

describe("isSameArray", () => {
    it("is true for equal-length, element-wise strictly-equal arrays", () => {
        expect(isSameArray([1, 2, 3], [1, 2, 3])).toBe(true);
        expect(isSameArray([], [])).toBe(true);
    });

    it("is false for different order, length, or values", () => {
        expect(isSameArray([1, 2], [2, 1])).toBe(false);
        expect(isSameArray([1], [1, 2])).toBe(false);
    });
});

describe("isSameArrayBy", () => {
    it("compares elements with the given comparator", () => {
        expect(isSameArrayBy([{ id: 1 }], [{ id: 1 }], (x, y) => x.id === y.id)).toBe(true);
        expect(isSameArrayBy([{ id: 1 }], [{ id: 2 }], (x, y) => x.id === y.id)).toBe(false);
    });

    it("short-circuits on length mismatch without calling the comparator", () => {
        const eq = (): boolean => {
            throw new Error("should not be called");
        };
        expect(isSameArrayBy([1], [1, 2], eq)).toBe(false);
    });
});

describe("isShallowEqual", () => {
    it("is true for the same reference and for key-equal objects", () => {
        const ref = { a: 1 };
        expect(isShallowEqual(ref, ref)).toBe(true);
        expect(isShallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    });

    it("is false when a value differs", () => {
        expect(isShallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    });

    it("distinguishes objects with the same key count but different keys", () => {
        expect(isShallowEqual({ a: undefined }, { b: undefined })).toBe(false);
    });

    it("is false when only one side is defined", () => {
        expect(isShallowEqual({ a: 1 }, undefined)).toBe(false);
        expect(isShallowEqual(undefined, undefined)).toBe(true);
    });

    it("compares values that are not both plain objects by identity", () => {
        expect(isShallowEqual(3, 3)).toBe(true);
        expect(isShallowEqual(3, 4)).toBe(false);
        expect(isShallowEqual("a", "a")).toBe(true);
        expect(isShallowEqual([1], [1])).toBe(false);
        expect(isShallowEqual(new Date(0), new Date(0))).toBe(false);
    });
});

describe("isRecord", () => {
    it("is true for plain objects, arrays, and class instances", () => {
        expect(isRecord({})).toBe(true);
        expect(isRecord([1])).toBe(true);
        expect(isRecord(new Date())).toBe(true);
    });

    it("is false for null and primitives", () => {
        expect(isRecord(null)).toBe(false);
        expect(isRecord("x")).toBe(false);
        expect(isRecord(1)).toBe(false);
    });
});

describe("isPlainObject", () => {
    it("is true only for objects with Object.prototype or null prototype", () => {
        expect(isPlainObject({ a: 1 })).toBe(true);
        expect(isPlainObject(Object.create(null))).toBe(true);
    });

    it("is false for arrays, class instances, and primitives", () => {
        expect(isPlainObject([1])).toBe(false);
        expect(isPlainObject(new Date())).toBe(false);
        expect(isPlainObject(null)).toBe(false);
        expect(isPlainObject("x")).toBe(false);
    });
});
