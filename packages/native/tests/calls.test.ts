import { alloc, bind, bindFunctionPointer, call, read, resolveFunction } from "@gtkx/native";
import { expect, test } from "vitest";
import { callAbiFixture } from "./helpers/call-abi.js";

const encoder = new TextEncoder();
const LIBC = "libc.so.6";
const fixture = callAbiFixture();
const BORROWED_BYTES = { kind: "bytes", ownership: "borrowed" } as const;
const OWNED_BYTES = { kind: "bytes", ownership: "full" } as const;
const BORROWED_VECTOR = {
    kind: "array",
    itemDescriptor: BORROWED_BYTES,
    arrayKind: "array",
    ownership: "borrowed",
    isZeroTerminated: true,
} as const;

const duplicate = bind(fixture, "gtkx_call_copy_nullable_bytes", [BORROWED_BYTES], OWNED_BYTES);
const duplicateVector = bind(fixture, "gtkx_call_copy_byte_vector", [BORROWED_VECTOR], {
    ...BORROWED_VECTOR,
    itemDescriptor: OWNED_BYTES,
    ownership: "full",
});
const compare = bind(LIBC, "strcmp", [BORROWED_BYTES, BORROWED_BYTES], { kind: "int32" });
const absolute = bind(LIBC, "abs", [{ kind: "int32" }], { kind: "int32" });
const hostToNetwork = bind(LIBC, "htonl", [{ kind: "uint32" }], { kind: "uint32" });
const parseInteger = bind(
    LIBC,
    "strtoll",
    [BORROWED_BYTES, { kind: "ref", innerDescriptor: BORROWED_BYTES }, { kind: "int32" }],
    { kind: "bigint64" },
);

test("borrowed byte storage returns as bytes the caller owns", () => {
    expect(call(duplicate, [encoder.encode("gtkx")]).value).toEqual(encoder.encode("gtkx"));
});

test("a bound descriptor stays reusable across calls", () => {
    expect(call(duplicate, [encoder.encode("gtk")]).value).toEqual(encoder.encode("gtk"));
    expect(call(duplicate, [encoder.encode("x")]).value).toEqual(encoder.encode("x"));
});

test("cursor return descriptors reject ownership of another argument's buffer", () => {
    expect(() =>
        bind(
            "libc.so.6",
            "memchr",
            [
                {
                    kind: "array",
                    arrayKind: "sized",
                    itemDescriptor: { kind: "uint8" },
                    ownership: "borrowed",
                    sizeParamIndex: 2,
                },
                { kind: "int32" },
                { kind: "uint64" },
            ],
            {
                kind: "array",
                arrayKind: "cursor",
                itemDescriptor: { kind: "uint8" },
                ownership: "full",
                baseParamIndex: 0,
                sizeParamIndex: 2,
            },
        ),
    ).toThrow();
});

test.each([
    { name: "ordinary items", values: [encoder.encode("gtk"), encoder.encode("x")] },
    { name: "bytes outside UTF-8", values: [new Uint8Array([255, 128]), encoder.encode("gtkx")] },
    { name: "empty items", values: [new Uint8Array(), encoder.encode("gtkx"), new Uint8Array()] },
    { name: "an empty vector", values: [] },
    { name: "a null vector", values: null },
])("a copied byte vector preserves $name", ({ values }) => {
    expect(call(duplicateVector, [values]).value).toEqual(values);
});

test("a byte vector rejects an item containing an interior NUL", () => {
    expect(() => call(duplicateVector, [[encoder.encode("first"), new Uint8Array([97, 0, 98])]])).toThrow();
});

test("a bigint64 return carries a value beyond the safe integer range", () => {
    expect(call(parseInteger, [encoder.encode("9223372036854775807"), null, 10]).value).toBe(
        9_223_372_036_854_775_807n,
    );
});

test.each([null, undefined])("a ref result identifies its argument and preserves its seed (%s)", (value) => {
    const end = Object.freeze({ value });
    const result = call(parseInteger, [encoder.encode("12abc"), end, 10]);

    expect(result.value).toBe(12n);
    expect(result.outputs).toEqual([{ index: 1, value: encoder.encode("abc") }]);
    expect(end.value).toBe(value);
});

