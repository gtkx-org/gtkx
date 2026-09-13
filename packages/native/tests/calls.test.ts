import { alloc, bind, bindFunctionPointer, call, resolveFunction } from "@gtkx/native";
import { expect, test } from "vitest";

const GLIB = "libglib-2.0.so.0";
const PANGO = "libpango-1.0.so.0";

const BORROWED_STRING = { kind: "string", ownership: "borrowed" } as const;
const OWNED_STRING = { kind: "string", ownership: "full" } as const;

const strdup = bind(GLIB, "g_strdup", [BORROWED_STRING], OWNED_STRING);
const asciiStrup = bind(GLIB, "g_ascii_strup", [BORROWED_STRING, { kind: "int64" }], OWNED_STRING);
const strHasPrefix = bind(GLIB, "g_str_has_prefix", [BORROWED_STRING, BORROWED_STRING], { kind: "int32" });
const strcmp0 = bind(GLIB, "g_strcmp0", [BORROWED_STRING, BORROWED_STRING], { kind: "int32" });
const strnfill = bind(GLIB, "g_strnfill", [{ kind: "uint64" }, { kind: "int8" }], OWNED_STRING);
const randomIntRange = bind(GLIB, "g_random_int_range", [{ kind: "int32" }, { kind: "int32" }], { kind: "int32" });
const randomInt = bind(GLIB, "g_random_int", [], { kind: "uint32" });
const randomSetSeed = bind(GLIB, "g_random_set_seed", [{ kind: "uint32" }], { kind: "void" });
const unicharToupper = bind(GLIB, "g_unichar_toupper", [{ kind: "uint32" }], { kind: "uint32" });
const unitsToDouble = bind(PANGO, "pango_units_to_double", [{ kind: "int32" }], { kind: "float64" });
const unitsFromDouble = bind(PANGO, "pango_units_from_double", [{ kind: "float64" }], { kind: "int32" });

const asciiStrtoll = bind(
    GLIB,
    "g_ascii_strtoll",
    [BORROWED_STRING, { kind: "ref", innerDescriptor: BORROWED_STRING }, { kind: "uint32" }],
    { kind: "bigint64" },
);

const strdupPrintf = bind(
    GLIB,
    "g_strdup_printf",
    [BORROWED_STRING, BORROWED_STRING, BORROWED_STRING],
    OWNED_STRING,
    1,
);

test("a borrowed string argument returns as a string the caller owns", () => {
    expect(call(strdup, ["gtkx"]).value).toBe("gtkx");
});

test("a bound descriptor stays reusable across calls", () => {
    expect(call(strdup, ["gtk"]).value).toBe("gtk");
    expect(call(strdup, ["x"]).value).toBe("x");
});

test("a string and an int64 length uppercase only the requested characters", () => {
    expect(call(asciiStrup, ["gtkx", 2]).value).toBe("GT");
});

test("a negative int64 length uppercases the whole string", () => {
    expect(call(asciiStrup, ["gtkx", -1]).value).toBe("GTKX");
});

test("a gboolean return exposes its integer ABI value", () => {
    expect(call(strHasPrefix, ["gtkx", "gtk"]).value).toBe(1);
    expect(call(strHasPrefix, ["gtkx", "adw"]).value).toBe(0);
});

test("a signed int32 return decodes to a number", () => {
    expect(call(strcmp0, ["gtkx", "gtkx"]).value).toBe(0);
    expect(call(strcmp0, ["a", "b"]).value).toBeLessThan(0);
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
    expect(call(strnfill, [3, 120]).value).toBe("xxx");
});

test("a bigint64 return carries a value beyond the safe integer range", () => {
    expect(call(asciiStrtoll, ["9223372036854775807", null, 10]).value).toBe(9_223_372_036_854_775_807n);
});

test("a ref result identifies its argument while leaving the input untouched", () => {
    const end = Object.freeze({ value: null });
    const result = call(asciiStrtoll, ["12abc", end, 10]);

    expect(result.value).toBe(12n);
    expect(result.outputs).toEqual([{ index: 1, value: "abc" }]);
    expect(end.value).toBeNull();
});

test("an omitted ref produces no output entry", () => {
    const result = call(asciiStrtoll, ["12abc", null, 10]);

    expect(result.value).toBe(12n);
    expect(result.outputs).toEqual([]);
});

test("a call without refs returns an empty output list", () => {
    expect(call(strdup, ["gtkx"])).toEqual({ value: "gtkx", outputs: [] });
});

test("a completion index must identify a one-shot callback", () => {
    expect(() => call(strdup, ["gtkx"], 0)).toThrow();
    expect(() => call(strdup, ["gtkx"], 1)).toThrow();
});

