import { describe, expect, it } from "vitest";
import { Writer } from "../../../src/builders/writer.js";
import type { FfiTypeDescriptor } from "../../../src/core/type-system/ffi-types.js";
import { renderFfiTypeExpression, writeFfiTypeExpression } from "../../../src/core/writers/ffi-type-expression.js";

const render = (descriptor: FfiTypeDescriptor): string => renderFfiTypeExpression(descriptor, () => new Writer());

describe("writeFfiTypeExpression — primitives", () => {
    it.each([
        "void",
        "boolean",
        "unichar",
        "int8",
        "uint8",
        "int16",
        "uint16",
        "int32",
        "uint32",
        "int64",
        "uint64",
        "float32",
        "float64",
    ] as const)("renders %s as t.<name>", (type) => {
        expect(render({ type } as FfiTypeDescriptor)).toBe(`t.${type}`);
    });
});

describe("writeFfiTypeExpression — strings and gobjects", () => {
    it("renders borrowed strings by default when ownership is missing", () => {
        expect(render({ type: "string" })).toBe('t.string("borrowed")');
    });

    it("renders full-ownership strings", () => {
        expect(render({ type: "string", ownership: "full" })).toBe('t.string("full")');
    });

    it("renders gobject types using t.object with the supplied ownership", () => {
        expect(render({ type: "gobject", ownership: "full" })).toBe('t.object("full")');
    });
});

describe("writeFfiTypeExpression — boxed", () => {
    it("renders only inner type and ownership when no library or getTypeFn is set", () => {
        expect(render({ type: "boxed", innerType: "GError", ownership: "borrowed" })).toBe(
            't.boxed("GError", "borrowed")',
        );
    });

    it("renders library when present without getTypeFn", () => {
        expect(render({ type: "boxed", innerType: "GError", ownership: "full", library: "libglib-2.0.so.0" })).toBe(
            't.boxed("GError", "full", "libglib-2.0.so.0")',
        );
    });

    it("renders both library and getTypeFn when present", () => {
        expect(
            render({
                type: "boxed",
                innerType: "GError",
                ownership: "full",
                library: "libglib-2.0.so.0",
                getTypeFn: "g_error_get_type",
            }),
        ).toBe('t.boxed("GError", "full", "libglib-2.0.so.0", "g_error_get_type")');
    });

    it("emits an undefined library placeholder when only getTypeFn is set", () => {
        expect(render({ type: "boxed", innerType: "GError", ownership: "full", getTypeFn: "g_error_get_type" })).toBe(
            't.boxed("GError", "full", undefined, "g_error_get_type")',
        );
    });

    it("substitutes an empty string when innerType is not a string", () => {
        expect(render({ type: "boxed", ownership: "borrowed" })).toBe('t.boxed("", "borrowed")');
    });
});

describe("writeFfiTypeExpression — struct", () => {
    it("renders inner type and ownership for structs without an explicit size", () => {
        expect(render({ type: "struct", innerType: "GValue", ownership: "borrowed" })).toBe(
            't.struct("GValue", "borrowed")',
        );
    });

    it("includes size as a third argument when present", () => {
        expect(render({ type: "struct", innerType: "GValue", ownership: "borrowed", size: 24 })).toBe(
            't.struct("GValue", "borrowed", 24)',
        );
    });
});

describe("writeFfiTypeExpression — fundamental", () => {
    it("renders library/refFn/unrefFn/ownership in fixed positional order", () => {
        expect(
            render({
                type: "fundamental",
                library: "libgobject-2.0.so.0",
                refFn: "g_object_ref",
                unrefFn: "g_object_unref",
                ownership: "borrowed",
            }),
        ).toBe('t.fundamental("libgobject-2.0.so.0", "g_object_ref", "g_object_unref", "borrowed")');
    });

    it("appends typeName when provided", () => {
        expect(
            render({
                type: "fundamental",
                library: "lib.so",
                refFn: "ref",
                unrefFn: "unref",
                ownership: "full",
                typeName: "MyType",
            }),
        ).toBe('t.fundamental("lib.so", "ref", "unref", "full", "MyType")');
    });

    it("substitutes empty strings for missing library, refFn, and unrefFn", () => {
        expect(render({ type: "fundamental", ownership: "borrowed" })).toBe('t.fundamental("", "", "", "borrowed")');
    });
});

describe("writeFfiTypeExpression — ref", () => {
    it("wraps the inner descriptor in a t.ref(...) call", () => {
        expect(render({ type: "ref", innerType: { type: "int32" } })).toBe("t.ref(t.int32)");
    });

    it("emits an empty t.ref() when innerType is not an object descriptor", () => {
        expect(render({ type: "ref" })).toBe("t.ref()");
    });
});

describe("writeFfiTypeExpression — hashtable", () => {
    it("renders both key and value descriptors with ownership", () => {
        expect(
            render({
                type: "hashtable",
                keyType: { type: "string", ownership: "borrowed" },
                valueType: { type: "int32" },
                ownership: "full",
            }),
        ).toBe('t.hashTable(t.string("borrowed"), t.int32, "full")');
    });

    it("omits missing key/value descriptors but keeps the comma separator", () => {
        expect(render({ type: "hashtable", ownership: "borrowed" })).toBe('t.hashTable(, , "borrowed")');
    });
});

