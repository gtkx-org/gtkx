import { bind, bindFunctionPointer, call, symbolAddress } from "@gtkx/native";
import { expect, test } from "vitest";

const GLIB = "libglib-2.0.so.0";
const PANGO = "libpango-1.0.so.0";

const BORROWED_STRING = { kind: "string", ownership: "borrowed" } as const;
const OWNED_STRING = { kind: "string", ownership: "full" } as const;

const strdup = bind(GLIB, "g_strdup", [BORROWED_STRING], OWNED_STRING);
const asciiStrup = bind(GLIB, "g_ascii_strup", [BORROWED_STRING, { kind: "int64" }], OWNED_STRING);
const strHasPrefix = bind(GLIB, "g_str_has_prefix", [BORROWED_STRING, BORROWED_STRING], { kind: "boolean" });
const strcmp0 = bind(GLIB, "g_strcmp0", [BORROWED_STRING, BORROWED_STRING], { kind: "int32" });
const strnfill = bind(GLIB, "g_strnfill", [{ kind: "uint64" }, { kind: "int8" }], OWNED_STRING);
const randomIntRange = bind(GLIB, "g_random_int_range", [{ kind: "int32" }, { kind: "int32" }], { kind: "int32" });
const randomInt = bind(GLIB, "g_random_int", [], { kind: "uint32" });
const randomSetSeed = bind(GLIB, "g_random_set_seed", [{ kind: "uint32" }], { kind: "void" });
const unicharToupper = bind(GLIB, "g_unichar_toupper", [{ kind: "unichar" }], { kind: "unichar" });
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
    expect(call(strdup, ["gtkx"])).toBe("gtkx");
});

test("a bound descriptor stays reusable across calls", () => {
    expect(call(strdup, ["gtk"])).toBe("gtk");
    expect(call(strdup, ["x"])).toBe("x");
});

test("a string and an int64 length uppercase only the requested characters", () => {
    expect(call(asciiStrup, ["gtkx", 2])).toBe("GT");
});

test("a negative int64 length uppercases the whole string", () => {
    expect(call(asciiStrup, ["gtkx", -1])).toBe("GTKX");
});

test("a gboolean return decodes to a boolean", () => {
    expect(call(strHasPrefix, ["gtkx", "gtk"])).toBe(true);
    expect(call(strHasPrefix, ["gtkx", "adw"])).toBe(false);
});

test("a signed int32 return decodes to a number", () => {
    expect(call(strcmp0, ["gtkx", "gtkx"])).toBe(0);
    expect(call(strcmp0, ["a", "b"])).toBeLessThan(0);
});

test("two int32 arguments bound the value the callee returns", () => {
    const value = call(randomIntRange, [10, 20]);

    expect(value).toBeGreaterThanOrEqual(10);
    expect(value).toBeLessThan(20);
});

test("a unichar argument and return marshal as single-character strings", () => {
    expect(call(unicharToupper, ["a"])).toBe("A");
    expect(call(unicharToupper, [0x61])).toBe("A");
});

test("a float64 return decodes to a number", () => {
    expect(call(unitsToDouble, [1024])).toBe(1);
});

test("a float64 argument encodes from a number", () => {
    expect(call(unitsFromDouble, [1])).toBe(1024);
});

test("a uint64 length and an int8 fill character build the requested string", () => {
    expect(call(strnfill, [3, 120])).toBe("xxx");
});

test("a bigint64 return carries a value beyond the safe integer range", () => {
    expect(call(asciiStrtoll, ["9223372036854775807", null, 10])).toBe(9_223_372_036_854_775_807n);
});

test("a ref argument is written back in place with what the callee left in it", () => {
    const end: { value: unknown } = { value: null };

    expect(call(asciiStrtoll, ["12abc", end, 10])).toBe(12n);
    expect(end.value).toBe("abc");
});

test("a variadic binding formats the arguments past its fixed argument count", () => {
    expect(call(strdupPrintf, ["%s-%s", "gtk", "x"])).toBe("gtk-x");
});

test("a call taking no arguments returns the value the seeded callee computes", () => {
    call(randomSetSeed, [42]);
    const first = call(randomInt, []);
    call(randomSetSeed, [42]);

    expect(call(randomInt, [])).toBe(first);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(4_294_967_295);
});

test("a void return decodes to undefined", () => {
    expect(call(randomSetSeed, [42])).toBeUndefined();
});

test("a null string argument reaches the callee as a null pointer", () => {
    expect(call(strdup, [null])).toBeNull();
    expect(call(strcmp0, [null, "a"])).toBeLessThan(0);
});

test("an undefined string argument reaches the callee as a null pointer", () => {
    expect(call(strdup, [undefined])).toBeNull();
});

test("an empty string argument stays distinct from a null one", () => {
    expect(call(strdup, [""])).toBe("");
    expect(call(strHasPrefix, ["gtkx", ""])).toBe(true);
});

