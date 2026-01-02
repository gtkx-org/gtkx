import { describe, expect, it } from "vitest";
import {
    arrayType,
    boxedSelfType,
    boxedType,
    collectExternalNamespaces,
    FFI_INT32,
    FFI_POINTER,
    FFI_UINT32,
    FFI_VOID,
    type FfiTypeDescriptor,
    getPrimitiveTypeSize,
    gobjectType,
    isMemoryWritableType,
    isPrimitiveFieldType,
    PRIMITIVE_TYPE_MAP,
    refType,
    SELF_TYPE_GOBJECT,
    SELF_TYPE_GPARAM,
    stringType,
    structType,
    type TypeImport,
} from "../../../src/core/type-system/ffi-types.js";

describe("PRIMITIVE_TYPE_MAP", () => {
    it("maps void types correctly", () => {
        expect(PRIMITIVE_TYPE_MAP.get("void")).toEqual({ ts: "void", ffi: { type: "undefined" } });
        expect(PRIMITIVE_TYPE_MAP.get("none")).toEqual({ ts: "void", ffi: { type: "undefined" } });
    });

    it("maps boolean type correctly", () => {
        expect(PRIMITIVE_TYPE_MAP.get("gboolean")).toEqual({ ts: "boolean", ffi: { type: "boolean" } });
    });

    it("maps integer types with correct sizes", () => {
        expect(PRIMITIVE_TYPE_MAP.get("gint")?.ffi).toEqual({ type: "int", size: 32, unsigned: false });
        expect(PRIMITIVE_TYPE_MAP.get("guint")?.ffi).toEqual({ type: "int", size: 32, unsigned: true });
        expect(PRIMITIVE_TYPE_MAP.get("gint64")?.ffi).toEqual({ type: "int", size: 64, unsigned: false });
        expect(PRIMITIVE_TYPE_MAP.get("guint64")?.ffi).toEqual({ type: "int", size: 64, unsigned: true });
    });

    it("maps 8-bit types correctly", () => {
        expect(PRIMITIVE_TYPE_MAP.get("gint8")?.ffi).toEqual({ type: "int", size: 8, unsigned: false });
        expect(PRIMITIVE_TYPE_MAP.get("guint8")?.ffi).toEqual({ type: "int", size: 8, unsigned: true });
        expect(PRIMITIVE_TYPE_MAP.get("gchar")?.ffi).toEqual({ type: "int", size: 8, unsigned: false });
        expect(PRIMITIVE_TYPE_MAP.get("guchar")?.ffi).toEqual({ type: "int", size: 8, unsigned: true });
    });

    it("maps 16-bit types correctly", () => {
        expect(PRIMITIVE_TYPE_MAP.get("gint16")?.ffi).toEqual({ type: "int", size: 16, unsigned: false });
        expect(PRIMITIVE_TYPE_MAP.get("guint16")?.ffi).toEqual({ type: "int", size: 16, unsigned: true });
        expect(PRIMITIVE_TYPE_MAP.get("gshort")?.ffi).toEqual({ type: "int", size: 16, unsigned: false });
        expect(PRIMITIVE_TYPE_MAP.get("gushort")?.ffi).toEqual({ type: "int", size: 16, unsigned: true });
    });

    it("maps floating point types correctly", () => {
        expect(PRIMITIVE_TYPE_MAP.get("gfloat")?.ffi).toEqual({ type: "float", size: 32 });
        expect(PRIMITIVE_TYPE_MAP.get("gdouble")?.ffi).toEqual({ type: "float", size: 64 });
        expect(PRIMITIVE_TYPE_MAP.get("float")?.ffi).toEqual({ type: "float", size: 32 });
        expect(PRIMITIVE_TYPE_MAP.get("double")?.ffi).toEqual({ type: "float", size: 64 });
    });

    it("maps pointer types correctly", () => {
        expect(PRIMITIVE_TYPE_MAP.get("gpointer")?.ffi).toEqual({ type: "int", size: 64, unsigned: true });
        expect(PRIMITIVE_TYPE_MAP.get("gconstpointer")?.ffi).toEqual({ type: "int", size: 64, unsigned: true });
    });

    it("maps GLib special types correctly", () => {
        expect(PRIMITIVE_TYPE_MAP.get("GType")?.ffi).toEqual({ type: "int", size: 64, unsigned: true });
        expect(PRIMITIVE_TYPE_MAP.get("GQuark")?.ffi).toEqual({ type: "int", size: 32, unsigned: true });
        expect(PRIMITIVE_TYPE_MAP.get("GLib.Quark")?.ffi).toEqual({ type: "int", size: 32, unsigned: true });
    });

    it("maps size types correctly", () => {
        expect(PRIMITIVE_TYPE_MAP.get("gsize")?.ffi).toEqual({ type: "int", size: 64, unsigned: true });
        expect(PRIMITIVE_TYPE_MAP.get("gssize")?.ffi).toEqual({ type: "int", size: 64, unsigned: false });
    });

    it("maps all primitives to number TypeScript type except boolean and void", () => {
        for (const [name, { ts }] of PRIMITIVE_TYPE_MAP) {
            if (name === "gboolean") {
                expect(ts).toBe("boolean");
            } else if (name === "void" || name === "none") {
                expect(ts).toBe("void");
            } else {
                expect(ts).toBe("number");
            }
        }
    });
});

