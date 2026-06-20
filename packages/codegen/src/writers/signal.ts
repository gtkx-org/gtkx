import { quote, toCamelCase, toPascalCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent, renderBlock, renderBracedOrEmpty } from "../dsl/emit.js";
import type { GirClass } from "../gir/class.js";
import type { GirParameter } from "../gir/parameter.js";
import { isCallerAllocatedOut, isOutParameter } from "../gir/parameter.js";
import type { GirProperty } from "../gir/property.js";
import type { GirSignal } from "../gir/signal.js";
import { splitOptionalNamespace } from "../gir/type-ref.js";
import {
    collectInterfaceProperties,
    forEachAncestor,
    resolveImplementedInterface,
    resolvePrerequisiteReference,
} from "./inheritance.js";
import { isBoxedCallerOut, isBoxedInout } from "./param-marshal.js";
import { renderHandlerParameters } from "./param-structure.js";
import { renderTsType } from "./ts-type.js";
import { isCellInout, omitsPrimaryReturn, renderFfiType, renderHandlerArgType } from "./value.js";

const SIGNAL_HANDLER_TYPE = "(...args: any[]) => any";

/**
 * A signal collected for emission. Its parameter and return references are
 * interned handles that already carry their declaring namespace, so a signal
 * flattened from an implemented interface resolves identically to an own one.
 */
type CollectedSignal = {
    readonly signal: GirSignal;
};

/**
 * Renders the `connect` and `emit` instance methods for a class that owns or
 * inherits-by-interface at least one signal.
 *
 * Each method is a `switch` over the type's own signals, keyed by the bare
 * signal name `signalBaseName` strips any `::detail` suffix down to. `connect`
 * resolves the per-signal callback descriptor, wraps the handler, and hands it to the
 * thin `connectGobjectSignal` wrapper around the non-introspectable
 * `g_signal_connect_data`. `emit` builds the per-signal `EmitArg[]` argument
 * literal and delegates to `emitGobjectSignal`, which marshals the arguments
 * into a `GValue` array, resolves the signal id and the `::detail` quark,
 * dispatches `g_signal_emitv`, and assembles the tuple result. Unknown signals
 * route up the class chain via `super.connect` / `super.emit`; the root
 * `GObject.Object` throws because it bottoms out the hierarchy.
 *
 * Returns an empty array when the class contributes no signals of its own.
 *
 * @param context - The module context
 * @param klass - The class whose signal methods to render
 */
export const renderSignalMembers = (context: ModuleContext, klass: GirClass): readonly string[] => {
    if (klass.glibGetType === undefined) return [];
    const signals = collectClassSignals(context, klass);
    if (signals.length === 0) return [];
    const isRootObject = context.namespace.name === "GObject" && klass.name === "Object";

    context.addRuntimeImport("connectGobjectSignal");
    context.addRuntimeImport("signalBaseName");
    context.addRuntimeImport("t");

    const connectCases = signals.map((collected) => renderConnectCase(context, collected));
    const emitCases = signals.map((collected) => renderEmitCase(context, collected));
    const connectDefault = isRootObject
        ? `default:\n    throw new globalThis.Error("Unknown signal '" + signal + "'");`
        : "default:\n    return super.connect(signal, handler, after);";
    const emitDefault = isRootObject
        ? `default:\n    throw new globalThis.Error("Unknown signal '" + sigName + "'");`
        : "default:\n    return super.emit(sigName, ...args);";

    const connectSwitch = `switch (signalBaseName(signal)) {\n${indent([...connectCases, connectDefault].join("\n"), 1)}\n}`;
    const emitSwitch = `switch (signalBaseName(sigName)) {\n${indent([...emitCases, emitDefault].join("\n"), 1)}\n}`;

    return [
        renderBlock(`connect(signal: string, handler: ${SIGNAL_HANDLER_TYPE}, after?: boolean): number`, connectSwitch),
        renderBlock(`emit(sigName: string, ...args: unknown[]): unknown`, emitSwitch),
    ];
};

/** The interface-name suffix carrying a type's per-signal handler map. */
const SIGNAL_HANDLERS_SUFFIX = "SignalHandlers";
const SIGNAL_EMIT_SUFFIX = "SignalEmit";

