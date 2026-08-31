import {
    alloc,
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

const GLIB = "libglib-2.0.so.0";
const INT32 = bindField({ kind: "int32" });
const FLOAT64 = bindField({ kind: "float64" });
const STRING = bindField({ kind: "string", ownership: "borrowed" });
const BOOLEAN = bindField({ kind: "boolean" });
const UNICHAR = bindField({ kind: "unichar" });

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

test("a bound borrowed string field reads back the string written at the same offset", () => {
    const block = alloc(16);

    writeField(STRING, block, 0, "hello");

    expect(readField(STRING, block, 0)).toBe("hello");
});

test("a bound boolean field round-trips both truth values", () => {
    const block = alloc(16);

    writeField(BOOLEAN, block, 0, true);
    writeField(BOOLEAN, block, 4, false);

    expect([readField(BOOLEAN, block, 0), readField(BOOLEAN, block, 4)]).toEqual([true, false]);
});

test("a bound bigint field round-trips a value beyond the exact integer range", () => {
    const block = alloc(16);
    const bigint64 = bindField({ kind: "bigint64" });

    writeField(bigint64, block, 8, 9_223_372_036_854_775_807n);

    expect(readField(bigint64, block, 8)).toBe(9_223_372_036_854_775_807n);
});

test("bound descriptors read the fields of a struct a library laid out", () => {
    const stringNew = bind(GLIB, "g_string_new", [{ kind: "string", ownership: "borrowed" }], {
        kind: "struct",
        ownership: "borrowed",
    });
    const uint64 = bindField({ kind: "uint64" });
    const gstring = call(stringNew, ["hello"]) as ExternalObject<Handle>;

    expect([readField(STRING, gstring, 0), readField(uint64, gstring, 8)]).toEqual(["hello", 5]);
});

test("a freshly allocated block reads as zero at every offset", () => {
    const block = alloc(16);

    expect([readField(INT32, block, 0), readField(INT32, block, 4), readField(FLOAT64, block, 8)]).toEqual([0, 0, 0]);
});

test("an unwritten string field reads as null", () => {
    const block = alloc(16);

    expect(readField(STRING, block, 0)).toBeNull();
});

test("an unwritten boolean field reads as false", () => {
    const block = alloc(16);

    expect(readField(BOOLEAN, block, 0)).toBe(false);
});

test("overwriting a string field replaces what the offset holds", () => {
    const block = alloc(16);

    writeField(STRING, block, 0, "first");
    writeField(STRING, block, 0, "second");

    expect(readField(STRING, block, 0)).toBe("second");
});

test("a string field owning its storage keeps the last of several writes", () => {
    const block = alloc(16);
    const owned = bindField({ kind: "string", hasOwnedStorage: true, ownership: "full" });

    writeField(owned, block, 0, "first");
    writeField(owned, block, 0, "second");
    writeField(owned, block, 0, "third");

    expect(readField(owned, block, 0)).toBe("third");
});

test("writing null into a string field clears it back to null", () => {
    const block = alloc(16);

    writeField(STRING, block, 0, "hello");
    writeField(STRING, block, 0, null);

    expect(readField(STRING, block, 0)).toBeNull();
});

test("writing null into a numeric field stores zero", () => {
    const block = alloc(16);

    writeField(INT32, block, 0, 123);
    writeField(INT32, block, 0, null);

    expect(readField(INT32, block, 0)).toBe(0);
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

test("a unichar field decodes the codepoint an integer write stored", () => {
    const block = alloc(16);

    writeField(INT32, block, 0, 0x1_F6_00);

    expect(readField(UNICHAR, block, 0)).toBe("\u{1F600}");
});

test("an inline struct field decodes to a handle aliasing the owner's memory", () => {
    const block = alloc(16);
    const uint8 = bindField({ kind: "uint8" });
    const inlineStruct = bindField({ kind: "struct", isInline: true, ownership: "borrowed" });
    const strdup = bind(GLIB, "g_strdup", [{ kind: "struct", ownership: "borrowed" }], {
        kind: "string",
        ownership: "full",
    });

    writeField(uint8, block, 8, 0x68);
    writeField(uint8, block, 9, 0x69);

    expect(call(strdup, [readField(inlineStruct, block, 8)])).toBe("hi");
});

test("writing a unichar field throws", () => {
    const block = alloc(16);

    expect(() => writeField(UNICHAR, block, 0, "a")).toThrow();
});

test("writing a string into a numeric field throws", () => {
    const block = alloc(16);

    expect(() => writeField(INT32, block, 0, "nope")).toThrow();
});

test("writing a number into a boolean field throws", () => {
    const block = alloc(16);

    expect(() => writeField(BOOLEAN, block, 0, 1)).toThrow();
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

test("binding a string descriptor with a negative length throws", () => {
    expect(() => bindField({ kind: "string", length: -1, ownership: "borrowed" })).toThrow();
});

test("binding a ref descriptor around a kind it cannot wrap throws", () => {
    expect(() => bindField({ kind: "ref", innerDescriptor: { kind: "void" } })).toThrow();
});
