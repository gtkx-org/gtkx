import {
    alloc,
    allocField,
    bind,
    bindField,
    call,
    type ExternalObject,
    type Handle,
    read,
    readField,
    write,
    writeField,
} from "@gtkx/native";
import { expect, test } from "vitest";

const encoder = new TextEncoder();

const GLIB = "libglib-2.0.so.0";
const INT32 = bindField({ kind: "int32" });
const FLOAT64 = bindField({ kind: "float64" });
const BYTES = bindField({ kind: "bytes", ownership: "borrowed" });
const BOOLEAN_STORAGE = bindField({ kind: "int32" });
const UNICHAR_STORAGE = bindField({ kind: "uint32" });

test.each([
    { descriptor: { kind: "int8" } as const, value: -128, zero: 0 },
    { descriptor: { kind: "biguint64" } as const, value: 18_446_744_073_709_551_615n, zero: 0n },
    { descriptor: { kind: "float64" } as const, value: 1.25, zero: 0 },
])("a $descriptor.kind field allocates zeroed storage of its ABI width", ({ descriptor, value, zero }) => {
    const field = bindField(descriptor);
    const storage = allocField(field);

    expect(readField(field, storage, 0)).toBe(zero);
    writeField(field, storage, 0, value);
    expect(readField(field, storage, 0)).toBe(value);
    expect(() => readField(field, storage, 1)).toThrow();
    expect(() => writeField(field, storage, 1, value)).toThrow();
});

test("a field without a declared storage size cannot allocate memory", () => {
    const field = bindField({ kind: "struct", ownership: "borrowed", isInline: true });

    expect(() => allocField(field)).toThrow();
});

test("a bound numeric field reads back the value written at the same offset", () => {
    const block = alloc(16);

    writeField(INT32, block, 4, 12_345);

    expect(readField(INT32, block, 4)).toBe(12_345);
});

test("a bound numeric field keeps distinct values at distinct offsets", () => {
    const block = alloc(16);

    writeField(INT32, block, 0, 1);
    writeField(INT32, block, 4, -2);
    writeField(INT32, block, 8, 3);

    expect([readField(INT32, block, 0), readField(INT32, block, 4), readField(INT32, block, 8)]).toEqual([1, -2, 3]);
});

test("a bound field reads back what an unbound write of the same descriptor stored", () => {
    const block = alloc(16);

    write(block, { kind: "int32" }, 8, 99);

    expect(readField(INT32, block, 8)).toBe(99);
});

test("an unbound read of the same descriptor sees what a bound write stored", () => {
    const block = alloc(16);

    writeField(INT32, block, 12, 77);

    expect(read(block, { kind: "int32" }, 12)).toBe(77);
});

test("a bound float field round-trips a fractional value", () => {
    const block = alloc(16);

    writeField(FLOAT64, block, 8, 0.5);

    expect(readField(FLOAT64, block, 8)).toBe(0.5);
});

test("a fixed float array reads unaligned native storage", () => {
    const values = bindField({
        kind: "array",
        arrayKind: "fixed",
        ownership: "borrowed",
        itemDescriptor: { kind: "float64" },
        fixedSize: 2,
    });
    const source = alloc(17);
    writeField(FLOAT64, source, 1, 1.25);
    writeField(FLOAT64, source, 9, -2.5);
    const data = read(source, { kind: "struct", ownership: "borrowed", isInline: true }, 1);
    const field = alloc(8);
    write(field, { kind: "struct", ownership: "borrowed" }, 0, data);

    expect(readField(values, field, 0)).toEqual([1.25, -2.5]);
});

