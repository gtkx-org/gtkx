import {
    type ExternalObject,
    getType,
    getWrapper,
    type Handle,
    type RegisterClassVfunc as NativeRegisterClassVfunc,
    setWrapper,
} from "@gtkx/native";
import { type AnyClass, walkClassChain } from "@gtkx/utils";
import type { Mixin, MixinReceiver } from "./mixin.js";
import { TYPE_INVALID, type TypedClass, typeInterfaces, typeIsA, typeName, typeParent } from "./type.js";

/**
 * Static side of class `C` with its construct signature preserved but the members named `K`
 * removed. A generated class lists every static it declares itself, so a static it narrows never
 * has to stay assignable to the one it shadows. The signature is kept abstract so an abstract `C`
 * survives it: a subclass extends the result, and only the subclass's own declarations decide
 * which statics reach it.
 */
type StaticBase<C, K extends PropertyKey> = Omit<C, K> &
    (C extends abstract new (...args: infer A) => infer R ? abstract new (...args: A) => R : never);

/** One overridable vtable slot: where it sits in the vtable struct and how it is marshalled. */
type VfuncDescriptor = {
    /** GIR name of the type struct holding the slot, without its namespace, such as `WidgetClass`. */
    className: string;
    /** Name of the slot's field in that struct. */
    vfuncName: string;
    /** Byte offset of the slot within the struct. */
    byteOffset: number;
    /**
     * Byte size of an interface's vtable struct, used to bounds-check `VfuncDescriptor.byteOffset`.
     * A class struct is bounds-checked against the size `g_type_query` reports for it, so a slot in
     * one carries no size of its own.
     */
    vtableSize?: number;
    /** Descriptor for each argument the slot receives, starting with the instance. */
    argDescriptors: NativeRegisterClassVfunc["argDescriptors"];
    /** Descriptor for the value the slot returns. */
    returnDescriptor: NativeRegisterClassVfunc["returnDescriptor"];
    /**
     * GIR marks the slot's return value as one the bindings do not surface, so a call through the
     * slot drops it and an implementation of the slot reports success in its place, while
     * `VfuncDescriptor.returnDescriptor` keeps the C type the slot is called against either way.
     */
    isReturnSkipped?: boolean;
    /**
     * The slot takes a trailing `GError**` that `VfuncDescriptor.argDescriptors` leaves out, the
     * way GIR leaves it out of a callable's parameters. A call through the slot has to append it
     * or it passes one argument fewer than the implementation reads.
     */
    canThrow?: boolean;
};

/**
 * The vtable slots a wrapper class or interface exposes, keyed by the JavaScript method name that
 * overrides each one.
 */
type VfuncRegistry = Record<string, VfuncDescriptor>;
type WrapperBinding = (handle: ExternalObject<Handle>, instance: object) => void;
/**
 * Picks the wrapper class for one handle of a registered type, such as a subclass keyed on a tag the
 * handle carries.
 */
type WrapperClassResolver = (handle: ExternalObject<Handle>) => AnyClass;

/**
 * How one property an interface declares reaches the vtable, given as the interface's own accessor
 * members. A direction introspection does not route through a vtable slot is left out, and the
 * property owns that direction's state itself.
 */
type InterfaceProperty = {
    /** Member reading the slot the property's value comes from, such as `getEnabled`. */
    getter?: string;
    /** Member writing the slot the property's value goes to, such as `setActionName`. */
    setter?: string;
};

/**
 * What an interface's vtable struct looks like, for the classes that adopt the interface.
 * `g_type_query` reports no size for an interface, so each slot's generated metadata carries the
 * struct's byte size to bounds-check the slot's offset; an interface introspection describes no
 * vtable for simply contributes no slots.
 */
type InterfaceLayout = {
    /** The slots the struct declares, keyed by the JavaScript method name that fills each one. */
    vfuncs?: VfuncRegistry;
    /**
     * The properties a vtable slot backs, keyed by canonical property name, so a class adopting the
     * interface answers `g_object_get` and `g_object_set` with what the slot holds.
     */
    properties?: Record<string, InterfaceProperty>;
};

