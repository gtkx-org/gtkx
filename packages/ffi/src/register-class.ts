import {
    type RegisterClassOptions as NativeRegisterClassOptions,
    type RegisterClassVfunc as NativeRegisterClassVfunc,
    registerClass as nativeRegisterClass,
} from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { type GType, TYPE_INVALID, typeInterfaces } from "./gtype.js";
import { wrapHandler } from "./handler-trampoline.js";
import {
    getClassGtype,
    getInterfaceVfuncRegistry,
    getParentClass,
    getVfuncRegistry,
    setClassGtype,
    type VfuncDescriptor,
    walkClassChain,
} from "./registry.js";

export type RegisterClassOptions = {
    gtypeName?: string;
};

type VfuncFn = NativeRegisterClassVfunc["fn"];

type DiscoveredVfunc<K extends "class" | "interface"> = VfuncDescriptor<K> & {
    methodName: string;
    fn: VfuncFn;
};

type DiscoveredClassVfunc = DiscoveredVfunc<"class">;

type DiscoveredInterfaceVfunc = DiscoveredVfunc<"interface">;

type InterfaceVfuncBinding = {
    gtype: GType;
    vfuncs: DiscoveredInterfaceVfunc[];
};

export function registerClass<T extends AnyClass>(klass: T, options: RegisterClassOptions = {}): T {
    const parentGtype = resolveParentGtype(klass);
    if (parentGtype === TYPE_INVALID) {
        throw new TypeError(`registerClass: ${klass.name} must extend a registered wrapper class`);
    }

    const name = options.gtypeName ?? klass.name;
    if (!name) {
        throw new Error("registerClass: cannot derive a GType name (anonymous class with no gtypeName option)");
    }

    const classVfuncs = discoverClassVfuncs(klass);
    const claimedMethodNames = new Set(classVfuncs.map((vfunc) => vfunc.methodName));
    const interfaceBindings = discoverInheritedInterfaceVfuncs(klass, parentGtype, claimedMethodNames);

    const nativeOptions = toNativeOptions(classVfuncs, interfaceBindings);
    const newGtype: GType = nativeRegisterClass(name, parentGtype, nativeOptions);
    setClassGtype(klass, newGtype);

    return klass;
}

function resolveParentGtype(klass: AnyClass): GType {
    return (
        walkClassChain(getParentClass(klass), (cls) => {
            const gtype = getClassGtype(cls);
            return gtype !== TYPE_INVALID ? gtype : undefined;
        }) ?? TYPE_INVALID
    );
}

function ownInstanceMethodNames(klass: AnyClass): string[] {
    const proto = (klass as { prototype?: object }).prototype;
    if (!proto) return [];
    return Object.getOwnPropertyNames(proto).filter((name) => {
        if (name === "constructor") return false;
        return typeof (proto as Record<string, unknown>)[name] === "function";
    });
}

function collectDiscoveredVfuncs<K extends "class" | "interface">(
    klass: AnyClass,
    resolveDescriptor: (methodName: string) => VfuncDescriptor<K> | undefined,
    skip?: Set<string>,
): DiscoveredVfunc<K>[] {
    const proto = (klass as { prototype: Record<string, VfuncFn> }).prototype;
    const result: DiscoveredVfunc<K>[] = [];
    for (const methodName of ownInstanceMethodNames(klass)) {
        if (skip?.has(methodName)) continue;
        const descriptor = resolveDescriptor(methodName);
        if (!descriptor) continue;
        const fn = proto[methodName];
        if (!fn) continue;
        result.push({ ...descriptor, methodName, fn: wrapVfunc(fn, descriptor.argTypes, descriptor.returnType) });
    }
    return result;
}

const UNSUPPORTED_CONSTRUCT_VFUNCS: Set<string> = new Set(["constructed", "setProperty", "getProperty"]);

function discoverClassVfuncs(klass: AnyClass): DiscoveredClassVfunc[] {
    return collectDiscoveredVfuncs(klass, (methodName) => {
        const descriptor = findClassVfuncDescriptor(klass, methodName);
        if (descriptor && UNSUPPORTED_CONSTRUCT_VFUNCS.has(methodName)) {
            throw new Error(
                `registerClass: overriding the GObject construct-time vtable slot '${methodName}' is not supported; run construct-time initialization in the subclass constructor, after super(...), instead`,
            );
        }
        return descriptor ?? undefined;
    });
}

function wrapVfunc(
    fn: VfuncFn,
    argTypes: NativeRegisterClassVfunc["argTypes"],
    returnType: NativeRegisterClassVfunc["returnType"],
): VfuncFn {
    return wrapHandler(fn, { argTypes, returnType }, "this");
}

function discoverInheritedInterfaceVfuncs(
    klass: AnyClass,
    parentGtype: GType,
    claimedMethodNames: Set<string>,
): InterfaceVfuncBinding[] {
    const bindings: InterfaceVfuncBinding[] = [];
    for (const interfaceGtype of typeInterfaces(parentGtype)) {
        const vfuncs = discoverInterfaceVfuncs(klass, interfaceGtype, claimedMethodNames);
        if (vfuncs.length > 0) {
            bindings.push({ gtype: interfaceGtype, vfuncs });
        }
    }
    return bindings;
}

function discoverInterfaceVfuncs(
    klass: AnyClass,
    interfaceGtype: GType,
    claimedMethodNames: Set<string>,
): DiscoveredInterfaceVfunc[] {
    const vfuncRegistry = getInterfaceVfuncRegistry(interfaceGtype);
    if (!vfuncRegistry) return [];
    return collectDiscoveredVfuncs(
        klass,
        (methodName) => {
            const entry = vfuncRegistry[methodName];
            return entry?.kind === "interface" ? entry : undefined;
        },
        claimedMethodNames,
    );
}

function findClassVfuncDescriptor(klass: AnyClass, methodName: string): VfuncDescriptor<"class"> | null {
    return (
        walkClassChain(getParentClass(klass), (cls) => {
            const entry = getVfuncRegistry(cls)?.[methodName];
            return entry?.kind === "class" ? entry : undefined;
        }) ?? null
    );
}

function toNativeOptions(
    classVfuncs: DiscoveredClassVfunc[],
    interfaceBindings: InterfaceVfuncBinding[],
): NativeRegisterClassOptions | undefined {
    const hasInterfaces = interfaceBindings.length > 0;
    const hasClassVfuncs = classVfuncs.length > 0;
    if (!hasClassVfuncs && !hasInterfaces) {
        return undefined;
    }
    const options: NativeRegisterClassOptions = {};
    if (hasClassVfuncs) options.vfuncs = [...classVfuncs];
    if (hasInterfaces) {
        options.interfaces = interfaceBindings.map((binding) => ({
            gtype: binding.gtype,
            vfuncs: [...binding.vfuncs],
        }));
    }
    return options;
}
