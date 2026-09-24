import { alloc, bind, bindFunctionPointer, call, read, resolveFunction } from "@gtkx/native";
import { expect, test } from "vitest";

const encoder = new TextEncoder();

const GLIB = "libglib-2.0.so.0";
const PANGO = "libpango-1.0.so.0";

const BORROWED_BYTES = { kind: "bytes", ownership: "borrowed" } as const;
const OWNED_BYTES = { kind: "bytes", ownership: "full" } as const;
const BORROWED_VECTOR = {
    kind: "array",
    itemDescriptor: BORROWED_BYTES,
    arrayKind: "array",
    ownership: "borrowed",
    isZeroTerminated: true,
} as const;

const strdup = bind(GLIB, "g_strdup", [BORROWED_BYTES], OWNED_BYTES);
const strdupv = bind(GLIB, "g_strdupv", [BORROWED_VECTOR], {
    ...BORROWED_VECTOR,
    itemDescriptor: OWNED_BYTES,
    ownership: "full",
});
const asciiStrup = bind(GLIB, "g_ascii_strup", [BORROWED_BYTES, { kind: "int64" }], OWNED_BYTES);
const strHasPrefix = bind(GLIB, "g_str_has_prefix", [BORROWED_BYTES, BORROWED_BYTES], { kind: "int32" });
const strcmp0 = bind(GLIB, "g_strcmp0", [BORROWED_BYTES, BORROWED_BYTES], { kind: "int32" });
const strnfill = bind(GLIB, "g_strnfill", [{ kind: "uint64" }, { kind: "int8" }], OWNED_BYTES);
const randomIntRange = bind(GLIB, "g_random_int_range", [{ kind: "int32" }, { kind: "int32" }], { kind: "int32" });
const randomInt = bind(GLIB, "g_random_int", [], { kind: "uint32" });
const randomSetSeed = bind(GLIB, "g_random_set_seed", [{ kind: "uint32" }], { kind: "void" });
const unicharToupper = bind(GLIB, "g_unichar_toupper", [{ kind: "uint32" }], { kind: "uint32" });
const unitsToDouble = bind(PANGO, "pango_units_to_double", [{ kind: "int32" }], { kind: "float64" });
const unitsFromDouble = bind(PANGO, "pango_units_from_double", [{ kind: "float64" }], { kind: "int32" });

const asciiStrtoll = bind(
    GLIB,
    "g_ascii_strtoll",
    [BORROWED_BYTES, { kind: "ref", innerDescriptor: BORROWED_BYTES }, { kind: "uint32" }],
    { kind: "bigint64" },
);

const strdupPrintf = bind(
    GLIB,
    "g_strdup_printf",
    [BORROWED_BYTES, BORROWED_BYTES, BORROWED_BYTES],
    OWNED_BYTES,
    1,
);

test("borrowed byte storage returns as bytes the caller owns", () => {
    expect(call(strdup, [encoder.encode("gtkx")]).value).toEqual(encoder.encode("gtkx"));
});

test("a bound descriptor stays reusable across calls", () => {
    expect(call(strdup, [encoder.encode("gtk")]).value).toEqual(encoder.encode("gtk"));
    expect(call(strdup, [encoder.encode("x")]).value).toEqual(encoder.encode("x"));
});

test("cursor return descriptors reject ownership of another argument's buffer", () => {
    expect(() => bind("libc.so.6", "memchr", [
        {
            kind: "array",
            arrayKind: "sized",
            itemDescriptor: { kind: "uint8" },
            ownership: "borrowed",
            sizeParamIndex: 2,
        },
        { kind: "int32" },
        { kind: "uint64" },
    ], {
        kind: "array",
        arrayKind: "cursor",
        itemDescriptor: { kind: "uint8" },
        ownership: "full",
        baseParamIndex: 0,
        sizeParamIndex: 2,
    })).toThrow();
});

test.each([
    { name: "ordinary items", values: [encoder.encode("gtk"), encoder.encode("x")] },
    { name: "bytes outside UTF-8", values: [new Uint8Array([255, 128]), encoder.encode("gtkx")] },
    { name: "empty items", values: [new Uint8Array(), encoder.encode("gtkx"), new Uint8Array()] },
    { name: "an empty vector", values: [] },
    { name: "a null vector", values: null },
])("a copied byte vector preserves $name", ({ values }) => {
    expect(call(strdupv, [values]).value).toEqual(values);
});