test.each([new Uint8Array(), encoder.encode("café")])("a no-length byte ref rejects a seed (%s)", (value) => {
    const end = { value };

    expect(() => call(parseInteger, [encoder.encode("12abc"), end, 10])).toThrow();
    expect(end.value).toBe(value);
});

test.each(["gtkx", ""])("fixed byte references carry bounded text (%s)", (text) => {
    const bytes = encoder.encode(`${text}\0`);
    const compare = bind(
        LIBC,
        "strcmp",
        [{ kind: "ref", innerDescriptor: { ...BORROWED_BYTES, length: bytes.length } }, BORROWED_BYTES],
        { kind: "int32" },
    );

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
    const compare = bind(
        LIBC,
        "strcmp",
        [{ kind: "ref", innerDescriptor: { ...BORROWED_BYTES, length } }, BORROWED_BYTES],
        { kind: "int32" },
    );

    expect(() => call(compare, [bytes, encoder.encode("gtkx")])).toThrow();
});

test("an omitted ref produces no output entry", () => {
    const result = call(parseInteger, [encoder.encode("12abc"), null, 10]);

    expect(result.value).toBe(12n);
    expect(result.outputs).toEqual([]);
});

test("a call without refs returns an empty output list", () => {
    expect(call(duplicate, [encoder.encode("gtkx")])).toEqual({ value: encoder.encode("gtkx"), outputs: [] });
});

test("a scalar output writes into the caller's allocated storage", () => {
    const split = bind(
        "libm.so.6",
        "modf",
        [{ kind: "float64" }, { kind: "ref", innerDescriptor: { kind: "float64" } }],
        { kind: "float64" },
    );
    const integer = alloc(8);

    expect(call(split, [12.75, integer])).toEqual({ value: 0.75, outputs: [] });
    expect(read(integer, { kind: "float64" }, 0)).toBe(12);
    expect(call(split, [-3.5, integer])).toEqual({ value: -0.5, outputs: [] });
    expect(read(integer, { kind: "float64" }, 0)).toBe(-3);
    expect(() => call(split, [1, alloc(4)])).toThrow();
    expect(() => call(split, [1, { value: null }])).toThrow();
});

test("a completion index must identify a one-shot callback", () => {
    expect(() => call(duplicate, [encoder.encode("gtkx")], 0)).toThrow();
    expect(() => call(duplicate, [encoder.encode("gtkx")], 1)).toThrow();
});

test.each([4, 7, 8, 9, 16])("a variadic binding formats %i arguments and rejects an invalid final value", (count) => {
    const parts = Array.from({ length: count - 2 }, (_, index) => `part-${String(index)}`);
    const format = parts.map(() => "%s").join("|");
    const descriptors = [
        { kind: "ref", innerDescriptor: OWNED_BYTES } as const,
        ...Array.from({ length: count - 1 }, () => BORROWED_BYTES),
    ];
    const descriptor = bind(LIBC, "asprintf", descriptors, { kind: "int32" }, 2);
    const output = Object.freeze({ value: null });
    const values = [output, ...[format, ...parts].map((value) => encoder.encode(value))];
    const expected = encoder.encode(parts.join("|"));

    expect(call(descriptor, values)).toEqual({ value: expected.length, outputs: [{ index: 0, value: expected }] });
    expect(output.value).toBeNull();
    expect(() => call(descriptor, [...values.slice(0, -1), 42])).toThrow();
});

test("a variadic binding rejects a fixed argument count beyond its descriptors", () => {
    expect(() => bind(LIBC, "asprintf", [BORROWED_BYTES], { kind: "int32" }, 2)).toThrow();
});

test("a null byte buffer argument reaches the callee as a null pointer", () => {
    expect(call(duplicate, [null]).value).toBeNull();
});

test("an undefined byte buffer argument reaches the callee as a null pointer", () => {
    expect(call(duplicate, [undefined]).value).toBeNull();
});

test("an empty byte buffer argument stays distinct from a null one", () => {
    expect(call(duplicate, [encoder.encode("")]).value).toEqual(encoder.encode(""));
});

test("a resolved function handle marshals null arguments", () => {
    const pointer = bindFunctionPointer(
        resolveFunction(fixture, "gtkx_call_copy_nullable_bytes"),
        [BORROWED_BYTES],
        OWNED_BYTES,
        "gtkx_call_copy_nullable_bytes",
    );

    expect(call(pointer, [null]).value).toBeNull();
});

