import type { Descriptor } from "@gtkx/native";
import {
    registerClass as nativeRegisterClass,
    type RegisterClassOptions as NativeRegisterClassOptions,
    type RegisterClassVfunc as NativeRegisterClassVfunc,
} from "@gtkx/native";
import { type AnyClass, getParentClass, walkClassChain } from "@gtkx/utils";
import { wrapCallback } from "./callback.js";
import {
    buildAccessors,
    makeGetProperty,
    makeSetProperty,
    type PropertyAccessor,
    type PropertySpec,
    toNativeProperties,
} from "./properties.js";
import {
    getClassType,
    getInterfaceVfuncRegistry,
    getVfuncRegistry,
    registerClassType,
    type VfuncDescriptor,
} from "./registry.js";
import { TYPE_INVALID, typeInterfaces } from "./type.js";

type RegisterClassOptions = {
    typeName?: string;
    /**
     * Properties to install on the new type, keyed by canonical property name. Each value is the
     * `GObject.ParamSpec` describing it, for example `GObject.paramSpecString(...)`. Accessors are
     * generated on the prototype for the dashed, underscored and camelCased spellings of the name
     * unless the class already defines one, and writing through them emits `notify`.
     */
    properties?: Record<string, PropertySpec>;
};

type VfuncFn = NativeRegisterClassVfunc["fn"];
type DiscoveredVfunc<K extends "class" | "interface"> = VfuncDescriptor<K> & { methodName: string; fn: VfuncFn };
type DiscoveredClassVfunc = DiscoveredVfunc<"class">;
type DiscoveredInterfaceVfunc = DiscoveredVfunc<"interface">;
type InterfaceVfuncBinding = { gtype: bigint; vtableSize: number; vfuncs: DiscoveredInterfaceVfunc[] };

const UNSUPPORTED_CONSTRUCT_VFUNCS: Set<string> = new Set(["constructed", "setProperty", "getProperty"]);
const VALUE_ARG_INDEX = 2;

/**
 * Registers a subclass of a wrapper class as a new GType, wiring up any class and
 * inherited-interface virtual functions it overrides. Throws if the class does not
 * extend a registered wrapper class, has no derivable type name, or overrides an
 * unsupported construct-time vtable slot.
 *
 * @param klass The subclass to register.
 * @param options Registration options, such as an explicit type name.
 * @returns The same class, now registered.
 */
function registerClass<T extends AnyClass>(klass: T, options: RegisterClassOptions = {}): T {
    const parentType = resolveParentType(klass);

    if (parentType === TYPE_INVALID) {
        throw new TypeError(`registerClass: ${klass.name} must extend a registered wrapper class`);
    }

    const name = options.typeName ?? klass.name;

    if (!name) {
        throw new Error("registerClass: cannot derive a GType name (anonymous class with no typeName option)");
    }

    const properties = options.properties ?? {};
    const accessors = buildAccessors(klass, properties);
    const classVfuncs = [...discoverClassVfuncs(klass), ...propertyVfuncs(klass, accessors)];
    const claimedMethodNames = new Set(classVfuncs.map((vfunc) => vfunc.methodName));
    const interfaceBindings = discoverInheritedInterfaceVfuncs(klass, parentType, claimedMethodNames);
    const nativeOptions = toNativeOptions(classVfuncs, interfaceBindings, properties);
    const newType: bigint = nativeRegisterClass(name, parentType, nativeOptions);
    registerClassType(klass, newType);

    return klass;
}

function resolveParentType(klass: AnyClass): bigint {
    return (
        walkClassChain(getParentClass(klass), (cls) => {
            const gtype = getClassType(cls);

            return gtype === TYPE_INVALID ? undefined : gtype;
        }) ?? TYPE_INVALID
    );
}

function ownInstanceMethodNames(klass: AnyClass): string[] {
    const proto = (klass as { prototype?: object }).prototype;

    if (!proto) {
        return [];
    }

    return Object.getOwnPropertyNames(proto).filter((name) => {
        if (name === "constructor") {
            return false;
        }

        return typeof Object.getOwnPropertyDescriptor(proto, name)?.value === "function";
    });
}

function buildDiscoveredVfunc<K extends "class" | "interface">(
    proto: Record<string, VfuncFn>,
    methodName: string,
    resolveDescriptor: (methodName: string) => VfuncDescriptor<K> | undefined,
    skip: Set<string> | undefined,
): DiscoveredVfunc<K> | undefined {
    if (skip?.has(methodName)) {
        return undefined;
    }

    const descriptor = resolveDescriptor(methodName);

    if (!descriptor) {
        return undefined;
    }

    const fn = proto[methodName];

    if (!fn) {
        return undefined;
    }

    return {
        ...descriptor,
        methodName,
        fn: wrapVfunc(fn, descriptor.argDescriptors, descriptor.returnDescriptor),
    };
}