/**
 * Renders the module-level declarations that type a class's signal-connection
 * surface: a `<Class>SignalHandlers` map keyed by signal name, a parallel
 * `<Class>SignalEmit` map giving each signal's `emit` arguments and result, and —
 * when the class introduces signals or properties of its own — a declaration-merged
 * `interface <Class>` whose `connect`/`on`/`once`/`off` overloads narrow the
 * handler off the handler map and whose `emit` overload narrows the arguments and
 * result off the emit map. Both maps additionally carry a `notify::<property>` key per
 * introduced property — valued by the `notify` member of `GObject.Object`'s map — so a
 * property's change notification is typed like any other signal; the untyped `string`
 * signature still covers dynamic and unknown detail names. A type introducing properties
 * but no signals gains its own interface for the same reason: the parent's overloads are
 * pinned to the parent's map and cannot see the child's added keys.
 *
 * `emit` needs its own map because a caller-allocated out-parameter is a handler
 * argument (the handler fills it in place) but an `emit` result (the runtime
 * allocates it and returns it), so the two shapes diverge. Each map `extends` its
 * parent's (or the `GObject.Object` map for an interface wrapper, whose runtime
 * class extends `GObject.Object`) so each type lists only the signals it
 * introduces while `keyof` resolves the full inherited set. The runtime
 * `connect`/`emit` switch {@link renderSignalMembers} renders is unchanged; these
 * declarations are erased from the emitted `.js`.
 *
 * @param context - The module context
 * @param klass - The class or interface being emitted
 * @param className - The local PascalCase type name
 * @param parentlessExtendsObject - Whether a parentless type extends
 *   `GObject.Object` (interfaces do; the root `GObject.Object` does not)
 */
export const renderSignalDeclarations = (
    context: ModuleContext,
    klass: GirClass,
    className: string,
    parentlessExtendsObject: boolean,
): readonly string[] => {
    const base = { context, klass, className, parentlessExtendsObject };
    const declarations = [
        renderSignalMap({ ...base, suffix: SIGNAL_HANDLERS_SUFFIX, renderEntry: renderSignalHandlerType }),
        renderSignalMap({ ...base, suffix: SIGNAL_EMIT_SUFFIX, renderEntry: renderSignalEmitEntry }),
    ];
    if (
        klass.glibGetType !== undefined &&
        (collectClassSignals(context, klass).length > 0 || collectNotifyDetails(context, klass).length > 0)
    ) {
        const isRootObject = context.namespace.name === "GObject" && klass.name === "Object";
        declarations.push(renderSignalConnectInterface(className, isRootObject));
    }
    return declarations;
};

/** Inputs for {@link renderSignalMap}: where the map is emitted and what each entry renders to. */
type SignalMapSpec = {
    readonly context: ModuleContext;
    readonly klass: GirClass;
    readonly className: string;
    readonly parentlessExtendsObject: boolean;
    readonly suffix: string;
    readonly renderEntry: (context: ModuleContext, collected: CollectedSignal) => string;
};

/**
 * Renders an `export interface <Class><Suffix>` map, one entry per signal the
 * class introduces, extending the parent type's map (or, for an interface
 * wrapper, its prerequisites' maps) so inherited signals resolve through
 * `keyof`. `renderEntry` renders each signal's value type — a handler function
 * for the handler map, an `{ args; result }` shape for the emit map.
 */
const renderSignalMap = (spec: SignalMapSpec): string => {
    const { context, klass, className, parentlessExtendsObject, suffix, renderEntry } = spec;
    const extendsRefs = signalMapParentRefs(context, klass, parentlessExtendsObject, suffix);
    const extendsClause = extendsRefs.length === 0 ? "" : ` extends ${extendsRefs.join(", ")}`;
    const signalEntries = collectClassSignals(context, klass).map(
        (collected) => `${quote(collected.signal.name)}: ${renderEntry(context, collected)};`,
    );
    const entries = [...signalEntries, ...renderNotifyDetailEntries(context, klass, suffix)];
    const body = entries.length === 0 ? "" : `\n${indent(entries.join("\n"), 1)}\n`;
    return `export interface ${className}${suffix}${extendsClause} {${body}}`;
};

/**
 * Renders the `notify::<property>` detail entries for a class's signal map: one
 * entry per property the class introduces, keyed by the canonical kebab-case
 * detailed name and valued by `GObject.Object`'s `notify` member of the same
 * suffix — the handler type in a `SignalHandlers` map, the `{ args; result }`
 * shape in a `SignalEmit` map. Returns an empty array when the class introduces
 * no properties.
 *
 * @param context - The module context
 * @param klass - The class whose introduced properties seed the detail entries
 * @param suffix - The signal-map suffix (`SignalHandlers` or `SignalEmit`)
 */
