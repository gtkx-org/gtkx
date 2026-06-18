/**
 * The single descriptor-driven lift from a raw native value to its typed
 * JavaScript wrapper.
 *
 * {@link wrapValue} is the read-side counterpart of the call layer: given an FFI
 * type descriptor and the raw value a native call produced, it resolves the
 * wrapper class — from the descriptor's `GType`, an interface registration, or
 * an explicit fallback — and lifts the value into its typed form, recursing
 * through collections.
 */

import type { Type as FfiType, Handle } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { type GType, typeFromName, typeName } from "./gtype.js";
import { resolveBoxedGtype } from "./gvalue.js";
import { getInterfaceWrapperClass, getWrapperClass, wrapHandle } from "./registry.js";

type ArrayFfiType = Extract<FfiType, { type: "array" }>;

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

const wrapCollection = (ffiType: ArrayFfiType, value: unknown, elementClass: AnyClass | undefined): unknown => {
    if (value === null) return null;
    if (ffiType.kind === "gbytearray") return value;
    if (!isWrappedKind(ffiType.itemType)) return value;
    return (value as unknown[]).map((item) => wrapValue(ffiType.itemType, item, elementClass));
};

type GObjectFfiType = Extract<FfiType, { type: "gobject" }>;

const interfaceClassByDescriptor = new WeakMap<FfiType, AnyClass>();

/**
 * Lifts a `GObject` value. A descriptor naming an interface resolves that
 * interface's wrapper class from the registry — caching it per descriptor — so
 * the wrapper carries the interface's methods even when the runtime instance is
 * a private, unregistered implementation; a concrete-class or untyped descriptor
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
    let cls = interfaceClassByDescriptor.get(ffiType);
    if (cls === undefined) {
        const resolved = getInterfaceWrapperClass(typeFromName(ffiType.typeName));
        if (resolved === null) return wrapHandle(value, undefined);
        interfaceClassByDescriptor.set(ffiType, resolved);
        cls = resolved;
    }
    return wrapHandle(value, cls);
};

const boxedGtypeByDescriptor = new WeakMap<FfiType, GType>();

/**
 * Lifts a boxed or named-fundamental value whose FFI descriptor identifies its
 * `GType`, resolving the wrapper class from the registry and caching the
 * resolved `GType` per descriptor so the lookup is paid once per binding. When
 * the binding supplies an explicit fallback class — a plain struct, or a
 * fundamental with no registered GLib type name — that class is used directly.
 */
const wrapBoxedValue = (ffiType: FfiType, value: Handle | null, targetClass: AnyClass | undefined): object | null => {
    if (value === null) return null;
    if (targetClass !== undefined) return wrapHandle(value, targetClass);
    let gtype = boxedGtypeByDescriptor.get(ffiType);
    if (gtype === undefined) {
        gtype = resolveBoxedGtype(ffiType);
        boxedGtypeByDescriptor.set(ffiType, gtype);
    }
    const cls = getWrapperClass(gtype);
    if (cls === null) {
        throw new Error(`wrapValue: no registered wrapper class for boxed GType '${typeName(gtype) ?? String(gtype)}'`);
    }
    return wrapHandle(value, cls);
};

/**
 * Lifts a raw FFI value into its typed JavaScript form.
 *
 * @param ffiType - The value's FFI type descriptor.
 * @param value - The raw value the native call produced.
 * @param targetClass - The fallback wrapper class for a plain struct or a
 *   GType-less fundamental, or the element wrapper for a collection. Omitted for
 *   GObjects and boxed or named-fundamental values, which self-resolve from their
 *   descriptor's `GType`, and for primitives, enums, flags, and strings.
 * @returns The wrapped JavaScript value.
 */
export function wrapValue(ffiType: FfiType, value: unknown, targetClass?: AnyClass): unknown {
    switch (ffiType.type) {
        case "boolean":
            return Boolean(value);
        case "gobject":
            return wrapGObjectValue(ffiType, value as Handle | null, targetClass);
        case "struct":
            return wrapHandle(value as Handle | null, targetClass);
        case "boxed":
        case "fundamental":
            return wrapBoxedValue(ffiType, value as Handle | null, targetClass);
        case "array":
            return wrapCollection(ffiType, value, targetClass);
        case "hashtable":
            return value === null ? null : new Map(value as Iterable<readonly [unknown, unknown]>);
        default:
            return value;
    }
}