function collectDiscoveredVfuncs<K extends "class" | "interface">(
    klass: AnyClass,
    resolveDescriptor: (methodName: string) => VfuncDescriptor<K> | undefined,
    skip?: Set<string>,
): DiscoveredVfunc<K>[] {
    const proto = (klass as { prototype: Record<string, VfuncFn> }).prototype;
    const result: DiscoveredVfunc<K>[] = [];

    for (const methodName of ownInstanceMethodNames(klass)) {
        const discovered = buildDiscoveredVfunc(proto, methodName, resolveDescriptor, skip);

        if (discovered) {
            result.push(discovered);
        }
    }

    return result;
}

function discoverClassVfuncs(klass: AnyClass): DiscoveredClassVfunc[] {
    return collectDiscoveredVfuncs(klass, (methodName) => {
        const descriptor = findClassVfuncDescriptor(klass, methodName);

        if (descriptor && UNSUPPORTED_CONSTRUCT_VFUNCS.has(methodName)) {
            throw new Error(
                `registerClass: overriding the GObject construct-time vtable slot '${methodName}' is not ` +
                "supported; run construct-time initialization in the subclass constructor, after " +
                "super(...), instead",
            );
        }

        return descriptor ?? undefined;
    });
}

function wrapVfunc(
    fn: VfuncFn,
    argDescriptors: NativeRegisterClassVfunc["argDescriptors"],
    returnDescriptor: NativeRegisterClassVfunc["returnDescriptor"],
): VfuncFn {
    return wrapCallback(fn as (...args: unknown[]) => unknown, { argDescriptors, returnDescriptor }, "this");
}

function discoverInheritedInterfaceVfuncs(
    klass: AnyClass,
    parentGtype: bigint,
    claimedMethodNames: Set<string>,
): InterfaceVfuncBinding[] {
    const bindings: InterfaceVfuncBinding[] = [];

    for (const interfaceGtype of typeInterfaces(parentGtype)) {
        const [first, ...rest] = discoverInterfaceVfuncs(klass, interfaceGtype, claimedMethodNames);

        if (first !== undefined) {
            bindings.push({ gtype: interfaceGtype, vtableSize: first.vtableSize, vfuncs: [first, ...rest] });
        }
    }

    return bindings;
}

function discoverInterfaceVfuncs(
    klass: AnyClass,
    interfaceGtype: bigint,
    claimedMethodNames: Set<string>,
): DiscoveredInterfaceVfunc[] {
    const vfuncRegistry = getInterfaceVfuncRegistry(interfaceGtype);

    if (!vfuncRegistry) {
        return [];
    }

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

function propertyVfuncs(klass: AnyClass, accessors: PropertyAccessor[]): DiscoveredClassVfunc[] {
    if (accessors.length === 0) {
        return [];
    }

    return [
        buildPropertyVfunc(klass, "getProperty", makeGetProperty(accessors), true),
        buildPropertyVfunc(klass, "setProperty", makeSetProperty(accessors), false),
    ];
}

// `get_property` fills a GValue the caller owns, so the marshalled copy handed to JavaScript has to
// be written back into it; `set_property` only reads its GValue and needs no copy back.
function markValueCallerAllocated(argDescriptors: Descriptor[]): Descriptor[] {
    return argDescriptors.map((arg, index) =>
        index === VALUE_ARG_INDEX ? { ...arg, callerAllocated: true } : arg);
}

function buildPropertyVfunc(
    klass: AnyClass,
    methodName: string,
    fn: VfuncFn,
    isValueOut: boolean,
): DiscoveredClassVfunc {
    const descriptor = findClassVfuncDescriptor(klass, methodName);

    if (!descriptor) {
        throw new Error(`registerClass: the parent class exposes no '${methodName}' vtable slot`);
    }

    const argDescriptors = isValueOut
        ? markValueCallerAllocated(descriptor.argDescriptors)
        : descriptor.argDescriptors;

    return {
        ...descriptor,
        methodName,
        argDescriptors,
        fn: wrapVfunc(fn, argDescriptors, descriptor.returnDescriptor),
    };
}

function toNativeOptions(
    classVfuncs: DiscoveredClassVfunc[],
    interfaceBindings: InterfaceVfuncBinding[],
    properties: Record<string, PropertySpec>,
): NativeRegisterClassOptions | undefined {
    const hasInterfaces = interfaceBindings.length > 0;
    const hasClassVfuncs = classVfuncs.length > 0;
    const hasProperties = Object.keys(properties).length > 0;

    if (!hasClassVfuncs && !hasInterfaces && !hasProperties) {
        return undefined;
    }

    const options: NativeRegisterClassOptions = {};

    if (hasProperties) {
        options.properties = toNativeProperties(properties);
    }

    if (hasClassVfuncs) {
        options.vfuncs = [...classVfuncs];
    }

    if (hasInterfaces) {
        options.interfaces = interfaceBindings.map((binding) => ({
            type: binding.gtype,
            vtableSize: binding.vtableSize,
            vfuncs: [...binding.vfuncs],
        }));
    }

    return options;
}

export { registerClass };