const renderNotifyDetailEntries = (context: ModuleContext, klass: GirClass, suffix: string): readonly string[] => {
    const notifyValue = `${gobjectObjectMapRef(context, suffix)}["notify"]`;
    return collectNotifyDetails(context, klass).map((name) => `${quote(`notify::${name}`)}: ${notifyValue};`);
};

/**
 * Resolves the `<Parent><Suffix>` references a type's signal map extends: the
 * parent class's map (qualified across namespaces), the prerequisite types'
 * maps for an interface wrapper — so a value typed as the interface stays
 * assignable to its prerequisites despite the `__signals__` member — falling
 * back to the `GObject.Object` map, or no reference for the root
 * `GObject.Object`.
 */
const signalMapParentRefs = (
    context: ModuleContext,
    klass: GirClass,
    parentlessExtendsObject: boolean,
    suffix: string,
): readonly string[] => {
    if (klass.parent !== undefined) {
        const [parentNamespace, typeName] = splitOptionalNamespace(klass.parent);
        const namespaceName = parentNamespace ?? context.namespace.name;
        const name = `${toPascalCase(typeName)}${suffix}`;
        if (namespaceName === context.namespace.name) return [name];
        return [`${context.addCrossNamespaceImport(namespaceName)}.${name}`];
    }
    if (!parentlessExtendsObject) return [];
    const prerequisiteRefs = klass.prerequisites
        .map((name) => resolvePrerequisiteReference(context, name))
        .filter((entry): entry is string => entry !== undefined)
        .map((entry) => `${entry}${suffix}`);
    if (prerequisiteRefs.length > 0) return prerequisiteRefs;
    return [gobjectObjectMapRef(context, suffix)];
};

/**
 * Resolves the reference to `GObject.Object`'s signal map of the given suffix:
 * the bare local name within the `GObject` namespace, or the cross-namespace
 * `<GObjectAlias>.Object<Suffix>` elsewhere. The `notify::<prop>` detail entries
 * reuse this map's `notify` member as their value type.
 *
 * @param context - The module context
 * @param suffix - The signal-map suffix (`SignalHandlers` or `SignalEmit`)
 */
const gobjectObjectMapRef = (context: ModuleContext, suffix: string): string => {
    if (context.namespace.name === "GObject") return `Object${suffix}`;
    return `${context.addCrossNamespaceImport("GObject")}.Object${suffix}`;
};

/**
 * Renders the declaration-merged `interface <Class>` carrying the typed
 * `connect`/`emit`/`on`/`once`/`off` overloads (with the
 * `addEventListener`/`removeEventListener` aliases mirroring node-gtk) and the
 * phantom `__signals__` member. `connect`/`on`/`once`/`off` and the aliases
 * narrow the handler off the `SignalHandlers` map; `emit` narrows its
 * arguments and result off the `SignalEmit` map, whose shape differs from a
 * handler for caller-allocated outs. The EventEmitter-style methods are
 * omitted for the root `GObject.Object`, whose untyped declarations live in
 * the hand-written override template; every subclass shadows them with typed
 * overloads. `__signals__` is an optional phantom member — never assigned at
 * runtime — that associates the instance type with its handler map so generic
 * consumers (e.g. `useSignal` in `@gtkx/react`) can resolve a type's signal
 * names and handler signatures without overload inference.
 */
const renderSignalConnectInterface = (className: string, isRootObject: boolean): string => {
    const map = `${className}${SIGNAL_HANDLERS_SUFFIX}`;
    const emitMap = `${className}${SIGNAL_EMIT_SUFFIX}`;
    const lines = [
        `readonly __signals__?: ${map};`,
        `connect<K extends keyof ${map}>(signal: K, handler: ${map}[K], after?: boolean): number;`,
        `connect(signal: string, handler: ${SIGNAL_HANDLER_TYPE}, after?: boolean): number;`,
        `emit<K extends keyof ${emitMap}>(sigName: K, ...args: ${emitMap}[K]["args"]): ${emitMap}[K]["result"];`,
        "emit(sigName: string, ...args: unknown[]): unknown;",
    ];
    if (!isRootObject) {
        for (const method of ["on", "once", "addEventListener"]) {
            lines.push(
                `${method}<K extends keyof ${map}>(signal: K, handler: ${map}[K], after?: boolean): this;`,
                `${method}(signal: string, handler: ${SIGNAL_HANDLER_TYPE}, after?: boolean): this;`,
            );
        }
        for (const method of ["off", "removeEventListener"]) {
            lines.push(
                `${method}<K extends keyof ${map}>(signal: K, handler: ${map}[K]): this;`,
                `${method}(signal: string, handler: ${SIGNAL_HANDLER_TYPE}): this;`,
            );
        }
    }
    return renderBracedOrEmpty(`export interface ${className}`, lines.join("\n"));
};

