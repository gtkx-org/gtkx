import { isDeepEqual, isRecord } from "@gtkx/utils";
import { describe, expect, it } from "vitest";

describe("isDeepEqual", () => {
    it("returns true for identical primitive values", () => {
        expect(isDeepEqual(42, 42)).toBe(true);
        expect(isDeepEqual("hello", "hello")).toBe(true);
        expect(isDeepEqual(true, true)).toBe(true);
        expect(isDeepEqual(false, false)).toBe(true);
        expect(isDeepEqual(null, null)).toBe(true);
        expect(isDeepEqual(undefined, undefined)).toBe(true);
    });

    it("returns false for different primitive values", () => {
        expect(isDeepEqual(42, 43)).toBe(false);
        expect(isDeepEqual("hello", "world")).toBe(false);
        expect(isDeepEqual(true, false)).toBe(false);
        expect(isDeepEqual(0, false)).toBe(false);
        expect(isDeepEqual(null, undefined)).toBe(false);
        expect(isDeepEqual("", false)).toBe(false);
    });

    it("compares flat and nested arrays", () => {
        expect(isDeepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
        expect(isDeepEqual([1, 2, 3], [1, 2])).toBe(false);
        expect(isDeepEqual([1, 2, 3], [1, 3, 2])).toBe(false);
        expect(isDeepEqual([[1, 2], [3, [4]]], [[1, 2], [3, [4]]])).toBe(true);
        expect(isDeepEqual([[1, 2], [3, [4]]], [[1, 2], [3, [5]]])).toBe(false);
    });

    it("compares flat and nested plain objects", () => {
        expect(isDeepEqual({ a: 1, b: "two" }, { a: 1, b: "two" })).toBe(true);
        expect(isDeepEqual({ a: 1, b: "two" }, { b: "two", a: 1 })).toBe(true);
        expect(isDeepEqual({ a: 1, b: "two" }, { a: 1, b: "three" })).toBe(false);
        expect(isDeepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
        expect(isDeepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
        expect(isDeepEqual({ a: { b: { c: 3 } } }, { a: { b: { c: 3 } } })).toBe(true);
        expect(isDeepEqual({ a: { b: { c: 3 } } }, { a: { b: { c: 4 } } })).toBe(false);
    });

    it("compares objects with nested arrays and arrays of objects", () => {
        expect(isDeepEqual({ tags: ["a", "b"] }, { tags: ["a", "b"] })).toBe(true);
        expect(isDeepEqual({ tags: ["a", "b"] }, { tags: ["a", "c"] })).toBe(false);
        expect(isDeepEqual([{ id: 1 }], [{ id: 1 }])).toBe(true);
        expect(isDeepEqual([{ id: 1 }], [{ id: 2 }])).toBe(false);
    });

    it("returns false for mixed types", () => {
        expect(isDeepEqual([1], { 0: 1 })).toBe(false);
        expect(isDeepEqual({ 0: 1 }, [1])).toBe(false);
        expect(isDeepEqual({}, null)).toBe(false);
        expect(isDeepEqual(null, {})).toBe(false);
        expect(isDeepEqual([], null)).toBe(false);
        expect(isDeepEqual(123, "123")).toBe(false);
    });
});

describe("isRecord", () => {
    it("returns true for plain objects and Object.create(null)", () => {
        expect(isRecord({})).toBe(true);
        expect(isRecord({ a: 1 })).toBe(true);
        expect(isRecord(Object.create(null))).toBe(true);
    });

    it("returns true for arrays and other object instances", () => {
        expect(isRecord([])).toBe(true);
        expect(isRecord([1, 2, 3])).toBe(true);
        expect(isRecord(new Date())).toBe(true);
        expect(isRecord(new Map())).toBe(true);
        expect(isRecord(new Set())).toBe(true);
    });

    it("returns false for primitives, null, and undefined", () => {
        expect(isRecord(null)).toBe(false);
        expect(isRecord(undefined)).toBe(false);
        expect(isRecord("hello")).toBe(false);
        expect(isRecord(123)).toBe(false);
        expect(isRecord(true)).toBe(false);
        expect(isRecord(Symbol("sym"))).toBe(false);
        expect(isRecord(() => 0)).toBe(false);
    });
});
