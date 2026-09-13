import {
    alloc,
    bind,
    bindFunctionPointer,
    call,
    read,
    readFunctionPointer,
    resolveFunction,
    resolveType,
} from "@gtkx/native";
import { expect, test } from "vitest";

const GLIB = "libglib-2.0.so.0";
const GOBJECT = "libgobject-2.0.so.0";

const duplicateThroughSymbol = (library: string, text: string): unknown =>
    call(bindFunctionPointer(
        resolveFunction(library, "g_strdup"),
        [{ kind: "string", ownership: "borrowed" }],
        { kind: "string", ownership: "full" },
        "g_strdup",
    ), [text]).value;

test("resolved function handles invoke the symbol repeatedly", () => {
    expect(duplicateThroughSymbol(GLIB, "gtkx")).toBe("gtkx");
    expect(duplicateThroughSymbol(GLIB, "again")).toBe("again");
});

test("a symbol resolves through a library named without its soname suffix", () => {
    expect(duplicateThroughSymbol("libglib-2.0.so", "gtkx")).toBe("gtkx");
});

test("function handles cannot be read as data memory", () => {
    expect(() => read(resolveFunction(GLIB, "g_strdup"), { kind: "uint8" }, 0)).toThrow();
});

test("reading a null function field throws", () => {
    const block = alloc(8);
    expect(() => readFunctionPointer(block, 0)).toThrow();
});

test.each([1, 8, -1, 0.5])("reading a function field rejects offsets outside its storage: %s", (offset) => {
    expect(() => readFunctionPointer(alloc(8), offset)).toThrow();
});

test("a missing symbol throws", () => {
    expect(() => resolveFunction(GLIB, "g_no_such_function_exists")).toThrow();
});

test("a missing library throws", () => {
    expect(() => resolveFunction("libnosuchlibrary.so.0", "g_strdup")).toThrow();
});

test("an empty symbol name throws", () => {
    expect(() => resolveFunction(GLIB, "")).toThrow();
});

test("a registered type resolves to a non-zero GType", () => {
    expect(resolveType(GOBJECT, "g_closure_get_type")).toBeGreaterThan(0n);
});

test("the same type resolves to the same GType every time", () => {
    expect(resolveType(GOBJECT, "g_closure_get_type")).toBe(resolveType(GOBJECT, "g_closure_get_type"));
});

test("distinct types resolve to distinct GTypes", () => {
    expect(resolveType(GOBJECT, "g_closure_get_type")).not.toBe(resolveType(GOBJECT, "g_value_get_type"));
});

test("a missing type getter yields the invalid GType rather than throwing", () => {
    expect(resolveType(GOBJECT, "g_no_such_type_get_type")).toBe(0n);
});

test("a type getter in a missing library throws", () => {
    expect(() => resolveType("libnosuchlibrary.so.0", "g_closure_get_type")).toThrow();
});

test("a resolved GType names itself back through the library it came from", () => {
    const typeName = bind(GOBJECT, "g_type_name", [{ kind: "biguint64" }], {
        kind: "string",
        ownership: "borrowed",
    });

    expect(call(typeName, [resolveType(GOBJECT, "g_closure_get_type")]).value).toBe("GClosure");
});