describe("writeFfiTypeExpression — enum and flags", () => {
    it("renders enums with library, getTypeFn, and signed flag", () => {
        expect(render({ type: "enum", library: "lib.so", getTypeFn: "get_type", signed: true })).toBe(
            't.enum("lib.so", "get_type", true)',
        );
    });

    it("falls back to empty strings and signed=false when library and getTypeFn are missing", () => {
        expect(render({ type: "enum" })).toBe('t.enum("", "", false)');
    });

    it("renders flags using the same shape as enums", () => {
        expect(render({ type: "flags", library: "lib.so", getTypeFn: "flags_get_type", signed: false })).toBe(
            't.flags("lib.so", "flags_get_type", false)',
        );
    });
});

describe("writeFfiTypeExpression — arrays", () => {
    const itemType: FfiTypeDescriptor = { type: "int32" };

    it("emits undefined when the array has no item type", () => {
        expect(render({ type: "array", kind: "array" })).toBe("undefined");
    });

    it("renders a glist", () => {
        expect(render({ type: "array", kind: "glist", itemType, ownership: "full" })).toBe('t.list(t.int32, "full")');
    });

    it("renders a gslist", () => {
        expect(render({ type: "array", kind: "gslist", itemType })).toBe('t.slist(t.int32, "borrowed")');
    });

    it("renders a gptrarray", () => {
        expect(render({ type: "array", kind: "gptrarray", itemType })).toBe('t.ptrArray(t.int32, "borrowed")');
    });

    it("renders a garray with elementSize when provided", () => {
        expect(render({ type: "array", kind: "garray", itemType, elementSize: 4 })).toBe(
            't.gArray(t.int32, "borrowed", 4)',
        );
    });

    it("renders a garray without elementSize when omitted", () => {
        expect(render({ type: "array", kind: "garray", itemType })).toBe('t.gArray(t.int32, "borrowed")');
    });

    it("renders a gbytearray ignoring the item type", () => {
        expect(render({ type: "array", kind: "gbytearray", itemType, ownership: "full" })).toBe('t.byteArray("full")');
    });

    it("renders a sized array including elementSize when present", () => {
        expect(
            render({
                type: "array",
                kind: "sized",
                itemType,
                sizeParamIndex: 2,
                elementSize: 4,
                ownership: "full",
            }),
        ).toBe('t.sizedArray(t.int32, 2, "full", 4)');
    });

    it("renders a sized array using a default sizeParamIndex of 0 when missing", () => {
        expect(render({ type: "array", kind: "sized", itemType })).toBe('t.sizedArray(t.int32, 0, "borrowed")');
    });

    it("renders a fixed array including elementSize when present", () => {
        expect(
            render({
                type: "array",
                kind: "fixed",
                itemType,
                fixedSize: 8,
                elementSize: 4,
                ownership: "borrowed",
            }),
        ).toBe('t.fixedArray(t.int32, 8, "borrowed", 4)');
    });

    it("renders a fixed array using a default fixedSize of 0 when missing", () => {
        expect(render({ type: "array", kind: "fixed", itemType })).toBe('t.fixedArray(t.int32, 0, "borrowed")');
    });

    it("falls back to t.array() with kind, ownership, and named options when kind is unknown", () => {
        expect(
            render({
                type: "array",
                kind: "array",
                itemType,
                ownership: "full",
                elementSize: 4,
                sizeParamIndex: 1,
                fixedSize: 16,
            }),
        ).toBe('t.array(t.int32, "array", "full", { elementSize: 4, sizeParamIndex: 1, fixedSize: 16 })');
    });

    it("omits the options object when no array options are present", () => {
        expect(render({ type: "array", kind: "array", itemType })).toBe('t.array(t.int32, "array", "borrowed")');
    });
});

describe("writeFfiTypeExpression — callback and trampoline", () => {
    it("renders a callback with empty arg array when none are supplied", () => {
        expect(render({ type: "callback", returnType: { type: "void" } })).toBe("t.callback([], t.void)");
    });

    it("renders a callback joining args with comma-space", () => {
        expect(
            render({
                type: "callback",
                argTypes: [{ type: "int32" }, { type: "string", ownership: "borrowed" }],
                returnType: { type: "boolean" },
            }),
        ).toBe('t.callback([t.int32, t.string("borrowed")], t.boolean)');
    });

    it("renders a callback without a return type expression when missing", () => {
        expect(render({ type: "callback", argTypes: [{ type: "int32" }] })).toBe("t.callback([t.int32], )");
    });

    it("renders a trampoline with full options including hasDestroy, userDataIndex, and scope", () => {
        expect(
            render({
                type: "trampoline",
                argTypes: [{ type: "int32" }],
                returnType: { type: "void" },
                hasDestroy: true,
                userDataIndex: 1,
                scope: "async",
            }),
        ).toBe('t.trampoline([t.int32], t.void, { hasDestroy: true, userDataIndex: 1, scope: "async" })');
    });

    it("omits the options object when the trampoline carries no options", () => {
        expect(render({ type: "trampoline", argTypes: [], returnType: { type: "void" } })).toBe(
            "t.trampoline([], t.void)",
        );
    });
});

describe("writeFfiTypeExpression — fallback", () => {
    it("falls back to JSON for unknown descriptor types", () => {
        const writer = new Writer();
        const unknown = { type: "mystery", payload: "x" } as unknown as FfiTypeDescriptor;
        writeFfiTypeExpression(writer, unknown);
        expect(writer.toString()).toBe(JSON.stringify(unknown));
    });
});

describe("renderFfiTypeExpression", () => {
    it("returns the rendered string built by the supplied writer factory", () => {
        let factoryCalls = 0;
        const factory = () => {
            factoryCalls++;
            return new Writer();
        };

        const result = renderFfiTypeExpression({ type: "int32" }, factory);

        expect(result).toBe("t.int32");
        expect(factoryCalls).toBe(1);
    });
});
