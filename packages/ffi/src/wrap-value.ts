/**
 * The single descriptor-driven lift from a raw native value to its typed
 * JavaScript wrapper.
 *
 * {@link wrapValue} is the read-side counterpart of the call layer: given an FFI
 * type descriptor and the raw value a native call produced, it resolves the
 * wrapper class — from the descriptor's interface `typeName`, the runtime
 * `GType` read off the handle, or an explicit fallback class — and lifts the
 * value into its typed form, recursing through collections and hash tables.
 */

import type { ArrayType, Type as FfiType, Handle } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { type GType, TYPE_INVALID, typeFromName } from "./gtype.js";
import { wrapHandle, wrapInterfaceHandle } from "./registry.js";

/**
 * Whether a value of this FFI descriptor is transformed on the way out, as
 * opposed to passing through unchanged. Primitives, enums, flags, strings, and
 * raw buffers are passthrough; object, boxed, struct, fundamental, collection,
 * and hash-table values are lifted into wrappers. Used to skip the per-element
 * map for a primitive collection, which would otherwise reallocate the array.
 */
const isWrappedKind = (ffiType: FfiType): boolean => {
    switch (ffiType.type) {
        case "gobject":
        case "boxed":
        case "struct":
        case "fundamental":
        case "array":
        case "hashtable":
            return true;
        default:
            return false;
    }
};

const wrapCollection = (ffiType: ArrayType, value: unknown, elementClass: AnyClass | undefined): unknown => {
    if (value === null) return null;
    if (!isWrappedKind(ffiType.itemType)) return value;
    return (value as unknown[]).map((item) => wrapValue(ffiType.itemType, item, elementClass));
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
 * self-resolves from the handle's runtime `GType`. An explicit `targetClass`
 * takes precedence.
 */
const wrapGObjectValue = (
    ffiType: GObjectFfiType,
    value: Handle | null,
    targetClass: AnyClass | undefined,
): object | null => {
    if (targetClass !== undefined) return wrapHandle(value, targetClass);
    if (ffiType.typeName === undefined) return wrapHandle(value, undefined);
    const gtype = interfaceGtype(ffiType.typeName);
    if (gtype === TYPE_INVALID) return wrapHandle(value, undefined);
    return wrapInterfaceHandle(value, gtype);
};

/**
 * Lifts a raw FFI value into its typed JavaScript form.
 *
 * @param ffiType - The value's FFI type descriptor.
 * @param value - The raw value the native call produced.
 * @param targetClass - The wrapper class for a pointer-backed value type — a
 *   plain struct, a boxed record, or a named fundamental — or the element
 *   wrapper for a collection. Omitted for GObjects, which self-resolve from
 *   their runtime `GType`, and for primitives, enums, flags, and strings.
 * @returns The wrapped JavaScript value.
 */
export function wrapValue(ffiType: FfiType, value: unknown, targetClass?: AnyClass): unknown {
    switch (ffiType.type) {
        case "gobject":
            return wrapGObjectValue(ffiType, value as Handle | null, targetClass);
        case "struct":
        case "boxed":
        case "fundamental":
            return wrapHandle(value as Handle | null, targetClass);
        case "array":
            return wrapCollection(ffiType, value, targetClass);
        case "hashtable": {
            if (value === null) return null;
            const entries = value as (readonly [unknown, unknown])[];
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
