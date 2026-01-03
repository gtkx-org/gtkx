import type { ObjectId } from "@gtkx/native";
import { typeCheckInstanceIsA, typeFromName, typeNameFromInstance } from "../generated/gobject/functions.js";
import { TypeInstance } from "../generated/gobject/type-instance.js";
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
    id: ObjectId | null | undefined,
    targetType?: NativeClass<T>,
): T | null {
    if (id === null || id === undefined) {
        return null;
    }

    if (targetType) {
        if (targetType.objectType === "interface") {
            const targetGType = typeFromName(targetType.glibTypeName);
            if (targetGType === 0) return null;

            const typeInstance = TypeInstance.fromPtr(id);
            if (!typeCheckInstanceIsA(typeInstance, targetGType)) return null;
        }

        return targetType.fromPtr(id) as T;
    }

    const typeInstance = TypeInstance.fromPtr(id);
    const runtimeTypeName = typeNameFromInstance(typeInstance);
    const cls = findNativeClass(runtimeTypeName);

    if (!cls) {
        throw new Error(`Expected registered GLib type, got '${runtimeTypeName}'`);
    }

    return cls.fromPtr(id) as T;
}

export { isInstantiating, type NativeClass, NativeObject, setInstantiating } from "./base.js";
