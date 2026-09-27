import { alloc, getType, getTypeClass } from "@gtkx/native";
import { expect, test } from "vitest";

test("a handle over plain allocated memory carries no type tag", () => {
    expect(getType(alloc(64))).toBe(0n);
});

test("the invalid GType throws", () => {
    expect(() => getTypeClass(0n)).toThrow();
});

test("a negative GType throws", () => {
    expect(() => getTypeClass(-1n)).toThrow();
});

test("a GType beyond the 64-bit range throws", () => {
    expect(() => getTypeClass(2n ** 64n)).toThrow();
});

test("a GType in the fundamental range that names no registered type throws", () => {
    expect(() => getTypeClass(100n)).toThrow();
});

test("the last GType of the fundamental range throws when nothing registered it", () => {
    expect(() => getTypeClass(1020n)).toThrow();
});
