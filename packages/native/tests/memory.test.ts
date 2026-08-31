import { alloc, bind, call, copy, type ExternalObject, type Handle, read, resolveType, write } from "@gtkx/native";
import { expect, test } from "vitest";

const GOBJECT = "libgobject-2.0.so.0";

const typeFromName = bind(GOBJECT, "g_type_from_name", [{ kind: "string", ownership: "borrowed" }], {
    kind: "biguint64",
});

const valueInit = bind(GOBJECT, "g_value_init", [{ kind: "struct", ownership: "borrowed" }, { kind: "biguint64" }], {
    kind: "struct",
    ownership: "borrowed",
});

const valueSetInt = bind(GOBJECT, "g_value_set_int", [{ kind: "struct", ownership: "borrowed" }, { kind: "int32" }], {
    kind: "void",
});

const valueGetInt = bind(GOBJECT, "g_value_get_int", [{ kind: "struct", ownership: "borrowed" }], { kind: "int32" });

test("a fresh allocation reads back as zero-filled memory", () => {
    const block = alloc(32);

    expect(read(block, { kind: "int32" }, 0)).toBe(0);
    expect(read(block, { kind: "float64" }, 8)).toBe(0);
    expect(read(block, { kind: "biguint64" }, 24)).toBe(0n);
});

test("a single-byte allocation round-trips its only byte", () => {
    const block = alloc(1);

    write(block, { kind: "uint8" }, 0, 200);

    expect(read(block, { kind: "uint8" }, 0)).toBe(200);
});

test("an allocation carrying a boxed gtype holds a usable GValue", () => {
    const value = alloc(24, resolveType(GOBJECT, "g_value_get_type"));

    call(valueInit, [value, call(typeFromName, ["gint"])]);
    call(valueSetInt, [value, 42]);

    expect(call(valueGetInt, [value])).toBe(42);
});

test("an allocation carrying a boxed gtype exposes the type tag it was initialized with", () => {
    const value = alloc(24, resolveType(GOBJECT, "g_value_get_type"));

    call(valueInit, [value, call(typeFromName, ["gint"])]);

    expect(read(value, { kind: "biguint64" }, 0)).toBe(call(typeFromName, ["gint"]));
});

test("a registered non-boxed gtype allocates plain writable memory", () => {
    const block = alloc(16, resolveType(GOBJECT, "g_object_get_type"));

    write(block, { kind: "int32" }, 4, 321);

    expect(read(block, { kind: "int32" }, 0)).toBe(0);
    expect(read(block, { kind: "int32" }, 4)).toBe(321);
});

test("a read through a zero-sized allocation throws", () => {
    expect(() => read(alloc(0), { kind: "int32" }, 0)).toThrow();
});

test("a fractional allocation size throws", () => {
    expect(() => alloc(1.5)).toThrow();
});

test("a negative allocation size throws", () => {
    expect(() => alloc(-1)).toThrow();
});

test("a non-finite allocation size throws", () => {
    expect(() => alloc(Infinity)).toThrow();
});

test("an allocation size beyond the exact integer range throws", () => {
    expect(() => alloc(2 ** 53 + 2)).toThrow();
});

test("allocating against the invalid gtype throws", () => {
    expect(() => alloc(24, 0n)).toThrow();
});

test("allocating against a gtype beyond the 64-bit range throws", () => {
    expect(() => alloc(24, 2n ** 64n)).toThrow();
});

test("int8 stores its full range", () => {
    const block = alloc(8);

    write(block, { kind: "int8" }, 0, -128);
    write(block, { kind: "int8" }, 1, 127);

    expect(read(block, { kind: "int8" }, 0)).toBe(-128);
    expect(read(block, { kind: "int8" }, 1)).toBe(127);
});

test("int16 stores its full range", () => {
    const block = alloc(8);

    write(block, { kind: "int16" }, 0, -32_768);
    write(block, { kind: "int16" }, 2, 32_767);

    expect(read(block, { kind: "int16" }, 0)).toBe(-32_768);
    expect(read(block, { kind: "int16" }, 2)).toBe(32_767);
});

test("int32 stores its full range", () => {
    const block = alloc(8);

    write(block, { kind: "int32" }, 0, -2_147_483_648);
    write(block, { kind: "int32" }, 4, 2_147_483_647);

    expect(read(block, { kind: "int32" }, 0)).toBe(-2_147_483_648);
    expect(read(block, { kind: "int32" }, 4)).toBe(2_147_483_647);
});

