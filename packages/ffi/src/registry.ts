import {
    getType,
    getWrapper,
    type Handle,
    type RegisterClassVfunc as NativeRegisterClassVfunc,
    setWrapper,
} from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import {
    type GType,
    type GTyped,
    TYPE_INTERFACE,
    TYPE_INVALID,
    typeFromName,
    typeFundamental,
    typeIsA,
    typeName,
    typeParent,
} from "./gtype.js";

let gobjectGtype: GType = TYPE_INVALID;

function isGobjectType(gtype: GType): boolean {
    if (gobjectGtype === TYPE_INVALID) {
        gobjectGtype = typeFromName("GObject");
    }
    return gobjectGtype !== TYPE_INVALID && typeIsA(gtype, gobjectGtype);
}

const classRegistry = new Map<GType, AnyClass>();

function stampGtype(cls: AnyClass, gtype: GType): void {
    (cls.prototype as { [K in keyof GTyped]: GTyped[K] }).__gtype__ = gtype;
}

function ownStampedGtype(cls: AnyClass): GType {
    const proto: object = cls.prototype;
    return Object.hasOwn(proto, "__gtype__") ? (proto as GTyped).__gtype__ : TYPE_INVALID;
}

export function setClassGtype(cls: AnyClass, gtype: GType): void {
    if (gtype !== TYPE_INVALID) {
        classRegistry.set(gtype, cls);
        stampGtype(cls, gtype);
    }
}

export function registerWrapperClass(cls: AnyClass, gtype: GType, vfuncs?: VfuncRegistry): void {
    setClassGtype(cls, gtype);
    if (vfuncs) {
        registerVfuncRegistry(cls, vfuncs);
        if (typeFundamental(gtype) === TYPE_INTERFACE) {
            registerInterfaceVfuncRegistry(gtype, vfuncs);
        }
    }
}

export function getClassGtype(cls: AnyClass): GType {
    return ownStampedGtype(cls);
}

export function getInstanceGtype(instance: object): GType {
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
        return resolveWrapper(
            handle,
            (runtimeGtype) => findWrapperClass(runtimeGtype),
            (runtimeGtype) => `Expected registered GLib type, got gtype ${String(runtimeGtype)}`,
        );
    }
    return instantiate(cls, handle);
}

export function wrapInterfaceHandle<T extends object>(handle: Handle, interfaceGtype: GType): T;
export function wrapInterfaceHandle<T extends object>(
    handle: Handle | null | undefined,
    interfaceGtype: GType,
): T | null;
export function wrapInterfaceHandle(handle: Handle | null | undefined, interfaceGtype: GType): object | null {
    if (handle === null || handle === undefined) return null;
    return resolveWrapper(
        handle,
        (runtimeGtype) => findWrapperClassForInterface(runtimeGtype, interfaceGtype) ?? getWrapperClass(interfaceGtype),
        () => `Expected registered wrapper for interface ${typeName(interfaceGtype) ?? String(interfaceGtype)}`,
    );
}

export function getWrapperClass(gtype: GType): AnyClass | null {
    return classRegistry.get(gtype) ?? null;
}

export function resolveWrapperClass(name: string): AnyClass<GTyped> | null {
    return getWrapperClass(typeFromName(name)) as AnyClass<GTyped> | null;
}

export function requireWrapperClass(name: string, describe: (name: string) => string): AnyClass<GTyped> {
    const cls = resolveWrapperClass(name);
    if (!cls) throw new Error(describe(name));
    return cls;
}

export function constructWrapper(cls: AnyClass<GTyped>, props: Record<string, unknown>): GTyped {
    return new (cls as new (props: Record<string, unknown>) => GTyped)(props);
}

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

export function findWrapperClass(gtype: GType): AnyClass | null {
    return getWrapperClass(gtype) ?? walkParentChain(gtype, () => true);
}

function findWrapperClassForInterface(gtype: GType, interfaceGtype: GType): AnyClass | null {
    const exact = getWrapperClass(gtype);
    if (exact) return exact;

    if (interfaceGtype === TYPE_INVALID) return null;

    return walkParentChain(gtype, (parentGtype) => typeIsA(parentGtype, interfaceGtype));
}

function resolveWrapper(
    handle: Handle,
    resolveClass: (runtimeGtype: GType) => AnyClass | null,
    describe: (runtimeGtype: GType) => string,
): object {
    const existing = getWrapper(handle);
    if (existing) return existing;

    const runtimeGtype: GType = getType(handle);
    if (runtimeGtype === TYPE_INVALID) {
        throw new Error("Cannot resolve runtime GLib type from handle");
    }

    const cls = resolveClass(runtimeGtype);
    if (!cls) throw new Error(describe(runtimeGtype));
    const instance = Object.create(cls.prototype) as GTyped;
    if (isGobjectType(runtimeGtype)) {
        linkGobjectWrapper(handle, instance);
    } else {
        setHandle(instance, handle);
    }
    return instance;
}

export type { Handle } from "@gtkx/native";

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

function linkGobjectWrapper(handle: Handle, instance: object): void {
    setHandle(instance, handle);
    setWrapper(handle, instance);
}

export type VfuncDescriptor<K extends "class" | "interface"> = {
    kind: K;
    className: string;
    vfuncName: string;
    byteOffset: number;
    argTypes: NativeRegisterClassVfunc["argTypes"];
    returnType: NativeRegisterClassVfunc["returnType"];
};

export type VfuncRegistry = Record<string, VfuncDescriptor<"class"> | VfuncDescriptor<"interface">>;

const vfuncRegistryByClass = new WeakMap<object, VfuncRegistry>();

export function registerVfuncRegistry(cls: object, registry: VfuncRegistry): void {
    vfuncRegistryByClass.set(cls, registry);
}

export function getVfuncRegistry(cls: object): VfuncRegistry | undefined {
    return vfuncRegistryByClass.get(cls);
}

const interfaceVfuncRegistryByGtype = new Map<GType, VfuncRegistry>();

export function registerInterfaceVfuncRegistry(gtype: GType, vfuncRegistry: VfuncRegistry): void {
    if (gtype === TYPE_INVALID) return;
    interfaceVfuncRegistryByGtype.set(gtype, vfuncRegistry);
}

export function getInterfaceVfuncRegistry(gtype: GType): VfuncRegistry | undefined {
    return interfaceVfuncRegistryByGtype.get(gtype);
}