const classRegistry: Map<bigint, AnyClass> = new Map();
const interfaceMixinRegistry: Map<bigint, Mixin> = new Map();
const composedClassRegistry: Map<bigint, AnyClass> = new Map();
const handleMap: WeakMap<object, ExternalObject<Handle>> = new WeakMap();
const vfuncRegistry: WeakMap<object, VfuncRegistry> = new WeakMap();
const interfaceLayoutRegistry: Map<bigint, InterfaceLayout> = new Map();
const wrapperClasses: WeakSet<AnyClass> = new WeakSet();
const derivedClasses: WeakSet<AnyClass> = new WeakSet();
const wrapperClassResolvers: WeakMap<AnyClass, WrapperClassResolver> = new WeakMap();

function setClassType(cls: AnyClass, type: bigint): void {
    (cls.prototype as { [K in keyof TypedClass]: TypedClass[K] }).__type__ = type;
}

/**
 * Returns the GType a class was registered under, or the invalid type when it carries none. The tag is
 * read off the class's own prototype, so a subclass that never went through `registerClass` reports the
 * invalid type rather than inheriting the one its parent was registered with.
 */
function getClassType(cls: AnyClass | undefined): bigint {
    const proto: object | undefined = cls?.prototype;

    if (proto === undefined || !Object.hasOwn(proto, "__type__")) {
        return TYPE_INVALID;
    }

    return (proto as TypedClass).__type__;
}

/**
 * Returns the GType the given instance's handle carries, or the invalid type when it has no handle.
 * This is the object's own type rather than the type of the class it was wrapped as, and the two differ
 * for an object GTK created itself, such as the row widget inside a `Gtk.ListView`, which GTKX wraps as
 * the nearest registered ancestor.
 */
function getInstanceType(instance: object): bigint {
    const handle = handleMap.get(instance);

    return handle === undefined ? TYPE_INVALID : getType(handle);
}

function registerClassType(cls: AnyClass, type: bigint): void {
    if (type === TYPE_INVALID) {
        return;
    }

    classRegistry.set(type, cls);
    setClassType(cls, type);
}

/**
 * Registers a wrapper class as the JS representation of a GType, optionally
 * installing a registry of virtual functions.
 * @param cls Wrapper class to associate with the type.
 * @param type GType the class wraps.
 * @param vfuncs Vtable slots the class exposes, so `registerClass` can bind the ones a subclass
 * overrides.
 */
function registerWrapperClass(cls: AnyClass, type: bigint, vfuncs?: VfuncRegistry): void {
    registerClassType(cls, type);

    if (type !== TYPE_INVALID) {
        wrapperClasses.add(cls);
    }

    if (vfuncs) {
        registerVfuncRegistry(cls, vfuncs);
    }
}

/**
 * Lets a class registered with `registerWrapperClass` pick a subclass for each handle it wraps, for
 * types whose one GType covers several C-level subtypes, the way a cairo surface reports image or
 * recording through `cairo_surface_get_type`. The resolver runs when a handle is wrapped as that class
 * explicitly, the way a boxed value a binding hands back is; a wrapper resolved from a handle's runtime
 * GType never consults it, and a subclass passed to `wrapHandle` directly is used as given.
 * @param cls Registered wrapper class whose handles the resolver classifies.
 * @param resolver Returns the class to instantiate for one handle, `cls` itself included.
 * @throws If `cls` is not a registered wrapper class.
 */
function registerWrapperClassResolver(cls: AnyClass, resolver: WrapperClassResolver): void {
    if (!wrapperClasses.has(cls)) {
        throw new Error(
            `Cannot register a wrapper class resolver for ${cls.name}: ` +
            "register the class with registerWrapperClass first",
        );
    }

    wrapperClassResolvers.set(cls, resolver);
}

function markDerivedClass(cls: AnyClass): void {
    derivedClasses.add(cls);
}

function resolveAncestorType(ancestor: AnyClass): bigint | undefined {
    if (derivedClasses.has(ancestor) || !wrapperClasses.has(ancestor)) {
        return undefined;
    }

    return getClassType(ancestor);
}

function resolveWrapperType(instance: object): bigint {
    const cls = instance.constructor as AnyClass | undefined;

    if (cls === undefined) {
        return TYPE_INVALID;
    }

    return walkClassChain(cls, (ancestor) => resolveAncestorType(ancestor)) ?? TYPE_INVALID;
}

