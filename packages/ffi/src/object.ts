import { call, type NativeHandle } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { GValue } from "./gobject/gvalue-native.js";
import { GVALUE_BORROWED, GVALUE_SIZE, LIBGOBJECT } from "./gtype.js";
import { type GTyped, getHandle, setHandle, tryGetHandle } from "./handles.js";
import { t } from "./helpers.js";
import { linkInstanceState } from "./instance-state.js";
import { setPendingConstruction } from "./pending-construction.js";
import { getClassGType, registerNativeObject } from "./registry.js";

/**
 * Canonical "new GObject with properties" implementation.
 *
 * The generated `GObject.Object` constructor delegates here, threading the
 * fully-translated property record that each subclass constructor assembled
 * up the `super(...)` chain. Every value that is a {@link GValue} is forwarded
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
        if (value instanceof GValue) {
            names.push(key);
            values.push(getHandle(value));
        }
    }

    const gtype = getClassGType(instance.constructor as AnyClass);
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
        registerNativeObject(instance as GTyped);
    }
    const linked = tryGetHandle(instance);
    if (linked !== undefined) linkInstanceState(linked, instance);
}
