/**
 * GObject construction.
 *
 * {@link newGobjectWithProperties} is the single entry point the generated
 * `GObject.Object` constructor delegates to. The marshalling, `GValue`, and
 * wrapper-lifting machinery it builds on lives in `./value-marshal.js`,
 * `./gvalue.js`, and `./wrap-value.js`.
 */

import { call, type Type as FfiType, type Handle, setWrapper, type Value } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { t } from "./descriptors.js";
import { GVALUE_BORROWED, GVALUE_SIZE, LIBGOBJECT } from "./gtype.js";
import { getClassGtype, getHandle, setHandle } from "./registry.js";
import { valueFromFfi } from "./value-marshal.js";

/**
 * A property-marshalling instruction: the property's FFI type paired with the
 * JavaScript value to set. The translating constructor of each class emits one
 * per property it introduces, keyed by the property's GIR name, and threads it
 * up the `super(...)` chain to the root constructor.
 */
type PropertyMarshalling = readonly [FfiType, Value];

/**
 * Constructs the backing GObject for `instance` and links the two.
 *
 * The generated `GObject.Object` constructor delegates here, threading the
 * fully marshalled prop record assembled up the `super(...)` chain: a
 * `[ffiType, value]` instruction per property, keyed by GIR name. Each
 * instruction is marshalled into a `GValue` and forwarded to
 * `g_object_new_with_properties`; an instruction whose value is `undefined` (an
 * omitted optional prop) is dropped.
 *
 * The freshly allocated handle is linked to the wrapper and registered with a
 * toggle reference (`setWrapper`), so every future handle for this object
 * round-trips to the same JS wrapper. Construct-time initialization for a
 * subclass belongs in its constructor, after `super(...)` — where the handle is
 * already live; gtkx does not route GObject construct-time vtable slots
 * (`constructed`, `set_property`, `get_property`) to JavaScript, so no
 * synchronous vfunc observes the wrapper before construction completes.
 *
 * @param instance - The wrapper being constructed; its leaf class supplies the GType.
 * @param props - GIR-name-keyed marshalling instructions.
 * @returns The same `instance`, now linked to its native handle.
 */
export function newGobjectWithProperties(instance: object, props: Record<string, PropertyMarshalling>): object {
    const names: string[] = [];
    const values: Handle[] = [];
    for (const [name, [ffiType, value]] of Object.entries(props)) {
        if (value === undefined) continue;
        names.push(name);
        values.push(getHandle(valueFromFfi(ffiType, value)));
    }

    const gtype = getClassGtype(instance.constructor as AnyClass);
    const handle = call(
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

    setHandle(instance, handle);
    setWrapper(handle, instance);
    return instance;
}