describe("FFI constants", () => {
    it("FFI_VOID is undefined type", () => {
        expect(FFI_VOID).toEqual({ type: "undefined" });
    });

    it("FFI_POINTER is 64-bit unsigned", () => {
        expect(FFI_POINTER).toEqual({ type: "int", size: 64, unsigned: true });
    });

    it("FFI_INT32 is 32-bit signed", () => {
        expect(FFI_INT32).toEqual({ type: "int", size: 32, unsigned: false });
    });

    it("FFI_UINT32 is 32-bit unsigned", () => {
        expect(FFI_UINT32).toEqual({ type: "int", size: 32, unsigned: true });
    });
});

describe("stringType", () => {
    it("creates string type with full ownership", () => {
        expect(stringType(true)).toEqual({ type: "string", ownership: "full" });
    });

    it("creates string type with none ownership", () => {
        expect(stringType(false)).toEqual({ type: "string", ownership: "none" });
    });
});

describe("gobjectType", () => {
    it("creates gobject type with full ownership", () => {
        expect(gobjectType(true)).toEqual({ type: "gobject", ownership: "full" });
    });

    it("creates gobject type with none ownership", () => {
        expect(gobjectType(false)).toEqual({ type: "gobject", ownership: "none" });
    });
});

describe("boxedType", () => {
    it("creates boxed type with full ownership", () => {
        expect(boxedType("Rectangle", true)).toEqual({
            type: "boxed",
            innerType: "Rectangle",
            ownership: "full",
            lib: undefined,
            getTypeFn: undefined,
        });
    });

    it("creates boxed type with none ownership", () => {
        expect(boxedType("Rectangle", false)).toEqual({
            type: "boxed",
            innerType: "Rectangle",
            ownership: "none",
            lib: undefined,
            getTypeFn: undefined,
        });
    });

    it("creates boxed type with lib and getTypeFn", () => {
        expect(boxedType("Rectangle", true, "libgdk-4.so.1", "gdk_rectangle_get_type")).toEqual({
            type: "boxed",
            innerType: "Rectangle",
            ownership: "full",
            lib: "libgdk-4.so.1",
            getTypeFn: "gdk_rectangle_get_type",
        });
    });
});

describe("structType", () => {
    it("creates struct type with full ownership", () => {
        expect(structType("Rectangle", true)).toEqual({
            type: "struct",
            innerType: "Rectangle",
            ownership: "full",
            size: undefined,
        });
    });

    it("creates struct type with size", () => {
        expect(structType("Rectangle", true, 16)).toEqual({
            type: "struct",
            innerType: "Rectangle",
            ownership: "full",
            size: 16,
        });
    });
});

describe("arrayType", () => {
    it("creates array type with default values", () => {
        const itemType: FfiTypeDescriptor = { type: "string", ownership: "none" };
        expect(arrayType(itemType)).toEqual({
            type: "array",
            itemType,
            listType: "array",
            ownership: "full",
        });
    });

    it("creates glist array type", () => {
        const itemType: FfiTypeDescriptor = { type: "gobject", ownership: "none" };
        expect(arrayType(itemType, "glist", false)).toEqual({
            type: "array",
            itemType,
            listType: "glist",
            ownership: "none",
        });
    });

    it("creates gslist array type", () => {
        const itemType: FfiTypeDescriptor = { type: "gobject", ownership: "none" };
        expect(arrayType(itemType, "gslist", true)).toEqual({
            type: "array",
            itemType,
            listType: "gslist",
            ownership: "full",
        });
    });
});

describe("refType", () => {
    it("creates ref type with inner type", () => {
        expect(refType(FFI_INT32)).toEqual({
            type: "ref",
            innerType: FFI_INT32,
        });
    });

    it("creates nested ref type", () => {
        const stringDescriptor: FfiTypeDescriptor = { type: "string", ownership: "none" };
        expect(refType(stringDescriptor)).toEqual({
            type: "ref",
            innerType: stringDescriptor,
        });
    });
});

describe("Self type descriptors", () => {
    it("SELF_TYPE_GOBJECT is gobject with none ownership", () => {
        expect(SELF_TYPE_GOBJECT).toEqual({ type: "gobject", ownership: "none" });
    });

    it("SELF_TYPE_GPARAM is gparam with none ownership", () => {
        expect(SELF_TYPE_GPARAM).toEqual({ type: "gparam", ownership: "none" });
    });

    it("boxedSelfType creates boxed self type", () => {
        expect(boxedSelfType("Rectangle", "libgdk-4.so.1")).toEqual({
            type: "boxed",
            ownership: "none",
            innerType: "Rectangle",
            lib: "libgdk-4.so.1",
        });
    });
});