test("the unsigned integer widths store their maxima", () => {
    const block = alloc(16);

    write(block, { kind: "uint8" }, 0, 255);
    write(block, { kind: "uint16" }, 2, 65_535);
    write(block, { kind: "uint32" }, 4, 4_294_967_295);

    expect(read(block, { kind: "uint8" }, 0)).toBe(255);
    expect(read(block, { kind: "uint16" }, 2)).toBe(65_535);
    expect(read(block, { kind: "uint32" }, 4)).toBe(4_294_967_295);
});

test("the 64-bit integer widths store the exact integer range", () => {
    const block = alloc(16);

    write(block, { kind: "int64" }, 0, -9_007_199_254_740_992);
    write(block, { kind: "uint64" }, 8, 9_007_199_254_740_992);

    expect(read(block, { kind: "int64" }, 0)).toBe(-9_007_199_254_740_992);
    expect(read(block, { kind: "uint64" }, 8)).toBe(9_007_199_254_740_992);
});

test("the bigint codecs store their extremes", () => {
    const block = alloc(24);

    write(block, { kind: "bigint64" }, 0, -9_223_372_036_854_775_808n);
    write(block, { kind: "bigint64" }, 8, 9_223_372_036_854_775_807n);
    write(block, { kind: "biguint64" }, 16, 18_446_744_073_709_551_615n);

    expect(read(block, { kind: "bigint64" }, 0)).toBe(-9_223_372_036_854_775_808n);
    expect(read(block, { kind: "bigint64" }, 8)).toBe(9_223_372_036_854_775_807n);
    expect(read(block, { kind: "biguint64" }, 16)).toBe(18_446_744_073_709_551_615n);
});

test("a bigint slot accepts a plain number", () => {
    const block = alloc(8);

    write(block, { kind: "bigint64" }, 0, 7);

    expect(read(block, { kind: "bigint64" }, 0)).toBe(7n);
});

test("float64 round-trips exactly", () => {
    const block = alloc(16);

    write(block, { kind: "float64" }, 0, Math.PI);
    write(block, { kind: "float64" }, 8, -Number.MAX_VALUE);

    expect(read(block, { kind: "float64" }, 0)).toBe(Math.PI);
    expect(read(block, { kind: "float64" }, 8)).toBe(-Number.MAX_VALUE);
});

test("a boolean round-trips at a non-zero offset", () => {
    const block = alloc(16);

    write(block, { kind: "boolean" }, 8, true);

    expect(read(block, { kind: "boolean" }, 0)).toBe(false);
    expect(read(block, { kind: "boolean" }, 8)).toBe(true);
});

test("writes at distinct offsets do not disturb each other", () => {
    const block = alloc(16);

    write(block, { kind: "int32" }, 0, 5);
    write(block, { kind: "int32" }, 4, 9);
    write(block, { kind: "int32" }, 8, -5);

    expect(read(block, { kind: "int32" }, 0)).toBe(5);
    expect(read(block, { kind: "int32" }, 4)).toBe(9);
    expect(read(block, { kind: "int32" }, 8)).toBe(-5);
});

test("rewriting an offset replaces what was there", () => {
    const block = alloc(8);

    write(block, { kind: "int32" }, 0, 1234);
    write(block, { kind: "int32" }, 0, -1);

    expect(read(block, { kind: "int32" }, 0)).toBe(-1);
});

test("the same byte reads back differently through a signed and an unsigned codec", () => {
    const block = alloc(8);

    write(block, { kind: "uint8" }, 0, 255);

    expect(read(block, { kind: "uint8" }, 0)).toBe(255);
    expect(read(block, { kind: "int8" }, 0)).toBe(-1);
    expect(read(block, { kind: "boolean" }, 0)).toBe(true);
});

test("an all-ones 64-bit slot reads back as minus one through int64", () => {
    const block = alloc(8);

    write(block, { kind: "biguint64" }, 0, 18_446_744_073_709_551_615n);

    expect(read(block, { kind: "int64" }, 0)).toBe(-1);
    expect(read(block, { kind: "bigint64" }, 0)).toBe(-1n);
});

test("float32 narrows the value it stores", () => {
    const block = alloc(8);

    write(block, { kind: "float32" }, 0, 0.1);
    write(block, { kind: "float32" }, 4, 0.5);

    expect(read(block, { kind: "float32" }, 0)).toBe(Math.fround(0.1));
    expect(read(block, { kind: "float32" }, 4)).toBe(Math.fround(0.5));
});

