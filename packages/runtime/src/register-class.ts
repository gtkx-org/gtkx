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
    typeInterfaces,
    typeIsA,
    typeName,
} from "./type.js";
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
 * `RegisterClassOptions.properties` in camelCase, whichever spelling it was written in.
 * A `properties` object given a type of its own rather than left to inference has `string` for its key
 * type and names nothing, because a name only known as `string` addresses no member in particular.
 */
type InstalledNames<TProperties> = string extends keyof TProperties
    ? never
    : Camelized<Dashed<keyof TProperties & string>>;

/**
 * The base names the signal surface takes for the signals `RegisterClassOptions.signals` declares:
 * each name as written, plus its canonical spelling with underscores turned into dashes, which
 * GObject knows the signal by too.
 */
type DeclaredSignalBase<TSignals> = (keyof TSignals & string) | Dashed<keyof TSignals & string>;
/**
 * The names `connect` and `emit` take for one of the signals `RegisterClassOptions.signals`
 * declares: each spelling of each name, plus its detailed form for a signal emitted with a
 * `::detail` suffix.
 */
type DeclaredSignalName<TSignals> = DeclaredSignalBase<TSignals> | `${DeclaredSignalBase<TSignals>}::${string}`;

/**
 * The `connect` and `emit` signatures instances gain for the signals
 * `RegisterClassOptions.signals` declares, widening the inherited ones, which take only the names
 * introspection knows. A class declaring no signals gains nothing, since no name reaches the
 * added signatures.
 */
type DeclaredSignalMethods<TSignals> = {
    /**
     * Type-level map from declared signal name to handler signature, feeding the hooks that
     * address a signal by name, such as `useSignal` from `@gtkx/react`; no value ever carries it.
     */
    __signals__?: Record<DeclaredSignalBase<TSignals>, (...args: never[]) => unknown>;
    /** Connects a handler to a signal `RegisterClassOptions.signals` declared. */
    connect(
        signal: DeclaredSignalName<TSignals>,
        handler: (...args: never[]) => unknown,
        isAfter?: boolean,
    ): number;
    /** Emits a signal `RegisterClassOptions.signals` declared. */
    emit(sigName: DeclaredSignalName<TSignals>, ...args: unknown[]): unknown;
    /** Connects a handler to a signal `RegisterClassOptions.signals` declared, for `off` to take off. */
    on(sigName: DeclaredSignalName<TSignals>, callback: (...args: unknown[]) => unknown, isAfter?: boolean): unknown;
    /** Connects a handler to a signal `RegisterClassOptions.signals` declared for one emission. */
    once(sigName: DeclaredSignalName<TSignals>, callback: (...args: unknown[]) => unknown, isAfter?: boolean): unknown;
    /** Disconnects a handler `on` or `once` connected to a signal `RegisterClassOptions.signals` declared. */
    off(sigName: DeclaredSignalName<TSignals>, callback: (...args: unknown[]) => unknown): unknown;
};

/**
 * An instance of a registered class: everything the class itself declares, plus the property map the
 * hooks that address a property by name, such as `useProperty` from `@gtkx/react`, read the installed
 * names off. Each name is typed with the value type the class declares for the member of that name,
 * so a property the class does not `declare` contributes nothing.
 */
