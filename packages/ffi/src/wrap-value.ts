/**
 * The descriptor-driven lift between raw native values and their typed
 * JavaScript wrappers.
 *
 * {@link wrapValue} is the read-side counterpart of the call layer: given an FFI
 * type descriptor and the raw value a native call produced, it resolves the
 * wrapper class — from the descriptor's `GType`, an interface registration, or
 * the fallback class {@link getDescriptorWrapperClass} pairs with the
 * descriptor — and lifts the value into its typed form, recursing through
 * collections and hash tables, where every leaf self-resolves from its own
 * descriptor. {@link unwrapValue} is its write-side inverse.
 */

import type { ArrayType, Type as FfiType, Handle, Value } from "@gtkx/native";
import { getDescriptorWrapperClass } from "./descriptors.js";
import { type GType, TYPE_INVALID, typeFromName, typeName } from "./gtype.js";
import { resolveBoxedGtype } from "./gvalue.js";
import { getWrapperClass, tryGetHandle, wrapHandle, wrapInterfaceHandle } from "./registry.js";

const wrapCollection = (ffiType: ArrayType, value: unknown): unknown => {
    if (value === null) return null;
    return (value as Value[]).map((item) => wrapValue(ffiType.itemType, item));
};

type GObjectFfiType = Extract<FfiType, { type: "gobject" }>;

const interfaceGtypeByName = new Map<string, GType>();

/**
 * Resolves the `GType` of the interface a `GObject` descriptor names, memoized
 * by name. A descriptor carries a `typeName` only for an interface-typed value —
 * codegen omits it for concrete classes — so the name maps straight to its
 * interface `GType`, paid once per interface and never on the per-call hot path.
 * An as-yet-unregistered name resolves to {@link TYPE_INVALID} and is left
 * uncached so a later registration is still seen.
 */
const interfaceGtype = (typeName: string): GType => {
    const cached = interfaceGtypeByName.get(typeName);
    if (cached !== undefined) return cached;
    const gtype = typeFromName(typeName);
    if (gtype !== TYPE_INVALID) interfaceGtypeByName.set(typeName, gtype);
    return gtype;
};

/**
 * Lifts a `GObject` value. A descriptor naming an interface — the only case it
 * carries a `typeName` — resolves through {@link wrapInterfaceHandle} so the
 * wrapper carries the interface's methods even when the runtime instance is a
 * private, unregistered implementation; a concrete-class or untyped descriptor
 * self-resolves from the handle's runtime `GType`.
 */
const wrapGObjectValue = (ffiType: GObjectFfiType, value: Handle | null): object | null => {
    if (ffiType.typeName === undefined) return wrapHandle(value, undefined);
    const gtype = interfaceGtype(ffiType.typeName);
    if (gtype === TYPE_INVALID) return wrapHandle(value, undefined);
    return wrapInterfaceHandle(value, gtype);
};

/**
 * Lifts a boxed or named-fundamental value whose FFI descriptor identifies its
 * `GType`, resolving that `GType` from the descriptor and the wrapper class from
 * the registry. A `GType`-less fundamental instead carries its wrapper class
 * paired with the descriptor, which is used directly.
 */
const wrapBoxedValue = (ffiType: FfiType, value: Handle | null): object | null => {
    if (value === null) return null;
    const paired = getDescriptorWrapperClass(ffiType);
    if (paired !== undefined) return wrapHandle(value, paired);
    const gtype = resolveBoxedGtype(ffiType);
    const cls = getWrapperClass(gtype);
    if (cls === null) {
        throw new Error(`wrapValue: no registered wrapper class for boxed GType '${typeName(gtype) ?? String(gtype)}'`);
    }
    return wrapHandle(value, cls);
};

/**
 * Lifts a raw FFI value into its typed JavaScript form.
 *
 * A plain struct and a `GType`-less fundamental carry no `GType` to recover a
 * class from, so the binding pairs their wrapper class with the descriptor via
 * {@link getDescriptorWrapperClass}; every other kind self-resolves from its
 * descriptor's `GType` or is a primitive passed straight through. Collections
 * and hash tables recurse, each element lifting from its own descriptor.
 *
 * @param ffiType - The value's FFI type descriptor.
 * @param value - The raw value the native call produced.
 * @returns The wrapped JavaScript value.
 */
export function wrapValue(ffiType: FfiType, value: Value): unknown {
    switch (ffiType.type) {
        case "gobject":
            return wrapGObjectValue(ffiType, value as Handle | null);
        case "struct":
            return wrapHandle(value as Handle | null, getDescriptorWrapperClass(ffiType));
        case "boxed":
        case "fundamental":
            return wrapBoxedValue(ffiType, value as Handle | null);
        case "array":
            return wrapCollection(ffiType, value);
        case "hashtable": {
            if (value === null) return null;
            const entries = value as (readonly [Value, Value])[];
            return new Map(
                entries.map(([key, val]): [unknown, unknown] => [
                    wrapValue(ffiType.keyType, key),
                    wrapValue(ffiType.valueType, val),
                ]),
            );
        }
        default:
            return value;
    }
}

const unwrapCollection = (ffiType: ArrayType, value: unknown): Value => {
    if (value == null) return null;
    return (value as unknown[]).map((item) => unwrapValue(ffiType.itemType, item));
};

/**
 * Lowers a typed JavaScript value back into the raw native value its FFI
 * descriptor expects — the write-side inverse of {@link wrapValue}.
 *
 * A wrapper of a `GObject`, boxed, struct, or fundamental value resolves to its
 * backing native handle through {@link tryGetHandle}; collections and hash
 * tables recurse, each element lowering from its own descriptor; every
 * primitive passes straight through. A nullish handle-typed value lowers to
 * `null`.
 *
 * @param ffiType - The value's FFI type descriptor.
 * @param value - The JavaScript value to lower.
 * @returns The raw native value to hand back across the FFI boundary.
 */
export function unwrapValue(ffiType: FfiType, value: unknown): Value {
    switch (ffiType.type) {
        case "gobject":
        case "struct":
        case "boxed":
        case "fundamental":
            return tryGetHandle(value as object | null | undefined) ?? null;
        case "array":
            return unwrapCollection(ffiType, value);
        case "hashtable": {
            if (value == null) return null;
            return [...(value as Map<unknown, unknown>)].map(([key, val]): [Value, Value] => [
                unwrapValue(ffiType.keyType, key),
                unwrapValue(ffiType.valueType, val),
            ]);
        }
        default:
            return value as Value;
    }
}