test("a byte vector rejects an item containing an interior NUL", () => {
    expect(() => call(strdupv, [[encoder.encode("first"), new Uint8Array([97, 0, 98])]])).toThrow();
});

test("a string and an int64 length uppercase only the requested characters", () => {
    expect(call(asciiStrup, [encoder.encode("gtkx"), 2]).value).toEqual(encoder.encode("GT"));
});

test("a negative int64 length uppercases the whole string", () => {
    expect(call(asciiStrup, [encoder.encode("gtkx"), -1]).value).toEqual(encoder.encode("GTKX"));
});

test("a gboolean return exposes its integer ABI value", () => {
    expect(call(strHasPrefix, [encoder.encode("gtkx"), encoder.encode("gtk")]).value).toBe(1);
    expect(call(strHasPrefix, [encoder.encode("gtkx"), encoder.encode("adw")]).value).toBe(0);
});

test("a signed int32 return decodes to a number", () => {
    expect(call(strcmp0, [encoder.encode("gtkx"), encoder.encode("gtkx")]).value).toBe(0);
    expect(call(strcmp0, [encoder.encode("a"), encoder.encode("b")]).value).toBeLessThan(0);
});

test("two int32 arguments bound the value the callee returns", () => {
    const value = call(randomIntRange, [10, 20]).value;

    expect(value).toBeGreaterThanOrEqual(10);
    expect(value).toBeLessThan(20);
});

test("a gunichar argument and return use unsigned codepoints", () => {
    expect(call(unicharToupper, [0x61]).value).toBe(0x41);
});

test("a float64 return decodes to a number", () => {
    expect(call(unitsToDouble, [1024]).value).toBe(1);
});

test("a float64 argument encodes from a number", () => {
    expect(call(unitsFromDouble, [1]).value).toBe(1024);
});

test("a uint64 length and an int8 fill character build the requested string", () => {
    expect(call(strnfill, [3, 120]).value).toEqual(encoder.encode("xxx"));
});

test("a bigint64 return carries a value beyond the safe integer range", () => {
    expect(call(asciiStrtoll, [encoder.encode("9223372036854775807"), null, 10]).value)
        .toBe(9_223_372_036_854_775_807n);
});

test.each([null, undefined])("a ref result identifies its argument and preserves its seed (%s)", (value) => {
    const end = Object.freeze({ value });
    const result = call(asciiStrtoll, [encoder.encode("12abc"), end, 10]);

    expect(result.value).toBe(12n);
    expect(result.outputs).toEqual([{ index: 1, value: encoder.encode("abc") }]);
    expect(end.value).toBe(value);
});

test.each([new Uint8Array(), encoder.encode("café")])("a no-length byte ref rejects a seed (%s)", (value) => {
    const end = { value };

    expect(() => call(asciiStrtoll, [encoder.encode("12abc"), end, 10])).toThrow();
    expect(end.value).toBe(value);
});

test.each(["gtkx", ""])("fixed byte references carry bounded text (%s)", (text) => {
    const bytes = encoder.encode(`${text}\0`);
    const compare = bind(GLIB, "g_strcmp0", [
        { kind: "ref", innerDescriptor: { ...BORROWED_BYTES, length: bytes.length } },
        BORROWED_BYTES,
    ], { kind: "int32" });

    expect(call(compare, [bytes, encoder.encode(text)])).toEqual({
        value: 0,
        outputs: [{ index: 0, value: encoder.encode(text) }],
    });
});

test.each([
    { name: "short storage", bytes: new Uint8Array(3), length: 4 },
    { name: "long storage", bytes: new Uint8Array(5), length: 4 },
    { name: "unterminated storage", bytes: encoder.encode("gtkx"), length: 4 },
    { name: "zero capacity", bytes: new Uint8Array(), length: 0 },
])("fixed byte references reject $name before native entry", ({ bytes, length }) => {
    const compare = bind(GLIB, "g_strcmp0", [
        { kind: "ref", innerDescriptor: { ...BORROWED_BYTES, length } },
        BORROWED_BYTES,
    ], { kind: "int32" });

    expect(() => call(compare, [bytes, encoder.encode("gtkx")])).toThrow();
});

