import type { Descriptor } from "@gtkx/native";
import {
    registerClass as nativeRegisterClass,
    type RegisterClassInterface as NativeRegisterClassInterface,
    type RegisterClassOptions as NativeRegisterClassOptions,
    type RegisterClassSignal as NativeRegisterClassSignal,
    type RegisterClassVfunc as NativeRegisterClassVfunc,
} from "@gtkx/native";
import { type AnyClass, getParentClass, kebabCase, walkClassChain } from "@gtkx/utils";
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
    getClassStructClass,
    getClassType,
    getInterfaceMixin,
    getTypeClassHandle,
    markDerivedClass,
    registerClassType,
    type VfuncDescriptor,
    wrapHandle,
} from "./registry.js";
import {
    connectClosureSignal,
    type DeclaredSignalTypes,
    emitDeclaredSignal,
    getSignalBaseName,
    overrideSignalClassClosure,
    signalForHandlerName,
    type SignalHandler,
    signalIdFor,
} from "./signal.js";
import {
    TYPE_INTERFACE,
    TYPE_INVALID,
    TYPE_NONE,
    type TypedClass,
    typeFundamental,
    typeInterfacePrerequisites,
    typeInterfaces,
    typeIsA,
    typeName,
} from "./type.js";
import { findClassVfuncDescriptor, findInterfaceVfuncDescriptor } from "./vfunc.js";

/** A generated interface value, such as `Gio.ListModel`, accepted by {@link registerClass}. */
type Interface<TImpl> = AnyClass & {
    /** Type-level slot holding the interface's `Impl` type; no value ever carries it. */
    __impl__: (impl: Partial<TImpl> & object) => void;
};

/** Converts underscores in a property name to canonical dashes. */
type Dashed<TName extends string> = TName extends `${infer THead}_${infer TTail}`
    ? Dashed<`${THead}-${TTail}`>
    : TName;

/** Converts a dashed property name to its JavaScript spelling. */
type Camelized<TName extends string> = TName extends `${infer THead}-${infer TTail}`
    ? `${THead}${Capitalize<Camelized<TTail>>}`
    : TName;

/** Property-map keys in the camelCase spelling hooks use. */
type InstalledNames<TProperties> = string extends keyof TProperties
    ? never
    : Camelized<Dashed<keyof TProperties & string>>;

/** Declared signal names in their original and canonical spellings. */
type DeclaredSignalBase<TSignals> = (keyof TSignals & string) | Dashed<keyof TSignals & string>;
/** Declared signal names, including detailed forms. */
type DeclaredSignalName<TSignals> = DeclaredSignalBase<TSignals> | `${DeclaredSignalBase<TSignals>}::${string}`;

/** Signal methods added for declared names. */
type DeclaredSignalMethods<TSignals> = {
    /** Type-level map used by signal hooks. */
    __signals__?: Record<DeclaredSignalBase<TSignals>, (...args: never[]) => unknown>;
    /** Connects a handler. */
    connect(
        signal: DeclaredSignalName<TSignals>,
        handler: (...args: never[]) => unknown,
        isAfter?: boolean,
    ): number;
    /** Emits a signal. */
    emit(sigName: DeclaredSignalName<TSignals>, ...args: unknown[]): unknown;
    /** Connects a removable handler. */
    on(sigName: DeclaredSignalName<TSignals>, callback: (...args: unknown[]) => unknown, isAfter?: boolean): unknown;
    /** Connects a one-shot handler. */
    once(sigName: DeclaredSignalName<TSignals>, callback: (...args: unknown[]) => unknown, isAfter?: boolean): unknown;
    /** Disconnects a handler. */
    off(sigName: DeclaredSignalName<TSignals>, callback: (...args: unknown[]) => unknown): unknown;
};

/** A registered instance with declared signal methods and property metadata. */
type RegisteredInstance<TInstance, TProperties, TSignals> = TInstance &
    DeclaredSignalMethods<TSignals> & {
        /** Type-level map from installed property name to value type; no value ever carries it. */
        __properties__: Pick<TInstance, InstalledNames<TProperties> & keyof TInstance>;
    };

/** A registered class's construct signature and prototype. */
type RegisteredConstructor<TClass, TArgs extends unknown[], TInstance> = {
    /** Object the class's instances inherit from. */
    prototype: TInstance;
} & (TClass extends new (...args: never) => unknown
    ? new (...args: TArgs) => TInstance
    : abstract new (...args: TArgs) => TInstance);

