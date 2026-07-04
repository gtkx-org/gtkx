import {
    type ExternalObject,
    getType,
    getWrapper,
    type Handle,
    type RegisterClassVfunc as NativeRegisterClassVfunc,
    setWrapper,
} from "@gtkx/native";
import type { AnyClass, Mixin } from "@gtkx/utils";
import { TYPE_INVALID, type TypedClass, typeInterfaces, typeIsA, typeName, typeParent } from "./type.js";

export type VfuncDescriptor<K extends "class" | "interface"> = {
    kind: K;
    className: string;
    vfuncName: string;
    byteOffset: number;
    argDescriptors: NativeRegisterClassVfunc["argDescriptors"];
    returnDescriptor: NativeRegisterClassVfunc["returnDescriptor"];
};

export type VfuncRegistry = Record<string, VfuncDescriptor<"class"> | VfuncDescriptor<"interface">>;

const classRegistry = new Map<bigint, AnyClass>();
const interfaceMixinRegistry = new Map<bigint, Mixin>();
const composedClassRegistry = new Map<bigint, AnyClass>();
const handleMap = new WeakMap<object, ExternalObject<Handle>>();
const vfuncRegistry = new WeakMap<object, VfuncRegistry>();
const interfaceVfuncRegistry = new Map<bigint, VfuncRegistry>();

function setClassType(cls: AnyClass, type: bigint): void {
    (cls.prototype as { [K in keyof TypedClass]: TypedClass[K] }).__type__ = type;
}

export function getClassType(cls: AnyClass): bigint {
    const proto: object = cls.prototype;
    return Object.hasOwn(proto, "__type__") ? (proto as TypedClass).__type__ : TYPE_INVALID;
}

export function getInstanceType(instance: object): bigint {
    return getClassType(instance.constructor as AnyClass);
}

export function registerClassType(cls: AnyClass, type: bigint): void {
    if (type !== TYPE_INVALID) {
        classRegistry.set(type, cls);
        setClassType(cls, type);
    }
}

export function registerWrapperClass(cls: AnyClass, type: bigint, vfuncs?: VfuncRegistry): void {
    registerClassType(cls, type);
    if (vfuncs) registerVfuncRegistry(cls, vfuncs);
}

export function registerInterface(cls: AnyClass, type: bigint, mixin: Mixin, vfuncs?: VfuncRegistry): void {
    if (type === TYPE_INVALID) return;
    setClassType(cls, type);
    interfaceMixinRegistry.set(type, mixin);
    if (vfuncs) registerInterfaceVfuncRegistry(type, vfuncs);
}

export function wrapHandle(handle: null | undefined, cls?: AnyClass): null;
export function wrapHandle<T extends object>(handle: ExternalObject<Handle>, cls: AnyClass<T>): T;
export function wrapHandle<T extends object>(
    handle: ExternalObject<Handle> | null | undefined,
    cls: AnyClass<T>,
): T | null;
export function wrapHandle<T extends object = TypedClass>(handle: ExternalObject<Handle>, cls?: AnyClass): T;
export function wrapHandle<T extends object = TypedClass>(
    handle: ExternalObject<Handle> | null | undefined,
    cls?: AnyClass,
): T | null;
export function wrapHandle(handle: ExternalObject<Handle> | null | undefined, cls?: AnyClass): object | null {
    if (handle === null || handle === undefined) return null;
    if (cls === undefined) {
        return getOrCreateWrapper(handle);
    }
    const instance: object = Object.create(cls.prototype);
    setHandle(instance, handle);
    return instance;
}

export function getWrapperClass(type: bigint): AnyClass {
    const cls = resolveWrapperClass(type);
    if (!cls) {
        throw new Error(`No registered wrapper class for type '${typeName(type) ?? String(type)}'`);
    }
    return cls;
}

export function resolveWrapperClass(type: bigint): AnyClass | null {
    let currentType = type;
    while (currentType !== TYPE_INVALID) {
        const cls = classRegistry.get(currentType);
        if (cls) return cls;
        currentType = typeParent(currentType);
    }
    return null;
}

function createComposedClass(base: AnyClass, runtimeType: bigint): AnyClass {
    const baseType = getClassType(base);
    const applied = new Set<bigint>();
    let cls: AnyClass = base;
    for (const type of typeInterfaces(runtimeType)) {
        if (applied.has(type) || typeIsA(baseType, type)) continue;
        const mixin = interfaceMixinRegistry.get(type);
        if (mixin === undefined) continue;
        applied.add(type);
        cls = mixin(cls);
    }
    return applied.size === 0 ? base : cls;
}

function resolveComposedClass(runtimeType: bigint): AnyClass | null {
    const exact = classRegistry.get(runtimeType);
    if (exact) return exact;
    const cached = composedClassRegistry.get(runtimeType);
    if (cached) return cached;
    const base = resolveWrapperClass(runtimeType);
    if (base === null) return null;
    const composed = createComposedClass(base, runtimeType);
    if (composed === base) return base;
    setClassType(composed, runtimeType);
    composedClassRegistry.set(runtimeType, composed);
    return composed;
}

function getOrCreateWrapper(handle: ExternalObject<Handle>): object {
    const existing = getWrapper(handle);
    if (existing) return existing;

    const runtimeType: bigint = getType(handle);
    if (runtimeType === TYPE_INVALID) {
        throw new Error("Cannot resolve runtime GLib type from handle");
    }

    const cls = resolveComposedClass(runtimeType);
    if (!cls) throw new Error(`Expected registered GLib type, got type ${String(runtimeType)}`);
    const instance: object = Object.create(cls.prototype);
    registerWrapper(handle, instance);
    return instance;
}

export function getHandle(instance: object): ExternalObject<Handle> {
    const handle = handleMap.get(instance);
    if (handle === undefined) {
        const name = (instance as { constructor?: { name?: string } }).constructor?.name ?? "object";
        throw new Error(`No native handle associated with ${name}`);
    }
    return handle;
}

export function tryGetHandle(instance: object | null | undefined): ExternalObject<Handle> | undefined {
    return instance == null ? undefined : handleMap.get(instance);
}

export function setHandle(instance: object, handle: ExternalObject<Handle>): void {
    handleMap.set(instance, handle);
}

function registerWrapper(handle: ExternalObject<Handle>, instance: object): void {
    setHandle(instance, handle);
    setWrapper(handle, instance);
}

function registerVfuncRegistry(cls: object, registry: VfuncRegistry): void {
    vfuncRegistry.set(cls, registry);
}

export function getVfuncRegistry(cls: object): VfuncRegistry | undefined {
    return vfuncRegistry.get(cls);
}

function registerInterfaceVfuncRegistry(type: bigint, registry: VfuncRegistry): void {
    if (type === TYPE_INVALID) return;
    interfaceVfuncRegistry.set(type, registry);
}

export function getInterfaceVfuncRegistry(type: bigint): VfuncRegistry | undefined {
    return interfaceVfuncRegistry.get(type);
}
