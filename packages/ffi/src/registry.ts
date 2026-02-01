import { getNativeId, type NativeHandle } from "@gtkx/native";
import { typeFromName, typeName, typeNameFromInstance, typeParent } from "./generated/gobject/functions.js";
import { TypeInstance } from "./generated/gobject/type-instance.js";
import type { NativeClass, NativeObject } from "./native.js";

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

export function registerNativeObject(obj: NativeObject): void {
    const pointerId = getNativeId(obj.handle);
    objectRegistry.set(pointerId, new WeakRef(obj));
    cleanupObjectRegistry.register(obj, pointerId, obj);
}

export function findNativeObject(handle: NativeHandle): NativeObject | null {
    const pointerId = getNativeId(handle);
    const ref = objectRegistry.get(pointerId);

    if (!ref) return null;

    const obj = ref.deref();
    if (!obj) {
        objectRegistry.delete(pointerId);
        return null;
    }

    return obj;
}

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
 * Returns an existing wrapper if one already exists for the same native
 * pointer, ensuring object identity (`===`) works correctly.
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

    if (targetType && targetType.objectType !== "interface") {
        const isIdentityType = targetType.objectType === "gobject" || targetType.objectType === "fundamental";

        if (isIdentityType) {
            const existing = findNativeObject(handle);
            if (existing) {
                return existing as Result;
            }
        }

        const instance = Object.create(targetType.prototype) as NativeObject;
        instance.handle = handle;

        if (isIdentityType) {
            registerNativeObject(instance);
        }

        return instance as Result;
    }

    const existing = findNativeObject(handle);
    if (existing) {
        return existing as Result;
    }

    const typeInstance = Object.create(TypeInstance.prototype) as TypeInstance;
    typeInstance.handle = handle;
    const runtimeTypeName = typeNameFromInstance(typeInstance);

    if (targetType && targetType.objectType === "interface") {
        const cls = findNativeClass(runtimeTypeName, false);
        if (cls) {
            const instance = Object.create(cls.prototype) as NativeObject;
            instance.handle = handle;
            registerNativeObject(instance);
            return instance as Result;
        }
        const instance = Object.create(targetType.prototype) as NativeObject;
        instance.handle = handle;
        registerNativeObject(instance);
        return instance as Result;
    }

    const cls = findNativeClass(runtimeTypeName);

    if (!cls) {
        throw new Error(`Expected registered GLib type, got '${runtimeTypeName}'`);
    }

    const instance = Object.create(cls.prototype) as NativeObject;
    instance.handle = handle;
    registerNativeObject(instance);
    return instance as Result;
}
