import { t } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

const bigIntegers = [
    {
        name: "signed",
        descriptor: t.bigint64,
        values: [-(2n ** 63n), -1n, 0n, 2n ** 53n + 1n, 2n ** 63n - 1n],
        invalid: [-(2n ** 63n) - 1n, 2n ** 63n],
    },
    {
        name: "unsigned",
        descriptor: t.biguint64,
        values: [0n, 1n, 2n ** 53n + 1n, 2n ** 64n - 1n],
        invalid: [-1n, 2n ** 64n],
    },
];

describe.each(bigIntegers)("$name 64-bit hash table values", ({ descriptor, values, invalid }) => {
    const roundtrip = t.fn("libglib-2.0.so.0", "g_hash_table_ref", () => ({
        args: [{ type: t.hashTable(t.string(), descriptor, "borrowed"), isRequired: true }],
        returns: t.hashTable(t.string(), descriptor, "full"),
    }));

    it("returns independent maps with exact scalar contents", () => {
        const source = new Map(values.map((value, index) => [`value-${String(index)}`, value]));
        const expected = new Map(source);
        const first = roundtrip(source);
        const second = roundtrip(source);

        expect(first).toBeInstanceOf(Map);
        expect(first).toEqual(expected);
        expect(first).not.toBe(source);
        expect(second).toEqual(expected);
        expect(second).not.toBe(first);
        expect(roundtrip(first)).toEqual(expected);
        expect(source).toEqual(expected);
    });

    it("returns an independent empty map", () => {
        const source: Map<string, bigint> = new Map();
        const result = roundtrip(source);

        expect(result).toEqual(new Map());
        expect(result).not.toBe(source);
        expect(source.size).toBe(0);
    });

    it.each([null, undefined])("rejects %s scalar entries", (value) => {
        expect(() => roundtrip(new Map([["invalid", value]]))).toThrow();
    });

    it("rejects invalid scalar entries and preserves the input", () => {
        for (const value of [...invalid, 1.5, "invalid"]) {
            const source: Map<string, bigint | number | string> = new Map([["valid", 1n], ["invalid", value]]);
            const expected = new Map(source);

            expect(() => roundtrip(source)).toThrow();
            expect(source).toEqual(expected);
        }
        expect(roundtrip(new Map([["recovered", 1n]]))).toEqual(new Map([["recovered", 1n]]));
    });

    it("rejects missing tables before calling the native function", () => {
        expect(() => roundtrip(null)).toThrow();
        expect(() => roundtrip(undefined)).toThrow();
    });
});

it.each([
    { name: "int32", descriptor: t.int32, values: [-1, 0, 2] },
    { name: "uint32", descriptor: t.uint32, values: [0, 1, 2] },
    { name: "int64 number", descriptor: t.int64, values: [-1, 0, 2] },
    { name: "uint64 number", descriptor: t.uint64, values: [0, 1, 2] },
])("preserves direct $name key and value words", ({ descriptor, values }) => {
    const roundtrip = t.fn("libglib-2.0.so.0", "g_hash_table_ref", () => ({
        args: [{ type: t.hashTable(descriptor, descriptor, "borrowed"), isRequired: true }],
        returns: t.hashTable(descriptor, descriptor, "full"),
    }));
    const source = new Map(values.map((value) => [value, value]));

    expect(roundtrip(source)).toEqual(source);
});

it.each([
    { name: "float32", descriptor: t.float32 },
    { name: "float64", descriptor: t.float64 },
])("preserves boxed $name scalar values", ({ descriptor }) => {
    const roundtrip = t.fn("libglib-2.0.so.0", "g_hash_table_ref", () => ({
        args: [{ type: t.hashTable(t.string(), descriptor, "borrowed"), isRequired: true }],
        returns: t.hashTable(t.string(), descriptor, "full"),
    }));
    const source = new Map([["negative", -1.25], ["zero", 0], ["fraction", 0.5]]);

    expect(roundtrip(source)).toEqual(source);
});
