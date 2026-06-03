import {
    applyWrapperRefOp,
    getInstanceGType,
    getWrapper,
    type NativeHandle,
    setObjectToggleNotify,
    setWrapper,
} from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { G_TYPE_INVALID, type GType, typeFromName, typeIsA, typeParent } from "./gtype.js";
import { type GTyped, setHandle, tryGetHandle } from "./handles.js";
import { getPendingConstruction } from "./pending-construction.js";

setObjectToggleNotify((refPtr, op) => applyWrapperRefOp(refPtr, op));

let gObjectGType: GType = G_TYPE_INVALID;

/**
 * Whether `gtype` is a `GObject` descendant, as opposed to another
 * `GTypeInstance` fundamental (a `GParamSpec`, for example). Toggle references
 * are a `GObject`-only mechanism, so non-`GObject` instances are wrapped without
 * one. The `GObject` fundamental type is resolved lazily and memoized, since it
 * is registered by the time any instance crosses the boundary.
 */
function isGObjectType(gtype: GType): boolean {
    if (gObjectGType === G_TYPE_INVALID) {
        gObjectGType = typeFromName("GObject");
    }
    return gObjectGType !== G_TYPE_INVALID && typeIsA(gtype, gObjectGType);
}

const classRegistry = new Map<GType, AnyClass>();
const gTypeByClass = new WeakMap<AnyClass, GType>();
const interfaceGTypeByClass = new WeakMap<AnyClass, GType>();

/**
 * Records the GLib type identifier of a native class in the identity registry.
 *
 * Invoked by `registerNativeClass` once it has resolved the class's `GType`,
 * and by `registerClass` for runtime-registered subclasses. The recorded
 * mapping lets {@link getNativeObject} resolve a raw native pointer back to its
 * JavaScript wrapper class.
 *
 * @param cls - The native class to register
 * @param gtype - The GLib type identifier for the class
 */
export function setClassGType(cls: AnyClass, gtype: GType): void {
    if (gtype !== G_TYPE_INVALID) {
        classRegistry.set(gtype, cls);
        gTypeByClass.set(cls, gtype);
        (cls.prototype as GTyped).__gtype__ = gtype;
    }
}

/**
 * Records the GLib interface type identifier for a generated interface
 * wrapper class.
 *
 * Invoked by `registerNativeClass` for interface roles. The recorded `GType`
 * lets {@link getNativeObjectAsInterface} pick the most derived registered
 * class that still conforms to the interface when the runtime type is an
 * unregistered private implementation.
 *
 * @param cls - The interface wrapper class
 * @param gtype - The GLib interface type identifier
 */
export function setInterfaceGType(cls: AnyClass, gtype: GType): void {
    if (gtype !== G_TYPE_INVALID) {
        interfaceGTypeByClass.set(cls, gtype);
        (cls.prototype as GTyped).__gtype__ = gtype;
    }
}

/**
 * Returns the GLib type identifier registered for `cls`, or the invalid
 * GType (`0`) when the class has not been registered (e.g. boxed value types).
 */
export function getClassGType(cls: AnyClass): GType {
    return gTypeByClass.get(cls) ?? G_TYPE_INVALID;
}

/**
 * Returns the GLib interface type identifier registered for `cls` via
 * {@link setInterfaceGType}, or the invalid GType (`0`) when `cls` is
 * not a registered interface wrapper.
 */