/**
 * Registers a GInterface, associating its GType with a mixin used to compose the
 * interface onto wrapper classes and, when introspection describes its vtable, that layout.
 * @param cls Class carrying the interface's GType tag.
 * @param type GType of the interface.
 * @param mixin Mixin that applies the interface to a wrapper class.
 * @param layout The interface's vtable struct, so `registerClass` can bind the slots an
 * implementing class overrides and take over the ones it leaves alone.
 */
function registerInterface(cls: AnyClass, type: bigint, mixin: Mixin, layout?: InterfaceLayout): void {
    if (type === TYPE_INVALID) {
        return;
    }

    setClassType(cls, type);
    interfaceMixinRegistry.set(type, mixin);

    if (layout) {
        interfaceLayoutRegistry.set(type, layout);
    }
}

/**
 * Wraps a native handle in a JS wrapper instance. With no class, resolves and
 * reuses the wrapper for the handle's runtime GType (composing interface mixins),
 * and hands back an instance that already carries a handle unchanged; with an
 * explicit class, creates a bare instance backed by the handle, of the subclass the
 * class's `registerWrapperClassResolver` resolver picks when it has one. Returns null
 * for a null or undefined handle.
 * @param handle Native handle to wrap.
 * @param cls Wrapper class to instantiate, or omitted to resolve it from the runtime type.
 */
function wrapHandle(handle: null | undefined, cls?: AnyClass): null;
function wrapHandle<T extends object>(handle: ExternalObject<Handle>, cls: AnyClass<T>): T;

function wrapHandle<T extends object>(
    handle: ExternalObject<Handle> | null | undefined,
    cls: AnyClass<T>,
): T | null;

function wrapHandle(handle: ExternalObject<Handle>, cls?: AnyClass): TypedClass;
function wrapHandle(handle: ExternalObject<Handle> | null | undefined, cls?: AnyClass): TypedClass | null;

function wrapHandle(handle: ExternalObject<Handle> | null | undefined, cls?: AnyClass): object | null {
    if (handle === null || handle === undefined) {
        return null;
    }

    if (cls === undefined) {
        return getOrCreateWrapper(handle);
    }

    const resolver = wrapperClassResolvers.get(cls);
    const instance: object = Object.create((resolver === undefined ? cls : resolver(handle)).prototype) as object;
    setHandle(instance, handle);

    return instance;
}

/**
 * Returns the wrapper class registered for a GType, walking up to ancestor types,
 * and throws if none is registered.
 */
function getWrapperClass(type: bigint): AnyClass {
    const cls = resolveWrapperClass(type);

    if (!cls) {
        throw new Error(`No registered wrapper class for type '${typeName(type) ?? String(type)}'`);
    }

    return cls;
}

function resolveWrapperClass(type: bigint): AnyClass | null {
    let currentType = type;

    while (currentType !== TYPE_INVALID) {
        const cls = classRegistry.get(currentType);

        if (cls) {
            return cls;
        }

        currentType = typeParent(currentType);
    }

    return null;
}

function getInterfaceMixin(type: bigint): Mixin | undefined {
    return interfaceMixinRegistry.get(type);
}

function applyInterfaceMixin(cls: AnyClass, type: bigint, baseType: bigint, applied: Set<bigint>): AnyClass {
    if (applied.has(type) || typeIsA(baseType, type)) {
        return cls;
    }

    const mixin = getInterfaceMixin(type);

    if (mixin === undefined) {
        return cls;
    }

    applied.add(type);

    return mixin(cls as AnyClass<MixinReceiver>);
}

function createComposedClass(base: AnyClass, runtimeType: bigint): AnyClass {
    const baseType = getClassType(base);
    const applied: Set<bigint> = new Set();
    let cls: AnyClass = base;

    for (const type of typeInterfaces(runtimeType)) {
        cls = applyInterfaceMixin(cls, type, baseType, applied);
    }

    return applied.size === 0 ? base : cls;
}