/**
 * Renders the TypeScript type of a signal's handler: `(in params) => result`,
 * mirroring the trampoline {@link renderInvokeClosure} marshals. The emitting
 * instance (trampoline arg 0) is not passed to the handler, so it is absent here;
 * out- and scalar-inout parameters surface through the result tuple
 * {@link renderResultType} encodes rather than the parameter list.
 */
const renderSignalHandlerType = (context: ModuleContext, collected: CollectedSignal): string => {
    const { signal } = collected;
    const params = renderHandlerParameters(signal.parameters, (ref, nullable) => renderTsType(context, ref, nullable));
    return `(${params.join(", ")}) => ${renderResultType(context, collected, false, true)}`;
};

/**
 * Assembles a signal's result type from its primary return and out-value types,
 * following the tuple convention `emitGobjectSignal` assembles: a single
 * value alone, `[primary, ...outs]` when both are present, the lone out alone, or
 * an out-only tuple. `optOut` adds `| undefined` for the value-only handler case,
 * where a handler may decline to produce a result; `emit` passes `false`, since it
 * always yields the concrete value.
 *
 * @param primary - The non-void return type, or `undefined` for a void return
 * @param outTypes - The out-value types, in declaration order
 * @param optOut - Whether the value-only case unions `| undefined`
 */
const assembleSignalResult = (primary: string | undefined, outTypes: readonly string[], optOut: boolean): string => {
    if (outTypes.length === 0) {
        if (primary === undefined) return "void";
        return optOut ? `${primary} | undefined` : primary;
    }
    if (primary !== undefined) return `[${primary}, ${outTypes.join(", ")}]`;
    return outTypes.length === 1 ? (outTypes[0] ?? "void") : `[${outTypes.join(", ")}]`;
};

/**
 * Renders a signal's result type, shared by the handler return (`optOut`,
 * `includeCallerAllocated: false`) and the `emit` result (`includeCallerAllocated`,
 * no `optOut`). Caller-allocated outs join the `emit` tuple — the runtime collects
 * them — whereas a handler fills them in place; `optOut` unions `| undefined` for
 * the value-only handler case. A `(skip)`-annotated return carries nothing a caller
 * needs, so it is dropped like a void return, exposing only the out-parameters.
 *
 * @param context - The module context
 * @param collected - The signal and the namespace its references resolve against
 * @param includeCallerAllocated - Whether caller-allocated outs join the tuple
 * @param optOut - Whether the value-only case unions `| undefined`
 */
const renderResultType = (
    context: ModuleContext,
    collected: CollectedSignal,
    includeCallerAllocated: boolean,
    optOut: boolean,
): string => {
    const { signal } = collected;
    const primary = omitsPrimaryReturn(context.repository, signal.returnValue)
        ? undefined
        : renderTsType(context, signal.returnValue.type, signal.returnValue.nullable);
    const outTypes = signal.parameters
        .filter(
            (parameter) =>
                !parameter.isVarargs &&
                (isOutParameter(parameter) ||
                    isCellInout(context, parameter) ||
                    (includeCallerAllocated && isCallerAllocatedOut(parameter))),
        )
        .map((parameter) => renderTsType(context, parameter.type, false));
    return assembleSignalResult(primary, outTypes, optOut);
};

/**
 * Renders one `<Class>SignalEmit` entry, `{ args; result }`. `args` is the labeled
 * tuple `emit` accepts — the handler parameters minus caller-allocated outs, which
 * `emit` allocates rather than receives. `result` is the tuple `emit` returns: the
 * non-void return value (never the handler's opt-out `undefined`) followed by
 * every out value, including caller-allocated outs the runtime collects through
 * `getBoxed`.
 *
 * @param context - The module context
 * @param collected - The signal and the namespace its references resolve against
 */