function getInterfaceGType(cls: AnyClass): GType {
    return interfaceGTypeByClass.get(cls) ?? G_TYPE_INVALID;
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
export function wrapHandle<T extends object>(cls: AnyClass<T>, handle: NativeHandle): T {
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
export function getNativeClass(gtype: GType): AnyClass | null {
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
export function getNativeClassByName(name: string): AnyClass | null {
    const gtype = typeFromName(name);
    return gtype === G_TYPE_INVALID ? null : getNativeClass(gtype);
}

/**
 * Finds a native class by walking the type hierarchy.
 *
 * If the exact type is not registered, walks up the parent chain
 * until a registered type is found.
 *
 * @param gtype - The GLib type identifier to start from
 * @returns The closest registered parent class, or null
 */
export function findNativeClass(gtype: GType): AnyClass | null {
    const cls = getNativeClass(gtype);
    if (cls) return cls;

    let currentGType = gtype;
    while (currentGType !== G_TYPE_INVALID) {
        const parentGType = typeParent(currentGType);
        if (parentGType === G_TYPE_INVALID) break;
        const parentCls = getNativeClass(parentGType);
        if (parentCls) return parentCls;
        currentGType = parentGType;
    }

    return null;
}

/**
 * Finds the registered class to wrap a handle of runtime type `gtype` that is
 * known to implement `interfaceGType`.
 *
 * Returns the class registered for `gtype` itself when present. Otherwise
 * walks the parent chain and returns the closest registered ancestor that
 * also conforms to `interfaceGType`, ensuring the resulting wrapper carries
 * the interface's methods. Ancestors that are registered but do not implement
 * the interface (e.g. a bare `GObject` base) are skipped. Returns null when no
 * such class is registered, in which case callers fall back to the interface
 * wrapper class itself.
 *
 * @param gtype - The runtime GLib type identifier of the instance
 * @param interfaceGType - The GLib interface type the instance implements
 * @returns The resolved class, or null when none is registered
 */
function findNativeClassForInterface(gtype: GType, interfaceGType: GType): AnyClass | null {
    const exact = getNativeClass(gtype);
    if (exact) return exact;

    if (interfaceGType === G_TYPE_INVALID) return null;

    let currentGType = gtype;
    while (currentGType !== G_TYPE_INVALID) {
        const parentGType = typeParent(currentGType);
        if (parentGType === G_TYPE_INVALID) break;
        const parentCls = getNativeClass(parentGType);
        if (parentCls && typeIsA(parentGType, interfaceGType)) {
            return parentCls;
        }
        currentGType = parentGType;
    }

    return null;
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
export function getNativeObject<T extends object>(handle: NativeHandle, targetType: AnyClass<T>): T;
export function getNativeObject<T extends object>(
    handle: NativeHandle | null | undefined,
    targetType: AnyClass<T>,
): T | null;
export function getNativeObject(handle: null | undefined): null;
export function getNativeObject<T extends object = GTyped>(handle: NativeHandle): T;
export function getNativeObject<T extends object = GTyped>(handle: NativeHandle | null | undefined): T | null;
export function getNativeObject(handle: NativeHandle | null | undefined, targetType?: AnyClass): object | null {
    if (handle === null || handle === undefined) {
        return null;
    }

    if (targetType) {
        return wrapHandle(targetType, handle);
    }

    const existing = getWrapper(handle);
    if (existing) return existing;

    const runtimeGType: GType = getInstanceGType(handle);
    if (runtimeGType === G_TYPE_INVALID) {
        throw new Error("Cannot resolve runtime GLib type from handle");
    }
    const cls = findNativeClass(runtimeGType);
    if (!cls) {
        throw new Error(`Expected registered GLib type, got gtype ${String(runtimeGType)}`);
    }

    const adopted = tryAdoptPendingConstruction(handle, cls);
    if (adopted) return adopted;

    const instance = wrapHandle(cls, handle) as GTyped;
    if (isGObjectType(runtimeGType)) {
        setWrapper(handle, instance);
    }
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
function tryAdoptPendingConstruction(handle: NativeHandle, cls: AnyClass): GTyped | null {
    const pending = getPendingConstruction();
    if (!pending) return null;
    if (pending.constructor !== cls) return null;
    if (tryGetHandle(pending) !== undefined) return null;
    setHandle(pending, handle);
    setWrapper(handle, pending as GTyped);
    return pending as GTyped;
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
export function getNativeObjectAsInterface<T extends NativeHandle | null | undefined, TClass extends AnyClass>(
    handle: T,
    interfaceClass: TClass,
): T extends null | undefined ? null : InstanceType<TClass> {
    type Result = T extends null | undefined ? null : InstanceType<TClass>;

    if (handle === null || handle === undefined) return null as Result;

    const existing = getWrapper(handle);
    if (existing) return existing as Result;

    const runtimeGType: GType = getInstanceGType(handle);
    if (runtimeGType === G_TYPE_INVALID) {
        throw new Error("Cannot resolve runtime GLib type from handle");
    }

    const interfaceGType = getInterfaceGType(interfaceClass);
    const cls = findNativeClassForInterface(runtimeGType, interfaceGType) ?? interfaceClass;
    const adopted = tryAdoptPendingConstruction(handle, cls);
    if (adopted) return adopted as Result;
    const instance = wrapHandle(cls, handle) as GTyped;
    if (isGObjectType(runtimeGType)) {
        setWrapper(handle, instance);
    }
    return instance as Result;
}
