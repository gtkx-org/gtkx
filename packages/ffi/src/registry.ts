import type { NativeHandle } from "@gtkx/native";
import { typeFromName, typeName, typeNameFromInstance, typeParent } from "./generated/gobject/functions.js";
import { TypeInstance } from "./generated/gobject/type-instance.js";
import type { NativeClass, NativeObject } from "./object.js";

const classRegistry = new Map<string, NativeClass>();

/**
 * Registers a native class for type resolution.
 *
 * Called automatically by generated bindings. Can be used to register
 * custom subclasses.
 *
 * @param cls - The native class to register
 *
 * @example
 * ```tsx
 * import { registerNativeClass } from "@gtkx/ffi";
 *
 * class MyCustomWidget extends Gtk.Widget {
 *   static readonly glibTypeName = "MyCustomWidget";
 *   // ...
 * }
 * registerNativeClass(MyCustomWidget);
 * ```
 */
export function registerNativeClass(cls: NativeClass): void {
    classRegistry.set(cls.glibTypeName, cls);
}

/**
 * Gets a registered class by its GLib type name.
 *
 * @param glibTypeName - The GLib type name (e.g., "GtkButton")
 * @returns The registered class, or null if not found
 */
export function getNativeClass(glibTypeName: string): NativeClass | null {
    return classRegistry.get(glibTypeName) ?? null;
}

/**
 * Finds a native class by walking the type hierarchy.
 *
 * If the exact type is not registered, walks up the parent chain
 * until a registered type is found (unless walkHierarchy is false).
 *
 * @param glibTypeName - The GLib type name to start from
 * @param walkHierarchy - Whether to walk up the parent chain (default: true)
 * @returns The closest registered parent class, or null
 */
export const findNativeClass = (glibTypeName: string, walkHierarchy = true): NativeClass | null => {
    const cls = getNativeClass(glibTypeName);
    if (cls) return cls;

    if (!walkHierarchy) return null;

    let currentTypeName: string | null = glibTypeName;

    while (currentTypeName) {
        const gtype = typeFromName(currentTypeName);
        if (gtype === 0) break;

        const parentGtype = typeParent(gtype);
        if (parentGtype === 0) break;

        currentTypeName = typeName(parentGtype);
        if (!currentTypeName) break;

        const parentCls = getNativeClass(currentTypeName);
        if (parentCls) return parentCls;
    }

    return null;
};

const objectRegistry = new Map<number, WeakRef<NativeObject>>();

const cleanupObjectRegistry = new FinalizationRegistry<number>((pointerId) => {
    objectRegistry.delete(pointerId);
});

/**
 * Registers a native object in the identity registry.
 *
 * Ensures that the same native pointer always resolves to the same
 * JavaScript wrapper, preserving object identity (`===`). The reference
 * is weak, so objects can still be garbage collected.
 *
 * @param obj - The native object wrapper to register
 */
export function registerNativeObject(obj: NativeObject): void {
    const pointerId = obj.handle.id;
    objectRegistry.set(pointerId, new WeakRef(obj));
    cleanupObjectRegistry.register(obj, pointerId, obj);
}

/**
 * Finds an existing JavaScript wrapper for a native pointer.
 *
 * Looks up the identity registry to find a previously registered wrapper
 * for the given native handle. Returns null if no wrapper exists or if
 * the wrapper has been garbage collected.
 *
 * @param handle - The native handle to look up
 * @returns The existing wrapper, or null if not found
 */
export function findNativeObject(handle: NativeHandle): NativeObject | null {
    const pointerId = handle.id;
    const ref = objectRegistry.get(pointerId);

    if (!ref) return null;

    const obj = ref.deref();
    if (!obj) {
        objectRegistry.delete(pointerId);
        return null;
    }

    return obj;
}

/** @internal */
type GetNativeObjectResult<
    T extends NativeHandle | null | undefined,
    TClass extends NativeClass | undefined,
> = T extends null | undefined ? null : TClass extends NativeClass<infer U> ? U : NativeObject;

/**
 * Creates a JavaScript wrapper for a native handle.
 *
 * When a target class is supplied, instantiates that class directly with
 * no identity tracking — used for value-style types (boxed, struct,
 * fundamental, opaque class structures) where each handle is owned per
 * wrapper. When no target class is supplied, resolves the runtime GLib
 * type and reuses the registered wrapper instance, preserving object
 * identity (`===`) for shared GObject pointers.
 *
 * @typeParam T - The handle type (null, undefined, or NativeHandle)
 * @typeParam TClass - Optional target wrapper class type
 * @param handle - The native handle (or null/undefined)
 * @param targetType - Optional wrapper class to use directly
 * @returns A wrapper instance, or null if handle is null/undefined
 *
 * @example
 * ```tsx
 * // Automatic type resolution (identity-tracked GObject)
 * const widget = getNativeObject(widgetHandle);
 *
 * // Explicit type (boxed value, no identity tracking)
 * const rgba = getNativeObject(rgbaHandle, Gdk.RGBA);
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
        return new targetType(handle) as Result;
    }

    const existing = findNativeObject(handle);
    if (existing) return existing as Result;

    const runtimeTypeName = typeNameFromInstance(new TypeInstance(handle));
    const cls = findNativeClass(runtimeTypeName);
    if (!cls) {
        throw new Error(`Expected registered GLib type, got '${runtimeTypeName}'`);
    }

    const instance = new cls(handle);
    registerNativeObject(instance);
    return instance as Result;
}

/**
 * Creates a JavaScript wrapper for a native handle known to implement
 * a specific GObject interface.
 *
 * Resolves the runtime GLib type and instantiates the matching registered
 * class when present, falling back to the supplied interface class when
 * no concrete implementation is registered. The result is always assignable
 * to the interface type, so callers can invoke interface methods on it.
 *
 * @typeParam T - The handle type (null, undefined, or NativeHandle)
 * @typeParam TClass - The interface class type
 * @param handle - The native handle (or null/undefined)
 * @param interfaceClass - The interface class to fall back to
 * @returns A wrapper instance, or null if handle is null/undefined
 */
export function getNativeObjectAsInterface<T extends NativeHandle | null | undefined, TClass extends NativeClass>(
    handle: T,
    interfaceClass: TClass,
): T extends null | undefined ? null : InstanceType<TClass> {
    type Result = T extends null | undefined ? null : InstanceType<TClass>;

    if (handle === null || handle === undefined) return null as Result;

    const existing = findNativeObject(handle);
    if (existing) return existing as Result;

    const runtimeTypeName = typeNameFromInstance(new TypeInstance(handle));
    const cls = findNativeClass(runtimeTypeName, false) ?? interfaceClass;
    const instance = new cls(handle);
    registerNativeObject(instance);
    return instance as Result;
}