test("a fixed pointer array reads unaligned native storage", () => {
    const values = bindField({
        kind: "array",
        arrayKind: "fixed",
        ownership: "borrowed",
        itemDescriptor: { kind: "struct", ownership: "borrowed", size: 4 },
        fixedSize: 2,
    });
    const first = alloc(4);
    const second = alloc(4);
    writeField(INT32, first, 0, 17);
    writeField(INT32, second, 0, 29);
    const source = alloc(17);
    write(source, { kind: "struct", ownership: "borrowed" }, 1, first);
    write(source, { kind: "struct", ownership: "borrowed" }, 9, second);
    const data = read(source, { kind: "struct", ownership: "borrowed", isInline: true }, 1);
    const field = alloc(8);
    write(field, { kind: "struct", ownership: "borrowed" }, 0, data);

    const items = readField(values, field, 0) as ExternalObject<Handle>[];
    expect(items.map((item) => readField(INT32, item, 0))).toEqual([17, 29]);
});

test("a struct pointer field accepts overlapping source storage", () => {
    const target = alloc(12);
    writeField(INT32, target, 4, 17);
    writeField(INT32, target, 8, 29);
    const source = read(target, { kind: "struct", ownership: "borrowed", isInline: true, size: 8 }, 4);
    const field = alloc(8);
    write(field, { kind: "struct", ownership: "borrowed" }, 0, target);

    write(field, { kind: "struct", ownership: "borrowed", size: 8 }, 0, source);

    expect([readField(INT32, target, 0), readField(INT32, target, 4)]).toEqual([17, 29]);
});

test("a bound borrowed byte field reads back the bytes written at the same offset", () => {
    const block = alloc(16);

    writeField(BYTES, block, 0, encoder.encode("hello"));

    expect(readField(BYTES, block, 0)).toEqual(encoder.encode("hello"));
});

test("a bound gboolean storage field round-trips both integer values", () => {
    const block = alloc(16);

    writeField(BOOLEAN_STORAGE, block, 0, 1);
    writeField(BOOLEAN_STORAGE, block, 4, 0);

    expect([readField(BOOLEAN_STORAGE, block, 0), readField(BOOLEAN_STORAGE, block, 4)]).toEqual([1, 0]);
});

test("a bound bigint field round-trips a value beyond the exact integer range", () => {
    const block = alloc(16);
    const bigint64 = bindField({ kind: "bigint64" });

    writeField(bigint64, block, 8, 9_223_372_036_854_775_807n);

    expect(readField(bigint64, block, 8)).toBe(9_223_372_036_854_775_807n);
});

test("bound descriptors read the fields of a struct a library laid out", () => {
    const stringNew = bind(GLIB, "g_string_new", [{ kind: "bytes", ownership: "borrowed" }], {
        kind: "struct",
        ownership: "borrowed",
    });
    const uint64 = bindField({ kind: "uint64" });
    const gstring = call(stringNew, [encoder.encode("hello")]).value as ExternalObject<Handle>;

    expect([readField(BYTES, gstring, 0), readField(uint64, gstring, 8)]).toEqual([encoder.encode("hello"), 5]);
});

test("a freshly allocated block reads as zero at every offset", () => {
    const block = alloc(16);

    expect([readField(INT32, block, 0), readField(INT32, block, 4), readField(FLOAT64, block, 8)]).toEqual([0, 0, 0]);
});

test("an unwritten byte field reads as null", () => {
    const block = alloc(16);

    expect(readField(BYTES, block, 0)).toBeNull();
});

test("an unwritten gboolean storage field reads as zero", () => {
    const block = alloc(16);

    expect(readField(BOOLEAN_STORAGE, block, 0)).toBe(0);
});

test("overwriting a byte field replaces what the offset holds", () => {
    const block = alloc(16);

    writeField(BYTES, block, 0, encoder.encode("first"));
    writeField(BYTES, block, 0, encoder.encode("second"));

    expect(readField(BYTES, block, 0)).toEqual(encoder.encode("second"));
});

test("a byte field owning its storage keeps the last of several writes", () => {
    const block = alloc(16);
    const owned = bindField({ kind: "bytes", hasOwnedStorage: true, ownership: "full" });

    writeField(owned, block, 0, encoder.encode("first"));
    writeField(owned, block, 0, encoder.encode("second"));
    writeField(owned, block, 0, encoder.encode("third"));

    expect(readField(owned, block, 0)).toEqual(encoder.encode("third"));
});

