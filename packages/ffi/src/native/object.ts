import { getObjectId, type ObjectId } from "@gtkx/native";
import { typeNameFromInstance } from "../generated/gobject/functions.js";
import { TypeInstance } from "../generated/gobject/type-instance.js";
import { findNativeClass } from "../registry.js";
import type { NativeClass, NativeObject } from "./base.js";

type GetNativeObjectResult<T extends ObjectId | null | undefined, TClass extends NativeClass | undefined> = T extends
    | null
    | undefined
    ? null
    : TClass extends NativeClass<infer U>
      ? U
      : NativeObject;

/**
 * Creates a JavaScript wrapper for a native GObject.
 *
 * Resolves the runtime type of the object and creates an instance of the
 * appropriate wrapper class. If a target type is provided, uses that
 * class directly without runtime type resolution.
 *
 * @typeParam T - The object ID type (null, undefined, or ObjectId)
 * @typeParam TClass - Optional target wrapper class type
 * @param id - The native object ID (or null/undefined)
 * @param targetType - Optional wrapper class to use directly
 * @returns A wrapper instance, or null if id is null/undefined
 *
 * @example
 * ```tsx
 * // Automatic type resolution
 * const widget = getNativeObject(widgetId);
 *
 * // Explicit type
 * const button = getNativeObject(buttonId, Gtk.Button);
 * ```
 */
export function getNativeObject<
    T extends ObjectId | null | undefined,
    TClass extends NativeClass | undefined = undefined,
>(id: T, targetType?: TClass): GetNativeObjectResult<T, TClass> {
    type Result = GetNativeObjectResult<T, TClass>;

    if (id === null || id === undefined) {
        return null as Result;
    }

    if (targetType) {
        const instance = Object.create(targetType.prototype) as NativeObject;
        instance.id = id;
        return instance as Result;
    }

    const typeInstance = Object.create(TypeInstance.prototype) as TypeInstance;
    typeInstance.id = id;
    const runtimeTypeName = typeNameFromInstance(typeInstance);
    const cls = findNativeClass(runtimeTypeName);

    if (!cls) {
        throw new Error(`Expected registered GLib type, got '${runtimeTypeName}'`);
    }

    const instance = Object.create(cls.prototype) as NativeObject;
    instance.id = id;
    return instance as Result;
}

/**
 * Compares two NativeObject instances for equality based on their underlying object IDs.
 *
 * @param obj - The first NativeObject to compare.
 * @param other - The second NativeObject to compare.
 * @returns True if both objects have the same underlying ID, false otherwise.
 */
export const isObjectEqual = (obj: NativeObject, other: NativeObject): boolean => {
    return getObjectId(obj.id) === getObjectId(other.id);
};

export { isInstantiating, type NativeClass, NativeObject, setInstantiating } from "./base.js";
