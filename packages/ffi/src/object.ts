import { alloc, call, type NativeHandle, read, write } from "@gtkx/native";
import { CONSTRUCTION_META, type ConstructionMeta, type GObjectPropMeta } from "./construction-meta.js";
import { gvalueFromProp } from "./gobject/gvalue.js";
import { GVALUE_BORROWED, GVALUE_SIZE, LIBGOBJECT } from "./gtype.js";
import { getParentClass, type NativeClass, type NativeObject, setHandle } from "./handles.js";
import { t } from "./helpers.js";
import { registerNativeObject } from "./registry.js";

/**
 * Dispatches `g_object_new_with_properties` and returns the owned handle of
 * the freshly constructed instance.
 *
 * The single home for the four-element descriptor layout the native call
 * requires; both the generated-constructor path ({@link constructGObject})
 * and the public `Object.newWithProperties` wrapper route through here so the
 * fiddly `gtype`/count/sized-name-array/sized-`GValue`-array shape is encoded
 * exactly once.
 *
 * @param gtype - GType of the object to instantiate
 * @param names - GIR property names, paired by index with `values`
 * @param values - Borrowed `GValue` handles, one per name
 * @returns The owned handle of the new instance
 */
export function objectNewWithProperties(gtype: number, names: string[], values: NativeHandle[]): NativeHandle {
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
    ) as NativeHandle;
}

/**
 * Performs the native allocation, handle binding, and identity registration
 * for a freshly-created wrapper instance. Generated class constructors call
 * this exactly once at construction time, threading the unmodified `props`
 * argument through. The construction strategy is selected via the
 * registered {@link ConstructionMeta} for the leaf class:
 *
 *   - `"gobject"`: dispatches `g_object_new_with_properties`, then registers
 *     the instance in the identity registry so future handles round-trip to
 *     the same JS wrapper.
 *   - `"boxed"`: dispatches `g_malloc0` and writes each provided field into
 *     the struct.
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

    if (meta.kind === "gobject") {
        setHandle(instance, constructGObject(ctor, meta, props as Record<string, unknown>));
        registerNativeObject(instance as NativeObject);
    } else {
        setHandle(instance, constructBoxed(meta, props as Record<string, unknown>));
    }
}

type GObjectPropCollector = {
    readonly props: Record<string, unknown>;
    readonly names: string[];
    readonly values: NativeHandle[];
    readonly seen: Set<string>;
};

/**
 * GObject construction: walk the class chain, merge inherited props, then
 * dispatch `g_object_new_with_properties`.
 */
function constructGObject(
    leafCtor: NativeClass,
    leafMeta: Extract<ConstructionMeta, { kind: "gobject" }>,
    props: Record<string, unknown>,
): NativeHandle {
    const collector: GObjectPropCollector = { props, names: [], values: [], seen: new Set() };
    walkPropsForGObject(leafCtor, collector);

    return objectNewWithProperties(Number(leafMeta.gtype()), collector.names, collector.values);
}

function walkPropsForGObject(ctor: NativeClass | null, collector: GObjectPropCollector): void {
    if (!ctor) return;
    const meta = CONSTRUCTION_META.get(ctor);
    if (meta?.kind === "gobject") {
        collectGObjectProps(meta.props, collector);
    }
    walkPropsForGObject(getParentClass(ctor), collector);
}

function collectGObjectProps(propMap: Record<string, GObjectPropMeta>, collector: GObjectPropCollector): void {
    const { props, names, values, seen } = collector;
    for (const propKey of Object.keys(propMap)) {
        if (seen.has(propKey)) continue;
        seen.add(propKey);
        const value = props[propKey];
        if (value === undefined) continue;
        const meta = propMap[propKey];
        if (!meta) continue;
        names.push(meta.girName);
        values.push(gvalueFromProp(meta, value));
    }
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
