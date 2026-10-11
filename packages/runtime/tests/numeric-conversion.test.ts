import { alloc, read, t, write } from "@gtkx/runtime";
import { describe, expect, test } from "vitest";

const codecs = [
    { name: "signed", descriptor: t.bigint64, maximum: 2n ** 63n - 1n },
    { name: "unsigned", descriptor: t.biguint64, maximum: 2n ** 64n - 1n },
];

describe.each(codecs)("$name bigint fields", ({ descriptor, maximum }) => {
    test("normalizes numbers and preserves full-width bigint values", () => {
        const storage = alloc(8);
        const field = t.field(descriptor, 0);

        for (const value of [0, -0, 17, 2 ** 53, maximum]) {
            field.write(storage, value);
            expect(field.read(storage)).toBe(BigInt(value));
            write(storage, descriptor, 0, value);
            expect(read(storage, descriptor, 0)).toBe(BigInt(value));
        }
    });

    test.each([1.5, NaN, Infinity, 2 ** 53 + 2, "17", null, undefined])("rejects %s", (value) => {
        const storage = alloc(8);
        const field = t.field(descriptor, 0);

        expect(() => {
            field.write(storage, value);
        }).toThrow();
        expect(() => {
            write(storage, descriptor, 0, value);
        }).toThrow();
    });
});

test("signed fields preserve negative number boundaries", () => {
    const storage = alloc(8);
    const field = t.field(t.bigint64, 0);

    field.write(storage, -(2 ** 53));
    expect(field.read(storage)).toBe(-(2n ** 53n));
    field.write(storage, -(2n ** 63n));
    expect(field.read(storage)).toBe(-(2n ** 63n));
});

test("unsigned fields reject negative numbers after normalization", () => {
    const field = t.field(t.biguint64, 0);
    const storage = alloc(8);

    expect(() => {
        field.write(storage, -1);
    }).toThrow();
});

test.each([t.int64, t.uint64])("Number64 $kind fields reject lossy reads without changing storage", (descriptor) => {
    const storage = alloc(8);
    const number = t.field(descriptor, 0);
    const exact = t.field(descriptor.kind === "int64" ? t.bigint64 : t.biguint64, 0);

    number.write(storage, 2 ** 53);
    expect(number.read(storage)).toBe(2 ** 53);
    expect(() => number.write(storage, 2 ** 53 + 2)).toThrow(/out of range/);
    expect(number.read(storage)).toBe(2 ** 53);
    exact.write(storage, 2n ** 53n + 1n);
    expect(() => number.read(storage)).toThrow(/2\^53/);
    expect(exact.read(storage)).toBe(2n ** 53n + 1n);
    number.write(storage, 17);
    expect(number.read(storage)).toBe(17);
});

test("float32 fields preserve non-finite values and reject finite overflow before mutation", () => {
    const storage = alloc(4);
    const field = t.field(t.float32, 0);

    for (const value of [NaN, Infinity, -Infinity, -0, 0.25]) {
        field.write(storage, value);
        expect(field.read(storage)).toBe(value);
    }
    expect(() => field.write(storage, 2 ** 128)).toThrow(/out of range/);
    expect(field.read(storage)).toBe(0.25);
});

test("hash tables accept iterable pairs and reject malformed tuples before invocation", () => {
    const size = t.bind("libglib-2.0.so.0", "g_hash_table_size", [t.hashTable(t.string(), t.int64)], t.uint32);

    expect(
        size(
            new Map([
                ["first", 3],
                ["second", -7],
            ]),
        ),
    ).toBe(2);
    expect(
        size(
            new Set([
                ["first", 3],
                ["second", -7],
            ]),
        ),
    ).toBe(2);
    for (const entries of [[["key"]], [["key", 1, 2]], ["ab"], [["valid", 1], null]]) {
        expect(() => size(entries)).toThrow(/tuple/);
    }
    expect(size([["recovered", 9]])).toBe(1);
});
