/**
 * GObject construction.
 *
 * {@link newGobjectWithProperties} marshals a property record and calls
 * `g_object_new_with_properties`, returning the freshly allocated handle. The
 * generated `GObject.Object` constructor calls it and links the handle to the
 * wrapper. The marshalling, `GValue`, and wrapper-lifting machinery it builds
 * on lives in `./value-marshal.js`, `./gvalue.js`, and `./wrap-value.js`.
 */

import { call, type Type as FfiType, type Handle, type Value } from "@gtkx/native";
import { t } from "./descriptors.js";
import { type GType, GVALUE_BORROWED, GVALUE_SIZE, LIBGOBJECT } from "./gtype.js";
import { getHandle } from "./registry.js";
import { valueFromFfi } from "./value-marshal.js";

/**
 * A property-marshalling instruction: the property's FFI type paired with the
 * JavaScript value to set. The translating constructor of each class emits one
 * per property it introduces, keyed by the property's GIR name, and threads it
 * up the `super(...)` chain to the root constructor.
 */
type PropertyMarshalling = readonly [FfiType, Value];

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
export function newGobjectWithProperties(gtype: GType, props: Record<string, PropertyMarshalling>): Handle {
    const names: string[] = [];
    const values: Handle[] = [];
    for (const [name, [ffiType, value]] of Object.entries(props)) {
        if (value === undefined) continue;
        names.push(name);
        values.push(getHandle(valueFromFfi(ffiType, value)));
    }

    return call(
        LIBGOBJECT,
        "g_object_new_with_properties",
        [
            { type: t.uint64, value: gtype },
            { type: t.uint32, value: names.length },
            { type: t.sizedArray(t.string("borrowed"), 1, "borrowed"), value: names },
            { type: t.sizedArray(GVALUE_BORROWED, 1, "borrowed", GVALUE_SIZE), value: values },
        ],
        t.object("full"),
    ) as Handle;
}
