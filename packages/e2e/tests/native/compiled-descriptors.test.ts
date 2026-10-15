import * as GObject from "@gtkx/gi/gobject";
import {
    alloc,
    bindFunction,
    call,
    compileDescriptor,
    createFunction,
    type Descriptor,
    type ExternalObject,
    type Handle,
    openLibrary,
    readField,
    resolveSymbol,
    setValuePointer,
    writeField,
} from "@gtkx/native";
import { getHandle, t } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { didSettle } from "./helpers/memory.js";

const glib = "libglib-2.0.so.0";
const variant = t.fundamental(glib, "g_variant_ref", "g_variant_unref");
const newVariant = t.bind(glib, "g_variant_new_int32", [t.int32], { ...variant, ownership: "full" });

const symbol = (library: string, name: string): ExternalObject<Handle> => {
    const handle = resolveSymbol(openLibrary(library), name, false);
    if (handle == null) throw new Error(`Missing native function ${name}`);
    return handle;
};

test("one compiled descriptor serves fields, function signatures, and pointer values", () => {
    const descriptor = compileDescriptor({
        kind: "fundamental",
        ownership: "borrowed",
        isCallerAllocated: false,
        isInline: false,
        isValueSafe: false,
        refResolver: () => symbol(glib, "g_variant_ref"),
        unrefResolver: () => symbol(glib, "g_variant_unref"),
        unrefLabel: "g_variant_unref",
    });
    const integer = compileDescriptor({ kind: "int32" });
    const readVariant = bindFunction([descriptor], integer, "g_variant_get_int32", { argOrder: [0] });
    const readPointer = bindFunction([compileDescriptor({ kind: "buffer" })], descriptor, "g_value_get_pointer", {
        argOrder: [0],
    });
    const variantTarget = symbol(glib, "g_variant_get_int32");
    const pointerTarget = symbol("libgobject-2.0.so.0", "g_value_get_pointer");
    const source = newVariant(42);
    const field = alloc(8);
    writeField(descriptor, field, 0, source);
    const value = new GObject.Value();
    value.init(GObject.typeFromName("gpointer"));
    setValuePointer(getHandle(value), descriptor, source);

    const fromField = readField(descriptor, field, 0);
    const fromValue = call(readPointer, pointerTarget, [getHandle(value)]).value;

    expect(call(readVariant, variantTarget, [fromField]).value).toBe(42);
    expect(call(readVariant, variantTarget, [fromValue]).value).toBe(42);
    expect(call(readVariant, variantTarget, [source]).value).toBe(42);
});

test("compiled descriptor trees preserve their snapshot after JavaScript mutation", () => {
    const raw: Descriptor = {
        kind: "array",
        itemDescriptor: { kind: "int32" },
        arrayKind: "fixed",
        fixedSize: 2,
        ownership: "borrowed",
        elementOwnership: "separate",
        isBytes: false,
        isCallerAllocated: false,
        isZeroTerminated: false,
    };
    const descriptor = compileDescriptor(raw);
    raw.itemDescriptor = { kind: "uint8" };
    raw.fixedSize = 1;
    const field = alloc(8);
    const elements = alloc(8);
    const integer = compileDescriptor({ kind: "int32" });
    writeField(integer, elements, 0, 512);
    writeField(integer, elements, 4, -7);
    writeField(compileDescriptor({ kind: "buffer" }), field, 0, elements);

    expect(readField(descriptor, field, 0)).toEqual([512, -7]);
    expect(readField(integer, elements, 4)).toBe(-7);
});

test("calls and callbacks retain compiled metadata after their original handles are collected", async () => {
    const { signature, callback, references } = (() => {
        const raw: Descriptor = { kind: "int32" };
        const descriptor = compileDescriptor(raw);
        const signature = bindFunction([descriptor], descriptor, "retained call", { argOrder: [0] });
        const callbackSignature = bindFunction([descriptor], descriptor, "retained callback", { argOrder: [0] });
        const callback = createFunction(callbackSignature, (value: number) => value * 3, { kind: "pointer" });
        return {
            signature,
            callback,
            references: [new WeakRef(raw), new WeakRef(descriptor), new WeakRef(callbackSignature)],
        };
    })();

    expect(await didSettle(() => references.every((reference) => reference.deref() === undefined))).toBe(true);
    expect(call(signature, callback, [14]).value).toBe(42);
    expect(call(signature, symbol("libc.so.6", "abs"), [-17]).value).toBe(17);
});

test("descriptor compilation rejects invalid nested storage before native use", () => {
    expect(() =>
        compileDescriptor({
            kind: "array",
            itemDescriptor: { kind: "int32" },
            arrayKind: "fixed",
            fixedSize: 2,
            ownership: "borrowed",
            elementOwnership: "separate",
            isBytes: true,
            isCallerAllocated: false,
            isZeroTerminated: false,
        }),
    ).toThrow(/byte array descriptor needs a u8 item codec/);
});
