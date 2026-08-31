import { bind, call, resolveType, symbolAddress } from "@gtkx/native";
import { expect, test } from "vitest";

const GLIB = "libglib-2.0.so.0";
const GOBJECT = "libgobject-2.0.so.0";

test("a symbol resolves to a non-zero address", () => {
    expect(symbolAddress(GLIB, "g_strdup")).toBeGreaterThan(0n);
});

test("the same symbol resolves to the same address every time", () => {
    expect(symbolAddress(GLIB, "g_strdup")).toBe(symbolAddress(GLIB, "g_strdup"));
});

test("distinct symbols resolve to distinct addresses", () => {
    expect(symbolAddress(GLIB, "g_strdup")).not.toBe(symbolAddress(GLIB, "g_strreverse"));
});

test("a symbol resolves through a library named without its soname suffix", () => {
    expect(symbolAddress("libglib-2.0.so", "g_strdup")).toBe(symbolAddress(GLIB, "g_strdup"));
});

test("a missing symbol throws", () => {
    expect(() => symbolAddress(GLIB, "g_no_such_function_exists")).toThrow();
});

test("a missing library throws", () => {
    expect(() => symbolAddress("libnosuchlibrary.so.0", "g_strdup")).toThrow();
});

test("an empty symbol name throws", () => {
    expect(() => symbolAddress(GLIB, "")).toThrow();
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

    expect(call(typeName, [resolveType(GOBJECT, "g_closure_get_type")])).toBe("GClosure");
});