test("an omitted ref produces no output entry", () => {
    const result = call(asciiStrtoll, [encoder.encode("12abc"), null, 10]);

    expect(result.value).toBe(12n);
    expect(result.outputs).toEqual([]);
});

test("a call without refs returns an empty output list", () => {
    expect(call(strdup, [encoder.encode("gtkx")])).toEqual({ value: encoder.encode("gtkx"), outputs: [] });
});

test("a scalar output writes into the caller's allocated storage", () => {
    const split = bind("libm.so.6", "modf", [
        { kind: "float64" },
        { kind: "ref", innerDescriptor: { kind: "float64" } },
    ], { kind: "float64" });
    const integer = alloc(8);

    expect(call(split, [12.75, integer])).toEqual({ value: 0.75, outputs: [] });
    expect(read(integer, { kind: "float64" }, 0)).toBe(12);
    expect(call(split, [-3.5, integer])).toEqual({ value: -0.5, outputs: [] });
    expect(read(integer, { kind: "float64" }, 0)).toBe(-3);
    expect(() => call(split, [1, alloc(4)])).toThrow();
    expect(() => call(split, [1, { value: null }])).toThrow();
});

test("a completion index must identify a one-shot callback", () => {
    expect(() => call(strdup, [encoder.encode("gtkx")], 0)).toThrow();
    expect(() => call(strdup, [encoder.encode("gtkx")], 1)).toThrow();
});

test("a variadic binding formats the arguments past its fixed argument count", () => {
    const values = ["%s-%s", "gtk", "x"].map((value) => encoder.encode(value));

    expect(call(strdupPrintf, values).value).toEqual(encoder.encode("gtk-x"));
});

test("a variadic binding rejects a fixed argument count beyond its descriptors", () => {
    expect(() => bind(GLIB, "g_strdup_printf", [BORROWED_BYTES], OWNED_BYTES, 2)).toThrow();
});

test("a call taking no arguments returns the value the seeded callee computes", () => {
    call(randomSetSeed, [42]);
    const first = call(randomInt, []).value;
    call(randomSetSeed, [42]);

    expect(call(randomInt, []).value).toBe(first);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(4_294_967_295);
});

test("a void return decodes to undefined", () => {
    expect(call(randomSetSeed, [42]).value).toBeUndefined();
});

test("a null byte buffer argument reaches the callee as a null pointer", () => {
    expect(call(strdup, [null]).value).toBeNull();
    expect(call(strcmp0, [null, encoder.encode("a")]).value).toBeLessThan(0);
});

test("an undefined byte buffer argument reaches the callee as a null pointer", () => {
    expect(call(strdup, [undefined]).value).toBeNull();
});

test("an empty byte buffer argument stays distinct from a null one", () => {
    expect(call(strdup, [encoder.encode("")]).value).toEqual(encoder.encode(""));
    expect(call(strHasPrefix, [encoder.encode("gtkx"), encoder.encode("")]).value).toBe(1);
});

test("a zero length yields an empty byte buffer rather than a null pointer", () => {
    expect(call(strnfill, [0, 120]).value).toEqual(encoder.encode(""));
});

test("a uint32 argument accepts the top of its width", () => {
    expect(call(randomSetSeed, [4_294_967_295]).value).toBeUndefined();
});

test("an int32 argument accepts the top of its width", () => {
    expect(call(randomIntRange, [2_147_483_645, 2_147_483_647]).value).toBeGreaterThanOrEqual(2_147_483_645);
});

test("an int8 argument accepts the top of its width", () => {
    expect(call(strnfill, [3, 127]).value).toEqual(encoder.encode("\u{7F}\u{7F}\u{7F}"));
});

test("a returned byte buffer preserves bytes outside ASCII", () => {
    expect(call(strnfill, [3, -128]).value).toEqual(new Uint8Array([128, 128, 128]));
});

test("a unichar at the top of the Unicode range round-trips", () => {
    expect(call(unicharToupper, [0x10_FF_FF]).value).toBe(0x10_FF_FF);
});

