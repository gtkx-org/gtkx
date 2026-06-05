import { quote, toCamelCase, toPascalCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import type { GirClass } from "../gir/class.js";
import type { GirParameter } from "../gir/parameter.js";
import { isCallerAllocatedOut, isOutParameter } from "../gir/parameter.js";
import { splitQualifiedName } from "../gir/qualified-name.js";
import { qualifyTypeRef } from "../gir/qualify.js";
import type { GirSignal } from "../gir/signal.js";
import type { GirTypeRef, PrimitiveTypeRef } from "../gir/type-ref.js";
import { forEachAncestor, resolveImplementedInterface } from "./inheritance.js";
import { planTrampolineArgs, renderTupleWriteback } from "./method.js";
import { isBoxedCallerOut, isBoxedInout, isHandlePassing, renderHandlerParameters } from "./param-classify.js";
import { renderTsType } from "./ts-type.js";
import { isCellInout, renderFfiType } from "./value.js";

const SIGNAL_HANDLER_TYPE = "(...args: any[]) => any";

/**
 * A signal together with the namespace its parameter and return references
 * belong to. Own signals carry the class's namespace; signals flattened from
 * an implemented interface carry the interface's namespace so their references
 * resolve correctly.
 */
type CollectedSignal = {
    readonly signal: GirSignal;
    readonly namespaceName: string;
};

/** The generated marshalling references a class's inline `emit` switch uses. */
type GObjectRefs = {
    readonly Value: string;
    readonly signalEmitv: string;
    readonly signalLookup: string;
};

/**
 * Renders the `connect` and `emit` instance methods for a class that owns or
 * inherits-by-interface at least one signal.
 *
 * Each method is a `switch` over the type's own signals. `connect` resolves the
 * per-signal trampoline, wraps the handler, and hands it to the thin
 * `connectSignal` wrapper around the non-introspectable `g_signal_connect_data`.
 * `emit` marshals the arguments into `GValue`s with `valueFromFfi` and calls the
 * generated `signalLookup` / `signalEmitv` directly. Unknown signals route up
 * the class chain via `super.connect` / `super.emit`; the root `GObject.Object`
 * throws because it bottoms out the hierarchy.
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

    context.addRuntimeImport("connectSignal");
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
    const emitSwitch = `switch (sigName) {\n${indent([...emitCases, emitDefault].join("\n"), 1)}\n}`;

    return [
        `connect(signal: string, handler: ${SIGNAL_HANDLER_TYPE}, after?: boolean): number {\n${indent(connectSwitch, 1)}\n}`,
        `emit(sigName: string, ...args: unknown[]): unknown {\n${indent(emitSwitch, 1)}\n}`,
    ];
};

/** The interface-name suffix carrying a type's per-signal handler map. */
const SIGNAL_HANDLERS_SUFFIX = "SignalHandlers";
const SIGNAL_EMIT_SUFFIX = "SignalEmit";

/**
 * Renders the module-level declarations that type a class's signal-connection
 * surface: a `<Class>SignalHandlers` map keyed by signal name, a parallel
 * `<Class>SignalEmit` map giving each signal's `emit` arguments and result, and —
 * when the class introduces signals of its own — a declaration-merged
 * `interface <Class>` whose `connect`/`on`/`once`/`off` overloads narrow the
 * handler off the handler map and whose `emit` overload narrows the arguments and
 * result off the emit map, falling back to the untyped `string` signature for
 * dynamic and detailed (`"notify::prop"`) names.
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
    if (klass.glibGetType !== undefined && collectClassSignals(context, klass).length > 0) {
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
 * class introduces, extending the parent type's map so inherited signals resolve
 * through `keyof`. `renderEntry` renders each signal's value type — a handler
 * function for the handler map, an `{ args; result }` shape for the emit map.
 */
const renderSignalMap = (spec: SignalMapSpec): string => {
    const { context, klass, className, parentlessExtendsObject, suffix, renderEntry } = spec;
    const extendsRef = signalMapParentRef(context, klass, parentlessExtendsObject, suffix);
    const extendsClause = extendsRef === undefined ? "" : ` extends ${extendsRef}`;
    const entries = collectClassSignals(context, klass).map(
        (collected) => `${quote(collected.signal.name)}: ${renderEntry(context, collected)};`,
    );
    const body = entries.length === 0 ? "" : `\n${indent(entries.join("\n"), 1)}\n`;
    return `export interface ${className}${suffix}${extendsClause} {${body}}`;
};

/**
 * Resolves the `<Parent><Suffix>` reference a type's signal map extends: the
 * parent class's map (qualified across namespaces), the `GObject.Object` map for a
 * parentless interface wrapper, or `undefined` for the root `GObject.Object`.
 */
const signalMapParentRef = (
    context: ModuleContext,
    klass: GirClass,
    parentlessExtendsObject: boolean,
    suffix: string,
): string | undefined => {
    if (klass.parent !== undefined) {
        const { namespaceName, typeName } = splitQualifiedName(klass.parent, context.namespace.name);
        const name = `${toPascalCase(typeName)}${suffix}`;
        if (namespaceName === context.namespace.name) return name;
        return `${context.addCrossNamespaceImport(namespaceName)}.${name}`;
    }
    if (!parentlessExtendsObject) return undefined;
    if (context.namespace.name === "GObject") return `Object${suffix}`;
    return `${context.addCrossNamespaceImport("GObject")}.Object${suffix}`;
};

/**
 * Renders the declaration-merged `interface <Class>` carrying the typed
 * `connect`/`emit`/`on`/`once`/`off` overloads. `connect`/`on`/`once`/`off` narrow
 * the handler off the `SignalHandlers` map; `emit` narrows its arguments and
 * result off the `SignalEmit` map, whose shape differs from a handler for
 * caller-allocated outs. `on`/`once`/`off` are omitted for the root
 * `GObject.Object`, whose untyped EventEmitter-style methods are declared by the
 * hand-written overlay; every subclass shadows them with typed overloads.
 */
const renderSignalConnectInterface = (className: string, isRootObject: boolean): string => {
    const map = `${className}${SIGNAL_HANDLERS_SUFFIX}`;
    const emitMap = `${className}${SIGNAL_EMIT_SUFFIX}`;
    const lines = [
        `connect<K extends keyof ${map}>(signal: K, handler: ${map}[K], after?: boolean): number;`,
        `connect(signal: string, handler: ${SIGNAL_HANDLER_TYPE}, after?: boolean): number;`,
        `emit<K extends keyof ${emitMap}>(sigName: K, ...args: ${emitMap}[K]["args"]): ${emitMap}[K]["result"];`,
        "emit(sigName: string, ...args: unknown[]): unknown;",
    ];
    if (!isRootObject) {
        lines.push(
            `on<K extends keyof ${map}>(signal: K, handler: ${map}[K], after?: boolean): this;`,
            `on(signal: string, handler: ${SIGNAL_HANDLER_TYPE}, after?: boolean): this;`,
            `once<K extends keyof ${map}>(signal: K, handler: ${map}[K], after?: boolean): this;`,
            `once(signal: string, handler: ${SIGNAL_HANDLER_TYPE}, after?: boolean): this;`,
            `off<K extends keyof ${map}>(signal: K, handler: ${map}[K]): this;`,
            `off(signal: string, handler: ${SIGNAL_HANDLER_TYPE}): this;`,
        );
    }
    return `export interface ${className} {\n${indent(lines.join("\n"), 1)}\n}`;
};

/**
 * Renders the TypeScript type of a signal's handler: `(in params) => result`,
 * mirroring the trampoline {@link renderInvokeClosure} marshals. The emitting
 * instance (trampoline arg 0) is not passed to the handler, so it is absent here;
 * out- and scalar-inout parameters surface through the result tuple
 * {@link renderResultType} encodes rather than the parameter list.
 */
const renderSignalHandlerType = (context: ModuleContext, collected: CollectedSignal): string => {
    const { signal, namespaceName } = collected;
    const params = renderHandlerParameters(signal.parameters, namespaceName, (ref, nullable) =>
        renderTsType(context, ref, nullable),
    );
    return `(${params.join(", ")}) => ${renderResultType(context, collected, false, true)}`;
};

/**
 * Assembles a signal's result type from its primary return and out-value types,
 * following the tuple convention {@link renderEmitReturn} reads back: a single
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
    const { signal, namespaceName } = collected;
    const returnRef = signal.returnValue.skip ? undefined : qualifyTypeRef(signal.returnValue.type, namespaceName);
    const primary = isVoidRef(returnRef) ? undefined : renderTsType(context, returnRef, signal.returnValue.nullable);
    const outTypes = signal.parameters
        .filter(
            (parameter) =>
                !parameter.isVarargs &&
                (isOutParameter(parameter) ||
                    isCellInout(context, parameter) ||
                    (includeCallerAllocated && isCallerAllocatedOut(parameter))),
        )
        .map((parameter) => renderTsType(context, qualifyTypeRef(parameter.type, namespaceName), false));
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
    const { signal, namespaceName } = collected;
    const args = renderHandlerParameters(
        signal.parameters,
        namespaceName,
        (ref, nullable) => renderTsType(context, ref, nullable),
        isCallerAllocatedOut,
    );
    const result = renderResultType(context, collected, true, false);
    return `{ args: [${args.join(", ")}]; result: ${result} }`;
};

/**
 * Renders one `connect` switch case: it resolves the signal's typed trampoline,
 * wraps the user handler with the per-signal in-parameter marshalling closure,
 * and dispatches `g_signal_connect_data` through {@link connectSignal} with the
 * full detailed signal name.
 */
const renderConnectCase = (context: ModuleContext, collected: CollectedSignal): string => {
    const { signal } = collected;
    const { trampoline, invoke } = renderTrampolineAndInvoke(context, collected);
    const body = [
        `const invoke = ${invoke};`,
        "const handlerWrapper = (...args: unknown[]): unknown => invoke(handler, args);",
        `return connectSignal(this, signal, ${trampoline}, handlerWrapper, after ?? false);`,
    ].join("\n");
    return `case ${quote(signal.name)}: {\n${indent(body, 1)}\n}`;
};

/**
 * Renders one `emit` switch case. In-parameters marshal into `GValue`s with
 * `valueFromFfi`; out- and scalar-inout parameters marshal into pointer-backed
 * cells via `outValueFromFfi`; a caller-allocated boxed out-parameter is
 * allocated here and copied into a `G_TYPE_BOXED` `GValue` by `outBoxedFromFfi`
 * so the handler reached through `g_signal_emitv` fills the value's owned copy,
 * which `getBoxed` reads back after emission; a boxed inout-parameter shares the
 * caller's wrapper in place through `inoutBoxedFromFfi` (`g_value_set_static_boxed`),
 * so the handler's mutation lands on the caller's object directly and surfaces
 * through that wrapper rather than the return tuple. After emission the case
 * returns the signal's result — the non-void return value (via `valueToJS`)
 * together with every out value — using the same tuple convention
 * {@link renderSignalReturnType} describes for handlers. Out-parameters consume
 * no emit argument; in- and inout-parameters do. A caller-allocated
 * out-parameter that is not a boxed record — a raw buffer, or a class with no
 * boxed `GType` — throws, since `outBoxedFromFfi` has no `GType` to resolve for
 * it.
 */
const renderEmitCase = (context: ModuleContext, collected: CollectedSignal): string => {
    const { signal, namespaceName } = collected;
    const params = signal.parameters.filter((parameter) => !parameter.isVarargs);
    if (params.some((parameter) => isCallerAllocatedOut(parameter) && !isBoxedCallerOut(context, parameter))) {
        return renderUnsupportedEmitCase(signal);
    }
    context.addValueFromFfiImport();
    const refs = gobjectRefs(context);

    const preStatements: string[] = [];
    const valueExprs: string[] = [];
    const outReads: string[] = [];
    let argIndex = 0;
    params.forEach((parameter, index) => {
        const ffi = renderFfiType(context, qualifyTypeRef(parameter.type, namespaceName), parameter.transferOwnership);
        const cell = `_out${index}`;
        if (isOutParameter(parameter) || isCellInout(context, parameter)) {
            context.addRuntimeImport("outValueFromFfi");
            const seed = isOutParameter(parameter) ? "" : `, args[${argIndex++}]`;
            preStatements.push(`const ${cell} = outValueFromFfi(${ffi}${seed});`);
            valueExprs.push(`${cell}.value`);
            outReads.push(`${cell}.read()`);
        } else if (isCallerAllocatedOut(parameter)) {
            context.addRuntimeImport("outBoxedFromFfi");
            context.addRuntimeImport("getBoxed");
            preStatements.push(
                `const ${cell} = outBoxedFromFfi(${ffi}, ${renderCallerOutAllocation(context, parameter, namespaceName)});`,
            );
            valueExprs.push(cell);
            outReads.push(`getBoxed(${cell})`);
        } else if (isBoxedInout(context, parameter)) {
            context.addRuntimeImport("inoutBoxedFromFfi");
            valueExprs.push(`inoutBoxedFromFfi(${ffi}, args[${argIndex++}])`);
        } else {
            valueExprs.push(`valueFromFfi(${ffi}, args[${argIndex++}])`);
        }
    });

    const values = `[${['valueFromFfi(t.object("full"), this)', ...valueExprs].join(", ")}]`;
    const lookup = `${refs.signalLookup}(${quote(signal.name)}, this.__gtype__)`;
    const returnRef = qualifyTypeRef(signal.returnValue.type, namespaceName);
    const isVoid = signal.returnValue.skip || returnRef === undefined || isVoidRef(returnRef);

    const statements = [...preStatements];
    if (isVoid) {
        statements.push(`${refs.signalEmitv}(${values}, ${lookup}, 0);`);
    } else {
        statements.push(`const returnValue = new ${refs.Value}();`);
        statements.push(`returnValue.init(${renderReturnGType(context, returnRef)});`);
        statements.push(`${refs.signalEmitv}(${values}, ${lookup}, 0, returnValue);`);
    }
    statements.push(renderEmitReturn(context, isVoid, outReads));

    return `case ${quote(signal.name)}: {\n${indent(statements.join("\n"), 1)}\n}`;
};

/**
 * Renders an `emit` case's `return` statement following the tuple convention
 * {@link renderSignalReturnType} encodes: a non-void return alone, a single
 * out-cell alone, or `[primary?, ...outs]` when both are present.
 *
 * @param context - The module context
 * @param isVoid - Whether the signal's return type is void
 * @param outReads - Per-out-cell `read()` expressions in declaration order
 */
const renderEmitReturn = (context: ModuleContext, isVoid: boolean, outReads: readonly string[]): string => {
    let primary: string | undefined;
    if (!isVoid) {
        context.addRuntimeImport("valueToJS");
        primary = "valueToJS(returnValue)";
    }
    if (outReads.length === 0) {
        return primary === undefined ? "return;" : `return ${primary};`;
    }
    if (primary !== undefined) {
        return `return [${[primary, ...outReads].join(", ")}];`;
    }
    if (outReads.length === 1) {
        return `return ${outReads[0]};`;
    }
    return `return [${outReads.join(", ")}];`;
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
    return `case ${quote(signal.name)}: {\n${indent(`throw new globalThis.Error(${quote(message)});`, 1)}\n}`;
};

/**
 * Renders the `new Namespace.Type()` allocation for a caller-allocated boxed or
 * class out-parameter, qualifying the wrapper through its owning namespace.
 *
 * @param context - The module context
 * @param parameter - The caller-allocated out parameter (a named boxed/class)
 * @param namespaceName - The signal's namespace, used when the type is unqualified
 */
const renderCallerOutAllocation = (context: ModuleContext, parameter: GirParameter, namespaceName: string): string => {
    const type = parameter.type;
    if (type === undefined || type.kind !== "named") {
        throw new Error("renderCallerOutAllocation: expected a named caller-allocated out-parameter");
    }
    const owner = type.namespaceName ?? namespaceName;
    return `new ${context.qualify(owner, type.typeName)}()`;
};

/**
 * Resolves the `GObject` marshalling references the inline `emit` switch needs.
 * Within the `GObject` namespace the generated `Value`, `signalEmitv`, and
 * `signalLookup` are local; elsewhere they are reached through the cross-
 * namespace `GObject` alias.
 */
const gobjectRefs = (context: ModuleContext): GObjectRefs => {
    if (context.namespace.name === "GObject") {
        return { Value: "Value", signalEmitv: "signalEmitv", signalLookup: "signalLookup" };
    }
    const alias = context.addCrossNamespaceImport("GObject");
    return { Value: `${alias}.Value`, signalEmitv: `${alias}.signalEmitv`, signalLookup: `${alias}.signalLookup` };
};

/**
 * Renders the trampoline FFI descriptor used to connect a handler and the
 * `invoke` closure that marshals the trampoline arguments into the user handler.
 *
 * Out-parameter cells are wrapped in `t.ref(...)` so the native trampoline can
 * write them back; the `invoke` closure mirrors the out-parameter tuple
 * convention used by method out-parameters.
 */
const renderTrampolineAndInvoke = (
    context: ModuleContext,
    collected: CollectedSignal,
): { readonly trampoline: string; readonly invoke: string } => {
    const { signal, namespaceName } = collected;
    const params = signal.parameters.filter((parameter) => !parameter.isVarargs);
    const paramFfi = params.map((parameter) =>
        renderFfiType(context, qualifyTypeRef(parameter.type, namespaceName), parameter.transferOwnership),
    );
    const trampolineParamFfi = params.map((parameter, index) =>
        isOutParameter(parameter) || isCellInout(context, parameter) ? `t.ref(${paramFfi[index]})` : paramFfi[index],
    );
    const returnRef = qualifyTypeRef(signal.returnValue.type, namespaceName);
    const isVoid = isVoidRef(returnRef);
    const returnFfi = isVoid ? "t.void" : renderFfiType(context, returnRef, signal.returnValue.transferOwnership);
    const trampolineArgs = ['t.object("borrowed")', ...trampolineParamFfi, "t.void"].join(", ");
    const trampoline = `t.trampoline([${trampolineArgs}], ${returnFfi}, { hasDestroy: true, userDataIndex: ${params.length + 1} })`;
    const omitsReturn = isVoid || signal.returnValue.skip;
    const invoke = renderInvokeClosure(context, collected, params, omitsReturn ? undefined : returnRef);
    return { trampoline, invoke };
};

const collectClassSignals = (context: ModuleContext, klass: GirClass): readonly CollectedSignal[] => {
    const inheritedNames = collectInheritedSignalNames(context, klass);
    const seen = new Set<string>();
    const result: CollectedSignal[] = [];
    for (const signal of klass.signals) {
        const name = toCamelCase(signal.name);
        if (inheritedNames.has(name) || seen.has(name)) continue;
        seen.add(name);
        result.push({ signal, namespaceName: context.namespace.name });
    }
    for (const implementName of klass.implements) {
        const iface = resolveImplementedInterface(context, implementName);
        if (iface === undefined) continue;
        for (const signal of iface.klass.signals) {
            const name = toCamelCase(signal.name);
            if (inheritedNames.has(name) || seen.has(name)) continue;
            seen.add(name);
            result.push({ signal, namespaceName: iface.namespaceName });
        }
    }
    return result;
};

const collectInheritedSignalNames = (context: ModuleContext, klass: GirClass): ReadonlySet<string> => {
    const names = new Set<string>();
    forEachAncestor(context, klass, (ancestor) => {
        for (const signal of ancestor.klass.signals) names.add(toCamelCase(signal.name));
        for (const implementName of ancestor.klass.implements) {
            const iface = resolveImplementedInterface(context, implementName, ancestor.namespaceName);
            if (iface === undefined) continue;
            for (const signal of iface.klass.signals) names.add(toCamelCase(signal.name));
        }
    });
    return names;
};

const renderInvokeClosure = (
    context: ModuleContext,
    collected: CollectedSignal,
    params: readonly GirParameter[],
    returnRef: GirTypeRef | undefined,
): string => {
    const { namespaceName } = collected;
    const { callArgs, outArgIndices } = planTrampolineArgs(context, params, namespaceName, 1);
    if (outArgIndices.length === 0) {
        if (returnRef !== undefined && isHandlePassing(context, returnRef)) {
            context.addRuntimeImport("tryGetHandle");
            return `(handler, args) => {\n    const _result = handler(${callArgs});\n    return tryGetHandle(_result);\n}`;
        }
        return `(handler, args) => handler(${callArgs})`;
    }
    return renderOutParamInvoke(context, callArgs, outArgIndices, returnRef);
};

/**
 * Renders the invoke closure for a signal with out-parameters.
 *
 * The handler returns its results as the tuple {@link renderMethodReturnType}
 * describes (`[primary, ...outs]` when both exist, the scalar out alone for a
 * void return with a single out, or an out-only tuple otherwise). The shared
 * {@link renderTupleWriteback} destructures that tuple and writes each out
 * value into its trampoline cell's `value` slot — the native side flushes
 * those cells through the matching C out-pointers, so the tuple convention
 * stays entirely in generated code.
 *
 * @param context - The module context
 * @param callArgs - The rendered in-parameter call arguments
 * @param outArgIndices - Trampoline-arg indices of the out-parameter cells
 * @param returnRef - The signal's return type, or `undefined` for void
 */
const renderOutParamInvoke = (
    context: ModuleContext,
    callArgs: string,
    outArgIndices: readonly number[],
    returnRef: GirTypeRef | undefined,
): string => {
    const body = renderTupleWriteback(context, `handler(${callArgs})`, outArgIndices, returnRef);
    return `(handler, args) => {\n    ${body}\n}`;
};

const renderReturnGType = (context: ModuleContext, ref: GirTypeRef): string => {
    if (ref.kind === "primitive") {
        return `${typeFromNameReference(context)}(${quote(primitiveGTypeName(ref.category))})`;
    }
    if (ref.kind === "named") {
        const owner = ref.namespaceName ?? context.namespace.name;
        const resolved = context.repository.resolveNamed(owner, ref.typeName);
        if (resolved !== undefined && resolved.kind === "enum") {
            context.addNativeImport("call");
            context.addRuntimeImport("t");
            const lib = resolved.namespace.sharedLibrary ?? "";
            const getter = resolved.value.glibGetType ?? "";
            return `call(${quote(lib)}, ${quote(getter)}, [], t.uint64)`;
        }
        if (
            resolved !== undefined &&
            (resolved.kind === "class" || resolved.kind === "interface" || resolved.kind === "boxed")
        ) {
            const glibTypeName = glibTypeNameOf(resolved.value) ?? ref.typeName;
            return `${typeFromNameReference(context)}(${quote(glibTypeName)})`;
        }
    }
    return `${typeFromNameReference(context)}("GObject")`;
};

const isVoidRef = (ref: GirTypeRef | undefined): boolean =>
    ref === undefined || (ref.kind === "primitive" && ref.category === "void");

const glibTypeNameOf = (value: {
    readonly glibTypeName?: string | undefined;
    readonly cType?: string | undefined;
}): string | undefined => value.glibTypeName ?? value.cType;

const typeFromNameReference = (context: ModuleContext): string => {
    if (context.namespace.name === "GObject") return "typeFromName";
    const alias = context.addCrossNamespaceImport("GObject");
    return `${alias}.typeFromName`;
};

const primitiveGTypeName = (category: PrimitiveTypeRef["category"]): string => {
    switch (category) {
        case "boolean":
            return "gboolean";
        case "int8":
        case "int16":
        case "int32":
            return "gint";
        case "uint8":
        case "uint16":
        case "uint32":
        case "unichar":
            return "guint";
        case "int64":
            return "gint64";
        case "uint64":
        case "pointer":
            return "guint64";
        case "float32":
            return "gfloat";
        case "float64":
            return "gdouble";
        case "string":
            return "gchararray";
        case "void":
            return "void";
    }
};
