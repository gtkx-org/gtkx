import type { Descriptor } from "@gtkx/native";
import {
    registerClass as nativeRegisterClass,
    type RegisterClassInterface as NativeRegisterClassInterface,
    type RegisterClassOptions as NativeRegisterClassOptions,
    type RegisterClassVfunc as NativeRegisterClassVfunc,
} from "@gtkx/native";
import { type AnyClass, getParentClass, walkClassChain } from "@gtkx/utils";
import { wrapCallback } from "./callback.js";
import { insertMixinLayer } from "./mixin.js";
import {
    buildPropertyDispatch,
    makeGetProperty,
    makeSetProperty,
    type PropertyDispatch,
    type PropertySpec,
    toNativeProperties,
} from "./properties.js";
import {
    getClassType,
    getInterfaceMixin,
    markDerivedClass,
    registerClassType,
    type VfuncDescriptor,
} from "./registry.js";
import { TYPE_INTERFACE, TYPE_INVALID, typeFundamental, typeInterfaces, typeIsA } from "./type.js";
import { findClassVfuncDescriptor, findInterfaceVfuncDescriptor } from "./vfunc.js";

/**
 * A generated interface value, such as `Gio.ListModel`, in the form {@link registerClass} takes it.
 * `__impl__` exists only in the type system: it carries the interface's `Impl` type, of which a class
 * has to match every member it declares itself, which rejects a class value and a member whose
 * signature does not fit the slot it fills. Leaving a slot to the interface is not rejected,
 * because `registerClass` does not reject it either: every member of an `Impl` type is optional,
 * and the `Partial` holds that open whatever the type declares. The `object` beside it keeps
 * TypeScript from also demanding one member in common. An interface that introspection describes
 * no vtable for carries `unknown`, since it has no slot a class could fill.
 */
type Interface<TImpl> = AnyClass & {
    /** Type-level slot holding the interface's `Impl` type; no value ever carries it. */
    __impl__: (impl: Partial<TImpl> & object) => void;
};