test("a resolved function handle invokes its native function", () => {
    const pointer = bindFunctionPointer(
        resolveFunction(GLIB, "g_ascii_strup"),
        [BORROWED_BYTES, { kind: "int64" }],
        OWNED_BYTES,
        "g_ascii_strup",
    );

    expect(call(pointer, [encoder.encode("gtkx"), -1]).value).toEqual(encoder.encode("GTKX"));
});

test("a resolved function handle marshals null arguments", () => {
    const pointer = bindFunctionPointer(resolveFunction(GLIB, "g_strdup"), [BORROWED_BYTES], OWNED_BYTES, "g_strdup");

    expect(call(pointer, [null]).value).toBeNull();
});

test("a function pointer taking no arguments returns what the same symbol bound by name returns", () => {
    const pointer = bindFunctionPointer(resolveFunction(GLIB, "g_random_int"), [], { kind: "uint32" }, "g_random_int");

    call(randomSetSeed, [7]);
    const throughPointer = call(pointer, []).value;
    call(randomSetSeed, [7]);

    expect(call(randomInt, []).value).toBe(throughPointer);
});

test("data memory cannot be bound as an executable function", () => {
    expect(() => bindFunctionPointer(alloc(8), [BORROWED_BYTES], OWNED_BYTES, "g_strdup")).toThrow();
});

test("binding a ref around a descriptor its inner codec rejects throws", () => {
    expect(() => bind(GLIB, "g_strdup", [{ kind: "ref", innerDescriptor: { kind: "void" } }], OWNED_BYTES)).toThrow();
});

test("calling a symbol the library does not export throws", () => {
    const missing = bind(GLIB, "g_no_such_function_exists", [], { kind: "void" });

    expect(() => call(missing, []).value).toThrow();
});

test("calling a symbol in a library that cannot be loaded throws", () => {
    const missing = bind("libnosuchlibrary.so.0", "g_strdup", [BORROWED_BYTES], OWNED_BYTES);

    expect(() => call(missing, [encoder.encode("gtkx")]).value).toThrow();
});

test("calling with too few arguments throws", () => {
    expect(() => call(strcmp0, [encoder.encode("gtkx")]).value).toThrow();
});

test("calling with too many arguments throws", () => {
    expect(() => call(strdup, [encoder.encode("gtkx"), encoder.encode("gtkx")]).value).toThrow();
});

test("calling with a value other than bytes for a byte buffer argument throws", () => {
    expect(() => call(strdup, ["gtkx"]).value).toThrow();
    expect(() => call(strdup, [{}]).value).toThrow();
    expect(() => call(strdup, [42]).value).toThrow();
});

test("calling with a non-numeric value for an integer argument throws", () => {
    expect(() => call(randomIntRange, ["ten", 20]).value).toThrow();
});

test("calling with an integer argument beyond its width throws", () => {
    expect(() => call(randomIntRange, [2_147_483_648, 2_147_483_649]).value).toThrow();
});

test("calling with a string for an unsigned argument throws", () => {
    expect(() => call(unicharToupper, ["ab"]).value).toThrow();
});

test("calling with a value that is not a ref for a ref argument throws", () => {
    expect(() => call(asciiStrtoll, [encoder.encode("12abc"), "abc", 10]).value).toThrow();
});

test("calling with a values argument that is not an array throws", () => {
    expect(() => call(strdup, "gtkx" as never).value).toThrow();
});

test("a call the callee reports a critical failure from throws", () => {
    expect(() => call(strHasPrefix, [encoder.encode("gtkx"), null]).value).toThrow();
});

test("an opaque buffer argument reads a typed array's bytes", () => {
    const duplicate = bind(GLIB, "g_strndup", [{ kind: "buffer" }, { kind: "uint64" }], OWNED_BYTES);
    expect(call(duplicate, [encoder.encode("gtkx"), 4]).value).toEqual(encoder.encode("gtkx"));
});

test.each([0, 1, -1, 1.5, NaN, Infinity, 0n, 1n])("buffer arguments reject numeric addresses %s", (value) => {
    const duplicate = bind(GLIB, "g_strdup", [{ kind: "buffer" }], OWNED_BYTES);
    expect(() => call(duplicate, [value]).value).toThrow();
});
