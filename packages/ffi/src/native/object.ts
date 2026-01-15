import { getNativeId, type NativeHandle } from "@gtkx/native";
import { typeCheckInstanceIsA, typeFromName, typeNameFromInstance } from "../generated/gobject/functions.js";
import { TypeInstance } from "../generated/gobject/type-instance.js";
import { findNativeClass } from "../registry.js";
import type { NativeClass, NativeObject } from "./base.js";

type GetNativeObjectResult<
    T extends NativeHandle | null | undefined,
    TClass extends NativeClass | undefined,
> = T extends null | undefined ? null : TClass extends NativeClass<infer U> ? U : NativeObject;

/**
 * Creates a JavaScript wrapper for a native GObject.
 *
 * Resolves the runtime type of the object and creates an instance of the
 * appropriate wrapper class. If a target type is provided, uses that
 * class directly without runtime type resolution.
 *
 * @typeParam T - The handle type (null, undefined, or NativeHandle)
 * @typeParam TClass - Optional target wrapper class type
 * @param handle - The native handle (or null/undefined)
 * @param targetType - Optional wrapper class to use directly
 * @returns A wrapper instance, or null if handle is null/undefined
 *
 * @example
 * ```tsx
 * // Automatic type resolution
 * const widget = getNativeObject(widgetHandle);
 *
 * // Explicit type
 * const button = getNativeObject(buttonHandle, Gtk.Button);
 * ```
 */
export function getNativeObject<
    T extends NativeHandle | null | undefined,
    TClass extends NativeClass | undefined = undefined,
>(handle: T, targetType?: TClass): GetNativeObjectResult<T, TClass> {
    type Result = GetNativeObjectResult<T, TClass>;

    if (handle === null || handle === undefined) {
        return null as Result;
    }

    if (targetType) {
        const instance = Object.create(targetType.prototype) as NativeObject;
        instance.handle = handle;
        return instance as Result;
    }

    const typeInstance = Object.create(TypeInstance.prototype) as TypeInstance;
    typeInstance.handle = handle;
    const runtimeTypeName = typeNameFromInstance(typeInstance);
    const cls = findNativeClass(runtimeTypeName);

    if (!cls) {
        throw new Error(`Expected registered GLib type, got '${runtimeTypeName}'`);
    }

    const instance = Object.create(cls.prototype) as NativeObject;
    instance.handle = handle;
    return instance as Result;
}

/**
 * Compares two NativeObject instances for equality based on their underlying handles.
 *
 * @param obj - The first NativeObject to compare.
 * @param other - The second NativeObject to compare.
 * @returns True if both objects have the same underlying handle, false otherwise.
 */
export const isObjectEqual = (obj: NativeObject, other: NativeObject): boolean => {
    return getNativeId(obj.handle) === getNativeId(other.handle);
};

const gtypeCache = new Map<string, number>();

/**
 * Gets a native object as a specific interface type if it implements that interface.
 *
 * Uses GLib's type system to check if the object implements the specified
 * interface, and returns a wrapped instance if it does.
 *
 * @typeParam T - The interface type
 * @param obj - The native object to check
 * @param iface - The interface class (must have a glibTypeName property)
 * @returns The wrapped interface instance, or null if not implemented
 *
 * @example
 * ```tsx
 * const editable = getNativeInterface(widget, Gtk.Editable);
 * if (editable) {
 *     const text = editable.getText();
 * }
 * ```
 */
export function getNativeInterface<T extends NativeObject>(obj: NativeObject, iface: NativeClass<T>): T | null {
    if (!obj.handle) return null;

    const glibTypeName = iface.glibTypeName;
    if (!glibTypeName) return null;

    let gtype = gtypeCache.get(glibTypeName);
    if (gtype === undefined) {
        gtype = typeFromName(glibTypeName);
        gtypeCache.set(glibTypeName, gtype);
    }

    if (gtype === 0) return null;

    const typeInstance = Object.create(TypeInstance.prototype) as TypeInstance;
    typeInstance.handle = obj.handle;

    if (!typeCheckInstanceIsA(typeInstance, gtype)) {
        return null;
    }

    const instance = Object.create(iface.prototype) as T;
    instance.handle = obj.handle;
    return instance;
}

export { isInstantiating, type NativeClass, NativeObject, setInstantiating } from "./base.js";
