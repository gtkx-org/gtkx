import { getType, getWrapper, type NativeHandle, setWrapper } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { type GType, TYPE_INVALID, typeFromName, typeIsA, typeParent } from "./gtype.js";

let gobjectGtype: GType = TYPE_INVALID;

/**
 * Whether `gtype` is a `GObject` descendant, as opposed to another
 * `GTypeInstance` fundamental (a `GParamSpec`, for example). Toggle references
 * are a `GObject`-only mechanism, so non-`GObject` instances are wrapped without
 * one. The `GObject` fundamental type is resolved lazily and memoized, since it
 * is registered by the time any instance crosses the boundary.
 */
function isGobjectType(gtype: GType): boolean {
    if (gobjectGtype === TYPE_INVALID) {
        gobjectGtype = typeFromName("GObject");
    }
    return gobjectGtype !== TYPE_INVALID && typeIsA(gtype, gobjectGtype);
}

const classRegistry = new Map<GType, AnyClass>();
const gtypeByClass = new WeakMap<AnyClass, GType>();
const interfaceGtypeByClass = new WeakMap<AnyClass, GType>();

/**
 * Records the GLib type identifier of a wrapper class in the identity registry.
 *
 * Invoked by `registerWrapperClass` once it has resolved the class's `GType`,
 * and by `registerClass` for runtime-registered subclasses. The recorded
 * mapping lets {@link wrapHandle} resolve a raw native pointer back to its
 * JavaScript wrapper class.
 *
 * @param cls - The wrapper class to register
 * @param gtype - The GLib type identifier for the class
 */
export function setClassGtype(cls: AnyClass, gtype: GType): void {
    if (gtype !== TYPE_INVALID) {
        classRegistry.set(gtype, cls);
        gtypeByClass.set(cls, gtype);
        (cls.prototype as GTyped).__gtype__ = gtype;
    }
}

/**
 * Records the GLib interface type identifier for a generated interface
 * wrapper class.
 *
 * Invoked by `registerWrapperClass` for interface roles. The recorded `GType`
 * lets {@link wrapHandle} pick the most derived registered
 * class that still conforms to the interface when the runtime type is an
 * unregistered private implementation.
 *
 * @param cls - The interface wrapper class
 * @param gtype - The GLib interface type identifier
 */
export function setInterfaceGtype(cls: AnyClass, gtype: GType): void {
    if (gtype !== TYPE_INVALID) {
        interfaceGtypeByClass.set(cls, gtype);
        (cls.prototype as GTyped).__gtype__ = gtype;
    }
}

/**
 * Returns the GLib type identifier registered for `cls`, or the invalid
 * GType (`0`) when the class has not been registered (e.g. boxed value types).
 */
export function getClassGtype(cls: AnyClass): GType {
    return gtypeByClass.get(cls) ?? TYPE_INVALID;
}

/**
 * Returns the GLib interface type identifier registered for `cls` via
 * {@link setInterfaceGtype}, or the invalid GType (`0`) when `cls` is
 * not a registered interface wrapper.
 */
function getInterfaceGtype(cls: AnyClass): GType {
    return interfaceGtypeByClass.get(cls) ?? TYPE_INVALID;
}

function instantiate<T extends object>(cls: AnyClass<T>, handle: NativeHandle): T {
    const instance = Object.create(cls.prototype) as T;
    setHandle(instance, handle);
    return instance;
}

/**
 * Lifts a native handle into its typed JavaScript wrapper. The strategy follows
 * `cls`:
 *
 * - **omitted** — the handle is a `GObject`: its runtime `GType` is read off the
 *   pointer, the registered class resolved, and the single identity-tracked
 *   canonical wrapper returned, so the same pointer always yields the same
 *   (`===`) instance. Throws when the runtime type has no registered class.
 * - **an interface wrapper class** — likewise a `GObject`, but resolved to the
 *   most-derived registered class implementing that interface (falling back to
 *   `cls`), so the wrapper carries the interface's methods.
 * - **a concrete class** — a value type (boxed, struct, opaque) whose handle has
 *   no readable runtime type: a fresh wrapper of `cls`, no identity tracking, a
 *   new instance per call.
 *
 * A null/undefined handle yields `null`. The wrapper bypasses the class
 * constructor (no allocation or field initialization).
 *
 * @param handle - The native handle, or null/undefined
 * @param cls - A value-type or interface wrapper class; omitted to resolve a
 *   `GObject` from its runtime type
 *
 * @example
 * ```tsx
 * const widget = wrapHandle<Gtk.Widget>(widgetHandle); // GObject, identity-tracked
 * const file = wrapHandle(fileHandle, Gio.File);       // interface, resolved
 * const rgba = wrapHandle(rgbaHandle, Gdk.RGBA);        // value type, fresh
 * ```
 */