test("writing null into a byte field clears it back to null", () => {
    const block = alloc(16);

    writeField(BYTES, block, 0, encoder.encode("hello"));
    writeField(BYTES, block, 0, null);

    expect(readField(BYTES, block, 0)).toBeNull();
});

test("one bound descriptor serves distinct handles without carrying state between them", () => {
    const first = alloc(16);
    const second = alloc(16);

    writeField(INT32, first, 0, 42);
    writeField(INT32, second, 0, -42);

    expect([readField(INT32, first, 0), readField(INT32, second, 0)]).toEqual([42, -42]);
});

test("a byte field reads the low byte of the integer written over it", () => {
    const block = alloc(16);
    const uint8 = bindField({ kind: "uint8" });

    writeField(INT32, block, 0, 0x01_02_03_04);

    expect(readField(uint8, block, 0)).toBe(0x04);
});

test("a gunichar storage field reads the written codepoint", () => {
    const block = alloc(16);

    writeField(INT32, block, 0, 0x1_F6_00);

    expect(readField(UNICHAR_STORAGE, block, 0)).toBe(0x1_F6_00);
});

test("an inline struct field decodes to a handle aliasing the owner's memory", () => {
    const block = alloc(16);
    const uint8 = bindField({ kind: "uint8" });
    const inlineStruct = bindField({ kind: "struct", isInline: true, ownership: "borrowed" });
    const strdup = bind(GLIB, "g_strdup", [{ kind: "struct", ownership: "borrowed" }], {
        kind: "bytes",
        ownership: "full",
    });

    writeField(uint8, block, 8, 0x68);
    writeField(uint8, block, 9, 0x69);

    expect(call(strdup, [readField(inlineStruct, block, 8)]).value).toEqual(encoder.encode("hi"));
});

test("writing a string into unsigned storage throws", () => {
    const block = alloc(16);

    expect(() => writeField(UNICHAR_STORAGE, block, 0, "a")).toThrow();
});

test("writing a string into a numeric field throws", () => {
    const block = alloc(16);

    expect(() => writeField(INT32, block, 0, "nope")).toThrow();
});

test("writing a boolean into integer storage throws", () => {
    const block = alloc(16);

    expect(() => writeField(BOOLEAN_STORAGE, block, 0, true)).toThrow();
});

test("writing an out-of-range number into a numeric field throws", () => {
    const block = alloc(16);

    expect(() => writeField(INT32, block, 0, 2 ** 40)).toThrow();
});

test("writing a fractional number into a numeric field throws", () => {
    const block = alloc(16);

    expect(() => writeField(INT32, block, 0, 1.5)).toThrow();
});

test("writing at a negative offset throws", () => {
    const block = alloc(16);

    expect(() => writeField(INT32, block, -4, 1)).toThrow();
});

test("reading at a negative offset throws", () => {
    const block = alloc(16);

    expect(() => readField(INT32, block, -4)).toThrow();
});

test("reading at a fractional offset throws", () => {
    const block = alloc(16);

    expect(() => readField(INT32, block, 1.5)).toThrow();
});

test("reading through a handle over an empty allocation throws", () => {
    const block = alloc(0);

    expect(() => readField(INT32, block, 0)).toThrow();
});

test("writing through a handle over an empty allocation throws", () => {
    const block = alloc(0);

    expect(() => writeField(INT32, block, 0, 1)).toThrow();
});

test("binding a byte descriptor with a negative length throws", () => {
    expect(() => bindField({ kind: "bytes", length: -1, ownership: "borrowed" })).toThrow();
});

test("binding a ref descriptor around a kind it cannot wrap throws", () => {
    expect(() => bindField({ kind: "ref", innerDescriptor: { kind: "void" } })).toThrow();
});
