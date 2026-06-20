import { describe, expect, it } from "vitest";
import { call, type Type } from "../../index.js";

type DescriptorByTag = { [K in Type["type"]]: Extract<Type, { type: K }> };

const REPRESENTATIVES: DescriptorByTag = {
    int8: { type: "int8" },
    uint8: { type: "uint8" },
    int16: { type: "int16" },
    uint16: { type: "uint16" },
    int32: { type: "int32" },
    uint32: { type: "uint32" },
    int64: { type: "int64" },
    uint64: { type: "uint64" },
    bigint64: { type: "bigint64" },
    biguint64: { type: "biguint64" },
    float32: { type: "float32" },
    float64: { type: "float64" },
    enum: { type: "enum", library: "libexample.so", getTypeFn: "example_get_type", signed: false },
    flags: { type: "flags", library: "libexample.so", getTypeFn: "example_get_type", signed: false },
    boolean: { type: "boolean" },
    string: { type: "string", ownership: "borrowed" },
    gobject: { type: "gobject", ownership: "borrowed" },
    boxed: { type: "boxed", ownership: "borrowed", innerType: "GdkRGBA" },
    struct: { type: "struct", ownership: "borrowed" },
    fundamental: {
        type: "fundamental",
        ownership: "borrowed",
        library: "libexample.so",
        refFn: "ref",
        unrefFn: "unref",
    },
    array: { type: "array", itemType: { type: "int8" }, kind: "array", ownership: "borrowed" },
    blob: { type: "blob" },
    hashtable: {
        type: "hashtable",
        keyType: { type: "string", ownership: "borrowed" },
        valueType: { type: "string", ownership: "borrowed" },
        ownership: "borrowed",
    },
    ref: { type: "ref", innerType: { type: "int32" } },
    callback: { type: "callback", argTypes: [], returnType: { type: "void" } },
    unichar: { type: "unichar" },
    void: { type: "void" },
};

const MISSING_LIBRARY = "libgtkx-type-tag-parity-nonexistent.so";
const MISSING_SYMBOL = "gtkx_type_tag_parity_missing_symbol";
const UNKNOWN_TAG_ERROR = /unknown type/i;

const parseReturnType = (returnType: Type): void => {
    call(MISSING_LIBRARY, MISSING_SYMBOL, [], returnType);
};

describe("Type tag parity between the TS Type union and Rust from_js_value", () => {
    for (const [tag, descriptor] of Object.entries(REPRESENTATIVES)) {
        it(`recognizes the '${tag}' tag`, () => {
            expect(() => parseReturnType(descriptor)).not.toThrow(UNKNOWN_TAG_ERROR);
        });
    }

    it("rejects an unregistered tag with an Unknown type error", () => {
        const unknownDescriptor: { type: string } = { type: "definitely-not-a-real-tag" };
        expect(() => parseReturnType(unknownDescriptor as Type)).toThrow(UNKNOWN_TAG_ERROR);
    });
});
