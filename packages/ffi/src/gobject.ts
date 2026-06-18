/**
 * GObject construction and property access.
 *
 * {@link newGobjectWithProperties} marshals a property record and calls
 * `g_object_new_with_properties`, returning the freshly allocated handle, while
 * {@link getGobjectProperty} / {@link setGobjectProperty} drive `g_object_*_property`
 * for a single statically-typed property. The generated `GObject.Object`
 * constructor and accessors call them; the `GValue` marshalling they build on
 * lives in `./gvalue.js` and the wrapper-lifting in `./wrap-value.js`.
 */

import { call, type Type as FfiType, type Handle, type Value } from "@gtkx/native";
import { GVALUE_SIZE, GVALUE_T, LIBGOBJECT } from "./constants.js";
import { t } from "./descriptors.js";
import type { GType } from "./gtype.js";
import { emptyValueFromFfi, fromGvalue, toGvalue } from "./gvalue.js";
import { getHandle } from "./registry.js";

/**
 * A property-marshalling instruction: the property's FFI type paired with the
 * JavaScript value to set. The translating constructor of each class emits one
 * per property it introduces, keyed by the property's GIR name, and threads it
 * up the `super(...)` chain to the root constructor.
 */
type Property = readonly [FfiType, Value];

/**
 * Constructs a GObject of `gtype` from a marshalled property record and returns
 * its freshly allocated handle.
 *
 * The generated `GObject.Object` constructor calls here with the GType of the
 * leaf class being instantiated and the fully marshalled prop record assembled
 * up the `super(...)` chain: a `[ffiType, value]` instruction per property,
 * keyed by GIR name. Each instruction is marshalled into a `GValue` and
 * forwarded to `g_object_new_with_properties`; an instruction whose value is
 * `undefined` (an omitted optional prop) is dropped.
 *
 * The caller owns the returned handle and links it to the wrapper, registering
 * a toggle reference (`setWrapper`) so every future handle for this object
 * round-trips to the same JS wrapper. Construct-time initialization for a
 * subclass belongs in its constructor, after `super(...)` — where the handle is
 * already live; gtkx does not route GObject construct-time vtable slots
 * (`constructed`, `set_property`, `get_property`) to JavaScript, so no
 * synchronous vfunc observes the wrapper before construction completes.
 *
 * @param gtype - The GLib type identifier of the object to construct.
 * @param props - GIR-name-keyed marshalling instructions.
 * @returns The freshly allocated handle, owned by the caller.
 */
export function newGobjectWithProperties(gtype: GType, props: Record<string, Property>): Handle {
    const names: string[] = [];
    const values: Handle[] = [];

    for (const [name, [ffiType, value]] of Object.entries(props)) {
        if (value === undefined) continue;
        names.push(name);
        values.push(toGvalue(ffiType, value));
    }

    return call(
        LIBGOBJECT,
        "g_object_new_with_properties",
        [
            { type: t.biguint64, value: gtype },
            { type: t.uint32, value: names.length },
            { type: t.sizedArray(t.string("borrowed"), 1, "borrowed"), value: names },
            { type: t.sizedArray(GVALUE_T, 1, "borrowed", GVALUE_SIZE), value: values },
        ],
        t.object("full"),
    ) as Handle;
}

const PROPERTY_CALL_ARGS = [t.object("borrowed"), t.string("borrowed"), GVALUE_T] as const;

const gObjectGetProperty = t.bind(LIBGOBJECT, "g_object_get_property", [...PROPERTY_CALL_ARGS], t.void);
const gObjectSetProperty = t.bind(LIBGOBJECT, "g_object_set_property", [...PROPERTY_CALL_ARGS], t.void);

/**
 * Reads a GObject property into a plain JavaScript value through a
 * statically-known FFI type descriptor.
 *
 * The generated property getter passes the property's FFI type — resolved from
 * the GIR at codegen time — so an empty `GValue` of the matching type is
 * populated by `g_object_get_property` and unmarshalled via {@link fromGvalue},
 * with no runtime param-spec introspection.
 *
 * @param obj - The GObject instance whose property is read.
 * @param propertyName - The property name (kebab-case GIR name).
 * @param ffiType - The property's FFI type descriptor.
 */
export function getGobjectProperty(obj: object, propertyName: string, ffiType: FfiType): unknown {
    const value = emptyValueFromFfi(ffiType);
    gObjectGetProperty(getHandle(obj), propertyName, value);
    return fromGvalue(value);
}

/**
 * Writes a plain JavaScript value to a GObject property through a
 * statically-known FFI type descriptor.
 *
 * The generated property setter passes the property's FFI type — resolved from
 * the GIR at codegen time — so `value` is marshalled by {@link toGvalue} and
 * dispatched to `g_object_set_property`, with no runtime param-spec
 * introspection.
 *
 * @param obj - The GObject instance whose property is written.
 * @param propertyName - The property name (kebab-case GIR name).
 * @param ffiType - The property's FFI type descriptor.
 * @param jsValue - The JS value to set.
 */
export function setGobjectProperty(obj: object, propertyName: string, ffiType: FfiType, jsValue: unknown): void {
    gObjectSetProperty(getHandle(obj), propertyName, toGvalue(ffiType, jsValue));
}