type RegisteredInstance<TInstance, TProperties, TSignals> = TInstance &
    DeclaredSignalMethods<TSignals> & {
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

/** The statics a registered class keeps from the class it was, joined with {@link RegisteredConstructor}. */
type RegisteredParts<TClass, TArgs extends unknown[], TInstance> = Omit<TClass, "prototype"> &
    RegisteredConstructor<TClass, TArgs, TInstance>;

/**
 * The class {@link registerClass} hands back: the same class, with the same statics, whose instances
 * carry the properties `RegisterClassOptions.properties` installed and take the signals
 * `RegisterClassOptions.signals` declares by name. Binding the call to a name, rather than
 * discarding it, is what carries those names into the type system.
 */
type RegisteredClass<TClass extends AnyClass, TProperties, TSignals> =
    TClass extends abstract new (...args: infer TArgs) => infer TInstance
        ? RegisteredParts<TClass, TArgs, RegisteredInstance<TInstance, TProperties, TSignals>>
        : never;

/**
 * A GType in the form `RegisterClassOptions.signals` takes one: the numeric GType itself, such as
 * `TYPE_STRING` from `@gtkx/gi/gobject`, or a class carrying one, which is any generated wrapper
 * class and any class an earlier {@link registerClass} call registered.
 */
type SignalGType = bigint | AnyClass<TypedClass>;

/**
 * One signal `RegisterClassOptions.signals` creates on the new type, sitting under the signal's
 * name. Every part is optional: `{}` declares a signal with no arguments and no return value that
 * runs its handlers in the default `RUN_FIRST` stage.
 */
type SignalSpec = {
    /**
     * `GObject.SignalFlags` bit mask for the signal, defaulting to `RUN_FIRST`. `DETAILED` lets
     * handlers connect to and emissions name a `::detail` suffix.
     */
    flags?: number;
    /** GType of each argument an emission carries, defaulting to none. */
    paramTypes?: SignalGType[];
    /** GType of the value an emission returns, defaulting to none. */
    returnType?: SignalGType;
    /**
     * How the emission combines what its handlers return, limited to the accumulators GObject
     * ships: `"first-wins"` stops the emission at the first handler and keeps its result, and
     * `"true-handled"` runs handlers until one returns `true`, which requires a boolean
     * `returnType`. Without one, every handler runs and the last result stands.
     */
    accumulator?: "first-wins" | "true-handled";
};

/** What {@link registerClass} adds to the new GType beyond the vtable slots it discovers on the class. */
type RegisterClassOptions<
    TInstance extends object,
    TProperties extends Record<string, PropertySpec>,
    TSignals extends Record<string, SignalSpec>,
> = {
    /**
     * Name to register the new GType under, defaulting to the class's own name. Either way the
     * name has to be a valid GType name: at least three characters, starting with a letter or
     * underscore, the rest letters, digits, `-`, `_` or `+`. Any other name throws a `TypeError`.
     */
    typeName?: string;
    /**
     * Registers the new GType abstract, the way `G_TYPE_FLAG_ABSTRACT` marks a C type: the class
     * still serves as a parent for further registered subclasses, which instantiate as usual, but
     * constructing it directly throws, whether from JavaScript or from a native caller.
     */
    abstract?: boolean;
    /**
     * Name instances of the new type carry in CSS, applied through `gtk_widget_class_set_css_name`
     * from inside the type's `class_init`, so every instance is born with it, wherever it is
     * created from. Requires the class to extend `Gtk.Widget`; registering a non-widget with a
     * `cssName` throws.
     */
    cssName?: string;
    /**
     * Hook run once, synchronously, while `registerClass` registers the type, after its
     * `class_init` has installed the vfuncs, properties and signals declared here. It receives the
     * new type's class struct wrapped in its generated GTypeStruct wrapper, so class-level setup
     * calls such as `Gtk.WidgetClass.installAction`, `Gtk.WidgetClass.addShortcut` and
     * `Gtk.WidgetClass.setLayoutManagerType` have somewhere to land. The wrapper serves the
     * members of every struct in the parent chain on one object: a widget subclass sees
     * `Gtk.WidgetClass` and `GObject.ObjectClass` members alike, so the parameter can be declared
     * as whichever of those types the hook needs. The class struct belongs to the type system for
     * the life of the process, so keeping the wrapper around past the hook is safe, if rarely
     * useful. An exception the hook throws propagates out of `registerClass`, with the type
     * already registered: GObject offers no way to unregister a static type.
     */
    classInit?(typeStruct: object): void;
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
     * has to carry a name that reads back as that same member, such as `dew-point`, or registration
     * throws: the ParamSpec's name is the one GObject emits `notify` with, and a name the key does
     * not spell reaches nothing that listens for it. A word starting with a digit is a word of its
     * own on either side of that reading, so `level2Depth` takes a ParamSpec named `level-2-depth`
     * as readily as one named `level2-depth`, the way `WebKit.Settings` names
     * `enable-2d-canvas-acceleration` for its `enable2dCanvasAcceleration` member. An uppercase
     * letter in the ParamSpec's own name is refused, since GObject notifies under that spelling
     * and nothing else reads it back. Every property gains prototype accessors, one for the key as
     * written, one for it with dashes turned into underscores and one for it in camelCase, each
     * unless the class already defines that name. They serve the value from storage of their own on
     * the instance, which is also what the type's `get_property` and `set_property` slots read and
     * write, so a value set from JavaScript, from `g_object_set_property` and at construction all
     * land in the same place.
     *
     * A write the ParamSpec would refuse throws rather than reaching GObject, which reports such a
     * write as a GLib critical and drops it: a `TypeError` for a read-only or construct-only
     * property and for a value of a type the property cannot hold, and a `RangeError` for a value
     * the ParamSpec rejects. The same checks run over a value handed to the constructor, where
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
     * what a write means, the other spellings forward to it, and the type's property slots read
     * and write it rather than the generated storage.
     */
    properties?: TProperties;
    /**
     * Signals to create on the new type, keyed by signal name and valued with the
     * {@link SignalSpec} describing each one. A name has to start with a lowercase letter, continue
     * in lowercase letters, digits, `-` and `_`, and be new to the type: one an ancestor type or a
     * listed interface already carries throws, and so does one carrying an uppercase letter, which
     * GObject would carry under that exact spelling, out of reach of both its dashed spelling and
     * its `on<SignalName>` default handler. Either word separator spells the same signal, so a
     * signal declared as `data_changed` is connected to and emitted as `data-changed` too.
     *
     * Instances connect and emit by name through the same `connect`, `on`, `once`, `off` and
     * `emit` surface inherited signals use: `registerClass` wraps `connect` and `emit` on the
     * class's prototype to serve the declared names, unless the class defines the member itself,
     * and hands every other name to the inherited implementation. A handler receives the
     * emission's arguments without the leading emitter, matching a generated signal, and what it
     * returns becomes the emission's return value when the signal declares one.
     *
     * The declared parameter GTypes rule the emission: `emit` takes exactly one argument per
     * declared parameter, throwing a `TypeError` for any other count, and converts each argument
     * into a `GValue` of the declared type, throwing for a value that type cannot hold. The signals
     * are created with no class closure of their own, but a method named `on<SignalName>`
     * becomes the signal's default handler, the way every `on`-prefixed method that names a
     * signal the type carries does; see {@link registerClass}.
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
const TYPE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9\-_+]{2,}$/;
const UPPER_CASE_PATTERN = /[A-Z]/;
const SIGNAL_OVERRIDE_PATTERN = /^on[A-Z]/;

/**
 * Registers a subclass of a wrapper class as a new GType, wiring up any class and interface
 * virtual functions it overrides, both for the interfaces it inherits and for the ones
 * `RegisterClassOptions.implements` names.
 *
 * Throws when the class does not extend a registered wrapper class, when it has no derivable type
 * name or the name is not a valid GType name, when an entry in
 * `RegisterClassOptions.implements` is not a registered interface, when a
 * listed interface has a prerequisite that neither the parent type nor another listed interface meets,
 * when the list names `Gio.AsyncInitable` as an interface the parent type does not already
 * implement and no method on the chain fills `vfuncInitAsync`, since the default `init_async`
 * would run `vfuncInit` on a worker thread, when an entry in
 * `RegisterClassOptions.properties` names its `GObject.ParamSpec` something the key it sits under
 * does not spell, when an entry in `RegisterClassOptions.signals` carries an invalid name, a name
 * spelled with an uppercase letter rather than dashed, a name the type already knows, a GType
 * that cannot hold a value, or an accumulator the spec does not admit, and when
 * `RegisterClassOptions.cssName` is
 * given for a class that does not extend `Gtk.Widget`. An exception thrown by
 * `RegisterClassOptions.classInit` also propagates, after the type has already been registered.
 *
 * A slot is filled from the `vfunc`-prefixed methods on the class's prototype chain, up to but not
 * including the registered ancestor the class extends, so a method an intermediate base class
 * declares fills a slot the same way one the class itself declares does. A slot nothing on that
 * chain fills is left untouched.
 *
 * Declare every slot as a method: a class field holding a function, such as `vfuncGetNItems = () => 1`,
 * is assigned to each instance after registration and never reaches the vtable.
 *
 * A method named `on<SignalName>` — the signal's name in camelCase after the `on`, so `onClicked`
 * for `clicked` and `onItemsChanged` for `items-changed` — becomes that signal's default handler
 * when the type carries the signal, whether an ancestor type or an implemented interface brings it
 * or `RegisterClassOptions.signals` declares it. The method is installed as a class-closure
 * override, so it runs on every emission, on the instances a native caller creates included, in
 * the stage the signal's flags name rather than alongside connected handlers. It receives the
 * emission's arguments without the leading emitter, with `this` bound to the emitter, and what it
 * returns becomes the emission's result when the signal declares one. The same discovery walks the
 * prototype chain vfunc discovery walks, and a subclass registering its own `on<SignalName>`
 * replaces the handler for its instances, where `super.on<SignalName>()` reaches the replaced one.
 * An `on`-prefixed method naming no signal the type carries is left alone as the ordinary method
 * it is.
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
