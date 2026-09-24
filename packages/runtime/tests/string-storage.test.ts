import { alloc } from "@gtkx/native";
import { t } from "@gtkx/runtime";
import { expect, test } from "vitest";

test.each([
    { capacity: 16, input: "\u{FEFF}café", expected: "\u{FEFF}café" },
    { capacity: 1, input: "café", expected: "" },
    { capacity: 5, input: "café", expected: "caf\u{FFFD}" },
])("a native writer fills a string buffer of $capacity bytes", ({ capacity, input, expected }) => {
    const copy = t.bind("libglib-2.0.so.0", "g_strlcpy", [
        t.ref(t.string("borrowed", capacity)), t.string(), t.biguint64,
    ], t.biguint64);
    const output = { value: "" };

    copy(output, input, BigInt(capacity));

    expect(output.value).toBe(expected);
});

test.each([
    { capacity: 16, seed: "\u{FEFF}café", suffix: " ♥", expected: "\u{FEFF}café ♥", attempted: 12n },
    { capacity: 8, seed: null, suffix: "gtkx", expected: "gtkx", attempted: 4n },
    { capacity: 8, seed: undefined, suffix: "gtkx", expected: "gtkx", attempted: 4n },
    { capacity: 8, seed: "", suffix: "gtkx", expected: "gtkx", attempted: 4n },
    { capacity: 4, seed: "abcdef", suffix: "", expected: "abc", attempted: 3n },
    { capacity: 5, seed: "café", suffix: "", expected: "caf\u{FFFD}", attempted: 4n },
    { capacity: 1, seed: "gtkx", suffix: "x", expected: "", attempted: 1n },
])("a native append preserves the $capacity-byte seed $seed", ({ capacity, seed, suffix, expected, attempted }) => {
    const append = t.bind("libglib-2.0.so.0", "g_strlcat", [
        t.ref(t.string("borrowed", capacity), true), t.string(), t.biguint64,
    ], t.biguint64);
    const output = { value: seed };

    expect(append(output, suffix, BigInt(capacity))).toBe(attempted);
    expect(output.value).toBe(expected);
});

test.each([null, undefined])("an absent string reference remains a null native argument (%s)", (value) => {
    const compare = t.bind("libglib-2.0.so.0", "g_strcmp0", [
        t.ref(t.string("borrowed", 8)), t.string(),
    ], t.int32);

    expect(compare(value, null)).toBe(0);
});

test.each(["a\0b", 42, {}, new Uint8Array([1])])("invalid seeds remain unchanged after rejection (%s)", (seed) => {
    const append = t.bind("libglib-2.0.so.0", "g_strlcat", [
        t.ref(t.string("borrowed", 8), true), t.string(), t.biguint64,
    ], t.biguint64);
    const output = { value: seed };

    expect(() => append(output, "gtkx", 8n)).toThrow();
    expect(output.value).toBe(seed);
});

test("a string buffer without space for its terminator throws", () => {
    const copy = t.bind("libglib-2.0.so.0", "g_strlcpy", [
        t.ref(t.string("borrowed", 0)), t.string(), t.biguint64,
    ], t.biguint64);

    expect(() => copy({ value: "" }, "text", 0n)).toThrow();
});

test("a native writer can fill a buffer while keeping its terminator", () => {
    const fill = t.bind("libc.so.6", "memset", [
        t.ref(t.string("borrowed", 4)), t.int32, t.biguint64,
    ], t.void);
    const output = { value: "" };

    fill(output, 97, 3n);

    expect(output.value).toBe("aaa");
});

test("a native writer that removes the buffer terminator throws", () => {
    const fill = t.bind("libc.so.6", "memset", [
        t.ref(t.string("borrowed", 4)), t.int32, t.biguint64,
    ], t.void);

    const output = { value: "old" };

    expect(() => fill(output, 97, 4n)).toThrow();
    expect(output.value).toBe("old");
});

test("string fields preserve UTF-8, empty strings and null through replacement", () => {
    const storage = alloc(8);
    const field = t.field(t.string(), 0);

    expect(field.read(storage)).toBeNull();
    field.write(storage, "\u{FEFF}café");
    expect(field.read(storage)).toBe("\u{FEFF}café");
    expect(() => {
        field.write(storage, "a\0b");
    }).toThrow();
    expect(field.read(storage)).toBe("\u{FEFF}café");
    field.write(storage, "");
    expect(field.read(storage)).toBe("");
    field.write(storage, null);
    expect(field.read(storage)).toBeNull();
});