test("a zero length yields an empty string rather than a null pointer", () => {
    expect(call(strnfill, [0, 120])).toBe("");
});

test("a uint32 argument accepts the top of its width", () => {
    expect(call(randomSetSeed, [4_294_967_295])).toBeUndefined();
});

test("an int32 argument accepts the top of its width", () => {
    expect(call(randomIntRange, [2_147_483_645, 2_147_483_647])).toBeGreaterThanOrEqual(2_147_483_645);
});

test("an int8 argument accepts the top of its width", () => {
    expect(call(strnfill, [3, 127])).toBe("\u{7F}\u{7F}\u{7F}");
});

test("a returned string that is not valid UTF-8 decodes to replacement characters", () => {
    expect(call(strnfill, [3, -128])).toBe("\u{FFFD}\u{FFFD}\u{FFFD}");
});

test("a unichar at the top of the Unicode range round-trips", () => {
    expect(call(unicharToupper, [0x10_FF_FF])).toBe("\u{10FFFF}");
});

test("an empty string for a unichar argument encodes the zero codepoint", () => {
    expect(call(unicharToupper, [""])).toBe("\u{0}");
});

test("a function pointer bound by address invokes the function living at that address", () => {
    const pointer = bindFunctionPointer(
        symbolAddress(GLIB, "g_ascii_strup"),
        [BORROWED_STRING, { kind: "int64" }],
        OWNED_STRING,
        "g_ascii_strup",
    );

    expect(call(pointer, ["gtkx", -1])).toBe("GTKX");
});

test("a function pointer bound by address marshals a null argument as a null pointer", () => {
    const pointer = bindFunctionPointer(symbolAddress(GLIB, "g_strdup"), [BORROWED_STRING], OWNED_STRING, "g_strdup");

    expect(call(pointer, [null])).toBeNull();
});

test("a function pointer taking no arguments returns what the same symbol bound by name returns", () => {
    const pointer = bindFunctionPointer(symbolAddress(GLIB, "g_random_int"), [], { kind: "uint32" }, "g_random_int");

    call(randomSetSeed, [7]);
    const throughPointer = call(pointer, []);
    call(randomSetSeed, [7]);

    expect(call(randomInt, [])).toBe(throughPointer);
});

test("a function pointer bound at the null address throws", () => {
    expect(() => bindFunctionPointer(0n, [BORROWED_STRING], OWNED_STRING, "g_strdup")).toThrow();
});

test("a function pointer bound at a negative address throws", () => {
    expect(() => bindFunctionPointer(-1n, [BORROWED_STRING], OWNED_STRING, "g_strdup")).toThrow();
});

test("binding a ref around a descriptor its inner codec rejects throws", () => {
    expect(() => bind(GLIB, "g_strdup", [{ kind: "ref", innerDescriptor: { kind: "void" } }], OWNED_STRING)).toThrow();
});

test("calling a symbol the library does not export throws", () => {
    const missing = bind(GLIB, "g_no_such_function_exists", [], { kind: "void" });

    expect(() => call(missing, [])).toThrow();
});

test("calling a symbol in a library that cannot be loaded throws", () => {
    const missing = bind("libnosuchlibrary.so.0", "g_strdup", [BORROWED_STRING], OWNED_STRING);

    expect(() => call(missing, ["gtkx"])).toThrow();
});

test("calling with too few arguments throws", () => {
    expect(() => call(strcmp0, ["gtkx"])).toThrow();
});

test("calling with too many arguments throws", () => {
    expect(() => call(strdup, ["gtkx", "gtkx"])).toThrow();
});

test("calling with a non-string value for a string argument throws", () => {
    expect(() => call(strdup, [{}])).toThrow();
    expect(() => call(strdup, [42])).toThrow();
});

test("calling with a non-numeric value for an integer argument throws", () => {
    expect(() => call(randomIntRange, ["ten", 20])).toThrow();
});

test("calling with an integer argument beyond its width throws", () => {
    expect(() => call(randomIntRange, [2_147_483_648, 2_147_483_649])).toThrow();
});

test("calling with a codepoint outside the Unicode range throws", () => {
    expect(() => call(unicharToupper, [0x11_00_00])).toThrow();
    expect(() => call(unicharToupper, [0xD8_00])).toThrow();
});

test("calling with a multi-character string for a unichar argument throws", () => {
    expect(() => call(unicharToupper, ["ab"])).toThrow();
});

test("calling with a value that is not a ref for a ref argument throws", () => {
    expect(() => call(asciiStrtoll, ["12abc", "abc", 10])).toThrow();
});

test("calling with a values argument that is not an array throws", () => {
    expect(() => call(strdup, "gtkx" as never)).toThrow();
});

test("a call the callee reports a critical failure from throws", () => {
    expect(() => call(strHasPrefix, ["gtkx", null])).toThrow();
});
