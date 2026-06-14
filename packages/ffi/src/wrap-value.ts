/**
 * Lifts raw FFI call results into their typed JavaScript form, driven by the
 * value's FFI descriptor and an optional pre-resolved target class.
 *
 * This is the single runtime home of the wrapping decision: the descriptor's
 * `type` selects the strategy, and `targetClass` supplies the wrapper only for
 * the kinds whose descriptor carries no recoverable identity — an interface
 * (`gobject` plus a class), a boxed record, a struct, or a ref-counted
 * fundamental. A plain GObject needs no class: {@link getNativeObject} resolves
 * its wrapper from the instance's runtime GLib type. Primitives, enums, flags,
 * and strings pass through untouched. For a collection the class applies to
 * each element. Both {@link ffiCall} and the signal `emit` path route every
 * return, out-parameter, and handler argument through here.
 */

import type { Type as FfiType, NativeHandle } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { getNativeObject, getNativeObjectAsInterface } from "./registry.js";

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
    return (value as unknown[]).map((item) => wrapFfiValue(ffiType.itemType, item, elementClass));
};

/**
 * Lifts a raw FFI value into its typed JavaScript form.
 *
 * @param ffiType - The value's FFI type descriptor.
 * @param value - The raw value the native call produced.
 * @param targetClass - The wrapper class for an interface, boxed, struct, or
 *   fundamental value, or the element wrapper for a collection. Omitted for
 *   GObjects, primitives, enums, flags, and strings.
 * @returns The wrapped JavaScript value.
 */
export function wrapFfiValue(ffiType: FfiType, value: unknown, targetClass?: AnyClass): unknown {
    switch (ffiType.type) {
        case "boolean":
            return Boolean(value);
        case "gobject":
            return targetClass === undefined
                ? getNativeObject(value as NativeHandle | null)
                : getNativeObjectAsInterface(value as NativeHandle | null, targetClass);
        case "boxed":
        case "struct":
        case "fundamental":
            return targetClass === undefined
                ? getNativeObject(value as NativeHandle | null)
                : getNativeObject(value as NativeHandle | null, targetClass);
        case "array":
            return wrapCollection(ffiType, value, targetClass);
        case "hashtable":
            return value === null ? null : new Map(value as Iterable<readonly [unknown, unknown]>);
        default:
            return value;
    }
}
