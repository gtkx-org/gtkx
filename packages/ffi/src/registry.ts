import { getInstanceGType, getNativeId, type NativeHandle } from "@gtkx/native";
import type { GType } from "./generated/gobject/gobject.js";
import { G_TYPE_INVALID, typeFromName, typeIsA, typeParent } from "./gtype.js";
import {
    type GTypeStamped,
    getHandle,
    type NativeClass,
    type NativeObject,
    setHandle,
    tryGetHandle,
} from "./handles.js";
import { getPendingConstruction } from "./pending-construction.js";

const classRegistry = new Map<GType, NativeClass>();
const gtypeByClass = new WeakMap<NativeClass, GType>();
const interfaceGtypeByClass = new WeakMap<NativeClass, GType>();

/**
 * Registers a native class for type resolution.
 *
 * Called automatically by generated bindings. Can be used to register
 * custom subclasses.
 *
 * @param cls - The native class to register
 * @param gtype - The GLib type identifier for the class
 *
 * @example
 * ```tsx
 * import { registerNativeClass } from "@gtkx/ffi";
 * import { my_custom_widget_get_type } from "./my-custom-widget-gtype.js";
 *
 * class MyCustomWidget extends Gtk.Widget {}
 * registerNativeClass(MyCustomWidget, my_custom_widget_get_type());
 * ```
 */
export function registerNativeClass(cls: NativeClass, gtype: GType): void {
    if (gtype !== G_TYPE_INVALID) {
        classRegistry.set(gtype, cls);
        gtypeByClass.set(cls, gtype);
        (cls.prototype as GTypeStamped).__gtype__ = gtype;
    }
}

/**
 * Registers the GLib interface type identifier for a generated interface
 * wrapper class.
 *
 * Called automatically by generated bindings, once per interface. The
 * recorded `GType` lets {@link getNativeObjectAsInterface} pick the most
 * derived registered class that still conforms to the interface when the
 * runtime type is an unregistered private implementation.
 *
 * @param cls - The interface wrapper class
 * @param gtype - The GLib interface type identifier
 */
export function registerNativeInterface(cls: NativeClass, gtype: GType): void {
    if (gtype !== G_TYPE_INVALID) {
        interfaceGtypeByClass.set(cls, gtype);
        (cls.prototype as GTypeStamped).__gtype__ = gtype;
    }
}

/**
 * Returns the GLib type identifier registered for `cls`, or the invalid
 * GType (`0`) when the class has not been registered (e.g. boxed value types).
 */
export function getClassGType(cls: NativeClass): GType {
    return gtypeByClass.get(cls) ?? G_TYPE_INVALID;
}

/**
 * Returns the GLib interface type identifier registered for `cls` via
 * {@link registerNativeInterface}, or the invalid GType (`0`) when `cls` is
 * not a registered interface wrapper.
 */
export function getInterfaceGType(cls: NativeClass): GType {
    return interfaceGtypeByClass.get(cls) ?? G_TYPE_INVALID;
}

/**
 * Wraps an existing native handle as an instance of `cls` without invoking
 * the allocator.
 *
 * Used by the identity registry and signal-callback marshalling to lift
 * raw pointers received from the native layer into typed JavaScript
 * wrappers. The returned instance bypasses the constructor entirely,
 * leaving prototype-defined methods and accessors in place but skipping
 * any allocation or property initialization.
 *
 * @param cls - Target wrapper class
 * @param handle - Native handle to wrap
 */
export function wrapHandle<T extends object>(cls: NativeClass<T>, handle: NativeHandle): T {
    const instance = Object.create(cls.prototype) as T;
    setHandle(instance, handle);
    return instance;
}

/**
 * Gets a registered class by its GLib type identifier.
 *
 * @param gtype - The GLib type identifier
 * @returns The registered class, or null if not found
 */
export function getNativeClass(gtype: GType): NativeClass | null {
    return classRegistry.get(gtype) ?? null;
}

/**
 * Looks up the registered native class for a GLib type name.
 *
 * Resolves the runtime `GType` for `name` via `g_type_from_name` and returns
 * the class registered under it. Returns `null` when `name` is not a
 * registered GLib type — useful when callers operate on free-form strings
 * (such as JSX intrinsic-element names) where the input may legitimately
 * refer to a non-GLib element.
 *
 * @param name - GLib type name, e.g. `"GtkButton"` or a custom subclass
 *   name passed as `gtypeName` to {@link registerClass}.
 */
export function getNativeClassByName(name: string): NativeClass | null {
    const gtype = typeFromName(name);
    return gtype === G_TYPE_INVALID ? null : getNativeClass(gtype);
}

/**
 * Finds a native class by walking the type hierarchy.
 *
 * If the exact type is not registered, walks up the parent chain
 * until a registered type is found (unless walkHierarchy is false).
 *
 * @param gtype - The GLib type identifier to start from
 * @param walkHierarchy - Whether to walk up the parent chain (default: true)
 * @returns The closest registered parent class, or null
 */
export const findNativeClass = (gtype: GType, walkHierarchy = true): NativeClass | null => {
    const cls = getNativeClass(gtype);
    if (cls) return cls;

    if (!walkHierarchy) return null;

    let currentGtype = gtype;
    while (currentGtype !== G_TYPE_INVALID) {
        const parentGtype = typeParent(currentGtype);
        if (parentGtype === G_TYPE_INVALID) break;
        const parentCls = getNativeClass(parentGtype);
        if (parentCls) return parentCls;
        currentGtype = parentGtype;
    }

    return null;
};