/** What {@link registerClass} adds to the new GType beyond the vtable slots it discovers on the class. */
type RegisterClassOptions<TInstance extends object> = {
    /** Name to register the new GType under, defaulting to the class's own name. */
    typeName?: string;
    /**
     * Interfaces the new type implements on top of the ones it inherits, given as the interface values
     * themselves, such as `Gio.ListModel`. Their vtable slots are filled from the `vfunc`-prefixed methods on
     * the class's prototype chain, each of which has to match the interface's `Impl` type, such as
     * `Gio.ListModelImpl`.
     */
    implements?: Interface<TInstance>[];
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
type DiscoveredVfunc = VfuncDescriptor & { methodName: string; fn: VfuncFn };
type MethodTable = Map<string, VfuncFn>;
type InstanceMembers = { methods: MethodTable; names: Set<string>; inheritedNames: Set<string> };

type InterfaceVfuncBinding = {
    gtype: bigint;
    vfuncs: DiscoveredVfunc[];
};

type PropertyVfuncSource = {
    klass: AnyClass;
    methods: MethodTable;
    dispatch: PropertyDispatch;
    adoptedTypes: bigint[];
};

type PropertyVfuncSpec = {
    methodName: string;
    isValueOut: boolean;
    makeDispatch: (dispatch: PropertyDispatch) => VfuncFn;
};

const VALUE_ARG_INDEX = 2;

const PROPERTY_VFUNC_SPECS: PropertyVfuncSpec[] = [
    { methodName: "vfuncGetProperty", isValueOut: true, makeDispatch: makeGetProperty },
    { methodName: "vfuncSetProperty", isValueOut: false, makeDispatch: makeSetProperty },
];

const PROPERTY_VFUNC_NAMES: Set<string> = new Set(PROPERTY_VFUNC_SPECS.map((spec) => spec.methodName));

/**
 * Registers a subclass of a wrapper class as a new GType, wiring up any class and interface
 * virtual functions it overrides, both for the interfaces it inherits and for the ones
 * `RegisterClassOptions.implements` names.
 *
 * Throws when the class does not extend a registered wrapper class, when it has no derivable type
 * name, when an entry in `RegisterClassOptions.implements` is not a registered interface, and when a
 * listed interface has a prerequisite that neither the parent type nor another listed interface meets.
 *
 * A slot is filled from the `vfunc`-prefixed methods on the class's prototype chain, up to but not
 * including the registered ancestor the class extends, so a method an intermediate base class
 * declares fills a slot the same way one the class itself declares does. A slot nothing on that
 * chain fills is left untouched.
 *
 * Declare every slot as a method: a class field holding a function, such as `vfuncGetNItems = () => 1`,
 * is assigned to each instance after registration and never reaches the vtable.
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
function registerClass<T extends AnyClass>(klass: T, options: RegisterClassOptions<T["prototype"]> = {}): T {
    const parentType = resolveParentType(klass);

    if (parentType === TYPE_INVALID) {
        throw new TypeError(`registerClass: ${klass.name} must extend a registered wrapper class`);
    }

    const name = options.typeName ?? klass.name;

    if (!name) {
        throw new Error("registerClass: cannot derive a GType name (anonymous class with no typeName option)");
    }

    const declaredTypes = resolveInterfaceTypes(klass, options.implements ?? []);
    const adoptedTypes = declaredTypes.filter((gtype) => !typeIsA(parentType, gtype));
    const properties = options.properties ?? {};
    const dispatch = buildPropertyDispatch(klass, properties, adoptedTypes);
    const { methods, inheritedNames } = collectInstanceMembers(klass);

    const classVfuncs = [
        ...discoverClassVfuncs(klass, methods),
        ...propertyVfuncs({ klass, methods, dispatch, adoptedTypes }),
    ];

    const claimedMethodNames = new Set(classVfuncs.map((vfunc) => vfunc.methodName));
    const interfaceBindings = discoverInterfaceBindings(methods, parentType, declaredTypes, claimedMethodNames);
    const nativeOptions = toNativeOptions(classVfuncs, interfaceBindings, properties);
    const newType: bigint = nativeRegisterClass(name, parentType, nativeOptions);
    registerClassType(klass, newType);
    markDerivedClass(klass);
    applyInterfaceMixins(klass, adoptedTypes, inheritedNames);

    return klass;
}

function resolveInterfaceType(klass: AnyClass, entry: AnyClass): bigint {
    const gtype = getClassType(entry);

    if (typeFundamental(gtype) !== TYPE_INTERFACE) {
        const label = typeof entry === "function" ? entry.name : String(entry);

        throw new TypeError(
            `registerClass: ${klass.name} lists '${label}' in implements, which is not a registered interface`,
        );
    }

    return gtype;
}

function resolveInterfaceTypes(klass: AnyClass, entries: AnyClass[]): bigint[] {
    return [...new Set(entries.map((entry) => resolveInterfaceType(klass, entry)))];
}

function applyInterfaceMixins(klass: AnyClass, adoptedTypes: bigint[], inheritedNames: Set<string>): void {
    for (const gtype of adoptedTypes) {
        const mixin = getInterfaceMixin(gtype);

        if (mixin !== undefined) {
            insertMixinLayer(klass, mixin, inheritedNames);
        }
    }
}

function resolveParentType(klass: AnyClass): bigint {
    return (
        walkClassChain(getParentClass(klass), (cls) => {
            const gtype = getClassType(cls);

            return gtype === TYPE_INVALID ? undefined : gtype;
        }) ?? TYPE_INVALID
    );
}

function addOwnMember(members: InstanceMembers, proto: object, name: string, isInherited: boolean): void {
    if (name === "constructor") {
        return;
    }

    if (isInherited) {
        members.inheritedNames.add(name);
    }

    if (members.names.has(name)) {
        return;
    }

    members.names.add(name);
    const descriptor = Object.getOwnPropertyDescriptor(proto, name);

    if (typeof descriptor?.value === "function") {
        members.methods.set(name, descriptor.value as VfuncFn);
    }
}

function addOwnMembers(members: InstanceMembers, klass: AnyClass, isInherited: boolean): void {
    const proto = (klass as { prototype?: object }).prototype;

    if (proto === undefined) {
        return;
    }

    for (const name of Object.getOwnPropertyNames(proto)) {
        addOwnMember(members, proto, name, isInherited);
    }
}

function collectInstanceMembers(klass: AnyClass): InstanceMembers {
    const members: InstanceMembers = { methods: new Map(), names: new Set(), inheritedNames: new Set() };
    let cls: AnyClass | null = klass;

    while (cls !== null && getClassType(cls) === TYPE_INVALID) {
        addOwnMembers(members, cls, cls !== klass);
        cls = getParentClass(cls);
    }

    return members;
}

function buildDiscoveredVfunc(
    fn: VfuncFn,
    methodName: string,
    resolveDescriptor: (methodName: string) => VfuncDescriptor | undefined,
    skip: Set<string> | undefined,
): DiscoveredVfunc | undefined {
    if (skip?.has(methodName)) {
        return undefined;
    }

    const descriptor = resolveDescriptor(methodName);

    if (!descriptor) {
        return undefined;
    }

    return {
        ...descriptor,
        methodName,
        fn: wrapVfunc(fn, descriptor.argDescriptors, descriptor.returnDescriptor),
    };
}

function collectDiscoveredVfuncs(
    methods: MethodTable,
    resolveDescriptor: (methodName: string) => VfuncDescriptor | undefined,
    skip?: Set<string>,
): DiscoveredVfunc[] {
    const result: DiscoveredVfunc[] = [];

    for (const [methodName, fn] of methods) {
        const discovered = buildDiscoveredVfunc(fn, methodName, resolveDescriptor, skip);

        if (discovered) {
            result.push(discovered);
        }
    }

    return result;
}

function discoverClassVfuncs(klass: AnyClass, methods: MethodTable): DiscoveredVfunc[] {
    return collectDiscoveredVfuncs(
        methods,
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

function discoverInterfaceBindings(
    methods: MethodTable,
    parentGtype: bigint,
    declaredTypes: bigint[],
    claimedMethodNames: Set<string>,
): InterfaceVfuncBinding[] {
    const declared: Set<bigint> = new Set(declaredTypes);
    const gtypes: Set<bigint> = new Set([...typeInterfaces(parentGtype), ...declaredTypes]);
    const bindings: InterfaceVfuncBinding[] = [];

    for (const gtype of gtypes) {
        const vfuncs = discoverInterfaceVfuncs(methods, gtype, claimedMethodNames);

        if (vfuncs.length > 0 || declared.has(gtype)) {
            bindings.push({ gtype, vfuncs });
        }
    }

    return bindings;
}

function discoverInterfaceVfuncs(
    methods: MethodTable,
    interfaceGtype: bigint,
    claimedMethodNames: Set<string>,
): DiscoveredVfunc[] {
    return collectDiscoveredVfuncs(
        methods,
        (methodName) => findInterfaceVfuncDescriptor(interfaceGtype, methodName),
        claimedMethodNames,
    );
}

const hasDispatchedProperties = (dispatch: PropertyDispatch, adoptedTypes: bigint[]): boolean =>
    dispatch.accessors.length > 0 || adoptedTypes.length > 0;

function propertyVfuncFor(
    source: PropertyVfuncSource,
    spec: PropertyVfuncSpec,
): DiscoveredVfunc | undefined {
    const { klass, methods, dispatch, adoptedTypes } = source;

    const dispatched = hasDispatchedProperties(dispatch, adoptedTypes)
        ? spec.makeDispatch(dispatch)
        : undefined;

    const fn = methods.get(spec.methodName) ?? dispatched;

    return fn === undefined ? undefined : buildPropertyVfunc(klass, spec.methodName, fn, spec.isValueOut);
}

function propertyVfuncs(source: PropertyVfuncSource): DiscoveredVfunc[] {
    return PROPERTY_VFUNC_SPECS.map((spec) => propertyVfuncFor(source, spec)).filter(
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
): DiscoveredVfunc {
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

function toNativeInterface(binding: InterfaceVfuncBinding): NativeRegisterClassInterface {
    const nativeInterface: NativeRegisterClassInterface = {
        type: binding.gtype,
        vfuncs: [...binding.vfuncs],
    };

    const vtableSize = binding.vfuncs[0]?.vtableSize;

    if (vtableSize !== undefined) {
        nativeInterface.vtableSize = vtableSize;
    }

    return nativeInterface;
}

function toNativeOptions(
    classVfuncs: DiscoveredVfunc[],
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
        options.interfaces = interfaceBindings.map((binding) => toNativeInterface(binding));
    }

    return options;
}

export { type Interface, registerClass };