const renderSignalEmitEntry = (context: ModuleContext, collected: CollectedSignal): string => {
    const { signal } = collected;
    const args = renderHandlerParameters(
        signal.parameters,
        (ref, nullable) => renderTsType(context, ref, nullable),
        isCallerAllocatedOut,
    );
    const result = renderResultType(context, collected, true, false);
    return `{ args: [${args.join(", ")}]; result: ${result} }`;
};

/**
 * Renders one `connect` switch case: it resolves the signal's typed callback
 * and dispatches `g_signal_connect_data` through {@link connectGobjectSignal}
 * with the full detailed signal name. The handler is passed raw;
 * `connectGobjectSignal` wraps it with the shared `wrapHandler` using the
 * callback descriptor.
 */
const renderConnectCase = (context: ModuleContext, collected: CollectedSignal): string => {
    const { signal } = collected;
    const callback = renderCallback(context, collected);
    const body = `return connectGobjectSignal(this, signal, ${callback}, handler, after ?? false);`;
    return renderBlock(`case ${quote(signal.name)}:`, body);
};

/**
 * Renders one `emit` switch case: it describes each parameter's emission role —
 * a plain in-value, a scalar inout cell, a caller-allocated boxed out, or a
 * boxed inout shared in place — and hands the descriptors to
 * {@link emitGobjectSignal}, which marshals the `GValue` array, resolves the
 * signal id and detail, dispatches `g_signal_emitv`, and assembles the result.
 * Out-parameters consume no emit argument; in- and inout-parameters do. A
 * caller-allocated out-parameter that is not a boxed record — a raw buffer, or a
 * class with no boxed `GType` — throws, since the emit path has no `GType` to
 * source its storage.
 */
const renderEmitCase = (context: ModuleContext, collected: CollectedSignal): string => {
    const { signal } = collected;
    const params = signal.parameters.filter((parameter) => !parameter.isVarargs);
    if (params.some((parameter) => isCallerAllocatedOut(parameter) && !isBoxedCallerOut(context, parameter))) {
        return renderUnsupportedEmitCase(signal);
    }
    context.addRuntimeImport("emitGobjectSignal");

    let argIndex = 0;
    const argLiterals = params.map((parameter) => {
        const ffi = renderFfiType(context, parameter.type, parameter.transferOwnership);
        if (isOutParameter(parameter)) {
            return `{ ffi: ${ffi}, role: "out" }`;
        }
        if (isCellInout(context, parameter)) {
            return `{ ffi: ${ffi}, role: "inout", value: args[${argIndex++}] }`;
        }
        if (isCallerAllocatedOut(parameter)) {
            return `{ ffi: ${ffi}, role: "boxedOut", value: ${renderCallerOutAllocation(context, parameter)} }`;
        }
        if (isBoxedInout(context, parameter)) {
            return `{ ffi: ${ffi}, role: "boxedInout", value: args[${argIndex++}] }`;
        }
        return `{ ffi: ${ffi}, value: args[${argIndex++}] }`;
    });

    const isVoid = omitsPrimaryReturn(context.repository, signal.returnValue);
    const returnArg = isVoid
        ? ""
        : `, ${renderFfiType(context, signal.returnValue.type, signal.returnValue.transferOwnership)}`;
    const body = `return emitGobjectSignal(this, sigName, [${argLiterals.join(", ")}]${returnArg});`;

    return renderBlock(`case ${quote(signal.name)}:`, body);
};

/**
 * Renders an `emit` case that throws because the signal carries a
 * caller-allocated out-parameter the emit path cannot marshal — a raw buffer, or
 * a class with no boxed `GType` (only boxed records pass through
 * `outBoxedFromFfi`), so `emit()` has nowhere to source the storage.
 *
 * @param signal - The signal whose emit case throws
 */
const renderUnsupportedEmitCase = (signal: GirSignal): string => {
    const message = `emit() cannot allocate the caller-allocated out-parameter of '${signal.name}'`;
    return renderBlock(`case ${quote(signal.name)}:`, `throw new globalThis.Error(${quote(message)});`);
};

/**
 * Renders the `new Namespace.Type()` allocation for a caller-allocated boxed or
 * class out-parameter, qualifying the wrapper through its owning namespace.
 *
 * @param context - The module context
 * @param parameter - The caller-allocated out parameter (a named boxed/class)
 */
const renderCallerOutAllocation = (context: ModuleContext, parameter: GirParameter): string => {
    const name = parameter.type === undefined ? undefined : context.repository.nameOf(parameter.type);
    if (name === undefined) {
        throw new Error("renderCallerOutAllocation: expected a named caller-allocated out-parameter");
    }
    return `new ${context.qualify(name.namespaceName, name.typeName)}()`;
};

