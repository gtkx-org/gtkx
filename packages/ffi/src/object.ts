import { call, type Type as FfiType, type NativeHandle, setWrapper } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { valueFromFfi } from "./gobject/gvalue.js";
import { GVALUE_BORROWED, GVALUE_SIZE, LIBGOBJECT } from "./gtype.js";
import { getHandle, setHandle, tryGetHandle } from "./handles.js";
import { t } from "./helpers.js";
import { setPendingConstruction } from "./pending-construction.js";
import { getClassGtype } from "./registry.js";

/**
 * A property-marshalling instruction: the property's FFI type paired with the
 * raw JavaScript value to convert. The translating constructor of each class
 * emits one per property it introduces, keyed by the property's GIR name, and
 * threads it up the `super(...)` chain.
 */
type MarshalEntry = readonly [FfiType, unknown];

/**
 * Every FFI type-descriptor `kind`, the closed set the `t` helpers produce. A
 * marshalling instruction's first element is always one of these; nothing a
 * caller mixes into the prop bag — a React element, an array, a handler — has a
 * `type` field drawn from it, so the set cleanly tells the two apart.
 */
const FFI_TYPE_KINDS: ReadonlySet<string> = new Set([
    "int8",
    "uint8",
    "int16",
    "uint16",
    "int32",
    "uint32",
    "int64",
    "uint64",
    "bigint64",
    "biguint64",
    "float32",
    "float64",
    "boolean",
    "void",
    "unichar",
    "blob",
    "string",
    "gobject",
    "boxed",
    "struct",
    "fundamental",
    "ref",
    "hashtable",
    "enum",
    "flags",
    "array",
    "trampoline",
]);

/**
 * Whether a constructor prop-bag entry is a property-marshalling instruction,
 * as opposed to a raw `...rest` value still keyed by its camelCase name on its
 * way to the ancestor constructor that introduces it. Marshalling instructions
 * are the only entries {@link newGobjectWithProperties} consumes; anything else
 * (a raw prop, a React element, a signal handler, or a ref a caller mixed in)
 * is ignored. The discriminator is the first element being an FFI type
 * descriptor — a `[FfiType, value]` pair — which a raw prop value never is.
 */
const isMarshalEntry = (entry: unknown): entry is MarshalEntry => {
    if (!Array.isArray(entry) || entry.length !== 2) return false;
    const descriptor: unknown = entry[0];
    if (typeof descriptor !== "object" || descriptor === null) return false;
    const kind: unknown = (descriptor as { type?: unknown }).type;
    return typeof kind === "string" && FFI_TYPE_KINDS.has(kind);
};

/**
 * Canonical "new GObject with properties" implementation.
 *
 * The generated `GObject.Object` constructor delegates here, threading the
 * prop bag each subclass constructor assembled up the `super(...)` chain: a
 * `[ffiType, value]` marshalling instruction per property it introduces (keyed
 * by GIR name), spread alongside the untranslated `...rest`. This function
 * marshals each instruction into a `GValue` and forwards it to
 * `g_object_new_with_properties`; every other entry is ignored. An instruction
 * whose value is `undefined` (an omitted optional prop) is dropped.
 *
 * The pending-construction guard lets a `constructed` vfunc that fires
 * synchronously during allocation adopt this wrapper instead of spawning a
 * second one; the toggle reference installed by `setWrapper` then makes
 * every future handle for this object round-trip to the same JS wrapper.
 *
 * @param instance - The wrapper being constructed; its leaf class supplies the GType
 * @param props - GIR-name-keyed marshalling instructions (plus ignored extras)
 */
export function newGobjectWithProperties(instance: object, props: Record<string, unknown>): void {
    const names: string[] = [];
    const values: NativeHandle[] = [];
    for (const key in props) {
        const entry = props[key];
        if (!isMarshalEntry(entry)) continue;
        const [ffiType, value] = entry;
        if (value === undefined) continue;
        names.push(key);
        values.push(getHandle(valueFromFfi(ffiType, value)));
    }

    const gtype = getClassGtype(instance.constructor as AnyClass);
    const previous = setPendingConstruction(instance);
    let handle: NativeHandle;
    try {
        handle = call(
            LIBGOBJECT,
            "g_object_new_with_properties",
            [
                { type: t.uint64, value: gtype },
                { type: t.uint32, value: names.length },
                { type: t.sizedArray(t.string("borrowed"), 1, "borrowed"), value: names },
                { type: t.sizedArray(GVALUE_BORROWED, 1, "borrowed", GVALUE_SIZE), value: values },
            ],
            t.object("full"),
        ) as NativeHandle;
    } finally {
        setPendingConstruction(previous);
    }

    if (tryGetHandle(instance) === undefined) {
        setHandle(instance, handle);
        setWrapper(handle, instance);
    }
}
