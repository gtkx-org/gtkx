import { getType, getWrapper, type Handle, setWrapper } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { type GType, type GTyped, TYPE_INVALID, typeFromName, typeIsA, typeName, typeParent } from "./gtype.js";

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

/**
 * Stamps a wrapper class's `GType` onto its prototype, the one sanctioned
 * mutation of the otherwise read-only `__gtype__` every instance reads.
 */
function stampGtype(cls: AnyClass, gtype: GType): void {
    (cls.prototype as { -readonly [K in keyof GTyped]: GTyped[K] }).__gtype__ = gtype;
}

/**
 * Reads the `GType` stamped directly on `cls`'s own prototype, ignoring any
 * value inherited from a registered ancestor. An unregistered class — including
 * an unregistered subclass of a registered one — yields the invalid `GType`.
 */
function ownStampedGtype(cls: AnyClass): GType {
    const proto: object = cls.prototype;
    return Object.hasOwn(proto, "__gtype__") ? (proto as GTyped).__gtype__ : TYPE_INVALID;
}

/**
 * Records the GLib type identifier of a wrapper class in the identity registry.
 *
 * Invoked by `registerWrapperClass` for every generated wrapper type — concrete
 * class, boxed record, or interface — and by `registerClass` for
 * runtime-registered subclasses. Concrete and interface `GType`s share the one
 * registry because their key spaces are disjoint: the recorded mapping lets
 * {@link wrapHandle} resolve a raw native pointer back to its JavaScript wrapper
 * class, and {@link wrapInterfaceHandle} resolve an interface's own wrapper class
 * as the fallback for an unregistered private implementation.
 *
 * @param cls - The wrapper class to register
 * @param gtype - The GLib type identifier for the class
 */
export function setClassGtype(cls: AnyClass, gtype: GType): void {
    if (gtype !== TYPE_INVALID) {
        classRegistry.set(gtype, cls);
        stampGtype(cls, gtype);
    }
}

/**
 * Returns the GLib type identifier registered for `cls`, or the invalid
 * GType (`0`) when the class has not been registered (e.g. boxed value types).
 */
export function getClassGtype(cls: AnyClass): GType {
    return ownStampedGtype(cls);
}

/**
 * Returns the GLib type identifier of `instance`'s leaf class, or the invalid
 * GType (`0`) when that class has not been registered. The generated root
 * constructor calls this to resolve the GType to construct before linking the
 * resulting handle to the wrapper.
 *
 * @param instance - The wrapper whose leaf class supplies the GType.
 */
export function getInstanceGtype(instance: object): GType {
    return getClassGtype(instance.constructor as AnyClass);
}

