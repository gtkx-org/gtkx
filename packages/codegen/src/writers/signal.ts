import { quote, toCamelCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import type { GirClass } from "../gir/class.js";
import type { GirParameter } from "../gir/parameter.js";
import { isCallerAllocatedOut, isOutParameter } from "../gir/parameter.js";
import { qualifyTypeRef } from "../gir/qualify.js";
import type { GirSignal } from "../gir/signal.js";
import type { GirTypeRef, PrimitiveTypeRef } from "../gir/type-ref.js";
import { forEachAncestor, resolveImplementedInterface } from "./inheritance.js";
import { planTrampolineArgs, renderTupleWriteback } from "./method.js";
import { isCollectibleCallerOut, isHandlePassing } from "./param-classify.js";
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
 * cells via `outValueFromFfi`; a caller-allocated boxed/class out-parameter is
 * allocated here and referenced in place by `outBoxedFromFfi` (a no-copy
 * `GValue`) so the handler reached through `g_signal_emitv` fills it. After
 * emission the case returns the signal's result — the non-void return value
 * (via `valueToJS`) together with every out value — using the same tuple
 * convention {@link renderSignalReturnType} describes for handlers.
 * Out-parameters consume no emit argument; in- and inout-parameters do. A
 * caller-allocated out-parameter the runtime cannot allocate (a raw buffer with
 * no boxed/class wrapper) throws, since `emit()` has nowhere to source the
 * storage.
 */
const renderEmitCase = (context: ModuleContext, collected: CollectedSignal): string => {
    const { signal, namespaceName } = collected;
    const params = signal.parameters.filter((parameter) => !parameter.isVarargs);
    if (params.some((parameter) => isCallerAllocatedOut(parameter) && !isCollectibleCallerOut(context, parameter))) {
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
            preStatements.push(`const ${cell} = ${renderCallerOutAllocation(context, parameter, namespaceName)};`);
            valueExprs.push(`outBoxedFromFfi(${ffi}, ${cell})`);
            outReads.push(cell);
        } else {
            valueExprs.push(`valueFromFfi(${ffi}, args[${argIndex++}])`);
        }
    });

    const values = `[${['valueFromFfi(t.object("full"), this)', ...valueExprs].join(", ")}]`;
    const lookup = `${refs.signalLookup}(${quote(signal.name)}, this.__gtype__)`;
    const returnRef = qualifyTypeRef(signal.returnValue.type, namespaceName);
    const isVoid = returnRef === undefined || isVoidRef(returnRef);

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
 * caller-allocated out-parameter the runtime cannot allocate (a raw buffer with
 * no boxed/class wrapper), so `emit()` has nowhere to source the storage.
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
    const invoke = renderInvokeClosure(context, collected, params, isVoid ? undefined : returnRef);
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
