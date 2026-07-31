import type { AnyClass } from "@gtkx/utils";
import {
    type ExternalObject,
    getType,
    getWrapper,
    type Handle,
    type RegisterClassVfunc as NativeRegisterClassVfunc,
    setWrapper,
} from "@gtkx/native";
import type { Mixin, MixinReceiver } from "./mixin.js";
import { TYPE_INVALID, type TypedClass, typeInterfaces, typeIsA, typeName, typeParent } from "./type.js";

/**
 * Static side of class `C` with its construct signature preserved but the member
 * named `K` (default `"new"`) removed.
 */
type StaticBase<C, K extends PropertyKey = "new"> = Omit<C, K> &
    (C extends new (...args: infer A) => infer R ? new (...args: A) => R : never);

/** One overridable vtable slot: where it sits in the vtable struct and how it is marshalled. */
type VfuncDescriptor<K extends "class" | "interface"> = {
    /** Whether the slot lives in a class struct or in an interface vtable. */
    kind: K;
    /** GIR name of the type struct holding the slot, without its namespace, such as `WidgetClass`. */
    className: string;
    /** Name of the slot's field in that struct. */
    vfuncName: string;
    /** Byte offset of the slot within the struct. */
    byteOffset: number;
    /** Byte size of the struct, used to bounds-check `VfuncDescriptor.byteOffset`. */
    vtableSize: number;
    /** Descriptor for each argument the slot receives, starting with the instance. */
    argDescriptors: NativeRegisterClassVfunc["argDescriptors"];
    /** Descriptor for the value the slot returns. */
    returnDescriptor: NativeRegisterClassVfunc["returnDescriptor"];
};

/**
 * The vtable slots a wrapper class or interface exposes, keyed by the JavaScript method name that
 * overrides each one.
 */
type VfuncRegistry = Record<string, VfuncDescriptor<"class"> | VfuncDescriptor<"interface">>;

const classRegistry: Map<bigint, AnyClass> = new Map();
const interfaceMixinRegistry: Map<bigint, Mixin> = new Map();
const composedClassRegistry: Map<bigint, AnyClass> = new Map();
const handleMap: WeakMap<object, ExternalObject<Handle>> = new WeakMap();
const vfuncRegistry: WeakMap<object, VfuncRegistry> = new WeakMap();
const interfaceVfuncRegistry: Map<bigint, VfuncRegistry> = new Map();

function setClassType(cls: AnyClass, type: bigint): void {
    (cls.prototype as { [K in keyof TypedClass]: TypedClass[K] }).__type__ = type;
}

function getClassType(cls: AnyClass): bigint {
    const proto: object = cls.prototype;

    return Object.hasOwn(proto, "__type__") ? (proto as TypedClass).__type__ : TYPE_INVALID;
}

/** Returns the GType tag of the given wrapper instance. */
function getInstanceType(instance: object): bigint {
    return getClassType(instance.constructor as AnyClass);
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

    if (vfuncs) {
        registerVfuncRegistry(cls, vfuncs);
    }
}

/**
 * Registers a GInterface, associating its GType with a mixin used to compose the
 * interface onto wrapper classes and an optional virtual function registry.
 * @param cls Class carrying the interface's GType tag.
 * @param type GType of the interface.
 * @param mixin Mixin that applies the interface to a wrapper class.
 * @param vfuncs Vtable slots the interface exposes, so `registerClass` can bind the ones an
 * implementing class overrides.
 */
function registerInterface(cls: AnyClass, type: bigint, mixin: Mixin, vfuncs?: VfuncRegistry): void {
    if (type === TYPE_INVALID) {
        return;
    }

    setClassType(cls, type);
    interfaceMixinRegistry.set(type, mixin);

    if (vfuncs) {
        registerInterfaceVfuncRegistry(type, vfuncs);
    }
}

/**
 * Wraps a native handle in a JS wrapper instance. With no class, resolves and
 * reuses the wrapper for the handle's runtime GType (composing interface mixins);
 * with an explicit class, creates a bare instance backed by the handle. Returns
 * null for a null or undefined handle.
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

    const instance: object = Object.create(cls.prototype) as object;
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

function applyInterfaceMixin(cls: AnyClass, type: bigint, baseType: bigint, applied: Set<bigint>): AnyClass {
    if (applied.has(type) || typeIsA(baseType, type)) {
        return cls;
    }

    const mixin = interfaceMixinRegistry.get(type);

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
    composedClassRegistry.set(runtimeType, composed);

    return composed;
}

function getOrCreateWrapper(handle: ExternalObject<Handle>): object {
    const existing = getWrapper(handle);

    if (existing) {
        return existing;
    }

    const runtimeType: bigint = getType(handle);

    if (runtimeType === TYPE_INVALID) {
        throw new Error("Cannot resolve runtime GLib type from handle");
    }

    const cls = resolveComposedClass(runtimeType);

    if (!cls) {
        throw new Error(`Expected registered GLib type, got type ${String(runtimeType)}`);
    }

    const instance: object = Object.create(cls.prototype) as object;
    registerWrapper(handle, instance);

    return instance;
}

/** Returns the native handle bound to a wrapper instance, throwing if none is set. */
function getHandle(instance: object): ExternalObject<Handle> {
    const handle = handleMap.get(instance);

    if (handle === undefined) {
        const name = (instance as { constructor?: { name?: string } }).constructor?.name ?? "object";
        throw new Error(`No native handle associated with ${name}`);
    }

    return handle;
}

/** Returns the native handle bound to an instance, or undefined when there is none or the instance is null. */
function tryGetHandle(instance: object | null | undefined): ExternalObject<Handle> | undefined {
    return instance == null ? undefined : handleMap.get(instance);
}

/** Associates a native handle with a wrapper instance. */
function setHandle(instance: object, handle: ExternalObject<Handle>): void {
    handleMap.set(instance, handle);
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

function registerInterfaceVfuncRegistry(type: bigint, registry: VfuncRegistry): void {
    if (type === TYPE_INVALID) {
        return;
    }

    interfaceVfuncRegistry.set(type, registry);
}

function getInterfaceVfuncRegistry(type: bigint): VfuncRegistry | undefined {
    return interfaceVfuncRegistry.get(type);
}

export {
    getClassType,
    getInstanceType,
    registerClassType,
    registerWrapperClass,
    registerInterface,
    wrapHandle,
    getWrapperClass,
    resolveWrapperClass,
    getHandle,
    tryGetHandle,
    setHandle,
    getVfuncRegistry,
    getInterfaceVfuncRegistry,
    type StaticBase,
    type VfuncDescriptor,
    type VfuncRegistry,
};
