import {
    getType,
    getWrapper,
    type Handle,
    type RegisterClassVfunc as NativeRegisterClassVfunc,
    setWrapper,
} from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { type GTyped, TYPE_INVALID, typeFromName, typeInterfaces, typeIsA, typeName, typeParent } from "./gtype.js";
import type { Mixin } from "./mixin.js";

const classRegistry = new Map<bigint, AnyClass>();

function stampGtype(cls: AnyClass, gtype: bigint): void {
    (cls.prototype as { [K in keyof GTyped]: GTyped[K] }).__gtype__ = gtype;
}

function ownStampedGtype(cls: AnyClass): bigint {
    const proto: object = cls.prototype;
    return Object.hasOwn(proto, "__gtype__") ? (proto as GTyped).__gtype__ : TYPE_INVALID;
}

export function setClassGtype(cls: AnyClass, gtype: bigint): void {
    if (gtype !== TYPE_INVALID) {
        classRegistry.set(gtype, cls);
        stampGtype(cls, gtype);
    }
}

export function registerWrapperClass(cls: AnyClass, gtype: bigint, vfuncs?: VfuncRegistry): void {
    setClassGtype(cls, gtype);
    if (vfuncs) registerVfuncRegistry(cls, vfuncs);
}

const interfaceMixinByGtype = new Map<bigint, Mixin>();
const composedClassByGtype = new Map<bigint, AnyClass>();

export function registerInterface(cls: AnyClass, gtype: bigint, mixin: Mixin, vfuncs?: VfuncRegistry): void {
    if (gtype === TYPE_INVALID) return;
    stampGtype(cls, gtype);
    interfaceMixinByGtype.set(gtype, mixin);
    if (vfuncs) registerInterfaceVfuncRegistry(gtype, vfuncs);
}

export function getClassGtype(cls: AnyClass): bigint {
    return ownStampedGtype(cls);
}

export function getInstanceGtype(instance: object): bigint {
    return getClassGtype(instance.constructor as AnyClass);
}

function instantiate<T extends object>(cls: AnyClass<T>, handle: Handle): T {
    const instance = Object.create(cls.prototype) as T;
    setHandle(instance, handle);
    return instance;
}

export function wrapHandle<T extends object>(handle: Handle, cls: AnyClass<T>): T;
export function wrapHandle<T extends object>(handle: Handle | null | undefined, cls: AnyClass<T>): T | null;
export function wrapHandle(handle: null | undefined, cls?: AnyClass): null;
export function wrapHandle<T extends object = GTyped>(handle: Handle, cls?: AnyClass): T;
export function wrapHandle<T extends object = GTyped>(handle: Handle | null | undefined, cls?: AnyClass): T | null;
export function wrapHandle(handle: Handle | null | undefined, cls?: AnyClass): object | null {
    if (handle === null || handle === undefined) return null;
    if (cls === undefined) {
        return resolveWrapper(handle);
    }
    return instantiate(cls, handle);
}

export function getWrapperClass(gtype: bigint): AnyClass | null {
    return classRegistry.get(gtype) ?? null;
}

export function requireWrapperClass(gtype: bigint): AnyClass {
    const cls = getWrapperClass(gtype);
    if (!cls) {
        throw new Error(`No registered wrapper class for GType '${typeName(gtype) ?? String(gtype)}'`);
    }
    return cls;
}

export function getWrapperClassByName(name: string): AnyClass<GTyped> | null {
    return getWrapperClass(typeFromName(name)) as AnyClass<GTyped> | null;
}

export function requireWrapperClassByName(name: string, describe: (name: string) => string): AnyClass<GTyped> {
    const cls = getWrapperClassByName(name);
    if (!cls) throw new Error(describe(name));
    return cls;
}

export function constructWrapper(cls: AnyClass<GTyped>, props: Record<string, unknown>): GTyped {
    return new (cls as new (props: Record<string, unknown>) => GTyped)(props);
}

export function findWrapperClassInChain(gtype: bigint): AnyClass | null {
    const direct = getWrapperClass(gtype);
    if (direct) return direct;
    let currentGtype = gtype;
    while (currentGtype !== TYPE_INVALID) {
        const parentGtype = typeParent(currentGtype);
        if (parentGtype === TYPE_INVALID) break;
        const parentCls = getWrapperClass(parentGtype);
        if (parentCls) return parentCls;
        currentGtype = parentGtype;
    }

    return null;
}