/**
 * Renders the `t.callback(...)` FFI descriptor a handler connects through.
 *
 * Each parameter renders via the shared {@link renderHandlerArgType}: a scalar
 * out/inout cell as `t.ref(...)` the native trampoline writes back, a
 * caller-allocated out boxed/struct marked so it is borrowed and filled in
 * place. The runtime {@link connectGobjectSignal} wraps the user handler with
 * the shared `wrapHandler` driven by this descriptor, so no per-signal invoke
 * closure is generated.
 */
const renderCallback = (context: ModuleContext, collected: CollectedSignal): string => {
    const { signal } = collected;
    const params = signal.parameters.filter((parameter) => !parameter.isVarargs);
    const callbackParamFfi = params.map((parameter) => renderHandlerArgType(context, parameter, parameter.type));
    const isVoid = omitsPrimaryReturn(context.repository, signal.returnValue);
    const returnFfi = isVoid
        ? "t.void"
        : renderFfiType(context, signal.returnValue.type, signal.returnValue.transferOwnership);
    const callbackArgs = ['t.object("borrowed")', ...callbackParamFfi, "t.void"].join(", ");
    return `t.callback([${callbackArgs}], ${returnFfi}, { hasDestroy: true, userDataIndex: ${params.length + 1} })`;
};

const collectClassSignals = (context: ModuleContext, klass: GirClass): readonly CollectedSignal[] => {
    const inheritedNames = collectInheritedSignalNames(context, klass);
    const seen = new Set<string>();
    const result: CollectedSignal[] = [];
    const consider = (signal: GirSignal): void => {
        const name = toCamelCase(signal.name);
        if (inheritedNames.has(name) || seen.has(name)) return;
        seen.add(name);
        result.push({ signal });
    };
    for (const signal of klass.signals) consider(signal);
    for (const implementName of klass.implements) {
        const iface = resolveImplementedInterface(context, implementName);
        if (iface === undefined) continue;
        for (const signal of iface.klass.signals) consider(signal);
    }
    return result;
};

/** A class member carrying a GIR `name` — the dedup key for inheritance flattening. */
type NamedMember = { readonly name: string };

/**
 * Collects the camelCased names of a class's inherited members of one kind:
 * those declared on any ancestor or flattened from an ancestor-implemented
 * interface. `select` picks the member list — signals or properties — off each
 * resolved class. Shared by the signal and `notify`-detail collectors so each
 * type's map lists only the members it introduces while `extends` resolves the
 * inherited remainder.
 *
 * @param context - The module context
 * @param klass - The class whose inherited member names to collect
 * @param select - Picks the member list off a resolved class
 */
const collectInheritedMemberNames = (
    context: ModuleContext,
    klass: GirClass,
    select: (source: GirClass) => readonly NamedMember[],
): ReadonlySet<string> => {
    const names = new Set<string>();
    forEachAncestor(context, klass, (ancestor, interfaces) => {
        for (const member of select(ancestor.klass)) names.add(toCamelCase(member.name));
        for (const iface of interfaces) {
            for (const member of select(iface.klass)) names.add(toCamelCase(member.name));
        }
    });
    return names;
};

const collectInheritedSignalNames = (context: ModuleContext, klass: GirClass): ReadonlySet<string> =>
    collectInheritedMemberNames(context, klass, (source) => source.signals);

/**
 * Collects the kebab-case names of the properties a class introduces — its own
 * declared properties and those flattened from directly-implemented interfaces,
 * minus any inherited from an ancestor — whose `notify::<name>` detailed signal
 * the class's connection surface should type. Mirrors {@link collectClassSignals}
 * so inherited property details resolve through the parent map's `extends` chain.
 *
 * @param context - The module context
 * @param klass - The class whose introduced property names to collect
 */
const collectNotifyDetails = (context: ModuleContext, klass: GirClass): readonly string[] => {
    const inherited = collectInheritedMemberNames(context, klass, (source) => source.properties);
    const seen = new Set<string>();
    const result: string[] = [];
    const consider = (property: GirProperty): void => {
        const name = toCamelCase(property.name);
        if (inherited.has(name) || seen.has(name)) return;
        seen.add(name);
        result.push(property.name);
    };
    for (const property of klass.properties) consider(property);
    for (const property of collectInterfaceProperties(context, klass)) consider(property);
    return result;
};
