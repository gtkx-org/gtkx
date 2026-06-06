/**
 * Internal `GValue` marshalling surface.
 *
 * Converting a JavaScript value into a `GValue` — and back out — is a gtkx
 * runtime concern. These functions back the
 * signal-emission and property-access paths; they are consumed only by other
 * `packages/ffi` modules (and the generated bindings) and are not part of any
 * public namespace surface. They build on the hand-written {@link GValue}
 * wrapper, keeping the runtime independent of generated code.
 *
 * The forward builders ({@link valueFromFfi}, {@link valueFromObject}) live in
 * `./gobject/gvalue.js` and are re-exported here so the whole marshalling
 * vocabulary reads under one `value<Source>` stem; this module adds the
 * omitted-prop guard {@link valueFromFfiOptional}, the property accessors
 * {@link getObjectProperty} / {@link setObjectProperty}, and the reverse
 * direction {@link valueToJS}.
 */

import type { Type as FfiType, NativeHandle } from "@gtkx/native";
import {
    emptyValueFromFfi,
    type GValueReader,
    getBoxed,
    getFundamentalMarshallers,
    getStrvGType,
    valueFromFfi,
    valueGetType,
} from "./gobject/gvalue.js";
import { GValue, setGValuePointer } from "./gobject/gvalue-native.js";
import { Type } from "./gobject/types.js";
import { type GType, GVALUE_BORROWED, LIBGOBJECT, typeFundamental, typeName } from "./gtype.js";
import { getHandle } from "./handles.js";
import { alloc, call, read, t, write } from "./native.js";

export { inoutBoxedFromFfi, outBoxedFromFfi, valueFromObject } from "./gobject/gvalue.js";
export { valueFromFfi };

/**
 * Like {@link valueFromFfi}, but returns `undefined` when `value` is
 * `undefined` (an omitted property) instead of marshalling it.
 *
 * Generated GObject constructors call this for each prop they translate, then
 * spread the results into the record handed up the `super(...)` chain. The
 * canonical constructor keeps only the entries that produced a `GValue`, so an
 * omitted prop is naturally dropped while an explicit `null` still marshals.
 *
 * @param ffiType - The FFI type descriptor.
 * @param value - The JS value to convert, or `undefined` to skip.
 */
export function valueFromFfiOptional(ffiType: FfiType, value: unknown): GValue | undefined {
    return value === undefined ? undefined : valueFromFfi(ffiType, value);
}

/** Storage size, in bytes, of a single out-parameter cell (a pointer or any scalar). */
const OUT_PARAM_STORAGE_SIZE = 8;

/**
 * Builds the `G_TYPE_POINTER` GValue a signal out-parameter is emitted through,
 * paired with a reader for the value a handler writes back.
 *
 * `g_signal_emitv` hands the pointer payload to handlers as the out-parameter's
 * `T*`, so a handler writes into the freshly allocated storage; the returned
 * {@link read} unmarshals that storage with `innerFfi`. The `initial` value
 * seeds the storage for inout parameters, where the handler both reads the
 * incoming value and overwrites it.
 *
 * @param innerFfi - FFI descriptor of the pointed-to value (the `t.ref` inner type).
 * @param initial - Seed written before emission, for inout parameters.
 */
export function outValueFromFfi(innerFfi: FfiType, initial?: unknown): { value: GValue; read: () => unknown } {
    const storage = alloc(OUT_PARAM_STORAGE_SIZE);
    write(storage, t.uint64, 0, 0);
    if (initial !== undefined) write(storage, innerFfi, 0, initial);
    const value = new GValue();
    value.init(Type.POINTER);
    setGValuePointer(value, storage);
    return { value, read: () => read(storage, innerFfi, 0) };
}

const g_value_get_boxed_strv = t.fn(
    LIBGOBJECT,
    "g_value_get_boxed",
    [{ type: GVALUE_BORROWED }],
    t.array(t.string("borrowed")),
);

const valueGetStrv = (value: object): string[] => (g_value_get_boxed_strv(getHandle(value)) as string[] | null) ?? [];

const valueFromFundamental = (value: GValueReader, fundamental: GType): unknown => {
    const marshaller = getFundamentalMarshallers().get(fundamental);
    return marshaller ? marshaller.from(value) : undefined;
};

const getPointerValue = (handle: NativeHandle): null => {
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
 * @param value - The `GValue` to unmarshal (the hand-written wrapper or the
 *   public generated `GObject.Value`).
 * @throws if the GValue holds an unsupported or unregistered type.
 */
export function valueToJS(value: GValueReader): unknown {
    const gtype = valueGetType(value);

    if (gtype === getStrvGType()) return valueGetStrv(value);

    const fundamental = typeFundamental(gtype);
    const fundamentalValue = valueFromFundamental(value, fundamental);
    if (fundamentalValue !== undefined) return fundamentalValue;

    if (fundamental === Type.POINTER) return getPointerValue(getHandle(value));
    if (fundamental === Type.BOXED) return getBoxed(value);

    throw new Error(`Unsupported GType for valueToJS: ${typeName(gtype) ?? String(gtype)}`);
}

/**
 * Dispatches a `g_object_{get,set}_property` call with a borrowed receiver, the
 * property name, and a borrowed `GValue`.
 */
const dispatchPropertyCall = (fnName: string, obj: object, propertyName: string, value: GValue): void => {
    call(
        LIBGOBJECT,
        fnName,
        [
            { type: t.object("borrowed"), value: getHandle(obj) },
            { type: t.string("borrowed"), value: propertyName },
            { type: GVALUE_BORROWED, value: getHandle(value) },
        ],
        t.void,
    );
};

/**
 * Reads a GObject property into a plain JavaScript value through a
 * statically-known FFI type descriptor.
 *
 * The generated property getter passes the property's FFI type — resolved from
 * the GIR at codegen time — so an empty `GValue` of the matching type is
 * populated by `g_object_get_property` and unmarshalled via {@link valueToJS},
 * with no runtime param-spec introspection.
 *
 * @param obj - The GObject instance whose property is read.
 * @param propertyName - The property name (kebab-case GIR name).
 * @param ffiType - The property's FFI type descriptor.
 */
export function getObjectProperty(obj: object, propertyName: string, ffiType: FfiType): unknown {
    const value = emptyValueFromFfi(ffiType);
    dispatchPropertyCall("g_object_get_property", obj, propertyName, value);
    return valueToJS(value);
}

/**
 * Writes a plain JavaScript value to a GObject property through a
 * statically-known FFI type descriptor.
 *
 * The generated property setter passes the property's FFI type — resolved from
 * the GIR at codegen time — so `value` is marshalled by {@link valueFromFfi} and
 * dispatched to `g_object_set_property`, with no runtime param-spec
 * introspection.
 *
 * @param obj - The GObject instance whose property is written.
 * @param propertyName - The property name (kebab-case GIR name).
 * @param ffiType - The property's FFI type descriptor.
 * @param jsValue - The JS value to set.
 */
export function setObjectProperty(obj: object, propertyName: string, ffiType: FfiType, jsValue: unknown): void {
    dispatchPropertyCall("g_object_set_property", obj, propertyName, valueFromFfi(ffiType, jsValue));
}
