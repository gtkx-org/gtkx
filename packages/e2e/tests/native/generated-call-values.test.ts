import * as GLib from "@gtkx/gi/glib";
import * as Pango from "@gtkx/gi/pango";
import { expect, test } from "vitest";
import { drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

test("generated string calls remain reusable", () => {
    expect(GLib.strdup("gtk")).toBe("gtk");
    expect(GLib.strdup("x")).toBe("x");
});

test.each([
    { name: "ordinary strings", values: ["gtk", "x"] },
    { name: "Unicode strings", values: ["café", "日本語"] },
    { name: "empty strings", values: ["", "gtkx", ""] },
    { name: "an empty vector", values: [] },
    { name: "a null vector as an empty array", values: null },
])("generated string vectors preserve $name", ({ values }) => {
    expect(GLib.strdupv(values)).toEqual(values ?? []);
});

test("generated string vectors reject an interior NUL", () => {
    expect(() => GLib.strdupv(["first", "a\0b"])).toThrow();
});

test("a generated string call respects its signed length", () => {
    expect(GLib.asciiStrup("gtkx", 2)).toBe("GT");
    expect(GLib.asciiStrup("gtkx", -1)).toBe("GTKX");
});

test("generated boolean returns expose the predicate result", () => {
    expect(GLib.strHasPrefix("gtkx", "gtk")).toBe(true);
    expect(GLib.strHasPrefix("gtkx", "adw")).toBe(false);
    expect(GLib.strHasPrefix("gtkx", "")).toBe(true);
});

test("generated signed returns preserve comparison results", () => {
    expect(GLib.strcmp0("gtkx", "gtkx")).toBe(0);
    expect(GLib.strcmp0("a", "b")).toBeLessThan(0);
    expect(GLib.strcmp0(null, "a")).toBeLessThan(0);
    expect(GLib.strcmp0(null, null)).toBe(0);
});

test("generated integer arguments bound the value the callee returns", () => {
    const value = GLib.randomIntRange(10, 20);
    expect(value).toBeGreaterThanOrEqual(10);
    expect(value).toBeLessThan(20);
    expect(GLib.randomIntRange(2_147_483_645, 2_147_483_647)).toBeGreaterThanOrEqual(2_147_483_645);
});

test("generated Unicode arguments and returns preserve codepoints", () => {
    expect(GLib.unicharToupper(0x61)).toBe("A");
    expect(GLib.unicharToupper("a")).toBe("A");
    expect(GLib.unicharToupper(0x10_FF_FF)).toBe(String.fromCodePoint(0x10_FF_FF));
});

test("generated floating point arguments and returns convert Pango units", () => {
    expect(Pango.unitsToDouble(1024)).toBe(1);
    expect(Pango.unitsFromDouble(1)).toBe(1024);
});

test("generated length and byte arguments construct the requested string", () => {
    expect(GLib.strnfill(3, 120)).toBe("xxx");
    expect(GLib.strnfill(0, 120)).toBe("");
    expect(GLib.strnfill(3, 127)).toBe("\u{7F}\u{7F}\u{7F}");
});

test("generated bigint returns preserve values beyond the safe integer range", () => {
    expect(GLib.asciiStrtoll("9223372036854775807", 10)).toEqual([9_223_372_036_854_775_807n, ""]);
    expect(GLib.asciiStrtoll("12abc", 10)).toEqual([12n, "abc"]);
});

test("generated argument-free calls respect the seeded native state", () => {
    GLib.randomSetSeed(42);
    const first = GLib.randomInt();
    GLib.randomSetSeed(42);

    expect(GLib.randomInt()).toBe(first);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(4_294_967_295);
    const setSeed: (seed: number) => unknown = GLib.randomSetSeed;
    expect(setSeed(4_294_967_295)).toBeUndefined();
});

test("generated strings preserve null and empty values", () => {
    expect(GLib.strdup(null)).toBeNull();
    expect(Reflect.apply(GLib.strdup, undefined, [undefined])).toBeNull();
    expect(GLib.strdup("")).toBe("");
});

test.each([{}, 42, Symbol("text")])("generated strings reject a non-string value %s", (value) => {
    expect(() => {
        Reflect.apply(GLib.strdup, undefined, [value]);
    }).toThrow();
});

test("generated scalar arguments reject values outside their contracts", () => {
    expect(() => {
        Reflect.apply(GLib.randomIntRange, undefined, ["ten", 20]);
    }).toThrow();
    expect(() => GLib.randomIntRange(2_147_483_648, 2_147_483_649)).toThrow();
    expect(() => GLib.unicharToupper("ab")).toThrow();
    expect(() => {
        Reflect.apply(GLib.strHasPrefix, undefined, ["gtkx", null]);
    }).toThrow();
});
