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
import { getClassType, markDerivedClass, registerClassType, type VfuncDescriptor } from "./registry.js";
import { TYPE_INVALID, typeInterfaces } from "./type.js";
import { findClassVfuncDescriptor, findInterfaceVfuncDescriptor } from "./vfunc.js";

/** What {@link registerClass} adds to the new GType beyond the vtable slots it discovers on the class. */
type RegisterClassOptions = {
    /** Name to register the new GType under, defaulting to the class's own name. */
    typeName?: string;
    /**
     * Properties to install on the new type, keyed by canonical name and valued with the
     * `GObject.ParamSpec` describing each. Every property gains dashed, underscored and camelCased
     * prototype accessors that emit `notify` on write, unless the class already defines that name.
     * A class that defines `vfuncSetProperty` or `vfuncGetProperty` itself backs that direction with
     * its own method instead of the generated accessor dispatch.
     */
    properties?: Record<string, PropertySpec>;
};

type VfuncFn = NativeRegisterClassVfunc["fn"];
type DiscoveredVfunc<K extends "class" | "interface"> = VfuncDescriptor<K> & { methodName: string; fn: VfuncFn };
type DiscoveredClassVfunc = DiscoveredVfunc<"class">;
type DiscoveredInterfaceVfunc = DiscoveredVfunc<"interface">;
type InterfaceVfuncBinding = { gtype: bigint; vtableSize: number; vfuncs: DiscoveredInterfaceVfunc[] };

type PropertyVfuncSpec = {
    methodName: string;
    isValueOut: boolean;
    makeDispatch: (accessors: PropertyAccessor[]) => VfuncFn;
};

const VALUE_ARG_INDEX = 2;

const PROPERTY_VFUNC_SPECS: PropertyVfuncSpec[] = [
    { methodName: "vfuncGetProperty", isValueOut: true, makeDispatch: makeGetProperty },
    { methodName: "vfuncSetProperty", isValueOut: false, makeDispatch: makeSetProperty },
];

const PROPERTY_VFUNC_NAMES: Set<string> = new Set(PROPERTY_VFUNC_SPECS.map((spec) => spec.methodName));

/**
 * Registers a subclass of a wrapper class as a new GType, wiring up any class and
 * inherited-interface virtual functions it overrides. Throws if the class does not
 * extend a registered wrapper class or has no derivable type name.
 *
 * An override of `vfuncConstructed` runs from inside the base constructor, before JavaScript
 * installs the subclass's field initializers and runs its constructor body, so a field still
 * reads `undefined` there and reading a `#private` field throws. Declare state the override
 * touches without an initializer, and assign private state from the constructor body after
 * `super()`. An instance a native caller creates, through `GObject.newv` or `Gtk.Builder`,
 * never runs the subclass constructor at all, so its declared fields stay uninitialized for
 * the object's whole life.
 *
 * @param klass The subclass to register.
 * @param options What the new GType gains beyond the vtable slots the class overrides.
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
    markDerivedClass(klass);

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

function getOwnMethod(klass: AnyClass, methodName: string): VfuncFn | undefined {
    const proto = (klass as { prototype?: object }).prototype;
    const descriptor = proto === undefined ? undefined : Object.getOwnPropertyDescriptor(proto, methodName);

    return typeof descriptor?.value === "function" ? (descriptor.value as VfuncFn) : undefined;
}

function ownInstanceMethodNames(klass: AnyClass): string[] {
    const proto = (klass as { prototype?: object }).prototype;

    if (!proto) {
        return [];
    }

    return Object.getOwnPropertyNames(proto).filter(
        (name) => name !== "constructor" && getOwnMethod(klass, name) !== undefined,
    );
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
    return collectDiscoveredVfuncs(
        klass,
        (methodName) => findClassVfuncDescriptor(klass, methodName) ?? undefined,
        PROPERTY_VFUNC_NAMES,
    );
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
    return collectDiscoveredVfuncs(
        klass,
        (methodName) => findInterfaceVfuncDescriptor(interfaceGtype, methodName),
        claimedMethodNames,
    );
}

const makeAccessorDispatch = (accessors: PropertyAccessor[], spec: PropertyVfuncSpec): VfuncFn | undefined =>
    accessors.length === 0 ? undefined : spec.makeDispatch(accessors);

function propertyVfuncFor(
    klass: AnyClass,
    accessors: PropertyAccessor[],
    spec: PropertyVfuncSpec,
): DiscoveredClassVfunc | undefined {
    const fn = getOwnMethod(klass, spec.methodName) ?? makeAccessorDispatch(accessors, spec);

    return fn === undefined ? undefined : buildPropertyVfunc(klass, spec.methodName, fn, spec.isValueOut);
}

function propertyVfuncs(klass: AnyClass, accessors: PropertyAccessor[]): DiscoveredClassVfunc[] {
    return PROPERTY_VFUNC_SPECS.map((spec) => propertyVfuncFor(klass, accessors, spec)).filter(
        (vfunc) => vfunc !== undefined,
    );
}

function markValueCallerAllocated(argDescriptors: Descriptor[]): Descriptor[] {
    return argDescriptors.map((arg, index) =>
        index === VALUE_ARG_INDEX ? { ...arg, isCallerAllocated: true } : arg);
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