function composeInterfaces(base: AnyClass, runtimeGtype: bigint): AnyClass {
    const baseGtype = getClassGtype(base);
    const applied = new Set<bigint>();
    let cls: AnyClass = base;
    for (const gtype of typeInterfaces(runtimeGtype)) {
        if (applied.has(gtype) || typeIsA(baseGtype, gtype)) continue;
        const mixin = interfaceMixinByGtype.get(gtype);
        if (mixin === undefined) continue;
        applied.add(gtype);
        cls = mixin(cls);
    }
    return applied.size === 0 ? base : cls;
}

function resolveComposedClass(runtimeGtype: bigint): AnyClass | null {
    const exact = getWrapperClass(runtimeGtype);
    if (exact) return exact;
    const cached = composedClassByGtype.get(runtimeGtype);
    if (cached) return cached;
    const base = findWrapperClassInChain(runtimeGtype);
    if (base === null) return null;
    const composed = composeInterfaces(base, runtimeGtype);
    if (composed === base) return base;
    stampGtype(composed, runtimeGtype);
    composedClassByGtype.set(runtimeGtype, composed);
    return composed;
}

function resolveWrapper(handle: Handle): object {
    const existing = getWrapper(handle);
    if (existing) return existing;

    const runtimeGtype: bigint = getType(handle);
    if (runtimeGtype === TYPE_INVALID) {
        throw new Error("Cannot resolve runtime GLib type from handle");
    }

    const cls = resolveComposedClass(runtimeGtype);
    if (!cls) throw new Error(`Expected registered GLib type, got gtype ${String(runtimeGtype)}`);
    const instance = Object.create(cls.prototype) as GTyped;
    linkGObjectWrapper(handle, instance);
    return instance;
}

export function getParentClass(cls: AnyClass): AnyClass | null {
    const parent: unknown = Object.getPrototypeOf(cls);
    return typeof parent === "function" && parent !== Function.prototype ? (parent as AnyClass) : null;
}

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

export function getHandle(instance: object): Handle {
    const handle = handleMap.get(instance);
    if (handle === undefined) {
        const name = (instance as { constructor?: { name?: string } }).constructor?.name ?? "object";
        throw new Error(`No native handle associated with ${name}`);
    }
    return handle;
}

export function tryGetHandle(instance: object | null | undefined): Handle | undefined {
    return instance == null ? undefined : handleMap.get(instance);
}

export function setHandle(instance: object, handle: Handle): void {
    handleMap.set(instance, handle);
}

function linkGObjectWrapper(handle: Handle, instance: object): void {
    setHandle(instance, handle);
    setWrapper(handle, instance);
}

export type VfuncDescriptor<K extends "class" | "interface"> = {
    kind: K;
    className: string;
    vfuncName: string;
    byteOffset: number;
    argDescriptors: NativeRegisterClassVfunc["argDescriptors"];
    returnDescriptor: NativeRegisterClassVfunc["returnDescriptor"];
};

type VfuncRegistry = Record<string, VfuncDescriptor<"class"> | VfuncDescriptor<"interface">>;

const vfuncRegistryByClass = new WeakMap<object, VfuncRegistry>();

function registerVfuncRegistry(cls: object, registry: VfuncRegistry): void {
    vfuncRegistryByClass.set(cls, registry);
}

export function getVfuncRegistry(cls: object): VfuncRegistry | undefined {
    return vfuncRegistryByClass.get(cls);
}

const interfaceVfuncRegistryByGtype = new Map<bigint, VfuncRegistry>();

function registerInterfaceVfuncRegistry(gtype: bigint, vfuncRegistry: VfuncRegistry): void {
    if (gtype === TYPE_INVALID) return;
    interfaceVfuncRegistryByGtype.set(gtype, vfuncRegistry);
}

export function getInterfaceVfuncRegistry(gtype: bigint): VfuncRegistry | undefined {
    return interfaceVfuncRegistryByGtype.get(gtype);
}