test("a variadic binding formats the arguments past its fixed argument count", () => {
    expect(call(strdupPrintf, ["%s-%s", "gtk", "x"]).value).toBe("gtk-x");
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

test("a null string argument reaches the callee as a null pointer", () => {
    expect(call(strdup, [null]).value).toBeNull();
    expect(call(strcmp0, [null, "a"]).value).toBeLessThan(0);
});

test("an undefined string argument reaches the callee as a null pointer", () => {
    expect(call(strdup, [undefined]).value).toBeNull();
});

test("an empty string argument stays distinct from a null one", () => {
    expect(call(strdup, [""]).value).toBe("");
    expect(call(strHasPrefix, ["gtkx", ""]).value).toBe(1);
});

test("a zero length yields an empty string rather than a null pointer", () => {
    expect(call(strnfill, [0, 120]).value).toBe("");
});

test("a uint32 argument accepts the top of its width", () => {
    expect(call(randomSetSeed, [4_294_967_295]).value).toBeUndefined();
});

test("an int32 argument accepts the top of its width", () => {
    expect(call(randomIntRange, [2_147_483_645, 2_147_483_647]).value).toBeGreaterThanOrEqual(2_147_483_645);
});

test("an int8 argument accepts the top of its width", () => {
    expect(call(strnfill, [3, 127]).value).toBe("\u{7F}\u{7F}\u{7F}");
});

test("a returned string that is not valid UTF-8 decodes to replacement characters", () => {
    expect(call(strnfill, [3, -128]).value).toBe("\u{FFFD}\u{FFFD}\u{FFFD}");
});

test("a unichar at the top of the Unicode range round-trips", () => {
    expect(call(unicharToupper, [0x10_FF_FF]).value).toBe(0x10_FF_FF);
});

test("a resolved function handle invokes its native function", () => {
    const pointer = bindFunctionPointer(
        resolveFunction(GLIB, "g_ascii_strup"),
        [BORROWED_STRING, { kind: "int64" }],
        OWNED_STRING,
        "g_ascii_strup",
    );

    expect(call(pointer, ["gtkx", -1]).value).toBe("GTKX");
});

test("a resolved function handle marshals null arguments", () => {
    const pointer = bindFunctionPointer(resolveFunction(GLIB, "g_strdup"), [BORROWED_STRING], OWNED_STRING, "g_strdup");

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
    expect(() => bindFunctionPointer(alloc(8), [BORROWED_STRING], OWNED_STRING, "g_strdup")).toThrow();
});

test("binding a ref around a descriptor its inner codec rejects throws", () => {
    expect(() => bind(GLIB, "g_strdup", [{ kind: "ref", innerDescriptor: { kind: "void" } }], OWNED_STRING)).toThrow();
});

test("calling a symbol the library does not export throws", () => {
    const missing = bind(GLIB, "g_no_such_function_exists", [], { kind: "void" });

    expect(() => call(missing, []).value).toThrow();
});

test("calling a symbol in a library that cannot be loaded throws", () => {
    const missing = bind("libnosuchlibrary.so.0", "g_strdup", [BORROWED_STRING], OWNED_STRING);

    expect(() => call(missing, ["gtkx"]).value).toThrow();
});

test("calling with too few arguments throws", () => {
    expect(() => call(strcmp0, ["gtkx"]).value).toThrow();
});

test("calling with too many arguments throws", () => {
    expect(() => call(strdup, ["gtkx", "gtkx"]).value).toThrow();
});

test("calling with a non-string value for a string argument throws", () => {
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
    expect(() => call(asciiStrtoll, ["12abc", "abc", 10]).value).toThrow();
});

test("calling with a values argument that is not an array throws", () => {
    expect(() => call(strdup, "gtkx" as never).value).toThrow();
});

test("a call the callee reports a critical failure from throws", () => {
    expect(() => call(strHasPrefix, ["gtkx", null]).value).toThrow();
});

test("an opaque buffer argument reads a typed array's bytes", () => {
    const duplicate = bind(GLIB, "g_strndup", [{ kind: "buffer" }, { kind: "uint64" }], OWNED_STRING);
    expect(call(duplicate, [new TextEncoder().encode("gtkx"), 4]).value).toBe("gtkx");
});

test.each([0, 1, -1, 1.5, NaN, Infinity, 0n, 1n])("buffer arguments reject numeric addresses %s", (value) => {
    const duplicate = bind(GLIB, "g_strdup", [{ kind: "buffer" }], OWNED_STRING);
    expect(() => call(duplicate, [value]).value).toThrow();
});