function resolveComposedClass(runtimeType: bigint): AnyClass | null {
    const exact = classRegistry.get(runtimeType);

    if (exact) {
        return exact;
    }

    const cached = composedClassRegistry.get(runtimeType);

    if (cached) {
        return cached;
    }

    const base = resolveWrapperClass(runtimeType);

    if (base === null) {
        return null;
    }

    const composed = createComposedClass(base, runtimeType);

    if (composed === base) {
        return base;
    }

    setClassType(composed, runtimeType);
    wrapperClasses.add(composed);
    composedClassRegistry.set(runtimeType, composed);

    return composed;
}

function wrapObject(value: unknown): object | null {
    return value == null ? null : getOrCreateWrapper(value as ExternalObject<Handle>);
}

function wrapCallScopedObject(value: unknown): object | null {
    return value == null ? null : wrapperFor(value as ExternalObject<Handle>, bindCallScopedWrapper);
}

function existingWrapperFor(handle: ExternalObject<Handle>): object | null {
    return handleMap.has(handle) ? handle : getWrapper(handle);
}

function createWrapper(handle: ExternalObject<Handle>): object {
    const runtimeType: bigint = getType(handle);

    if (runtimeType === TYPE_INVALID) {
        throw new Error("Cannot resolve runtime GLib type from handle");
    }

    const cls = resolveComposedClass(runtimeType);

    if (!cls) {
        throw new Error(`Expected registered GLib type, got type ${String(runtimeType)}`);
    }

    return Object.create(cls.prototype) as object;
}

function wrapperFor(handle: ExternalObject<Handle>, bind: WrapperBinding): object {
    const existing = existingWrapperFor(handle);

    if (existing) {
        return existing;
    }

    const instance = createWrapper(handle);
    bind(handle, instance);

    return instance;
}

function getOrCreateWrapper(handle: ExternalObject<Handle>): object {
    return wrapperFor(handle, registerWrapper);
}

function instanceClassName(instance: object): string {
    return (instance as { constructor?: { name?: string } }).constructor?.name ?? "object";
}

function describeValueKind(value: unknown): string {
    if (value === null) {
        return "null";
    }

    if (typeof value !== "object") {
        return typeof value;
    }

    return instanceClassName(value);
}

/** Returns the native handle bound to a wrapper instance, throwing if none is set. */
function getHandle(instance: object): ExternalObject<Handle> {
    const handle = handleMap.get(instance);

    if (handle === undefined) {
        throw new Error(`No native handle associated with ${instanceClassName(instance)}`);
    }

    return handle;
}

/** Associates a native handle with a wrapper instance. */
function setHandle(instance: object, handle: ExternalObject<Handle>): void {
    handleMap.set(instance, handle);
}

function bindCallScopedWrapper(handle: ExternalObject<Handle>, instance: object): void {
    setHandle(instance, handle);
}

function registerWrapper(handle: ExternalObject<Handle>, instance: object): void {
    setHandle(instance, handle);
    setWrapper(handle, instance);
}

function registerVfuncRegistry(cls: object, registry: VfuncRegistry): void {
    vfuncRegistry.set(cls, registry);
}

function getVfuncRegistry(cls: object): VfuncRegistry | undefined {
    return vfuncRegistry.get(cls);
}

function getInterfaceVfuncRegistry(type: bigint): VfuncRegistry | undefined {
    return interfaceLayoutRegistry.get(type)?.vfuncs;
}

function getInterfaceProperties(type: bigint): Record<string, InterfaceProperty> | undefined {
    return interfaceLayoutRegistry.get(type)?.properties;
}

export {
    describeValueKind,
    getClassType,
    getInstanceType,
    markDerivedClass,
    registerClassType,
    registerWrapperClass,
    registerWrapperClassResolver,
    registerInterface,
    wrapHandle,
    getWrapperClass,
    resolveWrapperClass,
    getHandle,
    setHandle,
    getVfuncRegistry,
    getInterfaceMixin,
    getInterfaceProperties,
    getInterfaceVfuncRegistry,
    instanceClassName,
    registerWrapper,
    resolveWrapperType,
    wrapCallScopedObject,
    wrapObject,
    type InterfaceProperty,
    type StaticBase,
    type VfuncDescriptor,
    type WrapperClassResolver,
};
