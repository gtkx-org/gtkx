import { getObjectId } from "@gtkx/native";
import { typeCheckInstanceIsA, typeFromName, typeNameFromInstance } from "../generated/gobject/functions.js";
import { findNativeClass } from "../registry.js";
import type { NativeClass, NativeObject } from "./base.js";

/**
 * Creates a typed JavaScript wrapper for a native GTK object.
 *
 * Wraps a native object pointer in a JavaScript class instance,
 * providing type-safe access to GTK methods and properties.
 *
 * @typeParam T - The expected wrapper class type
 * @param id - Native object pointer/ID
 * @param targetType - Optional target class for interface type checking
 * @returns The typed wrapper instance, or null if the input is null/undefined
 *
 * @example
 * ```tsx
 * import { getNativeObject } from "@gtkx/ffi";
 * import * as Gtk from "@gtkx/ffi/gtk";
 *
 * const widget = getNativeObject(nativeId, Gtk.Widget);
 * widget?.setVisible(true);
 * ```
 */
export function getNativeObject<T extends NativeObject = NativeObject>(
    id: unknown,
    targetType?: NativeClass<T>,
): T | null {
    if (id === null || id === undefined) {
        return null;
    }

    if (targetType) {
        if (targetType.objectType === "interface") {
            const targetGType = typeFromName(targetType.glibTypeName);
            if (targetGType === 0) return null;

            const objId = getObjectId(id);
            if (!typeCheckInstanceIsA(objId, targetGType)) return null;
        }

        const instance = Object.create(targetType.prototype) as T;
        instance.id = id;
        return instance;
    }

    const objectId = getObjectId(id);
    const runtimeTypeName = typeNameFromInstance(objectId);
    const cls = findNativeClass(runtimeTypeName);

    if (!cls) {
        throw new Error(`Expected registered GLib type, got '${runtimeTypeName}'`);
    }

    const instance = Object.create(cls.prototype) as T;
    instance.id = id;
    return instance;
}

export { isInstantiating, type NativeClass, NativeObject, setInstantiating } from "./base.js";
