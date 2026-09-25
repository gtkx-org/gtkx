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