/**
 * Finds the registered class to wrap a handle of runtime type `gtype` that is
 * known to implement `interfaceGtype`.
 *
 * Returns the class registered for `gtype` itself when present. Otherwise
 * walks the parent chain and returns the closest registered ancestor that
 * also conforms to `interfaceGtype`, ensuring the resulting wrapper carries
 * the interface's methods. Ancestors that are registered but do not implement
 * the interface (e.g. a bare `GObject` base) are skipped. Returns null when no
 * such class is registered, in which case callers fall back to the interface
 * wrapper class itself.
 *
 * @param gtype - The runtime GLib type identifier of the instance
 * @param interfaceGtype - The GLib interface type the instance implements
 * @returns The resolved class, or null when none is registered
 */
export const findNativeClassForInterface = (gtype: GType, interfaceGtype: GType): NativeClass | null => {
    const exact = getNativeClass(gtype);
    if (exact) return exact;

    if (interfaceGtype === G_TYPE_INVALID) return null;

    let currentGtype = gtype;
    while (currentGtype !== G_TYPE_INVALID) {
        const parentGtype = typeParent(currentGtype);
        if (parentGtype === G_TYPE_INVALID) break;
        const parentCls = getNativeClass(parentGtype);
        if (parentCls && typeIsA(parentGtype, interfaceGtype)) {
            return parentCls;
        }
        currentGtype = parentGtype;
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
    const pointerId = getNativeId(getHandle(obj));
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
 * The runtime type is resolved dynamically; the optional generic type
 * parameter lets a caller state the wrapper type it expects when the
 * resolved class is statically known to be that type or a subtype.
 *
 * @example
 * ```tsx
 * // Automatic type resolution (identity-tracked GObject)
 * const widget = getNativeObject<Gtk.Widget>(widgetHandle);
 *
 * // Explicit type (boxed value, no identity tracking)
 * const rgba = getNativeObject(rgbaHandle, Gdk.RGBA);
 * ```
 */
export function getNativeObject<T extends object>(handle: NativeHandle, targetType: NativeClass<T>): T;
export function getNativeObject<T extends object>(
    handle: NativeHandle | null | undefined,
    targetType: NativeClass<T>,
): T | null;
export function getNativeObject(handle: null | undefined): null;
export function getNativeObject<T extends object = NativeObject>(handle: NativeHandle): T;
export function getNativeObject<T extends object = NativeObject>(handle: NativeHandle | null | undefined): T | null;
export function getNativeObject(handle: NativeHandle | null | undefined, targetType?: NativeClass): object | null {
    if (handle === null || handle === undefined) {
        return null;
    }

    if (targetType) {
        return wrapHandle(targetType, handle);
    }

    const existing = findNativeObject(handle);
    if (existing) return existing;

    const runtimeGtype: GType = getInstanceGType(handle);
    if (runtimeGtype === G_TYPE_INVALID) {
        throw new Error("Cannot resolve runtime GLib type from handle");
    }
    const cls = findNativeClass(runtimeGtype);
    if (!cls) {
        throw new Error(`Expected registered GLib type, got gtype ${String(runtimeGtype)}`);
    }

    const adopted = tryAdoptPendingConstruction(handle, cls);
    if (adopted) return adopted;

    const instance = wrapHandle(cls, handle) as NativeObject;
    registerNativeObject(instance);
    return instance;
}

/**
 * If a wrapper is mid-construction and matches `cls` exactly, claim it for
 * `handle` and register it. Returns the adopted wrapper or `null` when no
 * legitimate adoption applies.
 *
 * The match must be exact rather than `instanceof` because adoption installs
 * the supplied handle on the wrapper: a class-mismatched adoption would bind a
 * subclass wrapper to a base-class handle and break identity for any later
 * lookup of the genuine subclass instance.
 */
function tryAdoptPendingConstruction(handle: NativeHandle, cls: NativeClass): NativeObject | null {
    const pending = getPendingConstruction();
    if (!pending) return null;
    if (pending.constructor !== cls) return null;
    if (tryGetHandle(pending) !== undefined) return null;
    setHandle(pending, handle);
    registerNativeObject(pending as NativeObject);
    return pending as NativeObject;
}

/**
 * Creates a JavaScript wrapper for a native handle known to implement
 * a specific GObject interface.
 *
 * Resolves the runtime GLib type and instantiates the matching registered
 * class. When the runtime type itself is not registered — common for the
 * private implementation types GLib hands back from interface-typed APIs
 * (e.g. the local-file class behind a `Gio.File`) — the parent hierarchy is
 * walked for the closest registered ancestor that still conforms to the
 * interface. If no such class is registered, the supplied interface class is
 * used, so the result is always assignable to the interface type and callers
 * can invoke interface methods on it.
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

    const runtimeGtype: GType = getInstanceGType(handle);
    if (runtimeGtype === G_TYPE_INVALID) {
        throw new Error("Cannot resolve runtime GLib type from handle");
    }

    const interfaceGtype = getInterfaceGType(interfaceClass);
    const cls = findNativeClassForInterface(runtimeGtype, interfaceGtype) ?? interfaceClass;
    const adopted = tryAdoptPendingConstruction(handle, cls);
    if (adopted) return adopted as Result;
    const instance = wrapHandle(cls, handle) as NativeObject;
    registerNativeObject(instance);
    return instance as Result;
}
