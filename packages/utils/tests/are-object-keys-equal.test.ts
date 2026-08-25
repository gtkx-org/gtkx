import { describe, expect, it } from "vitest";
import { areObjectKeysEqual } from "../src/predicate/are-object-keys-equal.js";

const isStrictEqual = (a: unknown, b: unknown): boolean => a === b;

const isCaseInsensitiveEqual = (a: unknown, b: unknown): boolean =>
    typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();

describe("areObjectKeysEqual", () => {
    it("returns true when objects have identical keys and values", () => {
        const objA = { x: 10, y: 20 };
        const objB = { x: 10, y: 20 };
        expect(areObjectKeysEqual(objA, objB, isStrictEqual)).toBe(true);
    });

    it("returns true regardless of key insertion order", () => {
        const objA = { a: 1, b: 2 };
        const objB = { b: 2, a: 1 };
        expect(areObjectKeysEqual(objA, objB, isStrictEqual)).toBe(true);
    });

    it("returns false when objects have different numbers of keys", () => {
        const objA = { a: 1, b: 2 };
        const objB = { a: 1 };
        expect(areObjectKeysEqual(objA, objB, isStrictEqual)).toBe(false);
        expect(areObjectKeysEqual(objB, objA, isStrictEqual)).toBe(false);
    });

    it("returns false when objects have the same key count but different key names", () => {
        const objA = { a: 1, b: 2 };
        const objB = { a: 1, c: 2 };
        expect(areObjectKeysEqual(objA, objB, isStrictEqual)).toBe(false);
    });

    it("returns false when values differ under strict equality", () => {
        const objA = { a: 1, b: 2 };
        const objB = { a: 1, b: 3 };
        expect(areObjectKeysEqual(objA, objB, isStrictEqual)).toBe(false);
    });

    it("supports custom equality functions", () => {
        const objA = { name: "alice", city: "london" };
        const objB = { name: "ALICE", city: "LONDON" };
        expect(areObjectKeysEqual(objA, objB, isStrictEqual)).toBe(false);
        expect(areObjectKeysEqual(objA, objB, isCaseInsensitiveEqual)).toBe(true);
    });

    it("returns true for two empty objects", () => {
        expect(areObjectKeysEqual({}, {}, isStrictEqual)).toBe(true);
    });
});
