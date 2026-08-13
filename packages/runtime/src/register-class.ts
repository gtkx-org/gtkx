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
    GET_PROPERTY_VFUNC,
    makeGetProperty,
    makeSetProperty,
    type PropertyDispatch,
    type PropertySpec,
    SET_PROPERTY_VFUNC,
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

/**
 * One key of `RegisterClassOptions.properties` with every underscore turned into the dash a canonical
 * GObject property name separates its words with.
 */
type Dashed<TName extends string> = TName extends `${infer THead}_${infer TTail}`
    ? Dashed<`${THead}-${TTail}`>
    : TName;

/**
 * One dashed key in the camelCase spelling the accessors {@link registerClass} installs carry, which is
 * the spelling the hooks that address a property by name take.
 */
type Camelized<TName extends string> = TName extends `${infer THead}-${infer TTail}`
    ? `${THead}${Capitalize<Camelized<TTail>>}`
    : TName;

/**
 * The names a registered class carries in its property map: every key of
 * `RegisterClassOptions.properties` in camelCase, whichever of the three spellings it was written in.
 * A `properties` object given a type of its own rather than left to inference has `string` for its key
 * type and names nothing, because a name only known as `string` addresses no member in particular.
 */
type InstalledNames<TProperties> = string extends keyof TProperties
    ? never
    : Camelized<Dashed<keyof TProperties & string>>;

/**
 * An instance of a registered class: everything the class itself declares, plus the property map the
 * hooks that address a property by name, such as `useProperty` from `@gtkx/react`, read the installed
 * names off. Each name is typed with the value type the class declares for the member of that name,
 * so a property the class does not `declare` contributes nothing.
 */
type RegisteredInstance<TInstance, TProperties> = TInstance & {
    /** Type-level map from installed property name to value type; no value ever carries it. */
    __properties__: Pick<TInstance, InstalledNames<TProperties> & keyof TInstance>;
};

/**
 * The construct signature and prototype a registered class carries, both giving
 * {@link RegisteredInstance}. The signature stays abstract for as long as the class itself is, so
 * registering an abstract base leaves it as impossible to construct as it was.
 */
type RegisteredConstructor<TClass, TArgs extends unknown[], TInstance> = {
    /** Object the class's instances inherit from. */
    prototype: TInstance;
} & (TClass extends new (...args: never) => unknown
    ? new (...args: TArgs) => TInstance
    : abstract new (...args: TArgs) => TInstance);

/**
 * The class {@link registerClass} hands back: the same class, with the same statics, whose instances
 * carry the properties `RegisterClassOptions.properties` installed. Binding the call to a name, rather
 * than discarding it, is what carries those names into the type system.
 */
type RegisteredClass<TClass extends AnyClass, TProperties> =
    TClass extends abstract new (...args: infer TArgs) => infer TInstance
        ? Omit<TClass, "prototype"> & RegisteredConstructor<TClass, TArgs, RegisteredInstance<TInstance, TProperties>>
        : never;

/** What {@link registerClass} adds to the new GType beyond the vtable slots it discovers on the class. */
type RegisterClassOptions<TInstance extends object, TProperties extends Record<string, PropertySpec>> = {
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
     * Properties to install on the new type, keyed by the name JavaScript addresses each one by and
     * valued with the `GObject.ParamSpec` describing it. A key is read in camelCase however it is
     * written, so `dewPoint`, `dew_point` and `dew-point` all name the same member, and the ParamSpec
     * has to carry the canonical spelling of that name, `dew-point`, or registration throws: the
     * ParamSpec's name is the one GObject emits `notify` with, and a name the key does not spell
     * reaches nothing that listens for it. Every property gains prototype accessors, one for the key
     * as written, one for it with dashes turned into underscores and one for it in camelCase, each
     * unless the class already defines that name. They serve the value from storage of their own on
     * the instance, which is also what the type's `get_property` and `set_property` slots read and
     * write, so a value set from JavaScript, from `g_object_set_property` and at construction all
     * land in the same place.
     *
     * A write the ParamSpec would refuse throws rather than reaching GObject, which reports such a
     * write as a GLib critical and drops it: a `TypeError` for a read-only or construct-only
     * property and for a value of a type the property cannot hold, and a `RangeError` for a value
     * the ParamSpec rejects. The same two checks run over a value handed to the constructor, where
     * a construct-only property is the one that is writable. An accepted write emits one `notify`,
     * which a `freeze_notify` batch collects; a write of the value the property already holds is
     * dropped and emits none.
     *
     * `null` and `undefined` both mean NULL, and mean it only where the ParamSpec's own type holds
     * NULL, which is a string, string-array, boxed, object, interface, param, variant or pointer
     * property. Such a property holds the `null` either spelling wrote, so the member, the type's
     * `get_property` slot and `g_object_get_property` serve the same thing, and writing the other
     * spelling over it emits no `notify`. Every other property, so every integer, floating-point,
     * boolean, enum, flags and GType one, refuses both with the same `TypeError` it refuses a
     * string with, and keeps the value it already holds. It refuses them for what it holds rather
     * than for its range, whatever that range is: the type is checked before the range, so a
     * `gint` whose range excludes 0 answers a nullish with that same `TypeError` and never with
     * the `RangeError` that names the value GObject would put in its place. The one place
     * `undefined` means something else is the constructor, which reads it as the property not
     * being given at all and leaves it at the ParamSpec's default, so a property is never handed a
     * value it cannot serve back.
     *
     * A floating-point property takes every JavaScript number, `NaN` and both infinities
     * included, and its ParamSpec alone rules on which of them the range admits: a `gdouble`
     * bounded by `-Infinity` and `Infinity` holds either infinity, and a magnitude a bounded
     * one excludes, like any `NaN`, comes back as the `RangeError` that names what GObject
     * would put in its place rather than as the `TypeError` a type the property cannot hold
     * earns. A `gfloat` property holds what GObject narrows the double to, so it serves `0.1`
     * back as `0.10000000149011612` and a finite magnitude no `gfloat` reaches as an infinity,
     * which the range then rules on in turn. That narrowing belongs to the property alone: the
     * same magnitude written to a `gfloat` through a generated binding, a signal argument or a
     * closure return is refused outright rather than narrowed.
     *
     * A generated property of a wrapped type answers a nullish differently, and the two halves of
     * the API disagree here: that property marshals what it is written through its descriptor
     * rather than through the checks above, so `new Gtk.Label({ widthRequest: null })` and a later
     * write of `null` to that member both land 0, where a `gint` installed here refuses both.
     *
     * A class that defines the camelCase member itself owns the property: its own accessor decides
     * what a write means, the other two spellings forward to it, and the type's property slots read
     * and write it rather than the generated storage.
     */
    properties?: TProperties;
};