function instantiate<T extends object>(cls: AnyClass<T>, handle: Handle): T {
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
 * - **a concrete class** — a value type (boxed, struct, opaque) whose handle has
 *   no readable runtime type: a fresh wrapper of `cls`, no identity tracking, a
 *   new instance per call.
 *
 * For an interface-typed value, whose runtime implementation may be a private,
 * unregistered class, use {@link wrapInterfaceHandle} instead.
 *
 * A null/undefined handle yields `null`. The wrapper bypasses the class
 * constructor (no allocation or field initialization).
 *
 * @param handle - The native handle, or null/undefined
 * @param cls - A value-type wrapper class; omitted to resolve a `GObject` from
 *   its runtime type
 *
 * @example
 * ```tsx
 * const widget = wrapHandle<Gtk.Widget>(widgetHandle); // GObject, identity-tracked
 * const rgba = wrapHandle(rgbaHandle, Gdk.RGBA);        // value type, fresh
 * ```
 */
export function wrapHandle<T extends object>(handle: Handle, cls: AnyClass<T>): T;
export function wrapHandle<T extends object>(handle: Handle | null | undefined, cls: AnyClass<T>): T | null;
export function wrapHandle(handle: null | undefined, cls?: AnyClass): null;
export function wrapHandle<T extends object = GTyped>(handle: Handle, cls?: AnyClass): T;
export function wrapHandle<T extends object = GTyped>(handle: Handle | null | undefined, cls?: AnyClass): T | null;
export function wrapHandle(handle: Handle | null | undefined, cls?: AnyClass): object | null {
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
    return instantiate(cls, handle);
}

/**
 * Lifts a native handle into the typed JavaScript wrapper for an
 * interface-typed value.
 *
 * The concrete runtime type behind an interface return is frequently a private,
 * unregistered GLib implementation (the local-file class behind a `Gio.File`,
 * for example), so the runtime `GType` read off the handle resolves to the
 * most-derived registered class that still conforms to `interfaceGtype`,
 * falling back to the interface's own wrapper class — so the result always
 * carries the interface's methods. Like the class-less {@link wrapHandle} it
 * resolves a `GObject`, so identity is tracked and the same pointer yields the
 * same (`===`) instance. A null/undefined handle yields `null`.
 *
 * @param handle - The native handle, or null/undefined
 * @param interfaceGtype - The GLib interface type the value is known to implement
 */
export function wrapInterfaceHandle<T extends object>(handle: Handle, interfaceGtype: GType): T;
export function wrapInterfaceHandle<T extends object>(
    handle: Handle | null | undefined,
    interfaceGtype: GType,
): T | null;
export function wrapInterfaceHandle(handle: Handle | null | undefined, interfaceGtype: GType): object | null {
    if (handle === null || handle === undefined) return null;
    return resolveWrapper(handle, (runtimeGtype) => {
        const resolved = findWrapperClassForInterface(runtimeGtype, interfaceGtype) ?? getWrapperClass(interfaceGtype);
        if (!resolved) {
            throw new Error(
                `Expected registered wrapper for interface ${typeName(interfaceGtype) ?? String(interfaceGtype)}`,
            );
        }
        return resolved;
    });
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
 * class-less {@link wrapHandle} and {@link wrapInterfaceHandle} differ only in
 * the `resolveClass` strategy they supply.
 *
 * @param handle - The live native handle to resolve
 * @param resolveClass - Maps the runtime `GType` to the wrapper class to use
 */
function resolveWrapper(handle: Handle, resolveClass: (runtimeGtype: GType) => AnyClass): object {
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

export type { Handle } from "@gtkx/native";

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

/**
 * Walks the JS prototype chain from `cls` up through each ancestor class,
 * returning the first non-`undefined` value `visit` produces, or `undefined`
 * when the chain is exhausted.
 *
 * @typeParam T - The value the walk resolves to.
 * @param cls - The class to start from, or `null` to visit nothing.
 * @param visit - Invoked per ancestor; a defined return short-circuits the walk.
 * @returns The first defined `visit` result, or `undefined`.
 */
export function walkClassChain<T>(cls: AnyClass | null, visit: (ancestor: AnyClass) => T | undefined): T | undefined {
    let current = cls;
    while (current !== null) {
        const result = visit(current);
        if (result !== undefined) return result;
        current = getParentClass(current);
    }
    return undefined;
}

const handleMap = new WeakMap<object, Handle>();

/**
 * Returns the native handle associated with `instance`. Throws when the object
 * has not been linked to a handle.
 *
 */
export function getHandle(instance: object): Handle {
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
export function tryGetHandle(instance: object | null | undefined): Handle | undefined {
    return instance == null ? undefined : handleMap.get(instance);
}

/**
 * Associates a native handle with `instance`.
 *
 */
export function setHandle(instance: object, handle: Handle): void {
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

const interfaceVfuncRegistryByGtype = new Map<GType, VfuncRegistry>();

/**
 * Records an interface's generated vtable vfunc descriptor map under its
 * `GType` so that `registerClass` can auto-discover interface vfunc overrides
 * on a subclass. Called once per interface at module load.
 *
 * @param gtype - The interface's GLib type identifier.
 * @param vfuncRegistry - The interface's vtable vfunc descriptor map.
 */
export function registerInterfaceVfuncRegistry(gtype: GType, vfuncRegistry: VfuncRegistry): void {
    if (gtype === TYPE_INVALID) return;
    interfaceVfuncRegistryByGtype.set(gtype, vfuncRegistry);
}

/**
 * Resolves the vtable vfunc descriptor map registered for an interface
 * `GType`, or `undefined` when none has been registered.
 */
export function getInterfaceVfuncRegistry(gtype: GType): VfuncRegistry | undefined {
    return interfaceVfuncRegistryByGtype.get(gtype);
}