test("float32 stores infinity rather than rejecting it", () => {
    const block = alloc(8);

    write(block, { kind: "float32" }, 0, Infinity);

    expect(read(block, { kind: "float32" }, 0)).toBe(Infinity);
});

test("float64 stores a NaN", () => {
    const block = alloc(8);

    write(block, { kind: "float64" }, 0, NaN);

    expect(read(block, { kind: "float64" }, 0)).toBeNaN();
});

test("writing null stores zero", () => {
    const block = alloc(8);

    write(block, { kind: "int32" }, 0, 1234);
    write(block, { kind: "int32" }, 0, null);

    expect(read(block, { kind: "int32" }, 0)).toBe(0);
});

test("a string round-trips through a pointer slot", () => {
    const block = alloc(8);

    write(block, { kind: "string", ownership: "full" }, 0, "hello");

    expect(read(block, { kind: "string", ownership: "borrowed" }, 0)).toBe("hello");
});

test("rewriting a string slot replaces the string it held", () => {
    const block = alloc(8);

    write(block, { kind: "string", ownership: "full" }, 0, "first");
    write(block, { kind: "string", ownership: "full" }, 0, "second");

    expect(read(block, { kind: "string", ownership: "borrowed" }, 0)).toBe("second");
});

test("a string read from a zero-filled pointer slot yields null", () => {
    const block = alloc(8);

    expect(read(block, { kind: "string", ownership: "borrowed" }, 0)).toBeNull();
});

test("an inline struct reads back as a handle aliasing the memory it came from", () => {
    const block = alloc(16);
    const inner = read(block, { kind: "struct", ownership: "borrowed", isInline: true, size: 8 }, 8);

    write(inner as ExternalObject<Handle>, { kind: "int32" }, 0, 77);

    expect(read(block, { kind: "int32" }, 8)).toBe(77);
    expect(read(block, { kind: "int32" }, 0)).toBe(0);
});

test("a write past an integer width's maximum throws", () => {
    const block = alloc(8);

    expect(() => write(block, { kind: "int8" }, 0, 128)).toThrow();
});

test("a negative write to an unsigned width throws", () => {
    const block = alloc(8);

    expect(() => write(block, { kind: "uint8" }, 0, -1)).toThrow();
});

test("a fractional write to an integer width throws", () => {
    const block = alloc(8);

    expect(() => write(block, { kind: "int32" }, 0, 1.5)).toThrow();
});

test("a non-finite write to an integer width throws", () => {
    const block = alloc(8);

    expect(() => write(block, { kind: "int32" }, 0, NaN)).toThrow();
});

test("an int64 write beyond the exact integer range throws", () => {
    const block = alloc(8);

    expect(() => write(block, { kind: "int64" }, 0, 2 ** 53 + 2)).toThrow();
});

test("a bigint write beyond its width throws", () => {
    const block = alloc(8);

    expect(() => write(block, { kind: "bigint64" }, 0, 2n ** 63n)).toThrow();
});

test("a negative write to biguint64 throws", () => {
    const block = alloc(8);

    expect(() => write(block, { kind: "biguint64" }, 0, -1n)).toThrow();
});

test("a float32 write beyond the single-precision range throws", () => {
    const block = alloc(8);

    expect(() => write(block, { kind: "float32" }, 0, 1e39)).toThrow();
});

test("a write of a non-numeric value throws", () => {
    const block = alloc(8);

    expect(() => write(block, { kind: "int32" }, 0, "nope")).toThrow();
});

test("a non-string write to a string slot throws", () => {
    const block = alloc(8);

    expect(() => write(block, { kind: "string", ownership: "full" }, 0, 5)).toThrow();
});

test("a unichar write into raw memory throws", () => {
    const block = alloc(8);

    expect(() => write(block, { kind: "unichar" }, 0, 65)).toThrow();
});

test("a write at a fractional offset throws", () => {
    const block = alloc(8);

    expect(() => write(block, { kind: "int32" }, 0.5, 1)).toThrow();
});

test("a write at a negative offset throws", () => {
    const block = alloc(8);

    expect(() => write(block, { kind: "int32" }, -4, 1)).toThrow();
});

test("a write to a handle that points at nothing throws", () => {
    expect(() => write(alloc(0), { kind: "int32" }, 0, 1)).toThrow();
});

