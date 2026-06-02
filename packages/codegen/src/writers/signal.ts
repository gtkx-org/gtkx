import { quote, toCamelCase, toPascalCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import type { GirClass } from "../gir/class.js";
import type { GirParameter } from "../gir/parameter.js";
import { isOutParameter } from "../gir/parameter.js";
import { qualifyTypeRef } from "../gir/qualify.js";
import type { GirSignal } from "../gir/signal.js";
import type { GirTypeRef, PrimitiveTypeRef } from "../gir/type-ref.js";
import { forEachAncestor, resolveImplementedInterface } from "./inheritance.js";
import { isHandlePassing, planTrampolineArgs, renderTupleWriteback } from "./method.js";
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

/**
 * Renders the `connect` and `emit` instance methods for a class that owns or
 * inherits-by-interface at least one signal.
 *
 * Both delegate to the runtime signal dispatcher (`connectSignal` /
 * `emitSignal`) and route unknown-signal lookups up the class chain via
 * `super.connect` / `super.emit`. The root `GObject.Object` emits the same
 * shapes without a parent fallback because it bottoms out the hierarchy.
 *
 * Returns an empty array when the class contributes no signals of its own.
 *
 * @param context - The module context
 * @param klass - The class whose signal methods to render
 */
export const renderSignalMembers = (context: ModuleContext, klass: GirClass): readonly string[] => {
    if (klass.glibGetType === undefined) return [];
    if (collectClassSignals(context, klass).length === 0) return [];
    context.addRuntimeImport("connectSignal");
    context.addRuntimeImport("emitSignal");
    const className = toPascalCase(klass.name);
    const isRootObject = context.namespace.name === "GObject" && klass.name === "Object";
    const connectBody = isRootObject
        ? `return connectSignal({ instance: this, cls: ${className} }, signal, handler, { after });`
        : `return connectSignal({ instance: this, cls: ${className} }, signal, handler, { after, parentConnect: (s, h, a) => super.connect(s, h, a) });`;
    const emitBody = isRootObject
        ? `emitSignal({ instance: this, cls: ${className} }, sigName, args);`
        : `emitSignal({ instance: this, cls: ${className} }, sigName, args, (s, ...a) => super.emit(s, ...a));`;
    return [
        `connect(signal: string, handler: ${SIGNAL_HANDLER_TYPE}, after?: boolean): number {\n    ${connectBody}\n}`,
        `emit(sigName: string, ...args: unknown[]): void {\n    ${emitBody}\n}`,
    ];
};

/**
 * Renders the `{ table: new Map([...]), gobject: { … } }` signal-registration
 * fragment for a class or interface descriptor's `signals` field, or
 * `undefined` when the type exposes no signals of its own.
 *
 * Each table entry carries the trampoline FFI descriptor used to connect a
 * handler, an `invoke` closure that marshals trampoline arguments into the user
 * handler, the per-parameter emit types, and the return-value `GType` resolver.
 * The `gobject` field supplies the `GObject` marshalling surface the runtime
 * emit path needs; the class's shared GType comes from the descriptor.
 *
 * @param context - The module context
 * @param klass - The class whose signals to bind
 */
export const renderSignalRegistration = (context: ModuleContext, klass: GirClass): string | undefined => {
    if (klass.glibGetType === undefined) return undefined;
    const signals = collectClassSignals(context, klass);
    if (signals.length === 0) return undefined;
    const entries = signals.map((collected) => renderSignalEntry(context, collected));
    const map = entries.length === 0 ? "[]" : `[\n${indent(entries.join(",\n"), 1)},\n]`;
    const gobject = renderGObjectSurface(context);
    const body = `table: new globalThis.Map(${map}),\ngobject: ${gobject},`;
    return `{\n${indent(body, 1)}\n}`;
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

const renderSignalEntry = (context: ModuleContext, collected: CollectedSignal): string => {
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
    const emitTypes = `[${paramFfi.join(", ")}]`;
    const returnGType = isVoid || returnRef === undefined ? "null" : `() => ${renderReturnGType(context, returnRef)}`;
    const body = [
        `trampoline: ${trampoline},`,
        `invoke: ${invoke},`,
        `emitTypes: ${emitTypes},`,
        `returnGType: ${returnGType},`,
    ].join("\n");
    return `[${quote(signal.name)}, {\n${indent(body, 1)}\n}]`;
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
            context.addRuntimeImport("call");
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

const renderGObjectSurface = (context: ModuleContext): string => {
    context.addValueFromFfiImport();
    if (context.namespace.name === "GObject") {
        return "{ Value, valueFromFfi, signalEmitv, signalLookup }";
    }
    const alias = context.addCrossNamespaceImport("GObject");
    return `{ Value: ${alias}.Value, valueFromFfi, signalEmitv: ${alias}.signalEmitv, signalLookup: ${alias}.signalLookup }`;
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