/** The statics a registered class keeps from the class it was, joined with {@link RegisteredConstructor}. */
type RegisteredParts<TClass, TArgs extends unknown[], TInstance> = Omit<TClass, "prototype"> &
    RegisteredConstructor<TClass, TArgs, TInstance>;

/** The registered class with its declared properties and signals. */
type RegisteredClass<TClass extends AnyClass, TProperties, TSignals> =
    TClass extends abstract new (...args: infer TArgs) => infer TInstance
        ? RegisteredParts<TClass, TArgs, RegisteredInstance<TInstance, TProperties, TSignals>>
        : never;

/** A numeric GType or a generated or registered wrapper class. */
type SignalGType = bigint | AnyClass<TypedClass>;

/** A signal installed by {@link registerClass}. */
type SignalSpec = {
    /** `GObject.SignalFlags` bit mask, defaulting to `RUN_FIRST`. */
    flags?: number;
    /** Argument GTypes, defaulting to none. */
    paramTypes?: SignalGType[];
    /** Return GType, defaulting to none. */
    returnType?: SignalGType;
    /** Combines handler results; omitted means the last result wins. */
    accumulator?: "first-wins" | "true-handled";
};

/** What {@link registerClass} adds to the new GType beyond the vtable slots it discovers on the class. */
type RegisterClassOptions<
    TInstance extends object,
    TProperties extends Record<string, PropertySpec>,
    TSignals extends Record<string, SignalSpec>,
> = {
    /** Registered GType name, defaulting to the class name. */
    typeName?: string;
    /** Prevents direct construction while allowing registered subclasses. */
    abstract?: boolean;
    /** CSS node name for a `Gtk.Widget` subclass. */
    cssName?: string;
    /**
     * Runs once after registration with the wrapped class struct. An exception propagates after
     * the static GType has already been registered and cannot be undone.
     */
    classInit?(typeStruct: object): void;
    /** Interfaces implemented through matching `vfunc` methods. */
    implements?: Interface<TInstance>[];
    /**
     * ParamSpecs keyed by their JavaScript property names. Keys and ParamSpec names must canonicalize
     * to the same member. Writes validate flags, types, and ranges and notify only on changes.
     * Nullish values require a nullable GType; constructor `undefined` means omitted. An existing
     * camelCase accessor remains authoritative.
     */
    properties?: TProperties;
    /**
     * New canonical signal names and specs. Declared GTypes validate emissions, and a matching
     * `on<SignalName>` method becomes the default handler.
     */
    signals?: TSignals;
};

/** {@link RegisterClassOptions} with the widest instance and property types {@link registerClass} accepts. */
type AnyRegisterClassOptions = RegisterClassOptions<object, Record<string, PropertySpec>, Record<string, SignalSpec>>;
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
type DeclaredSignals = { native: NativeRegisterClassSignal[]; table: Map<string, DeclaredSignalTypes> };

type SignalMethodHost = {
    connect?: (signal: string, handler: SignalHandler, isAfter?: boolean) => number;
    emit?: (sigName: string, ...args: unknown[]) => unknown;
};

const INSTANCE_ARG_INDEX = 0;
const VALUE_ARG_INDEX = 2;
const TEARDOWN_VFUNC_NAMES: Set<string> = new Set(["dispose", "finalize"]);
const ASYNC_INITABLE_TYPE_NAME = "GAsyncInitable";
const INIT_ASYNC_METHOD_NAME = "vfuncInitAsync";

const PROPERTY_VFUNC_SPECS: PropertyVfuncSpec[] = [
    { methodName: GET_PROPERTY_VFUNC, isValueOut: true, makeDispatch: makeGetProperty },
    { methodName: SET_PROPERTY_VFUNC, isValueOut: false, makeDispatch: makeSetProperty },
];

const PROPERTY_VFUNC_NAMES: Set<string> = new Set(PROPERTY_VFUNC_SPECS.map((spec) => spec.methodName));
const VFUNC_METHOD_PATTERN = /^vfunc[A-Z0-9]/;
const TYPE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9\-_+]{2,}$/;
const UPPER_CASE_PATTERN = /[A-Z]/;
const SIGNAL_OVERRIDE_PATTERN = /^on[A-Z]/;