export function wrapHandle<T extends object>(handle: NativeHandle, cls: AnyClass<T>): T;
export function wrapHandle<T extends object>(handle: NativeHandle | null | undefined, cls: AnyClass<T>): T | null;
export function wrapHandle(handle: null | undefined, cls?: AnyClass): null;
export function wrapHandle<T extends object = GTyped>(handle: NativeHandle, cls?: AnyClass): T;
export function wrapHandle<T extends object = GTyped>(
    handle: NativeHandle | null | undefined,
    cls?: AnyClass,
): T | null;
export function wrapHandle(handle: NativeHandle | null | undefined, cls?: AnyClass): object | null {
    if (handle === null || handle === undefined) return null;
    if (cls === undefined) {
        return resolveWrapper(handle, (runtimeGtype) => {
            const resolved = findWrapperClass(runtimeGtype);
            if (!resolved) {
                throw new Error(`Expected registered GLib type, got gtype ${String(runtimeGtype)}`);
            }
            return resolved;
        });
    }
    const interfaceGtype = getInterfaceGtype(cls);
    if (interfaceGtype !== TYPE_INVALID) {
        return resolveWrapper(
            handle,
            (runtimeGtype) => findWrapperClassForInterface(runtimeGtype, interfaceGtype) ?? cls,
        );
    }
    return instantiate(cls, handle);
}

/**
 * Gets the registered wrapper class for a GLib type identifier.
 *
 * When starting from a GLib type name (such as a JSX intrinsic-element name),
 * resolve it to a `GType` with {@link typeFromName} first; an unregistered or
 * unknown type yields `null`, so callers operating on free-form names can treat
 * a missing class as "not a GLib type".
 *
 * @param gtype - The GLib type identifier.
 * @returns The registered class, or `null` if none is registered for `gtype`.
 * @example
 * ```ts
 * const ButtonClass = getWrapperClass(typeFromName("GtkButton"));
 * ```
 */
export function getWrapperClass(gtype: GType): AnyClass | null {
    return classRegistry.get(gtype) ?? null;
}

/**
 * Walks the parent chain of `gtype`, returning the first registered ancestor
 * class that `accept` admits.
 *
 * Each step resolves the parent `GType`, looks up its registered class, and —
 * when one exists — offers it to `accept`. The walk stops at the first accepted
 * class or when the chain reaches the invalid root.
 *
 * @param gtype - The GLib type identifier to start from
 * @param accept - Predicate deciding whether a registered ancestor is a match
 * @returns The first accepted ancestor class, or null when none qualifies
 */
function walkParentChain(gtype: GType, accept: (parentGtype: GType, parentCls: AnyClass) => boolean): AnyClass | null {
    let currentGtype = gtype;
    while (currentGtype !== TYPE_INVALID) {
        const parentGtype = typeParent(currentGtype);
        if (parentGtype === TYPE_INVALID) break;
        const parentCls = getWrapperClass(parentGtype);
        if (parentCls && accept(parentGtype, parentCls)) return parentCls;
        currentGtype = parentGtype;
    }

    return null;
}

/**
 * Finds a wrapper class by walking the type hierarchy.
 *
 * If the exact type is not registered, walks up the parent chain
 * until a registered type is found.
 *
 * @param gtype - The GLib type identifier to start from
 * @returns The closest registered parent class, or null
 */
export function findWrapperClass(gtype: GType): AnyClass | null {
    return getWrapperClass(gtype) ?? walkParentChain(gtype, () => true);
}

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
function findWrapperClassForInterface(gtype: GType, interfaceGtype: GType): AnyClass | null {
    const exact = getWrapperClass(gtype);
    if (exact) return exact;

    if (interfaceGtype === TYPE_INVALID) return null;

    return walkParentChain(gtype, (parentGtype) => typeIsA(parentGtype, interfaceGtype));
}

