import {
    bind, call, type CallbackFailure, type Descriptor, type ExternalObject, type Handle, type Ref,
} from "@gtkx/native";
import assert from "node:assert/strict";
import { expect, test } from "vitest";

const GLIB = "libglib-2.0.so.0";
const bytes = { kind: "bytes", ownership: "borrowed" } as const;
const pointer = { kind: "struct", ownership: "borrowed" } as const;
const integer = { kind: "int32" } as const;
const unsigned = { kind: "uint32" } as const;
const buffer = { kind: "buffer" } as const;
const voidType = { kind: "void" } as const;
const errorType = {
    kind: "boxed", typeName: "GError", ownership: "full",
    sharedLibrary: "libgobject-2.0.so.0", getTypeFnName: "g_error_get_type",
} as const;
const parseHook: Descriptor = {
    kind: "callback", argDescriptors: [pointer, pointer, pointer], returnDescriptor: integer,
    canThrow: true, scope: "forever",
};
const contextConstructor = bind(GLIB, "g_option_context_new", [bytes], pointer);
const freeContext = bind(GLIB, "g_option_context_free", [pointer], voidType);
const groupConstructor = bind(GLIB, "g_option_group_new", [bytes, bytes, bytes, buffer, buffer], pointer);
const mainGroup = bind(GLIB, "g_option_context_set_main_group", [pointer, pointer], voidType);
const hooks = bind(GLIB, "g_option_group_set_parse_hooks", [pointer, parseHook, parseHook], voidType);
const parse = bind(GLIB, "g_option_context_parse", [pointer, buffer, buffer, {
    kind: "ref", innerDescriptor: errorType,
}], integer);
const newError = bind(GLIB, "g_error_new_literal", [unsigned, integer, bytes], errorType);
const matchesError = bind(GLIB, "g_error_matches", [
    { ...errorType, ownership: "borrowed" }, unsigned, integer,
], integer);
const quark = bind(GLIB, "g_quark_from_string", [bytes], unsigned);
const encoder = new TextEncoder();

const parseWithHook = (callback: () => number, error: Ref | null): ReturnType<typeof call> => {
    const context = call(contextConstructor, [encoder.encode("gtkx-error-transport")]).value;
    try {
        const group = call(groupConstructor, [
            encoder.encode("main"), encoder.encode(""), encoder.encode(""), null, null,
        ]).value;
        call(hooks, [group, callback, null]);
        call(mainGroup, [context, group]);

        return call(parse, [context, null, null, error]);
    } finally {
        call(freeContext, [context]);
    }
};

const failure = (thrown: unknown): { transport: CallbackFailure & Error; domain: number } => {
    const domain = call(quark, [encoder.encode("gtkx-native-callback-error")]).value as number;
    const nativeError = call(newError, [domain, 17, encoder.encode("failed")]).value as ExternalObject<Handle>;

    return { transport: Object.assign(new Error("callback transport"), { nativeError, thrown }), domain };
};

test("native callback success preserves its status and an empty GError slot", () => {
    const result = parseWithHook(() => 1, { value: null });
    expect(result.value).toBe(1);
    expect(result.outputs).toEqual([{ index: 3, value: null }]);
});

test("native callback failure copies the supplied GError and preserves its owner", () => {
    const { transport, domain } = failure(new Error("failed"));
    expect(call(matchesError, [transport.nativeError, domain, 17]).value).toBe(1);
    const result = parseWithHook(() => {
        throw transport;
    }, { value: null });
    expect(result.value).toBe(0);
    const output = result.outputs.find(({ index }) => index === 3);
    assert.ok(output !== undefined);
    expect(call(matchesError, [output.value, domain, 17]).value).toBe(1);
    expect(call(matchesError, [transport.nativeError, domain, 17]).value).toBe(1);
    expect(parseWithHook(() => 1, { value: null }).value).toBe(1);
});

test.each([
    { name: "Error", thrown: new Error("failed") },
    { name: "primitive", thrown: "failed" },
])("native callback transport propagates its $name without GError storage", ({ thrown }) => {
    const { transport } = failure(thrown);
    assert.throws(() => parseWithHook(() => {
        throw transport;
    }, null));
    expect(parseWithHook(() => 1, null).value).toBe(1);
});

test("an unwrapped native callback exception propagates without GError conversion", () => {
    const original = new Error("failed");
    assert.throws(() => parseWithHook(() => {
        throw original;
    }, { value: null }));
    expect(parseWithHook(() => 1, { value: null }).value).toBe(1);
});

test("native callback completion retention requires a userdata companion", () => {
    expect(() => bind(GLIB, "g_option_group_set_parse_hooks", [
        pointer, { ...parseHook, releaseWithCompletion: true }, parseHook,
    ], voidType)).toThrow();
    expect(parseWithHook(() => 1, null).value).toBe(1);
});