/**
 * Registers a wrapper subclass as a GType with discovered vfuncs, properties, signals, and interfaces.
 * Vfuncs must be prototype methods; function-valued fields never reach the vtable. A matching
 * `on<SignalName>` method becomes the signal's default handler.
 *
 * `vfuncConstructed` runs before field initializers and the constructor body. Native-created
 * instances never run the JavaScript constructor, so native-required state belongs in properties
 * or `vfuncConstructed`. A new `Gio.AsyncInitable` must implement `vfuncInitAsync`.
 *
 * @param klass The wrapper subclass to register.
 * @param options Additional GType configuration.
 * @returns The registered class with declared properties and signals in its type.
 * @throws For invalid parents, names, interfaces, vfuncs, properties, signals, or widget options.
 * A `classInit` exception propagates after the static type has been registered and cannot be undone.
 */
function registerClass<
    T extends AnyClass,
    TProperties extends Record<string, PropertySpec> = Record<never, PropertySpec>,
    TSignals extends Record<string, SignalSpec> = Record<never, SignalSpec>,
>(
    klass: T,
    options?: RegisterClassOptions<T["prototype"], TProperties, TSignals>,
): RegisteredClass<T, TProperties, TSignals>;

function registerClass(klass: AnyClass, options: AnyRegisterClassOptions = {}): AnyClass {
    const parentType = resolveParentType(klass);

    if (parentType === TYPE_INVALID) {
        throw new TypeError(`registerClass: ${klass.name} must extend a registered wrapper class`);
    }

    const name = resolveTypeName(klass, options);
    const declaredTypes = resolveInterfaceTypes(klass, options.implements ?? []);
    assertInterfacePrerequisites(klass, parentType, declaredTypes);
    const adoptedTypes = declaredTypes.filter((gtype) => !typeIsA(parentType, gtype));
    const properties = options.properties ?? {};
    const signals = resolveDeclaredSignals(klass, options.signals ?? {});
    const members = collectInstanceMembers(klass);
    const { methods, inheritedNames } = members;
    checkAsyncInitable(klass, adoptedTypes, methods);
    const dispatch = buildPropertyDispatch({ klass, properties, adoptedTypes });

    const classVfuncs = [
        ...discoverClassVfuncs(klass, methods),
        ...propertyVfuncs({ klass, methods, dispatch, adoptedTypes }),
    ];

    const claimedMethodNames = new Set(classVfuncs.map((vfunc) => vfunc.methodName));
    const interfaceBindings = discoverInterfaceBindings(methods, parentType, declaredTypes, claimedMethodNames);
    assertClaimedVfuncs(klass, methods, claimedMethodNames, interfaceBindings);

    const nativeOptions = withNativeSignals(
        toNativeOptions(classVfuncs, interfaceBindings, properties, options),
        signals.native,
    );

    const newType: bigint = nativeRegisterClass(name, parentType, nativeOptions);
    registerClassType(klass, newType);
    markDerivedClass(klass);
    installSignalOverrides(newType, methods);
    applyInterfaceMixins(klass, adoptedTypes, inheritedNames);
    installDeclaredSignalMethods(klass, signals.table, members.names);
    invokeClassInit(options, newType);

    return klass;
}

function invokeClassInit(options: AnyRegisterClassOptions, newType: bigint): void {
    if (options.classInit === undefined) {
        return;
    }

    const structClass = getClassStructClass(newType);

    if (structClass === undefined) {
        throw new Error("registerClass: no ancestor of the new type registers a class struct wrapper");
    }

    options.classInit(wrapHandle(getTypeClassHandle(newType), structClass));
}