/** {@link RegisterClassOptions} with the widest instance and property types {@link registerClass} accepts. */
type AnyRegisterClassOptions = RegisterClassOptions<object, Record<string, PropertySpec>>;
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

type ArgPatch = { isCallerAllocated: true } | { isCallScoped: true };

const INSTANCE_ARG_INDEX = 0;
const VALUE_ARG_INDEX = 2;
const TEARDOWN_VFUNC_NAMES: Set<string> = new Set(["dispose", "finalize"]);

const PROPERTY_VFUNC_SPECS: PropertyVfuncSpec[] = [
    { methodName: GET_PROPERTY_VFUNC, isValueOut: true, makeDispatch: makeGetProperty },
    { methodName: SET_PROPERTY_VFUNC, isValueOut: false, makeDispatch: makeSetProperty },
];

const PROPERTY_VFUNC_NAMES: Set<string> = new Set(PROPERTY_VFUNC_SPECS.map((spec) => spec.methodName));

/**
 * Registers a subclass of a wrapper class as a new GType, wiring up any class and interface
 * virtual functions it overrides, both for the interfaces it inherits and for the ones
 * `RegisterClassOptions.implements` names.
 *
 * Throws when the class does not extend a registered wrapper class, when it has no derivable type
 * name, when an entry in `RegisterClassOptions.implements` is not a registered interface, when a
 * listed interface has a prerequisite that neither the parent type nor another listed interface meets,
 * and when an entry in `RegisterClassOptions.properties` names its `GObject.ParamSpec` something other
 * than the canonical spelling of the key it sits under.
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
 * @returns The same class, now registered, with every name in `options.properties` in its property map.
 */
function registerClass<
    T extends AnyClass,
    TProperties extends Record<string, PropertySpec> = Record<never, PropertySpec>,
>(klass: T, options?: RegisterClassOptions<T["prototype"], TProperties>): RegisteredClass<T, TProperties>;

function registerClass(klass: AnyClass, options: AnyRegisterClassOptions = {}): AnyClass {
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
    const { methods, inheritedNames } = collectInstanceMembers(klass);
    const dispatch = buildPropertyDispatch({ klass, properties, adoptedTypes });

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

    const argDescriptors = slotArgDescriptors(descriptor);

    return {
        ...descriptor,
        methodName,
        argDescriptors,
        fn: wrapVfunc(fn, argDescriptors, descriptor),
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
    descriptor: VfuncDescriptor,
): VfuncFn {
    return wrapCallback(
        fn as (...args: unknown[]) => unknown,
        { argDescriptors, returnDescriptor: descriptor.returnDescriptor },
        "vfunc",
    );
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

function markArg(argDescriptors: Descriptor[], index: number, patch: ArgPatch): Descriptor[] {
    return argDescriptors.map((arg, at) => (at === index ? { ...arg, ...patch } : arg));
}

function isTeardownSlot(descriptor: VfuncDescriptor): boolean {
    return (
        TEARDOWN_VFUNC_NAMES.has(descriptor.vfuncName) &&
        descriptor.argDescriptors[INSTANCE_ARG_INDEX]?.kind === "object"
    );
}

function slotArgDescriptors(descriptor: VfuncDescriptor): Descriptor[] {
    if (!isTeardownSlot(descriptor)) {
        return descriptor.argDescriptors;
    }

    return markArg(descriptor.argDescriptors, INSTANCE_ARG_INDEX, { isCallScoped: true });
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
        ? markArg(descriptor.argDescriptors, VALUE_ARG_INDEX, { isCallerAllocated: true })
        : descriptor.argDescriptors;

    return {
        ...descriptor,
        methodName,
        argDescriptors,
        fn: wrapVfunc(fn, argDescriptors, descriptor),
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
