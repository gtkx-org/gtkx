import {
    alloc,
    bindFunctionPointer,
    call,
    read,
    readFunctionPointer,
    resolveFunction,
    resolveType,
} from "@gtkx/native";
import { expect, test } from "vitest";
import { callAbiFixture } from "./helpers/call-abi.js";

const encoder = new TextEncoder();

const LIBC = "libc.so.6";
const fixture = callAbiFixture();

const duplicateThroughSymbol = (library: string, symbol: string, text: string): unknown =>
    call(bindFunctionPointer(
        resolveFunction(library, symbol),
        [{ kind: "bytes", ownership: "borrowed" }],
        { kind: "bytes", ownership: "full" },
        symbol,
    ), [encoder.encode(text)]).value;

test("resolved function handles invoke the symbol repeatedly", () => {
    expect(duplicateThroughSymbol(LIBC, "strdup", "gtkx")).toEqual(encoder.encode("gtkx"));
    expect(duplicateThroughSymbol(LIBC, "strdup", "again")).toEqual(encoder.encode("again"));
});

test("a symbol resolves through a library named without its soname suffix", () => {
    expect(duplicateThroughSymbol(fixture, "gtkx_call_copy_nullable_bytes", "gtkx")).toEqual(encoder.encode("gtkx"));
});

test("function handles cannot be read as data memory", () => {
    expect(() => read(resolveFunction(LIBC, "strdup"), { kind: "uint8" }, 0)).toThrow();
});

test("reading a null function field throws", () => {
    const block = alloc(8);
    expect(() => readFunctionPointer(block, 0)).toThrow();
});

test.each([1, 8, -1, 0.5])("reading a function field rejects offsets outside its storage: %s", (offset) => {
    expect(() => readFunctionPointer(alloc(8), offset)).toThrow();
});

test("a missing symbol throws", () => {
    expect(() => resolveFunction(LIBC, "gtkx_no_such_function_exists")).toThrow();
});

test("a missing library throws", () => {
    expect(() => resolveFunction("libnosuchlibrary.so.0", "strdup")).toThrow();
});

test("an empty symbol name throws", () => {
    expect(() => resolveFunction(LIBC, "")).toThrow();
});

test("a missing type getter yields the invalid GType rather than throwing", () => {
    expect(resolveType(LIBC, "gtkx_no_such_type_get_type")).toBe(0n);
});

test("a type getter in a missing library throws", () => {
    expect(() => resolveType("libnosuchlibrary.so.0", "gtkx_no_such_type_get_type")).toThrow();
});
