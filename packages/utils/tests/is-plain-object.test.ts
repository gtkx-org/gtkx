import { describe, expect, it } from "vitest";
import { isPlainObject } from "../src/predicate/is-plain-object.js";

describe("isPlainObject", () => {
    it("returns true for object literals", () => {
        expect(isPlainObject({})).toBe(true);
        expect(isPlainObject({ a: 1, b: "two" })).toBe(true);
        expect(isPlainObject({ nested: { x: 1 } })).toBe(true);
    });

    it("returns true for Object.create(null)", () => {
        const nullProtoObj: unknown = Object.create(null);
        expect(isPlainObject(nullProtoObj)).toBe(true);
    });

    it("returns true for objects created with new Object()", () => {
        const obj = new Object();
        expect(isPlainObject(obj)).toBe(true);
    });

    it("returns false for arrays", () => {
        expect(isPlainObject([])).toBe(false);
        expect(isPlainObject([1, 2, 3])).toBe(false);
    });

    it("returns false for class instances", () => {
        class CustomClass {
            public value = 42;
        }

        expect(isPlainObject(new CustomClass())).toBe(false);
    });

    it("returns false for built-in object types", () => {
        expect(isPlainObject(new Map())).toBe(false);
        expect(isPlainObject(new Set())).toBe(false);
        expect(isPlainObject(new Date())).toBe(false);
        expect(isPlainObject(/abc/g)).toBe(false);
        expect(isPlainObject(new Error("err"))).toBe(false);
        expect(isPlainObject(new Uint8Array())).toBe(false);
    });

    it("returns false for primitives, functions, null, and undefined", () => {
        expect(isPlainObject(null)).toBe(false);
        expect(isPlainObject(undefined)).toBe(false);
        expect(isPlainObject("string")).toBe(false);
        expect(isPlainObject(123)).toBe(false);
        expect(isPlainObject(true)).toBe(false);
        expect(isPlainObject(Symbol("sym"))).toBe(false);
        expect(isPlainObject(() => 0)).toBe(false);
    });
});
