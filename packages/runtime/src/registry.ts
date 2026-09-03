import {
    type ExternalObject,
    getFundamentalWrapper,
    getType,
    getTypeClass,
    getWrapper,
    type Handle,
    type RegisterClassVfunc as NativeRegisterClassVfunc,
    setFundamentalWrapper,
    setWrapper,
} from "@gtkx/native";
import { type AnyClass, walkClassChain } from "@gtkx/utils";
import { copyLayerMembers, createMixinLayer, installMixins, type Mixin, type MixinReceiver } from "./mixin.js";
import {
    TYPE_INVALID,
    TYPE_OBJECT,
    type TypedClass,
    typeFundamental,
    typeInterfaces,
    typeIsA,
    typeName,
    typeParent,
} from "./type.js";

/**
 * Static side of class `C` with its construct signature preserved but the members named `K`
 * removed. A generated class lists every static it declares itself, so a static it narrows never
 * has to stay assignable to the one it shadows. The signature is kept abstract so an abstract `C`
 * survives it: a subclass extends the result, and only the subclass's own declarations decide
 * which statics reach it.
 */
type StaticBase<C, K extends PropertyKey> = Omit<C, K> &
    (C extends abstract new (...args: infer A) => infer R ? abstract new (...args: A) => R : never);

/**
 * Static side of class `C` with its construct signature retargeted to produce `I`. A generated
 * wrapper class is declared locally and exported as a registered constant; its instance type is
 * exported as an interface extending the local class so declaration merging and module
 * augmentation keep working, and this type makes constructing the constant produce that interface.
 */
type WrapperClass<C, I> = Omit<C, "prototype"> & {
    /** Prototype retyped to the exported instance interface, so `instanceof` narrows to it. */
    prototype: I;
} &
(C extends new (...args: infer A) => unknown
    ? new (...args: A) => I
    : C extends abstract new (...args: infer A) => unknown
        ? abstract new (...args: A) => I
        : never);

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
const classStructRegistry: Map<bigint, AnyClass> = new Map();
const composedClassStructRegistry: Map<bigint, AnyClass> = new Map();
const interfaceMixinRegistry: Map<bigint, Mixin> = new Map();
const composedClassRegistry: Map<bigint, AnyClass> = new Map();
const handleMap: WeakMap<object, ExternalObject<Handle>> = new WeakMap();
const vfuncRegistry: WeakMap<object, VfuncRegistry> = new WeakMap();
const interfaceLayoutRegistry: Map<bigint, InterfaceLayout> = new Map();
const wrapperClasses: WeakSet<AnyClass> = new WeakSet();
const derivedClasses: WeakSet<AnyClass> = new WeakSet();
const typeClassHandles: Map<bigint, ExternalObject<Handle>> = new Map();
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