test("a uint64 read beyond the exact integer range throws", () => {
    const block = alloc(8);

    write(block, { kind: "biguint64" }, 0, 18_446_744_073_709_551_615n);

    expect(() => read(block, { kind: "uint64" }, 0)).toThrow();
});

test("a buffer read from raw memory throws", () => {
    const block = alloc(8);

    expect(() => read(block, { kind: "buffer" }, 0)).toThrow();
});

test("a read at a fractional offset throws", () => {
    const block = alloc(8);

    expect(() => read(block, { kind: "int32" }, 0.5)).toThrow();
});

test("a read at a negative offset throws", () => {
    const block = alloc(8);

    expect(() => read(block, { kind: "int32" }, -4)).toThrow();
});

test("a copy reproduces the source bytes in the destination", () => {
    const source = alloc(16);
    const destination = alloc(16);

    write(source, { kind: "int32" }, 0, 1234);
    write(source, { kind: "int32" }, 4, -5678);
    copy(destination, source, 8);

    expect(read(destination, { kind: "int32" }, 0)).toBe(1234);
    expect(read(destination, { kind: "int32" }, 4)).toBe(-5678);
});

test("a copy into a larger destination leaves the trailing bytes untouched", () => {
    const source = alloc(16);
    const destination = alloc(32);

    write(source, { kind: "float64" }, 0, 1.5);
    write(source, { kind: "float64" }, 8, -2.25);
    copy(destination, source, 16);

    expect(read(destination, { kind: "float64" }, 0)).toBe(1.5);
    expect(read(destination, { kind: "float64" }, 8)).toBe(-2.25);
    expect(read(destination, { kind: "float64" }, 16)).toBe(0);
});

test("a copy of a prefix leaves the rest of the destination untouched", () => {
    const source = alloc(16);
    const destination = alloc(16);

    write(source, { kind: "int32" }, 0, 11);
    write(source, { kind: "int32" }, 4, 22);
    write(destination, { kind: "int32" }, 4, 99);
    copy(destination, source, 4);

    expect(read(destination, { kind: "int32" }, 0)).toBe(11);
    expect(read(destination, { kind: "int32" }, 4)).toBe(99);
});

test("a copy of zero bytes leaves the destination unchanged", () => {
    const source = alloc(8);
    const destination = alloc(8);

    write(source, { kind: "int32" }, 0, 1234);
    write(destination, { kind: "int32" }, 0, 4321);
    copy(destination, source, 0);

    expect(read(destination, { kind: "int32" }, 0)).toBe(4321);
});

test("copying a handle onto itself preserves its contents", () => {
    const block = alloc(8);

    write(block, { kind: "int32" }, 0, 7);
    copy(block, block, 8);

    expect(read(block, { kind: "int32" }, 0)).toBe(7);
});

test("a copy carries a boxed allocation's contents into another", () => {
    const gvalueType = resolveType(GOBJECT, "g_value_get_type");
    const source = alloc(24, gvalueType);
    const destination = alloc(24, gvalueType);

    call(valueInit, [source, call(typeFromName, ["gint"])]);
    call(valueSetInt, [source, 99]);
    copy(destination, source, 24);

    expect(call(valueGetInt, [destination])).toBe(99);
});

test("a fractional copy size throws", () => {
    expect(() => copy(alloc(8), alloc(8), 1.5)).toThrow();
});

test("a negative copy size throws", () => {
    expect(() => copy(alloc(8), alloc(8), -1)).toThrow();
});

test("copying from a handle that points at nothing throws", () => {
    expect(() => copy(alloc(8), alloc(0), 4)).toThrow();
});

test("copying into a handle that points at nothing throws", () => {
    expect(() => copy(alloc(0), alloc(8), 4)).toThrow();
});

test("copying more bytes than the destination holds throws", () => {
    expect(() => copy(alloc(16), alloc(4096), 4096)).toThrow();
});

test("copying more bytes than the source holds throws", () => {
    expect(() => copy(alloc(4096), alloc(16), 4096)).toThrow();
});

test("copying a size just past the allocation throws", () => {
    expect(() => copy(alloc(16), alloc(16), 17)).toThrow();
});

test("copying exactly the allocated size is allowed", () => {
    const source = alloc(16);
    const destination = alloc(16);
    write(source, { kind: "int32" }, 12, 42);
    copy(destination, source, 16);

    expect(read(destination, { kind: "int32" }, 12)).toBe(42);
});