/**
 * Shared wrapper-resolution pipeline behind the identity-tracked entry points.
 *
 * Returns the existing wrapper when the object is already tracked. Otherwise it
 * resolves the runtime `GType`, picks the wrapper class via `resolveClass`,
 * and finally builds and — for `GObject`s — registers a fresh wrapper. The
 * class-less and interface forms of {@link wrapHandle} differ only in the
 * `resolveClass` strategy they supply.
 *
 * @param handle - The live native handle to resolve
 * @param resolveClass - Maps the runtime `GType` to the wrapper class to use
 */
function resolveWrapper(handle: NativeHandle, resolveClass: (runtimeGtype: GType) => AnyClass): object {
    const existing = getWrapper(handle);
    if (existing) return existing;

    const runtimeGtype: GType = getType(handle);
    if (runtimeGtype === TYPE_INVALID) {
        throw new Error("Cannot resolve runtime GLib type from handle");
    }

    const cls = resolveClass(runtimeGtype);
    const instance = instantiate(cls, handle) as GTyped;
    if (isGobjectType(runtimeGtype)) {
        setWrapper(handle, instance);
    }
    return instance;
}

export type { NativeHandle } from "@gtkx/native";

/**
 * Structural shape of any wrapped native instance once construction or
 * `wrapHandle` has stamped its runtime GLib type onto it. Every GObject and
 * boxed wrapper produced by `@gtkx/ffi` satisfies this interface; consumers
 * that need the runtime `GType` of an instance read it through this type.
 */
export interface GTyped {
    /** Runtime GType of the underlying GObject or boxed instance. */
    // biome-ignore lint/style/useNamingConvention: GObject phantom-type key read off instances
    __gtype__: GType;
}

/**
 * Returns the superclass of a wrapper class, or `null` when `cls` is a
 * root class whose prototype is `Function.prototype` (the JavaScript class
 * hierarchy root). Encapsulates the single boundary where a prototype-chain
 * walk over generated classes meets the untyped function root, so callers can
 * iterate ancestry without comparing against `Function.prototype` themselves.
 */
export function getParentClass(cls: AnyClass): AnyClass | null {
    const parent: unknown = Object.getPrototypeOf(cls);
    return typeof parent === "function" && parent !== Function.prototype ? (parent as AnyClass) : null;
}

const handleMap = new WeakMap<object, NativeHandle>();

/**
 * Returns the native handle associated with `instance`. Throws when the object
 * has not been linked to a handle.
 *
 */
export function getHandle(instance: object): NativeHandle {
    const handle = handleMap.get(instance);
    if (handle === undefined) {
        const name = (instance as { constructor?: { name?: string } }).constructor?.name ?? "object";
        throw new Error(`No native handle associated with ${name}`);
    }
    return handle;
}

/**
 * Returns the native handle associated with `instance`, or `undefined` when the
 * object is nullish or has not been linked to a handle. Use this when a
 * caller cannot guarantee that the object has been fully constructed.
 *
 */
export function tryGetHandle(instance: object | null | undefined): NativeHandle | undefined {
    return instance == null ? undefined : handleMap.get(instance);
}

/**
 * Associates a native handle with `instance`.
 *
 */
export function setHandle(instance: object, handle: NativeHandle): void {
    handleMap.set(instance, handle);
}

/**
 * Registry of generated vtable vfunc descriptors, keyed by the JS class they
 * belong to. Populated by codegen at module load via {@link registerVfuncRegistry}
 * and consulted by `registerClass` to auto-discover vfunc overrides supplied
 * as plain methods on user subclasses.
 */
export type VfuncRegistry = Readonly<Record<string, unknown>>;

const vfuncRegistryByClass = new WeakMap<object, VfuncRegistry>();

/**
 * Associates a vtable vfunc descriptor registry with a generated class so that
 * `registerClass` can resolve vfunc overrides by method name on subclasses.
 *
 */
export function registerVfuncRegistry(cls: object, registry: VfuncRegistry): void {
    vfuncRegistryByClass.set(cls, registry);
}

/**
 * Resolves the vtable vfunc descriptor map associated with `cls`, or
 * `undefined` when no descriptors have been registered for it.
 */
export function getVfuncRegistry(cls: object): VfuncRegistry | undefined {
    return vfuncRegistryByClass.get(cls);
}
