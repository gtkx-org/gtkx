import { alloc, call, type NativeHandle, read, write } from "@gtkx/native";
import { CONSTRUCTION_META, type ConstructionMeta } from "./construction-meta.js";
import { Value } from "./generated/gobject/gobject.js";
import { GVALUE_BORROWED, GVALUE_SIZE, LIBGOBJECT } from "./gtype.js";
import { getHandle, type NativeClass, type NativeObject, setHandle, tryGetHandle } from "./handles.js";
import { t } from "./helpers.js";
import { linkInstanceState } from "./instance-state.js";
import { setPendingConstruction } from "./pending-construction.js";
import { getClassGType, registerNativeObject } from "./registry.js";

/**
 * Canonical "new GObject with properties" implementation.
 *
 * The generated `GObject.Object` constructor delegates here, threading the
 * fully-translated property record that each subclass constructor assembled
 * up the `super(...)` chain. Every value that is a {@link Value} is forwarded
 * to `g_object_new_with_properties` keyed by its GIR name; any other entry
 * (e.g. signal handlers, children, or refs a caller mixed into the props bag)
 * is ignored. This is the single home for the four-element descriptor layout
 * the native call requires.
 *
 * The pending-construction guard lets a `constructed` vfunc that fires
 * synchronously during allocation adopt this wrapper instead of spawning a
 * second one; identity registration then makes future handles round-trip to
 * the same JS wrapper, and instance-state linking attaches the persistent
 * `state` object for user subclasses.
 *
 * @param instance - The wrapper being constructed; its leaf class supplies the GType
 * @param props - GIR-name-keyed record of `GValue`s (plus ignored extras)
 */
export function constructGObjectInstance(instance: object, props: Record<string, unknown>): void {
    const names: string[] = [];
    const values: NativeHandle[] = [];
    for (const key in props) {
        const value = props[key];
        if (value instanceof Value) {
            names.push(key);
            values.push(getHandle(value));
        }
    }

    const gtype = getClassGType(instance.constructor as NativeClass);
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
        registerNativeObject(instance as NativeObject);
    }
    const linked = tryGetHandle(instance);
    if (linked !== undefined) linkInstanceState(linked, instance);
}

/**
 * Performs the native allocation and handle binding for a freshly-created
 * boxed wrapper instance. The generated constructors of boxed records call
 * this once at construction time, threading the unmodified `props` argument
 * through. It dispatches `g_malloc0` and writes each provided field into the
 * struct.
 *
 * @param instance - The boxed wrapper being constructed
 * @param props - Field values keyed by their JavaScript name
 */
export function constructNativeObject(instance: object, props: object = {}): void {
    const ctor = instance.constructor as NativeClass;
    const meta = CONSTRUCTION_META.get(ctor);
    if (!meta) {
        throw new Error(`Cannot construct ${ctor.name}: no construction metadata registered`);
    }
    if (typeof props === "function") {
        throw new TypeError(
            `Cannot construct ${ctor.name} with a function argument; pass an object of properties or call a static factory method (e.g. ${ctor.name}.new(...)).`,
        );
    }
    setHandle(instance, constructBoxed(meta, props as Record<string, unknown>));
}

/**
 * Boxed construction: `g_malloc0` then write each writable field declared
 * in the metadata whose key is present in `props`. Bitfield members are
 * merged into their storage unit via read-modify-write.
 */
function constructBoxed(
    meta: Extract<ConstructionMeta, { kind: "boxed" }>,
    props: Record<string, unknown>,
): NativeHandle {
    const handle = alloc(meta.size, meta.glibTypeName, meta.lib);
    for (const fieldName of Object.keys(meta.fields)) {
        const value = props[fieldName];
        if (value === undefined) continue;
        const field = meta.fields[fieldName];
        if (!field) continue;
        if (field.bitWidth === undefined) {
            write(handle, field.ffiType, field.offset, value);
            continue;
        }
        const mask = (1 << field.bitWidth) - 1;
        const bitOffset = field.bitOffset ?? 0;
        const unit = read(handle, field.ffiType, field.offset) as number;
        write(
            handle,
            field.ffiType,
            field.offset,
            ((unit & ~(mask << bitOffset)) | (((value as number) & mask) << bitOffset)) >>> 0,
        );
    }
    return handle;
}