function coerceGType(value: unknown): unknown {
    if (typeof value !== "function") {
        return value;
    }

    const type = getClassType(value as AnyClass);

    return type === TYPE_INVALID ? value : type;
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

/**
 * Registers the wrapper class of a type's class struct, such as `Gtk.WidgetClass` for `Gtk.Widget`,
 * so `registerClass` can hand a `classInit` hook the new type's class struct wrapped in it.
 * @param cls Wrapper class of the type's instances, already registered through
 * `registerWrapperClass`.
 * @param structClass Wrapper class of the type's class struct.
 */
function registerClassStruct(cls: AnyClass, structClass: AnyClass): void {
    const type = getClassType(cls);

    if (type !== TYPE_INVALID) {
        classStructRegistry.set(type, structClass);
    }
}

function collectClassStructClasses(type: bigint): AnyClass[] {
    const structs: AnyClass[] = [];
    let current = type;

    while (current !== TYPE_INVALID) {
        const structClass = classStructRegistry.get(current);

        if (structClass !== undefined) {
            structs.push(structClass);
        }

        current = typeParent(current);
    }

    return structs;
}

function composeClassStructClass(structs: AnyClass[]): AnyClass | undefined {
    const [nearest, ...ancestors] = structs;

    if (nearest === undefined || ancestors.length === 0) {
        return nearest;
    }

    const composed: AnyClass = class extends nearest {};
    Object.defineProperty(composed, "name", { value: nearest.name });

    for (const structClass of ancestors) {
        copyLayerMembers(composed, structClass.prototype);
    }

    return composed;
}

function getClassStructClass(type: bigint): AnyClass | undefined {
    const cached = composedClassStructRegistry.get(type);

    if (cached !== undefined) {
        return cached;
    }

    const composed = composeClassStructClass(collectClassStructClasses(type));

    if (composed !== undefined) {
        composedClassStructRegistry.set(type, composed);
    }

    return composed;
}

function peekedTypeLabel(type: bigint | AnyClass, gtype: bigint): string {
    const name = typeName(gtype);

    if (name !== null) {
        return name;
    }

    return typeof type === "bigint" ? String(type) : type.name;
}

function getTypeClassHandle(gtype: bigint): ExternalObject<Handle> {
    const cached = typeClassHandles.get(gtype);

    if (cached !== undefined) {
        return cached;
    }

    const handle = getTypeClass(gtype);
    typeClassHandles.set(gtype, handle);

    return handle;
}

/**
 * Returns a GObject type's class struct, wrapped in the class-struct wrapper classes registered
 * for the type's ancestry, such as `Gtk.WidgetClass` composed with `GObject.ObjectClass` for a
 * widget type. The class is referenced so it exists even before the type's first instance, and
 * the reference is deliberately never released: once created, a class struct lives for the rest
 * of the process. Backs the `peek` statics of generated GTypeStruct wrappers, such as
 * `GObject.ObjectClass.peek` and `Gtk.WidgetClass.peek`.
 *
 * @param type GType to peek the class struct of, or a registered wrapper class of the type.
 * @param base When given, wrapper class of the type the peeked type must derive from; the peek
 * throws for a type outside that lineage. Without it any GObject type is accepted.
 * @returns The wrapped class struct.
 */
function peekTypeClass(type: bigint | AnyClass, base?: AnyClass): object {
    const gtype = typeof type === "bigint" ? type : getClassType(type);

    if (!typeIsA(gtype, TYPE_OBJECT)) {
        throw new TypeError(`peekTypeClass: '${peekedTypeLabel(type, gtype)}' is not a GObject type`);
    }

    if (base !== undefined && !typeIsA(gtype, getClassType(base))) {
        throw new TypeError(`peekTypeClass: '${peekedTypeLabel(type, gtype)}' does not derive from '${base.name}'`);
    }

    const structClass = getClassStructClass(gtype);

    if (structClass === undefined) {
        throw new TypeError(
            `peekTypeClass: no ancestor of '${peekedTypeLabel(type, gtype)}' registers a class struct wrapper`,
        );
    }

    return wrapHandle(getTypeClassHandle(gtype), structClass);
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
 * Copies the members of registered interfaces onto a wrapper class, resolving each interface's
 * mixin through the registry rather than taking the mixin itself, so a class states which
 * interfaces it implements by referencing their classes. The interfaces must already be
 * registered through `registerInterface`; generated code guarantees that by declaring interfaces
 * ahead of the classes that implement them.
 *
 * @param cls Wrapper class adopting the interfaces.
 * @param interfaces Registered interface classes to adopt, in order.
 * @throws If an entry is not a registered interface.
 */
function installInterfaces(cls: AnyClass, interfaces: AnyClass[], inheritedOverrides: string[] = []): void {
    const mixins = interfaces.map((iface) => {
        const mixin = getInterfaceMixin(getClassType(iface));

        if (mixin === undefined) {
            throw new Error(`installInterfaces: ${iface.name} is not a registered interface`);
        }

        return mixin;
    });

    installMixins(cls, mixins, inheritedOverrides);
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

function wrapFundamentalHandle(handle: ExternalObject<Handle> | null | undefined, cls: AnyClass): object | null {
    if (handle === null || handle === undefined) {
        return null;
    }

    const existing = getFundamentalWrapper(handle);

    if (existing) {
        return existing;
    }

    const instance: object = Object.create(cls.prototype) as object;
    setHandle(instance, handle);
    setFundamentalWrapper(handle, instance);

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

function getExactWrapperClass(type: bigint, label?: string): AnyClass {
    if (type === TYPE_INVALID) {
        throw new Error(`No GType is registered under '${label ?? String(type)}'`);
    }

    const cls = classRegistry.get(type);

    if (cls === undefined) {
        throw new Error(
            `No wrapper class is registered for '${label ?? typeName(type) ?? String(type)}': ` +
            "its module was dropped from the bundle or never imported",
        );
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

    return createMixinLayer(cls as AnyClass<MixinReceiver>, mixin, new Set());
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

function isWrappableBase(fallbackType: bigint): boolean {
    return fallbackType === TYPE_INVALID || typeFundamental(fallbackType) === TYPE_OBJECT;
}

function isBetweenWalkAndRuntime(fallbackType: bigint, walkedType: bigint, runtimeType: bigint): boolean {
    return fallbackType !== walkedType && typeIsA(fallbackType, walkedType) && typeIsA(runtimeType, fallbackType);
}

function chooseWrapBase(walked: AnyClass | null, fallback: AnyClass | undefined, runtimeType: bigint): AnyClass | null {
    if (fallback === undefined || !isWrappableBase(getClassType(fallback))) {
        return walked;
    }

    if (walked === null || isBetweenWalkAndRuntime(getClassType(fallback), getClassType(walked), runtimeType)) {
        return fallback;
    }

    return walked;
}

function stampComposedClass(composed: AnyClass, runtimeType: bigint): AnyClass {
    setClassType(composed, runtimeType);
    wrapperClasses.add(composed);
    composedClassRegistry.set(runtimeType, composed);

    return composed;
}

function resolveComposedClass(runtimeType: bigint, fallbackClass?: () => AnyClass): AnyClass | null {
    const exact = classRegistry.get(runtimeType);

    if (exact) {
        return exact;
    }

    const cached = composedClassRegistry.get(runtimeType);

    if (cached) {
        return cached;
    }

    const walked = resolveWrapperClass(runtimeType);
    const base = chooseWrapBase(walked, fallbackClass?.(), runtimeType);

    if (base === null) {
        return null;
    }

    const composed = createComposedClass(base, runtimeType);

    if (composed !== base) {
        return stampComposedClass(composed, runtimeType);
    }

    if (base === walked) {
        return base;
    }

    return stampComposedClass(class extends base {}, runtimeType);
}

function wrapObject(value: unknown, fallbackClass?: () => AnyClass): object | null {
    return value == null ? null : getOrCreateWrapper(value as ExternalObject<Handle>, fallbackClass);
}

function wrapCallScopedObject(value: unknown, fallbackClass?: () => AnyClass): object | null {
    return value == null ? null : wrapperFor(value as ExternalObject<Handle>, bindCallScopedWrapper, fallbackClass);
}

function existingWrapperFor(handle: ExternalObject<Handle>): object | null {
    return handleMap.has(handle) ? handle : getWrapper(handle);
}

function createWrapper(handle: ExternalObject<Handle>, fallbackClass?: () => AnyClass): object {
    const runtimeType: bigint = getType(handle);

    if (runtimeType === TYPE_INVALID) {
        throw new Error("Cannot resolve runtime GLib type from handle");
    }

    const cls = resolveComposedClass(runtimeType, fallbackClass);

    if (!cls) {
        throw new Error(`Expected registered GLib type, got type ${String(runtimeType)}`);
    }

    return Object.create(cls.prototype) as object;
}

function wrapperFor(handle: ExternalObject<Handle>, bind: WrapperBinding, fallbackClass?: () => AnyClass): object {
    const existing = existingWrapperFor(handle);

    if (existing) {
        return existing;
    }

    const instance = createWrapper(handle, fallbackClass);
    bind(handle, instance);

    return instance;
}

function getOrCreateWrapper(handle: ExternalObject<Handle>, fallbackClass?: () => AnyClass): object {
    return wrapperFor(handle, registerWrapper, fallbackClass);
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
    coerceGType,
    describeValueKind,
    getClassStructClass,
    getClassType,
    getInstanceType,
    getTypeClassHandle,
    markDerivedClass,
    peekTypeClass,
    registerClassStruct,
    registerClassType,
    registerWrapperClass,
    registerWrapperClassResolver,
    registerInterface,
    installInterfaces,
    wrapFundamentalHandle,
    wrapHandle,
    getExactWrapperClass,
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
    type WrapperClass,
    type WrapperClassResolver,
};