function resolveTypeName(klass: AnyClass, options: AnyRegisterClassOptions): string {
    const name = options.typeName ?? klass.name;

    if (!name) {
        throw new TypeError("registerClass: cannot derive a GType name (anonymous class with no typeName option)");
    }

    if (!TYPE_NAME_PATTERN.test(name)) {
        throw new TypeError(
            `registerClass: '${name}' is not a valid GType name (a letter or underscore, then at ` +
            "least two more characters, all from A-Z, a-z, 0-9, '-', '_' and '+')",
        );
    }

    return name;
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

function checkAsyncInitable(klass: AnyClass, adoptedTypes: bigint[], methods: MethodTable): void {
    const isAsyncInitable = adoptedTypes.some((gtype) => typeName(gtype) === ASYNC_INITABLE_TYPE_NAME);

    if (isAsyncInitable && !methods.has(INIT_ASYNC_METHOD_NAME)) {
        throw new TypeError(
            `registerClass: ${klass.name} implements Gio.AsyncInitable without overriding 'vfuncInitAsync'; ` +
            "the default 'init_async' would run 'vfuncInit' on a worker thread",
        );
    }
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

const claimedVfuncNames = (
    claimedMethodNames: Set<string>,
    interfaceBindings: InterfaceVfuncBinding[],
): Set<string> => {
    const claimed = new Set(claimedMethodNames);

    for (const binding of interfaceBindings) {
        for (const vfunc of binding.vfuncs) {
            claimed.add(vfunc.methodName);
        }
    }

    return claimed;
};

const isPrerequisiteMet = (parentType: bigint, declaredTypes: bigint[], prerequisite: bigint): boolean =>
    typeIsA(parentType, prerequisite) || declaredTypes.includes(prerequisite);

function assertPrerequisitesFor(klass: AnyClass, parentType: bigint, declaredTypes: bigint[], iface: bigint): void {
    for (const prerequisite of typeInterfacePrerequisites(iface)) {
        if (!isPrerequisiteMet(parentType, declaredTypes, prerequisite)) {
            throw new TypeError(
                `registerClass: ${klass.name} does not meet prerequisite ` +
                `'${typeName(prerequisite) ?? String(prerequisite)}' of interface ` +
                `'${typeName(iface) ?? String(iface)}'`,
            );
        }
    }
}

function assertInterfacePrerequisites(klass: AnyClass, parentType: bigint, declaredTypes: bigint[]): void {
    for (const iface of declaredTypes) {
        assertPrerequisitesFor(klass, parentType, declaredTypes, iface);
    }
}

function assertClaimedVfuncs(
    klass: AnyClass,
    methods: MethodTable,
    claimedMethodNames: Set<string>,
    interfaceBindings: InterfaceVfuncBinding[],
): void {
    const claimed = claimedVfuncNames(claimedMethodNames, interfaceBindings);

    for (const methodName of methods.keys()) {
        if (VFUNC_METHOD_PATTERN.test(methodName) && !claimed.has(methodName)) {
            throw new Error(
                `registerClass: ${klass.name}.${methodName} matches no vtable slot on any ancestor ` +
                "or implemented interface, so the override would never be called; check the name against " +
                "the parent class's virtual methods",
            );
        }
    }
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

const canonicalSignalName = (name: string): string => name.replaceAll("_", "-");

function assertLowerCaseSignalName(klass: AnyClass, name: string): void {
    if (!UPPER_CASE_PATTERN.test(name)) {
        return;
    }

    throw new TypeError(
        `registerClass: ${klass.name} declares the signal '${name}'; GObject would carry it under that ` +
        "exact spelling, out of reach of both its dashed spelling and its default handler; " +
        `declare it as '${kebabCase(name)}'`,
    );
}

function overriddenSignalId(type: bigint, methodName: string): number {
    if (!SIGNAL_OVERRIDE_PATTERN.test(methodName)) {
        return 0;
    }

    const signal = signalForHandlerName(type, methodName);

    return signal === undefined ? 0 : signalIdFor(type, signal);
}

function installSignalOverrides(newType: bigint, methods: MethodTable): void {
    for (const [methodName, fn] of methods) {
        const signalId = overriddenSignalId(newType, methodName);

        if (signalId === 0) {
            continue;
        }

        const handler = fn as (...args: unknown[]) => unknown;

        overrideSignalClassClosure(newType, signalId, (...args: unknown[]) =>
            handler.apply(args[0], args.slice(1)),
        );
    }
}

function resolveSignalGType(klass: AnyClass, signalName: string, role: string, entry: SignalGType): bigint {
    if (typeof entry === "bigint") {
        return entry;
    }

    const gtype = getClassType(entry);

    if (gtype === TYPE_INVALID) {
        throw new TypeError(
            `registerClass: signal '${signalName}' of ${klass.name} names a class with no registered ` +
            `GType as its ${role}`,
        );
    }

    return gtype;
}

function resolveSignalReturnType(klass: AnyClass, name: string, spec: SignalSpec): bigint | undefined {
    if (spec.returnType === undefined) {
        return undefined;
    }

    const returnType = resolveSignalGType(klass, name, "return type", spec.returnType);

    return returnType === TYPE_NONE ? undefined : returnType;
}

function resolveDeclaredSignal(
    klass: AnyClass,
    name: string,
    spec: SignalSpec,
): { native: NativeRegisterClassSignal; declared: DeclaredSignalTypes } {
    const paramTypes = (spec.paramTypes ?? []).map((entry, index) =>
        resolveSignalGType(klass, name, `parameter ${String(index)}`, entry),
    );

    const returnType = resolveSignalReturnType(klass, name, spec);
    const native: NativeRegisterClassSignal = { name, paramTypes };
    const declared: DeclaredSignalTypes = { paramTypes };

    if (spec.flags !== undefined) {
        native.flags = spec.flags;
    }

    if (spec.accumulator !== undefined) {
        native.accumulator = spec.accumulator;
    }

    if (returnType !== undefined) {
        native.returnType = returnType;
        declared.returnType = returnType;
    }

    return { native, declared };
}

function resolveDeclaredSignals(klass: AnyClass, signals: Record<string, SignalSpec>): DeclaredSignals {
    const native: NativeRegisterClassSignal[] = [];
    const table: Map<string, DeclaredSignalTypes> = new Map();

    for (const [name, spec] of Object.entries(signals)) {
        assertLowerCaseSignalName(klass, name);
        const resolved = resolveDeclaredSignal(klass, name, spec);
        native.push(resolved.native);
        table.set(canonicalSignalName(name), resolved.declared);
    }

    return { native, table };
}

function inheritedSignalMethod<T>(inherited: T | undefined, signal: string): T {
    if (inherited === undefined) {
        throw new Error(`Unknown signal '${signal}'`);
    }

    return inherited;
}

function installDeclaredConnect(
    proto: SignalMethodHost,
    findDeclared: (signal: string) => DeclaredSignalTypes | undefined,
): void {
    const inheritedConnect = proto.connect;

    proto.connect = function connect(
        this: object,
        signal: string,
        handler: SignalHandler,
        isAfter?: boolean,
    ): number {
        if (findDeclared(signal) === undefined) {
            return inheritedSignalMethod(inheritedConnect, signal).call(this, signal, handler, isAfter);
        }

        return connectClosureSignal(this, signal, handler, isAfter ?? false);
    };
}

function installDeclaredEmit(
    proto: SignalMethodHost,
    findDeclared: (signal: string) => DeclaredSignalTypes | undefined,
): void {
    const inheritedEmit = proto.emit;

    proto.emit = function emit(this: object, sigName: string, ...args: unknown[]): unknown {
        const declared = findDeclared(sigName);

        if (declared === undefined) {
            return inheritedSignalMethod(inheritedEmit, sigName).call(this, sigName, ...args);
        }

        return emitDeclaredSignal(this, sigName, declared, args);
    };
}

function installDeclaredSignalMethods(
    klass: AnyClass,
    table: Map<string, DeclaredSignalTypes>,
    definedNames: Set<string>,
): void {
    if (table.size === 0) {
        return;
    }

    const proto = klass.prototype as SignalMethodHost;

    const findDeclared = (signal: string): DeclaredSignalTypes | undefined =>
        table.get(canonicalSignalName(getSignalBaseName(signal)));

    if (!definedNames.has("connect")) {
        installDeclaredConnect(proto, findDeclared);
    }

    if (!definedNames.has("emit")) {
        installDeclaredEmit(proto, findDeclared);
    }
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

function withNativeSignals(
    options: NativeRegisterClassOptions | undefined,
    signals: NativeRegisterClassSignal[],
): NativeRegisterClassOptions | undefined {
    if (signals.length === 0) {
        return options;
    }

    return { ...options, signals };
}

function applyNativeTypeOptions(options: NativeRegisterClassOptions, source: AnyRegisterClassOptions): void {
    if (source.abstract ?? false) {
        options.abstract = true;
    }

    if (source.cssName !== undefined) {
        options.cssName = source.cssName;
    }
}

function toNativeOptions(
    classVfuncs: DiscoveredVfunc[],
    interfaceBindings: InterfaceVfuncBinding[],
    properties: Record<string, PropertySpec>,
    source: AnyRegisterClassOptions,
): NativeRegisterClassOptions | undefined {
    const options: NativeRegisterClassOptions = {};
    applyNativeTypeOptions(options, source);

    if (Object.keys(properties).length > 0) {
        options.properties = toNativeProperties(properties);
    }

    if (classVfuncs.length > 0) {
        options.vfuncs = [...classVfuncs];
    }

    if (interfaceBindings.length > 0) {
        options.interfaces = interfaceBindings.map((binding) => toNativeInterface(binding));
    }

    return Object.keys(options).length > 0 ? options : undefined;
}

export { type Interface, registerClass, type SignalGType, type SignalSpec };
