import { resolveType, TYPE_INVALID, typeFromName, typeName } from "@gtkx/runtime";
import { expect, test } from "vitest";

const library = "libgobject-2.0.so.0";

test("type registration functions resolve to their registered GTypes", () => {
    const type = resolveType(library, "g_bytes_get_type");

    expect(type).not.toBe(TYPE_INVALID);
    expect(typeName(type)).toBe("GBytes");
    expect(typeFromName("GBytes")).toBe(type);
    expect(resolveType(library, "g_bytes_get_type")).toBe(type);
});

test("absent type registration functions resolve to the invalid GType", () => {
    expect(resolveType(library, "gtkx_missing_get_type")).toBe(TYPE_INVALID);
    expect(resolveType(library, "gtkx_missing_get_type")).toBe(TYPE_INVALID);
});

test("an absent symbol does not hide library-loading failures", () => {
    expect(resolveType(library, "gtkx_unavailable_get_type")).toBe(TYPE_INVALID);

    expect(() => resolveType("libgtkx-missing.so", "gtkx_unavailable_get_type")).toThrow(
        /Failed to load library 'libgtkx-missing\.so'.*cannot open shared object file/,
    );
    expect(() => resolveType("libgtkx-missing.so", "gtkx_unavailable_get_type")).toThrow("Failed to load library");
});

test("type lookup caches are separated by library", () => {
    expect(resolveType("libc.so.6", "g_error_get_type")).toBe(TYPE_INVALID);
    expect(typeName(resolveType(library, "g_error_get_type"))).toBe("GError");
});

test("type lookup retains the first loadable library fallback", () => {
    expect(typeName(resolveType(`libgtkx-missing.so,${library}`, "g_array_get_type"))).toBe("GArray");
    expect(resolveType(`libc.so.6,${library}`, "g_array_get_type")).toBe(TYPE_INVALID);
});

test.each(["\0suffix", "\0"])("malformed symbol suffix %j fails instead of resolving as absent", (suffix) => {
    expect(() => resolveType(library, `g_error_get_type${suffix}`)).toThrow(/symbol.*NUL/i);
});
