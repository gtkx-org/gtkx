import { describe, expect, it } from "vitest";
import type { Descriptor } from "../../index.js";
import { callArgs } from "./utils.js";

type DescriptorByTag = { [K in Descriptor["kind"]]: Extract<Descriptor, { kind: K }> };

const REPRESENTATIVES: DescriptorByTag = {
    int8: { kind: "int8" },
    uint8: { kind: "uint8" },
    int16: { kind: "int16" },
    uint16: { kind: "uint16" },
    int32: { kind: "int32" },
    uint32: { kind: "uint32" },
    int64: { kind: "int64" },
    uint64: { kind: "uint64" },
    bigint64: { kind: "bigint64" },
    biguint64: { kind: "biguint64" },
    float32: { kind: "float32" },
    float64: { kind: "float64" },
    enum: { kind: "enum", library: "libexample.so", getTypeFn: "example_get_type", signed: false },
    flags: { kind: "flags", library: "libexample.so", getTypeFn: "example_get_type", signed: false },
    boolean: { kind: "boolean" },
    string: { kind: "string", ownership: "borrowed" },
    gobject: { kind: "gobject", ownership: "borrowed" },
    boxed: { kind: "boxed", ownership: "borrowed", innerType: "GdkRGBA" },
    struct: { kind: "struct", ownership: "borrowed" },
    fundamental: {
        kind: "fundamental",
        ownership: "borrowed",
        library: "libexample.so",
        refFn: "ref",
        unrefFn: "unref",
    },
    array: { kind: "array", itemType: { kind: "int8" }, arrayKind: "array", ownership: "borrowed" },
    buffer: { kind: "buffer" },
    hashtable: {
        kind: "hashtable",
        keyType: { kind: "string", ownership: "borrowed" },
        valueType: { kind: "string", ownership: "borrowed" },
        ownership: "borrowed",
    },
    ref: { kind: "ref", innerType: { kind: "int32" } },
    callback: { kind: "callback", argTypes: [], returnType: { kind: "void" } },
    unichar: { kind: "unichar" },
    void: { kind: "void" },
};

const MISSING_LIBRARY = "libgtkx-type-tag-parity-nonexistent.so";
const MISSING_SYMBOL = "gtkx_type_tag_parity_missing_symbol";
const UNKNOWN_TAG_ERROR = /unknown type/i;

const parseReturnType = (returnType: Descriptor): void => {
    callArgs(MISSING_LIBRARY, MISSING_SYMBOL, [], returnType);
};

describe("Descriptor tag parity between the TS Descriptor union and Rust from_js_value", () => {
    for (const [tag, descriptor] of Object.entries(REPRESENTATIVES)) {
        it(`recognizes the '${tag}' tag`, () => {
            expect(() => parseReturnType(descriptor)).not.toThrow(UNKNOWN_TAG_ERROR);
        });
    }

    it("rejects an unregistered tag with an Unknown type error", () => {
        const unknownDescriptor: { kind: string } = { kind: "definitely-not-a-real-tag" };
        expect(() => parseReturnType(unknownDescriptor as Descriptor)).toThrow(UNKNOWN_TAG_ERROR);
    });
});