describe("isPrimitiveFieldType", () => {
    it("returns true for primitive field types", () => {
        expect(isPrimitiveFieldType("gint")).toBe(true);
        expect(isPrimitiveFieldType("guint")).toBe(true);
        expect(isPrimitiveFieldType("gfloat")).toBe(true);
        expect(isPrimitiveFieldType("gboolean")).toBe(true);
    });

    it("returns false for non-primitive types", () => {
        expect(isPrimitiveFieldType("utf8")).toBe(false);
        expect(isPrimitiveFieldType("gpointer")).toBe(false);
        expect(isPrimitiveFieldType("GObject")).toBe(false);
    });
});

describe("isMemoryWritableType", () => {
    it("returns true for memory-writable types", () => {
        expect(isMemoryWritableType("gint")).toBe(true);
        expect(isMemoryWritableType("guint")).toBe(true);
        expect(isMemoryWritableType("gfloat")).toBe(true);
        expect(isMemoryWritableType("gboolean")).toBe(true);
        expect(isMemoryWritableType("gdouble")).toBe(true);
    });

    it("returns false for non-writable types", () => {
        expect(isMemoryWritableType("utf8")).toBe(false);
        expect(isMemoryWritableType("gpointer")).toBe(false);
    });
});

describe("getPrimitiveTypeSize", () => {
    it("returns 1 for gboolean", () => {
        expect(getPrimitiveTypeSize("gboolean")).toBe(1);
    });

    it("returns correct sizes for integer types", () => {
        expect(getPrimitiveTypeSize("gint8")).toBe(1);
        expect(getPrimitiveTypeSize("guint8")).toBe(1);
        expect(getPrimitiveTypeSize("gint16")).toBe(2);
        expect(getPrimitiveTypeSize("guint16")).toBe(2);
        expect(getPrimitiveTypeSize("gint")).toBe(4);
        expect(getPrimitiveTypeSize("guint")).toBe(4);
        expect(getPrimitiveTypeSize("gint32")).toBe(4);
        expect(getPrimitiveTypeSize("guint32")).toBe(4);
        expect(getPrimitiveTypeSize("gint64")).toBe(8);
        expect(getPrimitiveTypeSize("guint64")).toBe(8);
    });

    it("returns correct sizes for float types", () => {
        expect(getPrimitiveTypeSize("gfloat")).toBe(4);
        expect(getPrimitiveTypeSize("gdouble")).toBe(8);
    });

    it("returns 8 for unknown types", () => {
        expect(getPrimitiveTypeSize("unknown")).toBe(8);
    });
});

describe("collectExternalNamespaces", () => {
    it("returns empty array for empty imports", () => {
        expect(collectExternalNamespaces([])).toEqual([]);
    });

    it("returns empty array for internal imports only", () => {
        const imports: TypeImport[] = [
            { kind: "class", name: "Button", namespace: "Gtk", transformedName: "Button", isExternal: false },
            { kind: "class", name: "Label", namespace: "Gtk", transformedName: "Label", isExternal: false },
        ];
        expect(collectExternalNamespaces(imports)).toEqual([]);
    });

    it("collects external namespaces", () => {
        const imports: TypeImport[] = [
            { kind: "class", name: "File", namespace: "Gio", transformedName: "File", isExternal: true },
            { kind: "record", name: "Rectangle", namespace: "Gdk", transformedName: "Rectangle", isExternal: true },
        ];
        expect(collectExternalNamespaces(imports)).toEqual(["Gio", "Gdk"]);
    });

    it("deduplicates namespaces", () => {
        const imports: TypeImport[] = [
            { kind: "class", name: "File", namespace: "Gio", transformedName: "File", isExternal: true },
            { kind: "interface", name: "ListModel", namespace: "Gio", transformedName: "ListModel", isExternal: true },
            { kind: "class", name: "AsyncResult", namespace: "Gio", transformedName: "AsyncResult", isExternal: true },
        ];
        expect(collectExternalNamespaces(imports)).toEqual(["Gio"]);
    });

    it("preserves order of first occurrence", () => {
        const imports: TypeImport[] = [
            { kind: "class", name: "Widget", namespace: "Gtk", transformedName: "Widget", isExternal: true },
            { kind: "record", name: "Rectangle", namespace: "Gdk", transformedName: "Rectangle", isExternal: true },
            { kind: "class", name: "Button", namespace: "Gtk", transformedName: "Button", isExternal: true },
            { kind: "enum", name: "Orientation", namespace: "Gtk", transformedName: "Orientation", isExternal: true },
        ];
        expect(collectExternalNamespaces(imports)).toEqual(["Gtk", "Gdk"]);
    });
});