test("data memory cannot be bound as an executable function", () => {
    expect(() => bindFunctionPointer(alloc(8), [BORROWED_BYTES], OWNED_BYTES, "strdup")).toThrow();
});

test("binding a ref around a descriptor its inner codec rejects throws", () => {
    expect(() => bind(LIBC, "strdup", [{ kind: "ref", innerDescriptor: { kind: "void" } }], OWNED_BYTES)).toThrow();
});

test("calling a symbol the library does not export throws", () => {
    const missing = bind(LIBC, "gtkx_no_such_function_exists", [], { kind: "void" });

    expect(() => call(missing, []).value).toThrow();
});

test("calling a symbol in a library that cannot be loaded throws", () => {
    const missing = bind("libnosuchlibrary.so.0", "strdup", [BORROWED_BYTES], OWNED_BYTES);

    expect(() => call(missing, [encoder.encode("gtkx")]).value).toThrow();
});

test("calling with too few arguments throws", () => {
    expect(() => call(compare, [encoder.encode("gtkx")]).value).toThrow();
});

test("calling with too many arguments throws", () => {
    expect(() => call(duplicate, [encoder.encode("gtkx"), encoder.encode("gtkx")]).value).toThrow();
});

test("calling with a value other than bytes for a byte buffer argument throws", () => {
    expect(() => call(duplicate, ["gtkx"]).value).toThrow();
    expect(() => call(duplicate, [{}]).value).toThrow();
    expect(() => call(duplicate, [42]).value).toThrow();
});

test("calling with a non-numeric value for an integer argument throws", () => {
    expect(() => call(absolute, ["ten"]).value).toThrow();
});

test("calling with an integer argument beyond its width throws", () => {
    expect(() => call(absolute, [2_147_483_648]).value).toThrow();
});

test("calling with a string for an unsigned argument throws", () => {
    expect(() => call(hostToNetwork, ["ab"]).value).toThrow();
});

test("calling with a value that is not a ref for a ref argument throws", () => {
    expect(() => call(parseInteger, [encoder.encode("12abc"), "abc", 10]).value).toThrow();
});

test("calling with a values argument that is not an array throws", () => {
    expect(() => {
        Reflect.apply(call, undefined, [duplicate, "gtkx"]);
    }).toThrow();
});

test("an opaque buffer argument reads a typed array's bytes", () => {
    const duplicate = bind(LIBC, "strndup", [{ kind: "buffer" }, { kind: "uint64" }], OWNED_BYTES);
    expect(call(duplicate, [encoder.encode("gtkx"), 4]).value).toEqual(encoder.encode("gtkx"));
});

test.each([0, 1, -1, 1.5, NaN, Infinity, 0n, 1n])("buffer arguments reject numeric addresses %s", (value) => {
    const duplicate = bind(LIBC, "strdup", [{ kind: "buffer" }], OWNED_BYTES);
    expect(() => call(duplicate, [value]).value).toThrow();
});

test("a returned byte buffer preserves bytes outside UTF-8", () => {
    const bytes = new Uint8Array([128, 255, 128]);
    expect(call(duplicate, [bytes]).value).toEqual(bytes);
});

test("a resolved function handle invokes its native function", () => {
    const pointer = bindFunctionPointer(resolveFunction(LIBC, "strdup"), [BORROWED_BYTES], OWNED_BYTES, "strdup");

    expect(call(pointer, [encoder.encode("gtkx")]).value).toEqual(encoder.encode("gtkx"));
});

test("a function pointer taking no arguments matches the symbol bound by name", () => {
    const pointer = bindFunctionPointer(resolveFunction(LIBC, "getpid"), [], { kind: "int32" }, "getpid");
    const named = bind(LIBC, "getpid", [], { kind: "int32" });

    expect(call(pointer, []).value).toBe(call(named, []).value);
    expect(call(pointer, []).value).toBe(process.pid);
});

test("signed and unsigned descriptors accept the top of their widths", () => {
    expect(call(absolute, [-2_147_483_647]).value).toBe(2_147_483_647);
    expect(call(hostToNetwork, [4_294_967_295]).value).toBe(4_294_967_295);
});
