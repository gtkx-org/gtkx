import { describe, expect, it } from "vitest";
import { structuredClone } from "../src/object/index.js";
import {
    isDeepEqual,
    isPlainObject,
    isRecord,
    isSameArray,
    isSameArrayBy,
    isShallowEqual,
} from "../src/predicate/index.js";

const failIfCompared = (): never => {
    throw new Error("should not be called");
};

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
        expect(isSameArrayBy([1], [1, 2], failIfCompared)).toBe(false);
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

describe("isDeepEqual", () => {
    it("is true for structurally equal nested arrays and plain objects", () => {
        expect(isDeepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
        expect(isDeepEqual([], [])).toBe(true);
    });

    it("is false for differing values, lengths, and key sets", () => {
        expect(isDeepEqual({ a: [1] }, { a: [2] })).toBe(false);
        expect(isDeepEqual([1], [1, 2])).toBe(false);
        expect(isDeepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    it("compares values that are not both arrays or both plain objects by identity", () => {
        const date = new Date(0);
        expect(isDeepEqual(date, date)).toBe(true);
        expect(isDeepEqual(new Date(0), new Date(0))).toBe(false);
        expect(isDeepEqual([1], { 0: 1 })).toBe(false);
    });
});

describe("structuredClone", () => {
    it("copies nested arrays and plain objects so later mutations do not leak", () => {
        const nested = { b: 1 };
        const source = { a: [nested] };
        const copy = structuredClone(source);
        expect(isDeepEqual(copy, source)).toBe(true);
        nested.b = 2;
        expect(copy).toEqual({ a: [{ b: 1 }] });
        expect(isDeepEqual(copy, source)).toBe(false);
    });

    it("shares values that are neither arrays nor plain objects", () => {
        const date = new Date(0);
        expect(structuredClone({ date }).date).toBe(date);
        expect(structuredClone(date)).toBe(date);
    });
});
