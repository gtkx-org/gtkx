/**
 * Internal `GValue` marshalling surface.
 *
 * Converting a JavaScript value into a `GObject.Value` — and back out — is a
 * gtkx runtime concern with no node-gtk counterpart. These functions back the
 * signal-emission and property-access paths; they are consumed only by other
 * `packages/ffi` modules (and the generated bindings) and are not part of any
 * public `@gtkx/ffi/<namespace>` surface.
 */

import type { Type as FfiType, NativeHandle } from "@gtkx/native";
import type { Object as GObject, GType, Value } from "./generated/gobject/gobject.js";
import { typeFundamental, typeName } from "./generated/gobject/gobject.js";
import {
    fromJS,
    getFundamentalMarshallers,
    getStrvGType,
    newFrom,
    newFromObject,
    readBoxed,
} from "./gobject/gvalue.js";
import { Type } from "./gobject/types.js";
import { GVALUE_BORROWED, gtypeFromFfi, LIBGOBJECT } from "./gtype.js";
import { getHandle } from "./handles.js";
import { read, t } from "./native.js";

/**
 * Creates a `GValue` from an FFI type descriptor and a JavaScript value.
 *
 * Dispatches to the appropriate constructor based on the descriptor's type.
 *
 * @param ffiType - The FFI type descriptor.
 * @param value - The JS value to convert.
 */
export function valueFromFfi(ffiType: FfiType, value: unknown): Value {
    return newFrom(ffiType, value);
}

/**
 * Like {@link valueFromFfi}, but returns `undefined` when `value` is
 * `undefined` (an omitted property) instead of marshalling it.
 *
 * Generated GObject constructors call this for each prop they translate, then
 * spread the results into the record handed up the `super(...)` chain. The
 * canonical constructor keeps only the entries that produced a `Value`, so an
 * omitted prop is naturally dropped while an explicit `null` still marshals.
 *
 * @param ffiType - The FFI type descriptor.
 * @param value - The JS value to convert, or `undefined` to skip.
 */
export function valueFromFfiOptional(ffiType: FfiType, value: unknown): Value | undefined {
    return value === undefined ? undefined : newFrom(ffiType, value);
}

/**
 * Creates a `GValue` typed as `gtype` and marshals `value` into it.
 *
 * The runtime counterpart to {@link valueFromFfi}: where `valueFromFfi`
 * consumes a codegen-time FFI type descriptor, this consumes a runtime `GType`
 * integer (typically derived from a `GParamSpec` via
 * `valueGetType(pspec.getDefaultValue())`).
 *
 * @param gtype - The concrete `GType` (not necessarily the fundamental).
 * @param value - The JS value to marshal.
 * @throws on `G_TYPE_POINTER` with a non-null value, or unsupported `GType`s.
 */
export function valueFromJS(gtype: GType, value: unknown): Value {
    return fromJS(gtype, value);
}

/**
 * Creates a `GValue` initialized with a `GObject` instance.
 *
 * The `GType` is derived from the object's runtime class.
 *
 * @param value - The `GObject` instance, or `null`.
 */
export function valueFromObject(value: GObject | null): Value {
    return newFromObject(value);
}

const g_value_get_boxed_strv = t.fn(
    LIBGOBJECT,
    "g_value_get_boxed",
    [{ type: GVALUE_BORROWED }],
    t.array(t.string("borrowed")),
);

/**
 * Gets the `GType` of the value stored in a `GValue`.
 *
 * Equivalent to the C macro `G_VALUE_TYPE(value)`.
 *
 * @param value - The `GValue` to inspect.
 * @returns The `GType` identifier.
 */
export function valueGetType(value: Value): GType {
    return gtypeFromFfi(read(getHandle(value), t.uint64, 0));
}

const valueGetStrv = (value: Value): string[] => (g_value_get_boxed_strv(getHandle(value)) as string[] | null) ?? [];

const valueFromFundamental = (value: Value, fundamental: GType): unknown => {
    const marshaller = getFundamentalMarshallers().get(fundamental);
    return marshaller ? marshaller.from(value) : undefined;
};

const readPointerValue = (handle: NativeHandle): null => {
    const ptr = read(handle, t.uint64, 8) as number;
    if (ptr !== 0) {
        throw new Error("G_TYPE_POINTER non-null values cannot be marshalled to JS");
    }
    return null;
};

/**
 * Unmarshals a `GValue` into a plain JavaScript value.
 *
 * Dispatches on `typeFundamental(valueGetType(value))`:
 * - Numeric/boolean fundamentals return their primitive JS form.
 * - STRING returns `string | null` (NULL strings are preserved as `null`).
 * - ENUM/FLAGS return the integer payload.
 * - OBJECT returns the wrapped GObject instance, or `null`.
 * - VARIANT returns the wrapped Variant instance, or `null`.
 * - PARAM returns the wrapped ParamSpec instance.
 * - BOXED with the GStrv concrete type returns `string[]`.
 * - BOXED with any other type resolves the wrapper class via the registry
 *   and returns the wrapped instance; throws if no class is registered.
 * - POINTER returns `null` for a null pointer; throws otherwise.
 *
 * @param value - The `GValue` to unmarshal.
 * @throws if the GValue holds an unsupported or unregistered type.
 */
export function valueToJS(value: Value): unknown {
    const gtype = valueGetType(value);

    if (gtype === getStrvGType()) return valueGetStrv(value);

    const fundamental = typeFundamental(gtype);
    const fundamentalValue = valueFromFundamental(value, fundamental);
    if (fundamentalValue !== undefined) return fundamentalValue;

    if (fundamental === Type.POINTER) return readPointerValue(getHandle(value));
    if (fundamental === Type.BOXED) return readBoxed(value);

    throw new Error(`Unsupported GType for valueToJS: ${typeName(gtype) ?? String(gtype)}`);
}
